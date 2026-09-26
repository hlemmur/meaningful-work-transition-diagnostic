import type { LlmAdapter } from "@/server/adapters/types";
import type { z } from "zod";

export class StructuredStageError extends Error {
  readonly stage: string;
  readonly attempts: number;
  readonly output?: unknown;

  constructor(
    stage: string,
    attempts: number,
    cause?: unknown,
    issues: string[] = [],
    output?: unknown,
  ) {
    const detail = issues.length ? `: ${issues.join("; ")}` : "";
    super(`Schema validation failed for ${stage}${detail}`.slice(0, 800));
    this.name = "StructuredStageError";
    this.stage = stage;
    this.attempts = attempts;
    if (output !== undefined) {
      this.output = output;
    }
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}

function schemaIssueLines(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.slice(0, 12).map((issue) => {
    const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
    return `${path}: ${issue.message}`.slice(0, 160);
  });
}

const DISCONFIRMING_QUESTION = /^(?:if|what if|what would|what evidence)\b/i;
const NUMBERED_QUESTION_RE = /^(\d+[.)]\s*)([\s\S]*?)$/;

function ensureYouYourInQuestion(question: string): string {
  const trimmed = question.trim();
  if (!trimmed || /\b(?:you|your)\b/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/\?\s*$/, " for you?");
}

function coerceQuestionsSecondPerson(section: {
  id?: unknown;
  body?: unknown;
  questionIntents?: unknown;
  [key: string]: unknown;
}) {
  const body = typeof section.body === "string" ? section.body : "";
  const lines = body.split("\n");
  let changed = false;
  const nextLines = lines.map((line) => {
    const match = line.match(NUMBERED_QUESTION_RE);
    if (!match) {
      return line;
    }
    const prefix = match[1] ?? "";
    const question = match[2] ?? "";
    const coerced = ensureYouYourInQuestion(question);
    if (coerced !== question.trim()) {
      changed = true;
    }
    return `${prefix}${coerced}`;
  });

  const intents = Array.isArray(section.questionIntents) ? section.questionIntents : undefined;
  const nextIntents = intents?.map((intent) => {
    if (!intent || typeof intent !== "object") {
      return intent;
    }
    const record = intent as { question?: unknown; [key: string]: unknown };
    if (typeof record.question !== "string") {
      return intent;
    }
    const coerced = ensureYouYourInQuestion(record.question);
    if (coerced !== record.question.trim()) {
      changed = true;
      return { ...record, question: coerced };
    }
    return intent;
  });

  if (!changed && intents && intents.length > 0) {
    return section;
  }

  return {
    ...section,
    body: changed ? nextLines.join("\n") : body,
    ...(nextIntents ? { questionIntents: nextIntents } : {}),
  };
}

export function withQuestionIntents(output: unknown): unknown {
  if (!output || typeof output !== "object" || !("sections" in output)) {
    return output;
  }
  const record = output as { sections?: unknown };
  if (!Array.isArray(record.sections)) {
    return output;
  }
  return {
    ...record,
    sections: record.sections.map((section) => {
      if (!section || typeof section !== "object") {
        return section;
      }
      const item = section as { id?: unknown; body?: unknown; questionIntents?: unknown };
      if (item.id !== "questions") {
        return section;
      }
      const withSecondPerson = coerceQuestionsSecondPerson(item);
      if (Array.isArray(withSecondPerson.questionIntents) && withSecondPerson.questionIntents.length > 0) {
        return withSecondPerson;
      }
      const body = typeof withSecondPerson.body === "string" ? withSecondPerson.body : "";
      const questions = [...body.matchAll(/\d+\.\s*([\s\S]*?)(?=(?:\n\s*\d+\.)|$)/g)]
        .map((match) => match[1]?.trim())
        .filter((question): question is string => Boolean(question));
      if (questions.length !== 3) {
        return withSecondPerson;
      }
      return {
        ...withSecondPerson,
        questionIntents: questions.map((question) => ({
          question,
          targetUncertainty: question.slice(0, 120),
          couldWeakenSelectedFormulation: DISCONFIRMING_QUESTION.test(question),
        })),
      };
    }),
  };
}

export async function runStructuredStage(input: {
  stage: string;
  schema: z.ZodTypeAny;
  input: Record<string, unknown>;
  model: string;
  llm: LlmAdapter;
}) {
  let lastError: unknown;
  let previousIssues: string[] | undefined;
  let lastOutput: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await input.llm.completeStructured({
      stage: input.stage,
      model: input.model,
      input: {
        ...input.input,
        attempt,
        ...(previousIssues?.length ? { schemaIssues: previousIssues } : {}),
      },
    });
    lastOutput = input.stage === "pass9" ? withQuestionIntents(raw.output) : raw.output;
    const parsed = input.schema.safeParse(lastOutput);
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
    previousIssues = schemaIssueLines(parsed.error);
    if (
      input.stage === "pass9" &&
      previousIssues.some((issue) => /question/i.test(issue))
    ) {
      previousIssues = [
        ...previousIssues,
        "The questions section body must contain exactly three numbered questions, each ending with a question mark. questionIntents must list those three questions, at least one couldWeakenSelectedFormulation must be true, and at least one couldInvalidateWholeFormulation must be true.",
      ];
    }
  }
  throw new StructuredStageError(input.stage, 2, lastError, previousIssues, lastOutput);
}
