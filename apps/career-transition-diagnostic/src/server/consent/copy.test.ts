import { afterEach, describe, expect, it } from "vitest";
import {
  completeMockPurchase,
  getAssessmentByAccessToken,
  resetMockTracerStore,
} from "../tracer/service";
import { exportMarketingContacts, recordWelcomeConsent } from "./marketing";
import {
  MARKETING_CONSENT_COPY,
  PRODUCT_CONSENT_COPY,
} from "./copy";

afterEach(() => {
  process.env.APP_MODE = "mock";
  resetMockTracerStore();
});

function joined(copy: { title?: string } & Record<string, unknown>) {
  return JSON.stringify(copy).toLowerCase();
}

describe("versioned consent copy", () => {
  it("publishes reviewable product copy with scope, AI, disclaimer, and privacy notes", () => {
    const text = joined(PRODUCT_CONSENT_COPY);

    expect(PRODUCT_CONSENT_COPY.version).toMatch(/^product-consent\.v\d+$/);
    expect(text).toContain("career-transition diagnostic");
    expect(text).toContain("not coaching");
    expect(text).toContain("not therapy");
    expect(text).toMatch(/artificial intelligence|\bai\b/);
    expect(text).toContain("90 day");
    expect(text).toContain("delet");
    expect(text).toContain("analytics");
    expect(text).not.toMatch(/persona|shadow|archetype|individuation/);
  });

  it("publishes optional marketing copy with withdrawal language and no assessment data", () => {
    const text = joined(MARKETING_CONSENT_COPY);

    expect(MARKETING_CONSENT_COPY.version).toMatch(/^marketing-consent\.v\d+$/);
    expect(text).toMatch(/optional|not required/);
    expect(text).toMatch(/withdraw|unsubscribe/);
    expect(text).not.toContain("answer");
    expect(text).not.toContain("report");
    expect(text).not.toContain("safety");
  });

  it("stamps stored consent records with the published copy versions", async () => {
    const { accessToken } = await completeMockPurchase("buyer@example.com");

    const assessment = await recordWelcomeConsent({
      accessToken,
      productConsent: true,
      marketingOptIn: true,
    });

    expect(assessment.productConsentVersion).toBe(PRODUCT_CONSENT_COPY.version);
    expect(getAssessmentByAccessToken(accessToken)?.productConsentVersion).toBe(
      PRODUCT_CONSENT_COPY.version,
    );
    expect(exportMarketingContacts()).toEqual([
      expect.objectContaining({
        email: "buyer@example.com",
        consentCopyVersion: MARKETING_CONSENT_COPY.version,
      }),
    ]);
  });
});
