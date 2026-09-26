import type { CaseState } from "@/engine/schemas/case-state";
import type { Experiment, ReportSection } from "@/engine/schemas/analysis";

export type EpistemologyScoreId =
  | "rival_lexicon"
  | "inverse_proof_close"
  | "binary_layer_question"
  | "clinical_finding"
  | "certain_symbol"
  | "unclean_two_variable"
  | "invented_analogue"
  | "layered_contributor_shape"
  | "residual_question_present";

export type EpistemologyScore = {
  id: EpistemologyScoreId;
  passed: boolean;
  detail: string;
  hard: boolean;
};

const RIVAL_LEXICON =
  /\brival\b|primary weight|fundamentally a|the real cause|where the friction lives|\bwins\b|\bproves\b|rules out|therefore primary|mundane challenger|one layer must win|defeat the other|primary vs secondary/i;

const INVERSE_PROOF_CLOSE =
  /\bif\b[\s\S]{0,120}\b(?:works|succeeds|fails|freezes|persists)\b[\s\S]{0,120}\b(?:primary|central leverage|real cause|\bwins\b)\b/i;

const BINARY_LAYER_QUESTION =
  /\bis your primary difficulty\b[\s\S]{0,120}\bor\b|\bwhich hypothesis is true\b|\b(?:practical|structure|missing structure|adhd|skill)\b[\s\S]{0,80}\bor\b[\s\S]{0,80}\b(?:psychological|social vulnerability|protective|hidden|depth)\b|\b(?:psychological|social vulnerability|protective|hidden|depth)\b[\s\S]{0,80}\bor\b[\s\S]{0,80}\b(?:practical|structure|missing structure|adhd|skill)\b/i;

const CLINICAL_FINDING =
  /\bnarcissistic\b|\bnarcissism\b|personality disorder|\bborderline\b|functional breakdown|skill deficits|executive dysfunction|\bwounded\b|\bbroken\b|unmanaged ADHD|trauma diagnosis/i;

const CERTAIN_SYMBOL =
  /\bfunctions as\b|\bthis is a classic\b|\bthese figures point toward\b(?!\s+(?:could|may|might|possible|one reading))/i;

const SYMBOL_HEDGE = /\b(?:could|may|might|possible|one (?:possible )?reading|one possible Jungian amplification)\b/i;

const STRUCTURE_TOKENS = /\b(?:structure|timebox|timer|deadline|accountability|checklist)\b/i;
const EXPOSURE_TOKENS = /\b(?:send|show|exposure|visibility|publish)\b/i;

const INVENTED_ANALOGUE =
  /\b(?:clean(?:ing)? your kitchen|kitchen cleaning|fold(?:ing)? laundry|organize your closet)\b/i;

function score(
  id: EpistemologyScoreId,
  passed: boolean,
  detail: string,
  hard = true,
): EpistemologyScore {
  return { id, passed, detail, hard };
}

function joinedSections(sections: ReportSection[]) {
  return sections.map((section) => section.body).join("\n");
}

function stripQuotedSpans(text: string) {
  return text.replace(/"[^"]*"|'[^']*'/g, " ");
}

export function hasRivalLexicon(text: string) {
  return RIVAL_LEXICON.test(text);
}

export function hasInverseProofClose(text: string) {
  return INVERSE_PROOF_CLOSE.test(text) ||
    /\bif\b[\s\S]{0,80}\bthen\b[\s\S]{0,80}\b(?:primary|central leverage|real cause)\b/i.test(text);
}

export function hasBinaryPracticalPsychologicalQuestion(text: string) {
  return BINARY_LAYER_QUESTION.test(text);
}

export function hasClinicalFindingLanguage(text: string) {
  return CLINICAL_FINDING.test(stripQuotedSpans(text));
}

export function hasUnhedgedSymbolPredicate(text: string) {
  if (!CERTAIN_SYMBOL.test(text) && !/\bfunctions as\b|\bthis is a classic\b/i.test(text)) {
    return false;
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => {
    const unhedgedClassic =
      /\bfunctions as\b|\bthis is a classic\b/i.test(sentence) && !SYMBOL_HEDGE.test(sentence);
    const unhedgedPoint =
      /\bthese figures point toward\b/i.test(sentence) &&
      !/\bthese figures may point toward\b|\bcould\b|\bmay\b|\bmight\b|\bpossible\b|\bone reading\b/i.test(
        sentence,
      );
    return unhedgedClassic || unhedgedPoint;
  });
}

export function hasUncleanTwoVariableExperiment(experiment: Experiment) {
  const action = experiment.action ?? "";
  // Ignore factors explicitly held constant in the action text.
  const changedAction = action.replace(
    /\bhold(?:ing)?\s+([a-z][\w-]*)\s+constant\b/gi,
    " ",
  );
  const hasStructure = STRUCTURE_TOKENS.test(changedAction);
  const hasExposure = EXPOSURE_TOKENS.test(changedAction);
  if (!(hasStructure && hasExposure)) return false;
  const namedFactor =
    typeof (experiment as { practicalCondition?: { factor?: string } }).practicalCondition?.factor ===
      "string" &&
    Boolean((experiment as { practicalCondition?: { factor?: string } }).practicalCondition?.factor?.trim());
  return !namedFactor;
}

function suppliedAnalogueText(state: CaseState) {
  const historyBits = [
    ...state.history.earlierOccurrences,
    ...state.history.supportiveStructures,
    ...state.history.missingStructures,
  ].map((item) => item.normalizedMeaning);
  const parallel = (state as CaseState & {
    parallelPatterns?: {
      similarStrugglesElsewhere?: string;
      lowerStakesExample?: string;
      oppositeOrEasyExample?: string;
    };
  }).parallelPatterns;
  return [
    ...historyBits,
    parallel?.similarStrugglesElsewhere,
    parallel?.lowerStakesExample,
    parallel?.oppositeOrEasyExample,
  ]
    .filter(Boolean)
    .join("\n");
}

export function hasInventedAnalogue(state: CaseState) {
  const experiments = state.experiments ?? [];
  return experiments.some((experiment) => {
    if (!INVENTED_ANALOGUE.test(experiment.action)) return false;
    const supplied = suppliedAnalogueText(state);
    return !INVENTED_ANALOGUE.test(supplied);
  });
}

export function hasResidualLayerQuestion(text: string) {
  return /if[\s\S]{0,100}(?:made|makes|make)[\s\S]{0,100}easier[\s\S]{0,160}(?:remain|still|would still)/i.test(
    text,
  );
}

export function evaluateEpistemologyQualification(
  state: CaseState,
  sections: ReportSection[],
) {
  const text = joinedSections(sections);
  const questions = sections.find((section) => section.id === "questions")?.body ?? "";
  const close = sections.find((section) => section.id === "close")?.body ?? "";
  const alternative = sections.find((section) => section.id === "alternative")?.body ?? "";
  const jungian = sections.find((section) => section.id === "jungian")?.body ?? "";
  const hidden = sections.find((section) => section.id === "hidden")?.body ?? "";

  const rivalPass = !hasRivalLexicon(text);
  const inversePass = !hasInverseProofClose(close) && !hasInverseProofClose(text);
  const binaryPass = !hasBinaryPracticalPsychologicalQuestion(questions);
  const clinicalPass =
    !hasClinicalFindingLanguage(hidden) &&
    !hasClinicalFindingLanguage(alternative) &&
    !hasClinicalFindingLanguage(jungian) &&
    !hasClinicalFindingLanguage(close);
  const symbolPass = !hasUnhedgedSymbolPredicate(jungian) && !hasUnhedgedSymbolPredicate(text);
  const uncleanPass = !(state.experiments ?? []).some((experiment) =>
    hasUncleanTwoVariableExperiment(experiment),
  );
  const inventedPass = !hasInventedAnalogue(state);
  const layeredShapePass =
    !/alongside the psychological pattern[\s\S]{0,80}practical layer/i.test(alternative)
      ? !hasRivalLexicon(alternative)
      : true;
  const residualPass =
    questions.trim().length === 0 || hasResidualLayerQuestion(questions);

  const scores: EpistemologyScore[] = [
    score(
      "rival_lexicon",
      rivalPass,
      rivalPass
        ? "Customer prose does not frame practical conditions as rivals or winners."
        : "Customer prose uses rival / winner / primary-cause lexicon.",
    ),
    score(
      "inverse_proof_close",
      inversePass,
      inversePass
        ? "Close and customer prose avoid inverse-proof winner logic."
        : "Close or customer prose uses inverse-proof / winner logic.",
    ),
    score(
      "binary_layer_question",
      binaryPass,
      binaryPass
        ? "Questions do not force a practical-vs-psychological binary."
        : "A question forces a practical-vs-psychological choice.",
    ),
    score(
      "clinical_finding",
      clinicalPass,
      clinicalPass
        ? "Product voice avoids clinical finding language."
        : "Product voice uses clinical finding language.",
    ),
    score(
      "certain_symbol",
      symbolPass,
      symbolPass
        ? "Symbolic language stays hedged."
        : "Symbolic language assigns function as unhedged fact.",
    ),
    score(
      "unclean_two_variable",
      uncleanPass,
      uncleanPass
        ? "Experiments do not change structure and exposure together without a named practical condition."
        : "Experiment changes structure and exposure without a named practicalCondition.factor.",
    ),
    score(
      "invented_analogue",
      inventedPass,
      inventedPass
        ? "Experiments do not invent analogues the client did not supply."
        : "Experiment invents an analogue the client did not supply.",
    ),
    score(
      "layered_contributor_shape",
      layeredShapePass,
      layeredShapePass
        ? "Alternative section avoids rival framing."
        : "Alternative section frames layers as rivals.",
    ),
    score(
      "residual_question_present",
      residualPass,
      residualPass
        ? "Questions include a residual-layer inquiry, or no questions section is present."
        : "Questions omit a residual-layer inquiry when questions are present.",
    ),
  ];

  return {
    hardPassed: scores.filter((item) => item.hard).every((item) => item.passed),
    scores,
  };
}
