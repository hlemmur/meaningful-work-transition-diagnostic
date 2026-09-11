import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./page";
import { MARKETING_CONSENT_COPY, PRODUCT_CONSENT_COPY } from "@/server/consent/copy";

describe("privacy notice", () => {
  it("hosts the full required disclosures without copy-version IDs in customer chrome", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));

    expect(html).toContain("Privacy for this diagnostic");
    expect(html).toContain(PRODUCT_CONSENT_COPY.scope.heading);
    expect(html).toContain(PRODUCT_CONSENT_COPY.aiProcessing.heading);
    expect(html).toContain(PRODUCT_CONSENT_COPY.coachingNotTherapy.heading);
    expect(html).toContain(PRODUCT_CONSENT_COPY.privacy.heading);
    expect(html).toContain(PRODUCT_CONSENT_COPY.privacy.retention);
    expect(html).toContain(PRODUCT_CONSENT_COPY.aiProcessing.body);
    expect(html).toContain(MARKETING_CONSENT_COPY.checkboxLabel);
    expect(html).toContain(MARKETING_CONSENT_COPY.withdrawal);
    expect(html).not.toContain("Copy version");
    expect(html).not.toContain("product-consent.v1");
    expect(html).not.toContain("marketing-consent.v1");
    expect(html).toContain("href=\"/\"");
    expect(html).toMatch(/Back/);
  });
});
