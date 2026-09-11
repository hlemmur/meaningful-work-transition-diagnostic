import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import {
  completeMockPurchase,
  getDraftReport,
  listAnalysisRuns,
  recordWelcomeConsent,
  resetMockTracerStore,
  runAnalysisPipeline,
  saveAnswer,
  submitAssessment,
} from "./service";

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
      "Q1.1": "FORCE_SCHEMA_FAILURE",
    });
    const result = await runAnalysisPipeline(assessmentId);

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass3");
    const pass3 = (await listAnalysisRuns(assessmentId)).filter((run) => run.stage === "pass3");
    expect(pass3).toHaveLength(1);
    expect(pass3[0]?.status).toBe("failure");
    expect(pass3[0]?.attempt).toBe(2);
    expect(pass3[0]?.error).toMatch(/schema/i);
    expect((await listAnalysisRuns(assessmentId)).some((run) => run.stage === "pass4")).toBe(false);
  });

  it("includes a practical rival when constraints warrant it", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "I want out.",
      "Q0.5": "Visa rules and rent due next month.",
    });
    const result = await runAnalysisPipeline(assessmentId, { fixture: "practical-rival" });
    const practical = result.caseState.hypotheses.filter(
      (item) =>
        item.category === "practical" ||
        item.category === "economic" ||
        item.category === "occupational",
    );
    expect(practical.length).toBeGreaterThan(0);
  });

  it("drops rank when the image vote weakens the favorite", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "IMAGE_WEAKENS",
      "Q10.1": "An empty landscape with no path.",
    });
    const result = await runAnalysisPipeline(assessmentId, { fixture: "image-weakens" });
    expect(result.caseState.hypotheses[0]?.id).toBe("hyp-practical");
    expect(result.caseState.imageVote?.verdict).toBe("weakens");
  });

  it("keeps critic+constraints resolution when a later stage is resumed", async () => {
    const { assessmentId } = await submittedAssessment({
      "Q1.1": "CRITIC_CONSTRAINTS_WIN",
      "Q0.5": "No savings and a dependent parent.",
      "Q11.3": "See the contradiction I cannot name",
    });

    const interrupted = await runAnalysisPipeline(assessmentId, {
      fixture: "critic-constraints-win",
      failStage: "pass5",
    });
    expect(interrupted.status).toBe("failed");
    expect(interrupted.failedStage).toBe("pass5");

    const result = await runAnalysisPipeline(assessmentId, {
      fixture: "critic-constraints-win",
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
      fixture: "critic-constraints-win",
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
      "Q1.1": "EMPTY_JUNGIAN",
    });
    const result = await runAnalysisPipeline(assessmentId, { fixture: "empty-jungian" });
    expect(result.caseState.jungianLenses).toEqual([]);
    expect((await getDraftReport(assessmentId))?.generated.sections.some((section) =>
      /jungian/i.test(section.title),
    )).toBe(false);
  });

  it("requires valid evidenceRefs on every major report claim", async () => {
    const { assessmentId } = await submittedAssessment();
    const result = await runAnalysisPipeline(assessmentId);
    const report = await getDraftReport(assessmentId);
    const evidenceIds = new Set(
      result.caseState.consciousNarrative.statedProblem.map((item) => item.id),
    );
    expect(report?.generated.sections.length).toBeGreaterThan(0);
    for (const section of report?.generated.sections ?? []) {
      expect(section.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of section.evidenceRefs) {
        expect(evidenceIds.has(ref) || ref.startsWith(`${assessmentId}:`)).toBe(true);
      }
    }
  });
});
