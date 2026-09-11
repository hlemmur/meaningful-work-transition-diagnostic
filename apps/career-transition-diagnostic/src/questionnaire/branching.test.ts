import { describe, expect, it } from "vitest";
import {
  listAvoidedActionLabels,
  listVisibleQuestionIds,
  shouldShowQuestion,
} from "./branching";
import { questionIds } from "./questionnaire.v2";

describe("questionnaire branching", () => {
  it("only branches to known question IDs", () => {
    const known = new Set(questionIds);
    const branchTargets = ["Q0.1b", "Q2.4", "Q2.4F", "Q2.6b", "Q3.6", "Q3.9", "Q6.5", "Q6.5s", "Q6.6", "Q10.6"];

    for (const id of branchTargets) {
      expect(known.has(id)).toBe(true);
    }
  });

  it("shows Q2.4 when avoided actions exist and Q2.4F when they do not", () => {
    expect(
      shouldShowQuestion("Q2.4", { avoidedActionCount: 2 }),
    ).toBe(true);
    expect(
      shouldShowQuestion("Q2.4F", { avoidedActionCount: 2 }),
    ).toBe(false);
    expect(
      shouldShowQuestion("Q2.4", { avoidedActionCount: 0 }),
    ).toBe(false);
    expect(
      shouldShowQuestion("Q2.4F", { avoidedActionCount: 0 }),
    ).toBe(true);
  });

  it("shows Q2.6b only after a yes on temporary ease", () => {
    expect(shouldShowQuestion("Q2.6b", { temporaryEase: "yes" })).toBe(true);
    expect(shouldShowQuestion("Q2.6b", { temporaryEase: "no" })).toBe(false);
  });

  it("skips Q3.9 when charge is high or the person tapped too much", () => {
    expect(
      shouldShowQuestion("Q3.9", {
        chargeIntensity: 8,
        q38IsSurface: true,
      }),
    ).toBe(false);
    expect(
      shouldShowQuestion("Q3.9", {
        tooMuchTapped: true,
        q38IsSurface: true,
        chargeIntensity: 3,
      }),
    ).toBe(false);
    expect(
      shouldShowQuestion("Q3.9", {
        chargeIntensity: 4,
        q38Present: true,
        q38IsSurface: true,
      }),
    ).toBe(true);
  });

  it("uses the short judge follow-up when gaze was already captured", () => {
    expect(shouldShowQuestion("Q6.5", { gazeAlreadyCaptured: true })).toBe(false);
    expect(shouldShowQuestion("Q6.5s", { gazeAlreadyCaptured: true })).toBe(true);
    expect(shouldShowQuestion("Q6.5", { gazeAlreadyCaptured: false })).toBe(true);
    expect(shouldShowQuestion("Q6.6", { gazeAlreadyCaptured: false, q65Answered: true })).toBe(true);
  });

  it("skips depth probes under high safety", () => {
    expect(shouldShowQuestion("Q3.8", { safetyLevel: "high" })).toBe(false);
    expect(shouldShowQuestion("Q9.3", { safetyLevel: "high" })).toBe(false);
    expect(shouldShowQuestion("Q10.6", { safetyLevel: "high" })).toBe(false);
    expect(shouldShowQuestion("Q0.2", { safetyLevel: "high" })).toBe(true);
  });

  it("derives visible questions from stored answers", () => {
    expect(listVisibleQuestionIds({ "Q2.3": [] })).toContain("Q2.4F");
    expect(listVisibleQuestionIds({ "Q2.3": [] })).not.toContain("Q2.4");
    expect(
      listVisibleQuestionIds({ "Q2.3": [{ action: "Send the website" }] }),
    ).toContain("Q2.4");
    expect(listVisibleQuestionIds({ "Q2.6": "yes" })).toContain("Q2.6b");
    expect(listVisibleQuestionIds({ "Q3.5": "my former manager" })).toContain("Q6.5s");
    expect(listVisibleQuestionIds({ "Q3.5": "my former manager" })).not.toContain("Q6.5");
    expect(listVisibleQuestionIds({ "Q0.1": "other" })).toContain("Q0.1b");
    expect(listVisibleQuestionIds({ "Q0.1": "employed_considering" })).toContain("Q0.1b");
    expect(listVisibleQuestionIds({})).not.toContain("Q2.6b");
    expect(listVisibleQuestionIds({})).not.toContain("Q3.6");
    expect(listVisibleQuestionIds({ "Q3.5": "no one" })).not.toContain("Q3.6");
  });

  it("turns named avoided actions into Q2.4 choices", () => {
    expect(
      listAvoidedActionLabels({
        "Q2.3": [{ action: "Send the website" }, { action: "  " }, "Call the accountant"],
      }),
    ).toEqual(["Send the website", "Call the accountant"]);
  });
});
