import { afterEach, describe, expect, it, vi } from "vitest";
import { listVisibleQuestionIds } from "@/questionnaire/branching";
import { resetMockOutbox } from "../adapters/resend/mock";
import {
  approveAssessment,
  completeMockPurchase,
  completePaidOrder,
  getAssessmentByAccessToken,
  getAssessmentByReportToken,
  recordWelcomeConsent,
  resetMockTracerStore,
  restoreMockSubmittedCase,
  exportMockTracerStore,
  importMockTracerStore,
  invalidateAnalysisFromStage,
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

afterEach(async () => {
  process.env.APP_MODE = "mock";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetMockOutbox();
  vi.unstubAllGlobals();
  await resetMockTracerStore();
});

describe("mock purchase-to-report tracer", () => {
  it("creates a token-protected assessment and emails only the access link", async () => {
    process.env.APP_MODE = "mock";
    const purchase = await completeMockPurchase("buyer@example.com");
    const assessment = await getAssessmentByAccessToken(purchase.accessToken);

    expect(assessment?.status).toBe("in_progress");
    expect(purchase.accessEmail.text).toContain(`/a/${purchase.accessToken}`);
    expect(purchase.accessEmail.text).not.toContain(purchase.accessTokenHash);
  });

  it("saves an answer that survives a later read (resume)", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();

    await saveAnswer(accessToken, "Q1.1", "I left a career that still pays my bills.");
    const resumed = await getAssessmentByAccessToken(accessToken);

    expect(resumed?.answers["Q1.1"]).toBe("I left a career that still pays my bills.");
  });

  it("stores structured answers per question id and locks them after submit", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();

    await saveAnswer(accessToken, "Q2.3", [{ action: "Send the website" }]);
    await saveAnswer(accessToken, "Q0.1", "other");
    const resumed = await getAssessmentByAccessToken(accessToken);

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
    expect(await listAdaptiveQuestions(assessmentId)).toHaveLength(1);
    expect((await listCaseStateVersions(assessmentId))[0]?.stage).toBe("checkpoint-A");
    await saveAnswer(accessToken, result.adaptiveQuestion!.id, "The website still did not ship.");
  });

  it("does not clear a prior high safety flag when a later checkpoint LLM fails", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "The stall survived every plan I wrote.");

    const snapshot = await exportMockTracerStore();
    const assessment = snapshot.assessments[0];
    expect(assessment).toBeDefined();
    assessment!.safetyLevel = "high";
    assessment!.reportDepth = "reduced";
    await importMockTracerStore(snapshot);

    await saveAnswer(
      accessToken,
      "Q1.1",
      "FORCE_LLM_FAILURE the stall survived every plan I wrote.",
    );

    const result = await runAssessmentCheckpoint(accessToken, "B");
    const resumed = await getAssessmentByAccessToken(accessToken);

    expect(result.safetyLevel).toBe("high");
    expect(result.reportDepth).toBe("reduced");
    expect(result.adaptiveQuestion).toBeNull();
    expect(result.supportCopy).toBeTruthy();
    expect(resumed?.safetyLevel).toBe("high");
    expect(resumed?.reportDepth).toBe("reduced");
    expect(listVisibleQuestionIds(resumed?.answers ?? {}, resumed?.safetyLevel ?? "none")).not.toContain(
      "Q9.3",
    );
    expect(listVisibleQuestionIds(resumed?.answers ?? {}, resumed?.safetyLevel ?? "none")).not.toContain(
      "Q10.6",
    );
  });

  it("still allows a later checkpoint when safety was never high", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "FORCE_LLM_FAILURE the stall survived.");

    const result = await runAssessmentCheckpoint(accessToken, "B");
    const resumed = await getAssessmentByAccessToken(accessToken);

    expect(result.safetyLevel).toBe("none");
    expect(result.reportDepth).toBe("full");
    expect(result.adaptiveQuestion).toBeNull();
    expect(resumed?.safetyLevel ?? "none").toBe("none");
    expect(listVisibleQuestionIds(resumed?.answers ?? {}, resumed?.safetyLevel ?? "none")).toContain(
      "Q9.3",
    );
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
    expect((await exportMarketingContacts())[0]?.email).toBe("buyer@example.com");
    expect(JSON.stringify(await exportMarketingContacts())).not.toMatch(/suicid|cannot function/i);
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
    expect(delivery.draftBody).toMatch(/working formulation|provisional|test/i);
    expect(delivery.draftBody).not.toMatch(/structure.*aliveness|container.*freedom/i);
  });

  it("rejects re-submit after approval and keeps the report token valid", async () => {
    process.env.APP_MODE = "mock";
    const { accessToken, assessmentId } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "The stall survived every plan I wrote.");
    await submitAssessment(accessToken);
    await runAnalysisPipeline(assessmentId);
    const delivery = await approveAssessment(assessmentId);

    await expect(submitAssessment(accessToken)).rejects.toThrow("Assessment already submitted");

    const report = await getAssessmentByReportToken(delivery.reportToken);
    expect(report?.status).toBe("approved");
  });

  it("emails an access link after a live paid order without a mock outbox", async () => {
    process.env.APP_MODE = "live";
    process.env.RESEND_API_KEY = "re-test";
    process.env.RESEND_FROM = "Lena <reports@example.com>";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 })),
    );

    const paid = await completePaidOrder({
      email: "buyer@example.com",
      lemonOrderId: "live-order-1",
      lemonWebhookId: "live-wh-1",
    });

    expect(paid.created).toBe(true);
    expect(paid.accessEmail?.text).toContain(`/a/${paid.accessToken}`);
    expect(paid.accessEmail?.text).not.toContain("report");
  });
});

describe("restoreMockSubmittedCase", () => {
  it("reloads a submitted case so the same access token can resume analysis", async () => {
    process.env.APP_MODE = "mock";
    const restored = await restoreMockSubmittedCase({
      assessmentId: "restore-case-1",
      accessToken: "restore-token-1",
      email: "buyer@example.com",
      answers: { "Q1.1": "kept after restart" },
    });

    expect(restored).toEqual({ assessmentId: "restore-case-1" });
    const assessment = await getAssessmentByAccessToken("restore-token-1");
    expect(assessment?.status).toBe("review_pending");
    expect(assessment?.answers["Q1.1"]).toBe("kept after restart");
    expect(assessment?.productConsentVersion).toBeTruthy();
  });

  it("exports and reimports analysis runs so resume can skip completed passes", async () => {
    process.env.APP_MODE = "mock";
    const { assessmentId, accessToken } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "kept after restart");
    const snapshot = await exportMockTracerStore();
    snapshot.analysisRuns = [
      {
        assessmentId,
        stage: "pass1",
        attempt: 1,
        promptVersion: "test",
        model: "mock-cheap",
        status: "success",
        idempotencyKey: "pass1",
      },
    ];
    await resetMockTracerStore();
    expect(await getAssessmentByAccessToken(accessToken)).toBeUndefined();

    const summary = await importMockTracerStore(snapshot);
    expect(summary).toEqual(
      expect.objectContaining({ assessmentCount: 1, runCount: 1 }),
    );
    const restored = await getAssessmentByAccessToken(accessToken);
    expect(restored?.answers["Q1.1"]).toBe("kept after restart");
    const exported = await exportMockTracerStore();
    expect(exported.analysisRuns.map((run) => run.stage)).toEqual(["pass1"]);
  });

  it("clears completed passes from a stage so resume can regenerate the draft", async () => {
    process.env.APP_MODE = "mock";
    const { assessmentId, accessToken } = await purchaseWithConsent();
    await saveAnswer(accessToken, "Q1.1", "structure is the issue");
    await importMockTracerStore({
      ...(await exportMockTracerStore()),
      analysisRuns: [
        {
          assessmentId,
          stage: "pass8",
          attempt: 1,
          promptVersion: "test",
          model: "mock-cheap",
          status: "success",
          idempotencyKey: "pass8",
        },
        {
          assessmentId,
          stage: "pass9",
          attempt: 1,
          promptVersion: "test",
          model: "mock-strong",
          status: "success",
          idempotencyKey: "pass9",
        },
      ],
      reports: [
        {
          assessmentId,
          engineVersion: "engine.v2",
          status: "draft",
          sections: [
            {
              id: "problem",
              title: "The problem",
              body: "thin",
              evidenceRefs: [`${assessmentId}:Q1.1`],
            },
          ],
        },
      ],
    });

    const cleared = await invalidateAnalysisFromStage(assessmentId, "pass9");
    expect(cleared.clearedStages).toEqual(["pass9", "pass10"]);
    const exported = await exportMockTracerStore();
    expect(exported.analysisRuns.map((run) => run.stage)).toEqual(["pass8"]);
    expect(exported.reports).toEqual([]);
    expect(await getAssessmentByAccessToken(accessToken)).toBeTruthy();
  });

  it("refuses to write when a durable store is configured", async () => {
    process.env.APP_MODE = "mock";
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    await expect(
      restoreMockSubmittedCase({
        accessToken: "restore-token-2",
        email: "buyer@example.com",
        answers: { "Q1.1": "no" },
      }),
    ).rejects.toThrow("Not found");
  });
});
