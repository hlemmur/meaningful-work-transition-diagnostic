import { describe, expect, it } from "vitest";
import { extractPass1Lite } from "./extract";

const answers = {
  "Q1.1": "I left a career that still pays my bills.",
  "Q1.3": "I lack confidence.",
  "Q2.2": "I rewrote the website twice.",
};

describe("Pass 1-lite extraction", () => {
  it("does not duplicate evidence when a later checkpoint reuses the prior snapshot", () => {
    const first = extractPass1Lite("assess-1", "A", answers);
    const second = extractPass1Lite("assess-1", "B", answers, first);

    expect(second.consciousNarrative.statedProblem).toHaveLength(1);
    expect(second.consciousNarrative.statedCausesFreeText).toHaveLength(1);
    expect(second.behavior.actionsTaken).toHaveLength(1);
    expect(second.consciousNarrative.statedProblem[0]?.id).toBe("assess-1:Q1.1");
  });

  it("opens the history fork only when stated cause and actions taken are both present", () => {
    const withHistory = extractPass1Lite("assess-1", "A", answers);
    const withoutHistory = extractPass1Lite("assess-1", "A", { "Q1.1": "Stuck." });

    expect(withHistory.openForks).toContain("history_vs_stated_cause");
    expect(withoutHistory.openForks).not.toContain("history_vs_stated_cause");
  });
});
