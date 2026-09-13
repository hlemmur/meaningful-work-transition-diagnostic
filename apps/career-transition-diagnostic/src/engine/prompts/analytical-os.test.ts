import { describe, expect, it } from "vitest";
import {
  ANALYTICAL_OS,
  ANALYTICAL_OS_BANNED_PHRASES,
  ANALYTICAL_OS_MAX_CHARS,
  ANALYTICAL_OS_REQUIRED_PHRASES,
} from "./analytical-os";
import { PASS_CARD_STAGES, passCardFor } from "./pass-cards";

describe("analytical OS contracts", () => {
  it("stays within size budget and includes required phrases", () => {
    expect(ANALYTICAL_OS.length).toBeLessThanOrEqual(ANALYTICAL_OS_MAX_CHARS);
    for (const phrase of ANALYTICAL_OS_REQUIRED_PHRASES) {
      expect(ANALYTICAL_OS).toContain(phrase);
    }
  });

  it("does not include banned diagnosis language", () => {
    for (const phrase of ANALYTICAL_OS_BANNED_PHRASES) {
      expect(ANALYTICAL_OS.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("exposes pass cards for analysis stages", () => {
    expect(PASS_CARD_STAGES).toEqual(
      expect.arrayContaining(["pass2", "pass6", "pass7", "pass8", "pass9"]),
    );
    expect(passCardFor("pass6")).toMatch(/Q11\.3|requestedInsight/i);
    expect(passCardFor("pass9")).toMatch(/image → projection → money → bargain|image.*projection.*money.*bargain/i);
    expect(passCardFor("pass9")).toMatch(/Q11\.3 is never the plot|never the plot/i);
    expect(passCardFor("pass10")).toMatch(/Tier-A citations|inflation diagnosis/i);
  });
});
