import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaseAnswers } from "./case-answers";

describe("case answers", () => {
  it("lists submitted answers next to the draft", () => {
    const html = renderToStaticMarkup(
      createElement(CaseAnswers, {
        answers: { "Q0.1": "employed_considering", "Q1.1": "Send the website" },
      }),
    );

    expect(html).toContain("Answers");
    expect(html).toContain("Q0.1");
    expect(html).toContain("employed_considering");
    expect(html).toContain("Q1.1");
    expect(html).toContain("Send the website");
  });
});
