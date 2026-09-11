"use server";

import { redirect } from "next/navigation";
import { afterDeliveryPath, assertMockMode } from "@/config/app-mode";
import { requireAdminSession } from "@/server/admin/session";
import {
  approveAssessment,
  completeMockPurchase,
  recordWelcomeConsent,
  requestNewAccessLink,
  runAssessmentCheckpoint,
  saveAnswer,
  submitAssessment,
  runAnalysisPipeline,
} from "./service";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";

export async function completePurchaseAction() {
  assertMockMode("Mock purchase");
  await completeMockPurchase("buyer@example.com");
  redirect("/mock/outbox");
}

export async function runCheckpointAction(token: string, checkpoint: AdaptiveCheckpoint) {
  return runAssessmentCheckpoint(token, checkpoint);
}

export async function autosaveAnswerAction(
  token: string,
  questionId: string,
  encodedValue: string,
) {
  await saveAnswer(token, questionId, JSON.parse(encodedValue));
  return { ok: true as const };
}

export async function submitAssessmentAction(token: string) {
  await submitAssessment(token);
  redirect(`/a/${token}?submitted=1`);
}

export async function approveAssessmentAction(assessmentId: string) {
  await requireAdminSession();
  await approveAssessment(assessmentId);
  redirect(afterDeliveryPath());
}

export async function recordConsentAction(token: string, formData: FormData) {
  await recordWelcomeConsent({
    accessToken: token,
    productConsent: formData.get("productConsent") === "on",
    marketingOptIn: formData.get("marketingOptIn") === "on",
  });
  redirect(`/a/${token}`);
}

export async function requestNewLinkAction(formData: FormData) {
  const expiredToken = String(formData.get("expiredToken") ?? "");
  await requestNewAccessLink(expiredToken);
  redirect("/link-requested");
}

export async function runAnalysisAction(assessmentId: string) {
  await requireAdminSession();
  return runAnalysisPipeline(assessmentId);
}
