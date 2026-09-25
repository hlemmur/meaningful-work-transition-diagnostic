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
  | "non-origin-soft-mini"
  | "labor-market-only"
  | "job-shape-mismatch"
  | "ordinary-structure"
  | "cross-domain-polarity"
  | "symbol-split-lead";

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
  { marker: "LABOR_MARKET_ONLY", fixture: "labor-market-only" },
  { marker: "JOB_SHAPE_MISMATCH", fixture: "job-shape-mismatch" },
  { marker: "ORDINARY_STRUCTURE", fixture: "ordinary-structure" },
  { marker: "CROSS_DOMAIN_POLARITY", fixture: "cross-domain-polarity" },
  { marker: "SYMBOL_SPLIT_LEAD", fixture: "symbol-split-lead" },
];

const PRACTICAL_ONLY_FIXTURES = new Set<AnalysisFixture>([
  "critic-constraints-win",
  "labor-market-only",
  "job-shape-mismatch",
  "ordinary-structure",
]);

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
  fixture: AnalysisFixture,
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
        questionIntents: [
          { question: "What changes when you treat the stall as information rather than proof that you cannot do the work?", targetUncertainty: "Whether the stall is information or incapacity", couldWeakenSelectedFormulation: false },
          { question: "Which explanation would you most want to disprove through action?", targetUncertainty: "Which explanation survives action", couldWeakenSelectedFormulation: true },
          { question: "What would you learn if the next step became smaller and more observable?", targetUncertainty: "Whether task size changes action", couldWeakenSelectedFormulation: false },
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
        body: PRACTICAL_ONLY_FIXTURES.has(fixture)
          ? "The working maintenance hypothesis is that current constraints and missing infrastructure may be enough to explain the stall. Your reported role history, body responses, and emotions remain relevant observations, but they do not by themselves establish a hidden cause. A practical benefit of staying with the current arrangement is conserving limited resources; that does not establish a hidden motive. A stronger opportunity fit or more usable structure would weaken this explanation. Important unknowns remain, and evidence from your experiment should update or revise the formulation rather than turn it into a verdict."
          : "You can treat the working maintenance hypothesis as the possibility that the stall may be protecting a not-yet-incarnated way of working, or that freedom without an internalized container and capacity stalls action. Your strongest practical alternative is that constraints and missing infrastructure may be enough to explain the stall. When warranted, the developmental task may integrate freedom with dependable structure. Important unknowns remain, and evidence from your experiment should update or revise this formulation rather than turn it into a verdict.",
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
  ctx: {
    assessmentId: string;
    evidenceRef: string;
    evidenceAllowlist?: string[];
  },
): ReportSection[] {
  const allowed = new Set(ctx.evidenceAllowlist ?? []);
  const q = (questionId: string) => {
    const ref = `${ctx.assessmentId}:${questionId}`;
    return allowed.size === 0 || allowed.has(ref)
      ? ref
      : ctx.evidenceRef;
  };

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
      evidenceRefs: [q("Q0.4"), q("Q0.5"), q("Q8.1"), q("Q10.1")],
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
        q("Q5.1"),
        q("Q6.1"),
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
  if (!PRACTICAL_ONLY_FIXTURES.has(fixture)) {
    sections.splice(
      3,
      0,
      reportSectionSchema.parse({
        id: "hidden",
        title: "A possible hidden position",
        body: fixture === "symbol-split-lead"
          ? "Your protection may keep possibility intact while the developmental aim may be structure in service of aliveness. The gate image supports both an authorization reading and an ordinary route-clarity reading, so its meaning remains unresolved rather than settled."
          : "One hypothesis is that your protection keeps possibility intact while the developmental aim may be structure in service of aliveness — without collapsing into grind-only identity. Ask what the image's voice wants at the scene you keep circling.",
        evidenceRefs: [q("Q1.3"), q("Q2.1"), q("Q10.1")],
      }),
    );
  }
  if (fixture === "cross-domain-polarity") {
    const hiddenIndex = sections.findIndex((section) => section.id === "hidden");
    sections.splice(
      hiddenIndex + 1,
      0,
      reportSectionSchema.parse({
        id: "developmental",
        title: "The developmental tension",
        body: "You may be working with a recurring opposition between freedom and dependable structure; the developmental task may be to integrate both without forcing either pole.",
        evidenceRefs: [q("Q2.1"), q("Q6.1")],
      }),
    );
  }
  if (fixture !== "empty-jungian" && !PRACTICAL_ONLY_FIXTURES.has(fixture)) {
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
    PRACTICAL_ONLY_FIXTURES.has(fixture);

  return {
    forkId,

    status: fixture === "symbol-split-lead"
      ? ("unresolved" as const)
      : practicalWins
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
  assessmentId: string,
) {
  const practicalFormulations: Partial<Record<AnalysisFixture, string>> = {
    "critic-constraints-win": "The current stall may be sufficiently explained by practical constraints and missing infrastructure.",
    "labor-market-only": "Current hiring conditions may be sufficient to explain the pause.",
    "job-shape-mismatch": "A mismatch between the available role shape and the work sought may be sufficient to explain the pause.",
    "ordinary-structure": "An ordinary planning structure gap may be sufficient to explain the stall.",
  };
  return {
    selectedHypothesisId:
      selected.id,

    maintenanceFormulation:
      practicalFormulations[fixture] ?? selected.observedPattern,

    maintenanceMechanism: {
      trigger: "A concrete next step or self-directed work period begins.",
      response: PRACTICAL_ONLY_FIXTURES.has(fixture)
        ? "Action narrows around the available practical constraints."
        : "The next step is deferred while more certainty or external structure is sought.",
      shortTermFunction: PRACTICAL_ONLY_FIXTURES.has(fixture)
        ? "Conserves limited resources."
        : "Avoids premature commitment and exposure.",
      longTermCost: "Direct evidence about fit and capacity accumulates slowly.",
      reinforcingConsequence: "Limited new evidence leaves the original uncertainty intact.",
    },

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

    ...(fixture === "cross-domain-polarity" ? {
      developmentalFormulation: {
        consciousPole: "freedom without imposed form",
        compensatingPole: "dependable structure and commitment",
        coreOpposition: "freedom versus dependable structure",
        possibleDevelopmentalTask: "Integrate freedom with dependable structure.",
        uncertainty: "The practical explanation remains live.",
        evidenceRefs: [`${assessmentId}:Q2.1`, `${assessmentId}:Q6.1`],
      },
    } : {}),

    unresolvedForks: fixture === "symbol-split-lead"
      ? [selected.originForks[0] ?? "history_vs_stated_cause"]
      : [],
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
    evidenceAllowlist?: string[];
    imageEvidenceRefs?: string[];
    symbolicMaterial?: Record<string, string | string[] | undefined>;
    projectionEvidenceRefs?: string[];
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

  const hypotheses = [depth, practical, identity];

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
      const imageEvidenceRefs = ctx.imageEvidenceRefs ?? [];
      const citesImage =
        !richInsufficient && imageEvidenceRefs.length > 0;
      const symbolic = ctx.symbolicMaterial ?? {};
      const observation = (field: string, questionId: string) => {
        const value = symbolic[field];
        const text = Array.isArray(value) ? value[0] : value;
        return typeof text === "string" && text.trim()
          ? { text, evidenceRefs: [`${ctx.assessmentId}:${questionId}`] }
          : undefined;
      };
      const literalFacts = [
        observation("scene", "Q10.1"),
        observation("surroundings", "Q10.2"),
        observation("obstacle", "Q10.3"),
        observation("ahead", "Q10.4"),
        observation("figures", "Q10.5"),
      ].filter((item): item is NonNullable<typeof item> => Boolean(item));
      const personalAssociations = [
        observation("obstacleSpeech", "Q10.6"),
        observation("obstacleWant", "Q10.7"),
        observation("ifNotRemoved", "Q10.8"),
      ].filter((item): item is NonNullable<typeof item> => Boolean(item));
      const readingRefs = imageEvidenceRefs.slice(0, 2);
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

            evidenceRefs: citesImage ? imageEvidenceRefs : [ctx.evidenceRef],

            exactClientMaterialUsed: citesImage ? imageEvidenceRefs : [],
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

            evidenceRefs: citesImage ? imageEvidenceRefs : [ctx.evidenceRef],

            exactClientMaterialUsed: citesImage ? imageEvidenceRefs : [],
          }),
        ],
        imageAnalysis: {
          literalFacts,
          personalAssociations,
          plausibleReadings: citesImage
            ? weakens
              ? [
                  {
                    interpretation: "The supplied image is more compatible with an ordinary direction problem.",
                    supportsHypothesisIds: [practical.id],
                    weakensHypothesisIds: ["hyp-depth"],
                    evidenceRefs: readingRefs,
                  },
                ]
              : [
                  {
                    interpretation: "The threshold may express waiting for authorization or a containing structure.",
                    supportsHypothesisIds: ["hyp-depth"],
                    weakensHypothesisIds: [],
                    evidenceRefs: readingRefs,
                  },
                  {
                    interpretation: "The same threshold may preserve a practical route or job-shape explanation.",
                    supportsHypothesisIds: [practical.id],
                    weakensHypothesisIds: [],
                    evidenceRefs: readingRefs,
                  },
                ]
            : [],
          unresolvedSymbolicQuestion: citesImage && !weakens
            ? "Does the threshold concern permission, structure, or ordinary route clarity?"
            : undefined,
        },
        projectionInterpretations: (ctx.projectionEvidenceRefs ?? []).length
          ? [
              {
                projectionEvidenceRefs: ctx.projectionEvidenceRefs ?? [],
                possibleDisownedValue: "The admired or rejected quality may point to a value not yet owned directly.",
                literalEnactmentRisk: "This does not imply copying or acting out the projected figure literally.",
                matureExpression: "A bounded expression of the quality can be tested without adopting the figure's whole identity.",
              },
            ]
          : [],
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
        PRACTICAL_ONLY_FIXTURES.has(fixture)
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
          ctx.assessmentId,
        );

      if (
        PRACTICAL_ONLY_FIXTURES.has(fixture)
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
      const hypothesisTested = fixture === "wrong-experiment"
        ? "intellectualizing delay"
        : closedSetBinding ??
          (fixture === "critic-constraints-win"
            ? "hyp-practical"
            : fixture === "origin-gold"
              ? "container_loss_vs_capacity"
              : "hyp-depth");
      const competingHypothesisId =
        ctx.experimentBindings?.hypothesisIds.find((id) => id !== hypothesisTested) ??
        "hyp-practical";
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
            hypothesisTested,
            action:
              fixture === "wrong-experiment"
                ? "Ask a mentor to list three blind spots while holding the method and task scope stable."
                : "Add two external deadline blocks and one accountability check-in each week while holding task difficulty stable.",
            duration: "14 days",
            whatToObserve: ["completed attempts out of four", "task-specific errors"],
            resultSupportingHypothesis: "Output rises when someone else holds the deadline.",
            resultWeakeningHypothesis: "Nothing changes even with accountability.",
            riskLevel: "low",
            practicalRequirements: ["one reviewer", "two calendar blocks"],
            competingHypothesisIds: [competingHypothesisId],
            manipulatedVariable: fixture === "wrong-experiment"
              ? "mentor feedback"
              : "external deadline and accountability",
            heldConstant: ["task difficulty"],
            outcomeInterpretations: [
              {
                outcome: "At least three of four planned attempts are completed under the added deadline.",
                favors: hypothesisTested,
                because: "Execution changed when the named variable changed while task difficulty stayed stable.",
              },
              {
                outcome: "Completion stays low and errors cluster in unfamiliar task steps.",
                favors: competingHypothesisId,
                because: "Persistent task-specific errors fit the live rival better than the selected explanation.",
              },
            ],
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
          fixture,
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
