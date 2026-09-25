import { describe, expect, it } from "vitest";
import { experimentSchema, forkIdSchema } from "@/engine/schemas/analysis";
import { pass3OutputSchema, pass5OutputSchema } from "@/engine/pipeline/stage-schemas";
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

  it("omits optional pass3 fields so Gemini does not receive listed-but-optional properties", () => {
    const pass3 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass3")).properties);
    const item = asObject(asObject(pass3.hypotheses).items);
    expect(item.required).toEqual(Object.keys(asObject(item.properties)));
    expect(item.propertyOrdering).toEqual(item.required);
    expect(item.properties).not.toHaveProperty("consciousPosition");
    expect(item.properties).not.toHaveProperty("proposedHiddenPosition");
    expect(item.properties).not.toHaveProperty("possibleProtectiveFunction");
    expect(item.properties).not.toHaveProperty("possibleCompensatoryAim");
    expect(item.properties).not.toHaveProperty("developmentalTension");
  });

  it("keeps a nullable developmentalFormulation on the Pass 6 Gemini formulation", () => {
    const pass6 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass6")).properties);
    const formulation = asObject(pass6.finalFormulation);
    const properties = asObject(formulation.properties);
    expect(formulation.required).toContain("developmentalFormulation");
    expect(properties.developmentalFormulation).toEqual(
      expect.objectContaining({ nullable: true }),
    );
    const developmental = asObject(properties.developmentalFormulation);
    expect(developmental.required).toEqual(expect.arrayContaining([
      "consciousPole",
      "compensatingPole",
      "coreOpposition",
      "possibleDevelopmentalTask",
      "possibleThird",
      "uncertainty",
      "evidenceRefs",
    ]));
    expect(asObject(developmental.properties).possibleThird).toEqual(
      expect.objectContaining({ nullable: true }),
    );
    expect(formulation.required).not.toContain("maintainingLoop");
  });

  it("drops a null developmentalFormulation so a layered omission stays an omission", () => {
    const coerced = coerceLiveStructuredOutput({
      finalFormulation: {
        selectedHypothesisId: "hyp-bargain-potentiality",
        developmentalFormulation: null,
        layerRelationship: { mode: "layered" },
      },
    });
    const formulation = coerced.finalFormulation as Record<string, unknown>;
    expect(formulation).not.toHaveProperty("developmentalFormulation");
    expect(formulation.layerRelationship).toEqual({ mode: "layered" });
  });

  it("requires layerRelationship on the Pass 6 Gemini formulation", () => {
    const pass6 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass6")).properties);
    const formulation = asObject(pass6.finalFormulation);
    expect(formulation.required).toContain("layerRelationship");
    const layer = asObject(asObject(formulation.properties).layerRelationship);
    expect(asObject(layer.properties).mode).toEqual(expect.objectContaining({
      enum: expect.arrayContaining([
        "practical_primary",
        "psychological_primary",
        "layered",
        "unresolved",
      ]),
    }));
  });

  it("strips min/max item counts that inflate Gemini schema complexity", () => {
    const pass2 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass2")).properties);
    expect(asObject(pass2.contradictions).minItems).toBeUndefined();

    const pass3 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass3")).properties);
    expect(asObject(pass3.hypotheses).minItems).toBeUndefined();
    expect(asObject(pass3.hypotheses).maxItems).toBeUndefined();

    const pass5 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass5")).properties);
    expect(asObject(pass5.votes).minItems).toBeUndefined();

    const pass8 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass8")).properties);
    expect(asObject(pass8.experiments).minItems).toBeUndefined();
  });

  it("keeps Pass 5 projection fields as required nullable Gemini properties", () => {
    const pass5 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass5")).properties);
    const interpretations = asObject(pass5.projectionInterpretations);
    const item = asObject(interpretations.items);
    const properties = asObject(item.properties);

    expect(item.required).toEqual([
      "projectionEvidenceRefs",
      "possibleDisownedValue",
      "literalEnactmentRisk",
      "matureExpression",
    ]);
    expect(properties.possibleDisownedValue).toEqual(expect.objectContaining({ nullable: true }));
    expect(properties.literalEnactmentRisk).toEqual(expect.objectContaining({ nullable: true }));
    expect(properties.matureExpression).toEqual(expect.objectContaining({ nullable: true }));
  });

  it("does not send exclusiveMinimum on the Pass 8 Gemini schema", () => {
    const pass8 = sanitizeGeminiSchema(jsonSchemaForStage("pass8"));
    expect(JSON.stringify(pass8)).not.toContain("exclusiveMinimum");
    expect(JSON.stringify(pass8)).not.toContain("exclusiveMaximum");
    const experiments = asObject(asObject(pass8.properties).experiments);
    const properties = asObject(asObject(experiments.items).properties);
    expect(properties.sessionMinutes).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 180,
    });
    expect(properties.audienceCount).toEqual({
      type: "integer",
      minimum: 0,
      maximum: 20,
    });
  });

  it("still rejects a non-positive or oversized session length in Zod", () => {
    expect(experimentSchema.shape.sessionMinutes.safeParse(0).success).toBe(false);
    expect(experimentSchema.shape.sessionMinutes.safeParse(181).success).toBe(false);
    expect(experimentSchema.shape.sessionMinutes.safeParse(1).success).toBe(true);
    expect(experimentSchema.shape.sessionMinutes.safeParse(180).success).toBe(true);
    expect(experimentSchema.shape.audienceCount.safeParse(-1).success).toBe(false);
    expect(experimentSchema.shape.audienceCount.safeParse(0).success).toBe(true);
    expect(experimentSchema.shape.audienceCount.safeParse(20).success).toBe(true);
  });

  it("requires independent layer updates on Pass 8 Gemini outcomes", () => {
    const pass8 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass8")).properties);
    const experiment = asObject(asObject(pass8.experiments).items);
    expect(experiment.required).toEqual(expect.arrayContaining([
      "sessionMinutes",
      "audienceCount",
      "exposure",
      "reversible",
    ]));
    const outcome = asObject(asObject(asObject(experiment.properties).outcomeInterpretations).items);
    expect(outcome.required).toContain("layerUpdates");
  });

  it("keeps the Pass 8 manipulated variable as a required nullable Gemini property", () => {
    const pass8 = asObject(sanitizeGeminiSchema(jsonSchemaForStage("pass8")).properties);
    const experiments = asObject(pass8.experiments);
    const item = asObject(experiments.items);
    const properties = asObject(item.properties);

    expect(item.required).toContain("manipulatedVariable");
    expect(properties.manipulatedVariable).toEqual(
      expect.objectContaining({ nullable: true }),
    );
  });
});

describe("coerceLiveStructuredOutput", () => {
  it("omits evidence-only projection records so optional interpretation cannot fail Pass 5", () => {
    const coerced = coerceLiveStructuredOutput({
      votes: [{
        hypothesisId: "h1",
        verdict: "insufficient",
        evidenceRefs: ["a1:Q10.1"],
        exactClientMaterialUsed: ["a1:Q10.1"],
      }],
      imageAnalysis: {
        literalFacts: [],
        personalAssociations: [],
        plausibleReadings: [],
      },
      projectionInterpretations: [
        { projectionEvidenceRefs: ["a1:Q5.1"] },
        {
          projectionEvidenceRefs: ["a1:Q6.1"],
          possibleDisownedValue: null,
          literalEnactmentRisk: null,
          matureExpression: null,
        },
      ],
      overallNote: "The image is insufficient.",
    });

    expect(coerced.projectionInterpretations).toEqual([]);
    expect(pass5OutputSchema.safeParse(coerced).success).toBe(true);
  });

  it("preserves projection records that contain a warranted interpretive field", () => {
    const substantive = {
      projectionEvidenceRefs: ["a1:Q5.1"],
      matureExpression: "Try the admired quality in one bounded experiment.",
    };

    const coerced = coerceLiveStructuredOutput({
      projectionInterpretations: [
        { projectionEvidenceRefs: ["a1:Q6.1"] },
        substantive,
      ],
    });

    expect(coerced.projectionInterpretations).toEqual([substantive]);
  });

  it("omits null optional strings but keeps a null hiddenPosition", () => {
    const coerced = coerceLiveStructuredOutput({
      hypotheses: [{ id: "h1", consciousPosition: null, observedPattern: "pattern" }],
      hiddenPosition: null,
      alternative: "rest",
    });

    expect(coerced.hypotheses).toEqual([
      expect.objectContaining({
        id: "h1",
        observedPattern: "pattern",
      }),
    ]);
    expect((coerced.hypotheses as Array<Record<string, unknown>>)[0]).not.toHaveProperty(
      "consciousPosition",
    );
    expect(coerced.hiddenPosition).toBeNull();
  });

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
