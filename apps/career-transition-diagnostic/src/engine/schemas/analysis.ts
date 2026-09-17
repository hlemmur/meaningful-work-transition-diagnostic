import { z } from "zod";

export const forkIdSchema = z.enum([
  "history_vs_stated_cause",
  "impostor_filter_vs_inexperience",
  "container_loss_vs_capacity",
  "legitimacy_loop",
  "work_vs_identity_vs_job_shape",
  "money_infrastructure_vs_misalignment",
  "background_income_relief_vs_replacement",
  "rational_caution_vs_hidden_bargain",
]);

export type ForkId = z.infer<typeof forkIdSchema>;

export const contradictionSchema = z.object({
  id: z.string(),
  statementA: z.string(),
  statementB: z.string(),
  evidenceA: z.array(z.string()),
  evidenceB: z.array(z.string()),
  significance: z.string(),
  categories: z.array(z.string()),
  originForks: z.array(forkIdSchema),
  scores: z.object({
    evidenceStrength: z.number(),
    recurrence: z.number(),
    explanatoryImportance: z.number(),
    charge: z.number(),
    crossDomainReach: z.number().default(0),
    noveltyOfConnection: z.number().default(0),
    consciousAwarenessPenalty: z.number().default(0),
  }),
});

export const hypothesisSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum([
    "psychological",
    "identity",
    "practical",
    "environmental",
    "economic",
    "occupational",
    "developmental",
    "structural",
  ]),
  consciousPosition: z.string().optional(),
  observedPattern: z.string(),
  proposedHiddenPosition: z.string().optional(),
  possibleProtectiveFunction: z.string().optional(),
  possibleCompensatoryAim: z.string().optional(),
  developmentalTension: z.string().optional(),
  evidenceFor: z.array(z.string()),
  evidenceAgainst: z.array(z.string()),
  contradictionsExplained: z.array(z.string()),
  contradictionsNotExplained: z.array(z.string()),
  simplerAlternatives: z.array(z.string()),
  missingInformation: z.array(z.string()),
  originForks: z.array(forkIdSchema),
  scoring: z.object({
    evidenceCoverage: z.number(),
    crossContextRecurrence: z.number(),
    contradictionResolution: z.number(),
    personSpecificity: z.number(),
    developmentalFit: z.number(),
    imageConstraintFit: z.number(),
    counterEvidencePenalty: z.number(),
    simplerAlternativePenalty: z.number(),
  }),
  confidence: z.enum(["weak", "tentative", "moderate", "strong"]),
});

export const hypothesisCritiqueSchema = z.object({
  hypothesisId: z.string(),

  strongestMundaneAlternative: z.string(),

  counterEvidenceRefs: z.array(z.string()),

  missingEvidence: z.array(z.string()),

  confirmationBiasRisk: z.string(),

  overPsychologizingRisk: z.string(),

  evidenceActuallyUniqueToHypothesis:
    z.array(z.string()),

  rankAdjustment: z.enum([
    "raise",
    "keep",
    "lower",
    "reject",
  ]),

  reason: z.string(),
});

export const imageVoteSchema = z.object({
  hypothesisId: z.string(),

  verdict: z.enum([
    "supports",
    "weakens",
    "splits",
    "insufficient",
  ]),

  interpretation: z.string().optional(),

  note: z.string().optional(),

  evidenceRefs: z.array(z.string()),

  exactClientMaterialUsed:
    z.array(z.string()).default([]),
});

export const hiddenPositionSchema = z.object({
  consciousPosition: z.string(),
  observedPattern: z.string(),
  possibleHiddenPosition: z.string(),
  protectiveFunction: z.array(z.string()),
  possibleCompensatoryAim: z.string().optional(),
  threatenedByChange: z.array(z.string()),
  developmentalTension: z.object({
    poleA: z.string(),
    poleB: z.string(),
  }),
  imageVoteSummary: z.string(),
  evidenceRefs: z.array(z.string()),
  counterEvidenceRefs: z.array(z.string()),
  confidence: z.enum(["tentative", "moderate", "strong"]),
});

export const forkResolutionSchema = z.object({
  forkId: forkIdSchema,

  status: z.enum([
    "leans_a",
    "leans_b",
    "both",
    "unresolved",
    "not_relevant",
  ]),

  interpretation: z.string(),

  evidenceRefs: z.array(z.string()),

  importance: z.enum([
    "low",
    "medium",
    "high",
  ]),

  reportWorthiness: z.boolean(),
});

export const finalFormulationSchema = z.object({
  selectedHypothesisId: z.string(),

  centralFormulation: z.string(),

  whyItFits: z.array(z.string()),

  whatItDoesNotExplain: z.array(z.string()),

  strongestAlternative: z.string(),

  unresolvedForks: z.array(forkIdSchema),
});

/** Pass6 LLM contract: when hidden is present, aim is required. */
export const hiddenPositionLlmSchema = hiddenPositionSchema.extend({
  possibleCompensatoryAim: z.string().trim().min(1),
});

export const jungianLensSchema = z.object({
  concept: z.string(),
  observedPatternItIlluminates: z.string(),
  whyUseful: z.string(),
  evidenceRefs: z.array(z.string()),
  limitsOfInterpretation: z.string(),
  confidence: z.enum(["tentative", "moderate", "strong"]),
});

export const realityCheckSchema = z.object({
  sufficientWithoutDepth: z.boolean(),
  categories: z.array(z.string()),
  narrative: z.string(),
  evidenceRefs: z.array(z.string()),
});

export const experimentSchema = z.object({
  kind: z.enum([
    "behavioral",
    "imaginal",
  ]),

  title: z.string(),

  hypothesisTested: z.string(),

  action: z.string(),

  duration: z.string(),

  whatToObserve: z.array(z.string()),

  resultSupportingHypothesis: z.string(),

  resultWeakeningHypothesis: z.string(),

  riskLevel: z.enum([
    "low",
    "moderate",
  ]),

  practicalRequirements:
    z.array(z.string()),

  competingHypothesisIds:
    z.array(z.string()).default([]),

  manipulatedVariable:
    z.string().optional(),

  heldConstant:
    z.array(z.string()).default([]),

  outcomeInterpretations:
    z.array(
      z.object({
        outcome: z.string(),
        favors: z.string(),
        because: z.string(),
      }),
    ).default([]),
});

export const reportSectionIdSchema = z.enum([
  "problem",
  "reality",
  "contradiction",
  "hidden",
  "alternative",
  "experiment",
  "jungian",
  "questions",
  "close",
]);

export const REQUIRED_PEEL_SECTION_IDS = [
  "problem",
  "reality",
  "contradiction",
  "alternative",
  "experiment",
] as const satisfies ReadonlyArray<z.infer<typeof reportSectionIdSchema>>;

export const reportSectionSchema = z.object({
  id: reportSectionIdSchema,
  title: z.string(),
  body: z.string(),
  evidenceRefs: z.array(z.string()),
});

export const reportSchema = z.object({
  assessmentId: z.string(),
  engineVersion: z.literal("engine.v2"),
  sections: z.array(reportSectionSchema),
});

export type Contradiction = z.infer<typeof contradictionSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export type ImageVote = z.infer<typeof imageVoteSchema>;
export type HiddenPosition = z.infer<typeof hiddenPositionSchema>;
export type JungianLens = z.infer<typeof jungianLensSchema>;
export type RealityCheck = z.infer<typeof realityCheckSchema>;
export type Experiment = z.infer<typeof experimentSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type Report = z.infer<typeof reportSchema>;
export type HypothesisCritique = z.infer<typeof hypothesisCritiqueSchema>;
export type ForkResolution = z.infer<typeof forkResolutionSchema>;
export type FinalFormulation = z.infer<typeof finalFormulationSchema>;