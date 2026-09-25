import { z } from "zod";
import { checkpointLlmOutputSchema } from "@/engine/checkpoints/schema";
import { passOutputSchemas } from "@/engine/pipeline/stage-schemas";
import { forkIdSchema } from "@/engine/schemas/analysis";

export type JsonSchema = Record<string, unknown>;

const FORK_IDS = new Set<string>(forkIdSchema.options);

const ARRAY_KEYS = new Set([
  "openForks",
  "flags",
  "consciousExplanationTags",
  "unresolvedQuestions",
  "contradictions",
  "evidenceA",
  "evidenceB",
  "categories",
  "originForks",
  "hypotheses",
  "evidenceFor",
  "evidenceAgainst",
  "contradictionsExplained",
  "contradictionsNotExplained",
  "simplerAlternatives",
  "missingInformation",
  "critiques",
  "votes",
  "evidenceRefs",
  "practicalHypothesisIds",
  "psychologicalHypothesisIds",
  "counterEvidenceRefs",
  "protectiveFunction",
  "threatenedByChange",
  "jungianLenses",
  "experiments",
  "whatToObserve",
  "practicalRequirements",
  "sections",
  "failingSectionIds",
  "regeneratedSections",
]);

const SCORE_KEYS = new Set([
  "evidenceStrength",
  "recurrence",
  "explanatoryImportance",
  "charge",
  "evidenceCoverage",
  "crossContextRecurrence",
  "contradictionResolution",
  "personSpecificity",
  "developmentalFit",
  "imageConstraintFit",
  "counterEvidencePenalty",
  "simplerAlternativePenalty",
]);

export function jsonSchemaForStage(stage: string) {
  if (stage.startsWith("checkpoint-")) {
    return z.toJSONSchema(checkpointLlmOutputSchema) as JsonSchema;
  }
  if (stage in passOutputSchemas) {
    const schema = z.toJSONSchema(passOutputSchemas[stage as keyof typeof passOutputSchemas]) as JsonSchema;
    if (stage === "pass5") {
      return requireNullableProjectionInterpretationFields(schema);
    }
    if (stage === "pass6") {
      return requirePass6DevelopmentalFormulation(requirePass6LayerRelationship(schema));
    }
    if (stage === "pass8") {
      return requirePass8LayerUpdates(requireNullablePass8ManipulatedVariable(schema));
    }
    return schema;
  }
  return z.toJSONSchema(z.object({ ok: z.boolean() })) as JsonSchema;
}

function requirePass6LayerRelationship(schema: JsonSchema) {
  const properties = schema.properties as JsonSchema | undefined;
  const formulation = properties?.finalFormulation as JsonSchema | undefined;
  const formulationProperties = formulation?.properties as JsonSchema | undefined;
  if (!formulation || !formulationProperties?.layerRelationship) {
    return schema;
  }
  const required = Array.isArray(formulation.required) ? formulation.required as string[] : [];
  formulation.required = [...new Set([...required, "layerRelationship"])];
  return schema;
}

function requirePass6DevelopmentalFormulation(schema: JsonSchema) {
  const properties = schema.properties as JsonSchema | undefined;
  const formulation = properties?.finalFormulation as JsonSchema | undefined;
  const formulationProperties = formulation?.properties as JsonSchema | undefined;
  const developmental = formulationProperties?.developmentalFormulation as JsonSchema | undefined;
  if (!formulation || !formulationProperties || !developmental) {
    return schema;
  }
  const required = Array.isArray(formulation.required) ? formulation.required as string[] : [];
  formulation.required = [...new Set([...required, "developmentalFormulation"])];
  const developmentalProperties = developmental.properties as JsonSchema | undefined;
  const third = developmentalProperties?.possibleThird;
  if (developmentalProperties && third && typeof third === "object") {
    developmentalProperties.possibleThird = { ...(third as JsonSchema), nullable: true };
    const developmentalRequired = Array.isArray(developmental.required) ? developmental.required as string[] : [];
    developmental.required = [...new Set([...developmentalRequired, "possibleThird"])];
  }
  formulationProperties.developmentalFormulation = { ...developmental, nullable: true };
  return schema;
}

function requirePass8LayerUpdates(schema: JsonSchema) {
  const properties = schema.properties as JsonSchema | undefined;
  const experiments = properties?.experiments as JsonSchema | undefined;
  const item = experiments?.items as JsonSchema | undefined;
  const itemProperties = item?.properties as JsonSchema | undefined;
  const outcomes = itemProperties?.outcomeInterpretations as JsonSchema | undefined;
  const outcomeItem = outcomes?.items as JsonSchema | undefined;
  const outcomeProperties = outcomeItem?.properties as JsonSchema | undefined;
  if (!item || !itemProperties || !outcomeItem || !outcomeProperties?.layerUpdates) {
    return schema;
  }
  const experimentRequired = Array.isArray(item.required) ? item.required as string[] : [];
  item.required = [...new Set([
    ...experimentRequired,
    "sessionMinutes",
    "audienceCount",
    "exposure",
    "reversible",
    "outcomeInterpretations",
  ])];
  const outcomeRequired = Array.isArray(outcomeItem.required) ? outcomeItem.required as string[] : [];
  outcomeItem.required = [...new Set([...outcomeRequired, "layerUpdates"])];
  return schema;
}

function requireNullablePass8ManipulatedVariable(schema: JsonSchema) {
  const properties = schema.properties as JsonSchema | undefined;
  const experiments = properties?.experiments as JsonSchema | undefined;
  const item = experiments?.items as JsonSchema | undefined;
  const itemProperties = item?.properties as JsonSchema | undefined;
  const fieldSchema = itemProperties?.manipulatedVariable;
  if (!item || !itemProperties || !fieldSchema || typeof fieldSchema !== "object") {
    return schema;
  }
  itemProperties.manipulatedVariable = {
    ...(fieldSchema as JsonSchema),
    nullable: true,
  };
  const required = Array.isArray(item.required) ? item.required as string[] : [];
  item.required = [...new Set([...required, "manipulatedVariable"])] as string[];
  return schema;
}

function requireNullableProjectionInterpretationFields(schema: JsonSchema) {
  const properties = schema.properties as JsonSchema | undefined;
  const interpretations = properties?.projectionInterpretations as JsonSchema | undefined;
  const item = interpretations?.items as JsonSchema | undefined;
  const itemProperties = item?.properties as JsonSchema | undefined;
  if (!item || !itemProperties) {
    return schema;
  }
  const interpretiveFields = [
    "possibleDisownedValue",
    "literalEnactmentRisk",
    "matureExpression",
  ];
  for (const field of interpretiveFields) {
    const fieldSchema = itemProperties[field];
    if (fieldSchema && typeof fieldSchema === "object") {
      itemProperties[field] = { ...(fieldSchema as JsonSchema), nullable: true };
    }
  }
  item.required = ["projectionEvidenceRefs", ...interpretiveFields];
  return schema;
}

export function sanitizeGeminiSchema(schema: JsonSchema): JsonSchema {
  const defs = {
    ...((schema.$defs as Record<string, JsonSchema> | undefined) ?? {}),
    ...((schema.definitions as Record<string, JsonSchema> | undefined) ?? {}),
  };
  return stripUnsupported(inlineRefs(schema, defs)) as JsonSchema;
}

function inlineRefs(node: unknown, defs: Record<string, JsonSchema>, seen = new Set<string>()): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(item, defs, seen));
  }
  if (!node || typeof node !== "object") {
    return node;
  }
  const obj = { ...(node as JsonSchema) };
  if (typeof obj.$ref === "string") {
    const name = String(obj.$ref).replace(/^#\/(?:\$defs|definitions)\//, "");
    delete obj.$ref;
    if (seen.has(name)) {
      return stripUnsupported({ type: "object", ...obj });
    }
    const target = defs[name];
    if (!target) {
      return stripUnsupported(obj);
    }
    seen.add(name);
    const inlined = inlineRefs({ ...target, ...obj }, defs, seen);
    seen.delete(name);
    return inlined;
  }
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = inlineRefs(value, defs, seen);
  }
  return stripUnsupported(out);
}

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupported);
  }
  if (!node || typeof node !== "object") {
    return node;
  }
  const obj = node as JsonSchema;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      key === "$schema" ||
      key === "$defs" ||
      key === "definitions" ||
      key === "additionalProperties" ||
      key === "minItems" ||
      key === "maxItems"
    ) {
      continue;
    }
    out[key] = stripUnsupported(value);
  }
  return withPropertyOrdering(collapseNullUnionObject(rewriteExclusiveBounds(out)));
}

function rewriteExclusiveBounds(obj: JsonSchema): JsonSchema {
  if (typeof obj.exclusiveMinimum !== "number" && typeof obj.exclusiveMaximum !== "number") {
    return obj;
  }
  const next = { ...obj };
  if (typeof next.exclusiveMinimum === "number") {
    const inclusive = next.type === "integer" ? next.exclusiveMinimum + 1 : next.exclusiveMinimum;
    const current = typeof next.minimum === "number" ? next.minimum : undefined;
    next.minimum = current === undefined ? inclusive : Math.max(current, inclusive);
    delete next.exclusiveMinimum;
  }
  if (typeof next.exclusiveMaximum === "number") {
    const inclusive = next.type === "integer" ? next.exclusiveMaximum - 1 : next.exclusiveMaximum;
    const current = typeof next.maximum === "number" ? next.maximum : undefined;
    next.maximum = current === undefined ? inclusive : Math.min(current, inclusive);
    delete next.exclusiveMaximum;
  }
  return next;
}

function collapseNullUnionObject(obj: JsonSchema): JsonSchema {
  const anyOf = obj.anyOf;
  if (!Array.isArray(anyOf)) {
    return obj;
  }
  const nullBranch = anyOf.find((branch) => branch && typeof branch === "object" && (branch as JsonSchema).type === "null");
  const valueBranches = anyOf.filter((branch) => branch !== nullBranch);
  if (!nullBranch || valueBranches.length !== 1 || typeof valueBranches[0] !== "object" || !valueBranches[0]) {
    return obj;
  }
  const merged = { ...(valueBranches[0] as JsonSchema) };
  delete obj.anyOf;
  return { ...merged, ...obj, nullable: true };
}

const NULLABLE_OBJECT_KEYS = new Set(["adaptiveQuestion", "hiddenPosition"]);

function withPropertyOrdering(obj: JsonSchema): JsonSchema {
  const properties = obj.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return obj;
  }
  const allKeys = Object.keys(properties);
  if (!allKeys.length) {
    return obj;
  }
  // Gemini 3 rejects schemas that list optional properties (and vague 400s on
  // overly complex ones). Keep only required keys; Zod still accepts extras.
  const required = (
    Array.isArray(obj.required) && (obj.required as string[]).length
      ? (obj.required as string[])
      : allKeys
  ).filter((key) => key in (properties as JsonSchema));
  const nextProperties: JsonSchema = {};
  for (const key of required) {
    nextProperties[key] = (properties as JsonSchema)[key];
  }
  return {
    ...obj,
    properties: nextProperties,
    required,
    propertyOrdering: required,
  };
}

export function coerceLiveStructuredOutput(output: Record<string, unknown>): Record<string, unknown> {
  return coerceValue(output) as Record<string, unknown>;
}

function coerceValue(value: unknown, key?: string): unknown {
  if (value === null) {
    return key && NULLABLE_OBJECT_KEYS.has(key) ? null : undefined;
  }
  if (Array.isArray(value)) {
    if (key === "originForks" || key === "openForks") {
      return value.filter((item): item is string => typeof item === "string" && FORK_IDS.has(item));
    }
    const coerced = value.map((item) => coerceValue(item));
    if (key === "projectionInterpretations") {
      return coerced.filter((item) => {
        if (!item || typeof item !== "object") {
          return true;
        }
        const interpretation = item as Record<string, unknown>;
        return [
          interpretation.possibleDisownedValue,
          interpretation.literalEnactmentRisk,
          interpretation.matureExpression,
        ].some((field) => typeof field === "string" && field.trim().length > 0);
      });
    }
    return coerced;
  }
  if (!value || typeof value !== "object") {
    if (key && SCORE_KEYS.has(key) && typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
    return value;
  }

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(source)) {
    const coerced = coerceValue(child, childKey);
    if (coerced !== undefined) {
      out[childKey] = coerced;
    }
  }
  for (const arrayKey of ARRAY_KEYS) {
    if (!(arrayKey in out) || out[arrayKey] == null) {
      if (arrayKey in source || shouldFillArray(source, arrayKey)) {
        out[arrayKey] = [];
      }
    }
  }
  return out;
}

function shouldFillArray(source: Record<string, unknown>, arrayKey: string) {
  const hypothesisArrays = new Set([
    "originForks",
    "evidenceFor",
    "evidenceAgainst",
    "contradictionsExplained",
    "contradictionsNotExplained",
    "simplerAlternatives",
    "missingInformation",
  ]);
  const isHypothesis = "originForks" in source || "observedPattern" in source || "category" in source;
  return isHypothesis && hypothesisArrays.has(arrayKey);
}
