import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMockOutbox } from "../adapters/resend/mock";
import { isAllowlistedAdmin } from "../admin/allowlist";
import {
  approveAssessment,
  completeMockPurchase,
  deleteReportAccess,
  getAssessmentByAccessToken,
  getAssessmentByReportToken,
  getDeliveredReport,
  listReviewQueueView,
  recordWelcomeConsent,
  resetMockTracerStore,
  resendReportLink,
  runAnalysisPipeline,
  saveAnswer,
  saveReportEdits,
  submitAssessment,
} from "./service";

async function submitted() {
  const purchase = await completeMockPurchase("buyer@example.com");
  await recordWelcomeConsent({
    accessToken: purchase.accessToken,
    productConsent: true,
    marketingOptIn: false,
  });
  await saveAnswer(purchase.accessToken, "Q1.1", "I left a career that still pays my bills.");
  await submitAssessment(purchase.accessToken);
  return purchase;
}

beforeEach(async () => {
  process.env.APP_MODE = "mock";
});

afterEach(async () => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  await resetMockTracerStore();
});

describe("Lena review and private delivery", () => {
  it("keeps unapproved drafts off the customer report token", async () => {
    const { accessToken, assessmentId } = await submitted();
    expect(await getAssessmentByReportToken(accessToken)).toBeUndefined();
    expect(await getDeliveredReport(accessToken)).toBeUndefined();
    expect((await getAssessmentByAccessToken(accessToken))?.status).toBe("review_pending");
    expect(assessmentId).toBeTruthy();
  });

  it("emails only the private link on approve and shows edited sections after delivery", async () => {
    process.env.APP_MODE = "mock";
    const { assessmentId } = await submitted();
    await runAnalysisPipeline(assessmentId);
    await saveReportEdits(assessmentId, [
      {
        id: "problem",
        title: "The problem as you see it",
        body: "Edited hypothesis language only.",
        evidenceRefs: [`${assessmentId}:Q1.1`],
      },
    ]);
    const delivery = await approveAssessment(assessmentId);
    expect(delivery.reportEmail.text).toContain(`/r/${delivery.reportToken}`);
    expect(delivery.reportEmail.text).not.toContain("Edited hypothesis language only.");
    const delivered = await getDeliveredReport(delivery.reportToken);
    expect(delivered?.sections[0]?.body).toBe("Edited hypothesis language only.");
  });

  it("resends a link without report text and delete removes customer access", async () => {
    process.env.APP_MODE = "mock";
    const { assessmentId } = await submitted();
    await runAnalysisPipeline(assessmentId);
    const first = await approveAssessment(assessmentId);
    const resent = await resendReportLink(assessmentId);
    expect(resent.reportEmail.text).toContain(`/r/${resent.reportToken}`);
    expect(resent.reportEmail.text).not.toContain("structure is being asked");
    expect(await getDeliveredReport(first.reportToken)).toBeUndefined();
    expect((await getDeliveredReport(resent.reportToken))?.sections.length).toBeGreaterThan(0);
    await deleteReportAccess(assessmentId);
    expect(await getDeliveredReport(resent.reportToken)).toBeUndefined();
  });

  it("restricts admin login to the allowlist", () => {
    expect(isAllowlistedAdmin("lena@example.com")).toBe(true);
    expect(isAllowlistedAdmin("stranger@example.com")).toBe(false);
  });

  it("does not treat the assessment token as a report token after approve", async () => {
    const purchase = await submitted();
    await runAnalysisPipeline(purchase.assessmentId);
    const delivery = await approveAssessment(purchase.assessmentId);
    expect(await getDeliveredReport(purchase.accessToken)).toBeUndefined();
    expect((await getDeliveredReport(delivery.reportToken))?.sections.length).toBeGreaterThan(0);
  });

  it("expires the private report link", async () => {
    const { assessmentId } = await submitted();
    await runAnalysisPipeline(assessmentId);
    process.env.ACCESS_TOKEN_TTL_MS = "1";
    const delivery = await approveAssessment(assessmentId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await getDeliveredReport(delivery.reportToken)).toBeUndefined();
    delete process.env.ACCESS_TOKEN_TTL_MS;
  });

  it("surfaces safety and analysis status in the review queue", async () => {
    const { assessmentId } = await submitted();
    expect(await listReviewQueueView()).toEqual([
      expect.objectContaining({
        id: assessmentId,
        status: "review_pending",
        safetyLevel: "none",
        analysisStatus: "not started",
      }),
    ]);
    await runAnalysisPipeline(assessmentId);
    expect((await listReviewQueueView())[0]?.analysisStatus).toBe("completed");
  });

  it("rejects approve before analysis completes and edits after delivery", async () => {
    const { assessmentId } = await submitted();
    await expect(approveAssessment(assessmentId)).rejects.toThrow("Analysis must complete");
    await runAnalysisPipeline(assessmentId);
    const delivery = await approveAssessment(assessmentId);
    await expect(
      saveReportEdits(assessmentId, [
        {
          id: "problem",
          title: "The problem as you see it",
          body: "Silent rewrite after delivery.",
          evidenceRefs: [`${assessmentId}:Q1.1`],
        },
      ]),
    ).rejects.toThrow("Approved reports cannot be edited");
    expect((await getDeliveredReport(delivery.reportToken))?.sections[0]?.body).not.toBe(
      "Silent rewrite after delivery.",
    );
  });
});
