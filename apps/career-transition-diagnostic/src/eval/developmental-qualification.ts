import { questions } from "@/questionnaire/questionnaire.v2";
import type { ReportSection } from "@/engine/schemas/analysis";
import type { CaseState } from "@/engine/schemas/case-state";
import {
  classifyEvidenceKinds,
  evaluateDevelopmentalWarrant,
  type BodyStatus,
  type EvidenceKind,
  type WarrantMode,
} from "@/engine/pipeline/developmental-warrant";

export { classifyEvidenceKinds, evaluateDevelopmentalWarrant };
export type { BodyStatus, EvidenceKind, WarrantMode };

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

export type StageMark =
  | "grounded"
  | "partial"
  | "explicitly_unavailable"
  | "not_warranted"
  | "missing";

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
