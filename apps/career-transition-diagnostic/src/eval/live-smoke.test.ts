import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { executeAnalysis, type AnalysisRunRecord } from "@/engine/pipeline/run";
import { buildScoreableArtifact, persistScoreableArtifact } from "./persist-artifact";
import { evaluateFrameworkFidelity } from "./framework-fidelity";
import { evaluateReport } from "./rubric";
import { formatPassTokenUsageTable, summarizePassTokenUsage } from "./token-usage";

const hasKey = Boolean(process.env.GEMINI_API_KEY);

describe("M6 live Gemini smoke", () => {
  it.skipIf(!hasKey)(
    "runs at most one origin-case live assessment and persists an artifact",
    async () => {
      process.env.LLM_MODE = "live";
      const { liveLlmAdapter } = await import("@/server/adapters/gemini/live");
      const originPath = join(
        __dirname,
        "../engine/test-support/fixtures/origin-case-answers.json",
      );
      expect(existsSync(originPath)).toBe(true);
      const answers = JSON.parse(readFileSync(originPath, "utf8")) as Record<
        string,
        unknown
      >;
      const runs: AnalysisRunRecord[] = [];
      const result = await executeAnalysis({
        assessmentId: "live-origin-smoke",
        answers,
        completedStages: [],
        llm: liveLlmAdapter,
        persistRun(run) {
          runs.push(run);
        },
        persistCaseState() {},
      });
      if (result.status !== "completed") {
        const usage = summarizePassTokenUsage(runs);
        const artifactsDir = join(process.cwd(), ".local", "eval-artifacts");
        mkdirSync(artifactsDir, { recursive: true });
        writeFileSync(
          join(artifactsDir, "origin-case-live-failure.json"),
          JSON.stringify(
            {
              status: result.status,
              failedStage: result.failedStage,
              error: result.error,
              runs: runs.map((run) => ({
                stage: run.stage,
                attempt: run.attempt,
                status: run.status,
                model: run.model,
                error: run.error,
                tokenUsage: run.tokenUsage,
                outputPreview:
                  run.output === undefined
                    ? null
                    : JSON.stringify(run.output).slice(0, 2000),
              })),
              pass8LearningAim: (() => {
                const pass8 = [...runs].reverse().find((run) => run.stage === "pass8");
                const experiments = (pass8?.output as { experiments?: Array<{ learningAim?: string }> } | undefined)
                  ?.experiments;
                return experiments?.[0]?.learningAim ?? null;
              })(),
              tokenTotals: usage.totals,
              tokenTable: formatPassTokenUsageTable(usage),
            },
            null,
            2,
          ) + "\n",
        );
      }
      expect(
        result.status,
        `live failed at ${result.failedStage}: ${result.error}`,
      ).toBe("completed");
      expect(result.report).toBeDefined();
      const artifact = buildScoreableArtifact({
        assessmentId: "live-origin-smoke",
        label: "origin-case-live",
        answers,
        caseState: result.caseState,
        report: result.report!,
        analysisRuns: runs,
        models: ["gemini-live"],
      });
      const path = persistScoreableArtifact(artifact);
      const artifactsDir = join(process.cwd(), ".local", "eval-artifacts");
      mkdirSync(artifactsDir, { recursive: true });
      writeFileSync(
        join(artifactsDir, "soft-checklist-template.json"),
        JSON.stringify(evaluateFrameworkFidelity(artifact).softChecklistTemplate, null, 2),
      );
      const score = evaluateFrameworkFidelity(artifact);
      const rubric = evaluateReport({
        report: result.report!,
        caseState: result.caseState,
        requestedInsight: typeof answers["Q11.3"] === "string" ? answers["Q11.3"] : undefined,
      });
      const usage = summarizePassTokenUsage(runs);
      const table = formatPassTokenUsageTable(usage);
      const usagePath = join(artifactsDir, "origin-case-live-token-usage.md");
      writeFileSync(
        usagePath,
        [
          "# Token usage — origin-case-live",
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
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ path, usagePath, tokenTotals: usage.totals }, null, 2));
      // eslint-disable-next-line no-console
      console.log(table);
      expect(path).toMatch(/eval-artifacts/);
      expect(score.hardPassed).toBe(true);
      expect(rubric.passed).toBe(true);
      expect(usage.totals.totalTokens).toBeGreaterThan(0);
    },
    600_000,
  );

  it("documents skip when GEMINI_API_KEY is absent", () => {
    if (hasKey) {
      expect(hasKey).toBe(true);
      return;
    }
    expect(hasKey).toBe(false);
  });
});
