import type { EvidenceItem, ProjectionItem } from "../schemas/evidence";
import type { CaseState } from "../schemas/case-state";
import { emptyCaseState } from "./empty-case-state";
import type { ForkId } from "../schemas/analysis";
import { CHECKPOINT_PREFERRED_FORKS } from "./bank";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";

function asText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function asScale(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringifyValue(value: unknown): string {
  const direct = asText(value);
  if (direct) {
    return direct;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          if (typeof record.action === "string") {
            return record.action.trim();
          }
          return JSON.stringify(item);
        }
        return asText(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return "";
}

function evidence(
  assessmentId: string,
  questionId: string,
  value: unknown,
  evidenceType: EvidenceItem["evidenceType"],
): EvidenceItem[] {
  const rawQuote = stringifyValue(value);
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

function upsertEvidence(existing: EvidenceItem[], added: EvidenceItem[]) {
  if (!added.length) {
    return existing;
  }
  const replacing = new Set(added.map((item) => item.questionId));
  return [...existing.filter((item) => !replacing.has(item.questionId)), ...added];
}

function projectionFromText(
  assessmentId: string,
  questionId: string,
  figure: string,
  extras: Partial<ProjectionItem> = {},
): ProjectionItem | null {
  const trimmed = figure.trim();
  if (!trimmed) {
    return null;
  }
  return {
    id: `${assessmentId}:${questionId}:${trimmed.slice(0, 40)}`,
    figure: trimmed,
    evidenceRefs: [`${assessmentId}:${questionId}`],
    ...extras,
  };
}

function projectionsFromAnswer(
  assessmentId: string,
  questionId: string,
  value: unknown,
): ProjectionItem[] {
  const items: ProjectionItem[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = typeof entry === "string" ? entry : stringifyValue(entry);
      const item = projectionFromText(assessmentId, questionId, text);
      if (item) {
        items.push(item);
      }
    }
    return items;
  }
  const text = stringifyValue(value);
  if (!text) {
    return [];
  }
  // Split numbered lists (1. / 2. / 3.) when present.
  const chunks = text.split(/\n(?=\d+\.\s)/).map((part) => part.trim()).filter(Boolean);
  for (const chunk of chunks.length > 1 ? chunks : [text]) {
    const item = projectionFromText(assessmentId, questionId, chunk);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

function avoidedFromAnswer(value: unknown) {
  if (!Array.isArray(value)) {
    const text = stringifyValue(value);
    return text ? [{ action: text }] : [];
  }
  return value
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { action: item.trim() };
      }
      if (item && typeof item === "object" && typeof (item as { action?: unknown }).action === "string") {
        const action = (item as { action: string }).action.trim();
        return action ? { action } : null;
      }
      return null;
    })
    .filter((item): item is { action: string } => Boolean(item));
}

/**
 * Mid-form checkpoint extraction (Pass 1-lite). Intentionally thin.
 */
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
  next.practicalContext.constraints = upsertEvidence(
    next.practicalContext.constraints,
    evidence(assessmentId, "Q0.5", answers["Q0.5"], "practical_constraint"),
  );
  next.consciousNarrative.statedProblem = upsertEvidence(
    next.consciousNarrative.statedProblem,
    evidence(assessmentId, "Q1.1", answers["Q1.1"], "self_interpretation"),
  );
  next.consciousNarrative.statedCausesFreeText = upsertEvidence(
    next.consciousNarrative.statedCausesFreeText,
    evidence(assessmentId, "Q1.3", answers["Q1.3"], "self_interpretation"),
  );
  next.behavior.actionsTaken = upsertEvidence(
    next.behavior.actionsTaken,
    evidence(assessmentId, "Q2.2", answers["Q2.2"], "behavior"),
  );
  next.affect.chargeIntensity =
    asScale(answers["Q3.2"]) ?? next.affect.chargeIntensity;
  next.openForks = preferredOpenForks(checkpoint, answers);
  return next;
}

/**
 * Post-submit full CaseState fill from answered questionnaire sections.
 */
export function extractCaseStateFull(
  assessmentId: string,
  answers: Record<string, unknown>,
  previous?: CaseState,
): CaseState {
  const next = extractPass1Lite(assessmentId, "D", answers, previous);

  next.practicalContext.pressureSources = upsertEvidence(
    next.practicalContext.pressureSources,
    evidence(assessmentId, "Q0.4b", answers["Q0.4b"], "practical_constraint"),
  );

  next.consciousNarrative.desiredFuture = upsertEvidence(
    next.consciousNarrative.desiredFuture,
    evidence(assessmentId, "Q1.2", answers["Q1.2"], "fantasy"),
  );
  next.consciousNarrative.readinessConditions = upsertEvidence(
    next.consciousNarrative.readinessConditions,
    evidence(assessmentId, "Q1.5", answers["Q1.5"], "self_interpretation"),
  );
  next.consciousNarrative.nextActionIfObstaclesVanished = upsertEvidence(
    next.consciousNarrative.nextActionIfObstaclesVanished,
    evidence(assessmentId, "Q1.4", answers["Q1.4"], "behavior"),
  );

  next.behavior.firstKnowing = upsertEvidence(
    next.behavior.firstKnowing,
    evidence(assessmentId, "Q2.1", answers["Q2.1"], "history"),
  );
  const avoided = avoidedFromAnswer(answers["Q2.3"]);
  if (avoided.length) {
    next.behavior.avoidedActions = avoided;
  }
  const focal = asText(answers["Q2.4"]) || asText(answers["Q2.4F"]);
  if (focal) {
    next.behavior.focalStimulus = focal;
    next.behavior.focalStimulusKind = asText(answers["Q2.4"])
      ? "primary_avoided"
      : "focal_fallback";
  }
  next.behavior.whatChanged = upsertEvidence(
    next.behavior.whatChanged,
    evidence(assessmentId, "Q2.5a", answers["Q2.5a"], "behavior"),
  );
  next.behavior.whatDidNotChange = upsertEvidence(
    next.behavior.whatDidNotChange,
    evidence(assessmentId, "Q2.5b", answers["Q2.5b"], "behavior"),
  );
  next.behavior.temporaryEase = upsertEvidence(
    next.behavior.temporaryEase ?? [],
    evidence(assessmentId, "Q2.6b", answers["Q2.6b"], "history"),
  );

  next.affect.innerResponse = upsertEvidence(
    next.affect.innerResponse,
    evidence(assessmentId, "Q3.1", answers["Q3.1"], "emotion"),
  );
  next.affect.emotions = upsertEvidence(
    next.affect.emotions,
    evidence(assessmentId, "Q3.3", answers["Q3.3"], "emotion"),
  );
  next.affect.bodyResponses = upsertEvidence(
    next.affect.bodyResponses,
    evidence(assessmentId, "Q3.3S", answers["Q3.3S"], "emotion"),
  );
  next.affect.firstThought = upsertEvidence(
    next.affect.firstThought,
    evidence(assessmentId, "Q3.4", answers["Q3.4"], "self_interpretation"),
  );
  next.affect.fearedOutcomes = upsertEvidence(
    next.affect.fearedOutcomes,
    evidence(assessmentId, "Q3.7", answers["Q3.7"], "emotion"),
  );
  next.affect.identityMeanings = upsertEvidence(
    next.affect.identityMeanings,
    evidence(assessmentId, "Q3.8", answers["Q3.8"], "identity_claim"),
  );
  next.affect.impulseAfterFearedOutcome = upsertEvidence(
    next.affect.impulseAfterFearedOutcome,
    evidence(assessmentId, "Q3.10", answers["Q3.10"], "behavior"),
  );
  const intensity = Math.max(
    asScale(answers["Q3.2"]) ?? 0,
    asScale(answers["Q3.3"]) ?? 0,
  );
  if (intensity > 0) {
    next.affect.chargeIntensity = intensity;
  }

  const watchers = projectionsFromAnswer(assessmentId, "Q3.5", answers["Q3.5"]);
  if (watchers.length) {
    next.gaze.imaginedWatchers = watchers;
  }
  next.gaze.imaginedJudgments = upsertEvidence(
    next.gaze.imaginedJudgments,
    evidence(assessmentId, "Q3.6", answers["Q3.6"], "projection"),
  );

  next.history.identityConclusionRecurrence = upsertEvidence(
    next.history.identityConclusionRecurrence,
    evidence(assessmentId, "Q4.1", answers["Q4.1"], "history"),
  );
  next.history.evidenceAbsorption = upsertEvidence(
    next.history.evidenceAbsorption,
    evidence(assessmentId, "Q4.2b", answers["Q4.2b"], "history"),
  );
  next.history.bestFunctioningPeriods = upsertEvidence(
    next.history.bestFunctioningPeriods,
    evidence(assessmentId, "Q4.3", answers["Q4.3"], "history"),
  );
  next.history.supportiveStructures = upsertEvidence(
    next.history.supportiveStructures,
    evidence(assessmentId, "Q4.4", answers["Q4.4"], "history"),
  );
  next.history.missingStructures = upsertEvidence(
    next.history.missingStructures,
    evidence(assessmentId, "Q4.5", answers["Q4.5"], "history"),
  );
  next.history.expectedInternalProvision = upsertEvidence(
    next.history.expectedInternalProvision,
    evidence(assessmentId, "Q4.6", answers["Q4.6"], "history"),
  );
  next.history.functionWithoutAudience = upsertEvidence(
    next.history.functionWithoutAudience,
    evidence(assessmentId, "Q4.7", answers["Q4.7"], "behavior"),
  );
  next.history.functionWithAccountability = upsertEvidence(
    next.history.functionWithAccountability,
    evidence(assessmentId, "Q4.8", answers["Q4.8"], "behavior"),
  );
  next.history.legitimacyLoop = upsertEvidence(
    next.history.legitimacyLoop,
    evidence(assessmentId, "QB.1", answers["QB.1"], "self_interpretation"),
  );

  const admired = projectionsFromAnswer(assessmentId, "Q5.1", answers["Q5.1"]);
  if (admired.length) {
    const wanted = asText(answers["Q5.2"]);
    const forbidden = asText(answers["Q5.3"]);
    const tuesday = asText(answers["Q5.4"]);
    const unknown = asText(answers["Q5.5"]);
    next.projections.admiredFigures = admired.map((item) => ({
      ...item,
      wantedQuality: wanted || item.wantedQuality,
      forbiddenQuality: forbidden || item.forbiddenQuality,
      imaginedTuesday: tuesday || item.imaginedTuesday,
      unknownMachinery: unknown || item.unknownMachinery,
    }));
  }

  const rejected = projectionsFromAnswer(assessmentId, "Q6.1", answers["Q6.1"]);
  if (rejected.length) {
    const judged = asText(answers["Q6.2"]);
    const unbearable = asText(answers["Q6.3"]);
    const usefulness = asText(answers["Q6.4"]);
    next.projections.rejectedFigures = rejected.map((item) => ({
      ...item,
      judgedQuality: judged || item.judgedQuality,
      unbearableIdentification: unbearable || item.unbearableIdentification,
      secretUsefulness: usefulness || item.secretUsefulness,
    }));
  }

  next.futureFantasy.desiredTuesday = upsertEvidence(
    next.futureFantasy.desiredTuesday,
    evidence(assessmentId, "Q7.1", answers["Q7.1"], "fantasy"),
  );
  next.futureFantasy.aliveness = upsertEvidence(
    next.futureFantasy.aliveness,
    evidence(assessmentId, "Q7.2", answers["Q7.2"], "fantasy"),
  );
  next.futureFantasy.moneyActivities = upsertEvidence(
    next.futureFantasy.moneyActivities,
    evidence(assessmentId, "Q7.3", answers["Q7.3"], "fantasy"),
  );
  next.futureFantasy.mundaneReality = upsertEvidence(
    next.futureFantasy.mundaneReality,
    evidence(assessmentId, "Q7.4", answers["Q7.4"], "fantasy"),
  );
  next.futureFantasy.identityWithoutWork = upsertEvidence(
    next.futureFantasy.identityWithoutWork,
    evidence(assessmentId, "Q7.5", answers["Q7.5"], "fantasy"),
  );
  next.futureFantasy.continueDespiteDifficulty = upsertEvidence(
    next.futureFantasy.continueDespiteDifficulty,
    evidence(assessmentId, "Q7.7", answers["Q7.7"], "fantasy"),
  );
  next.futureFantasy.wrongVsDifficult = upsertEvidence(
    next.futureFantasy.wrongVsDifficult,
    evidence(assessmentId, "Q7.8", answers["Q7.8"], "fantasy"),
  );
  next.futureFantasy.jobShapeChange = upsertEvidence(
    next.futureFantasy.jobShapeChange,
    evidence(assessmentId, "Q7.9", answers["Q7.9"], "fantasy"),
  );

  next.money.beliefs = upsertEvidence(
    next.money.beliefs,
    evidence(assessmentId, "Q8.1", answers["Q8.1"], "self_interpretation"),
  );
  next.money.easyMoneyHistory = upsertEvidence(
    next.money.easyMoneyHistory,
    evidence(assessmentId, "Q8.2", answers["Q8.2"], "history"),
  );
  next.money.economicStructures = upsertEvidence(
    next.money.economicStructures,
    evidence(assessmentId, "Q8.3", answers["Q8.3"], "history"),
  );
  next.money.invisibleMachinery = upsertEvidence(
    next.money.invisibleMachinery,
    evidence(assessmentId, "Q8.4", answers["Q8.4"], "history"),
  );
  next.money.hardMoneyHistory = upsertEvidence(
    next.money.hardMoneyHistory,
    evidence(assessmentId, "Q8.5", answers["Q8.5"], "history"),
  );
  next.money.backgroundIncome = upsertEvidence(
    next.money.backgroundIncome,
    evidence(assessmentId, "Q8.6", answers["Q8.6"], "practical_constraint"),
  );
  next.money.effortFairness = upsertEvidence(
    next.money.effortFairness,
    evidence(assessmentId, "Q8.7", answers["Q8.7"], "self_interpretation"),
  );
  next.money.refusedWellPaidWork = upsertEvidence(
    next.money.refusedWellPaidWork,
    evidence(assessmentId, "Q8.8", answers["Q8.8"], "behavior"),
  );
  next.money.continuePoorlyPaidWork = upsertEvidence(
    next.money.continuePoorlyPaidWork,
    evidence(assessmentId, "Q8.9", answers["Q8.9"], "behavior"),
  );

  next.hiddenBargain.costsOfStaying = upsertEvidence(
    next.hiddenBargain.costsOfStaying,
    evidence(assessmentId, "Q9.1", answers["Q9.1"], "self_interpretation"),
  );
  next.hiddenBargain.benefitsOfStaying = upsertEvidence(
    next.hiddenBargain.benefitsOfStaying,
    evidence(assessmentId, "Q9.2", answers["Q9.2"], "self_interpretation"),
  );
  next.hiddenBargain.protectAndThreaten = upsertEvidence(
    next.hiddenBargain.protectAndThreaten,
    evidence(assessmentId, "Q9.3", answers["Q9.3"], "self_interpretation"),
  );
  next.hiddenBargain.giveUpIfReal = upsertEvidence(
    next.hiddenBargain.giveUpIfReal,
    evidence(assessmentId, "Q9.4", answers["Q9.4"], "self_interpretation"),
  );
  next.hiddenBargain.responsibilityOfSuccess = upsertEvidence(
    next.hiddenBargain.responsibilityOfSuccess,
    evidence(assessmentId, "Q9.5", answers["Q9.5"], "self_interpretation"),
  );
  next.hiddenBargain.knowledgeForcedByFailure = upsertEvidence(
    next.hiddenBargain.knowledgeForcedByFailure,
    evidence(assessmentId, "Q9.6", answers["Q9.6"], "self_interpretation"),
  );
  next.hiddenBargain.developmentalAsk = upsertEvidence(
    next.hiddenBargain.developmentalAsk,
    evidence(assessmentId, "Q9.7", answers["Q9.7"], "developmental_ask"),
  );

  next.symbolicMaterial = {
    scene: asText(answers["Q10.1"]) || next.symbolicMaterial.scene,
    surroundings: asText(answers["Q10.2"]) || next.symbolicMaterial.surroundings,
    ahead: asText(answers["Q10.3"]) || next.symbolicMaterial.ahead,
    obstacle: asText(answers["Q10.4"]) || next.symbolicMaterial.obstacle,
    figures: asText(answers["Q10.5"])
      ? [asText(answers["Q10.5"])]
      : next.symbolicMaterial.figures,
    obstacleSpeech: asText(answers["Q10.6"]) || next.symbolicMaterial.obstacleSpeech,
    obstacleWant: asText(answers["Q10.7"]) || next.symbolicMaterial.obstacleWant,
    ifNotRemoved: asText(answers["Q10.8"]) || next.symbolicMaterial.ifNotRemoved,
  };

  next.userFinalReflection = {
    surprise: asText(answers["Q11.1"]) || next.userFinalReflection.surprise,
    explanationShift: asText(answers["Q11.2"]) || next.userFinalReflection.explanationShift,
    requestedInsight: asText(answers["Q11.3"]) || next.userFinalReflection.requestedInsight,
  };

  return next;
}

function preferredOpenForks(
  checkpoint: AdaptiveCheckpoint,
  answers: Record<string, unknown>,
): ForkId[] {
  const preferred = CHECKPOINT_PREFERRED_FORKS[checkpoint] ?? [];
  if (checkpoint === "A" && !(asText(answers["Q1.3"]) && asText(answers["Q2.2"]))) {
    return preferred.filter((fork) => fork !== "history_vs_stated_cause");
  }
  return preferred;
}
