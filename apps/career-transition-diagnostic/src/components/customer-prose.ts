const EVIDENCE_TOKEN = /^[A-Za-z0-9_-]+:Q[A-Za-z0-9.]+$/;

function isEvidenceMarker(inner: string) {
  const parts = inner.split(",");
  if (parts.length === 1) {
    return EVIDENCE_TOKEN.test(inner.trim());
  }
  return parts.every((part) => {
    const token = part.trim();
    return token.length === 0 || EVIDENCE_TOKEN.test(token);
  });
}

/** Customer-visible prose. Stored evidenceRefs are left to the caller. */
export function visibleReportBody(body: string) {
  const withoutMarkers = body
    .replace(/\[[^\]\n]*\]/g, (match) => (isEvidenceMarker(match.slice(1, -1)) ? "" : match))
    .replace(/\b[A-Za-z0-9_-]+:Q[A-Za-z0-9.]+\b/g, "");
  return withoutMarkers
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
}

export function visibleReportSection<T extends { body: string }>(section: T): T {
  return { ...section, body: visibleReportBody(section.body) };
}
