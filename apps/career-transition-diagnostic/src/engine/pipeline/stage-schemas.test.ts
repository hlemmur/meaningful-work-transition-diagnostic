import { describe, expect, it } from "vitest";
import { pass9OutputSchema, REQUIRED_PEEL_SECTION_IDS } from "./stage-schemas";

describe("pass9OutputSchema", () => {
  it("rejects a single thin section like the live Gemini miss", () => {
    const parsed = pass9OutputSchema.safeParse({
      sections: [
        {
          id: "perspective-shift",
          title: "Perspective and Vision",
          body: "One short sentence is not a report.",
          evidenceRefs: ["a1:Q0.5"],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("requires the core peel-order section ids", () => {
    const parsed = pass9OutputSchema.safeParse({
      sections: REQUIRED_PEEL_SECTION_IDS.map((id, index) => ({
        id,
        title: id,
        body: "A concrete evidence-backed paragraph about the stall.",
        evidenceRefs: [`a1:Q${index + 1}.1`],
      })),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a report that cites only one question id across all sections", () => {
    const parsed = pass9OutputSchema.safeParse({
      sections: REQUIRED_PEEL_SECTION_IDS.map((id) => ({
        id,
        title: id,
        body: "A concrete evidence-backed paragraph about the stall.",
        evidenceRefs: ["a1:Q0.5"],
      })),
    });
    expect(parsed.success).toBe(false);
  });
});
