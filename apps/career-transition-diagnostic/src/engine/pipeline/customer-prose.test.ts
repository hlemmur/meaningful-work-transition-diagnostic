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

  it("does not treat a shorter question id as a prefix of a longer one", () => {
    const body =
      "History [a1:Q4.10] and fallback a1:Q2.4F sit beside money a1:Q8.10 and impulse a1:Q3.10.";
    const cleaned = stripCanonicalEvidenceIds(body, [
      "a1:Q4.1",
      "a1:Q2.4",
      "a1:Q8.1",
      "a1:Q3.1",
    ]);

    expect(cleaned).toContain("[a1:Q4.10]");
    expect(cleaned).toContain("a1:Q2.4F");
    expect(cleaned).toContain("a1:Q8.10");
    expect(cleaned).toContain("a1:Q3.10");
    expect(cleaned).not.toContain("[0]");
    expect(cleaned).not.toContain("fallback F ");
  });

  it("still removes an exact shorter id when it is a whole token", () => {
    const body = "You named the recurrence [a1:Q4.1] and later a1:Q4.1 again.";
    const cleaned = stripCanonicalEvidenceIds(body, ["a1:Q4.1"]);

    expect(cleaned).not.toContain("a1:Q4.1");
    expect(cleaned).toContain("You named the recurrence");
    expect(cleaned).toContain("and later again.");
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
