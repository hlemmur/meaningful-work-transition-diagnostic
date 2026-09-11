"use server";

import { redirect } from "next/navigation";
import {
  approveAssessment,
  completeMockPurchase,
  recordWelcomeConsent,
  requestNewAccessLink,
  saveAnswer,
  submitAssessment,
} from "./service";

export async function completePurchaseAction() {
  await completeMockPurchase("buyer@example.com");
  redirect("/mock/outbox");
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
  await approveAssessment(assessmentId);
  redirect("/mock/outbox");
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
  const email = String(formData.get("email") ?? "");
  await requestNewAccessLink(email);
  redirect("/mock/outbox");
}
