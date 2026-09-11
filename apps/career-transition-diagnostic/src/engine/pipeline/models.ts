import { isLiveLlmMode } from "@/config/app-mode";

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
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function modelForStage(stage: AnalysisStage) {
  if (!isLiveLlmMode()) {
    return STRONG_STAGES.has(stage) ? "mock-strong" : "mock-cheap";
  }
  return STRONG_STAGES.has(stage)
    ? (process.env.GEMINI_MODEL_STRONG ?? DEFAULT_GEMINI_MODEL)
    : (process.env.GEMINI_MODEL_CHEAP ?? DEFAULT_GEMINI_MODEL);
}

export function costForModel(model = "") {
  if (model === "mock-strong") {
    return 0.02;
  }
  const strongId = process.env.GEMINI_MODEL_STRONG;
  const cheapId = process.env.GEMINI_MODEL_CHEAP ?? DEFAULT_GEMINI_MODEL;
  if (strongId && model === strongId && strongId !== cheapId) {
    return 0.02;
  }
  return 0.002;
}
