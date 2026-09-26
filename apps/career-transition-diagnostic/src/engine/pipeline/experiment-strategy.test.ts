import { describe, expect, it } from "vitest";
import {
  analogueEligible,
  contrastEligible,
  hasWinnerImplication,
  matchesLearningAimShape,
  selectExperimentStrategy,
} from "./experiment-strategy";

const emptyParallel = { evidenceRefs: [] as string[] };

describe("selectExperimentStrategy", () => {
  it("prefers analogue when supplied lower-stakes parallel and high charge", () => {
    expect(
      selectExperimentStrategy({
        parallelPatterns: {
          lowerStakesExample: "Booking a haircut feels easier.",
          evidenceRefs: ["a1:Q4.11"],
        },
        coreChargeHigh: true,
        coreOverwhelming: true,
        liveQuestionIsCapacityLocation: false,
        sharedDimensions: ["self_initiation"],
      }),
    ).toBe("analogue");
  });

  it("prefers contrast when capacity location is the live question", () => {
    expect(
      selectExperimentStrategy({
        parallelPatterns: {
          oppositeOrEasyExample: "I run a community dinner easily.",
          evidenceRefs: ["a1:Q4.12"],
        },
        coreChargeHigh: false,
        coreOverwhelming: false,
        liveQuestionIsCapacityLocation: true,
        sharedDimensions: ["external_structure"],
      }),
    ).toBe("contrast");
  });

  it("defaults to direct when parallel fields are empty", () => {
    expect(
      selectExperimentStrategy({
        parallelPatterns: emptyParallel,
        coreChargeHigh: true,
        coreOverwhelming: true,
        liveQuestionIsCapacityLocation: true,
        sharedDimensions: ["visibility"],
      }),
    ).toBe("direct");
  });

  it("returns symbolic_only when behavior is gated off", () => {
    expect(
      selectExperimentStrategy({
        parallelPatterns: emptyParallel,
        coreChargeHigh: true,
        coreOverwhelming: true,
        liveQuestionIsCapacityLocation: false,
        sharedDimensions: [],
        symbolicOnly: true,
      }),
    ).toBe("symbolic_only");
  });

  it("rejects analogue eligibility without shared dimensions", () => {
    expect(
      analogueEligible({
        parallelPatterns: {
          similarStrugglesElsewhere: "Same freeze when booking the dentist.",
          evidenceRefs: ["a1:Q4.10"],
        },
        coreChargeHigh: true,
        coreOverwhelming: false,
        liveQuestionIsCapacityLocation: false,
        sharedDimensions: [],
      }),
    ).toBe(false);
  });

  it("rejects contrast eligibility without opposite example", () => {
    expect(
      contrastEligible({
        parallelPatterns: emptyParallel,
        coreChargeHigh: false,
        coreOverwhelming: false,
        liveQuestionIsCapacityLocation: true,
        sharedDimensions: ["external_structure"],
      }),
    ).toBe(false);
  });
});

describe("learning aim and implication guards", () => {
  it("accepts the When X / Y / Z learning aim shape", () => {
    expect(
      matchesLearningAimShape(
        "When external structure changed, initiation became easier, while visibility charge remained.",
      ),
    ).toBe(true);
    expect(
      matchesLearningAimShape(
        "When public evaluation was held private, drafting became easier, while authenticity doubt remained.",
      ),
    ).toBe(true);
    expect(
      matchesLearningAimShape(
        "When outreach pressure was reduced, wording became easier while bodily freeze remained.",
      ),
    ).toBe(true);
    expect(matchesLearningAimShape("Prove which hypothesis wins.")).toBe(false);
    expect(
      matchesLearningAimShape(
        "When structure helped a lot, the practical layer is primary.",
      ),
    ).toBe(false);
  });

  it("flags winner implications", () => {
    expect(hasWinnerImplication("therefore primary cause")).toBe(true);
    expect(hasWinnerImplication("practical layer stays important")).toBe(false);
  });
});
