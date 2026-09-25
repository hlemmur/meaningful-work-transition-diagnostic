import type { CaseState } from "../schemas/case-state";
import type { ReportSection } from "../schemas/analysis";

export type GateFinding = {
  id: string;
  passed: boolean;
  detail: string;
};

const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "hope",
  "shows",
  "some",
  "more",
  "into",
  "about",
  "cannot",
  "want",
  "need",
  "just",
]);

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/n't\b/g, " not")
    .replace(/'t\b/g, " not")
    .replace(/can't/g, "cannot")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string) {
  return new Set(normalize(text).split(" ").filter((token) => token.length > 2));
}

function contentTokens(text: string) {
  return new Set([...tokens(text)].filter((token) => !STOPWORDS.has(token)));
}

function stemToken(token: string) {
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function overlapTokens(text: string) {
  return new Set([...contentTokens(text)].map(stemToken));
}

/** Jaccard-ish overlap on content words; used for Q11.3 paraphrase detection. */
export function paraphraseOverlap(a: string, b: string) {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

/** Share of source content tokens present in candidate (catches short paraphrases). */
export function paraphraseRecall(candidate: string, source: string) {
  const sourceTokens = contentTokens(source);
  const candidateTokens = contentTokens(candidate);
  if (!sourceTokens.size || !candidateTokens.size) {
    return 0;
  }
  let hit = 0;
  for (const token of sourceTokens) {
    if (candidateTokens.has(token)) {
      hit += 1;
    }
  }
  return hit / sourceTokens.size;
}

export function isParaphraseOf(candidate: string, source: string, threshold = 0.45) {
  if (!candidate.trim() || !source.trim()) {
    return false;
  }
  const left = normalize(candidate);
  const right = normalize(source);
  if (left === right) {
    return true;
  }
  if (left.includes(right) || right.includes(left)) {
    return true;
  }
  if (paraphraseOverlap(candidate, source) >= threshold) {
    return true;
  }
  // Distinctive phrase reuse: most of the insight's content words survive in candidate.
  const recall = paraphraseRecall(candidate, source);
  if (recall >= 0.6 && contentTokens(source).size >= 2) {
    return true;
  }
  return false;
}

export function answersIndicateTierA(answers: Record<string, unknown>) {
  const has = (id: string) => {
    const value = answers[id];
    if (value == null) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value as object).length > 0;
    }
    return true;
  };
  return {
    projections: has("Q5.1") || has("Q6.1"),
    money: has("Q8.2") || has("Q8.4") || has("Q8.5") || has("Q8.6"),
    bargain: has("Q9.2") || has("Q9.3") || has("Q9.7"),
    symbol: has("Q10.1") || has("Q10.6"),
  };
}

export function assertCaseStateCompleteness(
  state: CaseState,
  answers: Record<string, unknown>,
): GateFinding {
  const indicated = answersIndicateTierA(answers);
  const missing: string[] = [];
  if (indicated.projections && !state.projections.admiredFigures.length && !state.projections.rejectedFigures.length) {
    missing.push("projections");
  }
  if (
    indicated.money &&
    !state.money.easyMoneyHistory.length &&
    !state.money.invisibleMachinery.length &&
    !state.money.hardMoneyHistory.length
  ) {
    missing.push("money");
  }
  if (
    indicated.bargain &&
    !state.hiddenBargain.benefitsOfStaying.length &&
    !state.hiddenBargain.protectAndThreaten.length
  ) {
    missing.push("hiddenBargain");
  }
  if (indicated.symbol && !state.symbolicMaterial.scene) {
    missing.push("symbolicMaterial");
  }
  return {
    id: "completeness",
    passed: missing.length === 0,
    detail: missing.length
      ? `CaseState missing filled buckets for answered sections: ${missing.join(", ")}`
      : "CaseState Tier-A buckets match answered sections.",
  };
}

export function hasRichImageAssociations(state: CaseState) {
  return Boolean(
    state.symbolicMaterial.scene &&
      (state.symbolicMaterial.obstacleSpeech ||
        state.symbolicMaterial.surroundings ||
        state.symbolicMaterial.obstacleWant),
  );
}

export function imageVoteAdequate(
  state: CaseState,
): GateFinding {
  if (!hasRichImageAssociations(state)) {
    return {
      id: "image-adequacy",
      passed: true,
      detail:
        "No rich image associations requiring substantive image votes.",
    };
  }

  const votes =
    state.imageVotes?.length
      ? state.imageVotes
      : state.imageVote
        ? [state.imageVote]
        : [];

  if (!votes.length) {
    return {
      id: "image-adequacy",
      passed: false,
      detail:
        "Rich symbolic material exists but no image votes were persisted.",
    };
  }

  const relevantHypothesisIds = new Set(
    state.hypotheses
      .slice(0, Math.min(3, state.hypotheses.length))
      .map((hypothesis) => hypothesis.id),
  );

  const relevantVotes = votes.filter((vote) =>
    relevantHypothesisIds.has(vote.hypothesisId),
  );

  if (!relevantVotes.length) {
    return {
      id: "image-adequacy",
      passed: false,
      detail:
        "Rich symbolic material exists but no leading hypothesis received an image vote.",
    };
  }

  const unsupportedInsufficientVotes =
    relevantVotes.filter((vote) => {
      if (vote.verdict !== "insufficient") {
        return false;
      }

      const citesImage =
        vote.evidenceRefs.some((ref) =>
          /:Q10\./.test(ref),
        ) ||
        /scene|association|image|obstacle|speech/i.test(
          vote.interpretation ??
            vote.note ??
            "",
        );

      return !citesImage;
    });

  if (unsupportedInsufficientVotes.length) {
    return {
      id: "image-adequacy",
      passed: false,
      detail:
        "An image vote marked rich symbolic material insufficient without citing or interpreting the supplied image associations.",
    };
  }

  return {
    id: "image-adequacy",
    passed: true,
    detail:
      "Leading hypotheses received substantive image votes grounded in supplied symbolic material.",
  };
}

export function critiquesNonEmpty(critiques: unknown[]): GateFinding {
  return {
    id: "critic-fail-closed",
    passed: critiques.length > 0,
    detail:
      critiques.length > 0
        ? "Adversarial critiques present."
        : "Pass4 critiques must not be empty.",
  };
}

export function experimentBoundToHypothesis(
  state: CaseState,
  experiments: readonly unknown[] = state.experiments,
): GateFinding {
  if (!experiments.length) {
    return {
      id: "experiment-bind",
      passed: false,
      detail: "At least one behavioral experiment is required.",
    };
  }

  const hypothesisIds = new Set(
    state.hypotheses.map((item) => item.id),
  );

  const forkIds = new Set(state.openForks);

  const validTestIds = new Set<string>([
    ...hypothesisIds,
    ...forkIds,
  ]);

  const failures: string[] = [];
  const suppliedSymbolicMaterial = Object.values(state.symbolicMaterial)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (
    !experiments.some(
      (experiment) =>
        Boolean(experiment) &&
        typeof experiment === "object" &&
        (experiment as { kind?: unknown }).kind === "behavioral",
    )
  ) {
    failures.push("At least one behavioral experiment is required.");
  }

  for (const rawExperiment of experiments) {
    if (
      !rawExperiment ||
      typeof rawExperiment !== "object"
    ) {
      failures.push(
        "Experiment is not a valid object.",
      );
      continue;
    }

    const experiment = rawExperiment as {
      kind?: unknown;
      title?: unknown;
      hypothesisTested?: unknown;
      action?: unknown;
      competingHypothesisIds?: unknown;
      manipulatedVariable?: unknown;
      heldConstant?: unknown;
      whatToObserve?: unknown;
      outcomeInterpretations?: unknown;
    };

    const title =
      typeof experiment.title === "string"
        ? experiment.title
        : "Untitled experiment";

    const hypothesisTested =
      typeof experiment.hypothesisTested === "string"
        ? experiment.hypothesisTested
        : "";

    const kind =
      typeof experiment.kind === "string"
        ? experiment.kind
        : "";

        const rawCompetingHypothesisIds =
        experiment.competingHypothesisIds;

      const hasNewBindingField =
        Array.isArray(rawCompetingHypothesisIds);

      const competingHypothesisIds: string[] =
        Array.isArray(rawCompetingHypothesisIds)
          ? rawCompetingHypothesisIds.filter(
              (id): id is string =>
                typeof id === "string",
            )
          : [];

    const exactBinding =
      validTestIds.has(hypothesisTested);

    if (!hypothesisTested) {
      failures.push(
        `${title}: missing hypothesisTested`,
      );
      continue;
    }

    if (!exactBinding && hasNewBindingField) {
      failures.push(
        `${title}: hypothesisTested must exactly match a live hypothesis or open fork id`,
      );
    }

    const invalidCompetingIds =
      competingHypothesisIds.filter(
        (id) => !hypothesisIds.has(id),
      );

    if (invalidCompetingIds.length) {
      failures.push(
        `${title}: unknown competingHypothesisIds ${invalidCompetingIds.join(", ")}`,
      );
    }

    if (
      kind === "behavioral" &&
      competingHypothesisIds.includes(
        hypothesisTested,
      )
    ) {
      failures.push(
        `${title}: hypothesisTested must not also be listed as a competing hypothesis`,
      );
    }

    if (kind === "behavioral" && hasNewBindingField) {
      const manipulatedVariable =
        typeof experiment.manipulatedVariable === "string"
          ? experiment.manipulatedVariable.trim()
          : "";
      const heldConstant = Array.isArray(experiment.heldConstant)
        ? experiment.heldConstant.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          )
        : [];
      const observations = Array.isArray(experiment.whatToObserve)
        ? experiment.whatToObserve.filter((item): item is string => typeof item === "string")
        : [];
      const action = typeof experiment.action === "string" ? experiment.action : "";
      const actionAndObservationTokens = overlapTokens(
        `${action} ${observations.join(" ")}`,
      );
      const manipulatedTokens = overlapTokens(manipulatedVariable);
      const genericVariableTokens = new Set([
        "external",
        "internal",
        "level",
        "amount",
        "degree",
        "condition",
        "variable",
      ]);
      const variableAppearsInTest = [...manipulatedTokens].some(
        (token) =>
          !genericVariableTokens.has(token) && actionAndObservationTokens.has(token),
      );

      if (!manipulatedVariable || !variableAppearsInTest) {
        failures.push(
          `${title}: manipulatedVariable must name the variable actually changed in the action or observations`,
        );
      }

      const actionTokens = overlapTokens(action);
      const constantsAppearInAction = heldConstant.every((constant) =>
        [...overlapTokens(constant)].some((token) => actionTokens.has(token)),
      );
      if (
        !heldConstant.length ||
        !constantsAppearInAction ||
        !/\b(?:hold|held|keep|kept|same|unchanged|stable|constant|leav(?:e|ing))\b/i.test(action)
      ) {
        failures.push(
          `${title}: heldConstant must name a meaningful factor explicitly kept stable in the action`,
        );
      }

      if (!competingHypothesisIds.length) {
        failures.push(
          `${title}: a discriminating behavioral experiment requires at least one live competing hypothesis id`,
        );
      }

      const outcomes = Array.isArray(experiment.outcomeInterpretations)
        ? experiment.outcomeInterpretations.filter(
            (item): item is { outcome: string; favors: string; because: string } =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as { outcome?: unknown }).outcome === "string" &&
              typeof (item as { favors?: unknown }).favors === "string" &&
              typeof (item as { because?: unknown }).because === "string",
          )
        : [];
      const allowedOutcomeIds = new Set([hypothesisTested, ...competingHypothesisIds]);
      const invalidOutcomeIds = outcomes
        .map((outcome) => outcome.favors)
        .filter((id) => !allowedOutcomeIds.has(id));
      const favoredIds = new Set(outcomes.map((outcome) => outcome.favors));
      const vagueBinaryOutcome = outcomes.some((outcome) =>
        /^(?:(?:(?:the|this|an?)\s+)?(?:experiment|test|action|approach|plan|prototype|task)\s+)?(?:success|failure|succeeds?|fails?|works?|does not work|improves?|does not improve|no change)(?:\s+(?:well|poorly|better|worse))?[.!:]?$/i.test(
          outcome.outcome.trim(),
        ),
      );
      const missingOutcomeReason = outcomes.some(
        (outcome) => !outcome.outcome.trim() || !outcome.because.trim(),
      );
      const unobservableOutcome = outcomes.some(
        (outcome) =>
          !/\b(?:\d+|one|two|three|four|five|attempt|complete|completion|error|send|publish|reply|response|minute|day|week|task|output|action|session|application|interview|message|draft|prototype|document|note|plan|artifact|revision|defect|mistake|charge|anxiety|distress|rating|score|freeze|stall|outreach|post)\w*\b/i.test(
            outcome.outcome,
          ),
      );
      const distinctReasons = new Set(
        outcomes.map((outcome) => normalize(outcome.because)),
      );
      if (
        outcomes.length < 2 ||
        favoredIds.size < 2 ||
        !favoredIds.has(hypothesisTested) ||
        !competingHypothesisIds.some((id) => favoredIds.has(id)) ||
        invalidOutcomeIds.length > 0 ||
        vagueBinaryOutcome ||
        missingOutcomeReason ||
        unobservableOutcome ||
        distinctReasons.size < 2
      ) {
        failures.push(
          `${title}: outcomeInterpretations must give at least two observable, non-success/failure outcomes that favor different live explanations for stated reasons`,
        );
      }

      const exposureClaim =
        /\b(?:exposure|visibility|audience(?:\s+size)?)\b/i.test(manipulatedVariable) ||
        /\b(?:exposure|visibility|audience(?:\s+size)?)\s+(?:test|experiment)\b|\b(?:test|vary|change|increase|decrease|compare)\w*\s+(?:public\s+)?(?:exposure|visibility|audience(?:\s+size)?)\b/i.test(
          `${title} ${action}`,
        );
      const experimentText = JSON.stringify(rawExperiment);
      if (
        /proves an unconscious|isolates the real cause|therefore primary|therefore proven|disproves all depth/i.test(
          experimentText,
        )
      ) {
        failures.push(
          `${title}: no outcome proves a motive or turns a weakened explanation into a primary one`,
        );
      }
      const inventedLocation = ["chest", "shoulder", "throat", "stomach", "jaw", "gut", "belly"].find(
        (location) =>
          new RegExp(`\\b${location}\\b`, "i").test(experimentText) &&
          !state.affect.bodyResponses.some((item) =>
            new RegExp(`\\b${location}\\b`, "i").test(`${item.rawQuote ?? ""} ${item.normalizedMeaning}`),
          ),
      );
      if (inventedLocation) {
        failures.push(`${title}: invents a ${inventedLocation} sensation that was not supplied`);
      }
      const bounded = rawExperiment as {
        sessionMinutes?: unknown;
        audienceCount?: unknown;
        exposure?: unknown;
        largerActionJustification?: unknown;
        outcomeInterpretations?: unknown;
      };
      const declaresBounds =
        typeof bounded.sessionMinutes === "number" ||
        typeof bounded.audienceCount === "number" ||
        typeof bounded.exposure === "string";
      if (declaresBounds) {
        const minutes = typeof bounded.sessionMinutes === "number" ? bounded.sessionMinutes : 0;
        const audience = typeof bounded.audienceCount === "number" ? bounded.audienceCount : 0;
        const exposure = typeof bounded.exposure === "string" ? bounded.exposure : "private";
        const justified = typeof bounded.largerActionJustification === "string" &&
          bounded.largerActionJustification.trim().length > 0;
        if ((minutes > 30 || audience > 1 || exposure === "public") && !justified) {
          failures.push(
            `${title}: a session over 30 minutes, more than one recipient, or public exposure needs a case-specific justification`,
          );
        }
        const updates = (Array.isArray(bounded.outcomeInterpretations) ? bounded.outcomeInterpretations : [])
          .flatMap((item) => {
            const layers = (item as { layerUpdates?: unknown }).layerUpdates;
            return Array.isArray(layers) ? layers : [];
          })
          .filter((item): item is { layer: string; effect: string } =>
            Boolean(item) && typeof item === "object" && typeof (item as { effect?: unknown }).effect === "string",
          );
        const layers = new Set(updates.map((item) => item.layer));
        if (
          !updates.some((item) => item.effect === "inconclusive" || item.effect === "new_unknown") ||
          !layers.has("practical") ||
          !layers.has("psychological")
        ) {
          failures.push(
            `${title}: layer updates must cover practical and psychological layers independently and include an inconclusive path`,
          );
        }
      }

      if (exposureClaim) {
        const variesExposure =
          /\b(?:exposure|visible|visibility|public|publish|audience|outreach)\b/i.test(
            manipulatedVariable,
          ) &&
          /\b(?:vary|change|increase|decrease|more|less|visible|private|public|publish|send|outreach)\b/i.test(
            action,
          );
        const rivalText = state.hypotheses
          .filter((hypothesis) => competingHypothesisIds.includes(hypothesis.id))
          .map((hypothesis) => `${hypothesis.title} ${hypothesis.observedPattern}`)
          .join(" ");
        const rivalTokens = contentTokens(rivalText);
        const stabilizesRival = heldConstant.some((constant) =>
          [...contentTokens(constant)].some((token) => rivalTokens.has(token)),
        );
        if (!variesExposure || !stabilizesRival) {
          failures.push(
            `${title}: an exposure experiment must vary exposure and hold the main rival explanation stable`,
          );
        }
      }
    }

    if (kind === "imaginal") {
      const suppliedSpeech = state.symbolicMaterial.obstacleSpeech?.trim();
      const experimentText = JSON.stringify(rawExperiment).replaceAll('\\"', '"');
      const experimentTokens = contentTokens(experimentText);
      const grounded = suppliedSymbolicMaterial.some((material) => {
        const materialTokens = contentTokens(material);
        if (materialTokens.size < 2) {
          return false;
        }
        const sharedTokens = [...materialTokens].filter((token) => experimentTokens.has(token));
        return isParaphraseOf(experimentText, material) || sharedTokens.length >= 2;
      });
      if (!grounded) {
        failures.push(
          `${title}: imaginal experiment must be grounded in supplied symbolic material`,
        );
      }
      const inventedSpeech = attributedImageSpeech(experimentText).some(
        (speech) => !suppliedSpeech || normalize(speech) !== normalize(suppliedSpeech),
      );
      const invitesGeneratedSpeech =
        /(?:allow|let|invite)(?:ing)?\s+(?:the\s+)?(?:voice|image|figure|obstacle|scene|gate|it)\s+(?:to\s+)?(?:speak|reply|respond|answer|continue)/i.test(
          experimentText,
        );
      if (inventedSpeech || invitesGeneratedSpeech) {
        failures.push(
          `${title}: imaginal experiment contains invented or unsupplied dialogue`,
        );
      }
    }
  }

  return {
    id: "experiment-bind",
    passed: failures.length === 0,
    detail:
      failures.length === 0
        ? "All experiments are bound to live hypotheses or open forks."
        : failures.join("; "),
  };
}

const LAYER_PATTERNS: Record<string, RegExp> = {
  persona: /persona|identity|legitimacy|authenticity|role|self-image/i,
  projection: /projection|admir|fascination|rejected|watcher|gaze|figure/i,
  charge: /body|charge|shame|fear|anxiety|emotion|freeze/i,
  bargain: /protect|bargain|staying|threatened|benefit of staying/i,
  history: /history|recurrence|years|structure|container|institution/i,
  symbol: /image|symbol|scene|dream|association/i,
};

export function reportLayerCoverage(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const indicated = {
    persona: true,
    projection: state.projections.admiredFigures.length + state.projections.rejectedFigures.length > 0,
    charge: (state.affect.chargeIntensity ?? 0) >= 1 || state.affect.emotions.length > 0,
    bargain: state.hiddenBargain.benefitsOfStaying.length > 0 || state.hiddenBargain.protectAndThreaten.length > 0,
    history: state.history.supportiveStructures.length > 0 || state.history.missingStructures.length > 0,
    symbol: Boolean(state.symbolicMaterial.scene),
  };
  const text = sections.map((section) => `${section.title}\n${section.body}`).join("\n");
  const refs = sections.flatMap((section) => section.evidenceRefs).join(" ");
  const hit: string[] = [];
  for (const [layer, pattern] of Object.entries(LAYER_PATTERNS)) {
    if (!indicated[layer as keyof typeof indicated]) {
      continue;
    }
    if (pattern.test(text) || (layer === "symbol" && /:Q10\./.test(refs)) || (layer === "projection" && /:Q5\.|:Q6\./.test(refs))) {
      hit.push(layer);
    }
  }
  const requiredAvailable = Object.entries(indicated).filter(([, on]) => on).map(([name]) => name);
  const passed = hit.length >= Math.min(3, requiredAvailable.length);
  return {
    id: "layer-coverage",
    passed,
    detail: passed
      ? `Report covers layers: ${hit.join(", ")}`
      : `Report must cite ≥3 available layers; found ${hit.join(", ") || "none"} of ${requiredAvailable.join(", ")}`,
  };
}

const CLIENT_THIRD_PERSON = /\bthe client\b|\bthis client\b|\bthe client's\b/i;
const SECOND_PERSON = /\byou\b|\byour\b|\byourself\b|\byours\b/i;
const ANALYST_OPENERS =
  /presents a compelling|examining the deeper|illuminated by|sophisticated (psychological )?bargain|from a process-oriented|evocative imagery|stark contrast between/i;

/** Canonical peel labels used in fixtures, snapshot requiredTitles, and sanitize. */
export const CANONICAL_PEEL_TITLES: Record<string, string> = {
  problem: "The problem as you see it",
  reality: "What reality says",
  contradiction: "The contradiction at the center",
  hidden: "A possible hidden position",
  developmental: "The developmental tension",
  alternative: "What may also be true",
  experiment: "Your experiment",
  jungian: "A Jungian lens",
  questions: "Three questions to stay with",
  close: "A working formulation",
};

/**
 * Accept short peel labels including “The …” variants.
 * Reject long thesis subtitles (also enforced by length > 48).
 */
const PLAIN_TITLE_BY_ID: Record<string, RegExp> = {
  problem: /^(the )?problem( as you see it)?$/i,
  reality: /^(what )?reality( says)?$/i,
  contradiction: /^(the )?contradiction( at the center)?$/i,
  hidden: /^(the |a )?(possible )?hidden( position)?$/i,
  developmental: /^(the )?developmental tension$/i,
  alternative: /^(the |another )?(plausible )?interpretation$|^(the )?alternative$|^what may also be true$/i,
  experiment: /^(the |your )?experiment$/i,
  jungian: /^(the |a )?jungian lens$/i,
  questions: /^(three )?questions( to stay with)?$/i,
  close: /^(a )?working formulation$|^(the )?close$/i,
};

function refsOn(sections: ReportSection[]) {
  return sections.flatMap((section) => section.evidenceRefs);
}

const INTERPRETIVE_SECTION_IDS = new Set([
  "problem",
  "reality",
  "contradiction",
  "hidden",
  "developmental",
  "alternative",
  "jungian",
]);

function interpretiveSections(
  sections: ReportSection[],
) {
  return sections.filter((section) =>
    INTERPRETIVE_SECTION_IDS.has(section.id),
  );
}

export function hasProjectionFigures(state: CaseState) {
  return (
    state.projections.admiredFigures.length + state.projections.rejectedFigures.length > 0
  );
}

export function hasMoneyTierA(state: CaseState) {
  return Object.values(state.money).some((items) => items.length > 0);
}

/** When rich Q10 associations exist, an interpretive report section must cite :Q10. */
export function imageCited(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  if (!hasRichImageAssociations(state)) {
    return {
      id: "image_cited",
      passed: true,
      detail:
        "No rich image associations requiring citation.",
    };
  }

  const hasRef = refsOn(
    interpretiveSections(sections),
  ).some((ref) => /:Q10\./.test(ref));

  return {
    id: "image_cited",
    passed: hasRef,
    detail: hasRef
    ? "Rich symbolic material is represented in an interpretive section."
    : "Rich symbolic material exists but no interpretive section contains a Q10 evidenceRef.",
  };
}

/** When admired/rejected figures exist, contradiction or hidden must cite :Q5. or :Q6. */
export function projectionCited(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  if (!hasProjectionFigures(state)) {
    return {
      id: "projection_cited",
      passed: true,
      detail:
        "No projection figures requiring citation.",
    };
  }

  const hasRef = refsOn(
    interpretiveSections(sections),
  ).some((ref) => /:Q5\.|:Q6\./.test(ref));

  return {
    id: "projection_cited",
    passed: hasRef,
    detail: hasRef
      ? "Projection material is represented in the report."
      : "Projection material exists but the report contains no Q5/Q6 evidenceRef.",
  };
}

/** When money Tier-A buckets exist, reality or alternative must cite :Q8. */
export function moneyCited(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  if (!hasMoneyTierA(state)) {
    return {
      id: "money_cited",
      passed: true,
      detail:
        "No money material requiring citation.",
    };
  }

  const hasRef = refsOn(
    interpretiveSections(sections),
  ).some((ref) => /:Q8\./.test(ref));

  return {
    id: "money_cited",
    passed: hasRef,
    detail: hasRef
      ? "Money material is represented in the report."
      : "Money material exists but the report contains no Q8 evidenceRef.",
  };
}

export function tierACitationGates(
  sections: ReportSection[],
  state: CaseState,
): GateFinding[] {
  return [imageCited(sections, state), projectionCited(sections, state), moneyCited(sections, state)];
}

/** Client peel must address the person in second person, not as “the client”. */
export function secondPersonVoice(sections: ReportSection[]): GateFinding {
  const bodies = sections.map((section) => section.body);
  const third = bodies.some((body) => CLIENT_THIRD_PERSON.test(body));
  const missingYou = bodies.some((body) => !SECOND_PERSON.test(body));
  const passed = !third && !missingYou;
  return {
    id: "second_person",
    passed,
    detail: passed
      ? "Report bodies address the person in second person."
      : third
        ? "Report must not refer to the person as “the client”; use second person."
        : "Every section body must include You/Your address.",
  };
}

/** Titles must be short peel labels, not thesis subtitles. */
export function plainTitles(sections: ReportSection[]): GateFinding {
  const bad = sections.filter((section) => {
    const pattern = PLAIN_TITLE_BY_ID[section.id];
    if (!pattern) {
      return section.title.trim().split(/\s+/).length > 6;
    }
    return !pattern.test(section.title.trim()) || section.title.length > 48;
  });
  return {
    id: "plain_titles",
    passed: bad.length === 0,
    detail: bad.length
      ? `Titles must stay plain peel labels; rewrite: ${bad.map((item) => item.id).join(", ")}`
      : "Section titles are plain peel labels.",
  };
}

/** Ban stock clinical/essay openers. */
export function noAnalystOpeners(sections: ReportSection[]): GateFinding {
  const text = sections.map((section) => section.body).join("\n");
  const hit = ANALYST_OPENERS.test(text);
  return {
    id: "no_analyst_openers",
    passed: !hit,
    detail: hit
      ? "Report uses banned clinical/essay analyst openers."
      : "No banned clinical/essay analyst openers.",
  };
}

export function clientVoiceGates(sections: ReportSection[]): GateFinding[] {
  return [secondPersonVoice(sections), plainTitles(sections), noAnalystOpeners(sections)];
}

export function senexScoldOnly(
  text: string,
): GateFinding {
  const grindOnlyLanguage =
    /grow up|just (?:need )?(?:more )?discipline|stop seeking (?:insight|revelation)|unglamorous discomfort of daily execution|just work harder|force yourself|only harder work/i.test(
      text,
    );

  const balancingLanguage =
    /polarity|both (?:sides|poles)|tension between|balance|integrat|compensat|while also|without losing|alongside|at the same time|one pole|other pole/i.test(
      text,
    );

  const failed =
    grindOnlyLanguage &&
    !balancingLanguage;

  return {
    id: "senex-scold",
    passed: !failed,
    detail: failed
      ? "Developmental framing collapses to discipline/grind as the only valid pole."
      : "Developmental framing does not collapse to grind-only.",
  };
}

export function questionsAndCloseAdequate(
  sections: ReportSection[],
  state?: CaseState,
): GateFinding {
  const questions = sections.find(
    (section) => section.id === "questions",
  );

  const close = sections.find(
    (section) => section.id === "close",
  );

  if (!questions || !close) {
    return {
      id: "questions-close",
      passed: false,
      detail:
        "Report must include questions and close sections.",
    };
  }

  const questionCount =
    questions.body.match(/\?/g)?.length ?? 0;

  if (questionCount !== 3) {
    return {
      id: "questions-close",
      passed: false,
      detail:
        `Questions section must contain exactly 3 questions; found ${questionCount}.`,
    };
  }

  const intents = questions.questionIntents ?? [];
  const liveHypotheses = new Set(state?.hypotheses.map((hypothesis) => hypothesis.id) ?? []);
  const liveForks = new Set(state?.forkResolutions.map((fork) => fork.forkId) ?? []);
  const leading = /\b(?:why do you|what makes you|don't you|isn't it|wouldn't you|surely)\b/i;
  const numberedQuestions = questions.body.match(/\d+[.)]\s*[^?]+\?/g) ?? [];
  const renderedQuestions = (numberedQuestions.length === 3
    ? numberedQuestions
    : questions.body.match(/[^?]+\?/g) ?? []
  ).map((question) =>
    normalize(question.replace(/^\s*\d+[.)]\s*/, "")),
  );
  const intentQuestions = intents.map((intent) => normalize(intent.question));
  const invalidIntent = intents.some((intent) =>
    !/\b(?:you|your)\b/i.test(intent.question) ||
    leading.test(intent.question) ||
    (intent.relatedHypothesisId !== undefined && state !== undefined && !liveHypotheses.has(intent.relatedHypothesisId)) ||
    (intent.relatedForkId !== undefined && state !== undefined && !liveForks.has(intent.relatedForkId)),
  );
  if (
    state !== undefined &&
    (intents.length !== 3 ||
      new Set(intentQuestions).size !== 3 ||
      new Set(renderedQuestions).size !== 3 ||
      intentQuestions.some((question) => !renderedQuestions.includes(question)) ||
      invalidIntent ||
      !intents.some((intent) => intent.couldWeakenSelectedFormulation))
  ) {
    return {
      id: "questions-close",
      passed: false,
      detail: "Questions require three personalized, non-leading structured intents, including one that could weaken the selected formulation.",
    };
  }

  if (!close.body.trim()) {
    return {
      id: "questions-close",
      passed: false,
      detail:
        "Close section must contain a working formulation.",
    };
  }

  return {
    id: "questions-close",
    passed: true,
    detail:
      "Report ends with exactly three questions and a working formulation.",
  };
}

const CERTAIN_PSYCHOLOGICAL_PREDICATE =
  /\b(?:unconsciously|secretly|the real reason|you (?:avoid|fear|refuse)|you are driven by|this protects you from)\b/i;
const EPISTEMIC_HEDGE =
  /\b(?:may|might|could|perhaps|possibly|seems?|suggests?|working (?:hypothesis|formulation)|one possibility|it is possible)\b/i;

/** Return only sections containing an unhedged psychological inference. */
export function epistemicallyUncalibratedSectionIds(
  sections: ReportSection[],
) {
  return sections.flatMap((section) => {
    if (section.id === "questions") {
      return [];
    }
    const sentences = section.body.split(/(?<=[.!?])\s+/);
    const unsupported = sentences.some((sentence) =>
      sentence.split(/\s+(?:but|yet|however)\s+|[;—]/i).some(
        (clause) =>
          CERTAIN_PSYCHOLOGICAL_PREDICATE.test(clause) &&
          !EPISTEMIC_HEDGE.test(clause),
      ),
    );
    return unsupported ? [section.id] : [];
  });
}

function mentionsSource(body: string, source: string) {
  const bodyTokens = contentTokens(body);
  const generic = new Set(["pattern", "practical", "change", "stall", "working", "formulation", "hypothesis"]);
  const sourceTokens = [...contentTokens(source)].filter(
    (token) => token.length >= 4 && !generic.has(token),
  );
  const matches = sourceTokens.filter((token) => bodyTokens.has(token)).length;
  return sourceTokens.length > 0 && matches >= Math.min(2, sourceTokens.length);
}

const RECIPIENT_COUNT: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

function recipientCount(text: string) {
  const match = text.match(/\b(one|two|three|four)\b(?=[^.]*\b(?:recipients?|persons?|people|colleagues?|prospects?)\b)/i);
  return match ? RECIPIENT_COUNT[match[1].toLocaleLowerCase()] : undefined;
}

export function experimentCopyAgrees(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const section = sections.find((item) => item.id === "experiment");
  const action = state.experiments.map((item) => item.action).join(" ");
  if (!section || !action.trim()) {
    return {
      id: "experiment-copy",
      passed: true,
      detail: "No structured experiment action to compare with customer copy.",
    };
  }
  const stateCount = recipientCount(action);
  const reportCount = recipientCount(section.body);
  const agreed = !stateCount || !reportCount || stateCount === reportCount;
  return {
    id: "experiment-copy",
    passed: agreed,
    detail: agreed
      ? "Customer experiment copy does not contradict the structured audience."
      : "Customer experiment copy names a different recipient count than the structured action.",
  };
}

export function closeSynthesisAdequate(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const close = sections.find((section) => section.id === "close");
  const formulation = state.finalFormulation;
  if (!close || !formulation) {
    return { id: "close-synthesis", passed: Boolean(close), detail: close ? "No resolved formulation to synthesize." : "Close section is missing." };
  }
  const body = close.body;
  if (/failed,\s+therefore|therefore\s+(?:\w+\s+){0,6}(?:primary|proven|proves)/i.test(body)) {
    return {
      id: "close-synthesis",
      passed: false,
      detail: "The close must not treat a weakened explanation as proof that another is primary.",
    };
  }
  const complete =
    mentionsSource(body, formulation.maintenanceFormulation) &&
    mentionsSource(body, formulation.strongestAlternative) &&
    (!formulation.developmentalFormulation || mentionsSource(body, formulation.developmentalFormulation.possibleDevelopmentalTask)) &&
    /\b(?:unknown|unresolved|uncertain|remains?)\b/i.test(body) &&
    /\b(?:evidence|update|revise|weaken|change)\b/i.test(body);
  return {
    id: "close-synthesis",
    passed: complete,
    detail: complete
      ? "Close synthesizes the working formulation, rival, warranted development, unknowns, and updating evidence."
      : "Close must synthesize maintenance, the strongest alternative, warranted development, remaining unknowns, and evidence that would update the formulation.",
  };
}

export function developmentalSectionQuality(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const formulation = state.finalFormulation?.developmentalFormulation;
  const section = sections.find((item) => item.id === "developmental");
  if (!formulation) {
    return {
      id: "developmental-quality",
      passed: !section,
      detail: section
        ? "A practical-only case must stay depth-free."
        : "No developmental section is required.",
    };
  }
  if (!section) {
    return {
      id: "developmental-quality",
      passed: true,
      detail: "Developmental presence is checked separately.",
    };
  }
  const body = section.body;
  const problems: string[] = [];
  if (!/not the whole of who you are/i.test(body)) {
    problems.push("missing non-identification");
  }
  if (!formulation.possibleThird && !/not yet known/i.test(body)) {
    problems.push("missing unknown third");
  }
  if (/childish|immature|more mature|more adult|more integrated/i.test(body)) {
    problems.push("moral ranking of a pole");
  }
  if (/psyche wants|your psyche|individuation/i.test(body)) {
    problems.push("directive or forced individuation");
  }
  if (/integrate both/i.test(body) && !formulation.possibleThird) {
    problems.push("integrate both without emergence");
  }
  if (!/protect/i.test(body) || !/danger|hard to sustain|deadening|risk/i.test(body)) {
    problems.push("both poles need value and danger");
  }
  const maintenance = state.finalFormulation?.maintenanceFormulation ?? "";
  if (maintenance && body.trim() === maintenance.trim()) {
    problems.push("developmental section repeats the maintenance cause");
  }
  return {
    id: "developmental-quality",
    passed: problems.length === 0,
    detail: problems.length
      ? `Developmental section must keep both poles provisional: ${problems.join("; ")}.`
      : "Developmental section keeps both poles, non-identification, and an unknown or emergent third.",
  };
}

export function developmentalSectionAdequate(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const required = Boolean(
    state.finalFormulation?.developmentalFormulation,
  );
  const present = sections.some(
    (section) => section.id === "developmental",
  );
  return {
    id: "developmental-section",
    passed: !required || present,
    detail:
      required && !present
        ? "A surviving developmental formulation requires the developmental report section."
        : "Developmental report section matches the resolved formulation.",
  };
}

const PROTECTION_PEEL = /protect|protective|keeps|shield|bargain|benefit of staying/i;
const AIM_PEEL = /aim|develop|compensatory|growth|emerg|asking you to/i;
const INFLATION_DIAGNOSIS =
  /you are (an? )?eternal youth|eternal[- ]youth (complex|identity|archetype)|you are (an? )?(puer|senex)\b|romance of eternal becoming|romance-of-eternal-becoming|you live in (an? )?(endless|eternal) becoming/i;

/** When CaseState has hidden aim/protection fields, peel text must name both (CaseState alone is insufficient). */
export function protectionAndAimInPeel(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const hidden = state.hiddenPosition;
  if (!hidden) {
    return {
      id: "protection-and-aim",
      passed: true,
      detail: "No hidden position; protection/aim peel check skipped.",
    };
  }
  const fieldsArmed =
    hidden.protectiveFunction.length > 0 || Boolean(hidden.possibleCompensatoryAim?.trim());
  if (!fieldsArmed) {
    return {
      id: "protection-and-aim",
      passed: true,
      detail: "Hidden position has no aim/protection fields to require in peel.",
    };
  }
  const peel =
    sections.find((section) => section.id === "hidden")?.body ??
    sections.map((section) => section.body).join("\n");
  const ok = PROTECTION_PEEL.test(peel) && AIM_PEEL.test(peel);
  return {
    id: "protection-and-aim",
    passed: ok,
    detail: ok
      ? "Peel names protection and developmental aim as siblings."
      : "Hidden CaseState has aim/protection fields but peel text lacks both.",
  };
}
function attributedImageSpeech(
  text: string,
): string[] {
  const matches: string[] = [];

  const pattern =
    /\b(?:image|figure|obstacle|scene|gate|it)\s+(?:says?|said|whispers?|replies?|responds?|answers?)\s*[,\:]?\s*(?:["“']([^"”']+)["”']|([^.!?\n;}]+))/gi;

  for (const match of text.matchAll(pattern)) {
    const speech = (match[1] ?? match[2])?.trim();

    if (speech) {
      matches.push(speech);
    }
  }

  return matches;
}

export function imaginalWhenSpeech(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const suppliedSpeech =
    state.symbolicMaterial.obstacleSpeech?.trim();

  const text = sections
    .map((section) => section.body)
    .join("\n");

  const generatedSecondTurn =
    /\b(?:the image|the figure|the obstacle)\s+(?:reply|replies|respond|responds|answer|answers|whisper|whispers)\b/i.test(
      text,
    ) ||
    /\byou\s+(?:reply|replies|whisper|whispers)\b/i.test(text);

  const scriptedExchange =
    /\byou ask\b[\s\S]{0,180}\b(?:it|the image|the figure|the obstacle)\s+(?:says|replies|responds|answers)\b/i.test(
      text,
    );

  if (generatedSecondTurn || scriptedExchange) {
    return {
      id: "imaginal-when-speech",
      passed: false,
      detail:
        "Report appears to generate an imaginal reply or second turn of dialogue that was not supplied by the person.",
    };
  }

  const attributedSpeech =
    attributedImageSpeech(text);

  if (attributedSpeech.length > 0) {
    if (!suppliedSpeech) {
      return {
        id: "imaginal-when-speech",
        passed: false,
        detail:
          "Report attributes speech to an image or obstacle although no image speech was supplied.",
      };
    }

    const suppliedNormalized =
      normalize(suppliedSpeech);

    const inventedSpeech =
      attributedSpeech.filter(
        (speech) =>
          normalize(speech) !==
          suppliedNormalized,
      );

    if (inventedSpeech.length > 0) {
      return {
        id: "imaginal-when-speech",
        passed: false,
        detail:
          "Report attributes imaginal speech that does not match the person's supplied image speech.",
      };
    }
  }

  return {
    id: "imaginal-when-speech",
    passed: true,
    detail: suppliedSpeech
      ? "Supplied image speech may be used, but no additional imaginal dialogue was generated."
      : "No supplied image speech and no invented imaginal dialogue detected.",
  };
}

export function antiInflationDiagnosis(text: string): GateFinding {
  const hit = INFLATION_DIAGNOSIS.test(text);
  const unanchoredAlone =
    /unanchored ideal/i.test(text) && !/polarity|enantiodromia|\bboth\b|compensation/i.test(text);
  const failed = hit || unanchoredAlone;
  return {
    id: "anti-inflation",
    passed: !failed,
    detail: failed
      ? "Client-facing inflation diagnosis (eternal youth / archetype identity / romance of eternal becoming)."
      : "No client-facing inflation diagnosis.",
  };
}

/** Hard peel gates shared by pass9 and post-pass10 merge. */
export function assertPeelHardGates(sections: ReportSection[], state: CaseState): void {
  const developmental = developmentalSectionAdequate(sections, state);
  if (!developmental.passed) {
    throwGate(developmental);
  }
  const developmentalQuality = developmentalSectionQuality(sections, state);
  if (!developmentalQuality.passed) {
    throwGate(developmentalQuality);
  }
  const layers = reportLayerCoverage(sections, state);
  if (!layers.passed) {
    throwGate(layers);
  }
  for (const citation of tierACitationGates(sections, state)) {
    if (!citation.passed) {
      throwGate(citation);
    }
  }
  for (const voice of clientVoiceGates(sections)) {
    if (!voice.passed) {
      throwGate(voice);
    }
  }
  const body = sections.map((section) => section.body).join("\n");
  const senex = senexScoldOnly(body);
  if (!senex.passed) {
    throwGate(senex);
  }
  const aim = protectionAndAimInPeel(sections, state);
  if (!aim.passed) {
    throwGate(aim);
  }
  const imaginal = imaginalWhenSpeech(sections, state);
  if (!imaginal.passed) {
    throwGate(imaginal);
  }
  const somatic =
  somaticProvenance(sections, state);

  if (!somatic.passed) {
    throwGate(somatic);
  }
  const questionsClose =
  questionsAndCloseAdequate(sections, state);

if (!questionsClose.passed) {
  throwGate(questionsClose);
}
  const closeSynthesis = closeSynthesisAdequate(sections, state);
  if (!closeSynthesis.passed) {
    throwGate(closeSynthesis);
  }
  const experimentCopy = experimentCopyAgrees(sections, state);
  if (!experimentCopy.passed) {
    throwGate(experimentCopy);
  }
  const inflation = antiInflationDiagnosis(body);
  if (!inflation.passed) {
    throwGate(inflation);
  }
}

export function warrantsJungianPolarity(state: CaseState) {
  return (
    state.history.supportiveStructures.length > 0 ||
    state.history.missingStructures.length > 0 ||
    state.hiddenBargain.developmentalAsk.length > 0 ||
    state.projections.admiredFigures.length > 0
  );
}

export type GateError = Error & { gateId: string; findings: GateFinding[] };

export function throwGate(finding: GateFinding): never {
  const error = new Error(finding.detail) as GateError;
  error.gateId = finding.id;
  error.findings = [finding];
  throw error;
}

export function isGateError(error: unknown): error is GateError {
  return error instanceof Error && typeof (error as GateError).gateId === "string";
}

const LOCATION_CLAIM =
  /\b(?:in|through|across|around|inside|at)\s+(?:your\s+)?(?:chest|throat|stomach|belly|gut|heart|shoulders?|neck|jaw|head|back|arms?|legs?|hands?|feet)\b/i;
const NAMED_SENSATION =
  /\b(?:bodily|somatic|physical)\s+(?:tightness|pressure|heaviness|heat|cold|tingling|numbness|constriction|ache|pain|tension)\b/i;
const OBSERVATION_OF_SENSATION =
  /\b(?:track|notice|watch|observe|note|record)\b[^.]{0,60}\b(?:bodily|somatic|physical)\s+(?:tightness|pressure|heaviness|heat|cold|tingling|numbness|constriction|ache|pain|tension)\b/i;

function sectionStatesSomaticClaim(body: string) {
  if (LOCATION_CLAIM.test(body)) {
    return true;
  }
  return NAMED_SENSATION.test(body) && !OBSERVATION_OF_SENSATION.test(body);
}

function hasSuppliedSomaticMaterial(
  state: CaseState,
) {
  return (
    state.affect.bodyResponses.length > 0
  );
}

export function somaticProvenance(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const bodyClaims = sections.filter((section) =>
    sectionStatesSomaticClaim(section.body),
  );

  if (!bodyClaims.length) {
    return {
      id: "somatic-provenance",
      passed: true,
      detail:
        "No explicit somatic claims require provenance.",
    };
  }

  if (!hasSuppliedSomaticMaterial(state)) {
    return {
      id: "somatic-provenance",
      passed: false,
      detail:
        `Report introduces explicit body/sensory claims without supplied body-response evidence in: ${bodyClaims
          .map((section) => section.id)
          .join(", ")}`,
    };
  }

  const hasBodyEvidenceRef = bodyClaims.every(
    (section) =>
      section.evidenceRefs.some(
        (ref) =>
          /:Q3\.3S$/.test(ref),
      ),
  );

  return {
    id: "somatic-provenance",
    passed: hasBodyEvidenceRef,
    detail: hasBodyEvidenceRef
      ? "Explicit somatic claims are grounded in supplied body-response evidence."
      : "Explicit somatic claims must cite the supplied body-response evidence.",
  };
}
