import { describe, expect, it } from "vitest";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { executeAnalysis, type AnalysisRunRecord } from "./run";

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

  it("persists the final raw LLM output after schema retries are exhausted", async () => {
    const runs: AnalysisRunRecord[] = [];
    let attempt = 0;
    const result = await executeAnalysis({
      assessmentId: "fail-out-3",
      answers: { "Q1.1": "I stall" },
      completedStages: ["pass1", "pass2"],
      llm: {
        async completeStructured({ stage, model }) {
          attempt += 1;
          return {
            stage,
            fixture: "schema-fail",
            output: { invalidAttempt: attempt },
            model,
          };
        },
      },
      persistRun(run) {
        runs.push(run);
      },
      persistCaseState() {},
    });

    expect(result.status).toBe("failed");
    expect(result.failedStage).toBe("pass3");
    expect(attempt).toBe(2);
    const failure = runs.find((run) => run.stage === "pass3" && run.status === "failure");
    expect(failure).toBeDefined();
    expect(failure!.attempt).toBe(2);
    expect(failure!.output).toEqual({ invalidAttempt: 2 });
  });
});
