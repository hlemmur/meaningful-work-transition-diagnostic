import { describe, expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { executeAnalysis } from "@/engine/pipeline/run";
import { buildScoreableArtifact, persistScoreableArtifact } from "./persist-artifact";
import { evaluateFrameworkFidelity } from "./framework-fidelity";

const hasKey = Boolean(process.env.GEMINI_API_KEY);

describe("M6 live Gemini smoke", () => {
  it.skipIf(!hasKey)(
    "runs at most one origin-case live assessment and persists an artifact",
    async () => {
      process.env.LLM_MODE = "live";
      const { liveLlmAdapter } = await import("@/server/adapters/gemini/live");
      const originPath = join(
        __dirname,
        "../engine/pipeline/fixtures/origin-case-answers.json",
      );
      expect(existsSync(originPath)).toBe(true);
      const answers = JSON.parse(readFileSync(originPath, "utf8")) as Record<
        string,
        unknown
      >;
      const result = await executeAnalysis({
        assessmentId: "live-origin-smoke",
        answers,
        completedStages: [],
        llm: liveLlmAdapter,
        persistRun() {},
        persistCaseState() {},
      });
      expect(result.status).toBe("completed");
      expect(result.report).toBeDefined();
      const artifact = buildScoreableArtifact({
        assessmentId: "live-origin-smoke",
        label: "origin-case-live",
        answers,
        caseState: result.caseState,
        report: result.report!,
        models: ["gemini-live"],
      });
      const path = persistScoreableArtifact(artifact);
      mkdirSync(join(process.cwd(), ".local", "eval-artifacts"), { recursive: true });
      writeFileSync(
        join(process.cwd(), ".local", "eval-artifacts", "soft-checklist-template.json"),
        JSON.stringify(evaluateFrameworkFidelity(artifact).softChecklistTemplate, null, 2),
      );
      const score = evaluateFrameworkFidelity(artifact);
      expect(path).toMatch(/eval-artifacts/);
      // Live model may fail soft dims; hard dims should pass after M1–M5.
      expect(score.hardPassed).toBe(true);
    },
    300_000,
  );

  it("documents skip when GEMINI_API_KEY is absent", () => {
    if (hasKey) {
      expect(hasKey).toBe(true);
      return;
    }
    expect(hasKey).toBe(false);
  });
});
