import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runStructuredStage } from "./structured";

const schema = z.object({ ok: z.literal(true), n: z.number() });

describe("runStructuredStage", () => {
  it("validates structured output and records the configured model", async () => {
    const result = await runStructuredStage({
      stage: "pass1",
      schema,
      input: {},
      model: "mock-cheap",
      llm: {
        async completeStructured({ stage, model }) {
          return {
            stage,
            fixture: "ok",
            output: { ok: true, n: 1 },
            model,
            usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.002 },
          };
        },
      },
    });

    expect(result.output).toEqual({ ok: true, n: 1 });
    expect(result.attempts).toBe(1);
    expect(result.model).toBe("mock-cheap");
    expect(result.usage?.costUsd).toBe(0.002);
  });

  it("retries a schema failure once and then succeeds", async () => {
    let calls = 0;
    const result = await runStructuredStage({
      stage: "pass3",
      schema,
      input: {},
      model: "mock-strong",
      llm: {
        async completeStructured({ stage }) {
          calls += 1;
          return {
            stage,
            fixture: "retry",
            output: calls === 1 ? { ok: false } : { ok: true, n: 2 },
          };
        },
      },
    });

    expect(calls).toBe(2);
    expect(result.attempts).toBe(2);
    expect(result.output).toEqual({ ok: true, n: 2 });
  });

  it("fails after a second schema error without inventing fields", async () => {
    await expect(
      runStructuredStage({
        stage: "pass3",
        schema,
        input: {},
        model: "mock-strong",
        llm: {
          async completeStructured({ stage }) {
            return { stage, fixture: "bad", output: { nope: true } };
          },
        },
      }),
    ).rejects.toThrow(/schema/i);
  });
});
