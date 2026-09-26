import type { CaseState } from "@/engine/schemas/case-state";
import type { Experiment, ProcessDimension } from "@/engine/schemas/analysis";

export const PROCESS_DIMENSIONS = [
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
] as const satisfies ReadonlyArray<ProcessDimension>;

export type ExperimentStrategy = NonNullable<Experiment["strategy"]>;

export type StrategyDecisionInput = {
  parallelPatterns: CaseState["parallelPatterns"];
  /** High freeze/shame/terror/avoidance on the core next action. */
  coreChargeHigh: boolean;
  /** Client indicated the core step is already overwhelming. */
  coreOverwhelming: boolean;
  /** Live question is where capacity already lives. */
  liveQuestionIsCapacityLocation: boolean;
  sharedDimensions: ProcessDimension[];
  /** Analogue is same domain at same stakes (not eligible). */
  analogueSameDomainSameStakes?: boolean;
  /** Behavioral step inappropriate; supplied image exists. */
  symbolicOnly?: boolean;
};

export function hasSuppliedAnalogue(patterns: CaseState["parallelPatterns"]) {
  return Boolean(
    patterns.lowerStakesExample?.trim() || patterns.similarStrugglesElsewhere?.trim(),
  );
}

export function hasSuppliedContrast(patterns: CaseState["parallelPatterns"]) {
  return Boolean(patterns.oppositeOrEasyExample?.trim());
}

export function analogueEligible(input: StrategyDecisionInput) {
  return (
    hasSuppliedAnalogue(input.parallelPatterns) &&
    input.coreChargeHigh &&
    input.sharedDimensions.length >= 1 &&
    !input.analogueSameDomainSameStakes
  );
}

export function contrastEligible(input: StrategyDecisionInput) {
  return hasSuppliedContrast(input.parallelPatterns) && input.sharedDimensions.length >= 1;
}

/**
 * Deterministic strategy preference shared by gates and eval.
 * Does not invent analogues/contrasts; empty parallel fields → direct (or symbolic_only).
 */
export function selectExperimentStrategy(
  input: StrategyDecisionInput,
): ExperimentStrategy {
  if (input.symbolicOnly) {
    return "symbolic_only";
  }

  const analogue = analogueEligible(input);
  const contrast = contrastEligible(input);

  if (analogue && (input.coreOverwhelming || input.coreChargeHigh)) {
    return "analogue";
  }
  if (contrast && input.liveQuestionIsCapacityLocation) {
    return "contrast";
  }
  return "direct";
}

const LEARNING_AIM =
  /\bwhen\b[\s\S]{0,240}(?:\b(?:changed|change[sd]?|altered|reduced|removed|held|shifted|softened)\b|was\s+(?:held|removed|reduced|altered|changed|set\s+aside)|were\s+(?:held|removed|reduced|altered|changed))[\s\S]{0,200}\b(?:became|becomes)\s+easier\b[\s\S]{0,200}\b(?:while\s+)?[\s\S]{0,120}\bremain(?:ed|s)?\b/i;

export function matchesLearningAimShape(text: string) {
  return LEARNING_AIM.test(text.trim());
}

const WINNER_IMPLICATION =
  /\bproves\b|isolates the real cause|therefore primary|central leverage point|\bwins\b|rules out|the real cause|\bdeclares? a winner\b|\bas the winner\b/i;

export function hasWinnerImplication(text: string) {
  return WINNER_IMPLICATION.test(text);
}

export function q4SourceRefs(assessmentId: string) {
  return [
    `${assessmentId}:Q4.10`,
    `${assessmentId}:Q4.11`,
    `${assessmentId}:Q4.12`,
  ] as const;
}

export function isQ4ParallelRef(ref: string, assessmentId: string) {
  return q4SourceRefs(assessmentId).includes(
    ref as `${string}:Q4.10` | `${string}:Q4.11` | `${string}:Q4.12`,
  );
}

/**
 * When the model chooses analogue/contrast but omits practicalCondition.sourceRef,
 * attach the matching Q4.10–Q4.12 ref already present on parallelPatterns.
 */
export function coerceParallelSourceRef<T extends Experiment>(
  experiment: T,
  state: Pick<CaseState, "assessmentId" | "parallelPatterns">,
): T {
  const strategy = experiment.strategy;
  if (strategy !== "analogue" && strategy !== "contrast") {
    return experiment;
  }
  const condition = experiment.practicalCondition;
  if (!condition || typeof condition !== "object") {
    return experiment;
  }
  const existing =
    typeof condition.sourceRef === "string" ? condition.sourceRef.trim() : "";
  if (existing && isQ4ParallelRef(existing, state.assessmentId)) {
    return experiment;
  }

  const refs = new Set(state.parallelPatterns.evidenceRefs ?? []);
  const prefer =
    strategy === "contrast"
      ? [`${state.assessmentId}:Q4.12`]
      : [
          state.parallelPatterns.lowerStakesExample?.trim()
            ? `${state.assessmentId}:Q4.11`
            : "",
          state.parallelPatterns.similarStrugglesElsewhere?.trim()
            ? `${state.assessmentId}:Q4.10`
            : "",
        ].filter(Boolean);

  const sourceRef = prefer.find((ref) => refs.has(ref));
  if (!sourceRef) {
    return experiment;
  }

  return {
    ...experiment,
    practicalCondition: {
      ...condition,
      sourceRef,
    },
  };
}
