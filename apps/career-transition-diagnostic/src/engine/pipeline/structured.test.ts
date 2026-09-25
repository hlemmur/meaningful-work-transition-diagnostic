import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runStructuredStage, withQuestionIntents } from "./structured";

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
    const seenInputs: Array<Record<string, unknown>> = [];
    const result = await runStructuredStage({
      stage: "pass3",
      schema,
      input: { assessmentId: "a1" },
      model: "mock-strong",
      llm: {
        async completeStructured({ stage, input }) {
          calls += 1;
          seenInputs.push(input);
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
    expect(seenInputs[0]?.schemaIssues).toBeUndefined();
    expect(seenInputs[1]?.attempt).toBe(2);
    expect(seenInputs[1]?.schemaIssues).toEqual(
      expect.arrayContaining([expect.stringMatching(/ok/i)]),
    );
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
    ).rejects.toThrow(/schema validation failed for pass3:[\s\S]*ok:/i);
  });

  it("tells a Pass 9 retry to write three numbered questions", async () => {
    const questionSchema = z.object({
      questions: z.string().min(1, "Questions must include exactly three structured intents"),
    });
    const seen: Array<Record<string, unknown>> = [];
    await runStructuredStage({
      stage: "pass9",
      schema: questionSchema,
      input: {},
      model: "mock-cheap",
      llm: {
        async completeStructured({ stage, input }) {
          seen.push(input);
          return {
            stage,
            fixture: "questions",
            output: seen.length === 1 ? { questions: "" } : { questions: "1. What would you test?" },
          };
        },
      },
    });

    expect(seen[1]?.schemaIssues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/exactly three numbered questions/i),
      ]),
    );
  });
});

describe("withQuestionIntents", () => {
  it("derives three intents from numbered questions and marks disconfirming openings", () => {
    const output = withQuestionIntents({
      sections: [{
        id: "questions",
        body: "1. What remains concrete in the history?\n2. If the container were restored, what would still stall?\n3. Which detail is still missing?",
      }],
    }) as { sections: Array<{ questionIntents: Array<{ couldWeakenSelectedFormulation: boolean }> }> };

    expect(output.sections[0]?.questionIntents.map((item) => item.couldWeakenSelectedFormulation)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("leaves a partial question list untouched", () => {
    const output = withQuestionIntents({
      sections: [{ id: "questions", body: "1. Only one question?" }],
    }) as { sections: Array<{ questionIntents?: unknown }> };
    expect(output.sections[0]?.questionIntents).toBeUndefined();
  });
});
