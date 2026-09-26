import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  QUESTIONNAIRE_VERSION,
  optionLabel,
  questions,
} from "./questionnaire.v2";

const SUPPORT_CONTEXT_OPTIONS = [
  "clear_expectations",
  "deadlines",
  "manager_mentor",
  "team",
  "external_accountability",
  "high_autonomy",
  "recognition",
  "stable_income",
  "title_status",
  "competition",
  "playful_atmosphere",
  "clear_tasks",
  "community",
  "responsibility_to_others",
  "frequent_feedback",
  "strong_structure",
  "freedom_from_financial_concern",
  "novelty",
  "other",
] as const;

const YES_NO_UNSURE = ["yes", "no", "unsure"] as const;

describe("questionnaire.v2", () => {
  it("declares the canonical questionnaire version", () => {
    expect(QUESTIONNAIRE_VERSION).toBe("questionnaire.v2");
  });

  it("uses unique stable question IDs", () => {
    const ids = questions.map((question) => question.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("places optional analogue and contrast fields after Q4.8 and before Q4.9", () => {
    const ids = questions.map((question) => question.id);
    expect(ids.indexOf("Q4.8")).toBeLessThan(ids.indexOf("Q4.10"));
    expect(ids.indexOf("Q4.10")).toBeLessThan(ids.indexOf("Q4.11"));
    expect(ids.indexOf("Q4.11")).toBeLessThan(ids.indexOf("Q4.12"));
    expect(ids.indexOf("Q4.12")).toBeLessThan(ids.indexOf("Q4.9"));
    for (const id of ["Q4.10", "Q4.11", "Q4.12"] as const) {
      const question = questions.find((item) => item.id === id);
      expect(question?.optionality).toBe("optional");
      expect(question?.inputType).toBe("long_text");
      expect(question?.section).toBe(4);
    }
  });

  it("covers every v2 section from 0 through 11", () => {
    const sections = new Set(questions.map((question) => question.section));
    expect([...sections].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("names each chapter uniquely for sections 0 through 11", () => {
    const names = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((section) => CHAPTERS[section]);
    expect(names).toEqual([
      "Situation",
      "The struggle",
      "What you have tried",
      "If you actually did it",
      "Support and proof",
      "Figures you long for",
      "Figures that sting",
      "An ordinary Tuesday",
      "Money",
      "What staying protects",
      "The scene",
      "Closing",
    ]);
    expect(new Set(names).size).toBe(12);
  });

  it("keeps stored option values in snake_case", () => {
    for (const question of questions) {
      for (const value of question.options ?? []) {
        expect(value).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
      }
    }
  });

  it("gives human sentence-case labels without underscore-replacing", () => {
    expect(optionLabel("employed_considering")).toBe("Employed, considering a change");

    const catalog = new Set<string>([
      ...questions.flatMap((question) => question.options ?? []),
      ...SUPPORT_CONTEXT_OPTIONS,
      ...YES_NO_UNSURE,
    ]);

    for (const value of catalog) {
      const label = optionLabel(value);
      expect(label).not.toContain("_");
      expect(label).not.toBe(value.replaceAll("_", " "));
      expect(label[0]).toBe(label[0]?.toUpperCase());
    }
  });
});
