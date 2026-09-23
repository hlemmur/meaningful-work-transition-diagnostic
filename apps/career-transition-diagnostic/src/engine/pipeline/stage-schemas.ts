import { z } from "zod";
import {
  contradictionSchema,
  experimentSchema,
  currentFinalFormulationSchema,
  forkResolutionSchema,
  hiddenPositionLlmSchema,
  hypothesisCritiqueSchema,
  hypothesisSchema,
  imageVoteSchema,
  projectionInterpretationSchema,
  symbolicImageAnalysisSchema,
  jungianLensSchema,
  realityCheckSchema,
  reportSectionSchema,
  REQUIRED_PEEL_SECTION_IDS,
} from "../schemas/analysis";

import { hasDiverseEvidenceRefs, MIN_DISTINCT_EVIDENCE_QUESTION_IDS } from "./report-grounding";

export { REQUIRED_PEEL_SECTION_IDS } from "../schemas/analysis";
export {
  hasDiverseEvidenceRefs,
  MIN_DISTINCT_EVIDENCE_QUESTION_IDS,
} from "./report-grounding";

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
  critiques: z
    .array(hypothesisCritiqueSchema)
    .min(1),
});

export const pass5OutputSchema = z.object({
  votes: z.array(imageVoteSchema).min(1),
  imageAnalysis: symbolicImageAnalysisSchema,
  projectionInterpretations: z.array(projectionInterpretationSchema).default([]),
  overallNote: z.string(),
});

export const pass6OutputSchema = z
  .object({
    selectedHypothesisId: z.string(),

    forkResolutions: z
      .array(forkResolutionSchema)
      .min(1),

    finalFormulation:
      currentFinalFormulationSchema,

    hiddenPosition:
      hiddenPositionLlmSchema.nullable(),

    alternative: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.finalFormulation
        .selectedHypothesisId !==
      value.selectedHypothesisId
    ) {
      ctx.addIssue({
        code: "custom",
        path: [
          "finalFormulation",
          "selectedHypothesisId",
        ],
        message:
          "finalFormulation.selectedHypothesisId must match selectedHypothesisId",
      });
    }

    const unresolvedFromForks =
      value.forkResolutions
        .filter(
          (fork) =>
            fork.status === "unresolved" ||
            fork.status === "both",
        )
        .map((fork) => fork.forkId);

    for (
      const forkId
      of value.finalFormulation
        .unresolvedForks
    ) {
      if (
        !unresolvedFromForks.includes(
          forkId,
        )
      ) {
        ctx.addIssue({
          code: "custom",
          path: [
            "finalFormulation",
            "unresolvedForks",
          ],
          message:
            `Unresolved fork ${forkId} must have status unresolved or both in forkResolutions`,
        });
      }
    }
  });

export const pass7OutputSchema = z
  .object({
    jungianLenses: z.array(jungianLensSchema).max(3),
    omitReason: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.jungianLenses.length > 0) {
      return;
    }
    if (!value.omitReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["omitReason"],
        message:
          "omitReason is required when jungianLenses is empty (non-empty string).",
      });
    }
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
      if (!hasDiverseEvidenceRefs(sections)) {
        ctx.addIssue({
          code: "custom",
          message: `Report evidenceRefs must cite at least ${MIN_DISTINCT_EVIDENCE_QUESTION_IDS} distinct question ids`,
        });
      }
      const order = [
        "problem", "reality", "contradiction", "hidden", "developmental",
        "alternative", "experiment", "jungian", "questions", "close",
      ];
      let previous = -1;
      for (const section of sections) {
        const current = order.indexOf(section.id);
        if (current <= previous) {
          ctx.addIssue({
            code: "custom",
            message: `Report section ${section.id} is out of peel order`,
          });
          break;
        }
        previous = current;
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
