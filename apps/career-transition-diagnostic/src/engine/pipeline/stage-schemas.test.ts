import { describe, expect, it } from "vitest";
import {
  pass5OutputSchema,
  pass6OutputSchema,
  pass7OutputSchema,
  pass9OutputSchema,
  REQUIRED_PEEL_SECTION_IDS,
} from "./stage-schemas";

describe("pass5OutputSchema / symbolic readings", () => {
  it("accepts a symbolic reading that stays unrelated to the hypothesis set", () => {
    const parsed = pass5OutputSchema.safeParse({
      votes: [{
        hypothesisId: "hyp-depth",
        verdict: "splits",
        evidenceRefs: ["a1:Q10.1"],
        exactClientMaterialUsed: ["a1:Q10.1"],
      }],
      imageAnalysis: {
        literalFacts: [{ text: "A gate.", evidenceRefs: ["a1:Q10.1"] }],
        personalAssociations: [],
        plausibleReadings: [{
          interpretation: "An unbound interpretation.",
          supportsHypothesisIds: [],
          weakensHypothesisIds: [],
          evidenceRefs: ["a1:Q10.1"],
        }],
      },
      projectionInterpretations: [],
      overallNote: "Synthetic.",
    });
    expect(parsed.success).toBe(true);
  });

  it("still rejects a reading that cites no supplied evidence", () => {
    const parsed = pass5OutputSchema.safeParse({
      votes: [{
        hypothesisId: "hyp-depth",
        verdict: "splits",
        evidenceRefs: ["a1:Q10.1"],
        exactClientMaterialUsed: ["a1:Q10.1"],
      }],
      imageAnalysis: {
        literalFacts: [{ text: "A gate.", evidenceRefs: ["a1:Q10.1"] }],
        personalAssociations: [],
        plausibleReadings: [{
          interpretation: "An unbound interpretation.",
          evidenceRefs: [],
        }],
      },
      projectionInterpretations: [],
      overallNote: "Synthetic.",
    });
    expect(parsed.success).toBe(false);
  });
});

const lens = {
  concept: "compensation",
  observedPatternItIlluminates: "Stall beside desire",
  whyUseful: "Names a balancing movement",
  evidenceRefs: ["a1:Q1.1"],
  limitsOfInterpretation: "Practical constraints may suffice",
  confidence: "tentative" as const,
};

const pass6Base = {
  selectedHypothesisId: "hyp-depth",

  forkResolutions: [
    {
      forkId: "history_vs_stated_cause" as const,
      status: "leans_a" as const,
      interpretation:
        "The evidence currently leans toward the depth hypothesis.",
      evidenceRefs: ["a1:Q1.1"],
      importance: "high" as const,
      reportWorthiness: true,
    },
  ],

  finalFormulation: {
    selectedHypothesisId: "hyp-depth",
    maintenanceFormulation:
      "The stall may involve more than a practical constraint.",
    maintenanceMechanism: {
      trigger: "A next step becomes concrete.",
      response: "Action is deferred.",
      shortTermFunction: "Avoids premature commitment.",
      longTermCost: "No new evidence accumulates.",
      reinforcingConsequence: "Uncertainty therefore persists.",
    },
    whyItFits: [
      "The pattern recurs alongside the stated desire.",
    ],
    whatItDoesNotExplain: [
      "Practical constraints remain relevant.",
    ],
    strongestAlternative:
      "Constraints may suffice",
    unresolvedForks: [],
  },

  alternative: "Constraints may suffice",
};

const hiddenBase = {
  consciousPosition: "I need confidence",
  observedPattern: "Freeze at exposure",
  possibleHiddenPosition: "Freedom while container still carries authority",
  protectiveFunction: ["Keeps lightness"],
  threatenedByChange: ["Ordinary grind"],
  developmentalTension: { poleA: "possibility", poleB: "incarnation" },
  imageVoteSummary: "supports",
  evidenceRefs: ["a1:Q1.1"],
  counterEvidenceRefs: [],
  confidence: "tentative" as const,
};

describe("pass7OutputSchema", () => {
  it("rejects empty jungianLenses without omitReason (live miss shape)", () => {
    const parsed = pass7OutputSchema.safeParse({ jungianLenses: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty jungianLenses with blank omitReason", () => {
    const parsed = pass7OutputSchema.safeParse({
      jungianLenses: [],
      omitReason: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts empty jungianLenses with a non-empty omitReason", () => {
    const parsed = pass7OutputSchema.safeParse({
      jungianLenses: [],
      omitReason: "No clear archetypal polarity beyond practical constraints.",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts 1–3 lenses without requiring omitReason", () => {
    expect(pass7OutputSchema.safeParse({ jungianLenses: [lens] }).success).toBe(true);
  });
});

describe("pass6OutputSchema / hiddenPosition aim", () => {
  it(
    "rejects hiddenPosition without possibleCompensatoryAim (live miss shape)",
    () => {
      const parsed =
        pass6OutputSchema.safeParse({
          ...pass6Base,

          hiddenPosition:
            hiddenBase,
        });

      expect(
        parsed.success,
      ).toBe(false);
    },
  );

  it(
    "accepts hiddenPosition with possibleCompensatoryAim",
    () => {
      const parsed =
        pass6OutputSchema.safeParse({
          ...pass6Base,

          hiddenPosition: {
            ...hiddenBase,

            possibleCompensatoryAim:
              "Structure in service of aliveness",
          },
        });

      expect(
        parsed.success,
      ).toBe(true);
    },
  );

  it(
    "still allows null hiddenPosition",
    () => {
      const parsed =
        pass6OutputSchema.safeParse({
          ...pass6Base,

          hiddenPosition: null,
        });

      expect(
        parsed.success,
      ).toBe(true);
    },
  );
});

describe("pass9OutputSchema", () => {
  it("rejects questions without structured intent and a disconfirming question", () => {
    const sections = REQUIRED_PEEL_SECTION_IDS.map((id, index) => ({
      id,
      title: id,
      body: id === "questions"
        ? "What do you notice? What could change? What remains unknown?"
        : "A concrete evidence-backed paragraph about the stall.",
      evidenceRefs: [`a1:Q${index + 1}.1`],
    }));

    expect(pass9OutputSchema.safeParse({ sections }).success).toBe(false);
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
      sections: REQUIRED_PEEL_SECTION_IDS.map((id, index) => ({
        id,
        title: id,
        body: "A concrete evidence-backed paragraph about the stall.",
        evidenceRefs: [`a1:Q${index + 1}.1`],
        ...(id === "questions" ? {
          questionIntents: [
            { question: "What evidence would weaken this formulation?", targetUncertainty: "Whether the formulation fits", relatedHypothesisId: "h1", couldWeakenSelectedFormulation: true },
            { question: "What do you notice when you test it?", targetUncertainty: "What changes in action", relatedHypothesisId: "h2", couldWeakenSelectedFormulation: false },
            { question: "What remains unexplained for you?", targetUncertainty: "The unresolved remainder", couldWeakenSelectedFormulation: false },
          ],
        } : {}),
      })),
    });
    expect(parsed.success).toBe(true);
  });

  it("requires developmental to appear after hidden and before alternative", () => {
    const sections: Array<{
      id: string;
      title: string;
      body: string;
      evidenceRefs: string[];
    }> = REQUIRED_PEEL_SECTION_IDS.map((id, index) => ({
      id,
      title: id,
      body: "A concrete evidence-backed paragraph about the stall.",
      evidenceRefs: [`a1:Q${index + 1}.1`],
    }));
    sections.splice(2, 0, {
      id: "developmental",
      title: "The developmental tension",
      body: "A tentative opposition grounded in recurring evidence.",
      evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
    });

    expect(pass9OutputSchema.safeParse({ sections }).success).toBe(false);
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
