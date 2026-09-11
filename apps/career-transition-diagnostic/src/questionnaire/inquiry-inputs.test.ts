import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ChoiceCards, LabeledScale } from "./inquiry-inputs";
import { getQuestion } from "./questionnaire.v2";

describe("inquiry inputs", () => {
  it("renders select options as choice cards with 44px targets and human labels", () => {
    const html = renderToStaticMarkup(
      createElement(ChoiceCards, {
        prompt: "Which of these is closest to your situation?",
        name: "Q0-1",
        multiple: false,
        choices: ["employed_considering", "employed_not_considering"],
        value: "employed_considering",
        locked: false,
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("choice-card");
    expect(html).toContain("min-h-11");
    expect(html).toContain("Employed, considering a change");
    expect(html).not.toContain("employed considering");
    expect(html).toContain('type="radio"');
  });

  it("labels default scales from not at all to completely", () => {
    const question = getQuestion("Q0.4");
    expect(question).toBeDefined();
    const html = renderToStaticMarkup(
      createElement(LabeledScale, {
        question: question!,
        value: 4,
        locked: false,
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("Not at all");
    expect(html).toContain("Completely");
    expect(html).toContain("4");
    expect(html).toContain('type="range"');
  });

  it("names body regions on the body-location scale", () => {
    const question = getQuestion("Q3.2");
    expect(question).toBeDefined();
    const html = renderToStaticMarkup(
      createElement(LabeledScale, {
        question: question!,
        value: 7,
        locked: false,
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("Nothing noticeable");
    expect(html).toContain("Chest");
    expect(html).toContain("Throat");
    expect(html).toContain("Stomach");
  });
});
