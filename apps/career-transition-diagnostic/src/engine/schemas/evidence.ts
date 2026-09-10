import { z } from "zod";

export const evidenceTypeSchema = z.enum([
  "fact",
  "self_interpretation",
  "identity_claim",
  "emotion",
  "behavior",
  "history",
  "fantasy",
  "projection",
  "symbol",
  "practical_constraint",
  "developmental_ask",
]);

export const evidenceItemSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  questionId: z.string(),
  rawQuote: z.string().optional(),
  normalizedMeaning: z.string(),
  evidenceType: evidenceTypeSchema,
});

export const projectionItemSchema = z.object({
  id: z.string(),
  figure: z.string(),
  wantedQuality: z.string().optional(),
  forbiddenQuality: z.string().optional(),
  imaginedTuesday: z.string().optional(),
  unknownMachinery: z.string().optional(),
  judgedQuality: z.string().optional(),
  unbearableIdentification: z.string().optional(),
  secretUsefulness: z.string().optional(),
  evidenceRefs: z.array(z.string()),
});

export const avoidedActionSchema = z.object({
  action: z.string(),
  duration: z.string().optional(),
  recurrence: z.string().optional(),
  whatHappensInstead: z.string().optional(),
  reasonGivenAtTheTime: z.string().optional(),
});

export const safetyFlagSchema = z.object({
  type: z.string(),
  severity: z.enum(["low", "moderate", "high"]),
  evidenceRefs: z.array(z.string()).default([]),
  handlingInstruction: z.string().optional(),
});
