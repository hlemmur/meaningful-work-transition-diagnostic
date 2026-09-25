import { describe, expect, it } from "vitest";
import { llmBadgeLabel } from "./mock-mode-badge";

describe("llmBadgeLabel", () => {
  it("names live Gemini when the live adapter is selected", () => {
    expect(llmBadgeLabel(true)).toBe("LIVE LLM");
  });

  it("names the fixture adapter when live mode is off", () => {
    expect(llmBadgeLabel(false)).toBe("FIXTURE LLM");
  });
});
