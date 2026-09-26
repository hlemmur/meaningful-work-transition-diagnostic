import type { CaseState } from "../schemas/case-state";
import type { EvidenceItem } from "../schemas/evidence";
import { collectCanonicalEvidenceIds } from "./evidence-ids";
import {
  CANONICAL_PEEL_TITLES,
  hasMoneyTierA,
  hasProjectionFigures,
  hasRichImageAssociations,
} from "./gates";

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

const SNAPSHOT_STAGES = new Set([
  "pass1",
  "pass2",
  "pass3",
  "pass4",
  "pass5",
  "pass6",
  "pass7",
  "pass8",
  "pass9",
  "pass10",
]);

/** Map symbolicMaterial fields → questionnaire ids used by Tier-A image gates. */
const IMAGE_FIELD_TO_QUESTION: Array<{
  field: keyof CaseState["symbolicMaterial"];
  questionId: string;
}> = [
  { field: "scene", questionId: "Q10.1" },
  { field: "surroundings", questionId: "Q10.2" },
  { field: "obstacle", questionId: "Q10.3" },
  { field: "ahead", questionId: "Q10.4" },
  { field: "figures", questionId: "Q10.5" },
  { field: "obstacleSpeech", questionId: "Q10.6" },
  { field: "obstacleWant", questionId: "Q10.7" },
  { field: "ifNotRemoved", questionId: "Q10.8" },
];

export function trimText(value: unknown, max: number = STAGE_INPUT_TRIM.maxAnswerChars) {
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

const IMAGE_QUESTION_IDS = new Set(IMAGE_FIELD_TO_QUESTION.map((item) => item.questionId));

function answersByQuestionId(answers: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(answers).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const selected = new Set([
    ...keys.filter((key) => !IMAGE_QUESTION_IDS.has(key)).slice(0, STAGE_INPUT_TRIM.maxAnswerEntries),
    ...keys.filter((key) => IMAGE_QUESTION_IDS.has(key)),
  ]);
  for (const key of keys) {
    if (!selected.has(key)) {
      continue;
    }
    const trimmed = trimText(answers[key]);
    if (trimmed !== undefined && trimmed !== "") {
      out[key] = trimmed;
    }
  }
  return out;
}

function refId(assessmentId: string, questionId: string) {
  return `${assessmentId}:${questionId}`;
}

function imageFieldPresent(value: CaseState["symbolicMaterial"][keyof CaseState["symbolicMaterial"]]) {
  return Array.isArray(value) ? value.some((item) => item.trim()) : Boolean(value?.trim());
}

function imageCiteRefs(state: CaseState): string[] {
  return IMAGE_FIELD_TO_QUESTION.flatMap(({ field, questionId }) =>
    imageFieldPresent(state.symbolicMaterial[field])
      ? [refId(state.assessmentId, questionId)]
      : [],
  );
}

function imageFieldEvidenceRefs(state: CaseState): Record<string, string> {
  return Object.fromEntries(
    IMAGE_FIELD_TO_QUESTION.flatMap(({ field, questionId }) =>
      imageFieldPresent(state.symbolicMaterial[field])
        ? [[field, refId(state.assessmentId, questionId)]]
        : [],
    ),
  );
}

function projectionCiteRefs(state: CaseState): string[] {
  const refs = new Set<string>();
  for (const figure of [
    ...state.projections.admiredFigures,
    ...state.projections.rejectedFigures,
  ]) {
    for (const item of figure.evidenceRefs) {
      refs.add(item);
    }
  }
  return [...refs];
}

function moneyCiteRefs(state: CaseState): string[] {
  const refs: string[] = [];
  for (const items of Object.values(state.money)) {
    for (const item of items) {
      refs.push(item.id);
    }
  }
  return [...new Set(refs)];
}

function evidenceSummary(
  items: EvidenceItem[],
  maxItems = 3,
) {
  return items
    .slice(0, maxItems)
    .map((item) => ({
      id: item.id,
      questionId: item.questionId,
      quote: trimText(
        item.rawQuote ??
          item.normalizedMeaning,
        STAGE_INPUT_TRIM.maxQuoteChars,
      ),
    }));
}

function projectionSummary(
  items: CaseState["projections"]["admiredFigures"],
  maxItems = 3,
) {
  return items
    .slice(0, maxItems)
    .map((item) => ({
      figure: trimText(
        item.figure,
        STAGE_INPUT_TRIM.maxQuoteChars,
      ),
      wantedQuality: trimText(
        item.wantedQuality,
        160,
      ),
      judgedQuality: trimText(
        item.judgedQuality,
        160,
      ),
      evidenceRefs: item.evidenceRefs,
    }));
}

export function buildRequiredCitations(state: CaseState) {
  return {
    image: hasRichImageAssociations(state)
      ? {
          mustAppearInReport: true,
          refs: imageCiteRefs(state),
        }
      : null,

    projection: hasProjectionFigures(state)
      ? {
          mustAppearInReport: true,
          refs: projectionCiteRefs(state),
        }
      : null,

    money: hasMoneyTierA(state)
      ? {
          mustAppearInReport: true,
          refs: moneyCiteRefs(state),
        }
      : null,
  };
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

  const imageRefs = imageCiteRefs(caseState);
  const moneyRefs = moneyCiteRefs(caseState);
  const requiredCitations = buildRequiredCitations(caseState);
  const evidenceAllowlist = new Set(collectCanonicalEvidenceIds(caseState));

  return {
    // Trim rules: maxAnswerEntries/maxAnswerChars, maxEvidenceItems, limited lists below.
    evidenceAllowlist: [...evidenceAllowlist],
    evidence,
    answersByQuestionId: answersByQuestionId(answers),
    /**
       * Report-wide evidence coverage requirements.
       * Pass9/10 may place relevant material in whichever section best serves
       * the resolved formulation, but evidenceRefs must come from these refs.
    */
    requiredCitations,
    /** Exact peel titles the report must use (also enforced by sanitize). */
    requiredTitles: { ...CANONICAL_PEEL_TITLES },
    signals: {
      evidenceAbsorption: evidenceSummary(
        caseState.history.evidenceAbsorption,
      ),

      supportiveStructures: evidenceSummary(
        caseState.history.supportiveStructures,
      ),

      missingStructures: evidenceSummary(
        caseState.history.missingStructures,
      ),

      expectedInternalProvision: evidenceSummary(
        caseState.history.expectedInternalProvision,
      ),

      functionWithoutAudience: evidenceSummary(
        caseState.history.functionWithoutAudience,
      ),

      functionWithAccountability: evidenceSummary(
        caseState.history.functionWithAccountability,
      ),

      legitimacyLoop: evidenceSummary(
        caseState.history.legitimacyLoop,
      ),

      jobShape: {
        identityWithoutWork:
          evidenceSummary(
            caseState.futureFantasy
              .identityWithoutWork,
          ),

        workWithoutIdentity:
          evidenceSummary(
            caseState.futureFantasy
              .workWithoutIdentity,
          ),

        jobShapeChange:
          evidenceSummary(
            caseState.futureFantasy
              .jobShapeChange,
          ),

        continueDespiteDifficulty:
          evidenceSummary(
            caseState.futureFantasy
              .continueDespiteDifficulty,
          ),

        wrongVsDifficult:
          evidenceSummary(
            caseState.futureFantasy
              .wrongVsDifficult,
          ),
      },

      money: {
        easyMoneyHistory:
          evidenceSummary(
            caseState.money.easyMoneyHistory,
          ),

        hardMoneyHistory:
          evidenceSummary(
            caseState.money.hardMoneyHistory,
          ),

        economicStructures:
          evidenceSummary(
            caseState.money.economicStructures,
          ),

        invisibleMachinery:
          evidenceSummary(
            caseState.money.invisibleMachinery,
          ),

        easyVsHardDifference:
          evidenceSummary(
            caseState.money
              .easyVsHardDifference,
          ),

        backgroundIncome:
          evidenceSummary(
            caseState.money.backgroundIncome,
          ),
      },

      projections: {
        admired: projectionSummary(
          caseState.projections
            .admiredFigures,
        ),

        rejected: projectionSummary(
          caseState.projections
            .rejectedFigures,
        ),
      },

      hiddenBargain: {
        benefitsOfStaying:
          evidenceSummary(
            caseState.hiddenBargain
              .benefitsOfStaying,
          ),

        protectAndThreaten:
          evidenceSummary(
            caseState.hiddenBargain
              .protectAndThreaten,
          ),

        giveUpIfReal:
          evidenceSummary(
            caseState.hiddenBargain
              .giveUpIfReal,
          ),

        responsibilityOfSuccess:
          evidenceSummary(
            caseState.hiddenBargain
              .responsibilityOfSuccess,
          ),

        developmentalAsk:
          evidenceSummary(
            caseState.hiddenBargain
              .developmentalAsk,
          ),
      },

      symbolicMaterial: {
        scene: trimText(
          caseState.symbolicMaterial.scene,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        surroundings: trimText(
          caseState.symbolicMaterial
            .surroundings,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        obstacle: trimText(
          caseState.symbolicMaterial
            .obstacle,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        ahead: trimText(
          caseState.symbolicMaterial.ahead,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        figures: caseState.symbolicMaterial.figures
          ?.slice(0, 3)
          .map((item) => trimText(item, STAGE_INPUT_TRIM.maxQuoteChars))
          .filter((item): item is string => typeof item === "string"),

        obstacleSpeech: trimText(
          caseState.symbolicMaterial
            .obstacleSpeech,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        obstacleWant: trimText(
          caseState.symbolicMaterial
            .obstacleWant,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        ifNotRemoved: trimText(
          caseState.symbolicMaterial
            .ifNotRemoved,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),

        citeRefs: imageRefs,
        fieldEvidenceRefs: imageFieldEvidenceRefs(caseState),
      },
    },
    tierA: {
      projections: {
        admired: caseState.projections.admiredFigures.slice(0, 3).map((item) => ({
          figure: trimText(item.figure, STAGE_INPUT_TRIM.maxQuoteChars),
          wantedQuality: trimText(item.wantedQuality, 160),
          evidenceRefs: item.evidenceRefs,
        })),
        rejected: caseState.projections.rejectedFigures.slice(0, 3).map((item) => ({
          figure: trimText(item.figure, STAGE_INPUT_TRIM.maxQuoteChars),
          judgedQuality: trimText(item.judgedQuality, 160),
          evidenceRefs: item.evidenceRefs,
        })),
      },
      money: {
        easy: trimText(caseState.money.easyMoneyHistory[0]?.rawQuote, STAGE_INPUT_TRIM.maxQuoteChars),
        infrastructure: trimText(
          caseState.money.invisibleMachinery[0]?.rawQuote,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),
        hard: trimText(caseState.money.hardMoneyHistory[0]?.rawQuote, STAGE_INPUT_TRIM.maxQuoteChars),
        citeRefs: moneyRefs,
      },
      bargain: {
        benefits: trimText(
          caseState.hiddenBargain.benefitsOfStaying[0]?.rawQuote,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),
        protectThreaten: trimText(
          caseState.hiddenBargain.protectAndThreaten[0]?.rawQuote,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),
        developmentalAsk: trimText(
          caseState.hiddenBargain.developmentalAsk[0]?.rawQuote,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),
      },
      image: {
        scene: trimText(caseState.symbolicMaterial.scene, STAGE_INPUT_TRIM.maxQuoteChars),
        surroundings: trimText(caseState.symbolicMaterial.surroundings, STAGE_INPUT_TRIM.maxQuoteChars),
        obstacleSpeech: trimText(
          caseState.symbolicMaterial.obstacleSpeech,
          STAGE_INPUT_TRIM.maxQuoteChars,
        ),
        citeRefs: imageRefs,
      },
      chargeIntensity: caseState.affect.chargeIntensity,
      constraints: caseState.practicalContext.constraints
        .slice(0, 3)
        .map((item) => trimText(item.rawQuote, STAGE_INPUT_TRIM.maxQuoteChars)),
    },
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
    hypothesisCritiques:
  caseState.hypothesisCritiques.map(
    (item) => ({
      hypothesisId:
        item.hypothesisId,

      strongestMundaneAlternative:
        trimText(
          item.strongestMundaneAlternative,
        ),

      counterEvidenceRefs:
        item.counterEvidenceRefs,

      missingEvidence:
        item.missingEvidence
          .slice(0, 3),

      confirmationBiasRisk:
        trimText(
          item.confirmationBiasRisk,
        ),

      overPsychologizingRisk:
        trimText(
          item.overPsychologizingRisk,
        ),

      evidenceActuallyUniqueToHypothesis:
        item.evidenceActuallyUniqueToHypothesis,

      rankAdjustment:
        item.rankAdjustment,

      reason:
        trimText(item.reason),
    }),
  ),
  imageVotes:
  caseState.imageVotes.map(
    (vote) => ({
      hypothesisId:
        vote.hypothesisId,

      verdict:
        vote.verdict,

      interpretation:
        trimText(
          vote.interpretation ??
            vote.note,
        ),

      evidenceRefs:
        vote.evidenceRefs,

      exactClientMaterialUsed:
        vote.exactClientMaterialUsed ??
        [],
    }),
  ),
  imageAnalysis: caseState.imageAnalysis
    ? {
        literalFacts: caseState.imageAnalysis.literalFacts,
        personalAssociations: caseState.imageAnalysis.personalAssociations,
        plausibleReadings: caseState.imageAnalysis.plausibleReadings,
        unresolvedSymbolicQuestion:
          caseState.imageAnalysis.unresolvedSymbolicQuestion,
      }
    : null,
  projectionInterpretations: caseState.projectionInterpretations.map((item) => ({
    projectionEvidenceRefs: item.projectionEvidenceRefs,
    possibleDisownedValue: trimText(item.possibleDisownedValue),
    literalEnactmentRisk: trimText(item.literalEnactmentRisk),
    matureExpression: trimText(item.matureExpression),
  })),
  forkResolutions:
  caseState.forkResolutions.map(
    (resolution) => ({
      forkId:
        resolution.forkId,

      status:
        resolution.status,

      interpretation:
        trimText(
          resolution.interpretation,
        ),

      evidenceRefs:
        resolution.evidenceRefs,

      importance:
        resolution.importance,

      reportWorthiness:
        resolution.reportWorthiness,
    }),
  ),
  finalFormulation:
  caseState.finalFormulation
    ? {
        selectedHypothesisId:
          caseState.finalFormulation
            .selectedHypothesisId,

        maintenanceFormulation:
          trimText(
            caseState.finalFormulation
              .maintenanceFormulation,
          ),

        maintenanceMechanism:
          caseState.finalFormulation
            .maintenanceMechanism,

        maintainingLoop:
          caseState.finalFormulation
            .maintainingLoop,

        developmentalFormulation:
          caseState.finalFormulation
            .developmentalFormulation,

        layerRelationship:
          caseState.finalFormulation
            .layerRelationship,

        whyItFits:
          caseState.finalFormulation
            .whyItFits
            .slice(0, 4),

        whatItDoesNotExplain:
          caseState.finalFormulation
            .whatItDoesNotExplain
            .slice(0, 4),

        strongestAlternative:
          trimText(
            caseState.finalFormulation
              .strongestAlternative,
          ),

        unresolvedForks:
          caseState.finalFormulation
            .unresolvedForks,
      }
    : null,
    openForks: [...caseState.openForks],
    experimentBindings: (() => {
      const hypothesisIds = caseState.hypotheses
        .slice(0, STAGE_INPUT_TRIM.maxHypotheses)
        .map((item) => item.id);
      const openForkIds = [...caseState.openForks];
      const preferredHypothesisId =
  caseState.finalFormulation
    ?.selectedHypothesisId ??
  hypothesisIds[0];
      return preferredHypothesisId
        ? { hypothesisIds, openForkIds, preferredHypothesisId }
        : { hypothesisIds, openForkIds };
    })(),
    hiddenPosition: caseState.hiddenPosition
      ? {
          consciousPosition: trimText(caseState.hiddenPosition.consciousPosition),
          observedPattern: trimText(caseState.hiddenPosition.observedPattern),
          possibleHiddenPosition: trimText(caseState.hiddenPosition.possibleHiddenPosition),
          protectiveFunction: caseState.hiddenPosition.protectiveFunction
            .map((item) => trimText(item))
            .filter((item): item is string => typeof item === "string" && item.length > 0),
          possibleCompensatoryAim: (() => {
            const aim = trimText(caseState.hiddenPosition.possibleCompensatoryAim);
            return typeof aim === "string" && aim.length > 0 ? aim : undefined;
          })(),
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
    parallelPatterns: {
      ...(caseState.parallelPatterns.similarStrugglesElsewhere
        ? {
            similarStrugglesElsewhere: trimText(
              caseState.parallelPatterns.similarStrugglesElsewhere,
            ),
          }
        : {}),
      ...(caseState.parallelPatterns.lowerStakesExample
        ? {
            lowerStakesExample: trimText(caseState.parallelPatterns.lowerStakesExample),
          }
        : {}),
      ...(caseState.parallelPatterns.oppositeOrEasyExample
        ? {
            oppositeOrEasyExample: trimText(
              caseState.parallelPatterns.oppositeOrEasyExample,
            ),
          }
        : {}),
      evidenceRefs: caseState.parallelPatterns.evidenceRefs,
    },
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
      strategy: item.strategy,
      action: trimText(item.action),
      hypothesisTested: trimText(item.hypothesisTested),
      learningAim: trimText(item.learningAim),
      practicalCondition: item.practicalCondition
        ? {
            factor: trimText(item.practicalCondition.factor),
            temporaryChange: trimText(item.practicalCondition.temporaryChange),
            processDimensions: item.practicalCondition.processDimensions,
            sharedDimensions: item.practicalCondition.sharedDimensions,
            sourceRef: item.practicalCondition.sourceRef,
          }
        : undefined,
      observe: item.observe,
      evidenceHint: (item.whatToObserve ?? []).slice(0, 3),
    })),
    requestedInsightNote:
  "requestedInsight (Q11.3) is the client's wish for the report — not the report spine. Ground claims in evidenceAllowlist and the available case material. requiredCitations indicate material that should appear somewhere in the report when present; they do not prescribe section placement.",
  };
}

export function buildStageLlmInput(input: {
  stage: string;
  assessmentId: string;
  evidenceRef: string;
  caseState: CaseState;
  answers: Record<string, unknown>;
  failSchema?: boolean;
  failStage?: unknown;
  draftReport?: { sections: Array<{ id: string; title: string; body: string; evidenceRefs: string[] }> };
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    assessmentId: input.assessmentId,
    evidenceRef: input.evidenceRef,
    requestedInsight: input.caseState.userFinalReflection.requestedInsight,
    failSchema: input.failSchema,
    failStage: input.failStage,
  };
  if (!SNAPSHOT_STAGES.has(input.stage)) {
    return base;
  }
  const withSnapshot: Record<string, unknown> = {
    ...base,
    caseSnapshot: buildCaseSnapshot({
      caseState: input.caseState,
      answers: input.answers,
    }),
  };
  if (input.stage === "pass10" && input.draftReport) {
    withSnapshot.draftReport = {
      sections: input.draftReport.sections.map((section) => ({
        id: section.id,
        title: section.title,
        body: trimText(section.body, STAGE_INPUT_TRIM.maxQuoteChars),
        evidenceRefs: section.evidenceRefs,
      })),
    };
  }
  return withSnapshot;
}
