export const ANALYSIS_STAGES = [
  "pass1",
  "pass2",
  "pass3",
  "pass4",
  "pass5",
  "pass6",
  "pass7",
  "pass8",
  "pass9",
  "pass10",
] as const;

export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

const STRONG_STAGES = new Set<AnalysisStage>(["pass3", "pass6", "pass9"]);

export function modelForStage(stage: AnalysisStage) {
  return STRONG_STAGES.has(stage)
    ? (process.env.OPENAI_MODEL_STRONG ?? "mock-strong")
    : (process.env.OPENAI_MODEL_CHEAP ?? "mock-cheap");
}

export function costForModel(model: string) {
  return model.includes("strong") ? 0.02 : 0.002;
}
