import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { evaluateFrameworkFidelity } from "./framework-fidelity";
import type { CaseState } from "@/engine/schemas/case-state";

const originAnswers = JSON.parse(
  readFileSync(
    join(__dirname, "../engine/pipeline/fixtures/origin-case-answers.json"),
    "utf8",
  ),
) as Record<string, unknown>;

function goldReport(assessmentId: string) {
  const q = (id: string) => `${assessmentId}:${id}`;
  return {
    engineVersion: "engine.v2" as const,
    sections: [
      {
        id: "problem" as const,
        title: "Problem",
        body: "You left IT for meaningful coaching work yet freeze at public exposure after years of container-supported functioning.",
        evidenceRefs: [q("Q1.1"), q("Q2.2")],
      },
      {
        id: "reality" as const,
        title: "Reality",
        body: "Without external deadlines, salary, and legitimacy you stall; ADHD and financial pressure are real constraints.",
        evidenceRefs: [q("Q0.5"), q("Q4.5"), q("Q4.7")],
      },
      {
        id: "contradiction" as const,
        title: "Contradiction",
        body: "You want freedom and self-employment, yet you function when structure and accountability impact someone else.",
        evidenceRefs: [q("Q1.2"), q("QB.1"), q("Q4.8")],
      },
      {
        id: "hidden" as const,
        title: "Hidden",
        body: "One hypothesis: freedom while an external container still carries authority and money. Protection keeps lightness; the aim may be structure in service of aliveness.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q8.4")],
      },
      {
        id: "alternative" as const,
        title: "Alternative",
        body: "This may simply be missing acquisition skill and ADHD-friendly infrastructure, not a hidden stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      },
      {
        id: "experiment" as const,
        title: "Experiment",
        body: "For two weeks, run outreach under a mutual dependency with real stakes and watch output plus body charge.",
        evidenceRefs: [q("QB.1"), q("Q1.3")],
      },
    ],
  };
}

function betaShapedReport(assessmentId: string) {
  const q = (id: string) => `${assessmentId}:${id}`;
  return {
    engineVersion: "engine.v2" as const,
    sections: [
      {
        id: "problem" as const,
        title: "Problem",
        body: "Career transition friction after leaving IT.",
        evidenceRefs: [q("Q1.1")],
      },
      {
        id: "reality" as const,
        title: "Reality",
        body: "Fear of judgment and social exposure.",
        evidenceRefs: [q("Q1.3")],
      },
      {
        id: "contradiction" as const,
        title: "Contradiction",
        body: "You want sharp angles you cannot unsee while also wanting confirmation of your path.",
        evidenceRefs: [q("Q0.5")],
      },
      {
        id: "hidden" as const,
        title: "Hidden",
        body: "Relying on intellectual revelation as delay; sit with unglamorous discomfort of daily execution.",
        evidenceRefs: [q("Q0.5")],
      },
      {
        id: "alternative" as const,
        title: "Alternative",
        body: "Maybe identity protection.",
        evidenceRefs: [q("Q1.3")],
      },
      {
        id: "experiment" as const,
        title: "Experiment",
        body: "Ask a mentor to list three failure points in your method.",
        evidenceRefs: [q("Q1.1")],
      },
    ],
  };
}

describe("evaluateFrameworkFidelity", () => {
  it("passes origin-gold shaped artifact", () => {
    const caseState = extractCaseStateFull("gold", originAnswers);
    caseState.contradictions = [
      {
        id: "c1",
        statementA: "I want freedom and self-employment",
        statementB: "I function when external structure carries deadlines",
        evidenceA: ["gold:Q1.2"],
        evidenceB: ["gold:Q4.8"],
        significance: "container",
        categories: ["structure"],
        originForks: ["container_loss_vs_capacity"],
        scores: {
          evidenceStrength: 0.9,
          recurrence: 0.9,
          explanatoryImportance: 0.9,
          charge: 0.8,
        },
      },
    ];
    caseState.hypotheses = [
      {
        id: "hyp-depth",
        title: "Container loss vs capacity",
        category: "structural",
        observedPattern: "Freedom without internalized structure stalls action",
        evidenceFor: ["gold:Q4.5"],
        evidenceAgainst: [],
        contradictionsExplained: ["c1"],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["container_loss_vs_capacity"],
        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.8,
          contradictionResolution: 0.8,
          personSpecificity: 0.8,
          developmentalFit: 0.8,
          imageConstraintFit: 0.7,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0.1,
        },
        confidence: "moderate",
      },
      {
        id: "hyp-practical",
        title: "Constraints may suffice",
        category: "practical",
        observedPattern: "ADHD and money pressure",
        evidenceFor: ["gold:Q0.5"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["rational_caution_vs_hidden_bargain"],
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
      },
    ];
    caseState.hiddenPosition = {
      consciousPosition: "I need confidence",
      observedPattern: "Freeze at exposure without container",
      possibleHiddenPosition:
        "Freedom while external structure still carries authority and money",
      protectiveFunction: ["Protects lightness and belonging"],
      possibleCompensatoryAim: "Structure in service of aliveness",
      threatenedByChange: ["Losing ethereal identity"],
      developmentalTension: { poleA: "possibility", poleB: "incarnation" },
      imageVoteSummary: "pipe mid-threshold",
      evidenceRefs: ["gold:Q9.3", "gold:Q8.4"],
      counterEvidenceRefs: [],
      confidence: "tentative",
    };
    caseState.jungianLenses = [
      {
        concept: "puer-senex polarity",
        observedPatternItIlluminates: "Possibility preferred over incarnation",
        whyUseful: "Names the developmental orbit without killing play",
        evidenceRefs: ["gold:Q9.2"],
        limitsOfInterpretation: "May also be ADHD + job-shape mismatch",
        confidence: "tentative",
      },
    ];
    caseState.experiments = [
      {
        kind: "behavioral",
        title: "Stakes accountability",
        hypothesisTested: "container_loss_vs_capacity",
        action: "Mutual dependency outreach for two weeks",
        duration: "14 days",
        whatToObserve: ["output", "charge"],
        resultSupportingHypothesis: "Output rises with stakes",
        resultWeakeningHypothesis: "No change",
        riskLevel: "low",
        practicalRequirements: ["partner"],
      },
    ];
    caseState.openForks = ["container_loss_vs_capacity"];

    const result = evaluateFrameworkFidelity({
      answers: originAnswers,
      caseState,
      report: goldReport("gold"),
    });
    expect(result.hardPassed).toBe(true);
  });

  it("fails beta-shaped Q11.3 / grind report", () => {
    const caseState = extractCaseStateFull("beta", originAnswers) as CaseState;
    caseState.contradictions = [
      {
        id: "c1",
        statementA: "I want sharp angles I cannot unsee",
        statementB: "I want confirmation of my path",
        evidenceA: ["beta:Q11.3"],
        evidenceB: ["beta:Q11.3"],
        significance: "meta",
        categories: ["insight"],
        originForks: ["rational_caution_vs_hidden_bargain"],
        scores: {
          evidenceStrength: 0.9,
          recurrence: 0.5,
          explanatoryImportance: 0.9,
          charge: 0.5,
        },
      },
    ];
    caseState.hiddenPosition = {
      consciousPosition: "sharp angles",
      observedPattern: "insight hunger",
      possibleHiddenPosition:
        "I hope it shows me some sharp angles that I can't unsee and will help me to shift my perspective",
      protectiveFunction: ["Seeker identity"],
      threatenedByChange: ["Unglamorous work"],
      developmentalTension: { poleA: "insight", poleB: "execution" },
      imageVoteSummary: "insufficient",
      evidenceRefs: ["beta:Q11.3"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };
    caseState.experiments = [
      {
        kind: "behavioral",
        title: "Critique interview",
        hypothesisTested: "intellectualizing",
        action: "Ask a mentor for three failure points",
        duration: "30m",
        whatToObserve: ["reactivity"],
        resultSupportingHypothesis: "blind spot",
        resultWeakeningHypothesis: "generic",
        riskLevel: "low",
        practicalRequirements: [],
      },
    ];
    caseState.openForks = ["container_loss_vs_capacity"];
    caseState.hypotheses = [
      {
        id: "hyp-depth",
        title: "Intellectualizing delay",
        category: "psychological",
        observedPattern: "Seeking revelation instead of exposure",
        evidenceFor: ["beta:Q11.3"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["legitimacy_loop"],
        scoring: {
          evidenceCoverage: 0.5,
          crossContextRecurrence: 0.5,
          contradictionResolution: 0.5,
          personSpecificity: 0.3,
          developmentalFit: 0.4,
          imageConstraintFit: 0.2,
          counterEvidencePenalty: 0.2,
          simplerAlternativePenalty: 0.2,
        },
        confidence: "moderate",
      },
    ];

    const result = evaluateFrameworkFidelity({
      answers: originAnswers,
      caseState,
      report: betaShapedReport("beta"),
    });
    expect(result.hardPassed).toBe(false);
    expect(result.scores.some((item) => item.id === "no_q113_spine" && !item.passed)).toBe(
      true,
    );
  });
});
