import { describe, expect, it } from "vitest";
import { promptRegistry } from "./index";

const FORK_IDS = [
  "history_vs_stated_cause",
  "impostor_filter_vs_inexperience",
  "container_loss_vs_capacity",
  "legitimacy_loop",
  "work_vs_identity_vs_job_shape",
  "money_infrastructure_vs_misalignment",
  "background_income_relief_vs_replacement",
  "rational_caution_vs_hidden_bargain",
] as const;

function expectMentions(text: string, needles: string[]) {
  for (const needle of needles) {
    expect(text, `missing “${needle}”`).toMatch(new RegExp(needle, "i"));
  }
}

describe("promptRegistry contracts", () => {
  it("bumps every stub off v1 and names a JSON contract", () => {
    for (const [key, prompt] of Object.entries(promptRegistry)) {
      expect(prompt.version, key).toMatch(/\.v[2-9]\d*$/);
      expect(prompt.text.length, key).toBeGreaterThan(200);
      expect(prompt.text, key).toMatch(/empty arrays? are valid/i);
    }
  });

  it("lists fork ids and checkpoint fields for A–D and safety", () => {
    for (const key of ["checkpointA", "checkpointB", "checkpointC", "checkpointD"] as const) {
      expectMentions(promptRegistry[key].text, [
        "openForks",
        "adaptiveQuestion",
        "0 or 1",
        "safety",
        ...FORK_IDS,
      ]);
      expect(promptRegistry[key].text).toMatch(/Jungian/i);
    }

    expectMentions(promptRegistry.checkpointSafety.text, ["none", "high", "skip remaining depth"]);
  });

  it("states pass 1–10 field, enum, and count contracts", () => {
    expectMentions(promptRegistry.pass1.text, [
      "consciousExplanationTags",
      "unresolvedQuestions",
      "Q11.3",
    ]);
    expectMentions(promptRegistry.pass2.text, [
      "contradictions",
      "at least 1",
      "originForks",
      "scores",
      ...FORK_IDS,
    ]);
    expectMentions(promptRegistry.pass3.text, [
      "3-5",
      "hypotheses",
      "psychological",
      "identity",
      "practical",
      "environmental",
      "economic",
      "occupational",
      "developmental",
      "structural",
      "originForks",
      "scoring",
      "confidence",
      "weak",
      "tentative",
      "moderate",
      "strong",
    ]);
    expectMentions(promptRegistry.pass4.text, [
      "critiques",
      "hypothesisId",
      "mundaneAlternative",
      "survives",
    ]);
    expectMentions(promptRegistry.pass5.text, [
      "votes",
      "at least 1",
      "supports",
      "weakens",
      "splits",
      "insufficient",
      "overallNote",
    ]);
    expectMentions(promptRegistry.pass6.text, [
      "hiddenPosition",
      "nullable",
      "alternative",
      "requestedInsight",
      "possibleCompensatoryAim",
    ]);
    expectMentions(promptRegistry.pass7.text, [
      "jungianLenses",
      "0-3",
      "omitReason",
      "You are a Puer",
      "tentative",
    ]);
    expectMentions(promptRegistry.pass8.text, [
      "realityCheck",
      "experiments",
      "behavioral",
      "imaginal",
      "riskLevel",
    ]);
    expectMentions(promptRegistry.pass9.text, [
      "sections",
      "peel",
      "evidenceRefs",
      "problem",
      "reality",
      "contradiction",
      "alternative",
      "experiment",
      "caseSnapshot",
      "distinct question",
      "Q11.3",
    ]);
    expectMentions(promptRegistry.pass10.text, [
      "failingSectionIds",
      "regeneratedSections",
      "Q11.3",
      "peel",
      "one-sentence",
      "distinct question",
      "draftReport",
      "evidenceAllowlist",
      "requestedInsight",
    ]);
  });
});
