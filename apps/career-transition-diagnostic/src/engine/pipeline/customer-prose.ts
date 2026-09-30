function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove exact canonical evidence ids from customer prose.
 * Other brackets, including client language, stay.
 */
export function stripCanonicalEvidenceIds(body: string, ids: Iterable<string>) {
  const sorted = [...new Set(ids)].filter(Boolean).sort((a, b) => b.length - a.length);
  let next = body;
  for (const id of sorted) {
    const escaped = escapeRegExp(id);
    next = next.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "g"), "");
    // Do not strip a shorter id (Q4.1) out of a longer one (Q4.10, Q2.4F).
    next = next.replace(
      new RegExp(`(?<![A-Za-z0-9._-])${escaped}(?![A-Za-z0-9._-])`, "g"),
      "",
    );
  }
  return next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export const CUSTOMER_SAFETY_FAILURE =
  /ADHD (?:directly )?causes|directly causes your|this heals|heals the underlying|(?:your|the) psyche (?:is |may be )?nudg|the unconscious (?:requires|wants|directs)|the (?:Self|universe) (?:requires|wants|directs)/i;
