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
      passed: true,
      detail: "No experiments to bind yet.",
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
  alternative: "Another plausible interpretation",
  experiment: "Your experiment",
  jungian: "A Jungian lens",
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
  alternative: /^(the |another )?(plausible )?interpretation$|^(the )?alternative$/i,
  experiment: /^(the |your )?experiment$/i,
  jungian: /^(the |a )?jungian lens$/i,
};

function sectionById(sections: ReportSection[], id: string) {
  return sections.find((section) => section.id === id);
}

function refsOn(sections: ReportSection[]) {
  return sections.flatMap((section) => section.evidenceRefs);
}

const INTERPRETIVE_SECTION_IDS = new Set([
  "problem",
  "reality",
  "contradiction",
  "hidden",
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

/** When rich Q10 associations exist, reality or hidden must cite :Q10. (cues alone insufficient). */
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

const PROTECTION_PEEL = /protect|protective|keeps|shield|bargain|benefit of staying/i;
const AIM_PEEL = /aim|develop|structure in service|aliveness|compensatory|asking you to/i;
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
    /\b(?:you|the image|the figure|the obstacle)\s+(?:reply|replies|respond|responds|answer|answers|whisper|whispers)\b/i.test(
      text,
    );

  const scriptedExchange =
    /\byou ask\b[\s\S]{0,180}\b(?:it|the image|the figure|the obstacle)\s+(?:says|replies|responds|answers)\b/i.test(
      text,
    );

  const failed =
    generatedSecondTurn || scriptedExchange;

  if (failed) {
    return {
      id: "imaginal-when-speech",
      passed: false,
      detail:
        "Report appears to generate an imaginal reply or second turn of dialogue that was not supplied by the person.",
    };
  }

  if (!suppliedSpeech) {
    return {
      id: "imaginal-when-speech",
      passed: true,
      detail:
        "No supplied obstacle speech; no generated imaginal dialogue detected.",
    };
  }

  return {
    id: "imaginal-when-speech",
    passed: true,
    detail:
      "Supplied image speech may be used, but no additional imaginal dialogue was generated.",
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

const SOMATIC_CLAIM =
  /\b(?:in|through|across|around|inside|at)\s+(?:your\s+)?(?:chest|throat|stomach|belly|gut|heart|shoulders?|neck|jaw|head|back|arms?|legs?|hands?|feet)\b|\b(?:bodily|somatic|physical)\s+(?:tightness|pressure|heaviness|heat|cold|tingling|numbness|constriction|ache|pain|tension)\b/i;

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
    SOMATIC_CLAIM.test(section.body),
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
