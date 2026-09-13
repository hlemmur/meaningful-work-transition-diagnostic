import "server-only";

import { ANALYTICAL_OS, passCardFor, promptRegistry } from "@/engine/prompts";
import { costForModel } from "@/engine/pipeline/models";
import type { LlmAdapter, StructuredLlmRequest, StructuredLlmResult } from "../types";
import { coerceLiveStructuredOutput, jsonSchemaForStage, sanitizeGeminiSchema } from "./schema";

const GEMINI_GENERATE_CONTENT =
  "https://generativelanguage.googleapis.com/v1beta/models";

const STRONG_STAGES = new Set(["pass3", "pass6", "pass9"]);

export function buildGeminiContents(stage: string, input: Record<string, unknown>) {
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
  const card = passCardFor(stage);
  const system = card ? `${ANALYTICAL_OS}\n\nPass focus:\n${card}` : ANALYTICAL_OS;
  const user = `${prompt.text}\n\nStage input:\n${JSON.stringify(input)}`;
  return {
    system,
    user,
    contents: [
      {
        role: "user",
        parts: [{ text: `SYSTEM:\n${system}\n\nUSER:\n${user}` }],
      },
    ],
  };
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
      throw new Error(
        "Gemini live adapter is not configured. Set GEMINI_API_KEY or leave LLM_MODE unset for fixtures.",
      );
    }

    const model = liveModel(request);
    const { contents } = buildGeminiContents(request.stage, request.input);
    const response = await fetch(`${GEMINI_GENERATE_CONTENT}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: sanitizeGeminiSchema(jsonSchemaForStage(request.stage)),
        },
      }),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 2000);
      throw new Error(`Gemini HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const output = coerceLiveStructuredOutput(parseGeminiJson(payload));
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
