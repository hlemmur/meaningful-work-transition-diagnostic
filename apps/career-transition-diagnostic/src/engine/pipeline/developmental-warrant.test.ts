import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { finalFormulationSchema } from "@/engine/schemas/analysis";
import {
  depthIndependentlySupported,
  evaluateDevelopmentalWarrant,
  realityCheckAgreement,
  suppliedThirdCorpus,
} from "./developmental-warrant";

function evidence(
  questionId: string,
  meaning: string,
  evidenceType: "fact" | "self_interpretation" | "emotion" | "behavior" | "history" | "practical_constraint",
) {
  return {
    id: `case:${questionId}`,
    assessmentId: "case",
    questionId,
    normalizedMeaning: meaning,
    evidenceType,
  };
}

function supportedState() {
  const state = emptyCaseState("case");
  state.practicalContext.constraints = [
    evidence("Q0.5", "Hiring demand and ADHD constraints are real.", "practical_constraint"),
  ];
  state.behavior.actionsTaken = [
    evidence("Q2.2", "A private draft was finished, then visibility froze the send.", "behavior"),
  ];
  state.affect.emotions = [evidence("Q3.3", "fear", "emotion")];
  state.history.earlierOccurrences = [
    evidence("Q4.8", "External structure has carried continuity.", "history"),
  ];
  state.symbolicMaterial = { scene: "a private draft beside a dark gate" };
  state.hypotheses = [{
    id: "hyp-depth",
    title: "Visibility charge",
    category: "psychological",
    observedPattern: "Private work moves; visible work freezes.",
    evidenceFor: ["case:Q2.2"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: ["history_vs_stated_cause"],
    scoring: {
      evidenceCoverage: 0.7,
      crossContextRecurrence: 0.6,
      contradictionResolution: 0.6,
      personSpecificity: 0.6,
      developmentalFit: 0.5,
      imageConstraintFit: 0.4,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "tentative",
  }, {
    id: "hyp-practical",
    title: "Labor market",
    category: "practical",
    observedPattern: "Hiring conditions explain the pause.",
    evidenceFor: ["case:Q0.5"],
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
      developmentalFit: 0.2,
      imageConstraintFit: 0.2,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "tentative",
  }];
  state.finalFormulation = {
    selectedHypothesisId: "hyp-practical",
    maintenanceFormulation: "Practical constraints still explain the stall.",
    maintenanceMechanism: {
      trigger: "A visible send is about to happen.",
      response: "The action freezes.",
      shortTermFunction: "Avoids exposure.",
      longTermCost: "No new evidence.",
      reinforcingConsequence: "The freeze confirms the danger.",
    },
    whyItFits: ["Visibility changes the outcome."],
    whatItDoesNotExplain: ["Money pressure remains real."],
    strongestAlternative: "A psychological pattern may also be live.",
    unresolvedForks: [],
  };
  state.hiddenPosition = {
    consciousPosition: "I need a better system.",
    observedPattern: "Visibility freezes finished work.",
    possibleHiddenPosition: "Being seen may threaten a protected freedom.",
    protectiveFunction: ["Keeps the work private"],
    possibleCompensatoryAim: "Structure in service of aliveness",
    threatenedByChange: ["Being seen"],
    developmentalTension: { poleA: "freedom", poleB: "structure" },
    imageVoteSummary: "unresolved",
    evidenceRefs: ["case:Q2.2"],
    counterEvidenceRefs: [],
    confidence: "tentative",
  };
  return state;
}

describe("developmental warrant helper", () => {
  it("treats a practical selection with independent depth as supported", () => {
    const state = supportedState();
    expect(depthIndependentlySupported(state)).toBe(true);
    expect(evaluateDevelopmentalWarrant(state).mode).toBe("unresolved");
  });

  it("does not treat two self-theory sections as independent depth", () => {
    const state = emptyCaseState("discipline");
    state.consciousNarrative.statedCausesFreeText = [
      evidence("Q1.1", "I need discipline.", "self_interpretation"),
      evidence("Q7.1", "I need discipline in another area.", "self_interpretation"),
    ];
    state.hypotheses = [{
      ...supportedState().hypotheses[0],
      category: "psychological",
    }];
    expect(depthIndependentlySupported(state)).toBe(false);
    expect(evaluateDevelopmentalWarrant(state).eligible).toBe(false);
  });

  it("does not treat a symbol alone as a developmental warrant", () => {
    const state = emptyCaseState("symbol");
    state.symbolicMaterial = { scene: "a dark pipe" };
    state.hypotheses = [supportedState().hypotheses[0]];
    expect(depthIndependentlySupported(state)).toBe(false);
    expect(evaluateDevelopmentalWarrant(state).mode).toBe("not_warranted");
  });

  it("lets sufficientWithoutDepth agree with practical_primary without erasing supported depth", () => {
    const state = supportedState();
    state.realityCheck = {
      sufficientWithoutDepth: true,
      categories: ["labor market"],
      narrative: "Hiring conditions explain most of the pause.",
      evidenceRefs: ["case:Q0.5"],
    };
    state.finalFormulation = {
      ...state.finalFormulation!,
      layerRelationship: {
        mode: "practical_primary",
        practicalHypothesisIds: ["hyp-practical"],
        psychologicalHypothesisIds: ["hyp-depth"],
        relationship: "Practical conditions carry the pause, and a charged pattern also remains.",
        uncertainty: "The depth pattern is not settled.",
        evidenceRefs: ["case:Q0.5", "case:Q3.3"],
      },
    };
    expect(evaluateDevelopmentalWarrant(state).mode).toBe("not_warranted");
    expect(realityCheckAgreement(state)).toEqual({
      action: "note",
      detail: "sufficientWithoutDepth does not erase independently supported depth.",
    });
  });

  it("fails when practical_primary disagrees with an unwarranted reality check", () => {
    const state = emptyCaseState("plain");
    state.hypotheses = [supportedState().hypotheses[1]];
    state.finalFormulation = {
      ...supportedState().finalFormulation!,
      selectedHypothesisId: "hyp-practical",
      layerRelationship: {
        mode: "practical_primary",
        practicalHypothesisIds: ["hyp-practical"],
        psychologicalHypothesisIds: [],
        relationship: "The practical account is enough.",
        uncertainty: "No depth pattern is established.",
        evidenceRefs: ["case:Q0.5"],
      },
    };
    state.realityCheck = {
      sufficientWithoutDepth: false,
      categories: ["constraints"],
      narrative: "A rival remains.",
      evidenceRefs: ["case:Q0.5"],
    };
    expect(realityCheckAgreement(state).action).toBe("fail");
  });

  it("builds the third corpus from taken quotes and avoided actions", () => {
    const state = emptyCaseState("case");
    state.behavior.actionsTaken = [
      evidence("Q2.2", "finished a private draft", "behavior"),
    ];
    state.behavior.actionsTaken[0]!.rawQuote = "I finished the draft.";
    state.behavior.avoidedActions = [{ action: "skipped the public send" }];
    const corpus = suppliedThirdCorpus(state);
    expect(corpus).toContain("I finished the draft.");
    expect(corpus).toContain("finished a private draft");
    expect(corpus).toContain("skipped the public send");
    expect(corpus).not.toContain("undefined");
  });

  it("loads a legacy formulation that has no layer relationship", () => {
    const parsed = finalFormulationSchema.parse({
      selectedHypothesisId: "h1",
      centralFormulation: "Delay recurs when a choice appears.",
      whyItFits: ["It recurs."],
      whatItDoesNotExplain: ["The market."],
      strongestAlternative: "Job shape.",
      unresolvedForks: [],
    });
    expect(parsed.layerRelationship).toBeUndefined();
    expect(parsed.maintenanceFormulation).toMatch(/Delay recurs/);
  });
});
