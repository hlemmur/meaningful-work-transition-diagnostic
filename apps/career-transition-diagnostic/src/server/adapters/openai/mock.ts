import type { LlmAdapter } from "../types";
import { ADAPTIVE_QUESTION_BANK } from "@/engine/checkpoints/bank";
import { forkIdSchema, type ForkId } from "@/engine/schemas/analysis";

function checkpointOutput(fixture: unknown) {
  if (fixture === "safety-high") {
    return {
      openForks: [],
      safety: {
        level: "high",
        flags: [
          {
            type: "crisis_or_acute_distress",
            severity: "high",
            evidenceRefs: [],
            handlingInstruction: "skip_depth_probes_and_reduce_report_depth",
          },
        ],
      },
      adaptiveQuestion: null,
    };
  }

  if (fixture === "none" || fixture === "jung-speak") {
    return {
      openForks: [],
      safety: { level: "none", flags: [] },
      adaptiveQuestion:
        fixture === "jung-speak"
          ? {
              forkId: "history_vs_stated_cause",
              rationale: "test",
              questionText: "You are a Puer — step into your archetype.",
            }
          : null,
    };
  }

  const parsed = forkIdSchema.safeParse(fixture);
  const forkId: ForkId = parsed.success ? parsed.data : "history_vs_stated_cause";
  const bank = ADAPTIVE_QUESTION_BANK[forkId];
  return {
    openForks: [forkId],
    safety: { level: "none", flags: [] },
    adaptiveQuestion: {
      forkId,
      rationale: `Discriminate ${forkId}`,
      questionText: bank.questionText,
    },
  };
}

export const mockLlmAdapter: LlmAdapter = {
  async completeStructured({ stage, input }) {
    if (input.fail) {
      throw new Error("LLM unavailable");
    }

    if (String(stage).startsWith("checkpoint-")) {
      return {
        stage,
        fixture: String(input.fixture ?? `deterministic-${stage}`),
        output: checkpointOutput(input.fixture),
      };
    }

    return {
      stage,
      fixture: `deterministic-${stage}`,
      output: { ok: true },
    };
  },
};
