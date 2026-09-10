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
