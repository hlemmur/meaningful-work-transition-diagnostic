import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { reportSectionSchema } from "@/engine/schemas/analysis";
import {
  assertCaseStateCompleteness,
  isParaphraseOf,
  critiquesNonEmpty,
  imageCited,
  projectionCited,
  moneyCited,
  reportLayerCoverage,
} from "./gates";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

function section(
  id: string,
  body: string,
  evidenceRefs: string[],
) {
  return reportSectionSchema.parse({
    id,
    title: id,
    body,
    evidenceRefs,
  });
}

describe("pipeline gates", () => {
  it("detects Q11.3 paraphrases", () => {
    const insight = "I hope it shows me some sharp angles that I can't unsee";
    expect(
      isParaphraseOf(
        "Relying on external intellectual revelations as a substitute for gradual emotional integration",
        insight,
      ),
    ).toBe(false);
    expect(isParaphraseOf(insight, insight)).toBe(true);
    expect(
      isParaphraseOf(
        "sharp angles I cannot unsee that shift my perspective",
        insight,
      ),
    ).toBe(true);
  });

  it("passes completeness when origin answers are fully extracted", () => {
    const state = extractCaseStateFull("o1", originAnswers);
    expect(assertCaseStateCompleteness(state, originAnswers).passed).toBe(true);
  });

  it("fails completeness when answered Tier-A sections are empty in CaseState", () => {
    const state = extractCaseStateFull("o1", {});
    const finding = assertCaseStateCompleteness(state, originAnswers);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/projections|money|hiddenBargain|symbolic/i);
  });

  it("requires non-empty critiques", () => {
    expect(critiquesNonEmpty([]).passed).toBe(false);
    expect(critiquesNonEmpty([{ hypothesisId: "h1" }]).passed).toBe(true);
  });
});

describe("Tier-A citation gates", () => {
  const origin = extractCaseStateFull("o1", originAnswers);

  it("image_cited fails when rich associations exist but reality/hidden omit image", () => {
    const sections = [
      section("reality", "Practical constraints dominate.", ["o1:Q0.5"]),
      section("hidden", "One hypothesis about structure.", ["o1:Q9.2"]),
      section("experiment", "Imagine the pipe across a threshold.", ["o1:Q1.1"]),
    ];
    const finding = imageCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("image_cited");
  });

  it("image_cited passes when reality cites Q10", () => {
    const sections = [
      section(
        "reality",
        "The pipe associations mark mid-crossing.",
        ["o1:Q10.1", "o1:Q0.5"],
      ),
      section("hidden", "Structure still carries authority.", ["o1:Q9.2"]),
    ];
    expect(imageCited(sections, origin).passed).toBe(true);
  });

  it("image_cited is disarmed without rich associations", () => {
    const thin = extractCaseStateFull("o1", { "Q1.1": "I stall" });
    const sections = [section("reality", "No image work.", ["o1:Q1.1"])];
    expect(imageCited(sections, thin).passed).toBe(true);
  });

  it("projection_cited fails when figures exist but contradiction/hidden omit them", () => {
    const sections = [
      section("contradiction", "Wanting freedom and structure.", ["o1:Q1.2"]),
      section("hidden", "Protection keeps lightness.", ["o1:Q9.2"]),
      section("reality", "Constraints are real.", ["o1:Q0.5"]),
    ];
    const finding = projectionCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("projection_cited");
  });

  it("projection_cited passes with hooked-quality language", () => {
    const sections = [
      section(
        "contradiction",
        "Admiration for grounded mentors marks a hooked quality of claiming space.",
        ["o1:Q1.2"],
      ),
      section("hidden", "Protection keeps lightness.", ["o1:Q9.2"]),
    ];
    expect(projectionCited(sections, origin).passed).toBe(true);
  });

  it("money_cited fails when money buckets exist but reality/alternative omit them", () => {
    const sections = [
      section("reality", "Deadlines and legitimacy matter.", ["o1:Q0.5"]),
      section("alternative", "Maybe missing skill, not a stance.", ["o1:Q0.5"]),
      section("hidden", "Money still arrives somehow.", ["o1:Q9.2"]),
    ];
    const finding = moneyCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("money_cited");
  });

  it("money_cited passes with Q8 refs on reality", () => {
    const sections = [
      section(
        "reality",
        "Industry machinery once delivered income.",
        ["o1:Q8.4", "o1:Q0.5"],
      ),
      section("alternative", "Skill gap may suffice.", ["o1:Q0.5"]),
    ];
    expect(moneyCited(sections, origin).passed).toBe(true);
  });

  it("reportLayerCoverage fails when indicated layers are missing", () => {
    const sections = [
      section("problem", "You stall.", ["o1:Q1.1"]),
      section("reality", "Only practical notes.", ["o1:Q0.5"]),
    ];
    expect(reportLayerCoverage(sections, origin).passed).toBe(false);
  });
});
