import type { CaseState } from "@/engine/schemas/case-state";

export type EvidenceKind =
  | "self_theory"
  | "behavior_history"
  | "affect"
  | "projection"
  | "symbol"
  | "enactment"
  | "practical_biological";

export type BodyStatus = "grounded" | "explicitly_unavailable" | "not_warranted" | "missing";

export type WarrantMode = "warranted" | "unresolved" | "not_warranted";

const KIND_ORDER: EvidenceKind[] = [
  "self_theory",
  "behavior_history",
  "affect",
  "projection",
  "symbol",
  "enactment",
  "practical_biological",
];

const DEPTH_CATEGORIES = new Set([
  "psychological",
  "identity",
  "developmental",
  "structural",
]);

const PRACTICAL_CATEGORIES = new Set([
  "practical",
  "economic",
  "occupational",
  "environmental",
]);

const MANUFACTURED_THIRD =
  /integrate both|balance both|\bbalance\b|\bcompromise\b|split the difference/i;

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
}

function selectedHypothesis(state: CaseState) {
  const id = state.finalFormulation?.selectedHypothesisId;
  return state.hypotheses.find((item) => item.id === id);
}

function tokens(value: string) {
  return value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

export function classifyEvidenceKinds(state: CaseState): EvidenceKind[] {
  const kinds = new Set<EvidenceKind>();
  if (
    state.consciousNarrative.statedCausesFreeText.length > 0 ||
    state.consciousNarrative.consciousExplanationTags.length > 0 ||
    hasText(state.userFinalReflection.explanationShift)
  ) {
    kinds.add("self_theory");
  }
  if (
    state.behavior.actionsTaken.length > 0 ||
    state.behavior.avoidedActions.length > 0 ||
    state.history.earlierOccurrences.length > 0 ||
    state.history.supportiveStructures.length > 0
  ) {
    kinds.add("behavior_history");
  }
  if (state.affect.emotions.length > 0) {
    kinds.add("affect");
  }
  if (
    state.projections.admiredFigures.length > 0 ||
    state.projections.rejectedFigures.length > 0 ||
    state.projectionInterpretations.length > 0
  ) {
    kinds.add("projection");
  }
  const symbolicValues = Object.values(state.symbolicMaterial).some((value) =>
    Array.isArray(value) ? value.some((item) => item.trim()) : hasText(value),
  );
  if (symbolicValues || (state.imageAnalysis?.literalFacts.length ?? 0) > 0) {
    kinds.add("symbol");
  }
  if (
    state.history.functionWithAccountability.length > 0 ||
    state.history.legitimacyLoop.length > 0
  ) {
    kinds.add("enactment");
  }
  if (
    state.practicalContext.constraints.length > 0 ||
    state.practicalContext.pressureSources.length > 0 ||
    state.hypotheses.some((item) => PRACTICAL_CATEGORIES.has(item.category))
  ) {
    kinds.add("practical_biological");
  }
  return KIND_ORDER.filter((kind) => kinds.has(kind));
}

function warrantParts(state: CaseState) {
  const kinds = classifyEvidenceKinds(state);
  const independent = kinds.filter((kind) => kind !== "self_theory");
  const eligible = kinds.length >= 2 && independent.length >= 1;
  const selected = selectedHypothesis(state);
  const trigger = state.finalFormulation?.maintenanceMechanism.trigger.trim() ?? "";
  const hasTrigger = trigger.length > 0 && trigger !== "Not recorded in the legacy formulation.";
  const hasEmotion = state.affect.emotions.length > 0;
  const hasTension = Boolean(
    state.hiddenPosition?.developmentalTension.poleA.trim() &&
      state.hiddenPosition.developmentalTension.poleB.trim(),
  );
  const acceptedDepth = Boolean(selected && DEPTH_CATEGORIES.has(selected.category));
  const anyDepth = state.hypotheses.some((item) => DEPTH_CATEGORIES.has(item.category));
  const practicalPrimary = Boolean(
    state.realityCheck?.sufficientWithoutDepth &&
      selected &&
      PRACTICAL_CATEGORIES.has(selected.category),
  );
  const fullPattern = eligible && hasTrigger && hasEmotion && hasTension && anyDepth;
  return { kinds, eligible, practicalPrimary, acceptedDepth, fullPattern };
}

/** Depth that is supported on its own, even when the selected hypothesis is practical. */
export function depthIndependentlySupported(state: CaseState) {
  return warrantParts(state).fullPattern;
}

export function evaluateDevelopmentalWarrant(state: CaseState, sections: { title: string; body: string }[] = []) {
  const parts = warrantParts(state);
  const warranted = parts.fullPattern && parts.acceptedDepth && !parts.practicalPrimary;
  const mode: WarrantMode = parts.practicalPrimary || !parts.eligible
    ? "not_warranted"
    : warranted
      ? "warranted"
      : "unresolved";
  const text = sections.map((section) => `${section.title}\n${section.body}`).join("\n");
  const suppliedBody = state.affect.bodyResponses
    .map((item) => `${item.rawQuote ?? ""} ${item.normalizedMeaning}`)
    .join(" ");
  let bodyStatus: BodyStatus = "missing";
  if (state.affect.bodyResponses.length > 0) {
    bodyStatus = "grounded";
  } else if (/no body sensation was supplied|body (?:data|sensation|response).{0,48}(?:not supplied|unavailable)/i.test(text)) {
    bodyStatus = "explicitly_unavailable";
  } else if (!state.affect.emotions.length && mode !== "warranted") {
    bodyStatus = "not_warranted";
  }
  return {
    kinds: parts.kinds,
    eligible: parts.eligible,
    mode,
    bodyStatus,
    suppliedBody,
    text,
    practicalPrimary: parts.practicalPrimary,
  };
}

export function emergentPossibleThird(
  third: string,
  poles: [string, string],
  corpus: string,
) {
  if (MANUFACTURED_THIRD.test(third)) {
    return false;
  }
  const poleWords = new Set(poles.flatMap((pole) => tokens(pole)));
  const distinctive = tokens(third).filter((token) => !poleWords.has(token));
  if (distinctive.length === 0) {
    return false;
  }
  const haystack = corpus.toLocaleLowerCase();
  return distinctive.some((token) => haystack.includes(token));
}

export function suppliedThirdCorpus(state: CaseState) {
  const actions = [
    ...state.behavior.actionsTaken.map((item) => `${item.rawQuote ?? ""} ${item.normalizedMeaning}`),
    ...state.behavior.avoidedActions.map((item) => item.action),
  ];
  const symbolic = Object.values(state.symbolicMaterial).flatMap((value) =>
    Array.isArray(value) ? value : value ? [value] : [],
  );
  const image = [
    ...(state.imageAnalysis?.literalFacts ?? []).map((item) => item.text),
    ...(state.imageAnalysis?.personalAssociations ?? []).map((item) => item.text),
    state.imageAnalysis?.unresolvedSymbolicQuestion ?? "",
  ];
  return [...actions, ...symbolic, ...image].join("\n");
}

/**
 * sufficientWithoutDepth may agree with practical_primary.
 * It must not erase depth that is independently supported.
 */
export function realityCheckAgreement(state: CaseState):
  | { action: "ok" }
  | { action: "note"; detail: string }
  | { action: "fail"; detail: string } {
  const layer = state.finalFormulation?.layerRelationship;
  const check = state.realityCheck;
  if (!layer || !check) {
    return { action: "ok" };
  }
  const supported = depthIndependentlySupported(state);
  if (check.sufficientWithoutDepth && supported) {
    return {
      action: "note",
      detail: "sufficientWithoutDepth does not erase independently supported depth.",
    };
  }
  const expectsPrimary = layer.mode === "practical_primary";
  if (expectsPrimary !== check.sufficientWithoutDepth) {
    return {
      action: "fail",
      detail:
        "realityCheck.sufficientWithoutDepth must agree with practical_primary and cannot force the inverse of supported depth.",
    };
  }
  return { action: "ok" };
}
