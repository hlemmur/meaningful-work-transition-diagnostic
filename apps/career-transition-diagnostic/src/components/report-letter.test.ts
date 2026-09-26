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

  it("splits blank-line blocks into paragraphs with whitespace-pre-wrap", () => {
    const marked = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          {
            id: "problem",
            title: "The problem as you see it",
            body: "One line.\n\nAnother line with\nan intentional break.",
          },
        ],
      }),
    );
    expect(marked).toContain('class="leading-7 whitespace-pre-wrap"');
    expect(marked.match(/<p class="leading-7 whitespace-pre-wrap">/g)).toHaveLength(2);
    expect(marked).toContain("Another line with\nan intentional break.");
  });

  it("renders multiline experiment movements and numbered questions as structured lists", () => {
    const marked = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          {
            id: "experiment",
            title: "Your experiment",
            body:
              "Change: Use a 25-minute private draft window.\n\nObserve: Notice what becomes easier and what charge remains.\n\nDeepen: If freeze softens, ask what vitality is protected.\n\nBridge: Bring what you noticed back to the formulation.",
          },
          {
            id: "questions",
            title: "Questions",
            body: "1. If structure helped, what tension around visibility would still remain?\n2. What evidence would weaken this hypothesis?\n3. What remains unexplained?",
          },
        ],
      }),
    );

    expect(marked).toContain("<p class=\"leading-7 whitespace-pre-wrap\">Change: Use a 25-minute private draft window.</p>");
    expect(marked).toContain("<p class=\"leading-7 whitespace-pre-wrap\">Observe: Notice what becomes easier and what charge remains.</p>");
    expect(marked).toContain("<p class=\"leading-7 whitespace-pre-wrap\">Deepen: If freeze softens, ask what vitality is protected.</p>");
    expect(marked).toContain("<p class=\"leading-7 whitespace-pre-wrap\">Bridge: Bring what you noticed back to the formulation.</p>");
    expect(marked).toContain("<ol");
    expect(marked).toContain("<li>If structure helped, what tension around visibility would still remain?</li>");
    expect(marked).toContain("<li>What evidence would weaken this hypothesis?</li>");
    expect(marked).toContain("<li>What remains unexplained?</li>");
    expect(marked).not.toMatch(/evidenceRefs/i);
  });

  it("renders bullet lines as unordered lists", () => {
    const marked = renderToStaticMarkup(
      createElement(ReportLetter, {
        sections: [
          {
            id: "reality",
            title: "What is happening in practice",
            body: "- Money pressure is real.\n- Deadlines keep slipping.\n- Sleep is thin.",
          },
        ],
      }),
    );
    expect(marked).toContain("<ul");
    expect(marked).toContain("<li>Money pressure is real.</li>");
    expect(marked).toContain("<li>Deadlines keep slipping.</li>");
    expect(marked).toContain("<li>Sleep is thin.</li>");
  });

  it("hides app chrome in print and styles letter lists for print", () => {
    expect(html).toContain('class="print:hidden leading-7 text-muted"');
    expect(html).toContain('class="print:hidden text-sm text-muted"');
    const badge = renderToStaticMarkup(createElement(MockModeBadge));
    expect(badge).toContain("print:hidden");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/Browser-owned print headers/);
    expect(css).toMatch(/CSS cannot hide them/);
    expect(css).toMatch(/\.report-page (ul|ol)/);
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
    expect(letter).toContain("Send the existing draft.");
    expect(letter).toContain("Watch the 25-minute window.");
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

  it("never renders evidenceRefs arrays into the letter markup", () => {
    const sections = [
      {
        id: "close",
        title: "A working formulation",
        body: "This stays provisional.",
        evidenceRefs: ["case:Q1.1", "case:Q2.2"],
      },
    ] as unknown as Array<{ id: string; title: string; body: string }>;
    const letter = renderToStaticMarkup(
      createElement(ReportLetter, { sections }),
    );
    expect(letter).not.toContain("case:Q1.1");
    expect(letter).not.toContain("evidenceRefs");
  });
});
