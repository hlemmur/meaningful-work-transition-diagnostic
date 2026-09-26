#!/usr/bin/env node
/**
 * M6 live Gemini smoke — at most 1–2 assessments. Persists scoreable artifacts.
 * Requires GEMINI_API_KEY. Does NOT iterate prompts; score offline with eval:framework.
 *
 * Usage: bun scripts/smoke-live.ts [--practical]
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisRunRecord } from "../src/engine/pipeline/run";
import {
  formatPassTokenUsageTable,
  summarizePassTokenUsage,
} from "../src/eval/token-usage";

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error(
      "GEMINI_API_KEY not set. Skipping live smoke. Use mock artifacts + npm run eval:framework.",
    );
    process.exit(0);
  }

  process.env.LLM_MODE = "live";
  process.env.APP_MODE = process.env.APP_MODE ?? "mock";

  const { liveLlmAdapter } = await import("../src/server/adapters/gemini/live");
  const { executeAnalysis } = await import("../src/engine/pipeline/run");
  const { buildScoreableArtifact, persistScoreableArtifact } = await import(
    "../src/eval/persist-artifact"
  );
  const { evaluateFrameworkFidelity } = await import("../src/eval/framework-fidelity");
  const { evaluateReport } = await import("../src/eval/rubric");

  const originPath = join(
    process.cwd(),
    "src/engine/test-support/fixtures/origin-case-answers.json",
  );
  if (!existsSync(originPath)) {
    throw new Error(`Missing ${originPath}`);
  }

  const wantPractical = process.argv.includes("--practical");
  const cases: Array<{ label: string; answers: Record<string, unknown> }> = [
    {
      label: "origin-case-live",
      answers: JSON.parse(readFileSync(originPath, "utf8")),
    },
  ];
  if (wantPractical) {
    cases.push({
      label: "practical-heavy-live",
      answers: {
        "Q0.5": "ADHD and visa constraints",
        "Q1.1": "I stall on marketing",
        "Q1.3": "Money pressure",
        "Q11.3": "Tell me what to do next",
        EMPTY_JUNGIAN: true,
        CRITIC_CONSTRAINTS_WIN: true,
      },
    });
  }

  for (const item of cases.slice(0, 2)) {
    const runs: AnalysisRunRecord[] = [];
    const result = await executeAnalysis({
      assessmentId: `live-${item.label}`,
      answers: item.answers,
      completedStages: [],
      llm: liveLlmAdapter,
      persistRun(run) {
        runs.push(run);
      },
      persistCaseState() {},
    });
    if (result.status !== "completed" || !result.report) {
      console.error(`Live run failed for ${item.label}`, result.failedStage, result.error);
      const usage = summarizePassTokenUsage(runs);
      console.error(formatPassTokenUsageTable(usage));
      process.exit(2);
    }
    const artifact = buildScoreableArtifact({
      assessmentId: `live-${item.label}`,
      label: item.label,
      answers: item.answers,
      caseState: result.caseState,
      report: result.report,
      analysisRuns: runs,
      models: ["gemini-live"],
    });
    const path = persistScoreableArtifact(artifact);
    const score = evaluateFrameworkFidelity(artifact);
    const rubric = evaluateReport({
      report: result.report,
      caseState: result.caseState,
      requestedInsight:
        typeof item.answers["Q11.3"] === "string" ? item.answers["Q11.3"] : undefined,
    });
    const usage = summarizePassTokenUsage(runs);
    const table = formatPassTokenUsageTable(usage);
    const dir = join(process.cwd(), ".local", "eval-artifacts");
    mkdirSync(dir, { recursive: true });
    const usagePath = join(dir, `${item.label}-token-usage.md`);
    writeFileSync(
      usagePath,
      [
        `# Token usage — ${item.label}`,
        "",
        `Saved: ${new Date().toISOString()}`,
        `Artifact: ${path}`,
        `Hard fidelity: ${score.hardPassed}`,
        `Rubric: ${rubric.passed}`,
        "",
        table,
        "",
      ].join("\n"),
      "utf8",
    );
    console.log(
      JSON.stringify(
        {
          path,
          usagePath,
          hardPassed: score.hardPassed,
          rubricPassed: rubric.passed,
          tokenTotals: usage.totals,
          scores: score.scores,
        },
        null,
        2,
      ),
    );
    console.log(table);
    if (!score.hardPassed || !rubric.passed) {
      process.exitCode = 2;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
