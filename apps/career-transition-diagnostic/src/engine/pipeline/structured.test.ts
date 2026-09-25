import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pass9OutputSchema } from "./stage-schemas";
import { REQUIRED_PEEL_SECTION_IDS } from "@/engine/schemas/analysis";
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

  it("tells a Pass 9 retry that one intent must be able to invalidate the whole formulation", async () => {
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
        expect.stringMatching(/couldInvalidateWholeFormulation/i),
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

  it("does not invent whole-formulation invalidation for the live numbered questions", () => {
    const body = [
      "1. If a structured operational framework or partner provided mandatory daily deadlines and managed client acquisition for you, would your execution freeze dissolve entirely, or would the dread of being seen publicly still stop you?",
      "2. What if your difficulty initiating outbound marketing is neither an identity defense nor a container deficit, but the unaddressed physical and nervous system exhaustion resulting from fifteen years of corporate burnout?",
      "3. When you imagine shifting your work from one-to-one coaching to research, writing, or educational digital products, does your hesitation around visibility decrease, or does any form of public delivery trigger the same resistance?",
    ].join("\n");
    const reconstructed = withQuestionIntents({
      sections: [{ id: "questions", body }],
    }) as {
      sections: Array<{
        questionIntents: Array<{ couldWeakenSelectedFormulation: boolean; couldInvalidateWholeFormulation?: boolean }>;
      }>;
    };
    const intents = reconstructed.sections[0]?.questionIntents ?? [];
    expect(intents.map((intent) => intent.couldWeakenSelectedFormulation)).toEqual([true, true, false]);
    expect(intents.every((intent) => intent.couldInvalidateWholeFormulation === undefined)).toBe(true);

    const parsed = pass9OutputSchema.safeParse({
      sections: REQUIRED_PEEL_SECTION_IDS.map((id, index) => ({
        id,
        title: id,
        body: id === "questions" ? body : "A concrete evidence-backed paragraph about the stall.",
        evidenceRefs: [`origin-case:Q${index + 1}.1`],
        ...(id === "questions" ? { questionIntents: intents } : {}),
      })),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.message).join(" ")).toMatch(/whole formulation/i);
    }
  });
});
