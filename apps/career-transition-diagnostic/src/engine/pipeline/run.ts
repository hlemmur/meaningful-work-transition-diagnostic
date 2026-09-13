import { extractCaseStateFull } from "../checkpoints/extract";
import { ENGINE_VERSION } from "../prompts";
import type { CaseState } from "../schemas/case-state";
import type { Report } from "../schemas/analysis";
import type { LlmAdapter } from "@/server/adapters/types";
import { firstEvidenceId } from "./evidence-ids";
import {
  inferAnalysisFixture,
  type AnalysisFixture,
} from "./fixtures";
import {
  applyImageVotes,
  applyResolution,
  ensurePracticalRival,
  sanitizeReportSections,
} from "./invariants";
import {
  assertCaseStateCompleteness,
  critiquesNonEmpty,
  experimentBoundToHypothesis,
  reportLayerCoverage,
  senexScoldOnly,
  throwGate,
  tierACitationGates,
  warrantsJungianPolarity,
} from "./gates";
import { ANALYSIS_STAGES, costForModel, modelForStage, type AnalysisStage } from "./models";
import { passOutputSchemas } from "./stage-schemas";
import { buildStageLlmInput } from "./stage-input";
import { runStructuredStage, StructuredStageError } from "./structured";
import type { z } from "zod";

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

function seedCaseState(
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
  fixture?: AnalysisFixture;
  failStage?: AnalysisStage;
  persistRun: (run: AnalysisRunRecord) => void;
  persistCaseState: (stage: AnalysisStage, snapshot: CaseState) => void;
}): Promise<AnalysisPipelineResult> {
  const completed = new Set(input.completedStages);
  const fixture =
    input.fixture ?? inferAnalysisFixture(input.answers);
  let caseState = seedCaseState(
    input.assessmentId,
    input.answers,
    input.previousCaseState,
  );
  const completeness = assertCaseStateCompleteness(caseState, input.answers);
  if (!completeness.passed) {
    input.persistRun({
      assessmentId: input.assessmentId,
      stage: "pass1",
      attempt: 1,
      promptVersion: "pass1.v1",
      model: modelForStage("pass1"),
      status: "failure",
      error: completeness.detail,
      idempotencyKey: `${input.assessmentId}:pass1:completeness-failure`,
    });
    return { status: "failed", caseState, failedStage: "pass1" };
  }
  let critiques = hydrateCritiques(input.priorRuns);
  let report =
    input.existingReport ??
    hydrateReport(input.priorRuns, caseState, input.assessmentId);

  for (const stage of ANALYSIS_STAGES) {
    if (completed.has(stage)) {
      continue;
    }

    const model = modelForStage(stage);
    const evidenceRef = firstEvidenceId(caseState, input.assessmentId);
    try {
      const result = await runStructuredStage({
        stage,
        schema: passOutputSchemas[stage],
        model,
        llm: input.llm,
        input: buildStageLlmInput({
          stage,
          fixture,
          assessmentId: input.assessmentId,
          evidenceRef,
          caseState,
          answers: input.answers,
          failSchema: fixture === "schema-fail" && stage === "pass3",
          failStage: input.failStage,
          draftReport: stage === "pass10" && report ? { sections: report.sections } : undefined,
        }),
      });

      caseState = applyStage(stage, caseState, result.output, critiques);
      if (stage === "pass4") {
        critiques = passOutputSchemas.pass4.parse(result.output).critiques;
      }
      if (stage === "pass9") {
        const sections = sanitizeReportSections(
          passOutputSchemas.pass9.parse(result.output).sections,
          caseState,
        );
        const layers = reportLayerCoverage(sections, caseState);
        if (!layers.passed) {
          throwGate(layers);
        }
        for (const citation of tierACitationGates(sections, caseState)) {
          if (!citation.passed) {
            throwGate(citation);
          }
        }
        const senex = senexScoldOnly(sections.map((section) => section.body).join("\n"));
        if (!senex.passed) {
          throwGate(senex);
        }
        report = {
          assessmentId: input.assessmentId,
          engineVersion: ENGINE_VERSION,
          sections,
        };
      }
      if (stage === "pass10" && report) {
        const critic = passOutputSchemas.pass10.parse(result.output);
        if (critic.regeneratedSections.length) {
          const replacements = new Map(
            critic.regeneratedSections.map((section) => [section.id, section]),
          );
          report = {
            ...report,
            sections: sanitizeReportSections(
              report.sections.map((section) => replacements.get(section.id) ?? section),
              caseState,
            ),
          };
        }
      }

      input.persistRun({
        assessmentId: input.assessmentId,
        stage,
        attempt: result.attempts,
        promptVersion: `${stage}.v1`,
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
      input.persistRun({
        assessmentId: input.assessmentId,
        stage,
        attempt: attempts,
        promptVersion: `${stage}.v1`,
        model,
        status: "failure",
        error: message,
        idempotencyKey: `${input.assessmentId}:${stage}:failure`,
      });
      return { status: "failed", caseState, failedStage: stage, report, error: message };
    }
  }

  return { status: "completed", caseState, report };
}

function hydrateCritiques(runs: AnalysisRunRecord[] | undefined) {
  const pass4 = [...(runs ?? [])]
    .reverse()
    .find((run) => run.stage === "pass4" && run.status === "success");
  const parsed = passOutputSchemas.pass4.safeParse(pass4?.output);
  return parsed.success ? parsed.data.critiques : [];
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
  fixture?: AnalysisFixture;
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
    fixture: input.fixture,
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
  critiques: z.infer<(typeof passOutputSchemas)["pass4"]>["critiques"],
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
      const parsed = passOutputSchemas.pass2.parse(output);
      next.contradictions = parsed.contradictions;
      const forks = new Set(next.openForks);
      for (const item of parsed.contradictions) {
        for (const fork of item.originForks) {
          forks.add(fork);
        }
      }
      next.openForks = [...forks];
      return next;
    }
    case "pass3":
      next.hypotheses = passOutputSchemas.pass3.parse(output).hypotheses;
      return ensurePracticalRival(next);
    case "pass4": {
      const parsed = passOutputSchemas.pass4.parse(output);
      const critiqueGate = critiquesNonEmpty(parsed.critiques);
      if (!critiqueGate.passed) {
        throwGate(critiqueGate);
      }
      return next;
    }
    case "pass5":
      return applyImageVotes(next, passOutputSchemas.pass5.parse(output));
    case "pass6":
      return applyResolution(next, passOutputSchemas.pass6.parse(output), critiques);
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
