import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("not found recovery", () => {
  it("offers a way home and a request-a-new-link tone", () => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toContain("This link is not available");
    expect(html).toContain("href=\"/\"");
    expect(html).toMatch(/Home/);
    expect(html).toMatch(/request a new link/i);
  });
});
