import { z } from "zod";
import {
  contradictionSchema,
  experimentSchema,
  hiddenPositionSchema,
  hypothesisSchema,
  imageVoteSchema,
  jungianLensSchema,
  realityCheckSchema,
  reportSectionSchema,
  REQUIRED_PEEL_SECTION_IDS,
} from "../schemas/analysis";

export { REQUIRED_PEEL_SECTION_IDS } from "../schemas/analysis";

export const pass1OutputSchema = z.object({
  consciousExplanationTags: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
});

export const pass2OutputSchema = z.object({
  contradictions: z.array(contradictionSchema).min(1),
});

export const pass3OutputSchema = z.object({
  hypotheses: z.array(hypothesisSchema).min(3).max(5),
});

export const pass4OutputSchema = z.object({
  critiques: z.array(
    z.object({
      hypothesisId: z.string(),
      mundaneAlternative: z.string(),
      survives: z.boolean(),
    }),
  ),
});

export const pass5OutputSchema = z.object({
  votes: z.array(imageVoteSchema).min(1),
  overallNote: z.string(),
});

export const pass6OutputSchema = z.object({
  hiddenPosition: hiddenPositionSchema.nullable(),
  alternative: z.string(),
});

export const pass7OutputSchema = z.object({
  jungianLenses: z.array(jungianLensSchema).max(3),
});

export const pass8OutputSchema = z.object({
  realityCheck: realityCheckSchema,
  experiments: z.array(experimentSchema).min(1),
});

export const pass9OutputSchema = z.object({
  sections: z
    .array(reportSectionSchema)
    .min(REQUIRED_PEEL_SECTION_IDS.length)
    .superRefine((sections, ctx) => {
      const ids = new Set(sections.map((section) => section.id));
      for (const id of REQUIRED_PEEL_SECTION_IDS) {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: "custom",
            message: `Missing required peel section id: ${id}`,
          });
        }
      }
    }),
});

export const pass10OutputSchema = z.object({
  failingSectionIds: z.array(z.string()).default([]),
  regeneratedSections: z.array(reportSectionSchema).default([]),
});

export const passOutputSchemas = {
  pass1: pass1OutputSchema,
  pass2: pass2OutputSchema,
  pass3: pass3OutputSchema,
  pass4: pass4OutputSchema,
  pass5: pass5OutputSchema,
  pass6: pass6OutputSchema,
  pass7: pass7OutputSchema,
  pass8: pass8OutputSchema,
  pass9: pass9OutputSchema,
  pass10: pass10OutputSchema,
} as const;
