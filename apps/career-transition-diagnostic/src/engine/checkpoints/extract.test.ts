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
    join(__dirname, "../test-support/fixtures/origin-case-answers.json"),
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
    expect(state.symbolicMaterial.scene).toMatch(/pipe|tube/i);
    expect(state.symbolicMaterial.obstacleSpeech).toBeTruthy();
    expect(String(state.symbolicMaterial.obstacleSpeech).length).toBeGreaterThan(400);
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

  it("maps history and evidence-absorption questions to the correct buckets", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q4.1": "yes",
        "Q4.2": "yes",
        "Q4.2b":
          "I explain success away as luck",
      },
    );

    expect(
      state.history.earlierOccurrences[0]
        ?.questionId,
    ).toBe("Q4.1");

    expect(
      state.history
        .identityConclusionRecurrence[0]
        ?.questionId,
    ).toBe("Q4.2");

    expect(
      state.history.evidenceAbsorption[0]
        ?.questionId,
    ).toBe("Q4.2b");
  });

  it("does not treat the section-3 skip control as a body response", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q3.3S": true,
      },
    );

    expect(
      state.affect.bodyResponses,
    ).toEqual([]);
  });

  it("extracts fixed and adaptive legitimacy-loop evidence", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q4.9": 9,
        "QB.1":
          "I move when another person genuinely depends on me",
      },
    );

    expect(
      state.history.legitimacyLoop.map(
        (item) => item.questionId,
      ),
    ).toEqual(
      expect.arrayContaining([
        "Q4.9",
        "QB.1",
      ]),
    );
  });

  it("extracts work without identity separately from identity without work", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q7.5":
          "The identity would still appeal to me",
        "Q7.6": 9,
      },
    );

    expect(
      state.futureFantasy
        .identityWithoutWork[0]
        ?.questionId,
    ).toBe("Q7.5");

    expect(
      state.futureFantasy
        .workWithoutIdentity[0]
        ?.questionId,
    ).toBe("Q7.6");
  });

  it("keeps money difference and background-income answers separate", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q8.6":
          "In employment demand already existed",
        "Q8.10":
          "I would study, make art, and do nonprofit work",
      },
    );

    expect(
      state.money.easyVsHardDifference[0]
        ?.questionId,
    ).toBe("Q8.6");

    expect(
      state.money.backgroundIncome[0]
        ?.questionId,
    ).toBe("Q8.10");
  });

  it("maps symbolic obstacle and what lies ahead correctly", () => {
    const state = extractCaseStateFull(
      "a1",
      {
        "Q10.3":
          "A rusty pipe blocks the path",
        "Q10.4":
          "There is daylight beyond it",
      },
    );

    expect(
      state.symbolicMaterial.obstacle,
    ).toBe(
      "A rusty pipe blocks the path",
    );

    expect(
      state.symbolicMaterial.ahead,
    ).toBe(
      "There is daylight beyond it",
    );
  });

  it("keeps pipeline-discovered open forks when re-extracting a prior snapshot", () => {
    const previous = extractCaseStateFull("resume-1", originCaseAnswers);
    previous.openForks = [
      "history_vs_stated_cause",
      "container_loss_vs_capacity",
      "legitimacy_loop",
    ];

    const resumed = extractCaseStateFull("resume-1", originCaseAnswers, previous);

    expect(resumed.openForks).toEqual([
      "history_vs_stated_cause",
      "container_loss_vs_capacity",
      "legitimacy_loop",
      "rational_caution_vs_hidden_bargain",
      "background_income_relief_vs_replacement",
    ]);
  });

  it("does not invent open forks that were not preferred or previously open", () => {
    const previous = extractCaseStateFull("resume-2", originCaseAnswers);
    previous.openForks = ["container_loss_vs_capacity"];

    const resumed = extractCaseStateFull("resume-2", originCaseAnswers, previous);

    expect(resumed.openForks).toEqual([
      "container_loss_vs_capacity",
      "rational_caution_vs_hidden_bargain",
      "background_income_relief_vs_replacement",
    ]);
    expect(resumed.openForks).not.toContain("legitimacy_loop");
    expect(resumed.openForks).not.toContain("impostor_filter_vs_inexperience");
  });
});
