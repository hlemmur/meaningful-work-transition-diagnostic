import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { executeAnalysis } from "./run";
import { buildStageLlmInput } from "./stage-input";
import type { CaseState } from "../schemas/case-state";
import type { LlmAdapter } from "@/server/adapters/types";

function seededCase(assessmentId = "a1"): CaseState {
  const state = emptyCaseState(assessmentId);
  state.consciousNarrative.statedProblem = [
    {
      id: `${assessmentId}:Q1.1`,
      assessmentId,
      questionId: "Q1.1",
      rawQuote: "I quit IT and freeze on marketing my coaching.",
      normalizedMeaning: "I quit IT and freeze on marketing my coaching.",
      evidenceType: "self_interpretation",
    },
  ];
  state.practicalContext.constraints = [
    {
      id: `${assessmentId}:Q0.5`,
      assessmentId,
      questionId: "Q0.5",
      rawQuote: "I have ADHD",
      normalizedMeaning: "I have ADHD",
      evidenceType: "practical_constraint",
    },
  ];
  state.contradictions = [
    {
      id: "c1",
      statementA: "I want freedom through coaching",
      statementB: "I keep the offer secret",
      evidenceA: [`${assessmentId}:Q1.1`],
      evidenceB: [`${assessmentId}:Q1.1`],
      significance: "central",
      categories: ["identity"],
      originForks: ["work_vs_identity_vs_job_shape"],
      scores: {
        evidenceStrength: 0.8,
        recurrence: 0.7,
        explanatoryImportance: 0.9,
        charge: 0.8,
      },
    },
  ];
  state.hypotheses = [
    {
      id: "h1",
      title: "Structure as aliveness proxy",
      category: "developmental",
      observedPattern: "Avoids exposure that would make the new role real",
      evidenceFor: [`${assessmentId}:Q1.1`],
      evidenceAgainst: [],
      contradictionsExplained: ["c1"],
      contradictionsNotExplained: [],
      simplerAlternatives: ["skill gap only"],
      missingInformation: [],
      originForks: ["work_vs_identity_vs_job_shape"],
      scoring: {
        evidenceCoverage: 0.7,
        crossContextRecurrence: 0.6,
        contradictionResolution: 0.7,
        personSpecificity: 0.8,
        developmentalFit: 0.7,
        imageConstraintFit: 0.5,
        counterEvidencePenalty: 0.1,
        simplerAlternativePenalty: 0.2,
      },
      confidence: "moderate",
    },
  ];
  state.userFinalReflection.requestedInsight = "sharp angles I cannot unsee";
  return state;
}

describe("buildStageLlmInput", () => {
  it("keeps early passes lean without a case snapshot", () => {
    const input = buildStageLlmInput({
      stage: "pass3",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: seededCase(),
      answers: { "Q1.1": "long answer" },
      fixture: "happy",
    });
    expect(input.caseSnapshot).toBeUndefined();
    expect(input.requestedInsight).toBe("sharp angles I cannot unsee");
    expect(input.evidenceRef).toBe("a1:Q1.1");
  });

  it("adds a bounded case snapshot for pass9 and pass10", () => {
    const answers = {
      "Q0.5": "I have ADHD",
      "Q1.1": "I quit IT and freeze on marketing my coaching.",
      "Q11.3": "sharp angles I cannot unsee",
    };
    const forPass9 = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q0.5",
      caseState: seededCase(),
      answers,
      fixture: "happy",
    });
    const snapshot = forPass9.caseSnapshot as Record<string, unknown>;
    expect(snapshot).toEqual(
      expect.objectContaining({
        evidenceAllowlist: expect.arrayContaining(["a1:Q1.1", "a1:Q0.5"]),
        contradictions: [
          expect.objectContaining({
            id: "c1",
            statementA: "I want freedom through coaching",
          }),
        ],
        hypotheses: [
          expect.objectContaining({
            id: "h1",
            title: "Structure as aliveness proxy",
            observedPattern: "Avoids exposure that would make the new role real",
          }),
        ],
      }),
    );
    expect(snapshot.answersByQuestionId).toEqual(
      expect.objectContaining({
        "Q1.1": "I quit IT and freeze on marketing my coaching.",
        "Q0.5": "I have ADHD",
      }),
    );
    expect(snapshot.requestedInsightNote).toMatch(/not the report spine/i);

    const forPass10 = buildStageLlmInput({
      stage: "pass10",
      assessmentId: "a1",
      evidenceRef: "a1:Q0.5",
      caseState: seededCase(),
      answers,
    });
    expect(forPass10.caseSnapshot).toBeTruthy();
  });

  it("trims long answer strings so the snapshot stays bounded", () => {
    const long = "x".repeat(2000);
    const input = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: seededCase(),
      answers: { "Q1.1": long, "Q2.1": long, "Q3.1": long },
    });
    const answers = (input.caseSnapshot as { answersByQuestionId: Record<string, string> })
      .answersByQuestionId;
    expect(answers["Q1.1"]!.length).toBeLessThanOrEqual(420);
    expect(Object.keys(answers).length).toBeLessThanOrEqual(40);
  });

  it("wires pass9 executeAnalysis input with a case snapshot for the live adapter", async () => {
    const captured: Array<{ stage: string; input: Record<string, unknown> }> = [];
    const llm: LlmAdapter = {
      async completeStructured(request) {
        captured.push({ stage: request.stage, input: request.input });
        if (request.stage === "pass9") {
          return {
            stage: request.stage,
            fixture: "happy",
            output: {
              sections: ["problem", "reality", "contradiction", "alternative", "experiment"].map(
                (id) => ({
                  id,
                  title: id,
                  body: "Evidence-backed paragraph about the stall and constraints.",
                  evidenceRefs: ["a1:Q1.1"],
                }),
              ),
            },
            model: request.model ?? "mock-strong",
            usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
          };
        }
        return {
          stage: request.stage,
          fixture: "happy",
          output: { failingSectionIds: [], regeneratedSections: [] },
          model: request.model ?? "mock-cheap",
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
        };
      },
    };

    await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase("a1"),
      completedStages: ["pass1", "pass2", "pass3", "pass4", "pass5", "pass6", "pass7", "pass8"],
      llm,
      persistRun() {},
      persistCaseState() {},
    });

    const pass9 = captured.find((item) => item.stage === "pass9");
    expect(pass9?.input).toEqual(
      expect.objectContaining({
        caseSnapshot: expect.objectContaining({
          evidenceAllowlist: expect.arrayContaining(["a1:Q1.1"]),
          answersByQuestionId: expect.objectContaining({
            "Q1.1": "I quit IT and freeze on marketing.",
          }),
        }),
      }),
    );
  });
});
