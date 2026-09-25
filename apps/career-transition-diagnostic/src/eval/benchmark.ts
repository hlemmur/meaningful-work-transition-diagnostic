import type { CaseState } from "@/engine/schemas/case-state";
import type { Report } from "@/engine/schemas/analysis";
import { evaluateFrameworkFidelity } from "./framework-fidelity";
import { evaluateReport } from "./rubric";
import { buildScoreableArtifact, type ScoreableArtifact } from "./persist-artifact";

export type BenchmarkResult = {
  passed: boolean;
  frameworkHardPassed: boolean;
  rubricPassed: boolean;
  framework: ReturnType<typeof evaluateFrameworkFidelity>;
  rubric: ReturnType<typeof evaluateReport>;
};

type StoredAssessment = {
  id: string;
  answers: Record<string, unknown>;
};

type StoredReport = {
  assessmentId: string;
  status?: string;
  sections: Report["sections"];
  engineVersion: Report["engineVersion"];
};

type StoredCaseVersion = {
  assessmentId: string;
  snapshot: CaseState;
};

export type BenchmarkStore = {
  assessments: StoredAssessment[];
  reports: StoredReport[];
  caseStateVersions: StoredCaseVersion[];
};

export function scoreBenchmark(artifact: ScoreableArtifact): BenchmarkResult {
  const framework = evaluateFrameworkFidelity(artifact);
  const rubric = evaluateReport({
    report: artifact.report,
    caseState: artifact.caseState,
    requestedInsight: artifact.caseState.userFinalReflection?.requestedInsight,
  });
  return {
    passed: framework.hardPassed && rubric.passed,
    frameworkHardPassed: framework.hardPassed,
    rubricPassed: rubric.passed,
    framework,
    rubric,
  };
}

export function artifactFromStore(
  store: BenchmarkStore,
  assessmentId?: string,
): ScoreableArtifact {
  const report = [...store.reports]
    .reverse()
    .find((item) => item.sections.length > 0 && (!assessmentId || item.assessmentId === assessmentId));
  if (!report) {
    throw new Error(assessmentId ? `No report for ${assessmentId}` : "No stored report");
  }
  const assessment = store.assessments.find((item) => item.id === report.assessmentId);
  if (!assessment) {
    throw new Error(`No assessment for report ${report.assessmentId}`);
  }
  const caseState = [...store.caseStateVersions]
    .reverse()
    .find((item) => item.assessmentId === report.assessmentId)?.snapshot;
  if (!caseState) {
    throw new Error(`No case state for report ${report.assessmentId}`);
  }
  return buildScoreableArtifact({
    assessmentId: report.assessmentId,
    label: "live-report",
    answers: assessment.answers,
    caseState,
    report: {
      assessmentId: report.assessmentId,
      engineVersion: report.engineVersion,
      sections: report.sections,
    },
    models: ["local-store"],
  });
}

export function formatBenchmark(result: BenchmarkResult) {
  const lines = [
    `framework hard: ${result.frameworkHardPassed ? "PASS" : "FAIL"}`,
    `rubric: ${result.rubricPassed ? "PASS" : "FAIL"}`,
    `overall: ${result.passed ? "PASS" : "FAIL"}`,
    "",
    "framework",
  ];
  for (const item of result.framework.scores) {
    lines.push(
      `- ${item.passed ? "pass" : "FAIL"} ${item.hard ? "hard" : "soft"} ${item.id}: ${item.detail}`,
    );
  }
  lines.push("", "rubric");
  for (const item of result.rubric.findings) {
    if (!item.passed) {
      lines.push(`- FAIL ${item.id}: ${item.detail}`);
    }
  }
  if (result.rubric.findings.every((item) => item.passed)) {
    lines.push("- all rubric findings passed");
  }
  lines.push("", "soft checklist (mentor, not scored)");
  for (const item of result.framework.softChecklistTemplate) {
    lines.push(`- ${item.id}: ${item.question}`);
  }
  return lines.join("\n");
}
