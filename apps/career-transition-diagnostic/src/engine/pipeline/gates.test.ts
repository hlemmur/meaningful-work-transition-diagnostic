import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import {
  assertCaseStateCompleteness,
  isParaphraseOf,
  critiquesNonEmpty,
} from "./gates";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

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
