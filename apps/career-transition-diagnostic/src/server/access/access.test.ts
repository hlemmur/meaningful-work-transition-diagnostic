import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import {
  completeMockPurchase,
  expireAccessToken,
  getAssessmentByAccessToken,
  requestNewAccessLink,
  resetMockTracerStore,
  saveAnswer,
} from "../tracer/service";
import {
  exportMarketingContacts,
  recordWelcomeConsent,
  withdrawMarketingConsent,
} from "../consent/marketing";
import { MARKETING_CONSENT_COPY } from "../consent/copy";
import { processLemonWebhook } from "./webhook";

function sign(rawBody: string) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? "mock-webhook-secret";
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function paidOrderPayload(orderId: string, email = "buyer@example.com") {
  return JSON.stringify({
    meta: { event_name: "order_created", webhook_id: `wh-${orderId}` },
    data: {
      id: orderId,
      attributes: { user_email: email, status: "paid" },
    },
  });
}

afterEach(() => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  resetMockTracerStore();
});

describe("paid token access and consent", () => {
  it("rejects an invalid Lemon Squeezy webhook signature", async () => {
    process.env.APP_MODE = "mock";
    const rawBody = paidOrderPayload("order-1");

    await expect(processLemonWebhook(rawBody, "not-valid")).rejects.toThrow(
      "Invalid webhook signature",
    );
  });

  it("creates one assessment when the same paid webhook is replayed", async () => {
    process.env.APP_MODE = "mock";
    const rawBody = paidOrderPayload("order-replay");
    const signature = sign(rawBody);

    const first = await processLemonWebhook(rawBody, signature);
    const second = await processLemonWebhook(rawBody, signature);

    expect(second.assessmentId).toBe(first.assessmentId);
    expect(second.created).toBe(false);
    expect(first.created).toBe(true);
    expect(first).toEqual({ assessmentId: first.assessmentId, created: true });
    expect(first).not.toHaveProperty("accessToken");
  });

  it("rejects an expired token and issues a working replacement link", async () => {
    process.env.APP_MODE = "mock";
    const purchase = await completeMockPurchase("buyer@example.com");
    expireAccessToken(purchase.accessToken);

    expect(getAssessmentByAccessToken(purchase.accessToken)).toBeUndefined();

    const renewed = await requestNewAccessLink(purchase.accessToken);
    expect(renewed.sent).toBe(true);
    if (!renewed.sent) {
      throw new Error("expected renewal");
    }
    expect(getAssessmentByAccessToken(purchase.accessToken)).toBeUndefined();
    expect(getAssessmentByAccessToken(renewed.accessToken)?.id).toBe(purchase.assessmentId);
    expect(renewed.accessEmail.text).toContain(`/a/${renewed.accessToken}`);
  });

  it("does not enumerate buyers or rotate a live link from an unknown token", async () => {
    process.env.APP_MODE = "mock";
    const purchase = await completeMockPurchase("buyer@example.com");

    const missing = await requestNewAccessLink("not-a-real-token");
    expect(missing).toEqual({ sent: false });
    expect(getAssessmentByAccessToken(purchase.accessToken)?.id).toBe(purchase.assessmentId);
  });

  it("keeps marketing opt-in off by default and isolated from answers", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await completeMockPurchase("buyer@example.com");

    await recordWelcomeConsent({
      accessToken,
      productConsent: true,
      marketingOptIn: false,
    });
    await saveAnswer(accessToken, "Q1.1", "secret career material");

    expect(exportMarketingContacts()).toEqual([]);

    await recordWelcomeConsent({
      accessToken,
      productConsent: true,
      marketingOptIn: true,
    });
    expect(exportMarketingContacts()).toEqual([
      expect.objectContaining({
        email: "buyer@example.com",
        consentCopyVersion: MARKETING_CONSENT_COPY.version,
      }),
    ]);
    expect(JSON.stringify(exportMarketingContacts())).not.toContain("secret career material");

    withdrawMarketingConsent("buyer@example.com");
    expect(exportMarketingContacts()).toEqual([]);
  });
});
