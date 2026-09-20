import { describe, expect, it } from "vitest";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { collectCanonicalEvidenceIds } from "./evidence-ids";

describe("canonical evidence ids", () => {
  it("includes supplied evidence and symbolic refs but rejects arbitrary assessment-prefixed ids", () => {
    const state = extractCaseStateFull("case-1", {
      "Q1.1": "I stall before a visible test.",
      "Q5.1": ["A patient craftsperson"],
      "Q8.2": "Income once arrived through a salaried role.",
      "Q10.1": "A locked garden gate.",
      "Q10.6": "Wait until the ground is yours.",
    });

    const ids = collectCanonicalEvidenceIds(state);

    expect(ids).toEqual(
      expect.arrayContaining([
        "case-1:Q1.1",
        "case-1:Q5.1",
        "case-1:Q8.2",
        "case-1:Q10.1",
        "case-1:Q10.6",
      ]),
    );
    expect(ids).not.toContain("case-1:Q99.7");
  });
});
