import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { evaluateReport } from "@/eval/rubric";
import { evaluateFrameworkFidelity } from "@/eval/framework-fidelity";
import { executeAnalysis } from "./run";
import { inferAnalysisFixture } from "./fixtures";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

async function runFixture(fixtureMarker: string, answers: Record<string, unknown> = {}) {
  const merged = { ...answers, "Q1.1": `${answers["Q1.1"] ?? "stall"} ${fixtureMarker}` };
  return executeAnalysis({
    assessmentId: "fx-1",
    answers: merged,
    completedStages: [],
    llm: mockLlmAdapter,
    persistRun() {},
    persistCaseState() {},
  });
}

describe("negative and positive mock fixtures", () => {
  it("infers fixture markers", () => {
    expect(inferAnalysisFixture({ "Q1.1": "EMPTY_CRITIQUES" })).toBe("empty-critiques");
    expect(inferAnalysisFixture({ "Q1.1": "EMPTY_JUNGIAN_NO_OMIT" })).toBe("empty-jungian-no-omit");
    expect(inferAnalysisFixture({ "Q1.1": "ORIGIN_GOLD" })).toBe("origin-gold");
    expect(inferAnalysisFixture({ "Q1.1": "IMAGE_STARVED_PEEL" })).toBe("image-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "PROJECTION_STARVED_PEEL" })).toBe("projection-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "MONEY_STARVED_PEEL" })).toBe("money-starved-peel");
    expect(inferAnalysisFixture({ "Q1.1": "CLINICAL_VOICE_PEEL" })).toBe("clinical-voice-peel");
  });

  it("fails closed on empty jungian without omitReason (live miss)", async () => {
    const result = await runFixture("EMPTY_JUNGIAN_NO_OMIT", {
      "Q1.1": "I stall",
      "Q0.5": "ADHD",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass7");
  });

  it("fails closed on empty critiques", async () => {
    const result = await runFixture("EMPTY_CRITIQUES", {
      "Q1.1": "I stall",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass4");
  });

  it("fails image-insufficient when rich associations exist", async () => {
    const result = await runFixture("IMAGE_INSUFFICIENT_RICH", {
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
    const result = await runFixture("WRONG_EXPERIMENT", {
      "Q1.1": "I stall without structure",
      "Q0.5": "ADHD",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass8");
  });

  it("fails senex-scold-only reports", async () => {
    const result = await runFixture("SENEX_SCOLD_ONLY", {
      "Q1.1": "I stall",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
  });

  it("fails image-starved-peel when Q10 is only experiment garnish", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
      "Q1.1": `${String(originAnswers["Q1.1"] ?? "")} IMAGE_STARVED_PEEL`,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
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
      "Q1.1": `${String(originAnswers["Q1.1"] ?? "")} PROJECTION_STARVED_PEEL`,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
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
      "Q1.1": `${String(originAnswers["Q1.1"] ?? "")} MONEY_STARVED_PEEL`,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
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
      "Q1.1": `${String(originAnswers["Q1.1"] ?? "")} CLINICAL_VOICE_PEEL`,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/client|second person|titles|analyst|clinical|essay/i);
  });

  it("sanitizes Q11.3-as-hidden and completes", async () => {
    const result = await runFixture("Q113_AS_HIDDEN", {
      "Q1.1": "I stall",
      "Q11.3": "I hope it shows me some sharp angles that I can't unsee",
    });
    expect(result.status).toBe("completed");
    expect(result.caseState.hiddenPosition).toBeUndefined();
    expect(result.caseState.gateRemediations?.some((item) => /Q11\.3/i.test(item))).toBe(true);
  });

  it("origin-gold passes rubric and framework fidelity", async () => {
    const answers: Record<string, unknown> = {
      ...originAnswers,
      "Q1.1": `${String(originAnswers["Q1.1"] ?? "")} ORIGIN_GOLD`,
    };
    const result = await executeAnalysis({
      assessmentId: "origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
      fixture: "origin-gold",
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("completed");
    expect(result.report).toBeDefined();
    const rubric = evaluateReport({
      report: result.report!,
      caseState: result.caseState,
      requestedInsight: String(answers["Q11.3"] ?? ""),
    });
    expect(rubric.passed).toBe(true);
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
