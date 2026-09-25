#!/usr/bin/env node
/**
 * Score a completed report with the rubric and framework benchmark.
 *
 *   bun run eval:report
 *   bun run eval:report -- path/to/artifact.json
 *   bun run eval:report -- --assessment origin-real-local
 *
 * With no file, reads the local mock store at http://127.0.0.1:3000/api/mock/export-store.
 * Writes the score under .local/eval-artifacts. Does not commit answers.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifactFromStore, formatBenchmark, scoreBenchmark, type BenchmarkStore } from "../src/eval/benchmark";
import { persistScoreableArtifact } from "../src/eval/persist-artifact";
import type { ScoreableArtifact } from "../src/eval/persist-artifact";

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadStore(): Promise<BenchmarkStore> {
  const base = process.env.EVAL_STORE_URL ?? "http://127.0.0.1:3000";
  const response = await fetch(`${base}/api/mock/export-store`);
  if (!response.ok) {
    throw new Error(`Could not read the local store at ${base} (${response.status})`);
  }
  return response.json() as Promise<BenchmarkStore>;
}

async function main() {
  const file = process.argv.find((arg) => arg.endsWith(".json"));
  const assessmentId = argValue("--assessment");
  const artifact: ScoreableArtifact = file
    ? (JSON.parse(readFileSync(file, "utf8")) as ScoreableArtifact)
    : artifactFromStore(await loadStore(), assessmentId);
  const result = scoreBenchmark(artifact);
  const saved = persistScoreableArtifact(artifact);
  const scorePath = join(process.cwd(), ".local", "eval-artifacts", `${artifact.meta.assessmentId}-benchmark.txt`);
  mkdirSync(join(process.cwd(), ".local", "eval-artifacts"), { recursive: true });
  const text = formatBenchmark(result);
  writeFileSync(scorePath, text + "\n", "utf8");
  console.log(text);
  console.log("");
  console.log(`artifact: ${saved}`);
  console.log(`score: ${scorePath}`);
  if (!result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
