import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginEmailField } from "./login-email-field";

describe("login email field", () => {
  it("does not prefill a mock email from the server render", () => {
    const html = renderToStaticMarkup(createElement(LoginEmailField));

    expect(html).toContain("name=\"email\"");
    expect(html).not.toContain("lena@example.com");
    expect(html).not.toContain("defaultValue");
  });
});
