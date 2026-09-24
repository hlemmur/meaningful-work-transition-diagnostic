import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import { mockLlmAdapter } from "../adapters/openai/mock";
import type { LlmAdapter } from "../adapters/types";
import type { AnalysisFixture } from "@/engine/test-support/fixtures";
import {
  completeMockPurchase,
  getAdminCase,
  getDraftReport,
  listAnalysisRuns,
  recordWelcomeConsent,
  resetMockTracerStore,
  runAnalysisPipeline,
  saveAnswer,
  submitAssessment,
} from "./service";
import { REQUIRED_PEEL_SECTION_IDS } from "@/engine/schemas/analysis";
import { collectCanonicalEvidenceIds } from "@/engine/pipeline/evidence-ids";

function llmForFixture(
  fixture: AnalysisFixture,
): LlmAdapter {
  return {
    async completeStructured(request) {
      return mockLlmAdapter.completeStructured({
        ...request,
        input: {
          ...request.input,
          fixture,

          ...(fixture === "schema-fail" &&
          request.stage === "pass3"
            ? { failSchema: true }
            : {}),
        },
      });
    },
  };
}

async function submittedAssessment(
  answers: Record<string, unknown> = {
    "Q1.1": "I left a career that still pays my bills.",
    "Q1.3": "I lack confidence.",
    "Q2.2": "I rewrote the website twice.",
    "Q11.3": "See the contradiction I cannot name",
  },
) {
  const purchase = await completeMockPurchase("buyer@example.com");
  await recordWelcomeConsent({
    accessToken: purchase.accessToken,
    productConsent: true,
    marketingOptIn: false,
  });
  for (const [questionId, value] of Object.entries(answers)) {
    await saveAnswer(purchase.accessToken, questionId, value);
  }
  await submitAssessment(purchase.accessToken);
  return purchase;
}

afterEach(async () => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  await resetMockTracerStore();
});

beforeEach(async () => {
  process.env.APP_MODE = "mock";
});

describe("persisted Pass 1–10 analysis pipeline", () => {
  it("does not run on submit and leaves the assessment in review_pending", async () => {
    const { assessmentId } = await submittedAssessment();
    expect(await listAnalysisRuns(assessmentId)).toEqual([]);
    expect(await getDraftReport(assessmentId)).toBeUndefined();
  });

  it("runs passes 1–10, records usage, and stores a draft without delivering", async () => {
    const { assessmentId } = await submittedAssessment();
    const result = await runAnalysisPipeline(assessmentId);

    expect(result.status).toBe("completed");
    expect((await listAnalysisRuns(assessmentId)).map((run) => run.stage)).toEqual([
      "pass1",
      "pass2",
      "pass3",
      "pass4",
      "pass5",
      "pass6",
      "pass7",
      "pass8",
      "pass9",
      "pass10",
    ]);
    expect((await listAnalysisRuns(assessmentId)).every((run) => run.status === "success")).toBe(true);
    expect((await listAnalysisRuns(assessmentId)).find((run) => run.stage === "pass1")?.model).toBe(
      "mock-cheap",
    );
    expect((await listAnalysisRuns(assessmentId)).find((run) => run.stage === "pass3")?.model).toBe(
      "mock-strong",
    );
    expect((await listAnalysisRuns(assessmentId)).find((run) => run.stage === "pass8")?.promptVersion).toBe(
      "pass-8.v6",
    );
    expect((await listAnalysisRuns(assessmentId)).find((run) => run.stage === "pass9")?.promptVersion).toBe(
      "pass-9.v13",
    );
    expect((await listAnalysisRuns(assessmentId)).find((run) => run.stage === "pass10")?.promptVersion).toBe(
      "pass-10.v13",
    );
    expect((await listAnalysisRuns(assessmentId))[0]?.costUsd).toBeGreaterThan(0);
    expect((await getDraftReport(assessmentId))?.status).toBe("draft");
  });

  it("resumes from the first incomplete stage without redoing successes", async () => {
    const { assessmentId } = await submittedAssessment();
    await runAnalysisPipeline(assessmentId);
    const first = await listAnalysisRuns(assessmentId);
    await runAnalysisPipeline(assessmentId);
    expect(await listAnalysisRuns(assessmentId)).toEqual(first);
  });

  it("retries a forced schema failure once then records error", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I stall",
    });

    const result = await runAnalysisPipeline(
      assessmentId,
      {
        llm: llmForFixture("schema-fail"),
      },
    );

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass3");

    const pass3 = (
      await listAnalysisRuns(assessmentId)
    ).filter(
      (run) => run.stage === "pass3",
    );

    expect(pass3).toHaveLength(1);
    expect(pass3[0]?.status).toBe("failure");
    expect(pass3[0]?.attempt).toBe(2);
    expect(pass3[0]?.error).toMatch(
      /schema validation failed for pass3:[\s\S]*hypotheses/i,
    );

    const admin =
      await getAdminCase(assessmentId);

    expect(
      admin.analysisStatus.failedStage,
    ).toBe("pass3");

    expect(
      admin.analysisStatus.error,
    ).toMatch(/hypotheses/i);

    expect(
      (
        await listAnalysisRuns(
          assessmentId,
        )
      ).some(
        (run) => run.stage === "pass4",
      ),
    ).toBe(false);
  });

  it("includes a practical rival when constraints warrant it", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I want out.",
      "Q0.5": "Visa rules and rent due next month.",
    });
    const result = await runAnalysisPipeline(assessmentId, { llm: llmForFixture( "practical-rival") });
    const practical = result.caseState.hypotheses.filter(
      (item) =>
        item.category === "practical" ||
        item.category === "economic" ||
        item.category === "occupational",
    );
    expect(practical.length).toBeGreaterThan(0);
  });

  it("completes pass 5 when Q10 answers exceed the snapshot quote trim", async () => {
    const longScene = `A fictional traveler stands at a forest gate. ${"Cold trees and morning light surround them. ".repeat(16)}`;
    const longSpeech = `The gate says you came unequipped. ${"You left support behind and nothing is ahead. ".repeat(14)}`;
    expect(longScene.length).toBeGreaterThan(280);
    expect(longSpeech.length).toBeGreaterThan(400);

    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I left a career that still pays my bills.",
      "Q1.3": "I lack confidence.",
      "Q10.1": longScene,
      "Q10.2": "Cold trees, a visible path, and morning light surround them.",
      "Q10.6": longSpeech,
      "Q11.3": "See the contradiction I cannot name",
    });

    const result = await runAnalysisPipeline(assessmentId);

    expect(result.status).toBe("completed");
    expect(result.failedStage).toBeUndefined();
    expect(result.caseState.imageAnalysis?.literalFacts[0]?.text).toMatch(/fictional traveler/i);
  });

  it("re-ranks hypotheses when image votes weaken one and support another", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I feel stuck",
      "Q10.1": "An empty landscape with no path.",
      "Q10.2": "Nothing nearby offers direction or shelter.",
    });
    const result = await runAnalysisPipeline(assessmentId, { llm: llmForFixture("image-weakens") });
    expect(result.caseState.hypotheses[0]?.id).toBe("hyp-practical");
    expect(
      result.caseState.imageVotes.find(
        (vote) =>
          vote.hypothesisId === "hyp-depth",
      )?.verdict,
    ).toBe("weakens");
    expect(
      result.caseState.hypotheses[0]?.id,
    ).toBe("hyp-practical");

    expect(
      result.caseState.imageVotes.find(
        (vote) =>
          vote.hypothesisId === "hyp-depth",
      )?.verdict,
    ).toBe("weakens");

    expect(
      result.caseState.imageVotes.find(
        (vote) =>
          vote.hypothesisId ===
          "hyp-practical",
      )?.verdict,
    ).toBe("supports");
  });

  it("keeps critic+constraints resolution when a later stage is resumed", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I feel stuck in the transition",
      "Q0.5": "No savings and a dependent parent.",
      "Q11.3": "See the contradiction I cannot name",
    });

    const interrupted = await runAnalysisPipeline(assessmentId, {
      llm: llmForFixture("critic-constraints-win"),
      failStage: "pass5",
    });
    expect(interrupted.status).toBe("failed");
    expect(interrupted.failedStage).toBe("pass5");

    const result = await runAnalysisPipeline(assessmentId, {
      llm: llmForFixture("critic-constraints-win"),
    });
    expect(result.status).toBe("completed");
    expect(result.caseState.hiddenPosition).toBeUndefined();
  });

  it("omits Hidden Position when the critic and constraints win", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "CRITIC_CONSTRAINTS_WIN",
      "Q0.5": "No savings and a dependent parent.",
      "Q11.3": "See the contradiction I cannot name",
    });
    const result = await runAnalysisPipeline(assessmentId, {
      llm: llmForFixture( "critic-constraints-win"),
    });
    expect(result.caseState.hiddenPosition).toBeUndefined();
    expect((await getDraftReport(assessmentId))?.generated.sections.some((section) =>
      /hidden position/i.test(section.title),
    )).toBe(false);
    expect(result.caseState.hiddenPosition?.possibleHiddenPosition).not.toBe(
      "See the contradiction I cannot name",
    );
  });

  it("omits the Jungian report section when Pass 7 is empty", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I feel stuck",
    });
    const result = await runAnalysisPipeline(assessmentId, { llm: llmForFixture( "empty-jungian") });
    expect(result.caseState.jungianLenses).toEqual([]);
    expect((await getDraftReport(assessmentId))?.generated.sections.some((section) =>
      /jungian/i.test(section.title),
    )).toBe(false);
  });

  it("keeps the pass9 draft when pass10 regeneration fails hard gates", async () => {
    const { assessmentId } = await submittedAssessment();
    const rejected = await runAnalysisPipeline(assessmentId, {
      llm: {
        async completeStructured(request) {
          if (request.stage === "pass10") {
            const draft = request.input.draftReport as
              | { sections?: Array<{ id: string; title: string; body: string; evidenceRefs: string[] }> }
              | undefined;
            const problem = draft?.sections?.find((section) => section.id === "problem");
            return {
              stage: request.stage,
              fixture: "happy",
              output: {
                failingSectionIds: ["problem"],
                regeneratedSections: problem
                  ? [{ ...problem, body: `${problem.body} You are an eternal youth.` }]
                  : [],
              },
              model: request.model ?? "mock-cheap",
            };
          }
          return mockLlmAdapter.completeStructured(request);
        },
      },
    });

    expect(rejected.status).toBe("failed");
    expect(rejected.failedStage).toBe("pass10");
    const draft = await getDraftReport(assessmentId);
    expect(draft?.generated.sections.map((section) => section.body).join("\n")).not.toMatch(
      /eternal youth/i,
    );
    expect(draft?.status).toBe("draft");

    const resumed = await runAnalysisPipeline(assessmentId);
    expect(resumed.status).toBe("completed");
    expect((await getDraftReport(assessmentId))?.generated.sections.map((section) => section.body).join("\n")).not.toMatch(
      /eternal youth/i,
    );
  });

  it("requires valid evidenceRefs on every major report claim", async () => {
    const { assessmentId } = await submittedAssessment();
    const result = await runAnalysisPipeline(assessmentId);
    const report = await getDraftReport(assessmentId);
    const evidenceIds = new Set(collectCanonicalEvidenceIds(result.caseState));
    expect(report?.generated.sections.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(report?.generated.sections.map((section) => section.id));
    for (const id of REQUIRED_PEEL_SECTION_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    for (const section of report?.generated.sections ?? []) {
      expect(section.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of section.evidenceRefs) {
        expect(evidenceIds.has(ref)).toBe(true);
      }
    }
  });
});
