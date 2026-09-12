import type { CaseState } from "../schemas/case-state";
import type { EvidenceItem } from "../schemas/evidence";
import { collectEvidenceIds } from "./evidence-ids";

/** Trim rules for live report stages — keep snapshot under a few KB of JSON. */
export const STAGE_INPUT_TRIM = {
  maxAnswerEntries: 40,
  maxAnswerChars: 400,
  maxEvidenceItems: 24,
  maxQuoteChars: 280,
  maxHypotheses: 5,
  maxContradictions: 4,
  maxExperiments: 3,
  maxJungianLenses: 3,
} as const;

const REPORT_STAGES = new Set(["pass9", "pass10"]);

function trimText(value: unknown, max: number = STAGE_INPUT_TRIM.maxAnswerChars) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value).slice(0, max);
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value).slice(0, max);
  }
  return undefined;
}

function collectEvidenceItems(state: CaseState): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    const record = value as Partial<EvidenceItem>;
    if (
      typeof record.id === "string" &&
      typeof record.questionId === "string" &&
      typeof record.normalizedMeaning === "string"
    ) {
      items.push(record as EvidenceItem);
    }
    Object.values(record).forEach(walk);
  };
  walk(state);
  return items;
}

function answersByQuestionId(answers: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(answers)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, STAGE_INPUT_TRIM.maxAnswerEntries);
  for (const key of keys) {
    const trimmed = trimText(answers[key]);
    if (trimmed !== undefined && trimmed !== "") {
      out[key] = trimmed;
    }
  }
  return out;
}

export function buildCaseSnapshot(input: {
  caseState: CaseState;
  answers: Record<string, unknown>;
}) {
  const { caseState, answers } = input;
  const evidence = collectEvidenceItems(caseState)
    .slice(0, STAGE_INPUT_TRIM.maxEvidenceItems)
    .map((item) => ({
      id: item.id,
      questionId: item.questionId,
      quote: trimText(item.rawQuote ?? item.normalizedMeaning, STAGE_INPUT_TRIM.maxQuoteChars),
    }));

  return {
    // Trim rules: maxAnswerEntries/maxAnswerChars, maxEvidenceItems, limited lists below.
    evidenceAllowlist: [...collectEvidenceIds(caseState)],
    evidence,
    answersByQuestionId: answersByQuestionId(answers),
    practicalContext: {
      workStatus: caseState.practicalContext.workStatus,
      professionalBackground: trimText(caseState.practicalContext.professionalBackground),
      transitionDuration: caseState.practicalContext.transitionDuration,
      practicalPressure: caseState.practicalContext.practicalPressure,
    },
    contradictions: caseState.contradictions.slice(0, STAGE_INPUT_TRIM.maxContradictions).map((item) => ({
      id: item.id,
      statementA: trimText(item.statementA, STAGE_INPUT_TRIM.maxQuoteChars),
      statementB: trimText(item.statementB, STAGE_INPUT_TRIM.maxQuoteChars),
      evidenceA: item.evidenceA,
      evidenceB: item.evidenceB,
      significance: item.significance,
      originForks: item.originForks,
    })),
    hypotheses: caseState.hypotheses.slice(0, STAGE_INPUT_TRIM.maxHypotheses).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      observedPattern: trimText(item.observedPattern, STAGE_INPUT_TRIM.maxQuoteChars),
      confidence: item.confidence,
      originForks: item.originForks,
      evidenceFor: item.evidenceFor,
      evidenceAgainst: item.evidenceAgainst,
    })),
    hiddenPosition: caseState.hiddenPosition
      ? {
          consciousPosition: trimText(caseState.hiddenPosition.consciousPosition),
          observedPattern: trimText(caseState.hiddenPosition.observedPattern),
          possibleHiddenPosition: trimText(caseState.hiddenPosition.possibleHiddenPosition),
          evidenceRefs: caseState.hiddenPosition.evidenceRefs,
          confidence: caseState.hiddenPosition.confidence,
        }
      : null,
    jungianLenses: caseState.jungianLenses.slice(0, STAGE_INPUT_TRIM.maxJungianLenses).map((item) => ({
      concept: item.concept,
      observedPatternItIlluminates: trimText(item.observedPatternItIlluminates),
      evidenceRefs: item.evidenceRefs,
      confidence: item.confidence,
    })),
    realityCheck: caseState.realityCheck
      ? {
          sufficientWithoutDepth: caseState.realityCheck.sufficientWithoutDepth,
          narrative: trimText(caseState.realityCheck.narrative),
          categories: caseState.realityCheck.categories,
          evidenceRefs: caseState.realityCheck.evidenceRefs,
        }
      : null,
    experiments: caseState.experiments.slice(0, STAGE_INPUT_TRIM.maxExperiments).map((item) => ({
      kind: item.kind,
      title: item.title,
      action: trimText(item.action),
      hypothesisTested: trimText(item.hypothesisTested),
      evidenceHint: item.whatToObserve.slice(0, 3),
    })),
    requestedInsightNote:
      "requestedInsight (Q11.3) is the client's wish for the report — not the report spine. Ground claims in evidenceAllowlist and answersByQuestionId.",
  };
}

export function buildStageLlmInput(input: {
  stage: string;
  assessmentId: string;
  evidenceRef: string;
  caseState: CaseState;
  answers: Record<string, unknown>;
  fixture?: unknown;
  failSchema?: boolean;
  failStage?: unknown;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    fixture: input.fixture,
    assessmentId: input.assessmentId,
    evidenceRef: input.evidenceRef,
    requestedInsight: input.caseState.userFinalReflection.requestedInsight,
    failSchema: input.failSchema,
    failStage: input.failStage,
  };
  if (!REPORT_STAGES.has(input.stage)) {
    return base;
  }
  return {
    ...base,
    caseSnapshot: buildCaseSnapshot({
      caseState: input.caseState,
      answers: input.answers,
    }),
  };
}
