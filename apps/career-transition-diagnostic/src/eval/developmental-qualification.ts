import { questions } from "@/questionnaire/questionnaire.v2";
import type { ReportSection } from "@/engine/schemas/analysis";
import type { CaseState } from "@/engine/schemas/case-state";

export type QualificationScore = {
  id:
    | "developmental_restraint"
    | "developmental_grounding"
    | "developmental_warrant"
    | "developmental_poles"
    | "invented_embodiment"
    | "unsupported_causality"
    | "safety_scope"
    | "inverse_proof"
    | "either_or_framing"
    | "symbol_closure"
    | "projection_gold"
    | "leading_question"
    | "internal_refs";
  passed: boolean;
  detail: string;
  hard: true;
};

export type EvidenceKind =
  | "self_theory"
  | "behavior_history"
  | "affect"
  | "projection"
  | "symbol"
  | "enactment"
  | "practical_biological";

export type StageMark =
  | "grounded"
  | "partial"
  | "explicitly_unavailable"
  | "not_warranted"
  | "missing";

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

const BODY_LOCATIONS = ["chest", "shoulder", "throat", "stomach", "jaw", "gut", "belly"];

const sectionByQuestionId = new Map(
  questions.map((question) => [question.id, question.section]),
);

function evidenceDomains(refs: string[]) {
  return new Set(
    refs.flatMap((ref) => {
      const questionId = ref.match(/:([^:]+)$/)?.[1];
      const section = questionId ? sectionByQuestionId.get(questionId) : undefined;
      return section === undefined ? [] : [section];
    }),
  );
}

function joined(sections: ReportSection[]) {
  return sections.map((section) => `${section.title}\n${section.body}`).join("\n");
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim());
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

function selectedHypothesis(state: CaseState) {
  const id = state.finalFormulation?.selectedHypothesisId;
  return state.hypotheses.find((item) => item.id === id);
}

export function evaluateDevelopmentalWarrant(state: CaseState, sections: ReportSection[] = []) {
  const kinds = classifyEvidenceKinds(state);
  const independent = kinds.filter((kind) => kind !== "self_theory");
  const eligible = kinds.length >= 2 && independent.length >= 1;
  const selected = selectedHypothesis(state);
  const practicalPrimary = Boolean(
    state.realityCheck?.sufficientWithoutDepth &&
      selected &&
      PRACTICAL_CATEGORIES.has(selected.category),
  );
  const trigger = state.finalFormulation?.maintenanceMechanism.trigger.trim() ?? "";
  const hasTrigger = trigger.length > 0 && trigger !== "Not recorded in the legacy formulation.";
  const hasEmotion = state.affect.emotions.length > 0;
  const hasTension = Boolean(
    state.hiddenPosition?.developmentalTension.poleA.trim() &&
      state.hiddenPosition.developmentalTension.poleB.trim(),
  );
  const acceptedDepth = Boolean(selected && DEPTH_CATEGORIES.has(selected.category));
  const warranted = eligible && !practicalPrimary && hasTrigger && hasEmotion && hasTension && acceptedDepth;
  const mode: WarrantMode = practicalPrimary || !eligible
    ? "not_warranted"
    : warranted
      ? "warranted"
      : "unresolved";
  const text = joined(sections);
  const suppliedBody = state.affect.bodyResponses
    .map((item) => `${item.rawQuote ?? ""} ${item.normalizedMeaning}`)
    .join(" ");
  let bodyStatus: BodyStatus = "missing";
  if (state.affect.bodyResponses.length > 0) {
    bodyStatus = "grounded";
  } else if (/no body sensation was supplied|body (?:data|sensation|response).{0,48}(?:not supplied|unavailable)/i.test(text)) {
    bodyStatus = "explicitly_unavailable";
  } else if (!hasEmotion && mode !== "warranted") {
    bodyStatus = "not_warranted";
  }
  return { kinds, eligible, mode, bodyStatus, suppliedBody, text };
}

const GENERIC_READING_WORDS = new Set([
  "a",
  "an",
  "its",
  "one",
  "only",
  "possible",
  "same",
  "single",
  "that",
  "the",
  "this",
]);

function symbolReadingsStayOpen(text: string) {
  if (/another reading|second reading/i.test(text)) return true;
  if (/\bboth\b[^.]{0,120}\breadings?\b/i.test(text)) return true;
  const mentions = [...text.matchAll(/\b([a-z][\w-]*)\s+reading\b/gi)]
    .map((match) => match[1]?.toLocaleLowerCase() ?? "")
    .filter((word) => word && !GENERIC_READING_WORDS.has(word));
  return new Set(mentions).size >= 2;
}

function score(
  id: QualificationScore["id"],
  passed: boolean,
  detail: string,
): QualificationScore {
  return { id, passed, detail, hard: true };
}

function poleTokens(pole: string) {
  return pole
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
}

export function evaluateDevelopmentalQualification(
  state: CaseState,
  sections: ReportSection[],
) {
  const formulation = state.finalFormulation?.developmentalFormulation;
  const reportSection = sections.find((section) => section.id === "developmental");
  const warrant = evaluateDevelopmentalWarrant(state, sections);
  const text = warrant.text;
  const restraintPassed = Boolean(formulation) === Boolean(reportSection);
  const groundingPassed = !formulation || (
    evidenceDomains(formulation.evidenceRefs).size >= 2 &&
    Boolean(reportSection) &&
    formulation.evidenceRefs.every((ref) => reportSection?.evidenceRefs.includes(ref))
  );
  const warrantPassed = warrant.mode !== "warranted" || Boolean(formulation && reportSection);
  const polesPassed = !formulation || !reportSection || (
    poleTokens(formulation.consciousPole).some((token) =>
      reportSection.body.toLocaleLowerCase().includes(token),
    ) &&
    poleTokens(formulation.compensatingPole).some((token) =>
      reportSection.body.toLocaleLowerCase().includes(token),
    )
  );
  const inventedLocation = BODY_LOCATIONS.find((location) =>
    new RegExp(`\\b${location}\\b`, "i").test(text) &&
    !new RegExp(`\\b${location}\\b`, "i").test(warrant.suppliedBody),
  );
  const goldRequired = state.projectionInterpretations.some((item) => item.possibleDisownedValue);
  const readings = state.imageAnalysis?.plausibleReadings ?? [];
  const symbolClosed =
    /only possible reading|the image simply means|nothing about the image remains unresolved/i.test(text) ||
    (readings.length >= 2 &&
      Boolean(state.imageAnalysis?.unresolvedSymbolicQuestion) &&
      !symbolReadingsStayOpen(text));
  const scores: QualificationScore[] = [
    score(
      "developmental_restraint",
      restraintPassed,
      restraintPassed
        ? "Developmental report inclusion matches the resolved formulation."
        : "Developmental formulation and report section inclusion disagree.",
    ),
    score(
      "developmental_grounding",
      groundingPassed,
      groundingPassed
        ? "Developmental evidence is absent or grounded across independent domains."
        : "Developmental evidence must span two domains and survive into the report section.",
    ),
    score(
      "developmental_warrant",
      warrantPassed,
      warrantPassed
        ? "A warranted developmental formulation is present, or development is not warranted."
        : "Independent evidence warrants a developmental formulation and section, and at least one is missing.",
    ),
    score(
      "developmental_poles",
      polesPassed,
      polesPassed
        ? "Both developmental poles are named, or no formulation is rendered."
        : "Developmental prose must name both poles; Jungian vocabulary alone does not.",
    ),
    score(
      "invented_embodiment",
      !inventedLocation,
      inventedLocation
        ? `Report invents a ${inventedLocation} sensation that was not supplied.`
        : "No invented bodily location.",
    ),
    score(
      "unsupported_causality",
      !/ADHD (?:directly )?causes|directly causes your/i.test(text),
      "Medical or neurodevelopmental conditions are not stated as direct causes.",
    ),
    score(
      "safety_scope",
      !/your shadow is sabotaging|they are your shadow|this heals|heals the underlying|the psyche (?:may be )?nudg|the unconscious (?:requires|wants|directs)|the (?:Self|universe) (?:requires|wants|directs)/i.test(text),
      "Customer prose avoids diagnosis, healing claims, and directive metaphysics.",
    ),
    score(
      "inverse_proof",
      !/failed,\s+therefore|therefore\s+(?:\w+\s+){0,6}(?:primary|proven|proves)/i.test(text),
      "The close does not treat a weakened explanation as proof of another.",
    ),
    score(
      "either_or_framing",
      !/either practical or psychological|cannot both be true|mutually exclusive explanations/i.test(text),
      "Practical and psychological layers are not framed as mutually exclusive.",
    ),
    score(
      "symbol_closure",
      !symbolClosed,
      symbolClosed
        ? "A symbol with more than one surviving reading was closed into a single answer."
        : "Symbolic readings stay open when more than one survives.",
    ),
    score(
      "projection_gold",
      !/ordinary discipline|discipline is the gold/i.test(text) &&
        (!goldRequired || /not yet owned|could own|tentative/i.test(text)),
      "Projection gold stays tentative and is not reduced to ordinary discipline.",
    ),
    score(
      "leading_question",
      !/isn't it true|don't you think|surely you/i.test(text),
      "Questions do not lead the client into the formulation.",
    ),
    score(
      "internal_refs",
      !/\[(?:[a-z0-9-]+:)?Q\d|\bassessment:Q\d/i.test(text),
      "Customer prose contains no raw evidence tokens.",
    ),
  ];

  const mark = (present: boolean, idle: StageMark = "missing"): StageMark => {
    if (present) return "grounded";
    if (warrant.mode === "not_warranted") return "not_warranted";
    return idle;
  };

  const stages: Array<{ id: string; status: StageMark }> = [
    { id: "practical_reality", status: mark(classifyEvidenceKinds(state).includes("practical_biological")) },
    { id: "trigger", status: mark(Boolean(state.finalFormulation?.maintenanceMechanism.trigger.trim())) },
    { id: "emotion", status: state.affect.emotions.length > 0 ? "grounded" : warrant.bodyStatus === "not_warranted" ? "not_warranted" : "missing" },
    { id: "body", status: warrant.bodyStatus },
    { id: "ego_position", status: mark(Boolean(state.hiddenPosition?.consciousPosition.trim())) },
    { id: "persona", status: mark((state.hiddenPosition?.protectiveFunction.length ?? 0) > 0, "partial") },
    { id: "projection", status: mark(classifyEvidenceKinds(state).includes("projection")) },
    { id: "protective_pattern", status: mark((state.hiddenPosition?.protectiveFunction.length ?? 0) > 0) },
    {
      id: "witnessing",
      status: /not the whole of who you are/i.test(text)
        ? "grounded"
        : warrant.mode === "warranted"
          ? "missing"
          : "not_warranted",
    },
    { id: "creative_action", status: mark(state.experiments.length > 0) },
  ];

  return {
    hardPassed: scores.every((item) => item.passed),
    scores,
    stages,
    warrant: {
      mode: warrant.mode,
      eligible: warrant.eligible,
      bodyStatus: warrant.bodyStatus,
      kinds: warrant.kinds,
    },
  };
}
