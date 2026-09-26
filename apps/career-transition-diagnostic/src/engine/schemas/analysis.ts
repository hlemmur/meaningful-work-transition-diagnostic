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

export const groundedSymbolicObservationSchema = z.object({
  text: z.string().trim().min(1),
  evidenceRefs: z.array(z.string()).min(1),
});

export const plausibleSymbolicReadingSchema = z.object({
  interpretation: z.string().trim().min(1),
  supportsHypothesisIds: z.array(z.string()).default([]),
  weakensHypothesisIds: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).min(1),
});

export const symbolicImageAnalysisSchema = z.object({
  literalFacts: z.array(groundedSymbolicObservationSchema).default([]),
  personalAssociations: z.array(groundedSymbolicObservationSchema).default([]),
  plausibleReadings: z.array(plausibleSymbolicReadingSchema).default([]),
  unresolvedSymbolicQuestion: z.string().trim().min(1).optional(),
});

export const projectionInterpretationSchema = z
  .object({
    projectionEvidenceRefs: z.array(z.string()).min(1),
    possibleDisownedValue: z.string().trim().min(1).optional(),
    literalEnactmentRisk: z.string().trim().min(1).optional(),
    matureExpression: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.possibleDisownedValue &&
      !value.literalEnactmentRisk &&
      !value.matureExpression
    ) {
      ctx.addIssue({
        code: "custom",
        message: "A projection interpretation must add at least one tentative interpretive field",
      });
    }
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

export const maintenanceMechanismSchema = z.object({
  trigger: z.string().trim().min(1),
  response: z.string().trim().min(1),
  shortTermFunction: z.string().trim().min(1),
  longTermCost: z.string().trim().min(1),
  reinforcingConsequence: z.string().trim().min(1),
});

export const developmentalFormulationSchema = z
  .object({
    consciousPole: z.string().trim().min(1),
    compensatingPole: z.string().trim().min(1),
    coreOpposition: z.string().trim().min(1),
    possibleDevelopmentalTask: z.string().trim().min(1),
    possibleThird: z.string().trim().min(1).optional(),
    uncertainty: z.string().trim().min(1),
    evidenceRefs: z.array(z.string()).min(2),
  })
  .superRefine((value, ctx) => {
    const domains = new Set(
      value.evidenceRefs.flatMap((ref) => {
        const match = ref.match(/:Q(\d+)(?:\.|$)/);
        return match ? [match[1]] : [];
      }),
    );
    if (domains.size < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceRefs"],
        message: "developmentalFormulation requires evidence from at least two questionnaire domains",
      });
    }
  });

export const maintainingLoopSchema = z
  .object({
    goal: z.string().trim().min(1),
    trigger: z.string().trim().min(1),
    response: z.string().trim().min(1),
    payoff: z.string().trim().min(1),
    cost: z.string().trim().min(1),
    selfConfirmingResult: z.string().trim().min(1),
    evidenceRefs: z.array(z.string()).min(2),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.evidenceRefs).size < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceRefs"],
        message: "maintainingLoop requires at least two distinct evidence refs",
      });
    }
    const steps = [
      value.goal,
      value.trigger,
      value.response,
      value.payoff,
      value.cost,
      value.selfConfirmingResult,
    ].map((item) => item.toLocaleLowerCase().replace(/\W+/g, " ").trim());
    if (new Set(steps).size < 4) {
      ctx.addIssue({
        code: "custom",
        message: "maintainingLoop must describe distinct steps rather than repeat one circular statement",
      });
    }
  });

export const layerRelationshipSchema = z.object({
  mode: z.enum([
    "practical_primary",
    "psychological_primary",
    "layered",
    "unresolved",
  ]),
  practicalHypothesisIds: z.array(z.string()),
  psychologicalHypothesisIds: z.array(z.string()),
  relationship: z.string().trim().min(1),
  uncertainty: z.string().trim().min(1),
  evidenceRefs: z.array(z.string()),
});

export const currentFinalFormulationSchema = z.object({
  selectedHypothesisId: z.string(),

  maintenanceFormulation: z.string().trim().min(1),

  maintenanceMechanism: maintenanceMechanismSchema,

  maintainingLoop: maintainingLoopSchema.optional(),

  developmentalFormulation: developmentalFormulationSchema.optional(),

  layerRelationship: layerRelationshipSchema.optional(),

  whyItFits: z.array(z.string()),

  whatItDoesNotExplain: z.array(z.string()),

  strongestAlternative: z.string(),

  unresolvedForks: z.array(forkIdSchema),
});

const LEGACY_NOT_RECORDED = "Not recorded in the legacy formulation.";

/** Accept persisted engine.v2 formulations and normalize them to the current shape. */
export const finalFormulationSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object") {
    return input;
  }
  const value = input as Record<string, unknown>;
  if (typeof value.maintenanceFormulation === "string") {
    return value;
  }
  if (typeof value.centralFormulation !== "string") {
    return value;
  }
  return {
    ...value,
    maintenanceFormulation: value.centralFormulation,
    maintenanceMechanism: {
      trigger: LEGACY_NOT_RECORDED,
      response: value.centralFormulation,
      shortTermFunction: LEGACY_NOT_RECORDED,
      longTermCost: LEGACY_NOT_RECORDED,
      reinforcingConsequence: LEGACY_NOT_RECORDED,
    },
    centralFormulation: undefined,
  };
}, currentFinalFormulationSchema);

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

export const processDimensionSchema = z.enum([
  "self_initiation",
  "ambiguity",
  "external_structure",
  "visibility",
  "evaluation",
  "identity_stakes",
  "commercial_exchange",
  "perfectionism",
  "dependency",
  "uncertainty",
  "sustained_repetition",
  "resource_constraint",
]);

export const layerUpdateSchema = z.object({
  layer: z.enum(["practical", "psychological", "developmental"]),
  ifObserved: z.string().trim().min(1),
  effect: z.enum([
    "strengthens",
    "weakens",
    "unchanged",
    "inconclusive",
    "new_unknown",
  ]),
  implication: z.string().trim().min(1),
});

export const experimentSchema = z.object({
  kind: z.enum([
    "behavioral",
    "imaginal",
    "integrated",
  ]),

  title: z.string(),

  strategy: z
    .enum(["direct", "analogue", "contrast", "symbolic_only"])
    .optional(),

  targetPattern: z.string().trim().min(1).optional(),

  practicalCondition: z
    .object({
      factor: z.string().trim().min(1),
      currentState: z.string().trim().min(1),
      temporaryChange: z.string().trim().min(1),
      whyThisFactor: z.string().trim().min(1),
      processDimensions: z.array(processDimensionSchema).min(1),
      sharedDimensions: z.array(processDimensionSchema).default([]),
      sourceRef: z.string().trim().min(1).optional(),
    })
    .optional(),

  action: z.string(),

  duration: z.string(),

  observe: z
    .object({
      whatBecomesEasier: z.string().trim().min(1),
      whatRemainsDifficult: z.string().trim().min(1),
      whatChangesForm: z.string().trim().min(1),
      unexpectedMaterial: z.string().trim().min(1),
    })
    .optional(),

  deepen: z
    .object({
      mode: z.enum(["image", "affect", "projection"]),
      sourceRef: z.string().trim().min(1),
      prompt: z.string().trim().min(1),
      stopInstruction: z.string().trim().min(1),
    })
    .optional(),

  bridge: z
    .object({
      invitation: z.string().trim().min(1),
    })
    .optional(),

  learningAim: z.string().trim().min(1).optional(),

  layerUpdates: z.array(layerUpdateSchema).optional().default([]),

  // Legacy discrimination fields — optional for saved analyses; not the customer purpose.
  hypothesisTested: z.string().optional(),

  whatToObserve: z.array(z.string()).default([]),

  resultSupportingHypothesis: z.string().default(""),

  resultWeakeningHypothesis: z.string().default(""),

  riskLevel: z.enum([
    "low",
    "moderate",
  ]),

  practicalRequirements:
    z.array(z.string()).default([]),

  competingHypothesisIds:
    z.array(z.string()).default([]),

  manipulatedVariable:
    z.string().trim().min(1).optional(),

  heldConstant:
    z.array(z.string().trim().min(1)).default([]),

  outcomeInterpretations:
    z.array(
      z.object({
        outcome: z.string().trim().min(1),
        favors: z.string().trim().min(1),
        because: z.string().trim().min(1),
        layerUpdates: z.array(
          z.object({
            layer: z.enum(["practical", "psychological", "developmental"]),
            effect: z.enum([
              "strengthens",
              "weakens",
              "unchanged",
              "inconclusive",
              "new_unknown",
            ]),
          }),
        ).optional(),
      }),
    ).default([]),

  sessionMinutes: z.number().int().positive().max(180).optional(),

  audienceCount: z.number().int().nonnegative().max(20).optional(),

  exposure: z.enum(["private", "trusted", "public"]).optional(),

  reversible: z.boolean().optional(),

  largerActionJustification: z.string().trim().min(1).optional(),
});

export const reportSectionIdSchema = z.enum([
  "problem",
  "reality",
  "contradiction",
  "hidden",
  "developmental",
  "alternative",
  "experiment",
  "jungian",
  "questions",
  "close",
]);

export const unresolvedQuestionIntentSchema = z.object({
  question: z.string().trim().min(1),
  targetUncertainty: z.string().trim().min(1),
  relatedHypothesisId: z.string().trim().min(1).optional(),
  relatedForkId: forkIdSchema.optional(),
  couldWeakenSelectedFormulation: z.boolean(),
  couldInvalidateWholeFormulation: z.boolean().optional(),
});

export const REQUIRED_PEEL_SECTION_IDS = [
  "problem",
  "reality",
  "contradiction",
  "alternative",
  "experiment",
  "questions",
  "close",
] as const satisfies ReadonlyArray<
  z.infer<typeof reportSectionIdSchema>
>;

export const reportSectionSchema = z.object({
  id: reportSectionIdSchema,
  title: z.string(),
  body: z.string(),
  evidenceRefs: z.array(z.string()),
  // Optional at the durable report boundary for legacy engine.v2 reports.
  questionIntents: z.array(unresolvedQuestionIntentSchema).optional(),
});

export const reportSchema = z.object({
  assessmentId: z.string(),
  engineVersion: z.literal("engine.v2"),
  sections: z.array(reportSectionSchema),
});

export type Contradiction = z.infer<typeof contradictionSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export type ImageVote = z.infer<typeof imageVoteSchema>;
export type SymbolicImageAnalysis = z.infer<typeof symbolicImageAnalysisSchema>;
export type ProjectionInterpretation = z.infer<typeof projectionInterpretationSchema>;
export type HiddenPosition = z.infer<typeof hiddenPositionSchema>;
export type JungianLens = z.infer<typeof jungianLensSchema>;
export type RealityCheck = z.infer<typeof realityCheckSchema>;
export type Experiment = Omit<
  z.infer<typeof experimentSchema>,
  "layerUpdates" | "whatToObserve" | "resultSupportingHypothesis" | "resultWeakeningHypothesis" | "practicalRequirements" | "competingHypothesisIds" | "heldConstant" | "outcomeInterpretations"
> & {
  layerUpdates?: z.infer<typeof layerUpdateSchema>[];
  whatToObserve?: string[];
  resultSupportingHypothesis?: string;
  resultWeakeningHypothesis?: string;
  practicalRequirements?: string[];
  competingHypothesisIds?: string[];
  heldConstant?: string[];
  outcomeInterpretations?: z.infer<typeof experimentSchema>["outcomeInterpretations"];
};
export type ProcessDimension = z.infer<typeof processDimensionSchema>;
export type LayerUpdate = z.infer<typeof layerUpdateSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type Report = z.infer<typeof reportSchema>;
export type HypothesisCritique = z.infer<typeof hypothesisCritiqueSchema>;
export type ForkResolution = z.infer<typeof forkResolutionSchema>;
export type FinalFormulation = z.infer<typeof finalFormulationSchema>;
