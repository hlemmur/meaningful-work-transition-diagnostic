function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EVIDENCE_TOKEN = /^[A-Za-z0-9_-]+:Q[A-Za-z0-9.]+$/;

function isEmptyOrEvidenceQuotedPart(part: string) {
  const trimmed = part.trim();
  if (trimmed.length === 0) return true;
  const unquoted = trimmed.replace(/^["']|["']$/g, "").trim();
  return unquoted.length === 0 || EVIDENCE_TOKEN.test(unquoted);
}

function stripEmptyEvidenceParenGroups(body: string) {
  return body.replace(/\([^()\n]*\)/g, (match) => {
    const inner = match.slice(1, -1);
    const parts = inner.split(",");
    if (parts.length === 0) return match;
    return parts.every(isEmptyOrEvidenceQuotedPart) ? "" : match;
  });
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
    next = next.replace(new RegExp(escaped, "g"), "");
  }
  next = stripEmptyEvidenceParenGroups(next);
  return next
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export const CUSTOMER_SAFETY_FAILURE =
  /ADHD (?:directly )?causes|directly causes your|this heals|heals the underlying|(?:your|the) psyche (?:is |may be )?nudg|the unconscious (?:requires|wants|directs)|the (?:Self|universe) (?:requires|wants|directs)/i;
