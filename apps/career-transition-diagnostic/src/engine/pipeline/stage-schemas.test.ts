import { describe, expect, it } from "vitest";
import { pass9OutputSchema, REQUIRED_PEEL_SECTION_IDS } from "./stage-schemas";

describe("pass9OutputSchema", () => {
  const section = (id: string) => ({
    id,
    title: id,
    body: "A concrete evidence-backed paragraph about the stall.",
    evidenceRefs: ["a1:Q1.1"],
  });

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
      sections: REQUIRED_PEEL_SECTION_IDS.map(section),
    });
    expect(parsed.success).toBe(true);
  });
});
