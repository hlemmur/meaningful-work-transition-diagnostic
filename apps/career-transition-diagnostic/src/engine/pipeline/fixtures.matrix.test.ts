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
    expect(inferAnalysisFixture({ "Q1.1": "AIM_MISSING_PEEL" })).toBe("aim-missing-peel");
    expect(inferAnalysisFixture({ "Q1.1": "SPEECH_WITHOUT_IMAGINAL" })).toBe("speech-without-imaginal");
    expect(inferAnalysisFixture({ "Q1.1": "BECOMING_INFLATION_PEEL" })).toBe("becoming-inflation-peel");
    expect(inferAnalysisFixture({ "Q1.1": "NON_ORIGIN_SOFT_MINI" })).toBe("non-origin-soft-mini");
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
    const peel = result.report!.sections.map((section) => section.body).join("\n");
    expect(peel).toMatch(/protect|keeps|bargain/i);
    expect(peel).toMatch(/aim|aliveness|structure in service/i);
    expect(peel).toMatch(/image|scene|voice|ask/i);
    expect(peel).not.toMatch(/romance of eternal becoming/i);
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

  it("fails aim-missing-peel when CaseState has aim but peel only names protection", async () => {
    const result = await runFixture("AIM_MISSING_PEEL", {
      "Q1.1": "I stall",
      "Q1.3": "I lack confidence",
      "Q2.2": "I rewrote the site",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/aim\/protection|lacks both/i);
  });

  it("fails speech-without-imaginal when obstacleSpeech lacks dialogue or imaginal", async () => {
    const result = await runFixture("SPEECH_WITHOUT_IMAGINAL", {
      "Q1.1": "I stall at exposure",
      "Q1.3": "I lack confidence",
      "Q2.2": "I rewrote the site",
      "Q10.1": "A locked garden gate at dusk",
      "Q10.6": "Turn back until the ground is yours",
      "Q10.7": "Moss holds the latch shut",
      "Q11.3": "sharp angles",
    });
    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass9");
    expect(result.error).toMatch(/imaginal|dialogue|obstacleSpeech/i);
  });

  it("fails becoming-inflation-peel on romance of eternal becoming", async () => {
    const result = await runFixture("BECOMING_INFLATION_PEEL", {
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
      "Q1.1": "I freeze before claiming space NON_ORIGIN_SOFT_MINI",
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
      llm: mockLlmAdapter,
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
