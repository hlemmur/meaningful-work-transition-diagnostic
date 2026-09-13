import type { Contradiction, Hypothesis, ReportSection } from "../schemas/analysis";
import {
  contradictionSchema,
  experimentSchema,
  hiddenPositionSchema,
  hypothesisSchema,
  imageVoteSchema,
  jungianLensSchema,
  realityCheckSchema,
  reportSectionSchema,
} from "../schemas/analysis";
import type { AnalysisStage } from "./models";
import { failingReportSectionIds } from "./report-grounding";

export type AnalysisFixture =
  | "default"
  | "practical-rival"
  | "image-weakens"
  | "critic-constraints-win"
  | "empty-jungian"
  | "empty-jungian-no-omit"
  | "schema-fail"
  | "origin-gold"
  | "q113-as-hidden"
  | "q113-as-central-contradiction"
  | "empty-critiques"
  | "image-insufficient-rich"
  | "starved-case-report"
  | "wrong-experiment"
  | "jungian-diagnose"
  | "senex-scold-only";

const FIXTURE_MARKERS: Array<{ marker: string; fixture: AnalysisFixture }> = [
  { marker: "FORCE_SCHEMA_FAILURE", fixture: "schema-fail" },
  { marker: "IMAGE_WEAKENS", fixture: "image-weakens" },
  { marker: "CRITIC_CONSTRAINTS_WIN", fixture: "critic-constraints-win" },
  { marker: "EMPTY_JUNGIAN_NO_OMIT", fixture: "empty-jungian-no-omit" },
  { marker: "EMPTY_JUNGIAN", fixture: "empty-jungian" },
  { marker: "ORIGIN_GOLD", fixture: "origin-gold" },
  { marker: "Q113_AS_HIDDEN", fixture: "q113-as-hidden" },
  { marker: "Q113_AS_CENTRAL", fixture: "q113-as-central-contradiction" },
  { marker: "EMPTY_CRITIQUES", fixture: "empty-critiques" },
  { marker: "IMAGE_INSUFFICIENT_RICH", fixture: "image-insufficient-rich" },
  { marker: "STARVED_CASE_REPORT", fixture: "starved-case-report" },
  { marker: "WRONG_EXPERIMENT", fixture: "wrong-experiment" },
  { marker: "JUNGIAN_DIAGNOSE", fixture: "jungian-diagnose" },
  { marker: "SENEX_SCOLD_ONLY", fixture: "senex-scold-only" },
];

export function inferAnalysisFixture(answers: Record<string, unknown>): AnalysisFixture {
  const blob = JSON.stringify(answers);
  for (const { marker, fixture } of FIXTURE_MARKERS) {
    if (blob.includes(marker)) {
      return fixture;
    }
  }
  if (typeof answers["Q0.5"] === "string" && answers["Q0.5"].trim()) {
    return "practical-rival";
  }
  return "default";
}

function scoring(overrides: Partial<Hypothesis["scoring"]> = {}): Hypothesis["scoring"] {
  return {
    evidenceCoverage: 0.7,
    crossContextRecurrence: 0.6,
    contradictionResolution: 0.7,
    personSpecificity: 0.6,
    developmentalFit: 0.5,
    imageConstraintFit: 0.5,
    counterEvidencePenalty: 0.1,
    simplerAlternativePenalty: 0.2,
    ...overrides,
  };
}

function hyp(
  id: string,
  category: Hypothesis["category"],
  title: string,
  evidenceRef: string,
  extras: Partial<Hypothesis> = {},
): Hypothesis {
  return hypothesisSchema.parse({
    id,
    title,
    category,
    observedPattern: title,
    evidenceFor: [evidenceRef],
    evidenceAgainst: [],
    contradictionsExplained: ["c-central"],
    contradictionsNotExplained: [],
    simplerAlternatives: ["The stall is a practical constraint."],
    missingInformation: [],
    originForks: ["history_vs_stated_cause"],
    scoring: scoring(),
    confidence: "tentative",
    ...extras,
  });
}

function contradiction(
  assessmentId: string,
  evidenceRef: string,
  fixture: AnalysisFixture,
): Contradiction {
  if (fixture === "q113-as-central-contradiction") {
    return contradictionSchema.parse({
      id: "c-central",
      statementA: "I want sharp angles I cannot unsee",
      statementB: "I want confirmation of the path",
      evidenceA: [`${assessmentId}:Q11.3`],
      evidenceB: [`${assessmentId}:Q11.3`],
      significance: "meta hunger",
      categories: ["insight"],
      originForks: ["legitimacy_loop"],
      scores: {
        evidenceStrength: 0.8,
        recurrence: 0.5,
        explanatoryImportance: 0.9,
        charge: 0.5,
      },
    });
  }
  if (fixture === "origin-gold" || fixture === "wrong-experiment") {
    return contradictionSchema.parse({
      id: "c-central",
      statementA: "I want freedom and self-employment",
      statementB: "I function when external structure carries deadlines",
      evidenceA: [evidenceRef],
      evidenceB: [`${assessmentId}:Q4.8`],
      significance: "container vs freedom",
      categories: ["structure"],
      originForks: ["container_loss_vs_capacity"],
      scores: {
        evidenceStrength: 0.9,
        recurrence: 0.9,
        explanatoryImportance: 0.9,
        charge: 0.8,
      },
    });
  }
  return contradictionSchema.parse({
    id: "c-central",
    statementA: "I want work that feels alive.",
    statementB: "I keep not taking the next concrete step.",
    evidenceA: [evidenceRef],
    evidenceB: [evidenceRef],
    significance: "The stall sits next to a stated desire.",
    categories: ["action_vs_desire"],
    originForks: ["history_vs_stated_cause"],
    scores: {
      evidenceStrength: 0.8,
      recurrence: 0.7,
      explanatoryImportance: 0.9,
      charge: 0.6,
    },
  });
}

function groundedReportSections(
  fixture: AnalysisFixture,
  ctx: { assessmentId: string; evidenceRef: string },
): ReportSection[] {
  const q = (questionId: string) => `${ctx.assessmentId}:${questionId}`;

  if (fixture === "starved-case-report") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You seek sharp angles you cannot unsee.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Insight hunger dominates.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "Wanting revelation and confirmation.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Maybe confidence.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Ask for sharper critique.",
        evidenceRefs: [q("Q11.3")],
      }),
    ];
  }

  if (fixture === "jungian-diagnose") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You described a stall next to a desire for more alive work.",
        evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Practical constraints and missing structure are in the picture.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "Wanting the work and not taking the next step sit together.",
        evidenceRefs: [q("Q1.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis is that structure is being asked to serve aliveness.",
        evidenceRefs: [q("Q1.3"), q("Q2.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "The stall may be a sufficient response to constraints, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Try two weeks of external deadlines and watch both output and charge.",
        evidenceRefs: [q("Q1.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "You are a Puer. Grow up and grind until the vision dies into discipline.",
        evidenceRefs: [q("Q2.1")],
      }),
    ];
  }

  if (fixture === "senex-scold-only") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You stall because you avoid the unglamorous discomfort of daily execution.",
        evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Stop seeking insight. Grow up and grind. Just need more discipline every day.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "Wanting ease while refusing ordinary work.",
        evidenceRefs: [q("Q1.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "There is no alternative reading; only harder work.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Force yourself through two weeks of grind with no other measure of success.",
        evidenceRefs: [q("Q1.1")],
      }),
    ];
  }

  if (fixture === "origin-gold") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You left IT for meaningful coaching work yet freeze at public exposure after years of container-supported functioning.",
        evidenceRefs: [q("Q1.1"), q("Q2.2")],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Without external deadlines, salary, and legitimacy you stall; ADHD and financial pressure are real constraints. Money historically arrived through industry machinery, not pure self-authorization.",
        evidenceRefs: [q("Q0.5"), q("Q8.4"), q("Q4.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want freedom and self-employment, yet you function when structure and accountability impact someone else. Projection toward grounded mentors points to a hooked quality of claiming space.",
        evidenceRefs: [q("Q1.2"), q("Q5.1"), q("Q4.8")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis: freedom while an external container still carries authority and money. Protection keeps lightness; the developmental aim may be structure in service of aliveness. The bargain protects ethereal identity while the pipe image marks a threshold mid-crossing.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "This may simply be missing acquisition skill and ADHD-friendly infrastructure, not a hidden stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run outreach under a mutual dependency with real stakes and watch output plus body charge — testing container loss versus capacity.",
        evidenceRefs: [q("QB.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "A puer–senex polarity may illuminate possibility preferred over incarnation, without diagnosing you as an archetype. Limits: ADHD and job-shape mismatch may still suffice.",
        evidenceRefs: [q("Q9.2")],
      }),
    ];
  }

  const sections = [
    reportSectionSchema.parse({
      id: "problem",
      title: "The problem as you see it",
      body: "You described a stall next to a desire for more alive work.",
      evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
    }),
    reportSectionSchema.parse({
      id: "reality",
      title: "What reality says",
      body: "Practical constraints and missing structure are in the picture.",
      evidenceRefs: [q("Q0.4"), q("Q0.5")],
    }),
    reportSectionSchema.parse({
      id: "contradiction",
      title: "The contradiction at the center",
      body: "Wanting the work and not taking the next step sit together.",
      evidenceRefs: [q("Q1.1"), q("Q1.3")],
    }),
    reportSectionSchema.parse({
      id: "alternative",
      title: "Another plausible interpretation",
      body: "The stall may be a sufficient response to constraints, not a hidden stance.",
      evidenceRefs: [q("Q0.5")],
    }),
    reportSectionSchema.parse({
      id: "experiment",
      title: "Your experiment",
      body: "Try two weeks of external deadlines and watch both output and charge.",
      evidenceRefs: [q("Q1.1")],
    }),
  ];
  if (fixture !== "critic-constraints-win") {
    sections.splice(
      3,
      0,
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis is that structure is being asked to serve aliveness.",
        evidenceRefs: [q("Q1.3"), q("Q2.1")],
      }),
    );
  }
  if (fixture !== "empty-jungian") {
    sections.push(
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "Compensation may illuminate the stall without naming you as an archetype.",
        evidenceRefs: [q("Q2.1")],
      }),
    );
  }
  return sections;
}

export function passOutputFor(
  stage: AnalysisStage,
  fixture: AnalysisFixture,
  ctx: {
    assessmentId: string;
    evidenceRef: string;
    requestedInsight?: string;
    draftReport?: { sections: ReportSection[] };
  },
) {
  if (fixture === "schema-fail" && stage === "pass3") {
    return {};
  }

  const depth = hyp(
    "hyp-depth",
    "psychological",
    fixture === "origin-gold" || fixture === "wrong-experiment"
      ? "Container loss vs capacity — freedom without internalized structure stalls action"
      : "The stall may be protecting a not-yet-incarnated way of working.",
    ctx.evidenceRef,
    {
      originForks:
        fixture === "origin-gold" || fixture === "wrong-experiment"
          ? ["container_loss_vs_capacity"]
          : ["history_vs_stated_cause"],
      scoring: scoring({
        imageConstraintFit: 0.9,
        simplerAlternativePenalty: 0.2,
      }),
    },
  );
  const practical = hyp(
    "hyp-practical",
    "practical",
    "Constraints and missing infrastructure may be enough to explain the stall.",
    ctx.evidenceRef,
    {
      category: "practical",
      scoring: scoring({
        evidenceCoverage: fixture === "image-weakens" ? 0.88 : 0.65,
        crossContextRecurrence: fixture === "image-weakens" ? 0.8 : 0.55,
        contradictionResolution: fixture === "image-weakens" ? 0.8 : 0.55,
        personSpecificity: fixture === "image-weakens" ? 0.75 : 0.55,
        developmentalFit: 0.4,
        imageConstraintFit: fixture === "image-weakens" ? 0.35 : 0.4,
        simplerAlternativePenalty: 0.04,
      }),
    },
  );
  const identity = hyp(
    "hyp-identity",
    "identity",
    "The work may be carrying a legitimacy demand the person cannot settle.",
    ctx.evidenceRef,
  );

  const includePractical =
    fixture === "practical-rival" ||
    fixture === "critic-constraints-win" ||
    fixture === "image-weakens" ||
    fixture === "origin-gold" ||
    fixture === "empty-jungian";
  const hypotheses = includePractical
    ? [depth, practical, identity]
    : [depth, identity, hyp("hyp-env", "environmental", "The current container may be missing.", ctx.evidenceRef)];

  switch (stage) {
    case "pass1":
      return { consciousExplanationTags: ["lack_of_confidence"], unresolvedQuestions: [] };
    case "pass2":
      return { contradictions: [contradiction(ctx.assessmentId, ctx.evidenceRef, fixture)] };
    case "pass3":
      return { hypotheses };
    case "pass4":
      if (fixture === "empty-critiques") {
        return { critiques: [] };
      }
      return {
        critiques: hypotheses.map((item) => ({
          hypothesisId: item.id,
          mundaneAlternative: "Money, visa, or labor-market constraints may suffice.",
          survives: !(fixture === "critic-constraints-win" && item.id === "hyp-depth"),
        })),
      };
    case "pass5": {
      const weakens = fixture === "image-weakens";
      const richInsufficient = fixture === "image-insufficient-rich";
      const originGold = fixture === "origin-gold";
      return {
        votes: [
          imageVoteSchema.parse({
            hypothesisId: "hyp-depth",
            verdict: weakens
              ? "weakens"
              : originGold
                ? "supports"
                : richInsufficient
                  ? "insufficient"
                  : "insufficient",
            note: weakens
              ? "The empty landscape points to job-shape / direction, not a hidden stance."
              : originGold
                ? "Pipe mid-threshold associations support container/authorization polarity."
                : richInsufficient
                  ? "Vote declined; material left uncited."
                  : "Too thin to vote.",
            evidenceRefs: originGold
              ? [`${ctx.assessmentId}:Q10.1`, `${ctx.assessmentId}:Q10.6`]
              : [ctx.evidenceRef],
          }),
          imageVoteSchema.parse({
            hypothesisId: practical.id,
            verdict: weakens ? "supports" : originGold ? "splits" : "insufficient",
            note: weakens
              ? "No path is a practical-direction constraint."
              : originGold
                ? "Practical constraints remain a live rival beside the image."
                : "Too thin.",
            evidenceRefs: originGold
              ? [`${ctx.assessmentId}:Q0.5`, `${ctx.assessmentId}:Q10.1`]
              : [ctx.evidenceRef],
          }),
        ],
        overallNote: weakens
          ? "Image weakens the psychological favorite."
          : originGold
            ? "Image supports container polarity with practical rival intact."
            : richInsufficient
              ? "Insufficient without citing associations."
              : "Insufficient image.",
      };
    }
    case "pass6": {
      if (fixture === "critic-constraints-win") {
        return { hiddenPosition: null, alternative: practical.observedPattern };
      }
      if (fixture === "q113-as-hidden") {
        return {
          hiddenPosition: hiddenPositionSchema.parse({
            consciousPosition: "I need confidence.",
            observedPattern: "Insight hunger.",
            possibleHiddenPosition:
              ctx.requestedInsight?.trim() ||
              "I hope it shows me some sharp angles that I can't unsee",
            protectiveFunction: ["Keeps seeking"],
            possibleCompensatoryAim: "Sit with ordinary exposure instead of seeking revelation",
            threatenedByChange: ["Ordinary work"],
            developmentalTension: { poleA: "insight", poleB: "execution" },
            imageVoteSummary: "insufficient",
            evidenceRefs: [`${ctx.assessmentId}:Q11.3`],
            counterEvidenceRefs: [],
            confidence: "tentative",
          }),
          alternative: practical.observedPattern,
        };
      }
      return {
        hiddenPosition: hiddenPositionSchema.parse({
          consciousPosition: "I need more confidence.",
          observedPattern:
            fixture === "origin-gold"
              ? "Freeze at exposure without container"
              : "Desire without the next concrete step.",
          possibleHiddenPosition:
            fixture === "origin-gold"
              ? "Freedom while an external container still carries authority and money"
              : "Structure is being asked to serve aliveness, not the other way around.",
          protectiveFunction: ["Keeps the work from becoming only grind."],
          possibleCompensatoryAim: "Structure in service of aliveness",
          threatenedByChange: ["Losing the feeling of possibility."],
          developmentalTension: { poleA: "possibility", poleB: "incarnation" },
          imageVoteSummary: fixture === "image-weakens" ? "weakens" : "insufficient",
          evidenceRefs: [ctx.evidenceRef],
          counterEvidenceRefs: [],
          confidence: "tentative",
        }),
        alternative: practical.observedPattern,
      };
    }
    case "pass7":
      if (fixture === "empty-jungian-no-omit") {
        return { jungianLenses: [] };
      }
      if (fixture === "empty-jungian") {
        return {
          jungianLenses: [],
          omitReason: "No clear archetypal polarity beyond practical constraints.",
        };
      }
      if (fixture === "origin-gold") {
        return {
          jungianLenses: [
            jungianLensSchema.parse({
              concept: "puer-senex polarity",
              observedPatternItIlluminates: "Possibility preferred over incarnation",
              whyUseful: "Names the developmental orbit without killing play",
              evidenceRefs: [ctx.evidenceRef],
              limitsOfInterpretation: "May also be ADHD + job-shape mismatch",
              confidence: "tentative",
            }),
          ],
        };
      }
      return {
        jungianLenses: [
          jungianLensSchema.parse({
            concept: "compensation",
            observedPatternItIlluminates: "The stall beside a stated desire.",
            whyUseful: "It names a possible balancing movement without diagnosing the person.",
            evidenceRefs: [ctx.evidenceRef],
            limitsOfInterpretation: "A practical constraint may still be sufficient.",
            confidence: "tentative",
          }),
        ],
      };
    case "pass8":
      return {
        realityCheck: realityCheckSchema.parse({
          sufficientWithoutDepth: fixture === "critic-constraints-win",
          categories:
            fixture === "critic-constraints-win"
              ? ["financial stress", "constraints"]
              : ["insufficient information"],
          narrative:
            fixture === "critic-constraints-win"
              ? "The constraints can carry the story without a deeper psychological reading."
              : "Depth is possible, but a concrete alternative remains.",
          evidenceRefs: [ctx.evidenceRef],
        }),
        experiments: [
          experimentSchema.parse({
            kind: "behavioral",
            title:
              fixture === "wrong-experiment"
                ? "Mentor critique interview"
                : "Two weeks of external deadlines",
            hypothesisTested:
              fixture === "wrong-experiment"
                ? "intellectualizing delay"
                : fixture === "critic-constraints-win"
                  ? "hyp-practical"
                  : fixture === "origin-gold"
                    ? "container_loss_vs_capacity"
                    : "hyp-depth",
            action:
              fixture === "wrong-experiment"
                ? "Ask a mentor to list three blind spots and failure points in your method."
                : fixture === "critic-constraints-win"
                  ? "Add two external deadline blocks and one accountability check-in each week."
                  : "Send one concrete artifact twice a week to a trusted reviewer.",
            duration: "14 days",
            whatToObserve: ["output count", "body charge after sending"],
            resultSupportingHypothesis: "Output rises when someone else holds the deadline.",
            resultWeakeningHypothesis: "Nothing changes even with accountability.",
            riskLevel: "low",
            practicalRequirements: ["one reviewer", "two calendar blocks"],
          }),
        ],
      };
    case "pass9":
      return { sections: groundedReportSections(fixture, ctx) };
    case "pass10": {
      const draft = ctx.draftReport?.sections ?? [];
      const failingSectionIds = failingReportSectionIds({
        sections: draft,
        requestedInsight: ctx.requestedInsight,
      });
      if (!failingSectionIds.length) {
        return { failingSectionIds: [], regeneratedSections: [] };
      }
      const grounded = groundedReportSections(
        fixture === "starved-case-report" ? "default" : fixture,
        ctx,
      );
      return {
        failingSectionIds,
        regeneratedSections: grounded.filter((section) => failingSectionIds.includes(section.id)),
      };
    }
  }
}
