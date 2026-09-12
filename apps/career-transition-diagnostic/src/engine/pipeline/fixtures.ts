import type { Contradiction, Hypothesis } from "../schemas/analysis";
import {
  contradictionSchema,
  experimentSchema,
  hiddenPositionSchema,
  hypothesisSchema,
  imageVoteSchema,
  jungianLensSchema,
  realityCheckSchema,
  reportSectionSchema,
} from "../schemas/analysis";
import type { AnalysisStage } from "./models";

export type AnalysisFixture =
  | "default"
  | "practical-rival"
  | "image-weakens"
  | "critic-constraints-win"
  | "empty-jungian"
  | "schema-fail";

export function inferAnalysisFixture(answers: Record<string, unknown>): AnalysisFixture {
  const blob = JSON.stringify(answers);
  if (blob.includes("FORCE_SCHEMA_FAILURE")) {
    return "schema-fail";
  }
  if (blob.includes("IMAGE_WEAKENS")) {
    return "image-weakens";
  }
  if (blob.includes("CRITIC_CONSTRAINTS_WIN")) {
    return "critic-constraints-win";
  }
  if (blob.includes("EMPTY_JUNGIAN")) {
    return "empty-jungian";
  }
  if (typeof answers["Q0.5"] === "string" && answers["Q0.5"].trim()) {
    return "practical-rival";
  }
  return "default";
}

function scoring(overrides: Partial<Hypothesis["scoring"]> = {}): Hypothesis["scoring"] {
  return {
    evidenceCoverage: 0.7,
    crossContextRecurrence: 0.6,
    contradictionResolution: 0.7,
    personSpecificity: 0.6,
    developmentalFit: 0.5,
    imageConstraintFit: 0.5,
    counterEvidencePenalty: 0.1,
    simplerAlternativePenalty: 0.2,
    ...overrides,
  };
}

function hyp(
  id: string,
  category: Hypothesis["category"],
  title: string,
  evidenceRef: string,
  extras: Partial<Hypothesis> = {},
): Hypothesis {
  return hypothesisSchema.parse({
    id,
    title,
    category,
    observedPattern: title,
    evidenceFor: [evidenceRef],
    evidenceAgainst: [],
    contradictionsExplained: ["c-central"],
    contradictionsNotExplained: [],
    simplerAlternatives: ["The stall is a practical constraint."],
    missingInformation: [],
    originForks: ["history_vs_stated_cause"],
    scoring: scoring(),
    confidence: "tentative",
    ...extras,
  });
}

function contradiction(assessmentId: string, evidenceRef: string): Contradiction {
  return contradictionSchema.parse({
    id: "c-central",
    statementA: "I want work that feels alive.",
    statementB: "I keep not taking the next concrete step.",
    evidenceA: [evidenceRef],
    evidenceB: [evidenceRef],
    significance: "The stall sits next to a stated desire.",
    categories: ["action_vs_desire"],
    originForks: ["history_vs_stated_cause"],
    scores: {
      evidenceStrength: 0.8,
      recurrence: 0.7,
      explanatoryImportance: 0.9,
      charge: 0.6,
    },
  });
}

export function passOutputFor(
  stage: AnalysisStage,
  fixture: AnalysisFixture,
  ctx: { assessmentId: string; evidenceRef: string; requestedInsight?: string },
) {
  if (fixture === "schema-fail" && stage === "pass3") {
    return {};
  }

  const depth = hyp(
    "hyp-depth",
    "psychological",
    "The stall may be protecting a not-yet-incarnated way of working.",
    ctx.evidenceRef,
    {
      scoring: scoring({
        imageConstraintFit: 0.9,
        simplerAlternativePenalty: 0.2,
      }),
    },
  );
  const practical = hyp(
    "hyp-practical",
    "practical",
    "Constraints and missing infrastructure may be enough to explain the stall.",
    ctx.evidenceRef,
    {
      category: "practical",
      scoring: scoring({
        evidenceCoverage: fixture === "image-weakens" ? 0.88 : 0.65,
        crossContextRecurrence: fixture === "image-weakens" ? 0.8 : 0.55,
        contradictionResolution: fixture === "image-weakens" ? 0.8 : 0.55,
        personSpecificity: fixture === "image-weakens" ? 0.75 : 0.55,
        developmentalFit: 0.4,
        imageConstraintFit: fixture === "image-weakens" ? 0.35 : 0.4,
        simplerAlternativePenalty: 0.04,
      }),
    },
  );
  const identity = hyp(
    "hyp-identity",
    "identity",
    "The work may be carrying a legitimacy demand the person cannot settle.",
    ctx.evidenceRef,
  );

  const includePractical =
    fixture === "practical-rival" ||
    fixture === "critic-constraints-win" ||
    fixture === "image-weakens";
  const hypotheses = includePractical
    ? [depth, practical, identity]
    : [depth, identity, hyp("hyp-env", "environmental", "The current container may be missing.", ctx.evidenceRef)];

  switch (stage) {
    case "pass1":
      return { consciousExplanationTags: ["lack_of_confidence"], unresolvedQuestions: [] };
    case "pass2":
      return { contradictions: [contradiction(ctx.assessmentId, ctx.evidenceRef)] };
    case "pass3":
      return { hypotheses };
    case "pass4":
      return {
        critiques: hypotheses.map((item) => ({
          hypothesisId: item.id,
          mundaneAlternative: "Money, visa, or labor-market constraints may suffice.",
          survives: !(fixture === "critic-constraints-win" && item.id === "hyp-depth"),
        })),
      };
    case "pass5": {
      const weakens = fixture === "image-weakens";
      return {
        votes: [
          imageVoteSchema.parse({
            hypothesisId: "hyp-depth",
            verdict: weakens ? "weakens" : "insufficient",
            note: weakens
              ? "The empty landscape points to job-shape / direction, not a hidden stance."
              : "The image is too thin to vote.",
            evidenceRefs: [ctx.evidenceRef],
          }),
          imageVoteSchema.parse({
            hypothesisId: practical.id,
            verdict: weakens ? "supports" : "insufficient",
            note: weakens ? "No path is a practical-direction constraint." : "Thin image.",
            evidenceRefs: [ctx.evidenceRef],
          }),
        ],
        overallNote: weakens ? "Image weakens the psychological favorite." : "Insufficient image.",
      };
    }
    case "pass6": {
      if (fixture === "critic-constraints-win") {
        return { hiddenPosition: null, alternative: practical.observedPattern };
      }
      return {
        hiddenPosition: hiddenPositionSchema.parse({
          consciousPosition: "I need more confidence.",
          observedPattern: "Desire without the next concrete step.",
          possibleHiddenPosition:
            "Structure is being asked to serve aliveness, not the other way around.",
          protectiveFunction: ["Keeps the work from becoming only grind."],
          threatenedByChange: ["Losing the feeling of possibility."],
          developmentalTension: { poleA: "possibility", poleB: "incarnation" },
          imageVoteSummary: fixture === "image-weakens" ? "weakens" : "insufficient",
          evidenceRefs: [ctx.evidenceRef],
          counterEvidenceRefs: [],
          confidence: "tentative",
        }),
        alternative: practical.observedPattern,
      };
    }
    case "pass7":
      if (fixture === "empty-jungian") {
        return { jungianLenses: [] };
      }
      return {
        jungianLenses: [
          jungianLensSchema.parse({
            concept: "compensation",
            observedPatternItIlluminates: "The stall beside a stated desire.",
            whyUseful: "It names a possible balancing movement without diagnosing the person.",
            evidenceRefs: [ctx.evidenceRef],
            limitsOfInterpretation: "A practical constraint may still be sufficient.",
            confidence: "tentative",
          }),
        ],
      };
    case "pass8":
      return {
        realityCheck: realityCheckSchema.parse({
          sufficientWithoutDepth: fixture === "critic-constraints-win",
          categories:
            fixture === "critic-constraints-win"
              ? ["financial stress", "constraints"]
              : ["insufficient information"],
          narrative:
            fixture === "critic-constraints-win"
              ? "The constraints can carry the story without a deeper psychological reading."
              : "Depth is possible, but a concrete alternative remains.",
          evidenceRefs: [ctx.evidenceRef],
        }),
        experiments: [
          experimentSchema.parse({
            kind: "behavioral",
            title: "Two weeks of external deadlines",
            hypothesisTested: "container_loss_vs_capacity",
            action: "Send one concrete artifact twice a week to a trusted reviewer.",
            duration: "14 days",
            whatToObserve: ["output count", "body charge after sending"],
            resultSupportingHypothesis: "Output rises when someone else holds the deadline.",
            resultWeakeningHypothesis: "Nothing changes even with accountability.",
            riskLevel: "low",
            practicalRequirements: ["one reviewer", "two calendar blocks"],
          }),
        ],
      };
    case "pass9": {
      const q = (questionId: string) => `${ctx.assessmentId}:${questionId}`;
      const sections = [
        reportSectionSchema.parse({
          id: "problem",
          title: "The problem as you see it",
          body: "You described a stall next to a desire for more alive work.",
          evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
        }),
        reportSectionSchema.parse({
          id: "reality",
          title: "What reality says",
          body: "Practical constraints and missing structure are in the picture.",
          evidenceRefs: [q("Q0.4"), q("Q0.5")],
        }),
        reportSectionSchema.parse({
          id: "contradiction",
          title: "The contradiction at the center",
          body: "Wanting the work and not taking the next step sit together.",
          evidenceRefs: [q("Q1.1"), q("Q1.3")],
        }),
        reportSectionSchema.parse({
          id: "alternative",
          title: "Another plausible interpretation",
          body: "The stall may be a sufficient response to constraints, not a hidden stance.",
          evidenceRefs: [q("Q0.5")],
        }),
        reportSectionSchema.parse({
          id: "experiment",
          title: "Your experiment",
          body: "Try two weeks of external deadlines and watch both output and charge.",
          evidenceRefs: [q("Q1.1")],
        }),
      ];
      if (fixture !== "critic-constraints-win") {
        sections.splice(
          3,
          0,
          reportSectionSchema.parse({
            id: "hidden",
            title: "A possible hidden position",
            body: "One hypothesis is that structure is being asked to serve aliveness.",
            evidenceRefs: [q("Q1.3"), q("Q2.1")],
          }),
        );
      }
      if (fixture !== "empty-jungian") {
        sections.push(
          reportSectionSchema.parse({
            id: "jungian",
            title: "A Jungian lens",
            body: "Compensation may illuminate the stall without naming you as an archetype.",
            evidenceRefs: [q("Q2.1")],
          }),
        );
      }
      return { sections };
    }
    case "pass10":
      return { failingSectionIds: [], regeneratedSections: [] };
  }
}
