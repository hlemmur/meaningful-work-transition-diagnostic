import type { LlmAdapter } from "@/server/adapters/types";
import type { z } from "zod";

export class StructuredStageError extends Error {
  readonly stage: string;
  readonly attempts: number;

  constructor(stage: string, attempts: number, cause?: unknown) {
    super(`Schema validation failed for ${stage}`);
    this.name = "StructuredStageError";
    this.stage = stage;
    this.attempts = attempts;
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

export async function runStructuredStage(input: {
  stage: string;
  schema: z.ZodTypeAny;
  input: Record<string, unknown>;
  model: string;
  llm: LlmAdapter;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await input.llm.completeStructured({
      stage: input.stage,
      model: input.model,
      input: { ...input.input, attempt },
    });
    const parsed = input.schema.safeParse(raw.output);
    if (parsed.success) {
      return {
        output: parsed.data as unknown,
        attempts: attempt,
        model: raw.model ?? input.model,
        usage: raw.usage,
        fixture: raw.fixture,
      };
    }
    lastError = parsed.error;
  }
  throw new StructuredStageError(input.stage, 2, lastError);
}
