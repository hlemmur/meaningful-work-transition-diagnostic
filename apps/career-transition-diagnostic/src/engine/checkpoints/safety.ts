import type { SafetyFlag } from "../schemas/evidence";

const HIGH_SAFETY_PATTERNS = [
  /suicid/i,
  /kill myself/i,
  /self-harm/i,
  /want to die/i,
  /psychosis/i,
  /hearing voices/i,
  /domestic violence/i,
  /being beaten/i,
  /cannot function/i,
  /severe collapse/i,
];

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectText);
  }
  return [];
}

export function classifySafety(answers: Record<string, unknown>): {
  level: "none" | "high";
  flags: SafetyFlag[];
} {
  const hits = Object.entries(answers).flatMap(([questionId, value]) =>
    collectText(value)
      .filter((text) => HIGH_SAFETY_PATTERNS.some((pattern) => pattern.test(text)))
      .map((text) => ({ questionId, text })),
  );

  if (hits.length === 0) {
    return { level: "none", flags: [] };
  }

  return {
    level: "high",
    flags: [
      {
        type: "crisis_or_acute_distress",
        severity: "high",
        evidenceRefs: hits.map((hit) => hit.questionId),
        handlingInstruction: "skip_depth_probes_and_reduce_report_depth",
      },
    ],
  };
}
