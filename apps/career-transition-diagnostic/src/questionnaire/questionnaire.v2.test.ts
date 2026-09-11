import { describe, expect, it } from "vitest";
import { QUESTIONNAIRE_VERSION, questions } from "./questionnaire.v2";

describe("questionnaire.v2", () => {
  it("declares the canonical questionnaire version", () => {
    expect(QUESTIONNAIRE_VERSION).toBe("questionnaire.v2");
  });

  it("uses unique stable question IDs", () => {
    const ids = questions.map((question) => question.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("covers every v2 section from 0 through 11", () => {
    const sections = new Set(questions.map((question) => question.section));
    expect([...sections].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });
});
