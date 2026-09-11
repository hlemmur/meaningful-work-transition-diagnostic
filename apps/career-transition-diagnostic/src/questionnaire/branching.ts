import { questionIds } from "./questionnaire.v2";

export type SafetyLevel = "none" | "high";

export type BranchingContext = {
  avoidedActionCount?: number;
  temporaryEase?: "yes" | "no" | "unsure";
  chargeIntensity?: number;
  tooMuchTapped?: boolean;
  q38Present?: boolean;
  q38IsSurface?: boolean;
  gazeAlreadyCaptured?: boolean;
  q65Answered?: boolean;
  q35EmptyOrNoOne?: boolean;
  safetyLevel?: SafetyLevel;
  chargeBlockSkipped?: boolean;
};

const HIGH_SAFETY_SKIP = new Set(["Q3.8", "Q3.9", "Q9.3", "Q10.6"]);

export function shouldShowQuestion(id: string, context: BranchingContext = {}): boolean {
  if (context.safetyLevel === "high" && HIGH_SAFETY_SKIP.has(id)) {
    return false;
  }

  switch (id) {
    case "Q2.4":
      return (context.avoidedActionCount ?? 0) >= 1;
    case "Q2.4F":
      return (context.avoidedActionCount ?? 0) === 0;
    case "Q2.6b":
      return context.temporaryEase === "yes";
    case "Q3.6":
      return context.q35EmptyOrNoOne !== true;
    case "Q3.8":
      return context.tooMuchTapped !== true && context.chargeBlockSkipped !== true;
    case "Q3.9":
      return (
        context.q38Present === true &&
        context.q38IsSurface === true &&
        (context.chargeIntensity ?? 0) < 8 &&
        context.tooMuchTapped !== true &&
        context.safetyLevel !== "high"
      );
    case "Q3.10":
      return context.chargeBlockSkipped !== true;
    case "Q6.5":
      return context.gazeAlreadyCaptured !== true;
    case "Q6.5s":
      return context.gazeAlreadyCaptured === true;
    case "Q6.6":
      return context.gazeAlreadyCaptured !== true && context.q65Answered === true;
    default:
      return true;
  }
}

const SURFACE_HINTS = [
  "money",
  "bills",
  "visa",
  "housing",
  "inconvenience",
  "wasted time",
  "delay",
  "schedule",
];
const IDENTITY_HINTS = [
  "i am",
  "i would be",
  "they would see me",
  "shame",
  "fraud",
  "unlovable",
  "failure",
];

export function isSurfaceExternal(text: string) {
  const lower = text.toLowerCase();
  if (!lower.trim()) {
    return false;
  }
  if (IDENTITY_HINTS.some((hint) => lower.includes(hint))) {
    return false;
  }
  return SURFACE_HINTS.some((hint) => lower.includes(hint));
}

function asAvoidedActions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ action: item.trim() }];
    }
    if (item && typeof item === "object" && "action" in item && String(item.action).trim()) {
      return [{ action: String(item.action).trim() }];
    }
    return [];
  });
}

export function listAvoidedActionLabels(answers: Record<string, unknown>) {
  return asAvoidedActions(answers["Q2.3"]).map((item) => item.action);
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asScale(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && "intensity" in value) {
    const intensity = Number(value.intensity);
    return Number.isFinite(intensity) ? intensity : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildBranchingContext(
  answers: Record<string, unknown>,
  safetyLevel: SafetyLevel = "none",
): BranchingContext {
  const watcher = asText(answers["Q3.5"]).toLowerCase();
  const emptyWatcher = watcher === "" || watcher === "no one" || watcher === "no_one";
  const intensity = Math.max(asScale(answers["Q3.2"]), asScale(answers["Q3.3"]));

  return {
    avoidedActionCount: asAvoidedActions(answers["Q2.3"]).length,
    temporaryEase:
      answers["Q2.6"] === "yes" || answers["Q2.6"] === "no" || answers["Q2.6"] === "unsure"
        ? answers["Q2.6"]
        : undefined,
    chargeIntensity: intensity,
    tooMuchTapped: answers["Q3.3S"] === true,
    q38Present: asText(answers["Q3.8"]).length > 0,
    q38IsSurface: isSurfaceExternal(asText(answers["Q3.8"])),
    gazeAlreadyCaptured: !emptyWatcher,
    q65Answered: asText(answers["Q6.5"]).length > 0,
    q35EmptyOrNoOne: emptyWatcher,
    safetyLevel,
    chargeBlockSkipped: false,
  };
}

export function listVisibleQuestionIds(
  answers: Record<string, unknown>,
  safetyLevel: SafetyLevel = "none",
) {
  const context = buildBranchingContext(answers, safetyLevel);
  return questionIds.filter((id) => shouldShowQuestion(id, context));
}
