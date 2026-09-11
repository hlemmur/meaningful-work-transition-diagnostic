import type { LlmAdapter } from "../types";
import { ADAPTIVE_QUESTION_BANK } from "@/engine/checkpoints/bank";
import {
  inferAnalysisFixture,
  passOutputFor,
  type AnalysisFixture,
} from "@/engine/pipeline/fixtures";
import type { AnalysisStage } from "@/engine/pipeline/models";
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
  async completeStructured({ stage, input, model }) {
    if (input.fail) {
      throw new Error("LLM unavailable");
    }

    if (String(stage).startsWith("checkpoint-")) {
      return {
        stage,
        fixture: String(input.fixture ?? `deterministic-${stage}`),
        output: checkpointOutput(input.fixture),
        model,
        usage: { inputTokens: 8, outputTokens: 12, costUsd: 0.002 },
      };
    }

    if (/^pass(?:10|[1-9])$/.test(String(stage))) {
      const fixture = String(input.fixture ?? inferAnalysisFixture({})) as AnalysisFixture;
      if ((input.failSchema || fixture === "schema-fail") && String(stage) === "pass3") {
        return {
          stage,
          fixture,
          output: {},
          model,
          usage: { inputTokens: 12, outputTokens: 4, costUsd: 0.002 },
        };
      }
      const assessmentId = String(input.assessmentId ?? "assess-1");
      return {
        stage,
        fixture,
        output: passOutputFor(String(stage) as AnalysisStage, fixture, {
          assessmentId,
          evidenceRef: String(input.evidenceRef ?? `${assessmentId}:Q1.1`),
          requestedInsight:
            typeof input.requestedInsight === "string" ? input.requestedInsight : undefined,
        }),
        model,
        usage: {
          inputTokens: 40,
          outputTokens: 80,
          costUsd: String(model).includes("strong") ? 0.02 : 0.002,
        },
      };
    }

    return {
      stage,
      fixture: `deterministic-${stage}`,
      output: { ok: true },
    };
  },
};
