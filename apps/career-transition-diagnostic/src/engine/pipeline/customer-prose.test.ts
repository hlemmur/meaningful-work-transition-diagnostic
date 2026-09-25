import { describe, expect, it } from "vitest";
import { CUSTOMER_SAFETY_FAILURE, stripCanonicalEvidenceIds } from "./customer-prose";

const ids = ["origin-real-local:Q1.3", "origin-real-local:Q2.1"];

describe("customer provenance", () => {
  it("removes an exact canonical id and keeps the metadata ref separate", () => {
    const body = "You reported an ADHD diagnosis [origin-real-local:Q1.3]; this report cannot determine how much it contributes.";
    const cleaned = stripCanonicalEvidenceIds(body, ids);
    expect(cleaned).toBe(
      "You reported an ADHD diagnosis; this report cannot determine how much it contributes.",
    );
    expect(cleaned).not.toContain("origin-real-local:Q1.3");
    expect(ids).toContain("origin-real-local:Q1.3");
  });

  it("keeps a client's own brackets and line breaks", () => {
    const body = "You wrote [the gate] in your image.\n\nOne possible reading is that the image expresses a need for support.";
    expect(stripCanonicalEvidenceIds(body, ids)).toBe(body);
  });

  it("does not treat a broad bracket as an evidence id", () => {
    const body = "You said [not an id] and kept the phrase.";
    expect(stripCanonicalEvidenceIds(body, ids)).toBe(body);
  });

  it("allows a reported diagnosis and rejects direct causality, nudging, and healing", () => {
    expect(CUSTOMER_SAFETY_FAILURE.test(
      "You reported an ADHD diagnosis; this report cannot determine how much it contributes.",
    )).toBe(false);
    expect(CUSTOMER_SAFETY_FAILURE.test("You said the image felt like a calling.")).toBe(false);
    for (const sentence of [
      "ADHD directly causes your freeze.",
      "Your psyche is nudging you.",
      "The psyche may be nudging you.",
      "This heals the underlying wound.",
    ]) {
      expect(CUSTOMER_SAFETY_FAILURE.test(sentence), sentence).toBe(true);
    }
  });
});
