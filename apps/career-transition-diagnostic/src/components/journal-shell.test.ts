import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { JournalShell } from "./journal-shell";

describe("journal shell", () => {
  it("shows the studio brand and a privacy footer around customer pages", () => {
    const html = renderToStaticMarkup(
      createElement(JournalShell, null, createElement("h1", null, "Assessment")),
    );

    expect(html).toContain("data-shell=\"journal\"");
    expect(html).toContain("Radical Creation Coaching");
    expect(html).toContain("href=\"/privacy\"");
    expect(html).toContain("Assessment");
    expect(html).toContain("max-w-2xl");
    expect(html).toContain("pt-16");
  });
});

describe("paper tokens", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );

  it("commits parchment tokens without Arial or OS dark inversion", () => {
    expect(css).toContain("--color-paper");
    expect(css).toContain("#efe4d6");
    expect(css).toContain("--color-ink");
    expect(css).toContain("#2b211c");
    expect(css).toContain("--color-muted");
    expect(css).toContain("#4a3b34");
    expect(css).toContain("--color-terracotta");
    expect(css).toContain("#b65f3e");
    expect(css).toContain("--color-hairline");
    expect(css).toContain("--color-field");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toMatch(/font-family:\s*Arial/);
    expect(css).not.toContain("prefers-color-scheme: dark");
  });
});
