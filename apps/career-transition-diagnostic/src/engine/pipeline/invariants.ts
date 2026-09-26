import type { CaseState } from "../schemas/case-state";
import type { Hypothesis, HypothesisCritique, ReportSection } from "../schemas/analysis";
import type { pass5OutputSchema, pass6OutputSchema } from "./stage-schemas";
import { collectCanonicalEvidenceIds } from "./evidence-ids";
import { STAGE_INPUT_TRIM, trimText } from "./stage-input";
import { questions } from "@/questionnaire/questionnaire.v2";
import {
  CANONICAL_PEEL_TITLES,
  hasRichImageAssociations,
  imageVoteAdequate,
  isParaphraseOf,
  throwGate,
} from "./gates";
import type { z } from "zod";
import {
  depthIndependentlySupported,
  emergentPossibleThird,
  evaluateDevelopmentalWarrant,
  suppliedThirdCorpus,
} from "./developmental-warrant";
import { CUSTOMER_SAFETY_FAILURE, stripCanonicalEvidenceIds } from "./customer-prose";

const PRACTICAL_CATEGORIES = new Set(["practical", "economic", "occupational"]);
const QUESTION_SECTION_BY_ID = new Map(
  questions.map((question) => [question.id, question.section]),
);

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

export function contradictionScore(
  contradiction: CaseState["contradictions"][number],
) {
  const scores = contradiction.scores;

  return (
    scores.evidenceStrength * 0.15 +
    scores.recurrence * 0.15 +
    scores.explanatoryImportance * 0.2 +
    scores.charge * 0.1 +
    scores.crossDomainReach * 0.2 +
    scores.noveltyOfConnection * 0.2 -
    scores.consciousAwarenessPenalty * 0.2
  );
}

export function rankContradictions(
  state: CaseState,
) {
  state.contradictions = [
    ...state.contradictions,
  ].sort(
    (left, right) =>
      contradictionScore(right) -
      contradictionScore(left),
  );

  return state;
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

  const invalidVote = output.votes.find(
    (vote) => !byId.has(vote.hypothesisId),
  );
  if (invalidVote) {
    throwGate({
      id: "image-vote-referential-integrity",
      passed: false,
      detail:
        `Pass 5 image vote ${invalidVote.hypothesisId} does not reference a live hypothesis.`,
    });
  }

  const allowedEvidenceRefs = new Set(collectCanonicalEvidenceIds(state));
  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const literalSymbolic = new Map<string, Set<string>>();
  const associatedSymbolic = new Map<string, Set<string>>();
  const addSymbolic = (
    target: Map<string, Set<string>>,
    value: string | string[] | undefined,
    questionId: string,
  ) => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const register = (text: string) => {
      const key = normalize(text);
      if (!key) {
        return;
      }
      const refs = target.get(key) ?? new Set<string>();
      refs.add(`${state.assessmentId}:${questionId}`);
      target.set(key, refs);
    };
    for (const item of values) {
      register(item);
      // Pass 5 snapshots trim Q10 quotes (and answers) before the model sees them.
      // A compliant model that copies that snapshot text must still pass provenance.
      const snapshotQuote = trimText(item, STAGE_INPUT_TRIM.maxQuoteChars);
      if (typeof snapshotQuote === "string") {
        register(snapshotQuote);
        if (
          item.trim().length > STAGE_INPUT_TRIM.maxQuoteChars &&
          snapshotQuote.endsWith("…")
        ) {
          register(snapshotQuote.slice(0, -1));
        }
      }
      const snapshotAnswer = trimText(item, STAGE_INPUT_TRIM.maxAnswerChars);
      if (typeof snapshotAnswer === "string") {
        register(snapshotAnswer);
        if (
          item.trim().length > STAGE_INPUT_TRIM.maxAnswerChars &&
          snapshotAnswer.endsWith("…")
        ) {
          register(snapshotAnswer.slice(0, -1));
        }
      }
    }
  };
  addSymbolic(literalSymbolic, state.symbolicMaterial.scene, "Q10.1");
  addSymbolic(literalSymbolic, state.symbolicMaterial.surroundings, "Q10.2");
  addSymbolic(literalSymbolic, state.symbolicMaterial.obstacle, "Q10.3");
  addSymbolic(literalSymbolic, state.symbolicMaterial.ahead, "Q10.4");
  addSymbolic(literalSymbolic, state.symbolicMaterial.figures, "Q10.5");
  addSymbolic(associatedSymbolic, state.symbolicMaterial.obstacleSpeech, "Q10.6");
  addSymbolic(associatedSymbolic, state.symbolicMaterial.obstacleWant, "Q10.7");
  addSymbolic(associatedSymbolic, state.symbolicMaterial.ifNotRemoved, "Q10.8");

  const validateObservations = (
    observations: typeof output.imageAnalysis.literalFacts,
    supplied: Map<string, Set<string>>,
    label: string,
  ) => {
    for (const observation of observations) {
      const expectedRefs = supplied.get(normalize(observation.text));
      if (
        !expectedRefs ||
        observation.evidenceRefs.some((ref) => !expectedRefs.has(ref))
      ) {
        throwGate({
          id: "symbolic-material-provenance",
          passed: false,
          detail: `Pass 5 ${label} is not exact supplied client material with matching provenance: ${observation.text}`,
        });
      }
    }
  };
  validateObservations(output.imageAnalysis.literalFacts, literalSymbolic, "literal fact");
  validateObservations(
    output.imageAnalysis.personalAssociations,
    associatedSymbolic,
    "personal association",
  );

  for (const vote of output.votes) {
    if (
      vote.evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref)) ||
      vote.exactClientMaterialUsed.some(
        (ref) => !allowedEvidenceRefs.has(ref) || !/:Q10\./.test(ref),
      ) ||
      (vote.verdict !== "insufficient" &&
        !vote.evidenceRefs.some((ref) => /:Q10\./.test(ref)))
    ) {
      throwGate({
        id: "image-vote-evidence-integrity",
        passed: false,
        detail: "Pass 5 image votes must use valid supplied evidence and ground substantive verdicts in Q10 material.",
      });
    }
  }

  for (const reading of output.imageAnalysis.plausibleReadings) {
    const referencedHypotheses = [
      ...reading.supportsHypothesisIds,
      ...reading.weakensHypothesisIds,
    ];
    const invalidHypothesisId = referencedHypotheses.find((id) => !byId.has(id));
    if (invalidHypothesisId) {
      throwGate({
        id: "symbolic-reading-referential-integrity",
        passed: false,
        detail: `Pass 5 symbolic reading references non-live hypothesis ${invalidHypothesisId}.`,
      });
    }
    if (
      reading.evidenceRefs.some((ref) => !allowedEvidenceRefs.has(ref)) ||
      !reading.evidenceRefs.some((ref) => /:Q10\./.test(ref))
    ) {
      throwGate({
        id: "symbolic-reading-evidence-integrity",
        passed: false,
        detail: "Pass 5 symbolic reading must cite valid supplied symbolic evidence.",
      });
    }
  }

  const projectionRefs = new Set(
    [...state.projections.admiredFigures, ...state.projections.rejectedFigures]
      .flatMap((item) => item.evidenceRefs),
  );
  for (const interpretation of output.projectionInterpretations) {
    if (
      interpretation.projectionEvidenceRefs.some((ref) => !projectionRefs.has(ref))
    ) {
      throwGate({
        id: "projection-interpretation-provenance",
        passed: false,
        detail: "Pass 5 projection interpretation must reference raw supplied projection evidence.",
      });
    }
  }

  if (
    !hasRichImageAssociations(state) &&
    (output.imageAnalysis.plausibleReadings.length > 0 ||
      Boolean(output.imageAnalysis.unresolvedSymbolicQuestion) ||
      output.votes.some((vote) => vote.verdict !== "insufficient"))
  ) {
    throwGate({
      id: "symbolic-material-insufficient",
      passed: false,
      detail: "Thin symbolic material must remain explicitly insufficient.",
    });
  }

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
  state.imageAnalysis = output.imageAnalysis;
  state.projectionInterpretations = output.projectionInterpretations;

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

  const imageGate =
    imageVoteAdequate(
      state,
    );

  if (!imageGate.passed) {
    state.gateRemediations = [
      ...(state.gateRemediations ?? []),
      imageGate.detail,
    ];

    throwGate(imageGate);
  }

  return state;
}

export function applyResolution(
  state: CaseState,
  output: z.infer<
    typeof pass6OutputSchema
  >,
) {
  const critiques = state.hypothesisCritiques ?? [];
  const requested = state.userFinalReflection.requestedInsight?.trim();
  const liveHypothesisIds = new Set(
    state.hypotheses.map((item) => item.id),
  );

  const selectedHypothesis =
  state.hypotheses.find(
    (item) =>
      item.id ===
      output.selectedHypothesisId,
  );

  if (!selectedHypothesis) {
    throwGate({
      id: "resolution-referential-integrity",
      passed: false,
      detail:
        `Pass 6 selected hypothesis ${output.selectedHypothesisId}, which is not a live hypothesis.`,
    });
  }

  const invalidCritique = critiques.find(
    (item) => !liveHypothesisIds.has(item.hypothesisId),
  );
  if (invalidCritique) {
    throwGate({
      id: "resolution-referential-integrity",
      passed: false,
      detail:
        `Pass 6 critique ${invalidCritique.hypothesisId} does not reference a live hypothesis.`,
    });
  }

  const invalidImageVote = (state.imageVotes ?? []).find(
    (item) => !liveHypothesisIds.has(item.hypothesisId),
  );
  if (invalidImageVote) {
    throwGate({
      id: "resolution-referential-integrity",
      passed: false,
      detail:
        `Pass 6 image vote ${invalidImageVote.hypothesisId} does not reference a live hypothesis.`,
    });
  }

  const openForks = new Set([
    ...state.openForks,
    ...state.contradictions.flatMap((item) => item.originForks),
    ...state.hypotheses.flatMap((item) => item.originForks),
  ]);
  const invalidForkResolution = output.forkResolutions.find(
    (item) => !openForks.has(item.forkId),
  );
  if (invalidForkResolution) {
    throwGate({
      id: "resolution-referential-integrity",
      passed: false,
      detail:
        `Pass 6 fork ${invalidForkResolution.forkId} is not open in the current case.`,
    });
  }

  state.forkResolutions = output.forkResolutions;
  state.finalFormulation = output.finalFormulation;

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

  const candidate = structuredClone(state);
  if (output.hiddenPosition && !selectedRejected && !paraphrasesInsight) {
    candidate.hiddenPosition = output.hiddenPosition;
  }
  const supported = depthIndependentlySupported(candidate);
  const layer = state.finalFormulation.layerRelationship;
  if (layer) {
    const liveIds = new Set(state.hypotheses.map((item) => item.id));
    const unknownIds = [
      ...layer.practicalHypothesisIds,
      ...layer.psychologicalHypothesisIds,
    ].filter((id) => !liveIds.has(id));
    if (unknownIds.length > 0) {
      throwGate({
        id: "resolution-referential-integrity",
        passed: false,
        detail: `Pass 6 layerRelationship cites hypotheses that are not live: ${unknownIds.join(", ")}.`,
      });
    }
    if (
      (layer.mode === "layered" || layer.mode === "psychological_primary") &&
      !state.finalFormulation.developmentalFormulation
    ) {
      throwGate({
        id: "developmental-omission",
        passed: false,
        detail:
          "Pass 6 declared layered or psychological-primary mode but omitted developmentalFormulation. Retry once; do not invent the interpretation.",
      });
    }
    if (
      (layer.mode === "layered" || layer.mode === "psychological_primary") &&
      !supported
    ) {
      throwGate({
        id: "layered-without-support",
        passed: false,
        detail:
          "Layered or psychological-primary mode requires independently supported depth, not two category labels.",
      });
    }
    if (layer.mode === "psychological_primary" && layer.practicalHypothesisIds.length > 0) {
      const weakened = (state.hypothesisCritiques ?? []).some(
        (item) =>
          layer.practicalHypothesisIds.includes(item.hypothesisId) &&
          (item.rankAdjustment === "lower" || item.rankAdjustment === "reject"),
      );
      if (!weakened) {
        throwGate({
          id: "psychological-primary-rival",
          passed: false,
          detail:
            "psychological_primary requires a specifically weakened practical rival, not a rival that is merely present.",
        });
      }
    }
  }

  if (
    output.hiddenPosition &&
    !output.hiddenPosition.consciousPosition.trim() &&
    output.hiddenPosition.possibleHiddenPosition.trim()
  ) {
    throwGate({
      id: "conscious-position",
      passed: false,
      detail: "A persona or hidden stance requires a distinct conscious ego position.",
    });
  }

  const developmental = state.finalFormulation.developmentalFormulation;
  if (developmental && (!selectedIsPractical || supported)) {
    const knownEvidence = new Set(collectCanonicalEvidenceIds(state));
    const invalidRefs = developmental.evidenceRefs.filter(
      (ref) => !knownEvidence.has(ref),
    );
    const sections = new Set(
      developmental.evidenceRefs.flatMap((ref) => {
        const questionId = ref.match(/:([^:]+)$/)?.[1];
        const section = questionId
          ? QUESTION_SECTION_BY_ID.get(questionId)
          : undefined;
        return section === undefined ? [] : [section];
      }),
    );
    if (invalidRefs.length > 0 || sections.size < 2) {
      throwGate({
        id: "developmental-evidence",
        passed: false,
        detail:
          invalidRefs.length > 0
            ? `Developmental formulation cites evidence outside the current case: ${invalidRefs.join(", ")}.`
            : "Developmental formulation requires evidence from at least two questionnaire sections.",
      });
    }
    const polesPresent =
      developmental.consciousPole.trim().length > 0 &&
      developmental.compensatingPole.trim().length > 0;
    const task = developmental.possibleDevelopmentalTask;
    const coexistence =
      /coexist/i.test(task) &&
      /without either having to defeat the other/i.test(task);
    if (polesPresent && !coexistence) {
      throwGate({
        id: "developmental-coexistence",
        passed: false,
        detail:
          "When both developmental poles exist, possibleDevelopmentalTask must describe discovering a form in which the poles can coexist without either having to defeat the other.",
      });
    }
    const third = developmental.possibleThird;
    if (
      third &&
      !emergentPossibleThird(
        third,
        [developmental.consciousPole, developmental.compensatingPole],
        suppliedThirdCorpus(state),
      )
    ) {
      state.finalFormulation = {
        ...state.finalFormulation,
        developmentalFormulation: {
          ...developmental,
          possibleThird: undefined,
        },
      };
    }
  }

  const maintainingLoop = state.finalFormulation.maintainingLoop;
  if (maintainingLoop) {
    const knownEvidence = new Set(collectCanonicalEvidenceIds(state));
    const invalidRefs = maintainingLoop.evidenceRefs.filter(
      (ref) => !knownEvidence.has(ref),
    );
    if (invalidRefs.length > 0) {
      throwGate({
        id: "maintaining-loop-evidence",
        passed: false,
        detail: `Maintaining loop cites evidence outside the current case: ${invalidRefs.join(", ")}.`,
      });
    }
  }

  const warrant = evaluateDevelopmentalWarrant(candidate);
  const stripDepth =
    layer?.mode === "practical_primary" && warrant.mode === "not_warranted";

  if (
    stripDepth &&
    (state.finalFormulation.developmentalFormulation || state.finalFormulation.maintainingLoop)
  ) {
    state.finalFormulation = {
      ...state.finalFormulation,
      developmentalFormulation: undefined,
      maintainingLoop: undefined,
    };
    state.gateRemediations = [
      ...(state.gateRemediations ?? []),
      "Dropped developmentalFormulation and maintainingLoop because layerRelationship is practical_primary and developmental eligibility is not_warranted.",
    ];
  }

  if (paraphrasesInsight) {
    state.gateRemediations = [
      ...(state.gateRemediations ?? []),
      "Dropped hiddenPosition that paraphrased Q11.3 requestedInsight.",
    ];
  }

  if (
    !output.hiddenPosition ||
    selectedRejected ||
    stripDepth ||
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
  const known = new Set(collectCanonicalEvidenceIds(state));

  return sections
    .filter((section) => {
      if ((section.id === "jungian" || /jungian/i.test(section.title)) && state.jungianLenses.length === 0) {
        return false;
      }
      if ((section.id === "hidden" || /hidden position/i.test(section.title)) && !state.hiddenPosition) {
        return false;
      }
      if (
        (section.id === "developmental" || /developmental tension/i.test(section.title)) &&
        !state.finalFormulation?.developmentalFormulation
      ) {
        return false;
      }
      return true;
    })
    .map((section) => {
      const refs = section.evidenceRefs.filter(
        (ref) => known.has(ref),
      );
      if (refs.length === 0) {
        throwGate({
          id: "report-evidence-provenance",
          passed: false,
          detail:
            `Report section ${section.id} has no supported evidence refs after provenance validation.`,
        });
      }
      const canonical = CANONICAL_PEEL_TITLES[section.id];
      const body = stripCanonicalEvidenceIds(section.body, known);
      if (CUSTOMER_SAFETY_FAILURE.test(body)) {
        throwGate({
          id: "customer-safety",
          passed: false,
          detail:
            "Customer prose must not claim healing, direct medical causality, or that the psyche, unconscious, Self, or universe directs the person.",
        });
      }
      return {
        ...section,
        // Peel titles are structural labels — normalize so voice gates don't thrash live drafts.
        title: canonical ?? section.title,
        body,
        evidenceRefs: refs,
      };
    });
}
