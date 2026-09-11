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

afterEach(async () => {
  process.env.APP_MODE = "mock";
  delete process.env.RETENTION_MS;
  resetMockOutbox();
  await resetMockTracerStore();
});

beforeEach(async () => {
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
    expect((await getAdminCase(assessmentId)).assessment.answers["Q1.1"]).toBe("secret career material");
    expect((await getAdminCase(assessmentId)).assessment.retentionDeadline).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await purgeExpiredAssessments()).toBe(1);

    const purged = await getAdminCase(assessmentId);
    expect(purged.assessment.answers).toEqual({});
    expect(purged.draft).toBeUndefined();
    expect((await getAdminCase(assessmentId)).assessment.retentionDeadline).toBeDefined();
    expect(JSON.stringify(purged)).not.toContain("secret career material");
    expect((await getAdminCase(assessmentId)).assessment.email).toBe("buyer@example.com");
    expect(accessToken).toBeTruthy();
  });

  it("manual delete removes answers, reports, and customer access", async () => {
    const { assessmentId } = await submittedWithAnswer();
    await runAnalysisPipeline(assessmentId);
    const delivery = await approveAssessment(assessmentId);
    expect((await getDeliveredReport(delivery.reportToken))?.sections.length).toBeGreaterThan(0);

    await deleteAssessmentData(assessmentId);

    expect(await getDeliveredReport(delivery.reportToken)).toBeUndefined();
    expect((await getAdminCase(assessmentId)).assessment.answers).toEqual({});
    expect((await getAdminCase(assessmentId)).draft).toBeUndefined();
    expect(JSON.stringify(await getAdminCase(assessmentId))).not.toContain("secret career material");
  });

  it("does not purge assessments that are still inside the retention window", async () => {
    const { assessmentId } = await submittedWithAnswer();
    expect(await purgeExpiredAssessments()).toBe(0);
    expect((await getAdminCase(assessmentId)).assessment.answers["Q1.1"]).toBe("secret career material");
  });
});
