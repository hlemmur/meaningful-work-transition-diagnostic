#!/usr/bin/env node
/**
 * M6 live Gemini smoke — at most 1–2 assessments. Persists scoreable artifacts.
 * Requires GEMINI_API_KEY. Does NOT iterate prompts; score offline with eval:framework.
 *
 * Usage: npm run smoke:live -- [--practical]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

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
    const result = await executeAnalysis({
      assessmentId: `live-${item.label}`,
      answers: item.answers,
      completedStages: [],
      llm: liveLlmAdapter,
      persistRun() {},
      persistCaseState() {},
    });
    if (result.status !== "completed" || !result.report) {
      console.error(`Live run failed for ${item.label}`, result.failedStage);
      process.exit(2);
    }
    const artifact = buildScoreableArtifact({
      assessmentId: `live-${item.label}`,
      label: item.label,
      answers: item.answers,
      caseState: result.caseState,
      report: result.report,
      models: ["gemini-live"],
    });
    const path = persistScoreableArtifact(artifact);
    const score = evaluateFrameworkFidelity(artifact);
    console.log(JSON.stringify({ path, hardPassed: score.hardPassed, scores: score.scores }, null, 2));
    if (!score.hardPassed) {
      process.exitCode = 2;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
