import { describe, expect, it } from "vitest";
import { buildGeminiContents } from "./live";

describe("buildGeminiContents", () => {
  it("prefixes stage prompts with analytical OS system text", () => {
    const built = buildGeminiContents("pass6", { assessmentId: "a1" });
    expect(built.system).toMatch(/Tier-A/);
    expect(built.system).toMatch(/Pass focus/);
    expect(built.user).toMatch(/Hidden Position|requestedInsight/i);
    expect(built.contents[0]?.parts[0]?.text).toMatch(/SYSTEM:/);
  });
});
