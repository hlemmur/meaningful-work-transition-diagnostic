import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { experimentCopyAgrees } from "@/engine/pipeline/gates";
import { stripCanonicalEvidenceIds, CUSTOMER_SAFETY_FAILURE } from "@/engine/pipeline/customer-prose";
import type { CaseState } from "@/engine/schemas/case-state";
import type { ReportSection } from "@/engine/schemas/analysis";
import { evaluateDevelopmentalQualification } from "./developmental-qualification";

const METHOD_STAGES = [
  "practical_reality",
  "trigger",
  "emotion",
  "body",
  "ego_position",
  "persona",
  "projection",
  "protective_pattern",
  "witnessing",
  "creative_action",
] as const;

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

function baseFormulation(selectedHypothesisId: string): NonNullable<CaseState["finalFormulation"]> {
  return {
    selectedHypothesisId,
    maintenanceFormulation: "Container loss and ADHD mechanics still explain the stall.",
    maintenanceMechanism: {
      trigger: "A visible send is about to happen.",
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
}

function practicalOnly(): CaseState {
  const state = emptyCaseState("labor");
  state.practicalContext.constraints = [
    evidence("Q0.5", "Hiring demand is weak and money pressure is real.", "practical_constraint"),
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
    originForks: ["history_vs_stated_cause"],
    scoring: {
      evidenceCoverage: 0.8,
      crossContextRecurrence: 0.5,
      contradictionResolution: 0.5,
      personSpecificity: 0.5,
      developmentalFit: 0.1,
      imageConstraintFit: 0.1,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "moderate",
  }];
  state.finalFormulation = baseFormulation("hyp-practical");
  state.realityCheck = {
    sufficientWithoutDepth: true,
    categories: ["labor market", "financial"],
    narrative: "Hiring conditions and money pressure explain the pause.",
    evidenceRefs: ["labor:Q0.5"],
  };
  return state;
}

function layered(): CaseState {
  const state = practicalOnly();
  state.behavior.actionsTaken = [
    evidence("Q2.2", "A private draft finishes, then visibility freezes the send.", "behavior"),
  ];
  state.affect.emotions = [evidence("Q3.3", "fear", "emotion")];
  state.history.earlierOccurrences = [
    evidence("Q4.8", "External structure has carried continuity.", "history"),
  ];
  state.projections.rejectedFigures = [{
    id: "p1",
    figure: "dependent colleague",
    judgedQuality: "neediness",
    evidenceRefs: ["case:Q6.1"],
  }];
  state.symbolicMaterial = { scene: "a pipe mid-threshold in the dark" };
  state.hypotheses = [{
    ...state.hypotheses[0],
    id: "hyp-depth",
    category: "psychological",
    title: "Visibility charge beside container mechanics",
    observedPattern: "Private work moves; visible work freezes.",
  }];
  state.finalFormulation = {
    ...baseFormulation("hyp-depth"),
    developmentalFormulation: {
      consciousPole: "freedom",
      compensatingPole: "structure",
      coreOpposition: "freedom and structure",
      possibleDevelopmentalTask: "Relate to freedom and structure without ranking either pole.",
      uncertainty: "ADHD and money pressure remain true.",
      evidenceRefs: ["case:Q2.2", "case:Q4.8"],
    },
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
  state.realityCheck = {
    sufficientWithoutDepth: false,
    categories: ["constraints"],
    narrative: "Practical pressure remains, and it does not settle the charged pattern.",
    evidenceRefs: ["case:Q0.5"],
  };
  state.experiments = [{
    kind: "behavioral",
    title: "Private draft",
    hypothesisTested: "hyp-depth",
    action: "Write one ten-minute private draft for one trusted person.",
    duration: "10 minutes",
    whatToObserve: ["Whether one draft is completed."],
    resultSupportingHypothesis: "The draft is completed.",
    resultWeakeningHypothesis: "The draft is not completed.",
    riskLevel: "low",
      layerUpdates: [],
    practicalRequirements: [],
    competingHypothesisIds: ["hyp-depth"],
    heldConstant: ["task difficulty"],
    outcomeInterpretations: [],
  }];
  return state;
}

const plain: ReportSection[] = [
  "problem",
  "reality",
  "contradiction",
  "alternative",
  "experiment",
  "close",
].map((id) => ({
  id: id as ReportSection["id"],
  title: id,
  body: "You described a stall. ADHD and money pressure remain true. Unknowns remain, and new evidence can update the formulation.",
  evidenceRefs: ["case:Q0.5"],
}));

const goodDevelopmental: ReportSection = {
  id: "developmental",
  title: "The developmental tension",
  body: "Freedom may protect aliveness while making continuity hard. Structure may protect continuity while risking deadening form. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.",
  evidenceRefs: ["case:Q2.2", "case:Q4.8"],
};

describe("offline qualification before any live origin run", () => {
  it("keeps every method stage visible and does not assign an expected mode", () => {
    const source = readFileSync(new URL("../engine/pipeline/developmental-warrant.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/expectedMode|origin must be layered|force layered/i);
    const result = evaluateDevelopmentalQualification(layered(), [...plain, goodDevelopmental]);
    expect(result.stages.map((stage) => stage.id)).toEqual([...METHOD_STAGES]);
    expect(result.warrant.mode).toBe("warranted");
    expect(result.hardPassed).toBe(true);
    const withoutPersona = layered();
    withoutPersona.hiddenPosition = {
      ...withoutPersona.hiddenPosition!,
      protectiveFunction: [],
    };
    const partial = evaluateDevelopmentalQualification(withoutPersona, [...plain, goodDevelopmental]);
    expect(partial.stages.find((stage) => stage.id === "persona")?.status).toBe("partial");
  });

  it("passes a practical-only case and a body-unavailable layered case", () => {
    const practical = evaluateDevelopmentalQualification(practicalOnly(), plain);
    expect(practical.warrant.mode).toBe("not_warranted");
    expect(practical.hardPassed).toBe(true);

    const unavailable = layered();
    unavailable.affect.bodyResponses = [];
    const sections = [...plain, goodDevelopmental].map((section) =>
      section.id === "reality"
        ? { ...section, body: `${section.body} No body sensation was supplied, so this account makes no somatic claim.` }
        : section,
    );
    const result = evaluateDevelopmentalQualification(unavailable, sections);
    expect(result.warrant.bodyStatus).toBe("explicitly_unavailable");
    expect(result.stages.find((stage) => stage.id === "body")?.status).toBe("explicitly_unavailable");
  });

  it("fails terminology-only prose, inverse proof, and an internal evidence token", () => {
    const state = layered();
    state.finalFormulation = {
      ...state.finalFormulation!,
      developmentalFormulation: undefined,
    };
    const jargon = evaluateDevelopmentalQualification(state, plain.map((section) => ({
      ...section,
      body: `${section.body} polarity compensation individuation`,
    })));
    expect(jargon.hardPassed).toBe(false);

    const inverse = evaluateDevelopmentalQualification(layered(), [...plain, goodDevelopmental].map((section) =>
      section.id === "close"
        ? { ...section, body: `${section.body} Structure failed, therefore persona protection is primary.` }
        : section,
    ));
    expect(inverse.scores.find((score) => score.id === "inverse_proof")?.passed).toBe(false);

    const leaked = "You left the role [origin-real-local:Q1.3].";
    expect(stripCanonicalEvidenceIds(leaked, ["origin-real-local:Q1.3"])).not.toContain("Q1.3");
    expect(CUSTOMER_SAFETY_FAILURE.test("This heals the underlying wound.")).toBe(true);
    expect(CUSTOMER_SAFETY_FAILURE.test("You reported an ADHD diagnosis; this report cannot determine how much it contributes.")).toBe(false);
  });

  it("requires the report audience to match the structured action", () => {
    const state = layered();
    expect(experimentCopyAgrees([
      { id: "experiment", title: "Your experiment", body: "Show the draft to one trusted person.", evidenceRefs: ["case:Q2.2"] },
    ], state).passed).toBe(true);
    expect(experimentCopyAgrees([
      { id: "experiment", title: "Your experiment", body: "Send it to three colleagues.", evidenceRefs: ["case:Q2.2"] },
    ], state).passed).toBe(false);
  });
});
