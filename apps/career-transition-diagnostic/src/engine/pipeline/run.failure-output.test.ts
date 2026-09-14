import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { executeAnalysis, type AnalysisRunRecord } from "./run";
import { runStructuredStage, StructuredStageError } from "./structured";

describe("failure run output persistence", () => {
  it("persists LLM output on pass8 gate failure so bind misses are inspectable", async () => {
    const runs: AnalysisRunRecord[] = [];
    const result = await executeAnalysis({
      assessmentId: "fail-out-1",
      answers: {
        "Q1.1": "I stall without structure WRONG_EXPERIMENT",
        "Q0.5": "ADHD",
        "Q11.3": "sharp angles",
      },
      completedStages: [],
      llm: mockLlmAdapter,
      persistRun(run) {
        runs.push(run);
      },
      persistCaseState() {},
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass8");
    const failure = [...runs].reverse().find((run) => run.stage === "pass8" && run.status === "failure");
    expect(failure).toBeDefined();
    expect(failure!.output).toEqual(
      expect.objectContaining({
        experiments: expect.arrayContaining([
          expect.objectContaining({
            hypothesisTested: expect.any(String),
          }),
        ]),
      }),
    );
  });

  it("does not fabricate output when the stage fails without an LLM payload", async () => {
    const runs: AnalysisRunRecord[] = [];
    const result = await executeAnalysis({
      assessmentId: "fail-out-2",
      answers: { "Q1.1": "I stall" },
      completedStages: [],
      llm: {
        async completeStructured() {
          throw new Error("upstream unavailable");
        },
      },
      persistRun(run) {
        runs.push(run);
      },
      persistCaseState() {},
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass1");
    const failure = runs.find((run) => run.status === "failure");
    expect(failure).toBeDefined();
    expect(failure!.error).toMatch(/upstream unavailable/i);
    expect(failure).not.toHaveProperty("output");
  });

  it("attaches last raw LLM output on StructuredStageError after schema miss", async () => {
    const bad = { nope: true };
    try {
      await runStructuredStage({
        stage: "pass3",
        schema: z.object({ ok: z.literal(true) }),
        input: {},
        model: "mock-strong",
        llm: {
          async completeStructured({ stage }) {
            return { stage, fixture: "bad", output: bad };
          },
        },
      });
      expect.unreachable("expected schema failure");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredStageError);
      expect((error as StructuredStageError).output).toEqual(bad);
    }
  });
});
