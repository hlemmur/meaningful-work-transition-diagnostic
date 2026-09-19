import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import type { LlmAdapter } from "@/server/adapters/types";
import { evaluateReport } from "@/eval/rubric";
import { evaluateFrameworkFidelity } from "@/eval/framework-fidelity";
import { executeAnalysis } from "@/engine/pipeline/run";
import { inferAnalysisFixture, type AnalysisFixture } from "./fixtures";
import { pass8OutputSchema } from "@/engine/pipeline/stage-schemas";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "../test-support/fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

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

async function runFixture(
  fixture: AnalysisFixture,
  answers: Record<string, unknown> = {},
) {
  return executeAnalysis({
    assessmentId: "fx-1",
    answers: {
      "Q0.4": 5,
      "Q0.5": "A fictional participant needs stable income during the transition.",
      "Q1.1": "A fictional participant stalls while testing a meaningful career change.",
      "Q1.3": "Visible experiments still feel risky.",
      "Q2.1": "The need for change became clear during a synthetic project.",
      "Q2.2": "They tried small portfolio experiments.",
      "Q4.4": ["clear_expectations"],
      "Q9.2": "Staying preserves a familiar fictional routine.",
      "Q10.1": "A fictional traveler stands at a gate.",
      ...answers,
    },
    completedStages: [],
    llm: llmForFixture(fixture),

    persistRun() {},
    persistCaseState() {},
  });
}

describe("negative and positive mock fixtures", () => {
  it("binds default pass8 output to the preferred caseSnapshot hypothesis id", async () => {
    const result = await mockLlmAdapter.completeStructured({
      stage: "pass8",
      model: "mock-strong",
      input: {
        fixture: "default",
        assessmentId: "fx-bind",
        evidenceRef: "fx-bind:Q1.1",
        caseSnapshot: {
          experimentBindings: {
            hypothesisIds: ["hyp-snapshot"],
            openForkIds: ["legitimacy_loop"],
            preferredHypothesisId: "hyp-snapshot",
          },
        },
      },
    });

    const output = pass8OutputSchema.parse(result.output);
    expect(output.experiments[0]?.hypothesisTested).toBe("hyp-snapshot");
  });

  it("infers fixture markers", () => {
    expect(inferAnalysisFixture({ "Q1.1": "EMPTY_CRITIQUES" })).toBe("empty-critiques");
    expect(inferAnalysisFixture({ "Q1.1": "EMPTY_JUNGIAN_NO_OMIT" })).toBe("empty-jungian-no-omit");
    expect(inferAnalysisFixture({ "Q1.1": "ORIGIN_GOLD" })).toBe("origin-gold");
    expect(inferAnalysisFixture({ "Q1.1": "IMAGE_STARVED_PEEL" })).toBe("image-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "PROJECTION_STARVED_PEEL" })).toBe("projection-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "MONEY_STARVED_PEEL" })).toBe("money-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "CLINICAL_VOICE_PEEL" })).toBe("clinical-voice-peel");
    expect(inferAnalysisFixture({ "Q1.1": "AIM_MISSING_PEEL" })).toBe("aim-missing-peel");
    expect(inferAnalysisFixture({ "Q1.1": "SPEECH_WITHOUT_IMAGINAL" })).toBe("speech-without-imaginal");
    expect(inferAnalysisFixture({ "Q1.1": "BECOMING_INFLATION_PEEL" })).toBe("becoming-inflation-peel");
    expect(inferAnalysisFixture({ "Q1.1": "NON_ORIGIN_SOFT_MINI" })).toBe("non-origin-soft-mini");
  });

  it("fails closed on empty jungian without omitReason (live miss)", async () => {
    const result = await runFixture("empty-jungian-no-omit", {
      "Q1.1": "I stall",
      "Q0.5": "ADHD",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass7");
  });

  it("fails closed on empty critiques", async () => {
    const result = await runFixture("empty-critiques", {
      "Q1.1": "I stall",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass4");
  });

  it("fails image-insufficient when rich associations exist", async () => {
    const result = await runFixture("image-insufficient-rich", {
      "Q1.1": "I stall",
      "Q10.1": "A rusty pipe across a threshold",
      "Q10.6": "The pipe says stay mid-crossing",
      "Q10.7": "Muddy water surrounds it",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass5");
  });

  it("fails wrong-experiment Magician critique on container fork", async () => {
    const result = await runFixture("wrong-experiment", {
      "Q1.1": "I stall without structure",
      "Q0.5": "ADHD",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass8");
  });

  it("fails senex-scold-only reports", async () => {
    const result = await runFixture("senex-scold-only", {
      "Q1.1": "I stall",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
  });

  it("fails image-starved-peel when Q10 is only experiment garnish", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: llmForFixture("image-starved-peel"),
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/Q10|image/i);
  });

  it("fails projection-starved-peel when figures are omitted", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: llmForFixture("projection-starved-peel"),
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/projection|Q5|Q6|hooked/i);
  });

  it("fails money-starved-peel when money Tier-A is omitted", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: llmForFixture("money-starved-peel"),
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/money|Q8|infrastructure/i);
  });

  it("fails clinical-voice-peel on third-person analyst diction", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: llmForFixture("clinical-voice-peel"),
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/client|second person|titles|analyst|clinical|essay/i);
  });

  it("sanitizes Q11.3-as-hidden and completes", async () => {
    const result = await runFixture("q113-as-hidden", {
      "Q1.1": "I stall",
      "Q11.3": "I hope it shows me some sharp angles that I can't unsee",
    });
    expect(result.status).toBe("completed");
    expect(result.caseState.hiddenPosition).toBeUndefined();
    expect(result.caseState.gateRemediations?.some((item) => /Q11\.3/i.test(item))).toBe(true);
  });

  it(
    "origin-gold passes rubric and framework fidelity",
    async () => {
      const answers: Record<string, unknown> = {
        ...originAnswers,
      };
  
      const result = await executeAnalysis({
        assessmentId: "origin",
        answers,
        completedStages: [],
        llm: llmForFixture("origin-gold"),
  
        persistRun() {},
        persistCaseState() {},
      });
  
      expect(result.status).toBe("completed");
      expect(result.report).toBeDefined();
  
      const peel = result.report!.sections
        .map((section) => section.body)
        .join("\n");
  
      expect(peel).toMatch(
        /protect|keeps|bargain/i,
      );
  
      expect(peel).toMatch(
        /aim|aliveness|structure in service/i,
      );
  
      expect(peel).toMatch(
        /image|scene|voice|ask/i,
      );
  
      expect(peel).not.toMatch(
        /romance of eternal becoming/i,
      );
  
      const rubric = evaluateReport({
        report: result.report!,
        caseState: result.caseState,
        requestedInsight: String(
          answers["Q11.3"] ?? "",
        ),
      });
  
      expect(rubric.passed).toBe(true);
  
      const fidelity = evaluateFrameworkFidelity({
        answers,
        caseState: result.caseState,
        report: result.report!,
      });
  
      expect(fidelity.hardPassed).toBe(true);
    },
  );

  it("fails aim-missing-peel when CaseState has aim but peel only names protection", async () => {
    const result = await runFixture("aim-missing-peel", {
      "Q1.1": "I stall",
      "Q1.3": "I lack confidence",
      "Q2.2": "I rewrote the site",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/aim\/protection|lacks both/i);
  });

  it("allows supplied obstacleSpeech without requiring dialogue or imaginal work", async () => {
    const result = await runFixture("speech-without-imaginal", {
      "Q1.1": "I stall at exposure",
      "Q1.3": "I lack confidence",
      "Q2.2": "I rewrote the site",
      "Q10.1": "A locked garden gate at dusk",
      "Q10.6": "Turn back until the ground is yours",
      "Q10.7": "Moss holds the latch shut",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("completed");
  });

  it("fails becoming-inflation-peel on romance of eternal becoming", async () => {
    const result = await runFixture("becoming-inflation-peel", {
      "Q1.1": "I stall",
      "Q1.3": "I lack confidence",
      "Q2.2": "I rewrote the site",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/inflation|eternal becoming|becoming/i);
  });

  it("non-origin soft mini passes soft-depth gates without pipe coupling", async () => {
    const answers: Record<string, unknown> = {
      "Q1.1": "I freeze before claiming space",
      "Q1.3": "I wait for permission",
      "Q2.2": "I circled the same draft for months",
      "Q0.5": "Focus drifts without a co-working block",
      "Q5.1": "I admire a quiet craftsperson who owns their pace",
      "Q6.1": "I reject loud hustle performers",
      "Q8.4": "Money used to arrive through a family shop till",
      "Q9.2": "Staying uncertain keeps me light and unclaimed",
      "Q9.3": "Claiming pace threatens my cool distance",
      "Q10.1": "A locked garden gate at dusk",
      "Q10.6": "Turn back until the ground is yours",
      "Q10.7": "Moss holds the latch shut",
      "Q11.3": "Show me the contradiction I cannot name",
    };
    const result = await executeAnalysis({
      assessmentId: "soft-mini",
      answers,
      completedStages: [],
      llm: llmForFixture("non-origin-soft-mini"),
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("completed");
    expect(result.report).toBeDefined();
    const peel = result.report!.sections.map((section) => section.body).join("\n");
    expect(peel).not.toMatch(/\bpipe\b/i);
    expect(peel).toMatch(/garden gate|gate/i);
    expect(peel).toMatch(/protect|keeps|bargain/i);
    expect(peel).toMatch(/aim|aliveness|structure in service/i);
    expect(peel).toMatch(/ask|voice|speech|turn back/i);
    const fidelity = evaluateFrameworkFidelity({
      answers,
      caseState: result.caseState,
      report: result.report!,
    });
    expect(fidelity.hardPassed).toBe(true);
  });

  it("completeness extraction on origin answers is full", () => {
    const state = extractCaseStateFull("o1", originAnswers);
    expect(state.projections.admiredFigures.length + state.projections.rejectedFigures.length).toBeGreaterThan(
      0,
    );
    expect(state.money.easyMoneyHistory.length + state.money.invisibleMachinery.length).toBeGreaterThan(0);
    expect(state.hiddenBargain.benefitsOfStaying.length + state.hiddenBargain.protectAndThreaten.length).toBeGreaterThan(
      0,
    );
    expect(state.symbolicMaterial.scene).toBeTruthy();
  });
});
