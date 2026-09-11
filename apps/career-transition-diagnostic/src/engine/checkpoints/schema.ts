import { z } from "zod";
import { forkIdSchema, type ForkId } from "../schemas/analysis";
import { safetyFlagSchema } from "../schemas/evidence";

export const checkpointLlmOutputSchema = z.object({
  openForks: z.array(forkIdSchema).default([]),
  safety: z
    .object({
      level: z.enum(["none", "high"]).default("none"),
      flags: z.array(safetyFlagSchema).default([]),
    })
    .default({ level: "none", flags: [] }),
  adaptiveQuestion: z
    .object({
      forkId: forkIdSchema,
      rationale: z.string(),
      questionText: z.string(),
    })
    .nullable()
    .default(null),
});

export type CheckpointLlmOutput = z.infer<typeof checkpointLlmOutputSchema>;

export function adaptiveQuestionId(checkpoint: "A" | "B" | "C" | "D") {
  return `Q${checkpoint}.1`;
}

export function isAdaptiveQuestionId(id: string) {
  return /^Q[ABCD]\.1$/.test(id);
}

export const CHECKPOINT_AFTER_SECTION: Record<number, "A" | "B" | "C" | "D"> = {
  2: "A",
  4: "B",
  7: "C",
  9: "D",
};

export type ExistingAdaptiveQuestion = {
  id: string;
  checkpoint: "A" | "B" | "C" | "D";
  forkId: ForkId;
  questionText: string;
  answer?: unknown;
};
