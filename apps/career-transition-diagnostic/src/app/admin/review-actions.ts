"use server";

import { redirect } from "next/navigation";
import { afterDeliveryPath } from "@/config/app-mode";
import { reportSectionIdSchema } from "@/engine/schemas/analysis";
import { requireAdminSession } from "@/server/admin/session";
import {
  approveAssessment,
  deleteAssessmentData,
  resendReportLink,
  runAnalysisPipeline,
  saveReportEdits,
} from "@/server/tracer/service";

export async function runAnalysisFromAdminAction(assessmentId: string) {
  await requireAdminSession();
  await runAnalysisPipeline(assessmentId);
  redirect(`/admin/${assessmentId}`);
}

export async function saveEditsAction(assessmentId: string, formData: FormData) {
  await requireAdminSession();
  const count = Number(formData.get("count") ?? 0);
  const sections = Array.from({ length: count }, (_, index) => ({
    id: reportSectionIdSchema.parse(String(formData.get(`id-${index}`) ?? "")),
    title: String(formData.get(`title-${index}`) ?? ""),
    body: String(formData.get(`body-${index}`) ?? ""),
    evidenceRefs: String(formData.get(`refs-${index}`) ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  }));
  await saveReportEdits(assessmentId, sections);
  redirect(`/admin/${assessmentId}?saved=1`);
}

export async function approveAndDeliverAction(assessmentId: string) {
  await requireAdminSession();
  await approveAssessment(assessmentId);
  redirect(afterDeliveryPath());
}

export async function resendLinkAction(assessmentId: string) {
  await requireAdminSession();
  await resendReportLink(assessmentId);
  redirect(afterDeliveryPath());
}

export async function deleteAccessAction(assessmentId: string) {
  await requireAdminSession();
  await deleteAssessmentData(assessmentId);
  redirect("/admin");
}
