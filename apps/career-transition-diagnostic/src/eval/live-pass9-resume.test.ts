/**
 * CAR-67: one live pass9+ resume from persisted origin store + offline scorecard.
 * Skips when GEMINI_API_KEY is absent. Do not iterate prompts against free Gemini.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { executeAnalysis } from "@/engine/pipeline/run";
import { buildScoreableArtifact, persistScoreableArtifact } from "./persist-artifact";
import { evaluateFrameworkFidelity } from "./framework-fidelity";
import { evaluateReport } from "./rubric";

const hasKey = Boolean(process.env.GEMINI_API_KEY);
const storePath = join(
  process.cwd(),
  ".local/eval-artifacts/live-origin-pass6-resume-store.json",
);
const outDir = join(process.cwd(), ".local/eval-artifacts");
const label = "origin-case-live-pass9-resume";

describe("CAR-67 live pass9+ resume", () => {
  it.skipIf(!hasKey || !existsSync(storePath))(
    "resumes from pass9 once, persists artifact, and hard-passes framework fidelity",
    async () => {
      process.env.LLM_MODE = "live";
      process.env.APP_MODE = process.env.APP_MODE ?? "mock";
      const { liveLlmAdapter } = await import("@/server/adapters/gemini/live");

      const store = JSON.parse(readFileSync(storePath, "utf8")) as {
        assessments: Array<{ id: string; answers: Record<string, unknown> }>;
        analysisRuns: Array<{
          assessmentId: string;
          stage: string;
          status: string;
          output?: unknown;
          attempt?: number;
          promptVersion?: string;
          model?: string;
          idempotencyKey?: string;
          createdAt?: string;
        }>;
        caseStateVersions: Array<{
          assessmentId: string;
          stage: string;
          snapshot: unknown;
        }>;
      };

      const assessment = store.assessments[0];
      expect(assessment).toBeDefined();
      const drop = new Set(["pass9", "pass10"]);
      const priorRuns = store.analysisRuns.filter(
        (run) =>
          run.assessmentId === assessment.id &&
          run.status === "success" &&
          !drop.has(run.stage),
      );
      const completedStages = priorRuns.map((run) => run.stage);
      const previousCaseState = store.caseStateVersions
        .filter(
          (version) =>
            version.assessmentId === assessment.id && !drop.has(version.stage),
        )
        .at(-1)?.snapshot;

      const result = await executeAnalysis({
        assessmentId: assessment.id,
        answers: assessment.answers,
        previousCaseState: previousCaseState as never,
        completedStages,
        priorRuns: priorRuns as never,
        llm: liveLlmAdapter,
        persistRun() {},
        persistCaseState() {},
      });

      expect(result.status).toBe("completed");
      expect(result.report).toBeDefined();

      const artifact = buildScoreableArtifact({
        assessmentId: assessment.id,
        label,
        answers: assessment.answers,
        caseState: result.caseState,
        report: result.report!,
        models: ["gemini-live-pass9-resume"],
      });
      const path = persistScoreableArtifact(artifact, outDir);
      const fidelity = evaluateFrameworkFidelity(artifact);
      const rubric = evaluateReport({
        report: result.report!,
        caseState: result.caseState,
        requestedInsight: String(assessment.answers["Q11.3"] ?? ""),
      });

      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, `${label}.scorecard.json`),
        JSON.stringify(
          {
            hardPassed: fidelity.hardPassed,
            rubricPassed: rubric.passed,
            fidelityScores: fidelity.scores,
            rubricFindings: rubric.findings,
            softNotes: {
              image_alive:
                "Was Q10 pipe/associations treated as living material in reality/hidden?",
              cm_layer_feel:
                "Does a depth beat lead with body/charge before theory?",
              softChecklistTemplate: fidelity.softChecklistTemplate,
            },
            sectionIds: result.report!.sections.map((section) => section.id),
            artifactPath: path,
          },
          null,
          2,
        ) + "\n",
      );

      expect(path).toMatch(/eval-artifacts/);
      expect(fidelity.hardPassed).toBe(true);
    },
    300_000,
  );

  it("documents skip when key or store is absent", () => {
    if (hasKey && existsSync(storePath)) {
      expect(hasKey).toBe(true);
      return;
    }
    expect(hasKey && existsSync(storePath)).toBe(false);
  });
});
