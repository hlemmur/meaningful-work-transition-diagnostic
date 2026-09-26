import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import type { CaseState } from "@/engine/schemas/case-state";
import type { Experiment, ReportSection } from "@/engine/schemas/analysis";
import {
  evaluateEpistemologyQualification,
  hasRivalLexicon,
  hasInverseProofClose,
  hasBinaryPracticalPsychologicalQuestion,
  hasClinicalFindingLanguage,
  hasUnhedgedSymbolPredicate,
  hasUncleanTwoVariableExperiment,
  hasInventedAnalogue,
} from "./epistemology-qualification";

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

function baseSections(overrides: Partial<Record<ReportSection["id"], string>> = {}): ReportSection[] {
  const bodies: Record<string, string> = {
    problem: "You described a stall that shows up when the next step becomes visible.",
    reality: "Alongside the psychological pattern, there is a strong practical layer that may be carrying a substantial share of the difficulty.",
    contradiction: "Private work moves; the charged step freezes. Both layers stay in view.",
    alternative: "What may also be true is the missing container around the work.",
    experiment:
      "Change: use one template for twenty minutes.\nObserve: what becomes easier, what remains, and what arises unexpectedly.\nWhen the structure changed, drafting became easier, while the charge around being seen remained.",
    questions:
      "1. If the changed practical condition made execution substantially easier, what tension around visibility would still remain?\n2. What vitality feels threatened if the practical change works?\n3. What other open candidate already named in the report would still need checking?",
    close:
      "If the practical change helps a lot, that contribution is clearly important; psychological material is not retired. Unknowns remain, and new evidence can update the formulation.",
    jungian:
      "One possible Jungian amplification is that these figures may point toward a threshold tension. Another reading stays open.",
    hidden:
      "The vulnerability of exposing an idealized professional self-image to ordinary judgment may be present when the send approaches.",
    ...overrides,
  };
  return (Object.entries(bodies) as Array<[ReportSection["id"], string]>).map(([id, body]) => ({
    id,
    title: id,
    body,
    evidenceRefs: ["case:Q0.5"],
  }));
}

function teacherLayered(): CaseState {
  const state = emptyCaseState("teacher");
  state.practicalContext.constraints = [
    evidence("Q0.5", "No deadline and isolation around grading.", "practical_constraint"),
  ];
  state.behavior.actionsTaken = [
    evidence("Q2.2", "Graded work sits finished and is not returned.", "behavior"),
  ];
  state.affect.emotions = [evidence("Q3.3", "shame", "emotion")];
  state.hypotheses = [{
    id: "hyp-teacher",
    title: "Isolation and missing deadline",
    category: "psychological",
    observedPattern: "Finished grading is not returned when no container is present.",
    evidenceFor: ["case:Q2.2", "case:Q0.5"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: [],
    scoring: {
      evidenceCoverage: 0.8,
      crossContextRecurrence: 0.5,
      contradictionResolution: 0.5,
      personSpecificity: 0.5,
      developmentalFit: 0.4,
      imageConstraintFit: 0.2,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "moderate",
  }];
  state.finalFormulation = {
    selectedHypothesisId: "hyp-teacher",
    maintenanceFormulation: "Missing container and isolation maintain the stall.",
    maintenanceMechanism: {
      trigger: "Return window approaches.",
      response: "The packet stays unsent.",
      shortTermFunction: "Avoids judgment.",
      longTermCost: "Students wait.",
      reinforcingConsequence: "Avoidance confirms danger.",
    },
    whyItFits: ["Finished work plus no return."],
    whatItDoesNotExplain: ["Market pressure."],
    strongestAlternative: "Only missing deadline structure.",
    unresolvedForks: [],
  };
  state.experiments = [{
    kind: "behavioral",
    title: "Your experiment",
    hypothesisTested: "hyp-teacher",
    action: "Set one twenty-minute return window with a shared checklist and return one packet privately.",
    duration: "20 minutes",
    whatToObserve: ["Whether return becomes easier", "What charge remains"],
    resultSupportingHypothesis: "Return happens.",
    resultWeakeningHypothesis: "Return still freezes.",
    riskLevel: "low",
    practicalRequirements: [],
    competingHypothesisIds: ["hyp-teacher"],
    heldConstant: ["content difficulty"],
    outcomeInterpretations: [],
  }];
  return state;
}

function designerAnalogueEligible(): CaseState {
  const state = teacherLayered();
  state.assessmentId = "designer";
  state.history.earlierOccurrences = [
    evidence("Q4.10", "Same freeze when booking the dentist.", "history"),
  ];
  state.experiments = [{
    ...state.experiments[0],
    action: "Book one lower-stakes appointment using a ten-minute timer, then notice what remains around invoicing.",
  }];
  return state;
}

function managerContrastEligible(): CaseState {
  const state = teacherLayered();
  state.assessmentId = "manager";
  state.history.earlierOccurrences = [
    evidence("Q4.12", "I run a community dinner easily.", "history"),
  ];
  state.experiments = [{
    ...state.experiments[0],
    action: "Delegate one dinner-planning step at work while holding the presentation content constant.",
  }];
  return state;
}

function practicalOnly(): CaseState {
  const state = emptyCaseState("labor");
  state.practicalContext.constraints = [
    evidence("Q0.5", "Hiring demand is weak.", "practical_constraint"),
  ];
  state.hypotheses = [{
    id: "hyp-practical",
    title: "Labor market",
    category: "practical",
    observedPattern: "Hiring conditions explain the pause.",
    evidenceFor: ["labor:Q0.5"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: [],
    scoring: {
      evidenceCoverage: 0.8,
      crossContextRecurrence: 0.4,
      contradictionResolution: 0.4,
      personSpecificity: 0.4,
      developmentalFit: 0.1,
      imageConstraintFit: 0.1,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "moderate",
  }];
  state.finalFormulation = {
    selectedHypothesisId: "hyp-practical",
    maintenanceFormulation: "Weak hiring demand maintains the pause.",
    maintenanceMechanism: {
      trigger: "Applications stall.",
      response: "Waiting.",
      shortTermFunction: "Conserves effort.",
      longTermCost: "No movement.",
      reinforcingConsequence: "Market remains decisive.",
    },
    whyItFits: ["Labor market evidence."],
    whatItDoesNotExplain: [],
    strongestAlternative: "Skill gap remains open.",
    unresolvedForks: [],
  };
  state.realityCheck = {
    sufficientWithoutDepth: true,
    categories: ["labor market"],
    narrative: "Hiring conditions explain the pause.",
    evidenceRefs: ["labor:Q0.5"],
  };
  state.experiments = [{
    kind: "behavioral",
    title: "Your experiment",
    hypothesisTested: "hyp-practical",
    action: "Spend twenty minutes clarifying one role requirement on paper.",
    duration: "20 minutes",
    whatToObserve: ["Whether clarity helps"],
    resultSupportingHypothesis: "Clarity helps.",
    resultWeakeningHypothesis: "Clarity does not help.",
    riskLevel: "low",
    practicalRequirements: [],
    competingHypothesisIds: ["hyp-practical"],
    heldConstant: [],
    outcomeInterpretations: [],
  }];
  return state;
}

describe("epistemology qualification (CAR-127)", () => {
  it("fails rival lexicon in customer prose", () => {
    expect(hasRivalLexicon("a strong mundane rival deserves equal weight")).toBe(true);
    expect(hasRivalLexicon("Alongside the psychological pattern, there is a strong practical layer.")).toBe(false);

    const result = evaluateEpistemologyQualification(teacherLayered(), baseSections({
      alternative: "A strong mundane rival deserves equal weight and may be where the friction lives.",
    }));
    expect(result.scores.find((score) => score.id === "rival_lexicon")?.passed).toBe(false);
    expect(result.hardPassed).toBe(false);
  });

  it("fails inverse-proof close language", () => {
    expect(hasInverseProofClose("If structure works, then the practical hypothesis is primary.")).toBe(true);
    expect(hasInverseProofClose("If the practical change helps a lot, that contribution is clearly important.")).toBe(false);

    const result = evaluateEpistemologyQualification(teacherLayered(), baseSections({
      close: "If structure works, then practical is the real cause.",
    }));
    expect(result.scores.find((score) => score.id === "inverse_proof_close")?.passed).toBe(false);
  });

  it("fails binary practical-vs-psychological questions", () => {
    expect(
      hasBinaryPracticalPsychologicalQuestion(
        "Is your primary difficulty social vulnerability or missing structure?",
      ),
    ).toBe(true);
    expect(
      hasBinaryPracticalPsychologicalQuestion(
        "If the changed practical condition made execution substantially easier, what tension around visibility would still remain?",
      ),
    ).toBe(false);

    const result = evaluateEpistemologyQualification(teacherLayered(), baseSections({
      questions:
        "1. What remains if structure helps?\n2. What vitality is threatened?\n3. Is your primary difficulty social vulnerability or missing structure?",
    }));
    expect(result.scores.find((score) => score.id === "binary_layer_question")?.passed).toBe(false);
  });

  it("fails clinical finding language in product voice but allows quoted client wording", () => {
    expect(hasClinicalFindingLanguage("Hidden: narcissistic vulnerability.")).toBe(true);
    expect(hasClinicalFindingLanguage('You wrote "ADHD diagnosis"; this report cannot confirm it.')).toBe(false);

    const result = evaluateEpistemologyQualification(teacherLayered(), baseSections({
      hidden: "The impasse may be fundamentally a functional breakdown or skill deficits.",
    }));
    expect(result.scores.find((score) => score.id === "clinical_finding")?.passed).toBe(false);
  });

  it("fails unhedged symbol predicates and passes hedged amplification", () => {
    expect(hasUnhedgedSymbolPredicate("the obstacle voice functions as a threshold guardian")).toBe(true);
    expect(hasUnhedgedSymbolPredicate("these figures may point toward a threshold tension")).toBe(false);

    const result = evaluateEpistemologyQualification(teacherLayered(), baseSections({
      jungian: "The obstacle voice functions as a threshold guardian. This is a classic image.",
    }));
    expect(result.scores.find((score) => score.id === "certain_symbol")?.passed).toBe(false);
  });

  it("fails unclean two-variable experiments without a named practicalCondition factor", () => {
    const unclean: Experiment = {
      kind: "behavioral",
      title: "Your experiment",
      hypothesisTested: "hyp-teacher",
      action: "Use a 25-min timer and send the draft to one person.",
      duration: "25 minutes",
      whatToObserve: ["Whether it sends"],
      resultSupportingHypothesis: "It sends.",
      resultWeakeningHypothesis: "It freezes.",
      riskLevel: "low",
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-a", "hyp-b"],
      heldConstant: [],
      outcomeInterpretations: [
        { outcome: "It sends", favors: "hyp-a", because: "Structure worked." },
      ],
    };
    expect(hasUncleanTwoVariableExperiment(unclean)).toBe(true);

    const clean: Experiment = {
      ...unclean,
      action: "Use a 25-min timer on a private draft while holding send constant.",
    };
    expect(hasUncleanTwoVariableExperiment(clean)).toBe(false);

    const state = teacherLayered();
    state.experiments = [unclean];
    const result = evaluateEpistemologyQualification(state, baseSections());
    expect(result.scores.find((score) => score.id === "unclean_two_variable")?.passed).toBe(false);
  });

  it("fails invented analogues the client did not supply", () => {
    const state = teacherLayered();
    state.experiments = [{
      ...state.experiments[0],
      action: "Try cleaning your kitchen for twenty minutes as an analogue practice.",
    }];
    expect(hasInventedAnalogue(state)).toBe(true);

    const withSupply = designerAnalogueEligible();
    expect(hasInventedAnalogue(withSupply)).toBe(false);

    const result = evaluateEpistemologyQualification(state, baseSections());
    expect(result.scores.find((score) => score.id === "invented_analogue")?.passed).toBe(false);
  });

  it("passes case-agnostic positive fixtures including practical-only", () => {
    for (const state of [
      teacherLayered(),
      designerAnalogueEligible(),
      managerContrastEligible(),
      practicalOnly(),
    ]) {
      const result = evaluateEpistemologyQualification(state, baseSections());
      expect(result.hardPassed).toBe(true);
    }
  });
});
