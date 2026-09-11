import { afterEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import {
  approveAssessment,
  completeMockPurchase,
  getAssessmentByAccessToken,
  getAssessmentByReportToken,
  recordWelcomeConsent,
  resetMockTracerStore,
  saveAnswer,
  submitAssessment,
} from "./service";

async function purchaseWithConsent(email = "buyer@example.com") {
  const purchase = await completeMockPurchase(email);
  await recordWelcomeConsent({
    accessToken: purchase.accessToken,
    productConsent: true,
    marketingOptIn: false,
  });
  return purchase;
}

afterEach(() => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  resetMockTracerStore();
});

describe("mock purchase-to-report tracer", () => {
  it("creates a token-protected assessment and emails only the access link", async () => {
    process.env.APP_MODE = "mock";
    const purchase = await completeMockPurchase("buyer@example.com");
    const assessment = getAssessmentByAccessToken(purchase.accessToken);

    expect(assessment?.status).toBe("in_progress");
    expect(purchase.accessEmail.text).toContain(`/a/${purchase.accessToken}`);
    expect(purchase.accessEmail.text).not.toContain(purchase.accessTokenHash);
  });

  it("saves an answer that survives a later read (resume)", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();

    await saveAnswer(accessToken, "Q1.1", "I left a career that still pays my bills.");
    const resumed = getAssessmentByAccessToken(accessToken);

    expect(resumed?.answers["Q1.1"]).toBe("I left a career that still pays my bills.");
  });

  it("approves a submitted draft and emails a report link without report body", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken, assessmentId } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "The stall survived every plan I wrote.");
    await submitAssessment(accessToken);

    const delivery = await approveAssessment(assessmentId);

    expect(delivery.reportEmail.subject).toMatch(/report is ready/i);
    expect(delivery.reportEmail.text).toContain(`/r/${delivery.reportToken}`);
    expect(delivery.reportEmail.text).not.toContain(delivery.draftBody);
  });

  it("rejects re-submit after approval and keeps the report token valid", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken, assessmentId } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "The stall survived every plan I wrote.");
    await submitAssessment(accessToken);
    const delivery = await approveAssessment(assessmentId);

    await expect(submitAssessment(accessToken)).rejects.toThrow("Assessment already submitted");

    const report = getAssessmentByReportToken(delivery.reportToken);
    expect(report?.status).toBe("approved");
  });
});
