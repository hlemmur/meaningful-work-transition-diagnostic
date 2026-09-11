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
  runAnalysisPipeline,
  runAssessmentCheckpoint,
  listCaseStateVersions,
  listAdaptiveQuestions,
  exportMarketingContacts,
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

  it("stores structured answers per question id and locks them after submit", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();

    await saveAnswer(accessToken, "Q2.3", [{ action: "Send the website" }]);
    await saveAnswer(accessToken, "Q0.1", "other");
    const resumed = getAssessmentByAccessToken(accessToken);

    expect(resumed?.answers["Q2.3"]).toEqual([{ action: "Send the website" }]);
    expect(resumed?.answers["Q0.1"]).toBe("other");

    await expect(saveAnswer(accessToken, "not-a-question", "nope")).rejects.toThrow(
      "Unknown question",
    );
    await expect(saveAnswer(accessToken, "Q1.1", { blob: true })).rejects.toThrow(
      "Invalid answer",
    );

    await submitAssessment(accessToken);
    await expect(saveAnswer(accessToken, "Q0.1", "employed_considering")).rejects.toThrow(
      "Answers are locked after submit",
    );
  });

  it("stores a checkpoint snapshot and a history follow-up", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken, assessmentId } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "I left a career that still pays my bills.");
    await saveAnswer(accessToken, "Q1.3", "I lack confidence.");
    await saveAnswer(accessToken, "Q2.2", "I rewrote the website twice.");

    const result = await runAssessmentCheckpoint(accessToken, "A");

    expect(result.adaptiveQuestion?.forkId).toBe("history_vs_stated_cause");
    expect(listAdaptiveQuestions(assessmentId)).toHaveLength(1);
    expect(listCaseStateVersions(assessmentId)[0]?.stage).toBe("checkpoint-A");
    await saveAnswer(accessToken, result.adaptiveQuestion!.id, "The website still did not ship.");
  });

  it("keeps safety flags out of marketing export", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();
    await saveAnswer(
      accessToken,
      "Q0.5",
      "I have suicidal thoughts and cannot function.",
    );

    const result = await runAssessmentCheckpoint(accessToken, "A");
    await recordWelcomeConsent({
      accessToken,
      productConsent: true,
      marketingOptIn: true,
    });
    expect(result.safetyLevel).toBe("high");
    expect(result.adaptiveQuestion).toBeNull();
    expect(exportMarketingContacts()[0]?.email).toBe("buyer@example.com");
    expect(JSON.stringify(exportMarketingContacts())).not.toMatch(/suicid|cannot function/i);
  });

  it("approves a submitted draft and emails a report link without report body", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken, assessmentId } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "The stall survived every plan I wrote.");
    await submitAssessment(accessToken);
    await runAnalysisPipeline(assessmentId);

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
    await runAnalysisPipeline(assessmentId);
    const delivery = await approveAssessment(assessmentId);

    await expect(submitAssessment(accessToken)).rejects.toThrow("Assessment already submitted");

    const report = getAssessmentByReportToken(delivery.reportToken);
    expect(report?.status).toBe("approved");
  });
});
