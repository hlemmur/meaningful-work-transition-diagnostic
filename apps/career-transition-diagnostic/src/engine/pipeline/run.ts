import { extractCaseStateFull } from "../checkpoints/extract";
import { ENGINE_VERSION, promptRegistry } from "../prompts";
import type { CaseState } from "../schemas/case-state";
import type { Report } from "../schemas/analysis";
import type { LlmAdapter } from "@/server/adapters/types";
import { firstEvidenceId } from "./evidence-ids";
import {
  applyCritiques,
  rankContradictions,
  applyImageVotes,
  applyResolution,
  ensurePracticalRival,
  sanitizeReportSections,
} from "./invariants";
import { realityCheckAgreement } from "./developmental-warrant";
import {
  assertCaseStateCompleteness,
  critiquesNonEmpty,
  experimentBoundToHypothesis,
  assertPeelHardGates,
  throwGate,
  isGateError,
  warrantsJungianPolarity,
  epistemicallyUncalibratedSectionIds,
} from "./gates";
import { ANALYSIS_STAGES, costForModel, modelForStage, type AnalysisStage } from "./models";
import { passOutputSchemas } from "./stage-schemas";
import { buildStageLlmInput, STAGE_INPUT_TRIM, trimText } from "./stage-input";
import { runStructuredStage, StructuredStageError } from "./structured";

export type AnalysisRunRecord = {
  assessmentId: string;
  stage: AnalysisStage;
  attempt: number;
  promptVersion: string;
  model: string;
  status: "success" | "failure";
  tokenUsage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
  error?: string;
  idempotencyKey: string;
  output?: unknown;
  createdAt?: string;
};

export type AnalysisPipelineResult = {
  status: "completed" | "failed";
  caseState: CaseState;
  report?: Report;
  failedStage?: AnalysisStage;
  error?: string;
};

function extractInitialCaseState(
  assessmentId: string,
  answers: Record<string, unknown>,
  previous?: CaseState,
): CaseState {
  return extractCaseStateFull(assessmentId, answers, previous);
}

export async function executeAnalysis(input: {
  assessmentId: string;
  answers: Record<string, unknown>;
  previousCaseState?: CaseState;
  completedStages: Iterable<string>;
  priorRuns?: AnalysisRunRecord[];
  existingReport?: Report;
  llm: LlmAdapter;
  failStage?: AnalysisStage;
  persistRun: (run: AnalysisRunRecord) => void;
  persistCaseState: (stage: AnalysisStage, snapshot: CaseState) => void;
}): Promise<AnalysisPipelineResult> {
  const completed = new Set(input.completedStages);
  let caseState = extractInitialCaseState(
    input.assessmentId,
    input.answers,
    input.previousCaseState,
  );

  const completeness = assertCaseStateCompleteness(
    caseState,
    input.answers,
  );

  if (!completeness.passed) {
    input.persistRun({
      assessmentId: input.assessmentId,

      // This is still attributed to pass1 operationally,
      // because analysis cannot begin with an incomplete extracted state.
      stage: "pass1",

      attempt: 1,

      // Make the reason explicit: this failure happened before
      // the LLM pass, during deterministic extraction validation.
      promptVersion: "deterministic-extraction",

      model: "deterministic",

      status: "failure",
      error: completeness.detail,

      idempotencyKey:
        `${input.assessmentId}:deterministic-extraction:completeness-failure`,
    });

    return {
      status: "failed",
      caseState,
      failedStage: "pass1",
      error: completeness.detail,
    };
  }

  let report =
    input.existingReport ??
    hydrateReport(input.priorRuns, caseState, input.assessmentId);
  let epistemicDraftFailures = report
    ? epistemicallyUncalibratedSectionIds(report.sections)
    : [];

  for (const stage of ANALYSIS_STAGES) {
    if (completed.has(stage)) {
      continue;
    }

    const model = modelForStage(stage);
    const evidenceRef = firstEvidenceId(caseState, input.assessmentId);
    let stageOutput: unknown;
    try {
      const stageInput = buildStageLlmInput({
        stage,
        assessmentId: input.assessmentId,
        evidenceRef,
        caseState,
        answers: input.answers,
        failStage: input.failStage,
        draftReport: stage === "pass10" && report ? { sections: report.sections } : undefined,
      });
      let result = await runStructuredStage({
        stage,
        schema: passOutputSchemas[stage],
        model,
        llm: input.llm,
        input: stageInput,
      });
      stageOutput = result.output;
      try {
        caseState = applyStage(stage, caseState, result.output);
      } catch (error) {
        if ((stage === "pass5" || stage === "pass6" || stage === "pass8") && isGateError(error)) {
          const gateIssues = [error.message];
          if (stage === "pass5") {
            const speech = trimText(
              caseState.symbolicMaterial.obstacleSpeech,
              STAGE_INPUT_TRIM.maxQuoteChars,
            );
            if (typeof speech === "string" && speech.trim()) {
              gateIssues.push(
                "personalAssociations may contain only exact copies of obstacleSpeech, obstacleWant, and ifNotRemoved. Remove obstacle, scene, and surroundings text from that list.",
              );
              gateIssues.push(
                `Copy this exact personalAssociations text and cite its Q10.6 evidence ref: ${speech}`,
              );
            }
          }
          result = await runStructuredStage({
            stage,
            schema: passOutputSchemas[stage],
            model,
            llm: input.llm,
            input: { ...stageInput, gateIssues },
          });
          stageOutput = result.output;
          caseState = applyStage(stage, caseState, result.output);
        } else {
          throw error;
        }
      }

      if (stage === "pass9") {
        const acceptPass9 = (output: unknown) => {
          const sections = sanitizeReportSections(
            passOutputSchemas.pass9.parse(output).sections,
            caseState,
          );
          assertPeelHardGates(sections, caseState);
          return sections;
        };
        let sections;
        try {
          sections = acceptPass9(result.output);
        } catch (error) {
          if (!isGateError(error)) {
            throw error;
          }
          result = await runStructuredStage({
            stage,
            schema: passOutputSchemas[stage],
            model,
            llm: input.llm,
            input: {
              ...stageInput,
              gateIssues: [
                error.message,
                "Do not invent image speech, a reply, or a second turn of dialogue.",
              ],
            },
          });
          stageOutput = result.output;
          caseState = applyStage(stage, caseState, result.output);
          sections = acceptPass9(result.output);
        }
        report = {
          assessmentId: input.assessmentId,
          engineVersion: ENGINE_VERSION,
          sections,
        };
        epistemicDraftFailures = epistemicallyUncalibratedSectionIds(sections);
      }
      if (stage === "pass10" && report) {
        const critic = passOutputSchemas.pass10.parse(result.output);
        const regeneratedIds = new Set(critic.regeneratedSections.map((section) => section.id));
        const declaredFailures = new Set(critic.failingSectionIds);
        if (
          critic.regeneratedSections.some((section) => !declaredFailures.has(section.id)) ||
          epistemicDraftFailures.some(
            (id) => !declaredFailures.has(id) || !regeneratedIds.has(id),
          )
        ) {
          throwGate({
            id: "epistemic-calibration",
            passed: false,
            detail: "Pass 10 must declare and regenerate each epistemically uncalibrated section, without regenerating undeclared sections.",
          });
        }
        let nextReport = report;
        if (critic.regeneratedSections.length) {
          const replacements = new Map(
            critic.regeneratedSections.map((section) => [section.id, section]),
          );
          nextReport = {
            ...report,
            sections: sanitizeReportSections(
              report.sections.map((section) => replacements.get(section.id) ?? section),
              caseState,
            ),
          };
        }
        try {
          assertPeelHardGates(nextReport.sections, caseState);
          const remaining = epistemicallyUncalibratedSectionIds(nextReport.sections);
          if (remaining.length > 0) {
            throwGate({
              id: "epistemic-calibration",
              passed: false,
              detail: `Pass 10 left unsupported high-certainty claims in: ${remaining.join(", ")}.`,
            });
          }
          report = nextReport;
        } catch (error) {
          if (!isGateError(error)) {
            throw error;
          }
          assertPeelHardGates(report.sections, caseState);
        }
      }

      input.persistRun({
        assessmentId: input.assessmentId,
        stage,
        attempt: result.attempts,
        promptVersion: promptRegistry[stage].version,
        model: result.model,
        status: "success",
        tokenUsage: result.usage
          ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
          : { inputTokens: 12, outputTokens: 8 },
        costUsd: result.usage?.costUsd ?? costForModel(result.model),
        idempotencyKey: `${input.assessmentId}:${stage}:success`,
        output: result.output,
      });
      input.persistCaseState(stage, caseState);
    } catch (error) {
      const attempts = error instanceof StructuredStageError ? error.attempts : 1;
      const message = error instanceof Error ? error.message : "Analysis stage failed";
      const failureOutput =
        stageOutput !== undefined
          ? stageOutput
          : error instanceof StructuredStageError
            ? error.output
            : undefined;
      input.persistRun({
        assessmentId: input.assessmentId,
        stage,
        attempt: attempts,
        promptVersion: promptRegistry[stage].version,
        model,
        status: "failure",
        error: message,
        idempotencyKey: `${input.assessmentId}:${stage}:failure`,
        ...(failureOutput !== undefined ? { output: failureOutput } : {}),
      });
      return { status: "failed", caseState, failedStage: stage, report, error: message };
    }
  }

  return { status: "completed", caseState, report };
}

function hydrateReport(
  runs: AnalysisRunRecord[] | undefined,
  caseState: CaseState,
  assessmentId: string,
): Report | undefined {
  const pass9 = [...(runs ?? [])]
    .reverse()
    .find((run) => run.stage === "pass9" && run.status === "success");
  const parsed = passOutputSchemas.pass9.safeParse(pass9?.output);
  if (!parsed.success) {
    return undefined;
  }
  return {
    assessmentId,
    engineVersion: ENGINE_VERSION,
    sections: sanitizeReportSections(parsed.data.sections, caseState),
  };
}

export type PipelineResult = AnalysisPipelineResult;

export type AnalysisStore = {
  getCaseState(id: string): CaseState | undefined;
  saveCaseState(id: string, stage: string, snapshot: CaseState): void;
  listRuns(id: string): AnalysisRunRecord[];
  saveRun(run: AnalysisRunRecord): void;
  saveReport(report: Report & { status: "draft" }): void;
  getReport?(id: string): Report | undefined;
};

export async function runAnalysisPasses(input: {
  assessmentId: string;
  answers: Record<string, unknown>;
  llm: LlmAdapter;
  failStage?: AnalysisStage;
  store: AnalysisStore;
}): Promise<PipelineResult> {
  const runs = input.store.listRuns(input.assessmentId);
  const completed = runs.filter((run) => run.status === "success").map((run) => run.stage);

  const result = await executeAnalysis({
    assessmentId: input.assessmentId,
    answers: input.answers,
    previousCaseState: input.store.getCaseState(input.assessmentId),
    completedStages: completed,
    priorRuns: runs,
    existingReport: input.store.getReport?.(input.assessmentId),
    llm: input.llm,
    failStage: input.failStage,
    persistRun: input.store.saveRun,
    persistCaseState(stage, snapshot) {
      input.store.saveCaseState(input.assessmentId, stage, snapshot);
    },
  });

  if (result.report) {
    input.store.saveReport({ ...result.report, status: "draft" });
  }

  return result;
}

function applyStage(
  stage: AnalysisStage,
  state: CaseState,
  output: unknown,
): CaseState {
  const next = structuredClone(state);
  switch (stage) {
    case "pass1": {
      const parsed = passOutputSchemas.pass1.parse(output);
      next.consciousNarrative.consciousExplanationTags = parsed.consciousExplanationTags;
      next.unresolvedQuestions = parsed.unresolvedQuestions;
      return next;
    }
    case "pass2": {
      const parsed =
        passOutputSchemas.pass2.parse(
          output,
        );

      next.contradictions =
        parsed.contradictions;

      const forks =
        new Set(next.openForks);

      for (
        const item
        of parsed.contradictions
      ) {
        for (
          const fork
          of item.originForks
        ) {
          forks.add(fork);
        }
      }

      next.openForks = [...forks];

      return rankContradictions(next);
    }
    case "pass3":
      next.hypotheses = passOutputSchemas.pass3.parse(output).hypotheses;
      return ensurePracticalRival(next);
      case "pass4": {
        const parsed =
          passOutputSchemas.pass4.parse(
            output,
          );

        const critiqueGate =
          critiquesNonEmpty(
            parsed.critiques,
          );

        if (!critiqueGate.passed) {
          throwGate(critiqueGate);
        }

        return applyCritiques(
          next,
          parsed.critiques,
        );
      }
    case "pass5":
      return applyImageVotes(next, passOutputSchemas.pass5.parse(output));
      case "pass6":
        return applyResolution(
          next,
          passOutputSchemas.pass6.parse(
            output,
          ),
        );
    case "pass7": {
      const parsed = passOutputSchemas.pass7.parse(output);
      next.jungianLenses = parsed.jungianLenses;
      if (!parsed.jungianLenses.length) {
        if (warrantsJungianPolarity(next) && !parsed.omitReason?.trim()) {
          throwGate({
            id: "jungian-omit-reason",
            passed: false,
            detail:
              "Empty jungianLenses requires omitReason when Tier-A supports a polarity.",
          });
        }
        next.jungianOmitReason = parsed.omitReason?.trim() || next.jungianOmitReason;
      }
      return next;
    }
    case "pass8": {
      const parsed = passOutputSchemas.pass8.parse(output);
      next.realityCheck = parsed.realityCheck;
      next.experiments = parsed.experiments;
      const agreement = realityCheckAgreement(next);
      if (agreement.action === "fail") {
        throwGate({
          id: "layer-reality-agreement",
          passed: false,
          detail: agreement.detail,
        });
      }
      if (agreement.action === "note") {
        next.gateRemediations = [...(next.gateRemediations ?? []), agreement.detail];
      }
      const bind = experimentBoundToHypothesis(next, parsed.experiments);
      if (!bind.passed) {
        throwGate(bind);
      }
      return next;
    }
    default:
      return next;
  }
}
