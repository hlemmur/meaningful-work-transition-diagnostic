import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import type { CaseState } from "@/engine/schemas/case-state";
import type { ReportSection } from "@/engine/schemas/analysis";
import {
  classifyEvidenceKinds,
  evaluateDevelopmentalQualification,
} from "./developmental-qualification";
import { evaluateFrameworkFidelity } from "./framework-fidelity";

describe("developmental qualification rubric", () => {
  it("passes practical restraint and rejects an invented developmental section", () => {
    const state = emptyCaseState("practical");
    const restrained = evaluateDevelopmentalQualification(state, []);
    expect(restrained.hardPassed).toBe(true);

    const invented = evaluateDevelopmentalQualification(state, [{
      id: "developmental", title: "The developmental tension", body: "A tension.", evidenceRefs: ["practical:Q2.1"],
    }]);
    expect(invented.hardPassed).toBe(false);
  });

  it("requires a developmental formulation to span independent domains and appear in the report", () => {
    const state = emptyCaseState("positive");
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Delay recurs.",
      maintenanceMechanism: { trigger: "Choice", response: "Delay", shortTermFunction: "Relief", longTermCost: "No evidence", reinforcingConsequence: "Uncertainty" },
      developmentalFormulation: {
        consciousPole: "freedom", compensatingPole: "structure", coreOpposition: "freedom and structure",
        possibleDevelopmentalTask: "Integrate both.", uncertainty: "Practical causes remain live.",
        evidenceRefs: ["positive:Q2.1", "positive:Q6.1"],
      },
      whyItFits: ["Recurs"], whatItDoesNotExplain: ["Market"], strongestAlternative: "Job shape", unresolvedForks: [],
    };
    const result = evaluateDevelopmentalQualification(state, [{
      id: "developmental", title: "The developmental tension", body: "You may be integrating freedom and structure.", evidenceRefs: ["positive:Q2.1", "positive:Q6.1"],
    }]);
    expect(result.hardPassed).toBe(true);
  });
});

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

function layeredState(overrides: Partial<CaseState> = {}): CaseState {
  const state = emptyCaseState("case");
  state.practicalContext.constraints = [
    evidence("Q0.5", "ADHD and container loss make deadlines hard without external structure.", "practical_constraint"),
  ];
  state.behavior.actionsTaken = [
    evidence("Q2.2", "Visibility still freezes outreach even after a private draft is finished.", "behavior"),
  ];
  state.affect.emotions = [evidence("Q3.3", "fear", "emotion")];
  state.history.earlierOccurrences = [
    evidence("Q4.8", "External structure has repeatedly carried continuity.", "history"),
  ];
  state.projections.rejectedFigures = [{
    id: "p1",
    figure: "dependent colleague",
    judgedQuality: "neediness",
    evidenceRefs: ["case:Q6.1"],
  }];
  state.symbolicMaterial = { scene: "a pipe mid-threshold in the dark" };
  state.hypotheses = [{
    id: "hyp-depth",
    title: "Visibility charge beside container mechanics",
    category: "psychological",
    observedPattern: "Private work moves; visible work freezes.",
    evidenceFor: ["case:Q2.2", "case:Q3.3"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: ["container_loss_vs_capacity"],
    scoring: {
      evidenceCoverage: 0.8,
      crossContextRecurrence: 0.7,
      contradictionResolution: 0.7,
      personSpecificity: 0.7,
      developmentalFit: 0.6,
      imageConstraintFit: 0.5,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "moderate",
  }];
  state.finalFormulation = {
    selectedHypothesisId: "hyp-depth",
    maintenanceFormulation: "Container loss and ADHD mechanics still explain the stall.",
    maintenanceMechanism: {
      trigger: "A visible send or public claim is about to happen.",
      response: "The action freezes.",
      shortTermFunction: "Avoids exposure.",
      longTermCost: "No new evidence.",
      reinforcingConsequence: "The freeze confirms the danger.",
    },
    whyItFits: ["Visibility changes the outcome."],
    whatItDoesNotExplain: ["Money pressure remains real."],
    strongestAlternative: "ADHD and missing infrastructure may be sufficient.",
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
  return { ...state, ...overrides, assessmentId: "case" };
}

function passingLayered() {
  const state = layeredState();
  state.finalFormulation = {
    ...state.finalFormulation!,
    developmentalFormulation: {
      consciousPole: "freedom",
      compensatingPole: "structure",
      coreOpposition: "freedom and structure",
      possibleDevelopmentalTask: "Relate to freedom and structure without ranking either pole.",
      uncertainty: "ADHD and money pressure remain true.",
      evidenceRefs: ["case:Q2.2", "case:Q4.8"],
    },
  };
  const sections: ReportSection[] = [
    ...plainSections,
    {
      id: "developmental",
      title: "The developmental tension",
      body: "Freedom may protect aliveness while making continuity hard. Structure may protect continuity while risking deadening form. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.",
      evidenceRefs: ["case:Q2.2", "case:Q4.8"],
    },
    {
      id: "close",
      title: "A working formulation",
      body: "Practical mechanics and the psychological pattern can both remain live. Unknowns remain, and new evidence can update the formulation.",
      evidenceRefs: ["case:Q0.5"],
    },
  ];
  return { state, sections };
}

const plainSections: ReportSection[] = [
  "problem",
  "reality",
  "contradiction",
  "hidden",
  "alternative",
  "experiment",
].map((id) => ({
  id: id as ReportSection["id"],
  title: id,
  body: "You described a specific stall with ADHD constraints and a visibility freeze that remains affectively charged.",
  evidenceRefs: ["case:Q0.5", "case:Q2.2"],
}));

describe("layered developmental warrant", () => {
  it("passes a practical-only labor-market case with depth not warranted", () => {
    const state = emptyCaseState("labor");
    state.practicalContext.constraints = [
      evidence("Q0.5", "Hiring demand is weak in the target market.", "practical_constraint"),
    ];
    state.hypotheses = [{
      ...layeredState().hypotheses[0],
      id: "hyp-practical",
      category: "practical",
      title: "Labor market",
    }];
    state.finalFormulation = {
      ...layeredState().finalFormulation!,
      selectedHypothesisId: "hyp-practical",
      developmentalFormulation: undefined,
    };
    state.realityCheck = {
      sufficientWithoutDepth: true,
      categories: ["labor market"],
      narrative: "Hiring conditions explain the pause.",
      evidenceRefs: ["labor:Q0.5"],
    };
    const result = evaluateDevelopmentalQualification(state, plainSections);
    expect(result.warrant.mode).toBe("not_warranted");
    expect(result.hardPassed).toBe(true);
    expect(result.stages.find((stage) => stage.id === "protective_pattern")?.status).toBe("not_warranted");
  });

  it("fails an origin-like layered case when the warranted formulation and section are missing", () => {
    const result = evaluateDevelopmentalQualification(layeredState(), plainSections);
    expect(result.warrant.mode).toBe("warranted");
    expect(result.hardPassed).toBe(false);
    expect(result.scores.find((score) => score.id === "developmental_warrant")?.passed).toBe(false);
  });

  it("passes the layered case when both poles are rendered and the third is unknown", () => {
    const state = layeredState();
    state.finalFormulation = {
      ...state.finalFormulation!,
      developmentalFormulation: {
        consciousPole: "freedom",
        compensatingPole: "structure",
        coreOpposition: "freedom and structure",
        possibleDevelopmentalTask: "Relate to freedom and structure without ranking either pole.",
        uncertainty: "ADHD and money pressure remain true.",
        evidenceRefs: ["case:Q2.2", "case:Q4.8"],
      },
    };
    const sections = [
      ...plainSections,
      {
        id: "developmental" as const,
        title: "The developmental tension",
        body: "Freedom may protect aliveness while making continuity hard. Structure may protect continuity while risking deadening form. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.",
        evidenceRefs: ["case:Q2.2", "case:Q4.8"],
      },
    ];
    const result = evaluateDevelopmentalQualification(state, sections);
    expect(result.hardPassed).toBe(true);
    expect(result.stages.find((stage) => stage.id === "emotion")?.status).toBe("grounded");
  });

  it("keeps a symbol-rich case unresolved when no developmental task is justified", () => {
    const state = emptyCaseState("symbol");
    state.symbolicMaterial = { scene: "a dark pipe", obstacle: "darkness" };
    state.consciousNarrative.statedCausesFreeText = [
      evidence("Q1.3", "The image is just a picture.", "self_interpretation"),
    ];
    state.imageAnalysis = {
      literalFacts: [{ text: "a dark pipe", evidenceRefs: ["symbol:Q10.1"] }],
      personalAssociations: [],
      plausibleReadings: [],
      unresolvedSymbolicQuestion: "What does the darkness still withhold?",
    };
    const result = evaluateDevelopmentalQualification(state, plainSections);
    expect(result.warrant.mode).toBe("unresolved");
    expect(result.hardPassed).toBe(true);
  });

  it("accepts unavailable body data when the report names the limit and makes no somatic claim", () => {
    const state = layeredState();
    state.affect.bodyResponses = [];
    const sections = plainSections.map((section) =>
      section.id === "reality"
        ? {
            ...section,
            body: "No body sensation was supplied, so this account makes no somatic claim. ADHD constraints and the visibility freeze remain in view.",
          }
        : section,
    );
    const result = evaluateDevelopmentalQualification(state, sections);
    expect(result.warrant.bodyStatus).toBe("explicitly_unavailable");
    expect(result.scores.find((score) => score.id === "invented_embodiment")?.passed).toBe(true);
  });

  it("passes when a charged projection is considered and then rejected for a literal job mismatch", () => {
    const state = layeredState();
    state.finalFormulation = {
      ...state.finalFormulation!,
      selectedHypothesisId: "hyp-practical",
    };
    state.hypotheses = [
      ...state.hypotheses,
      {
        ...state.hypotheses[0],
        id: "hyp-practical",
        category: "practical",
        title: "Job skill mismatch",
        observedPattern: "The role shape does not match the work sought.",
      },
    ];
    state.realityCheck = {
      sufficientWithoutDepth: true,
      categories: ["occupational"],
      narrative: "A literal job and skill mismatch explains the charge better than a projection.",
      evidenceRefs: ["case:Q0.5"],
    };
    state.projectionInterpretations = [{
      projectionEvidenceRefs: ["case:Q6.1"],
      possibleDisownedValue: "Receiving support may be a value not yet owned directly.",
      literalEnactmentRisk: "This does not mean imitating the rejected figure.",
    }];
    const sections = plainSections.map((section) =>
      section.id === "contradiction"
        ? {
            ...section,
            body: "A charged rejection of dependency was considered, then set aside because a literal job and skill mismatch explains it better. The value is not yet owned as a conclusion.",
          }
        : section,
    );
    const result = evaluateDevelopmentalQualification(state, sections);
    expect(result.warrant.mode).toBe("not_warranted");
    expect(result.hardPassed).toBe(true);
  });

  it("does not treat repeated discipline self-theory as independent evidence", () => {
    const state = emptyCaseState("discipline");
    state.consciousNarrative.statedCausesFreeText = [
      evidence("Q1.1", "I need discipline.", "self_interpretation"),
      evidence("Q1.2", "I need more discipline.", "self_interpretation"),
      evidence("Q7.1", "I need discipline in another area.", "self_interpretation"),
    ];
    expect(classifyEvidenceKinds(state)).toEqual(["self_theory"]);
    const result = evaluateDevelopmentalQualification(state, plainSections);
    expect(result.warrant.eligible).toBe(false);
    expect(result.hardPassed).toBe(true);
  });

  it("does not count a Q5 or Q6 citation as projection integration", () => {
    const state = emptyCaseState("cite");
    state.hypotheses = [{
      ...layeredState().hypotheses[0],
      evidenceFor: ["cite:Q5.1", "cite:Q6.1"],
    }];
    expect(classifyEvidenceKinds(state)).not.toContain("projection");
  });

  it("fails direct ADHD causality, shadow sabotage, and inverse proof", () => {
    const state = passingLayered().state;
    const failures: Array<[string, string]> = [
      ["ADHD directly causes your freeze.", "unsupported_causality"],
      ["Your shadow is sabotaging you.", "safety_scope"],
      ["Structure failed, therefore persona protection is primary.", "inverse_proof"],
    ];
    for (const [sentence, scoreId] of failures) {
      const sections = passingLayered().sections.map((section) =>
        section.id === "close"
          ? { ...section, body: `${section.body} ${sentence}` }
          : section,
      );
      const result = evaluateDevelopmentalQualification(state, sections);
      expect(result.scores.find((score) => score.id === scoreId)?.passed, sentence).toBe(false);
      expect(result.hardPassed, sentence).toBe(false);
    }
  });

  it("does not let polarity vocabulary repair a missing warranted formulation", () => {
    const bare = evaluateDevelopmentalQualification(layeredState(), plainSections);
    const jargon = evaluateDevelopmentalQualification(layeredState(), plainSections.map((section) => ({
      ...section,
      body: `${section.body} polarity compensation individuation`,
    })));
    expect(bare.hardPassed).toBe(false);
    expect(jargon.hardPassed).toBe(false);
    expect(jargon.scores.find((score) => score.id === "developmental_warrant")?.passed).toBe(false);
  });

  it("fails invented embodiment, either-or framing, one-reading closure, missing gold, leading questions, and internal refs", () => {
    const state = layeredState();
    state.imageAnalysis = {
      literalFacts: [{ text: "dark pipe", evidenceRefs: ["case:Q10.1"] }],
      personalAssociations: [],
      plausibleReadings: [
        { interpretation: "lost container", supportsHypothesisIds: [], weakensHypothesisIds: [], evidenceRefs: ["case:Q10.1"] },
        { interpretation: "irreversible threshold", supportsHypothesisIds: [], weakensHypothesisIds: [], evidenceRefs: ["case:Q10.1"] },
      ],
      unresolvedSymbolicQuestion: "What does the darkness still withhold?",
    };
    state.projectionInterpretations = [{
      projectionEvidenceRefs: ["case:Q6.1"],
      possibleDisownedValue: "Receptivity may be a value not yet owned directly.",
    }];
    const badBodies: Array<[string, string]> = [
      ["Your chest tightened as the freeze began.", "invented_embodiment"],
      ["Either practical or psychological reality must be the real explanation; they cannot both be true.", "either_or_framing"],
      ["The only possible reading is persona protection, and nothing about the image remains unresolved.", "symbol_closure"],
      ["Dependency's gold is ordinary discipline.", "projection_gold"],
      ["Isn't it true that you are avoiding your real work?", "leading_question"],
      ["The pattern is documented in [origin-real-local:Q1.3] and assessment:Q2.2.", "internal_refs"],
    ];
    for (const [body, scoreId] of badBodies) {
      const sections = passingLayered().sections.map((section, index) =>
        index === 0 ? { ...section, body: `${section.body} ${body}` } : section,
      );
      const result = evaluateDevelopmentalQualification(state, sections);
      expect(result.scores.find((score) => score.id === scoreId)?.passed, body).toBe(false);
    }
  });

  it("keeps two named readings open without the phrases another reading or second reading", () => {
    const { state, sections } = passingLayered();
    state.imageAnalysis = {
      literalFacts: [{ text: "locked garden gate", evidenceRefs: ["case:Q10.1"] }],
      personalAssociations: [],
      plausibleReadings: [
        { interpretation: "authorization", supportsHypothesisIds: [], weakensHypothesisIds: [], evidenceRefs: ["case:Q10.1"] },
        { interpretation: "ordinary route clarity", supportsHypothesisIds: [], weakensHypothesisIds: [], evidenceRefs: ["case:Q10.1"] },
      ],
      unresolvedSymbolicQuestion: "Does the gate concern permission or route clarity?",
    };
    const openBody = "The gate image supports both an authorization reading and an ordinary route-clarity reading, so its meaning remains unresolved rather than settled.";
    expect(openBody).not.toMatch(/another reading|second reading/i);
    const open = evaluateDevelopmentalQualification(state, sections.map((section, index) =>
      index === 0 ? { ...section, body: `${section.body} ${openBody}` } : section,
    ));
    expect(open.scores.find((score) => score.id === "symbol_closure")?.passed).toBe(true);

    const collapsed = evaluateDevelopmentalQualification(state, sections.map((section, index) =>
      index === 0
        ? { ...section, body: `${section.body} The gate simply stands for waiting, and the practical route is already settled.` }
        : section,
    ));
    expect(collapsed.scores.find((score) => score.id === "symbol_closure")?.passed).toBe(false);
  });

  it("keeps hard safety failures outside mentor scoring", () => {
    const state = layeredState();
    const sections = plainSections.map((section) =>
      section.id === "problem"
        ? { ...section, body: "Your shadow is sabotaging you and this heals the underlying wound." }
        : section,
    );
    const fidelity = evaluateFrameworkFidelity({
      answers: {},
      caseState: state,
      report: { engineVersion: "engine.v2", sections },
    });
    expect(fidelity.hardPassed).toBe(false);
    expect(fidelity.scores.some((score) => score.hard && !score.passed && score.id === "safety_scope")).toBe(true);
    expect(fidelity.scores.some((score) => score.id === "surprise")).toBe(false);
    expect(fidelity.softChecklistTemplate.map((item) => item.id)).toEqual(
      expect.arrayContaining(["surprise", "symbolic_vitality", "subjective_depth"]),
    );
  });
});
