import "server-only";

import { z } from "zod";
import { checkpointLlmOutputSchema } from "@/engine/checkpoints/schema";
import { passOutputSchemas } from "@/engine/pipeline/stage-schemas";
import { promptRegistry } from "@/engine/prompts";
import { costForModel } from "@/engine/pipeline/models";
import type { LlmAdapter, StructuredLlmRequest, StructuredLlmResult } from "../types";

const GEMINI_GENERATE_CONTENT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const STRONG_STAGES = new Set(["pass3", "pass6", "pass9"]);

type JsonSchema = Record<string, unknown>;

function jsonSchemaForStage(stage: string) {
  if (stage.startsWith("checkpoint-")) {
    return z.toJSONSchema(checkpointLlmOutputSchema) as JsonSchema;
  }
  if (stage in passOutputSchemas) {
    return z.toJSONSchema(passOutputSchemas[stage as keyof typeof passOutputSchemas]) as JsonSchema;
  }
  return z.toJSONSchema(z.object({ ok: z.boolean() })) as JsonSchema;
}

function sanitizeGeminiSchema(schema: JsonSchema): JsonSchema {
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
  return collapseNullUnionObject(out);
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

function promptForStage(stage: string, input: Record<string, unknown>) {
  const key =
    stage.startsWith("checkpoint-")
      ? stage === "checkpoint-A"
        ? "checkpointA"
        : stage === "checkpoint-B"
          ? "checkpointB"
          : stage === "checkpoint-C"
            ? "checkpointC"
            : stage === "checkpoint-D"
              ? "checkpointD"
              : "checkpointSafety"
      : (stage as keyof typeof promptRegistry);
  const prompt = promptRegistry[key] ?? promptRegistry.pass1;
  return `${prompt.text}\n\nStage input:\n${JSON.stringify(input)}`;
}

function liveModel(request: StructuredLlmRequest) {
  if (request.model?.startsWith("gemini-")) {
    return request.model;
  }
  return STRONG_STAGES.has(request.stage)
    ? (process.env.GEMINI_MODEL_STRONG ?? "gemini-2.5-flash")
    : (process.env.GEMINI_MODEL_CHEAP ?? "gemini-2.5-flash");
}

function parseGeminiJson(payload: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Gemini response JSON was empty");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini response JSON was malformed");
  }
}

export const liveLlmAdapter: LlmAdapter = {
  async completeStructured(request: StructuredLlmRequest): Promise<StructuredLlmResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini live adapter is not configured. Set GEMINI_API_KEY or leave LLM_MODE unset for fixtures.");
    }

    const model = liveModel(request);
    const response = await fetch(`${GEMINI_GENERATE_CONTENT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptForStage(request.stage, request.input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: sanitizeGeminiSchema(jsonSchemaForStage(request.stage)),
        },
      }),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`Gemini HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const output = parseGeminiJson(payload);
    const inputTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      stage: request.stage,
      fixture: "live",
      output,
      model,
      usage: {
        inputTokens,
        outputTokens,
        costUsd: costForModel(model),
      },
    };
  },
};
