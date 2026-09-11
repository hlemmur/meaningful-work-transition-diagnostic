import { describe, expect, it } from "vitest";
import { validateAdaptivePlan } from "../questionnaire/adaptive";
import { caseStateSchema } from "./schemas/case-state";
import { ENGINE_VERSION, promptRegistry } from "./prompts";

describe("engine.v2 contracts", () => {
  it("parses a fixture CaseState", () => {
    const parsed = caseStateSchema.parse({
      assessmentId: "assess-1",
      questionnaireVersion: "questionnaire.v2",
      engineVersion: ENGINE_VERSION,
      practicalContext: {
        pressureSources: [],
        constraints: [],
      },
      consciousNarrative: {
        statedProblem: [],
        desiredFuture: [],
        statedCausesFreeText: [],
        consciousExplanationTags: [],
        readinessConditions: [],
        nextActionIfObstaclesVanished: [],
      },
      behavior: {
        firstKnowing: [],
        actionsTaken: [],
        avoidedActions: [],
        focalStimulusKind: "generic_next_step",
        whatChanged: [],
        whatDidNotChange: [],
      },
      affect: {
        innerResponse: [],
        bodyResponses: [],
        emotions: [],
        firstThought: [],
        fearedOutcomes: [],
        identityMeanings: [],
        impulseAfterFearedOutcome: [],
      },
      gaze: {
        imaginedWatchers: [],
        imaginedJudgments: [],
        additionalJudges: [],
      },
      history: {
        earlierOccurrences: [],
        identityConclusionRecurrence: [],
        evidenceAbsorption: [],
        bestFunctioningPeriods: [],
        supportiveStructures: [],
        missingStructures: [],
        expectedInternalProvision: [],
        functionWithoutAudience: [],
        functionWithAccountability: [],
        legitimacyLoop: [],
      },
      projections: {
        admiredFigures: [],
        rejectedFigures: [],
      },
      futureFantasy: {
        desiredTuesday: [],
        aliveness: [],
        moneyActivities: [],
        mundaneReality: [],
        identityWithoutWork: [],
        workWithoutIdentity: [],
        continueDespiteDifficulty: [],
        wrongVsDifficult: [],
        jobShapeChange: [],
      },
      money: {
        beliefs: [],
        easyMoneyHistory: [],
        hardMoneyHistory: [],
        economicStructures: [],
        invisibleMachinery: [],
        effortFairness: [],
        refusedWellPaidWork: [],
        continuePoorlyPaidWork: [],
        backgroundIncome: [],
      },
      hiddenBargain: {
        costsOfStaying: [],
        benefitsOfStaying: [],
        protectAndThreaten: [],
        giveUpIfReal: [],
        responsibilityOfSuccess: [],
        knowledgeForcedByFailure: [],
        developmentalAsk: [],
      },
      symbolicMaterial: {},
      userFinalReflection: {
        requestedInsight: "See the contradiction I cannot name",
      },
      openForks: ["history_vs_stated_cause"],
      contradictions: [],
      hypotheses: [],
      jungianLenses: [],
      experiments: [],
      unresolvedQuestions: [],
      safetyFlags: [],
    });

    expect(parsed.engineVersion).toBe("engine.v2");
    expect(parsed.userFinalReflection.requestedInsight).toBe(
      "See the contradiction I cannot name",
    );
  });

  it("registers versioned stubs for checkpoints A–D and Passes 1–10", () => {
    expect(Object.keys(promptRegistry)).toEqual([
      "checkpointA",
      "checkpointB",
      "checkpointC",
      "checkpointD",
      "checkpointSafety",
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

    for (const prompt of Object.values(promptRegistry)) {
      expect(prompt.version).toMatch(/\.v\d+$/);
      expect(prompt.text.length).toBeGreaterThan(20);
    }
  });

  it("keeps adaptive generation inside documented limits", () => {
    expect(
      validateAdaptivePlan([
        { checkpoint: "A", forkId: "history_vs_stated_cause" },
        { checkpoint: "B", forkId: "container_loss_vs_capacity" },
      ]),
    ).toEqual({ ok: true });
  });
});
