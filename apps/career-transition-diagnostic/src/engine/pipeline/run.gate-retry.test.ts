import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { hypothesisSchema } from "@/engine/schemas/analysis";
import type { LlmAdapter, StructuredLlmRequest } from "@/server/adapters/types";
import { ANALYSIS_STAGES } from "./models";
import { executeAnalysis } from "./run";
import { buildCaseSnapshot } from "./stage-input";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "../test-support/fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

function hypothesis(id: string, category: "psychological" | "practical" = "psychological") {
  return hypothesisSchema.parse({
    id,
    title: id,
    category,
    observedPattern: `${id} pattern`,
    evidenceFor: ["a1:Q1.1"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: ["history_vs_stated_cause"],
    scoring: {
      evidenceCoverage: 0.6,
      crossContextRecurrence: 0.5,
      contradictionResolution: 0.5,
      personSpecificity: 0.5,
      developmentalFit: 0.4,
      imageConstraintFit: 0.4,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "tentative",
  });
}

function pass5Output(text: string, evidenceRef: string) {
  return {
    votes: [{
      hypothesisId: "hyp-depth",
      verdict: "supports",
      interpretation: "The supplied image is compatible with the stall.",
      evidenceRefs: [evidenceRef],
      exactClientMaterialUsed: [evidenceRef],
    }],
    imageAnalysis: {
      literalFacts: [],
      personalAssociations: [{ text, evidenceRefs: [evidenceRef] }],
      plausibleReadings: [],
    },
    projectionInterpretations: [],
    overallNote: "Provenance check.",
  };
}

function pass8Output(action: string) {
  return {
    realityCheck: {
      sufficientWithoutDepth: false,
      categories: ["constraints"],
      narrative: "A practical rival remains.",
      evidenceRefs: ["a1:Q0.5"],
    },
    experiments: [{
      kind: "behavioral",
      title: "Your experiment",
      strategy: "direct",
      targetPattern: "initiation stall",
      hypothesisTested: "hyp-depth",
      practicalCondition: {
        factor: "external deadline",
        currentState: "no container",
        temporaryChange: "external deadline",
        whyThisFactor: "Missing structure is in evidence.",
        processDimensions: ["external_structure"],
        sharedDimensions: [],
      },
      action,
      duration: "14 days",
      observe: {
        whatBecomesEasier: "Starting planned attempts",
        whatRemainsDifficult: "Visibility charge",
        whatChangesForm: "Whether stall moves",
        unexpectedMaterial: "Any affect that appears",
      },
      learningAim:
        "When the external deadline changed, completed attempts became easier, while visibility charge remained.",
      layerUpdates: [
        {
          layer: "practical",
          ifObserved: "attempts complete",
          effect: "strengthens",
          implication: "Container is an important contributor.",
        },
        {
          layer: "psychological",
          ifObserved: "charge remains",
          effect: "unchanged",
          implication: "Psychological material is not retired.",
        },
        {
          layer: "practical",
          ifObserved: "no change",
          effect: "inconclusive",
          implication: "This change did not clarify the layers.",
        },
      ],
      whatToObserve: ["completed attempts out of four"],
      resultSupportingHypothesis: "Output rises when the deadline is added.",
      resultWeakeningHypothesis: "Output stays low.",
      riskLevel: "low",
      practicalRequirements: ["calendar"],
      competingHypothesisIds: [],
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [],
      sessionMinutes: 25,
      audienceCount: 0,
      exposure: "private",
      reversible: true,
    }],
  };
}

function llm(handler: (request: StructuredLlmRequest) => Record<string, unknown>): LlmAdapter {
  return {
    async completeStructured(request) {
      return {
        stage: request.stage,
        fixture: "gate-retry",
        output: handler(request),
        model: request.model,
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
      };
    },
  };
}

describe("deterministic gate retry", () => {
  it("retries Pass 5 once and accepts an exact snapshot copy", async () => {
    const previous = extractCaseStateFull("a1", originAnswers);
    previous.hypotheses = [hypothesis("hyp-depth"), hypothesis("hyp-practical", "practical")];
    const speech = String(
      buildCaseSnapshot({ caseState: previous, answers: originAnswers }).signals.symbolicMaterial
        .obstacleSpeech,
    );
    const calls: StructuredLlmRequest[] = [];
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: originAnswers,
      previousCaseState: previous,
      completedStages: ANALYSIS_STAGES.filter((stage) => stage !== "pass5"),
      llm: llm((request) => {
        calls.push(request);
        if (calls.length === 1) {
          return pass5Output(String(originAnswers["Q10.3"]), "a1:Q10.3");
        }
        return pass5Output(speech, "a1:Q10.6");
      }),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status).toBe("completed");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.input.gateIssues).toEqual([
      expect.stringMatching(/not exact supplied client material/i),
      expect.stringMatching(/only exact copies of obstacleSpeech/i),
      expect.stringContaining(speech),
    ]);
    expect(result.caseState.imageAnalysis?.personalAssociations[0]?.text).toBe(speech);
  });

  it("still fails a Pass 8 experiment that changes structure and exposure together", async () => {
    const previous = extractCaseStateFull("a1", originAnswers);
    previous.hypotheses = [hypothesis("hyp-depth"), hypothesis("hyp-practical", "practical")];
    const calls: StructuredLlmRequest[] = [];
    const movingBoth =
      "Set a 25-minute timer and send the draft to one trusted person in the same session.";
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: originAnswers,
      previousCaseState: previous,
      completedStages: ANALYSIS_STAGES.filter((stage) => stage !== "pass8"),
      llm: llm((request) => {
        calls.push(request);
        return pass8Output(movingBoth);
      }),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass8");
    expect(result.error).toMatch(/structure and exposure|unclean two-variable|practicalCondition/i);
    expect(calls).toHaveLength(2);
    expect((calls[1]?.input.gateIssues as string[])[0]).toMatch(
      /structure and exposure|unclean two-variable|practicalCondition/i,
    );
  });

  it("retries Pass 6 once when layered mode omits developmentalFormulation", async () => {
    const previous = extractCaseStateFull("a1", originAnswers);
    previous.hypotheses = [hypothesis("hyp-depth"), hypothesis("hyp-practical", "practical")];
    previous.openForks = ["history_vs_stated_cause"];
    const calls: StructuredLlmRequest[] = [];
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: originAnswers,
      previousCaseState: previous,
      completedStages: ANALYSIS_STAGES.filter((stage) => stage !== "pass6"),
      llm: llm((request) => {
        calls.push(request);
        return pass6LayeredOutput(calls.length > 1);
      }),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status, result.error).toBe("completed");
    expect(calls).toHaveLength(2);
    expect((calls[1]?.input.gateIssues as string[] | undefined)?.[0]).toMatch(/omitted developmentalFormulation/i);
    expect(result.caseState.finalFormulation?.developmentalFormulation?.consciousPole).toBe("freedom");
  });

  it("fails Pass 6 when the retry still omits a declared developmental formulation", async () => {
    const previous = extractCaseStateFull("a1", originAnswers);
    previous.hypotheses = [hypothesis("hyp-depth"), hypothesis("hyp-practical", "practical")];
    previous.openForks = ["history_vs_stated_cause"];
    const calls: StructuredLlmRequest[] = [];
    const result = await executeAnalysis({
      assessmentId: "a1",
      answers: originAnswers,
      previousCaseState: previous,
      completedStages: ANALYSIS_STAGES.filter((stage) => stage !== "pass6"),
      llm: llm((request) => {
        calls.push(request);
        return pass6LayeredOutput(false);
      }),
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass6");
    expect(result.error).toMatch(/omitted developmentalFormulation/i);
    expect(calls).toHaveLength(2);
  });
});

function pass6LayeredOutput(includeFormulation: boolean) {
  return {
    selectedHypothesisId: "hyp-depth",
    forkResolutions: [{
      forkId: "history_vs_stated_cause",
      status: "leans_a",
      interpretation: "The supplied history still outruns the stated cause.",
      evidenceRefs: ["a1:Q2.1"],
      importance: "high",
      reportWorthiness: true,
    }],
    finalFormulation: {
      selectedHypothesisId: "hyp-depth",
      maintenanceFormulation: "Visibility still freezes a finished private draft.",
      maintenanceMechanism: {
        trigger: "A visible send is about to happen.",
        response: "The action freezes.",
        shortTermFunction: "Avoids exposure.",
        longTermCost: "No new evidence accumulates.",
        reinforcingConsequence: "The freeze confirms the danger.",
      },
      ...(includeFormulation
        ? {
            developmentalFormulation: {
              consciousPole: "freedom",
              compensatingPole: "structure",
              coreOpposition: "freedom and structure",
              possibleDevelopmentalTask:
                "discovering a form in which both poles can coexist without either having to defeat the other",
              uncertainty: "Practical pressure remains true.",
              evidenceRefs: ["a1:Q2.2", "a1:Q4.8"],
            },
          }
        : {}),
      layerRelationship: {
        mode: "layered",
        practicalHypothesisIds: ["hyp-practical"],
        psychologicalHypothesisIds: ["hyp-depth"],
        relationship: "External structure helps, and visibility stays charged.",
        uncertainty: "The developmental wording was the missing piece.",
        evidenceRefs: ["a1:Q2.2", "a1:Q3.3"],
      },
      whyItFits: ["Visibility changes the outcome."],
      whatItDoesNotExplain: ["Money pressure remains real."],
      strongestAlternative: "Constraints may still be sufficient.",
      unresolvedForks: [],
    },
    hiddenPosition: {
      consciousPosition: "I need a better system.",
      observedPattern: "Visibility freezes finished work.",
      possibleHiddenPosition: "Being seen may threaten a protected freedom.",
      protectiveFunction: ["Keeps the work private"],
      possibleCompensatoryAim: "Structure in service of aliveness",
      threatenedByChange: ["Being seen"],
      developmentalTension: { poleA: "freedom", poleB: "structure" },
      imageVoteSummary: "unresolved",
      evidenceRefs: ["a1:Q2.2"],
      counterEvidenceRefs: [],
      confidence: "tentative",
    },
    alternative: "Constraints may still be sufficient.",
  };
}
