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

  it("uses the generic optional-imaginal contract without origin-case prescriptions", () => {
    expect(ANALYTICAL_OS).toMatch(/behavioral experiment.*required|required.*behavioral experiment/i);
    expect(ANALYTICAL_OS).toMatch(/imaginal.*optional/i);
    expect(ANALYTICAL_OS).toMatch(/supplied symbolic material/i);
    expect(ANALYTICAL_OS).not.toMatch(/structure in service of aliveness/i);
    expect(ANALYTICAL_OS).not.toMatch(/body locus/i);
    expect(ANALYTICAL_OS).not.toMatch(/Magician/i);
    expect(ANALYTICAL_OS).not.toMatch(/image in reality\/hidden/i);
  });

  it("exposes pass cards for analysis stages", () => {
    expect(PASS_CARD_STAGES).toEqual(
      expect.arrayContaining([
        "pass2",
        "pass3",
        "pass4",
        "pass5",
        "pass6",
        "pass7",
        "pass8",
        "pass9",
        "pass10",
      ]),
    );

    expect(passCardFor("pass2")).toMatch(
      /novelty|cross-domain|already explicitly formulated/i,
    );
    expect(passCardFor("pass2")).toMatch(
      /Q11\.3|requestedInsight/i,
    );

    expect(passCardFor("pass4")).toMatch(
      /confirmation bias|over-psychologizing/i,
    );
    expect(passCardFor("pass4")).toMatch(
      /mundane alternative|counter-evidence|missing evidence/i,
    );

    expect(passCardFor("pass5")).toMatch(
      /support|weaken|split|insufficient/i,
    );
    expect(passCardFor("pass5")).toMatch(
      /personal associations/i,
    );

    expect(passCardFor("pass6")).toMatch(
      /Q11\.3|requestedInsight/i,
    );
    expect(passCardFor("pass6")).toMatch(
      /finalFormulation|unresolved|strongest live alternative/i,
    );

    expect(passCardFor("pass7")).toMatch(
      /0–3|0-3/i,
    );
    expect(passCardFor("pass7")).toMatch(
      /identity labels|diagnos/i,
    );

    expect(passCardFor("pass8")).toMatch(
      /behavioral experiment/i,
    );
    expect(passCardFor("pass8")).toMatch(
      /exact id/i,
    );
    expect(passCardFor("pass8")).toMatch(
      /competing explanations|discriminate/i,
    );
    expect(passCardFor("pass8")).toMatch(
      /imaginal/i,
    );
    expect(passCardFor("pass8")).not.toMatch(/\bpipe\b/i);
    expect(passCardFor("pass8")).not.toMatch(/\bprovider\b/i);

    expect(passCardFor("pass9")).toMatch(
      /not from requestedInsight\/Q11\.3|requestedInsight\/Q11\.3/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /second-person|second person|You\/Your/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /never force a fixed sequence|only when they materially illuminate/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /claim→cite→interpretation/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /strongest alternative|unresolved forks/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /never invent dialogue|bodily locations|evidenceRefs/i,
    );
    expect(passCardFor("pass9")).toMatch(
      /non-diagnostic|hypothetical/i,
    );
    expect(passCardFor("pass9")).not.toMatch(/\bpipe\b/i);
    expect(passCardFor("pass9")).not.toMatch(/Magician/i);
    expect(passCardFor("pass9")).not.toMatch(
      /image → projection → money → bargain/i,
    );

    expect(passCardFor("pass10")).toMatch(
      /strict provenance|reasoning critic/i,
    );
    expect(passCardFor("pass10")).toMatch(
      /invent.*dialogue|body locations|evidenceRefs/i,
    );
    expect(passCardFor("pass10")).toMatch(
      /hypotheses into facts|turn hypotheses into facts/i,
    );
    expect(passCardFor("pass10")).toMatch(
      /alternatives|unresolved forks/i,
    );
    expect(passCardFor("pass10")).toMatch(
      /constraints/i,
    );
    expect(passCardFor("pass10")).toMatch(
      /categorical Jungian identity labels/i,
    );
  });
});
