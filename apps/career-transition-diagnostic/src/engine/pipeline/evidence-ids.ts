import type { CaseState } from "../schemas/case-state";

export function collectEvidenceIds(state: CaseState) {
  const ids = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const record = value as { id?: unknown; questionId?: unknown };
    if (typeof record.id === "string" && typeof record.questionId === "string") {
      ids.add(record.id);
    }
    Object.values(record).forEach(walk);
  };
  walk(state);
  return ids;
}

const SYMBOLIC_FIELD_TO_QUESTION: Array<{
  field: keyof CaseState["symbolicMaterial"];
  questionId: string;
}> = [
  { field: "scene", questionId: "Q10.1" },
  { field: "surroundings", questionId: "Q10.2" },
  { field: "obstacle", questionId: "Q10.3" },
  { field: "ahead", questionId: "Q10.4" },
  { field: "figures", questionId: "Q10.5" },
  { field: "obstacleSpeech", questionId: "Q10.6" },
  { field: "obstacleWant", questionId: "Q10.7" },
  { field: "ifNotRemoved", questionId: "Q10.8" },
];

/** Every reference that a generated report is allowed to cite. */
export function collectCanonicalEvidenceIds(state: CaseState) {
  const ids = collectEvidenceIds(state);

  for (const { field, questionId } of SYMBOLIC_FIELD_TO_QUESTION) {
    const value = state.symbolicMaterial[field];
    const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (present) {
      ids.add(`${state.assessmentId}:${questionId}`);
    }
  }

  for (const figure of [
    ...state.projections.admiredFigures,
    ...state.projections.rejectedFigures,
  ]) {
    figure.evidenceRefs.forEach((ref) => ids.add(ref));
  }

  for (const items of Object.values(state.money)) {
    items.forEach((item) => ids.add(item.id));
  }

  return [...ids];
}

export function firstEvidenceId(state: CaseState, assessmentId: string) {
  return (
    [...collectEvidenceIds(state)][0] ??
    `${assessmentId}:Q1.1`
  );
}
