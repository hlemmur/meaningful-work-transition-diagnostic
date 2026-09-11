import { describe, expect, it } from "vitest";
import { getQuestion } from "./questionnaire.v2";
import { chapterProgress, isLastVisibleQuestion } from "./questionnaire-progress";

function sectionFor(id: string) {
  return getQuestion(id)?.section ?? -1;
}

describe("questionnaire progress", () => {
  it("treats only the last visible question as submittable", () => {
    const visible = ["Q0.1", "Q0.2", "Q11.3"];
    expect(isLastVisibleQuestion("Q0.1", visible)).toBe(false);
    expect(isLastVisibleQuestion("Q11.3", visible)).toBe(true);
    expect(isLastVisibleQuestion("Q11.3", [])).toBe(false);
  });

  it("reports chapter-local progress instead of a global section index", () => {
    const visible = ["Q0.1", "Q0.2", "Q1.1"];
    expect(chapterProgress("Q0.2", visible, sectionFor)).toEqual({
      chapter: "Situation",
      indexInChapter: 2,
      chapterLength: 2,
      label: "Situation · 2 of 2",
    });
    expect(chapterProgress("Q1.1", visible, sectionFor).label).toBe("The struggle · 1 of 1");
    expect(chapterProgress("Q0.1", visible, sectionFor).label).not.toMatch(/Section 0|1 of 87/);
  });
});
