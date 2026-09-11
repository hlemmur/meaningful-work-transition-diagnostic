import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import {
  completeMockPurchase,
  deleteAssessmentData,
  getAdminCase,
  getDeliveredReport,
  purgeExpiredAssessments,
  recordWelcomeConsent,
  resetMockTracerStore,
  runAnalysisPipeline,
  saveAnswer,
  submitAssessment,
  approveAssessment,
} from "./service";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.RETENTION_MS;
  resetMockOutbox();
  resetMockTracerStore();
});

beforeEach(() => {
  process.env.APP_MODE = "mock";
});

async function submittedWithAnswer() {
  const purchase = await completeMockPurchase("buyer@example.com");
  await recordWelcomeConsent({
    accessToken: purchase.accessToken,
    productConsent: true,
    marketingOptIn: false,
  });
  await saveAnswer(purchase.accessToken, "Q1.1", "secret career material");
  await submitAssessment(purchase.accessToken);
  return purchase;
}

describe("retention and manual delete", () => {
  it("sets a retention deadline on submit and purges answers and reports after it", async () => {
    process.env.RETENTION_MS = "1";
    const { assessmentId, accessToken } = await submittedWithAnswer();
    await runAnalysisPipeline(assessmentId);
    expect(getAdminCase(assessmentId).assessment.answers["Q1.1"]).toBe("secret career material");
    expect(getAdminCase(assessmentId).assessment.retentionDeadline).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(purgeExpiredAssessments()).toBe(1);

    const purged = getAdminCase(assessmentId);
    expect(purged.assessment.answers).toEqual({});
    expect(purged.draft).toBeUndefined();
    expect(getAdminCase(assessmentId).assessment.retentionDeadline).toBeDefined();
    expect(JSON.stringify(purged)).not.toContain("secret career material");
    expect(getAdminCase(assessmentId).assessment.email).toBe("buyer@example.com");
    expect(accessToken).toBeTruthy();
  });

  it("manual delete removes answers, reports, and customer access", async () => {
    const { assessmentId } = await submittedWithAnswer();
    await runAnalysisPipeline(assessmentId);
    const delivery = await approveAssessment(assessmentId);
    expect(getDeliveredReport(delivery.reportToken)?.sections.length).toBeGreaterThan(0);

    deleteAssessmentData(assessmentId);

    expect(getDeliveredReport(delivery.reportToken)).toBeUndefined();
    expect(getAdminCase(assessmentId).assessment.answers).toEqual({});
    expect(getAdminCase(assessmentId).draft).toBeUndefined();
    expect(JSON.stringify(getAdminCase(assessmentId))).not.toContain("secret career material");
  });

  it("does not purge assessments that are still inside the retention window", async () => {
    const { assessmentId } = await submittedWithAnswer();
    expect(purgeExpiredAssessments()).toBe(0);
    expect(getAdminCase(assessmentId).assessment.answers["Q1.1"]).toBe("secret career material");
  });
});
