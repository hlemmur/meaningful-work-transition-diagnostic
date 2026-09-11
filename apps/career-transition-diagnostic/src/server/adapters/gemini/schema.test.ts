import { describe, expect, it } from "vitest";
import { forkIdSchema } from "@/engine/schemas/analysis";
import { pass3OutputSchema } from "@/engine/pipeline/stage-schemas";
import {
  coerceLiveStructuredOutput,
  jsonSchemaForStage,
  sanitizeGeminiSchema,
} from "./schema";

const STAGES = [
  "checkpoint-A",
  "pass1",
  "pass2",
  "pass3",
  "pass4",
  "pass5",
  "pass6",
  "pass7",
  "pass8",
  "pass9",
  "pass10",
] as const;

function asObject(value: unknown): Record<string, unknown> {
  expect(value).toEqual(expect.any(Object));
  return value as Record<string, unknown>;
}

describe("Gemini schema sanitizer", () => {
  it("covers every live stage with object type, required, and propertyOrdering", () => {
    for (const stage of STAGES) {
      const schema = sanitizeGeminiSchema(jsonSchemaForStage(stage));
      expect(schema.type, stage).toBe("object");
      expect(schema.$defs, stage).toBeUndefined();
      expect(schema.additionalProperties, stage).toBeUndefined();
      expect(schema.propertyOrdering, stage).toEqual(expect.any(Array));
      expect(((schema.propertyOrdering as string[]) ?? []).length, stage).toBeGreaterThan(0);
      expect(JSON.stringify(schema), stage).not.toContain("$ref");
    }
  });

  it("keeps min/max item counts for pass2, pass3, pass5, and pass8", () => {
    const pass2 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass2")).properties);
    expect(asObject(pass2.contradictions).minItems).toBe(1);

    const pass3 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass3")).properties);
    expect(asObject(pass3.hypotheses).minItems).toBe(3);
    expect(asObject(pass3.hypotheses).maxItems).toBe(5);

    const pass5 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass5")).properties);
    expect(asObject(pass5.votes).minItems).toBe(1);

    const pass8 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass8")).properties);
    expect(asObject(pass8.experiments).minItems).toBe(1);
  });
});

describe("coerceLiveStructuredOutput", () => {
  it("coerces score strings to numbers, fills missing arrays, and drops unknown forks", () => {
    const coerced = coerceLiveStructuredOutput({
      hypotheses: [
        {
          id: "h1",
          originForks: ["history_vs_stated_cause", "not_a_fork"],
          scoring: { evidenceCoverage: "0.7", crossContextRecurrence: 0.2 },
        },
      ],
    });

    expect(coerced.hypotheses).toEqual([
      expect.objectContaining({
        originForks: ["history_vs_stated_cause"],
        evidenceFor: [],
        evidenceAgainst: [],
        contradictionsExplained: [],
        scoring: expect.objectContaining({ evidenceCoverage: 0.7, crossContextRecurrence: 0.2 }),
      }),
    ]);
  });

  it("does not pad hypotheses so a two-item payload still fails Zod", () => {
    const coerced = coerceLiveStructuredOutput({
      hypotheses: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
    });
    expect((coerced.hypotheses as unknown[]).length).toBe(2);
    expect(pass3OutputSchema.safeParse(coerced).success).toBe(false);
  });

  it("never invents fork ids outside the closed enum", () => {
    const coerced = coerceLiveStructuredOutput({
      originForks: ["history_vs_stated_cause", "Puer", "work vs identity"],
    });
    expect(coerced.originForks).toEqual(["history_vs_stated_cause"]);
    expect(forkIdSchema.options).toContain("history_vs_stated_cause");
  });
});
