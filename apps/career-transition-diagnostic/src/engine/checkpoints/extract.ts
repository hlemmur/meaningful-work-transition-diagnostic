import type { EvidenceItem } from "../schemas/evidence";
import type { CaseState } from "../schemas/case-state";
import { emptyCaseState } from "./empty-case-state";
import type { ForkId } from "../schemas/analysis";
import { CHECKPOINT_PREFERRED_FORKS } from "./bank";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asScale(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function evidence(
  assessmentId: string,
  questionId: string,
  value: unknown,
  evidenceType: EvidenceItem["evidenceType"],
): EvidenceItem[] {
  const rawQuote = asText(value);
  if (!rawQuote) {
    return [];
  }
  return [
    {
      id: `${assessmentId}:${questionId}`,
      assessmentId,
      questionId,
      rawQuote,
      normalizedMeaning: rawQuote.slice(0, 280),
      evidenceType,
    },
  ];
}

export function extractPass1Lite(
  assessmentId: string,
  checkpoint: AdaptiveCheckpoint,
  answers: Record<string, unknown>,
  previous?: CaseState,
): CaseState {
  const next = structuredClone(previous ?? emptyCaseState(assessmentId));
  next.assessmentId = assessmentId;
  next.practicalContext.workStatus = asText(answers["Q0.1"])
    ? (asText(answers["Q0.1"]) as CaseState["practicalContext"]["workStatus"])
    : next.practicalContext.workStatus;
  next.practicalContext.professionalBackground =
    asText(answers["Q0.2"]) || next.practicalContext.professionalBackground;
  next.practicalContext.transitionDuration =
    asText(answers["Q0.3"]) || next.practicalContext.transitionDuration;
  next.practicalContext.practicalPressure =
    asScale(answers["Q0.4"]) ?? next.practicalContext.practicalPressure;
  next.practicalContext.constraints = [
    ...next.practicalContext.constraints,
    ...evidence(assessmentId, "Q0.5", answers["Q0.5"], "practical_constraint"),
  ];
  next.consciousNarrative.statedProblem = [
    ...next.consciousNarrative.statedProblem,
    ...evidence(assessmentId, "Q1.1", answers["Q1.1"], "self_interpretation"),
  ];
  next.consciousNarrative.statedCausesFreeText = [
    ...next.consciousNarrative.statedCausesFreeText,
    ...evidence(assessmentId, "Q1.3", answers["Q1.3"], "self_interpretation"),
  ];
  next.behavior.actionsTaken = [
    ...next.behavior.actionsTaken,
    ...evidence(assessmentId, "Q2.2", answers["Q2.2"], "behavior"),
  ];
  next.affect.chargeIntensity =
    asScale(answers["Q3.2"]) ?? next.affect.chargeIntensity;
  next.openForks = preferredOpenForks(checkpoint, answers);
  return next;
}

function preferredOpenForks(
  checkpoint: AdaptiveCheckpoint,
  answers: Record<string, unknown>,
): ForkId[] {
  const preferred = CHECKPOINT_PREFERRED_FORKS[checkpoint] ?? [];
  if (asText(answers["Q1.3"]) && asText(answers["Q2.2"])) {
    return preferred;
  }
  return preferred;
}
