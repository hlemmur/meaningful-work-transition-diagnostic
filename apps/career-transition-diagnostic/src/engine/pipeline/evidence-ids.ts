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

export function firstEvidenceId(state: CaseState, assessmentId: string) {
  return (
    [...collectEvidenceIds(state)][0] ??
    `${assessmentId}:Q1.1`
  );
}
