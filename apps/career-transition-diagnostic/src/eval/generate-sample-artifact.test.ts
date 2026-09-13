/**
 * Persist a scoreable mock artifact for offline framework scoring (M6/M7).
 * Live Gemini smoke: set GEMINI_API_KEY and LLM_MODE=live, then run the same
 * with --live (at most 1–2 cases; do not iterate prompts against free Gemini).
 *
 * Usage:
 *   npx vitest run src/eval/generate-sample-artifact.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { executeAnalysis } from "@/engine/pipeline/run";
import { buildScoreableArtifact } from "./persist-artifact";
import { evaluateFrameworkFidelity } from "./framework-fidelity";

const originAnswers = JSON.parse(
  readFileSync(
    join(__dirname, "../engine/pipeline/fixtures/origin-case-answers.json"),
    "utf8",
  ),
) as Record<string, unknown>;

describe("generate sample eval artifact", () => {
  it("writes redacted origin-gold mock artifact for CI scorecard", async () => {
    const answers = { ...originAnswers };
    // Redact any email-like or uniquely identifying blobs if present later.
    const result = await executeAnalysis({
      assessmentId: "sample-origin",
      answers,
      completedStages: [],
      llm: mockLlmAdapter,
      fixture: "origin-gold",
      persistRun() {},
      persistCaseState() {},
    });
    expect(result.status).toBe("completed");
    expect(result.report).toBeDefined();

    const artifact = buildScoreableArtifact({
      assessmentId: "sample-origin",
      label: "origin-gold-mock",
      answers,
      caseState: result.caseState,
      report: result.report!,
      models: ["mock-cheap", "mock-strong"],
    });
    const fidelity = evaluateFrameworkFidelity(artifact);
    expect(fidelity.hardPassed).toBe(true);

    const checkedIn = join(__dirname, "fixtures");
    mkdirSync(checkedIn, { recursive: true });
    writeFileSync(
      join(checkedIn, "origin-gold-mock-artifact.json"),
      JSON.stringify(artifact, null, 2) + "\n",
      "utf8",
    );

    const localDir = join(process.cwd(), ".local", "eval-artifacts");
    mkdirSync(localDir, { recursive: true });
    writeFileSync(
      join(localDir, "origin-gold-mock.json"),
      JSON.stringify(artifact, null, 2) + "\n",
      "utf8",
    );
  });
});
