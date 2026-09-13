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
    /scene|pipe|association|image|obstacle|speech/i.test(vote.note);
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
  persona: /persona|identity|legitimacy|authenticity|lightness|flow|hustler/i,
  projection: /projection|admir|fascination|rejected|watcher|gaze|figure/i,
  charge: /body|charge|shame|fear|anxiety|emotion|freeze/i,
  bargain: /protect|bargain|staying|threatened|benefit of staying/i,
  history: /history|recurrence|years|structure|container|institution/i,
  symbol: /image|symbol|pipe|scene|dream|association/i,
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
