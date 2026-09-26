import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { MockModeBadge } from "./mock-mode-badge";
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

  it("preserves line breaks only on experiment and question sections", () => {
    const marked = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          { id: "problem", title: "The problem as you see it", body: "One line.\n\nAnother line." },
          { id: "experiment", title: "Your experiment", body: "Step one.\n\nStep two." },
          { id: "questions", title: "Questions", body: "1. First?\n\n2. Second?" },
        ],
      }),
    );
    expect(marked).toContain('class="leading-7"');
    expect(marked).toContain('class="leading-7 whitespace-pre-line"');
    expect(marked.match(/whitespace-pre-line/g)).toHaveLength(2);
    expect(marked).toContain("Step one.\n\nStep two.");
    expect(marked).toContain("1. First?\n\n2. Second?");
  });

  it("hides app chrome in print and documents browser-owned headers", () => {
    expect(html).toContain('class="print:hidden leading-7 text-muted"');
    expect(html).toContain('class="print:hidden text-sm text-muted"');
    const badge = renderToStaticMarkup(createElement(MockModeBadge));
    expect(badge).toContain("print:hidden");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/Browser-owned print headers/);
    expect(css).toMatch(/CSS cannot hide them/);
  });

  it("drops leftover evidence markers from the letter the client reads", () => {
    const letter = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          {
            id: "problem",
            title: "The problem as you see it",
            body: "You left a career after burnout [origin-case:Q0.2,, ]. Freezing shows up whenever marketing starts [,, ].",
          },
          {
            id: "experiment",
            title: "Your experiment",
            body: "Send the existing draft [, ].\n\nWatch the 25-minute window [,,, ].",
          },
        ],
      }),
    );

    expect(letter).not.toContain("[origin-case:Q0.2,, ]");
    expect(letter).not.toContain("[,, ]");
    expect(letter).not.toContain("[, ]");
    expect(letter).not.toContain("[,,, ]");
    expect(letter).toContain("You left a career after burnout.");
    expect(letter).toContain("Freezing shows up whenever marketing starts.");
    expect(letter).toContain("Send the existing draft.\n\nWatch the 25-minute window.");
  });

  it("keeps a client's own bracketed words in the letter", () => {
    const letter = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          {
            id: "hidden",
            title: "A possible hidden position",
            body: "You called the holding pattern [a tender romance].",
          },
        ],
      }),
    );

    expect(letter).toContain("[a tender romance]");
  });
});
