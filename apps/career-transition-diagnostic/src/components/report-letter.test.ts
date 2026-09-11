import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { ReportLetter } from "./report-letter";

const html = renderToStaticMarkup(
  createElement(ReportLetter, {
    sections: [
      { id: "s1", title: "The problem as you see it", body: "Edited hypothesis language only." },
    ],
  }),
);

describe("report letter", () => {
  it("reads as a letter with serif title, section openers, and a quieter print hint", () => {
    expect(html).toContain("font-display");
    expect(html).toContain("Private report");
    expect(html).toMatch(/Dear you|A letter|for you/i);
    expect(html).toContain("The problem as you see it");
    expect(html).toContain("Edited hypothesis language only.");
    expect(html).toContain("data-coaching-cta");
    expect(html).toContain("mailto:contact@radicalcreationcoaching.com");
    expect(html).toMatch(/print this page|PDF/i);
    expect(html).not.toMatch(/Use your browser print dialog/i);
  });
});
