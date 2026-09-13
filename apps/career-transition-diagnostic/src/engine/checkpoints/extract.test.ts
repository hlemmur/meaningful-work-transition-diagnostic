import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull, extractPass1Lite } from "./extract";

const answers = {
  "Q1.1": "I left a career that still pays my bills.",
  "Q1.3": "I lack confidence.",
  "Q2.2": "I rewrote the website twice.",
};

const originCaseAnswers = JSON.parse(
  readFileSync(
    join(__dirname, "../pipeline/fixtures/origin-case-answers.json"),
    "utf8",
  ),
) as Record<string, unknown>;

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

describe("extractCaseStateFull", () => {
  it("fills Tier-A buckets from origin-case answers", () => {
    const state = extractCaseStateFull("origin-1", originCaseAnswers);

    expect(state.projections.admiredFigures.length).toBeGreaterThan(0);
    expect(state.projections.rejectedFigures.length).toBeGreaterThan(0);
    expect(state.money.easyMoneyHistory.length).toBeGreaterThan(0);
    expect(state.money.invisibleMachinery.length).toBeGreaterThan(0);
    expect(state.hiddenBargain.benefitsOfStaying.length).toBeGreaterThan(0);
    expect(state.hiddenBargain.protectAndThreaten.length).toBeGreaterThan(0);
    expect(state.symbolicMaterial.scene).toMatch(/pipe/i);
    expect(state.symbolicMaterial.obstacleSpeech).toBeTruthy();
    expect(state.userFinalReflection.requestedInsight).toMatch(/sharp angles/i);
    expect(state.affect.chargeIntensity).toBeGreaterThan(0);
    expect(state.history.supportiveStructures.length).toBeGreaterThan(0);
    expect(state.practicalContext.constraints[0]?.rawQuote).toMatch(/ADHD/i);
  });

  it("leaves Tier-A buckets empty when answers are blank", () => {
    const state = extractCaseStateFull("blank-1", {});

    expect(state.projections.admiredFigures).toEqual([]);
    expect(state.projections.rejectedFigures).toEqual([]);
    expect(state.money.easyMoneyHistory).toEqual([]);
    expect(state.hiddenBargain.benefitsOfStaying).toEqual([]);
    expect(state.symbolicMaterial.scene).toBeUndefined();
    expect(state.userFinalReflection.requestedInsight).toBeUndefined();
  });

  it("fills only present sections on partial answers", () => {
    const state = extractCaseStateFull("partial-1", {
      "Q5.1": ["A mentor who claims space calmly"],
      "Q10.1": "A narrow bridge",
      "Q11.3": "See what I cannot see",
    });

    expect(state.projections.admiredFigures).toHaveLength(1);
    expect(state.symbolicMaterial.scene).toBe("A narrow bridge");
    expect(state.userFinalReflection.requestedInsight).toBe("See what I cannot see");
    expect(state.money.easyMoneyHistory).toEqual([]);
    expect(state.hiddenBargain.costsOfStaying).toEqual([]);
  });
});
