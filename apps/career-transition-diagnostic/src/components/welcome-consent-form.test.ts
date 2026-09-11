import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { WelcomeConsentForm } from "./welcome-consent-form";
import { PRODUCT_CONSENT_COPY } from "@/server/consent/copy";

describe("welcome consent form", () => {
  it("puts a short note from Lena and the consent CTA above the legal wall", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeConsentForm, { action: () => undefined }),
    );

    expect(html).toMatch(/Lena/i);
    expect(html).toContain("Continue to assessment");
    expect(html).toContain("id=\"product-consent\"");
    expect(html).toContain("id=\"marketing-opt-in\"");
    expect(html).toContain(PRODUCT_CONSENT_COPY.checkboxLabel);
    expect(html).toContain("href=\"/privacy\"");
    expect(html).toContain("consent-check");
    expect(html.indexOf("A note from Lena")).toBeLessThan(html.indexOf("Continue to assessment"));
    expect(html).not.toContain("Copy version");
    expect(html).not.toContain("product-consent.v1");
    expect(html).not.toContain("marketing-consent.v1");
    expect(html).not.toContain(`>${PRODUCT_CONSENT_COPY.scope.heading}<`);
    expect(html).not.toContain(`>${PRODUCT_CONSENT_COPY.coachingNotTherapy.heading}<`);
  });
});
