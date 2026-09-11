import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDeleteAccess } from "./confirm-delete-access";

describe("confirm delete access", () => {
  it("does not submit delete until the operator confirms", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDeleteAccess, { action: () => undefined }),
    );

    expect(html).toContain("Delete access");
    expect(html).not.toContain("Confirm delete");
    expect(html).not.toContain("<form");
  });
});
