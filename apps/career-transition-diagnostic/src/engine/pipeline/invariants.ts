import type { CaseState } from "../schemas/case-state";
import type { Hypothesis, ReportSection } from "../schemas/analysis";
import type { pass4OutputSchema, pass5OutputSchema, pass6OutputSchema } from "./stage-schemas";
import {
  CANONICAL_PEEL_TITLES,
  hasRichImageAssociations,
  imageVoteAdequate,
  isParaphraseOf,
  throwGate,
} from "./gates";
import type { z } from "zod";

const PRACTICAL_CATEGORIES = new Set(["practical", "economic", "occupational"]);

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
  output: z.infer<typeof pass5OutputSchema>,
) {
  const byId = new Map(state.hypotheses.map((item) => [item.id, item]));
  for (const vote of output.votes) {
    const hypothesis = byId.get(vote.hypothesisId);
    if (!hypothesis) {
      continue;
    }
    if (vote.verdict === "weakens") {
      hypothesis.scoring.imageConstraintFit = 0;
      hypothesis.scoring.counterEvidencePenalty = Math.max(
        hypothesis.scoring.counterEvidencePenalty,
        0.9,
      );
    }
    if (vote.verdict === "supports") {
      hypothesis.scoring.imageConstraintFit = 1;
    }
  }
  state.hypotheses = [...state.hypotheses].sort(
    (left, right) => hypothesisScore(right) - hypothesisScore(left),
  );
  const favoriteVote = output.votes.find((vote) => vote.hypothesisId === "hyp-depth") ?? output.votes[0];
  state.imageVote = favoriteVote;
  const imageGate = imageVoteAdequate(state, favoriteVote);
  if (!imageGate.passed) {
    // Prefer a splits/supports remediation signal rather than accepting blind insufficient.
    if (hasRichImageAssociations(state) && favoriteVote?.verdict === "insufficient") {
      state.gateRemediations = [...(state.gateRemediations ?? []), imageGate.detail];
      throwGate(imageGate);
    }
  }
  return state;
}

export function applyResolution(
  state: CaseState,
  output: z.infer<typeof pass6OutputSchema>,
  critiques: z.infer<typeof pass4OutputSchema>["critiques"],
) {
  const requested = state.userFinalReflection.requestedInsight?.trim();
  const criticAndConstraintsWin =
    state.practicalContext.constraints.length > 0 &&
    critiques.some((item) => item.hypothesisId === "hyp-depth" && !item.survives);

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

  if (!output.hiddenPosition || criticAndConstraintsWin || paraphrasesInsight) {
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
