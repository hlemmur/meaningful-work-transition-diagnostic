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
import type { AnalysisStage } from "../pipeline/models";
import { failingReportSectionIds } from "../pipeline/report-grounding";

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
  | "senex-scold-only"
  | "image-starved-peel"
  | "projection-starved-peel"
  | "money-starved-peel"
  | "clinical-voice-peel"
  | "aim-missing-peel"
  | "speech-without-imaginal"
  | "becoming-inflation-peel"
  | "non-origin-soft-mini";

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
  { marker: "IMAGE_STARVED_PEEL", fixture: "image-starved-peel" },
  { marker: "PROJECTION_STARVED_PEEL", fixture: "projection-starved-peel" },
  { marker: "MONEY_STARVED_PEEL", fixture: "money-starved-peel" },
  { marker: "CLINICAL_VOICE_PEEL", fixture: "clinical-voice-peel" },
  { marker: "AIM_MISSING_PEEL", fixture: "aim-missing-peel" },
  { marker: "SPEECH_WITHOUT_IMAGINAL", fixture: "speech-without-imaginal" },
  { marker: "BECOMING_INFLATION_PEEL", fixture: "becoming-inflation-peel" },
  { marker: "NON_ORIGIN_SOFT_MINI", fixture: "non-origin-soft-mini" },
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

function ensureQuestionsAndClose(
  sections: ReportSection[],
  ctx: {
    assessmentId: string;
    evidenceRef: string;
  },
): ReportSection[] {
  const q = (questionId: string) =>
    `${ctx.assessmentId}:${questionId}`;

  const next = [...sections];

  if (
    !next.some(
      (section) => section.id === "questions",
    )
  ) {
    next.push(
      reportSectionSchema.parse({
        id: "questions",
        title: "Three questions to stay with",
        body:
          "1. What changes when you treat the stall as information rather than proof that you cannot do the work?\n\n2. Which explanation would you most want to disprove through action?\n\n3. What would you learn if the next step became smaller and more observable?",
        evidenceRefs: [
          q("Q1.1"),
          q("Q1.3"),
          q("Q2.2"),
        ],
      }),
    );
  }

  if (
    !next.some(
      (section) => section.id === "close",
    )
  ) {
    next.push(
      reportSectionSchema.parse({
        id: "close",
        title: "A working formulation",
        body:
          "You do not need to treat this interpretation as a verdict. Use it as a working formulation: something to test against your experience and revise when reality gives you better evidence.",
        evidenceRefs: [
          ctx.evidenceRef,
        ],
      }),
    );
  }

  return next;
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
        body: "Insight hunger dominates your attention.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want revelation and confirmation at once.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Maybe your issue is confidence.",
        evidenceRefs: [q("Q11.3")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Ask for sharper critique of your method.",
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
        body: "Your practical constraints and missing structure are in the picture.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body:
          "You want the work, yet your own account shows action stopping before the next concrete step.",
        evidenceRefs: [
          q("Q1.1"),
          q("Q1.3"),
          q("Q2.2"),
        ],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis is that your protection keeps possibility intact while structure is being asked to serve aliveness.",
        evidenceRefs: [q("Q1.3"), q("Q2.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Your stall may be a sufficient response to constraints, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Try two weeks of external deadlines and watch both your output and charge.",
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
        body: "Stop seeking insight. Grow up and grind. You just need more discipline every day.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want ease while refusing ordinary work.",
        evidenceRefs: [q("Q1.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "There is no alternative reading for you; only harder work.",
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

  if (fixture === "image-starved-peel") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You left container-supported work yet freeze at public exposure; legitimacy and identity feel unsettled.",
        evidenceRefs: [q("Q1.1"), q("Q2.2")],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Without external deadlines, salary, and legitimacy you stall; ADHD and financial pressure are real. Money historically arrived through industry machinery.",
        evidenceRefs: [q("Q0.5"), q("Q8.4"), q("Q4.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want freedom yet function when structure impacts someone else. Admiration for grounded mentors marks a hooked quality of claiming space.",
        evidenceRefs: [q("Q1.2"), q("Q5.1"), q("Q4.8")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis for you: freedom while an external container still carries authority. Your bargain protects ethereal identity and lightness; developmental aim may be structure in service of aliveness.",
        evidenceRefs: [q("Q9.2"), q("Q9.3")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "You may simply be missing acquisition skill and ADHD-friendly infrastructure, not a hidden stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run your outreach under mutual dependency — and briefly imagine the rusty pipe threshold as garnish only.",
        evidenceRefs: [q("QB.1"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "A puer–senex polarity may illuminate possibility preferred over incarnation, without diagnosing you as an archetype.",
        evidenceRefs: [q("Q9.2")],
      }),
    ];
  }

  if (fixture === "projection-starved-peel") {
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
        body: "Without external deadlines, salary, and legitimacy you stall; ADHD and financial pressure are real. Money historically arrived through industry machinery. The pipe associations mark a mid-crossing threshold.",
        evidenceRefs: [q("Q0.5"), q("Q8.4"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want freedom and self-employment, yet you function when structure and accountability impact someone else.",
        evidenceRefs: [q("Q1.2"), q("Q4.8")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis for you: freedom while an external container still carries authority and money. Your protection keeps lightness; the developmental aim may be structure in service of aliveness. The bargain protects ethereal identity while the pipe image marks a threshold mid-crossing.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q10.6")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "You may simply be missing acquisition skill and ADHD-friendly infrastructure, not a hidden stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run your outreach under a mutual dependency with real stakes and watch output plus body charge — testing container loss versus capacity.",
        evidenceRefs: [q("QB.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "A puer–senex polarity may illuminate possibility preferred over incarnation, without diagnosing you as an archetype.",
        evidenceRefs: [q("Q9.2")],
      }),
    ];
  }

  if (fixture === "money-starved-peel") {
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
        body: "Without external deadlines and legitimacy you stall; ADHD pressure is real. The pipe associations mark a mid-crossing threshold without naming compensation history.",
        evidenceRefs: [q("Q0.5"), q("Q4.5"), q("Q10.1")],
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
        body: "One hypothesis for you: freedom while an external container still carries authority. Your protection keeps lightness; the developmental aim may be structure in service of aliveness. The bargain protects ethereal identity while the pipe image marks a threshold mid-crossing.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q10.6")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "You may simply be missing outreach skill and ADHD-friendly routines, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run your outreach under a mutual dependency with real stakes and watch output plus body charge — testing container loss versus capacity.",
        evidenceRefs: [q("QB.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "A puer–senex polarity may illuminate possibility preferred over incarnation, without diagnosing you as an archetype.",
        evidenceRefs: [q("Q9.2")],
      }),
    ];
  }

  if (fixture === "clinical-voice-peel") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The Stated Predicament and Economic Pressure",
        body: "The client presents a compelling and urgent narrative centered around stall after leaving IT.",
        evidenceRefs: [q("Q1.1"), q("Q2.2")],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "Image, Money Infrastructure, and Enacted History",
        body: "Examining the deeper structural layers reveals evocative imagery: a rusty pipe mid-crossing. Money historically arrived through industry machinery.",
        evidenceRefs: [q("Q0.5"), q("Q8.4"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "Core Contradictions in the Transition Process",
        body: "The client's freedom desire conflicts with freeze at exposure. Projection toward mentors marks a hooked quality of claiming space.",
        evidenceRefs: [q("Q1.2"), q("Q5.1"), q("Q4.8")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "The Protective Bargain and Projected Desires",
        body: "Beneath the surface lies a sophisticated psychological bargain illuminated by the client's projections onto admired figures.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q6.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Alternative Interpretations and Practical Realities",
        body: "The client's stall may simply be missing acquisition skill and ADHD-friendly infrastructure.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Empirical Investigations",
        body: "The client should run outreach under mutual dependency and watch body charge.",
        evidenceRefs: [q("QB.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "Polarity and Compensation Dynamics",
        body: "From a process-oriented psychological perspective, the client's journey shows enantiodromia between possibility and incarnation.",
        evidenceRefs: [q("Q9.2")],
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
        body: "One hypothesis for you: freedom while an external container still carries authority and money. Your protection keeps lightness; the developmental aim may be structure in service of aliveness. The bargain protects ethereal identity while the pipe image marks a threshold mid-crossing.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "You may simply be missing acquisition skill and ADHD-friendly infrastructure, not a hidden stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run your outreach under a mutual dependency with real stakes and watch output plus body charge — testing container loss versus capacity.",
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

  if (fixture === "aim-missing-peel") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You described a stall next to a desire for more alive work; legitimacy and identity feel unsettled.",
        evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Your practical constraints and missing structure are in the picture.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body:
          "You want the work, yet your own account shows action stopping before the next concrete step.",
        evidenceRefs: [
          q("Q1.1"),
          q("Q1.3"),
          q("Q2.2"),
        ],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis: your protection keeps possibility intact and the bargain shields you from ordinary exposure.",
        evidenceRefs: [q("Q1.3"), q("Q2.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Your stall may be a sufficient response to constraints, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Try two weeks of external deadlines and watch both your output and charge.",
        evidenceRefs: [q("Q1.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "Compensation may illuminate the stall without naming you as an archetype.",
        evidenceRefs: [q("Q2.1")],
      }),
    ];
  }

  if (fixture === "speech-without-imaginal") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You freeze before claiming space; legitimacy and identity feel unsettled.",
        evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Without a co-working block you stall; the locked garden gate threshold is material in the case record.",
        evidenceRefs: [q("Q0.5"), q("Q10.1")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You want claimed pace and still wait for permission.",
        evidenceRefs: [q("Q1.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis: your protection keeps lightness while the developmental aim may be structure in service of aliveness — without naming the mid-crossing threshold further.",
        evidenceRefs: [q("Q1.3"), q("Q10.6")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Focus drift alone may explain your stall, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, add two co-working blocks for yourself and watch your output plus body charge.",
        evidenceRefs: [q("Q1.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "Compensation may illuminate the stall without naming you as an archetype.",
        evidenceRefs: [q("Q1.3")],
      }),
    ];
  }

  if (fixture === "becoming-inflation-peel") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You described a stall next to a desire for more alive work; legitimacy and identity feel unsettled.",
        evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Your practical constraints and missing structure are in the picture.",
        evidenceRefs: [q("Q0.4"), q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body:
          "You want the work, yet your own account shows action stopping before the next concrete step.",
        evidenceRefs: [
          q("Q1.1"),
          q("Q1.3"),
          q("Q2.2"),
        ],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis: your protection keeps possibility intact while the developmental aim may be structure in service of aliveness. The romance of eternal becoming is named as your identity here.",
        evidenceRefs: [q("Q1.3"), q("Q2.1")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Your stall may be a sufficient response to constraints, not a hidden stance.",
        evidenceRefs: [q("Q0.5")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "Try two weeks of external deadlines and watch both your output and charge.",
        evidenceRefs: [q("Q1.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "Compensation may illuminate the stall without naming you as an archetype.",
        evidenceRefs: [q("Q2.1")],
      }),
    ];
  }

  if (fixture === "non-origin-soft-mini") {
    return [
      reportSectionSchema.parse({
        id: "problem",
        title: "The problem as you see it",
        body: "You freeze before claiming space and wait for permission; identity and legitimacy feel unsettled.",
        evidenceRefs: [q("Q1.1"), q("Q2.2")],
      }),
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body: "Without a co-working block you stall. Money historically arrived through a family shop till. Ask what the locked garden gate's voice wants when it replies turn back until the ground is yours.",
        evidenceRefs: [q("Q0.5"), q("Q8.4"), q("Q10.1"), q("Q10.6")],
      }),
      reportSectionSchema.parse({
        id: "contradiction",
        title: "The contradiction at the center",
        body: "You admire a quiet craftsperson who owns their pace, yet you reject loud hustle performers while still waiting to claim that pace yourself.",
        evidenceRefs: [q("Q5.1"), q("Q6.1"), q("Q1.3")],
      }),
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: "One hypothesis for you: your protection keeps cool distance while the developmental aim may be structure in service of aliveness — owning pace without collapsing into grind-only identity.",
        evidenceRefs: [q("Q9.2"), q("Q9.3"), q("Q10.6")],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "Another plausible interpretation",
        body: "Focus drift and missing co-working infrastructure may suffice for you without a deeper stance.",
        evidenceRefs: [q("Q0.5"), q("Q8.4")],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "Your experiment",
        body: "For two weeks, run two co-working blocks with a mutual check-in and watch your output plus body charge.",
        evidenceRefs: [q("Q1.1")],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "A Jungian lens",
        body: "A possibility–incarnation polarity may illuminate your stall without diagnosing you as an archetype.",
        evidenceRefs: [q("Q9.2")],
      }),
    ];
  }

  const sections = [
    reportSectionSchema.parse({
      id: "problem",
      title: "The problem as you see it",
      body: "You described a stall next to a desire for more alive work; legitimacy and identity feel unsettled.",
      evidenceRefs: [q("Q1.1"), ctx.evidenceRef],
    }),
    reportSectionSchema.parse({
      id: "reality",
      title: "What reality says",
      body: "Your practical constraints and missing structure are in the picture. When an image or scene arrives, it belongs here as material, not garnish.",
      evidenceRefs: [q("Q0.4"), q("Q0.5"), q("Q10.1")],
    }),
    reportSectionSchema.parse({
      id: "contradiction",
      title: "The contradiction at the center",
      body:
        "You want the work, yet your own account shows action stopping before the next concrete step.",
      evidenceRefs: [
        q("Q1.1"),
        q("Q1.3"),
        q("Q2.2"),
      ],
    }),
    reportSectionSchema.parse({
      id: "alternative",
      title: "Another plausible interpretation",
      body: "Your stall may be a sufficient response to constraints, not a hidden stance.",
      evidenceRefs: [q("Q0.5")],
    }),
    reportSectionSchema.parse({
      id: "experiment",
      title: "Your experiment",
      body: "Try two weeks of external deadlines and watch both your output and charge.",
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
        body: "One hypothesis is that your protection keeps possibility intact while the developmental aim may be structure in service of aliveness — without collapsing into grind-only identity. Ask what the image's voice wants at the scene you keep circling.",
        evidenceRefs: [q("Q1.3"), q("Q2.1"), q("Q10.1")],
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

function forkResolutionFor(
  fixture: AnalysisFixture,
  hypothesis: Hypothesis,
  ctx: {
    assessmentId: string;
    evidenceRef: string;
  },
) {
  const forkId =
    hypothesis.originForks[0] ??
    "history_vs_stated_cause";

  const practicalWins =
    fixture === "critic-constraints-win";

  return {
    forkId,

    status: practicalWins
      ? ("leans_b" as const)
      : ("leans_a" as const),

    interpretation: practicalWins
      ? "Current practical constraints provide the stronger explanation."
      : "The available evidence currently leans toward the selected hypothesis, while the rival remains plausible.",

    evidenceRefs: [
      ctx.evidenceRef,
    ],

    importance: "high" as const,

    reportWorthiness: true,
  };
}

function finalFormulationFor(
  selected: Hypothesis,
  practical: Hypothesis,
  fixture: AnalysisFixture,
) {
  return {
    selectedHypothesisId:
      selected.id,

    centralFormulation:
      fixture === "critic-constraints-win"
        ? "The current stall may be sufficiently explained by practical constraints and missing infrastructure."
        : selected.observedPattern,

    whyItFits:
      selected.evidenceFor.length
        ? selected.evidenceFor
        : [
            "It explains the strongest current contradiction.",
          ],

    whatItDoesNotExplain:
      selected.contradictionsNotExplained.length
        ? selected.contradictionsNotExplained
        : [
            "Some practical constraints remain independently relevant.",
          ],

    strongestAlternative:
      practical.observedPattern,

    unresolvedForks: [],
  };
}


export function passOutputFor(
  stage: AnalysisStage,
  fixture: AnalysisFixture,
  ctx: {
    assessmentId: string;
    evidenceRef: string;
    requestedInsight?: string;
    draftReport?: { sections: ReportSection[] };
    experimentBindings?: {
      hypothesisIds: string[];
      openForkIds: string[];
      preferredHypothesisId?: string;
    };
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
    fixture === "empty-jungian" ||
    fixture === "non-origin-soft-mini" ||
    fixture === "speech-without-imaginal";
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
          critiques: hypotheses.map((item) => {
            const rejectedByCritic =
              fixture === "critic-constraints-win" &&
              item.id === "hyp-depth";
      
            return {
              hypothesisId: item.id,
      
              strongestMundaneAlternative:
                "Money, practical constraints, or missing infrastructure may be sufficient.",
      
              counterEvidenceRefs:
                rejectedByCritic
                  ? [ctx.evidenceRef]
                  : [],
      
              missingEvidence:
                rejectedByCritic
                  ? [
                      "Evidence that the pattern persists when practical constraints are reduced.",
                    ]
                  : [],
      
              confirmationBiasRisk:
                item.category === "psychological"
                  ? "The interpretation may privilege depth because a psychological explanation is more interesting."
                  : "Low, but practical explanations can also become overly convenient.",
      
              overPsychologizingRisk:
                item.category === "psychological"
                  ? "Practical or environmental constraints may explain the stall without a hidden position."
                  : "Low.",
      
              evidenceActuallyUniqueToHypothesis:
                rejectedByCritic
                  ? []
                  : item.evidenceFor,
      
              rankAdjustment:
                rejectedByCritic
                  ? "reject"
                  : "keep",
      
              reason:
                rejectedByCritic
                  ? "The practical constraints currently explain the pattern without requiring the depth hypothesis."
                  : "The hypothesis remains plausible after considering the strongest simpler alternative.",
            };
          }),
        };
    case "pass5": {
      const weakens = fixture === "image-weakens";
      const richInsufficient = fixture === "image-insufficient-rich";
      const citesImage =
        fixture === "origin-gold" ||
        fixture === "image-starved-peel" ||
        fixture === "projection-starved-peel" ||
        fixture === "money-starved-peel" ||
        fixture === "clinical-voice-peel" ||
        fixture === "speech-without-imaginal" ||
        fixture === "non-origin-soft-mini";
      return {
        votes: [
          imageVoteSchema.parse({
            hypothesisId: "hyp-depth",
          
            verdict: weakens
              ? "weakens"
              : citesImage
                ? "supports"
                : "insufficient",
          
            interpretation: weakens
              ? "The empty landscape points more toward direction or job shape than toward a hidden stance."
              : citesImage
                ? "The supplied threshold image is compatible with the container/authorization hypothesis."
                : "The supplied symbolic material is too thin to constrain the hypothesis.",
          
            evidenceRefs: citesImage
              ? [
                  `${ctx.assessmentId}:Q10.1`,
                  `${ctx.assessmentId}:Q10.6`,
                ]
              : [ctx.evidenceRef],
          
            exactClientMaterialUsed: citesImage
              ? [
                  `${ctx.assessmentId}:Q10.1`,
                  `${ctx.assessmentId}:Q10.6`,
                ]
              : [],
          }),
          imageVoteSchema.parse({
            hypothesisId: practical.id,
          
            verdict: weakens
              ? "supports"
              : citesImage
                ? "splits"
                : "insufficient",
          
            interpretation: weakens
              ? "The image is more compatible with a practical-direction problem."
              : citesImage
                ? "The image does not eliminate the practical explanation."
                : "There is not enough symbolic material to constrain the practical hypothesis.",
          
            evidenceRefs: citesImage
              ? [
                  `${ctx.assessmentId}:Q0.5`,
                  `${ctx.assessmentId}:Q10.1`,
                ]
              : [ctx.evidenceRef],
          
            exactClientMaterialUsed: citesImage
              ? [`${ctx.assessmentId}:Q10.1`]
              : [],
          }),
        ],
        overallNote: weakens
          ? "Image weakens the psychological favorite."
          : citesImage
            ? "Image supports container polarity with practical rival intact."
            : richInsufficient
              ? "Insufficient without citing associations."
              : "Insufficient image.",
      };
    }
    
    case "pass6": {
      const selected =
        fixture === "critic-constraints-win"
          ? practical
          : fixture === "image-weakens"
            ? practical
            : depth;
    
      const forkResolutions = [
        forkResolutionFor(
          fixture,
          selected,
          ctx,
        ),
      ];
    
      const finalFormulation =
        finalFormulationFor(
          selected,
          practical,
          fixture,
        );
    
      if (
        fixture ===
        "critic-constraints-win"
      ) {
        return {
          selectedHypothesisId:
            selected.id,
    
          forkResolutions,
    
          finalFormulation,
    
          hiddenPosition: null,
    
          alternative:
            practical.observedPattern,
        };
      }
    
      if (
        fixture === "q113-as-hidden"
      ) {
        return {
          selectedHypothesisId:
            selected.id,
    
          forkResolutions,
    
          finalFormulation,
    
          hiddenPosition:
            hiddenPositionSchema.parse({
              consciousPosition:
                "I need confidence.",
    
              observedPattern:
                "Insight hunger.",
    
              possibleHiddenPosition:
                ctx.requestedInsight?.trim() ||
                "I hope it shows me some sharp angles that I can't unsee",
    
              protectiveFunction: [
                "Keeps seeking",
              ],
    
              possibleCompensatoryAim:
                "Sit with ordinary exposure instead of seeking revelation",
    
              threatenedByChange: [
                "Ordinary work",
              ],
    
              developmentalTension: {
                poleA: "insight",
                poleB: "execution",
              },
    
              imageVoteSummary:
                "insufficient",
    
              evidenceRefs: [
                `${ctx.assessmentId}:Q11.3`,
              ],
    
              counterEvidenceRefs: [],
    
              confidence: "tentative",
            }),
    
          alternative:
            practical.observedPattern,
        };
      }
    
      return {
        selectedHypothesisId:
          selected.id,
    
        forkResolutions,
    
        finalFormulation,
    
        hiddenPosition:
          hiddenPositionSchema.parse({
            consciousPosition:
              "I need more confidence.",
    
            observedPattern:
              fixture === "origin-gold"
                ? "Freeze at exposure without container"
                : "Desire without the next concrete step.",
    
            possibleHiddenPosition:
              fixture === "origin-gold"
                ? "Freedom while an external container still carries authority and money"
                : "Structure is being asked to serve aliveness, not the other way around.",
    
            protectiveFunction: [
              "Keeps the work from becoming only grind.",
            ],
    
            possibleCompensatoryAim:
              "Structure in service of aliveness",
    
            threatenedByChange: [
              "Losing the feeling of possibility.",
            ],
    
            developmentalTension: {
              poleA: "possibility",
              poleB: "incarnation",
            },
    
            imageVoteSummary:
              fixture === "image-weakens"
                ? "weakens"
                : "insufficient",
    
            evidenceRefs: [
              ctx.evidenceRef,
            ],
    
            counterEvidenceRefs: [],
    
            confidence: "tentative",
          }),
    
        alternative:
          practical.observedPattern,
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
    case "pass8": {
      const closedSetBinding =
        ctx.experimentBindings?.preferredHypothesisId ??
        ctx.experimentBindings?.hypothesisIds[0] ??
        ctx.experimentBindings?.openForkIds[0];
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
                : closedSetBinding ??
                  (fixture === "critic-constraints-win"
                    ? "hyp-practical"
                    : fixture === "origin-gold"
                      ? "container_loss_vs_capacity"
                      : "hyp-depth"),
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
    }
    case "pass9":
      return {
        sections: ensureQuestionsAndClose(
          groundedReportSections(
            fixture,
            ctx,
          ),
          ctx,
        ),
      };
    case "pass10": {
      const draft = ctx.draftReport?.sections ?? [];
      const failingSectionIds = failingReportSectionIds({
        sections: draft,
        requestedInsight: ctx.requestedInsight,
      });
      if (!failingSectionIds.length) {
        return { failingSectionIds: [], regeneratedSections: [] };
      }
      const grounded =
  ensureQuestionsAndClose(
    groundedReportSections(
      fixture === "starved-case-report"
        ? "default"
        : fixture,
      ctx,
    ),
    ctx,
  );
      return {
        failingSectionIds,
        regeneratedSections: grounded.filter((section) => failingSectionIds.includes(section.id)),
      };
    }
  }
}
