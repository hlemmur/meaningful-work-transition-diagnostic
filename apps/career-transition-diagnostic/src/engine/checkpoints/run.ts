import type { AdaptiveCheckpoint, AdaptiveItem } from "@/questionnaire/adaptive";
import {
  ADAPTIVE_PREFERRED_MAX,
  validateAdaptivePlan,
} from "@/questionnaire/adaptive";
import type { LlmAdapter } from "@/server/adapters/types";
import type { CaseState } from "../schemas/case-state";
import type { ForkId } from "../schemas/analysis";
import {
  ADAPTIVE_QUESTION_BANK,
  CHECKPOINT_PREFERRED_FORKS,
  JUNG_SPEAK_PATTERN,
  LEADING_PATTERN,
  SUPPORT_COPY,
} from "./bank";
import { extractPass1Lite } from "./extract";
import { classifySafety } from "./safety";
import {
  adaptiveQuestionId,
  checkpointLlmOutputSchema,
  type ExistingAdaptiveQuestion,
} from "./schema";

export type CheckpointResult = {
  caseState: CaseState;
  adaptiveQuestion: {
    id: string;
    checkpoint: AdaptiveCheckpoint;
    forkId: ForkId;
    questionText: string;
    rationale: string;
  } | null;
  safetyLevel: "none" | "high";
  supportCopy: string | null;
  reportDepth: "full" | "reduced";
};

const SHAME_IDENTITY_FORKS = new Set<ForkId>([
  "impostor_filter_vs_inexperience",
  "legitimacy_loop",
]);

export async function runCheckpoint(input: {
  assessmentId: string;
  checkpoint: AdaptiveCheckpoint;
  answers: Record<string, unknown>;
  existingAdaptive?: ExistingAdaptiveQuestion[];
  previousCaseState?: CaseState;
  llm: LlmAdapter;
}): Promise<CheckpointResult> {
  const localSafety = classifySafety(input.answers);
  const chargeHigh =
    Number(input.answers["Q3.2"] ?? 0) >= 8 || input.answers["Q3.3S"] === true;
  const caseState = extractPass1Lite(
    input.assessmentId,
    input.checkpoint,
    input.answers,
    input.previousCaseState,
  );

  if (localSafety.level === "high") {
    caseState.safetyFlags = localSafety.flags;
    return {
      caseState,
      adaptiveQuestion: null,
      safetyLevel: "high",
      supportCopy: SUPPORT_COPY,
      reportDepth: "reduced",
    };
  }

  let llmOutput;
  try {
    const raw = await input.llm.completeStructured({
      stage: `checkpoint-${input.checkpoint}`,
      input: {
        checkpoint: input.checkpoint,
        fixture: inferFixture(input.checkpoint, input.answers),
        fail: containsForceFailure(input.answers),
        openForks: caseState.openForks,
      },
    });
    llmOutput = checkpointLlmOutputSchema.parse(raw.output);
  } catch {
    return {
      caseState,
      adaptiveQuestion: null,
      safetyLevel: "none",
      supportCopy: null,
      reportDepth: "full",
    };
  }

  const safetyLevel = llmOutput.safety.level === "high" ? "high" : "none";
  if (safetyLevel === "high") {
    caseState.safetyFlags = llmOutput.safety.flags.length
      ? llmOutput.safety.flags
      : localSafety.flags;
    return {
      caseState,
      adaptiveQuestion: null,
      safetyLevel: "high",
      supportCopy: SUPPORT_COPY,
      reportDepth: "reduced",
    };
  }

  const candidate = llmOutput.adaptiveQuestion;
  const existing = input.existingAdaptive ?? [];
  const planSoFar: AdaptiveItem[] = existing.map((item) => ({
    checkpoint: item.checkpoint,
    forkId: item.forkId,
  }));

  if (
    !candidate ||
    existing.length >= ADAPTIVE_PREFERRED_MAX ||
    existing.some((item) => item.checkpoint === input.checkpoint) ||
    existing.some((item) => item.forkId === candidate.forkId) ||
    (chargeHigh && SHAME_IDENTITY_FORKS.has(candidate.forkId)) ||
    JUNG_SPEAK_PATTERN.test(candidate.questionText) ||
    LEADING_PATTERN.test(candidate.questionText) ||
    !validateAdaptivePlan([...planSoFar, { checkpoint: input.checkpoint, forkId: candidate.forkId }])
      .ok
  ) {
    return {
      caseState,
      adaptiveQuestion: null,
      safetyLevel: "none",
      supportCopy: null,
      reportDepth: "full",
    };
  }

  return {
    caseState,
    adaptiveQuestion: {
      id: adaptiveQuestionId(input.checkpoint),
      checkpoint: input.checkpoint,
      forkId: candidate.forkId,
      questionText: candidate.questionText,
      rationale: candidate.rationale,
    },
    safetyLevel: "none",
    supportCopy: null,
    reportDepth: "full",
  };
}

function containsForceFailure(answers: Record<string, unknown>) {
  return JSON.stringify(answers).includes("FORCE_LLM_FAILURE");
}

function inferFixture(checkpoint: AdaptiveCheckpoint, answers: Record<string, unknown>) {
  if (classifySafety(answers).level === "high") {
    return "safety-high";
  }
  const preferred = CHECKPOINT_PREFERRED_FORKS[checkpoint]?.[0];
  if (preferred && ADAPTIVE_QUESTION_BANK[preferred]) {
    return preferred;
  }
  return "none";
}
