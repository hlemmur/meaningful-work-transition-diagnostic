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
    expect(passCardFor("pass9")).toMatch(/second person|You\/Your/i);
    expect(passCardFor("pass9")).toMatch(/the client/i);
    expect(passCardFor("pass9")).toMatch(/image\/scene\/associations|tierA\.image/i);
    expect(passCardFor("pass9")).toMatch(/certainty-hunger|external-revelation hunger/i);
    expect(passCardFor("pass9")).not.toMatch(/\bpipe\b/i);
    expect(passCardFor("pass9")).not.toMatch(/Name Magician hunger/i);
    expect(passCardFor("pass9")).toMatch(/possibleCompensatoryAim/i);
    expect(passCardFor("pass9")).toMatch(/obstacleSpeech/i);
    expect(passCardFor("pass9")).toMatch(/wantedQuality|judgedQuality/i);
    expect(passCardFor("pass8")).toMatch(/imaginal|obstacleSpeech/i);
    expect(passCardFor("pass8")).toMatch(/experimentBindings/i);
    expect(passCardFor("pass8")).toMatch(/hypothesisTested/i);
    expect(passCardFor("pass8")).toMatch(/hypothesisIds|openForkIds/i);
    expect(passCardFor("pass8")).not.toMatch(/\bpipe\b/i);
    expect(passCardFor("pass8")).not.toMatch(/\bprovider\b/i);
    expect(passCardFor("pass10")).toMatch(/possibleCompensatoryAim|eternal becoming|obstacleSpeech/i);
    expect(passCardFor("pass10")).toMatch(/Tier-A citations|inflation diagnosis|the client|clinical/i);
  });
});
