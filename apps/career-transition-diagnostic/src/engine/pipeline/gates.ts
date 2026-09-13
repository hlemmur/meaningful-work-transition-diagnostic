import type { CaseState } from "../schemas/case-state";
import type { Experiment, ReportSection } from "../schemas/analysis";

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
  vote?: CaseState["imageVote"],
): GateFinding {
  if (!hasRichImageAssociations(state) || !vote) {
    return {
      id: "image-adequacy",
      passed: true,
      detail: "No rich image associations requiring a substantive vote.",
    };
  }
  const citesImage =
    vote.evidenceRefs.some((ref) => /:Q10\./.test(ref)) ||
    /scene|association|image|obstacle|speech/i.test(vote.note);
  const failed = vote.verdict === "insufficient" && !citesImage;
  return {
    id: "image-adequacy",
    passed: !failed,
    detail: failed
      ? "Rich Q10 associations present but image vote was insufficient without citing them."
      : "Image vote respects available associations.",
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
  experiments: Experiment[] = state.experiments,
): GateFinding {
  if (!experiments.length) {
    return {
      id: "experiment-bind",
      passed: true,
      detail: "No experiments to bind yet.",
    };
  }
  const hypIds = state.hypotheses.map((item) => item.id);
  const hypTitles = state.hypotheses.map((item) => normalize(item.title));
  const forks = state.openForks.map((fork) => normalize(fork.replace(/_/g, " ")));
  const favorite = state.hypotheses[0];
  const openContainer =
    state.openForks.includes("container_loss_vs_capacity") ||
    state.openForks.includes("legitimacy_loop");

  let passed = false;
  for (const experiment of experiments) {
    const tested = normalize(experiment.hypothesisTested);
    const action = normalize(experiment.action);
    const bindsId = hypIds.some((id) => tested.includes(normalize(id)) || tested.includes(id.toLowerCase()));
    const bindsTitle = hypTitles.some((title) => title && (tested.includes(title) || paraphraseOverlap(tested, title) >= 0.35));
    const bindsFork = forks.some((fork) => fork && tested.includes(fork));
    const magicianCritique =
      /mentor|critique|blind spot|failure point|three reasons/i.test(experiment.action) ||
      /mentor|critique|blind spot/i.test(experiment.hypothesisTested);
    if (openContainer && magicianCritique && favorite && /container|structure|authoriz|legitimacy/i.test(favorite.title + favorite.observedPattern)) {
      return {
        id: "experiment-bind",
        passed: false,
        detail: "Experiment is unbound Magician-critique while container/legitimacy fork is open.",
      };
    }
    if (bindsId || bindsTitle || bindsFork || (favorite && paraphraseOverlap(tested, favorite.observedPattern) >= 0.3)) {
      passed = true;
    }
    // also accept explicit hyp id in title/action
    if (hypIds.some((id) => action.includes(id.toLowerCase()))) {
      passed = true;
    }
  }
  return {
    id: "experiment-bind",
    passed,
    detail: passed
      ? "Experiment bound to winning hypothesis or open fork."
      : "Experiment hypothesisTested is not bound to a surviving hypothesis or open fork.",
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

export function hasProjectionFigures(state: CaseState) {
  return (
    state.projections.admiredFigures.length + state.projections.rejectedFigures.length > 0
  );
}

export function hasMoneyTierA(state: CaseState) {
  return Object.values(state.money).some((items) => items.length > 0);
}

/** When rich Q10 associations exist, reality or hidden must cite :Q10. (cues alone insufficient). */
export function imageCited(sections: ReportSection[], state: CaseState): GateFinding {
  if (!hasRichImageAssociations(state)) {
    return {
      id: "image_cited",
      passed: true,
      detail: "No rich image associations requiring citation.",
    };
  }
  const core = [sectionById(sections, "reality"), sectionById(sections, "hidden")].filter(
    Boolean,
  ) as ReportSection[];
  const hasRef = refsOn(core).some((ref) => /:Q10\./.test(ref));
  return {
    id: "image_cited",
    passed: hasRef,
    detail: hasRef
      ? "Image associations cited via :Q10. in reality or hidden."
      : "Rich Q10 associations present but reality/hidden lack :Q10. evidenceRefs.",
  };
}

/** When admired/rejected figures exist, contradiction or hidden must cite :Q5. or :Q6. */
export function projectionCited(sections: ReportSection[], state: CaseState): GateFinding {
  if (!hasProjectionFigures(state)) {
    return {
      id: "projection_cited",
      passed: true,
      detail: "No projection figures requiring citation.",
    };
  }
  const target = [sectionById(sections, "contradiction"), sectionById(sections, "hidden")].filter(
    Boolean,
  ) as ReportSection[];
  const hasRefs = refsOn(target).some((ref) => /:Q5\.|:Q6\./.test(ref));
  return {
    id: "projection_cited",
    passed: hasRefs,
    detail: hasRefs
      ? "Projection figures cited via :Q5./:Q6. in contradiction or hidden."
      : "Admired/rejected figures present but contradiction/hidden lack :Q5./:Q6. evidenceRefs.",
  };
}

/** When money Tier-A buckets exist, reality or alternative must cite :Q8. */
export function moneyCited(sections: ReportSection[], state: CaseState): GateFinding {
  if (!hasMoneyTierA(state)) {
    return {
      id: "money_cited",
      passed: true,
      detail: "No money Tier-A buckets requiring citation.",
    };
  }
  const target = [sectionById(sections, "reality"), sectionById(sections, "alternative")].filter(
    Boolean,
  ) as ReportSection[];
  const hasRefs = refsOn(target).some((ref) => /:Q8\./.test(ref));
  return {
    id: "money_cited",
    passed: hasRefs,
    detail: hasRefs
      ? "Money Tier-A cited via :Q8. in reality or alternative."
      : "Money Tier-A present but reality/alternative lack :Q8. evidenceRefs.",
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

export function senexScoldOnly(text: string): GateFinding {
  const grind = /grow up|just (need )?(more )?discipline|stop seeking (insight|revelation)|unglamorous discomfort of daily execution/i.test(
    text,
  );
  const aliveness = /structure in service|aliveness|possibility|play|fascination|both poles/i.test(text);
  return {
    id: "senex-scold",
    passed: !(grind && !aliveness),
    detail:
      grind && !aliveness
        ? "Developmental frame collapses to senex-scold / grind-only."
        : "Developmental frame is not grind-only.",
  };
}

const PROTECTION_PEEL = /protect|protective|keeps|shield|bargain|benefit of staying/i;
const AIM_PEEL = /aim|develop|structure in service|aliveness|compensatory|asking you to/i;
const DIALOGUE_PEEL = /ask|speak|say|said|voice|image|scene|obstacle|dialogue|reply|replies|whisper/i;
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

/** When obstacleSpeech exists, require imaginal experiment or dialogue engagement in reality/hidden. */
export function imaginalWhenSpeech(
  sections: ReportSection[],
  state: CaseState,
): GateFinding {
  const speech = state.symbolicMaterial.obstacleSpeech?.trim();
  if (!speech) {
    return {
      id: "imaginal-when-speech",
      passed: true,
      detail: "No obstacleSpeech; imaginal engagement check skipped.",
    };
  }
  const hasImaginalExperiment = state.experiments.some((item) => item.kind === "imaginal");
  const depthBodies = sections
    .filter((section) => section.id === "reality" || section.id === "hidden")
    .map((section) => section.body)
    .join("\n");
  const hasDialogue = DIALOGUE_PEEL.test(depthBodies);
  const ok = hasImaginalExperiment || hasDialogue;
  return {
    id: "imaginal-when-speech",
    passed: ok,
    detail: ok
      ? "Image speech engaged via imaginal experiment or reality/hidden dialogue."
      : "obstacleSpeech present but peel lacks imaginal experiment or image dialogue.",
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
