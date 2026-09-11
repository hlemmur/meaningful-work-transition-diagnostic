"use server";

import { redirect } from "next/navigation";
import {
  approveAssessment,
  completeMockPurchase,
  saveAnswer,
  submitAssessment,
} from "./service";

export async function completePurchaseAction() {
  await completeMockPurchase("buyer@example.com");
  redirect("/mock/outbox");
}

export async function saveAnswerAction(token: string, formData: FormData) {
  await saveAnswer(token, "Q1.1", String(formData.get("answer") ?? ""));
  redirect(`/a/${token}?saved=1`);
}

export async function submitAssessmentAction(token: string) {
  await submitAssessment(token);
  redirect(`/a/${token}?submitted=1`);
}

export async function approveAssessmentAction(assessmentId: string) {
  await approveAssessment(assessmentId);
  redirect("/mock/outbox");
}
