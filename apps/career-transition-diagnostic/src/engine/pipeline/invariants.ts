import type { CaseState } from "../schemas/case-state";
import type { Hypothesis, HypothesisCritique, ReportSection } from "../schemas/analysis";
import type { pass5OutputSchema, pass6OutputSchema } from "./stage-schemas";
import {
  CANONICAL_PEEL_TITLES,
  hasRichImageAssociations,
  imageVoteAdequate,
  isParaphraseOf,
  throwGate,
} from "./gates";
import type { z } from "zod";

const PRACTICAL_CATEGORIES = new Set(["practical", "economic", "occupational"]);

function clamp01(value: number) {
  return Math.max(
    0,
    Math.min(1, value),
  );
}

export function hypothesisScore(hypothesis: Hypothesis) {
  const scoring = hypothesis.scoring;
  return (
    scoring.evidenceCoverage * 0.2 +
    scoring.crossContextRecurrence * 0.16 +
    scoring.contradictionResolution * 0.18 +
    scoring.personSpecificity * 0.12 +
    scoring.developmentalFit * 0.08 +
    scoring.imageConstraintFit * 0.06 -
    scoring.counterEvidencePenalty * 0.1 -
    scoring.simplerAlternativePenalty * 0.1
  );
}

export function applyCritiques(
  state: CaseState,
  critiques: HypothesisCritique[],
) {
  const byId = new Map(
    state.hypotheses.map(
      (item) => [item.id, item],
    ),
  );

  for (const critique of critiques) {
    const hypothesis = byId.get(
      critique.hypothesisId,
    );

    if (!hypothesis) {
      continue;
    }

    for (
      const ref
      of critique.counterEvidenceRefs
    ) {
      if (
        !hypothesis.evidenceAgainst.includes(
          ref,
        )
      ) {
        hypothesis.evidenceAgainst.push(
          ref,
        );
      }
    }

    switch (
      critique.rankAdjustment
    ) {
      case "raise":
        hypothesis.scoring.evidenceCoverage =
          clamp01(
            hypothesis.scoring
              .evidenceCoverage +
              0.05,
          );

        hypothesis.scoring
          .simplerAlternativePenalty =
          clamp01(
            hypothesis.scoring
              .simplerAlternativePenalty -
              0.1,
          );

        break;

      case "lower":
        hypothesis.scoring
          .counterEvidencePenalty =
          Math.max(
            hypothesis.scoring
              .counterEvidencePenalty,
            0.5,
          );

        hypothesis.scoring
          .simplerAlternativePenalty =
          Math.max(
            hypothesis.scoring
              .simplerAlternativePenalty,
            0.5,
          );

        break;

      case "reject":
        hypothesis.scoring
          .counterEvidencePenalty = 1;

        hypothesis.scoring
          .simplerAlternativePenalty = 1;

        break;

      case "keep":
        break;
    }
  }

  state.hypothesisCritiques =
    critiques;

  state.hypotheses = [
    ...state.hypotheses,
  ].sort(
    (left, right) =>
      hypothesisScore(right) -
      hypothesisScore(left),
  );

  return state;
}

export function ensurePracticalRival(state: CaseState) {
  const warranted = state.practicalContext.constraints.length > 0;
  if (!warranted) {
    return state;
  }
  if (state.hypotheses.some((item) => PRACTICAL_CATEGORIES.has(item.category))) {
    return state;
  }
  const evidenceRef =
    state.practicalContext.constraints[0]?.id ??
    state.consciousNarrative.statedProblem[0]?.id ??
    `${state.assessmentId}:Q0.5`;
  state.hypotheses.push({
    id: "hyp-practical",
    title: "Constraints may be a sufficient explanation.",
    category: "practical",
    observedPattern: "Practical limits sit next to the stall.",
    evidenceFor: [evidenceRef],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: ["rational_caution_vs_hidden_bargain"],
    scoring: {
      evidenceCoverage: 0.65,
      crossContextRecurrence: 0.55,
      contradictionResolution: 0.55,
      personSpecificity: 0.55,
      developmentalFit: 0.4,
      imageConstraintFit: 0.4,
      counterEvidencePenalty: 0.1,
      simplerAlternativePenalty: 0.1,
    },
    confidence: "tentative",
  });
  return state;
}

export function applyImageVotes(
  state: CaseState,
  output: z.infer<
    typeof pass5OutputSchema
  >,
) {
  const byId = new Map(
    state.hypotheses.map(
      (item) => [item.id, item],
    ),
  );

  for (const vote of output.votes) {
    const hypothesis = byId.get(
      vote.hypothesisId,
    );

    if (!hypothesis) {
      continue;
    }

    switch (vote.verdict) {
      case "supports":
        hypothesis.scoring
          .imageConstraintFit = 1;
        break;

      case "weakens":
        hypothesis.scoring
          .imageConstraintFit = 0;

        hypothesis.scoring
          .counterEvidencePenalty =
          Math.max(
            hypothesis.scoring
              .counterEvidencePenalty,
            0.9,
          );
        break;

      case "splits":
        // Image genuinely supports more than
        // one center. Do not force a winner.
        hypothesis.scoring
          .imageConstraintFit =
          Math.min(
            hypothesis.scoring
              .imageConstraintFit,
            0.5,
          );
        break;

      case "insufficient":
        // No evidential update.
        break;
    }
  }

  state.imageVotes =
    output.votes;

  state.hypotheses = [
    ...state.hypotheses,
  ].sort(
    (left, right) =>
      hypothesisScore(right) -
      hypothesisScore(left),
  );

  const splitVotes =
  output.votes.filter(
    (vote) =>
      vote.verdict === "splits",
  );

if (splitVotes.length > 0) {
  state.gateRemediations = [
    ...(state.gateRemediations ?? []),

    "Symbolic material split across multiple hypotheses; Pass 6 must preserve or explicitly resolve the competing centers.",
  ];
}
  const currentFavorite =
    state.hypotheses[0];

  const favoriteVote =
    currentFavorite
      ? output.votes.find(
          (vote) =>
            vote.hypothesisId ===
            currentFavorite.id,
        )
      : undefined;

  // Temporary compatibility field.
  state.imageVote =
    favoriteVote ??
    output.votes[0];

  const voteForGate =
    favoriteVote ??
    output.votes[0];

  const imageGate =
    imageVoteAdequate(
      state,
      voteForGate,
    );

  if (!imageGate.passed) {
    if (
      hasRichImageAssociations(
        state,
      ) &&
      voteForGate?.verdict ===
        "insufficient"
    ) {
      state.gateRemediations = [
        ...(state.gateRemediations ??
          []),
        imageGate.detail,
      ];

      throwGate(imageGate);
    }
  }

  return state;
}

export function applyResolution(
  state: CaseState,
  output: z.infer<
    typeof pass6OutputSchema
  >,
) {
  state.forkResolutions = output.forkResolutions;
  state.finalFormulation = output.finalFormulation;
  const critiques = state.hypothesisCritiques ?? [];
  const requested = state.userFinalReflection.requestedInsight?.trim();
  
  const selectedHypothesis =
  state.hypotheses.find(
    (item) =>
      item.id ===
      output.selectedHypothesisId,
  );

const selectedCritique =
  critiques.find(
    (item) =>
      item.hypothesisId ===
      output.selectedHypothesisId,
  );

const selectedRejected =
  selectedCritique?.rankAdjustment ===
  "reject";

const selectedIsPractical =
  selectedHypothesis &&
  PRACTICAL_CATEGORIES.has(
    selectedHypothesis.category,
  );

  const paraphrasesInsight =
    Boolean(requested) &&
    Boolean(output.hiddenPosition) &&
    isParaphraseOf(output.hiddenPosition!.possibleHiddenPosition, requested!);

  if (paraphrasesInsight) {
    state.gateRemediations = [
      ...(state.gateRemediations ?? []),
      "Dropped hiddenPosition that paraphrased Q11.3 requestedInsight.",
    ];
  }

  if (
    !output.hiddenPosition ||
    selectedRejected ||
    selectedIsPractical ||
    paraphrasesInsight
  ) {
    state.hiddenPosition = undefined;
    return state;
  }

  // Central contradiction must not be Q11.3-only either (checked when contradictions exist).
  const central = state.contradictions[0];
  if (
    requested &&
    central &&
    isParaphraseOf(`${central.statementA} ${central.statementB}`, requested)
  ) {
    state.gateRemediations = [
      ...(state.gateRemediations ?? []),
      "Central contradiction paraphrased Q11.3; keeping hiddenPosition only if life evidence supports it.",
    ];
    const lifeEvidence = output.hiddenPosition.evidenceRefs.some((ref) => !/:Q11\./.test(ref));
    if (!lifeEvidence) {
      state.hiddenPosition = undefined;
      return state;
    }
  }

  state.hiddenPosition = output.hiddenPosition;
  return state;
}

export function sanitizeReportSections(
  sections: ReportSection[],
  state: CaseState,
) {
  const fallback = `${state.assessmentId}:Q1.1`;
  const known = new Set(
    [
      ...state.consciousNarrative.statedProblem.map((item) => item.id),
      ...state.practicalContext.constraints.map((item) => item.id),
      ...state.behavior.actionsTaken.map((item) => item.id),
      fallback,
    ].filter(Boolean),
  );

  return sections
    .filter((section) => {
      if ((section.id === "jungian" || /jungian/i.test(section.title)) && state.jungianLenses.length === 0) {
        return false;
      }
      if ((section.id === "hidden" || /hidden position/i.test(section.title)) && !state.hiddenPosition) {
        return false;
      }
      return true;
    })
    .map((section) => {
      const refs = section.evidenceRefs.filter((ref) => known.has(ref) || ref.startsWith(`${state.assessmentId}:`));
      const canonical = CANONICAL_PEEL_TITLES[section.id];
      return {
        ...section,
        // Peel titles are structural labels — normalize so voice gates don't thrash live drafts.
        title: canonical ?? section.title,
        evidenceRefs: refs.length ? refs : [fallback],
      };
    });
}
