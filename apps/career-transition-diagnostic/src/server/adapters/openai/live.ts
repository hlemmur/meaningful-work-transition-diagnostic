import "server-only";

import { z } from "zod";
import { checkpointLlmOutputSchema } from "@/engine/checkpoints/schema";
import { passOutputSchemas } from "@/engine/pipeline/stage-schemas";
import { promptRegistry } from "@/engine/prompts";
import { costForModel } from "@/engine/pipeline/models";
import type { LlmAdapter, StructuredLlmRequest, StructuredLlmResult } from "../types";

function jsonSchemaForStage(stage: string) {
  if (stage.startsWith("checkpoint-")) {
    return z.toJSONSchema(checkpointLlmOutputSchema);
  }
  if (stage in passOutputSchemas) {
    return z.toJSONSchema(passOutputSchemas[stage as keyof typeof passOutputSchemas]);
  }
  return z.toJSONSchema(z.object({ ok: z.boolean() }));
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
  if (request.model && !request.model.startsWith("mock-")) {
    return request.model;
  }
  const strong = new Set(["pass3", "pass6", "pass9"]);
  return strong.has(request.stage)
    ? (process.env.OPENAI_MODEL_STRONG ?? "gpt-4.1")
    : (process.env.OPENAI_MODEL_CHEAP ?? "gpt-4.1-mini");
}

function parseOutputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
}) {
  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).find((part) => part.text)?.text;
  if (!text) {
    throw new Error("OpenAI response JSON was empty");
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI response JSON was malformed");
  }
}

export const liveLlmAdapter: LlmAdapter = {
  async completeStructured(request: StructuredLlmRequest): Promise<StructuredLlmResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI live adapter is not configured. Use APP_MODE=mock locally.");
    }

    const model = liveModel(request);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: promptForStage(request.stage, request.input),
        text: {
          format: {
            type: "json_schema",
            name: request.stage.replace(/[^a-zA-Z0-9_]/g, "_"),
            schema: jsonSchemaForStage(request.stage),
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI live adapter is not configured. Use APP_MODE=mock locally.`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const output = parseOutputText(payload);
    const inputTokens = payload.usage?.input_tokens ?? 0;
    const outputTokens = payload.usage?.output_tokens ?? 0;

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
