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
    return z.toJSONSchema(passOutputSchemas[stage as keyof typeof passOutputSchemas]) as JsonSchema;
  }
  return z.toJSONSchema(z.object({ ok: z.boolean() })) as JsonSchema;
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
    if (key === "$schema" || key === "$defs" || key === "definitions" || key === "additionalProperties") {
      continue;
    }
    out[key] = stripUnsupported(value);
  }
  return withPropertyOrdering(collapseNullUnionObject(out));
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
  const keys = Object.keys(properties);
  if (!keys.length) {
    return obj;
  }
  const requiredSet = new Set(Array.isArray(obj.required) ? (obj.required as string[]) : []);
  const nextProperties: JsonSchema = {};
  for (const key of keys) {
    const value = (properties as JsonSchema)[key];
    if (!requiredSet.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      nextProperties[key] = { ...(value as JsonSchema), nullable: true };
    } else {
      nextProperties[key] = value;
    }
  }
  return {
    ...obj,
    properties: nextProperties,
    required: keys,
    propertyOrdering: keys,
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
    return value.map((item) => coerceValue(item));
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
