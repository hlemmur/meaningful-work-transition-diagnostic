import type { ReportSection } from "../schemas/analysis";

/** Across the full draft, require claims to cite at least this many distinct question ids. */
export const MIN_DISTINCT_EVIDENCE_QUESTION_IDS = 3;

export function questionIdFromEvidenceRef(ref: string) {
  const match = /:(Q[\w.]+)$/i.exec(ref) ?? /^(Q[\w.]+)$/i.exec(ref);
  return match?.[1] ?? ref;
}

export function distinctEvidenceQuestionIds(sections: Pick<ReportSection, "evidenceRefs">[]) {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const ref of section.evidenceRefs) {
      ids.add(questionIdFromEvidenceRef(ref));
    }
  }
  return ids;
}

export function hasDiverseEvidenceRefs(
  sections: Pick<ReportSection, "evidenceRefs">[],
  minDistinct = MIN_DISTINCT_EVIDENCE_QUESTION_IDS,
) {
  return distinctEvidenceQuestionIds(sections).size >= minDistinct;
}

/** Heuristic: most section bodies reuse distinctive tokens from Q11.3 requestedInsight. */
export function isRequestedInsightSpine(
  sections: Pick<ReportSection, "body">[],
  requestedInsight: string | undefined,
) {
  const insight = requestedInsight?.trim().toLowerCase() ?? "";
  if (insight.length < 16 || sections.length === 0) {
    return false;
  }
  const tokens = [...new Set(insight.split(/[^a-z0-9]+/i).filter((token) => token.length >= 5))];
  if (tokens.length < 2) {
    return false;
  }
  const matching = sections.filter((section) => {
    const body = section.body.toLowerCase();
    const hits = tokens.filter((token) => body.includes(token)).length;
    return hits >= Math.min(2, tokens.length);
  });
  return matching.length / sections.length >= 0.6;
}

/** Sections the pass10 critic should fail for grounding / evidence diversity. */
export function failingReportSectionIds(input: {
  sections: Pick<ReportSection, "id" | "body" | "evidenceRefs">[];
  requestedInsight?: string;
}) {
  if (input.sections.length === 0) {
    return [] as string[];
  }
  const thin = input.sections.filter((section) => section.body.trim().split(/\s+/).length < 12);
  if (
    !hasDiverseEvidenceRefs(input.sections) ||
    isRequestedInsightSpine(input.sections, input.requestedInsight)
  ) {
    return input.sections.map((section) => section.id);
  }
  return thin.map((section) => section.id);
}
