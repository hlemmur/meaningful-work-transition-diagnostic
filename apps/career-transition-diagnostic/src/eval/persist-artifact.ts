import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaseState } from "@/engine/schemas/case-state";
import type { Report } from "@/engine/schemas/analysis";

export type ScoreableArtifact = {
  meta: {
    savedAt: string;
    assessmentId: string;
    label: string;
    models?: string[];
  };
  answers: Record<string, unknown>;
  caseState: CaseState;
  report: Report;
  analysisRuns?: unknown[];
};

export function buildScoreableArtifact(input: {
  assessmentId: string;
  label: string;
  answers: Record<string, unknown>;
  caseState: CaseState;
  report: Report;
  analysisRuns?: unknown[];
  models?: string[];
  savedAt?: string;
}): ScoreableArtifact {
  return {
    meta: {
      savedAt: input.savedAt ?? new Date().toISOString(),
      assessmentId: input.assessmentId,
      label: input.label,
      models: input.models,
    },
    answers: input.answers,
    caseState: input.caseState,
    report: input.report,
    analysisRuns: input.analysisRuns,
  };
}

export function persistScoreableArtifact(
  artifact: ScoreableArtifact,
  directory = join(process.cwd(), ".local", "eval-artifacts"),
) {
  mkdirSync(directory, { recursive: true });
  const file = join(
    directory,
    `${artifact.meta.label}-${artifact.meta.assessmentId.slice(0, 8)}.json`,
  );
  writeFileSync(file, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return file;
}
