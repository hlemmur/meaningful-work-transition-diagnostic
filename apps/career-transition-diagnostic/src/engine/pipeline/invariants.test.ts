import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { reportSectionSchema } from "@/engine/schemas/analysis";
import { CANONICAL_PEEL_TITLES } from "./gates";
import { sanitizeReportSections } from "./invariants";

describe("sanitizeReportSections", () => {
  it("normalizes near-miss peel titles to canonical labels by section id", () => {
    const state = emptyCaseState("a1");
    state.hiddenPosition = {
      consciousPosition: "I lack confidence",
      observedPattern: "freeze at outreach",
      possibleHiddenPosition: "purity bargain",
      protectiveFunction: ["keeps potential intact"],
      possibleCompensatoryAim: "structure in service of aliveness",
      threatenedByChange: ["exposure"],
      developmentalTension: { poleA: "freedom", poleB: "structure" },
      imageVoteSummary: "supports",
      evidenceRefs: ["a1:Q1.1"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };
    state.jungianLenses = [
      {
        concept: "compensation",
        observedPatternItIlluminates: "stall beside desire",
        whyUseful: "names a balancing movement",
        evidenceRefs: ["a1:Q2.1"],
        limitsOfInterpretation: "may be practical only",
        confidence: "tentative",
      },
    ];

    const sanitized = sanitizeReportSections(
      [
        reportSectionSchema.parse({
          id: "hidden",
          title: "The hidden position",
          body: "You may be protecting a purity bargain.",
          evidenceRefs: ["a1:Q1.1"],
        }),
        reportSectionSchema.parse({
          id: "experiment",
          title: "Experiments you can run this week",
          body: "For two weeks you try a minimum viable offer.",
          evidenceRefs: ["a1:Q1.1"],
        }),
        reportSectionSchema.parse({
          id: "jungian",
          title: "The Jungian lens",
          body: "A polarity may illuminate without diagnosing you.",
          evidenceRefs: ["a1:Q2.1"],
        }),
      ],
      state,
    );

    expect(sanitized.map((section) => [section.id, section.title])).toEqual([
      ["hidden", CANONICAL_PEEL_TITLES.hidden],
      ["experiment", CANONICAL_PEEL_TITLES.experiment],
      ["jungian", CANONICAL_PEEL_TITLES.jungian],
    ]);
  });

  it("drops invented assessment-scoped evidence refs", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
    });
  
    const sections = [
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body:
          "You have both practical and symbolic material.",
        evidenceRefs: [
          "a1:Q10.1",
          "a1:Q99.7",
        ],
      }),
    ];
  
    const sanitized =
      sanitizeReportSections(
        sections,
        state,
      );
  
    expect(
      sanitized[0]?.evidenceRefs,
    ).toEqual(["a1:Q10.1"]);
  });
  it("uses a real CaseState evidence ref as fallback when all supplied refs are invalid", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
    });
  
    const sections = [
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body:
          "You keep encountering the same stall.",
        evidenceRefs: [
          "a1:Q99.7",
        ],
      }),
    ];
  
    const sanitized =
      sanitizeReportSections(
        sections,
        state,
      );
  
    expect(
      sanitized[0]?.evidenceRefs,
    ).toEqual(["a1:Q1.1"]);
  });
});
