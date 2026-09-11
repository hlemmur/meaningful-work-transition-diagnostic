import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeskShell } from "./desk-shell";

describe("desk shell", () => {
  it("gives operator routes denser chrome with queue and export nav", () => {
    const html = renderToStaticMarkup(
      createElement(DeskShell, null, createElement("h1", null, "Review queue")),
    );

    expect(html).toContain("data-shell=\"desk\"");
    expect(html).toContain("Review queue");
    expect(html).toContain("href=\"/admin\"");
    expect(html).toContain("Queue");
    expect(html).toContain("href=\"/admin/export\"");
    expect(html).toContain("Marketing export");
    expect(html).toContain("max-w-4xl");
    expect(html).not.toContain("Radical Creation Coaching");
  });
});
