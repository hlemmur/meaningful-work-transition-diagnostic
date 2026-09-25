import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import type { LlmAdapter } from "@/server/adapters/types";
import type { CaseState } from "../schemas/case-state";
import type { Report } from "../schemas/analysis";
import {
  executeAnalysis,
  runAnalysisPasses,
  type AnalysisRunRecord,
  type AnalysisStore,
} from "./run";

const GOOD_PROBLEM =
  "You stall when marketing your coaching offer — an identity bind after leaving IT.";
const REJECTED_PROBLEM = `${GOOD_PROBLEM} You are an eternal youth.`;
const ACCEPTED_PROBLEM =
  "You stall when marketing your coaching offer — an identity bind after leaving IT, and you keep the next step small.";

function peelSections(assessmentId = "a1") {
  const q = (id: string) => `${assessmentId}:${id}`;
  return [
    {
      id: "problem" as const,
      title: "The problem as you see it",
      body: GOOD_PROBLEM,
      evidenceRefs: [q("Q1.1")],
    },
    {
      id: "reality" as const,
      title: "What reality says",
      body: "Your ADHD constraints and missing structure are part of the picture.",
      evidenceRefs: [q("Q0.4"), q("Q0.5")],
    },
    {
      id: "contradiction" as const,
      title: "The contradiction at the center",
      body: "You want freedom and still keep the offer secret.",
      evidenceRefs: [q("Q1.1"), q("Q1.3")],
    },
    {
      id: "alternative" as const,
      title: "Another plausible interpretation",
      body: "Your stall may be a practical skill gap, not a hidden stance.",
      evidenceRefs: [q("Q0.5")],
    },
    {
      id: "experiment" as const,
      title: "Your experiment",
      body: "For two weeks, run your outreach under external deadlines and watch charge.",
      evidenceRefs: [q("Q1.1")],
    },
    {
      id: "questions" as const,
      title: "Three questions to stay with",
      body:
        "What would make you question this explanation? What changes when you test structure directly? What still feels unexplained to you?",
      evidenceRefs: [q("Q1.1"), q("Q1.3")],
      questionIntents: [
        { question: "What would make you question this explanation?", targetUncertainty: "Whether the explanation fits", relatedHypothesisId: "h1", couldWeakenSelectedFormulation: true },
        { question: "What changes when you test structure directly?", targetUncertainty: "Whether structure changes action", relatedHypothesisId: "h1", couldWeakenSelectedFormulation: false },
        { question: "What still feels unexplained to you?", targetUncertainty: "The unexplained remainder", couldWeakenSelectedFormulation: false },
      ],
    },
    {
      id: "close" as const,
      title: "A working formulation",
      body: "You can treat this as a working formulation rather than a verdict.",
      evidenceRefs: [q("Q1.1")],
    },
  ];
}

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
        crossDomainReach: 0.8,
        noveltyOfConnection: 0.7,
        consciousAwarenessPenalty: 0.2,
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

function criticThatRegenerates(body: string, draftProblemBody = GOOD_PROBLEM): LlmAdapter {
  return {
    async completeStructured(request) {
      if (request.stage === "pass9") {
        return {
          stage: request.stage,
          fixture: "happy",
          output: {
            sections: peelSections("a1").map((section) =>
              section.id === "problem" ? { ...section, body: draftProblemBody } : section,
            ),
          },
          model: request.model ?? "mock-strong",
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
        };
      }
      if (request.stage === "pass10") {
        const problem = peelSections("a1")[0]!;
        return {
          stage: request.stage,
          fixture: "happy",
          output: {
            failingSectionIds: ["problem"],
            regeneratedSections: [{ ...problem, body }],
          },
          model: request.model ?? "mock-cheap",
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
}

function memoryStore(existingReport?: Report): AnalysisStore & { savedReport?: Report } {
  const runs: AnalysisRunRecord[] = [];
  const snapshots = new Map<string, CaseState>();
  const store: AnalysisStore & { savedReport?: Report } = {
    getCaseState(id) {
      return snapshots.get(id);
    },
    saveCaseState(id, _stage, snapshot) {
      snapshots.set(id, snapshot);
    },
    listRuns() {
      return runs;
    },
    saveRun(run) {
      runs.push(run);
    },
    saveReport(report) {
      store.savedReport = report;
    },
    getReport() {
      return existingReport ?? store.savedReport;
    },
  };
  return store;
}

const completedThroughPass8 = [
  "pass1",
  "pass2",
  "pass3",
  "pass4",
  "pass5",
  "pass6",
  "pass7",
  "pass8",
] as const;

describe("pass10 critic merge", () => {
  it("regenerates only the section containing an unsupported certain predicate", async () => {
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase(),
      completedStages: completedThroughPass8,
      llm: criticThatRegenerates(
        "You may be avoiding commitment to the new identity because success could expose you.",
        "You unconsciously avoid commitment to the new identity because success would expose you.",
      ),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({ status: "completed" });
    expect(result.report?.sections.find((section) => section.id === "problem")?.body).toMatch(/may be avoiding/);
    expect(result.report?.sections.find((section) => section.id === "reality")?.body).toBe(peelSections("a1")[1]?.body);
  });

  it("rejects a regenerated section that violates hard gates and keeps the pass9 draft", async () => {
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase("a1"),
      completedStages: completedThroughPass8,
      llm: criticThatRegenerates(REJECTED_PROBLEM),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status).toBe("completed");
    expect(result.failedStage).toBeUndefined();
    expect(result.report?.sections.find((section) => section.id === "problem")?.body).toBe(
      GOOD_PROBLEM,
    );
    expect(result.report?.sections.map((section) => section.body).join("\n")).not.toMatch(
      /eternal youth/i,
    );
  });

  it("accepts a regenerated section that stays inside the hard-gate contract", async () => {
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase("a1"),
      completedStages: completedThroughPass8,
      llm: criticThatRegenerates(ACCEPTED_PROBLEM),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status).toBe("completed");
    expect(result.report?.sections.find((section) => section.id === "problem")?.body).toBe(
      ACCEPTED_PROBLEM,
    );
  });

  it("does not persist a gate-failed merge over the last good draft", async () => {
    const store = memoryStore();
    const result = await runAnalysisPasses({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      llm: criticThatRegenerates(REJECTED_PROBLEM),
      store: {
        ...store,
        getCaseState() {
          return seededCase("a1");
        },
        listRuns() {
          return completedThroughPass8.map((stage) => ({
            assessmentId: "a1",
            stage,
            attempt: 1,
            promptVersion: `${stage}.v1`,
            model: "mock",
            status: "success" as const,
            idempotencyKey: `a1:${stage}:success`,
          }));
        },
      },
    });

    expect(result.status).toBe("completed");
    expect(result.failedStage).toBeUndefined();
    expect(store.savedReport?.sections.find((section) => section.id === "problem")?.body).toBe(
      GOOD_PROBLEM,
    );
    expect(store.savedReport?.sections.map((section) => section.body).join("\n")).not.toMatch(
      /eternal youth/i,
    );
  });
});
