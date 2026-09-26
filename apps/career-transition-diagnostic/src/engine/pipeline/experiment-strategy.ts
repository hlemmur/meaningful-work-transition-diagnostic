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
  /\bwhen\b[\s\S]{0,160}\b(?:changed|change[sd]?)\b[\s\S]{0,160}\b(?:became|becomes)\s+easier\b[\s\S]{0,160}\bremain(?:ed|s)?\b/i;

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
