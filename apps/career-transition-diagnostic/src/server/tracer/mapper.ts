import { randomUUID } from "node:crypto";
import type { AnalysisRunRecord } from "@/engine/pipeline/run";
import type { AnalysisStage } from "@/engine/pipeline/models";
import { caseStateSchema } from "@/engine/schemas/case-state";
import type { ForkId } from "@/engine/schemas/analysis";
import type { Report } from "@/engine/schemas/analysis";
import {
  createEmptyTracerStore,
  type AdaptiveQuestionRecord,
  type AssessmentRecord,
  type AssessmentStatus,
  type MarketingConsentRecord,
  type PurchaseRecord,
  type ReportRecord,
  type TracerStore,
} from "./records";

export function lastRunsByIdempotencyKey<T extends { idempotencyKey: string }>(
  runs: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const run of runs) {
    byKey.set(run.idempotencyKey, run);
  }
  return [...byKey.values()];
}

export function uniqueIdempotencyKey(
  existing: Iterable<{ idempotencyKey: string }>,
  key: string,
): string {
  const taken = new Set(
    [...existing].map((item) => item.idempotencyKey),
  );
  if (!taken.has(key)) {
    return key;
  }
  return `${key}:${randomUUID()}`;
}

export const TRACER_TABLES = [
  "purchases",
  "marketing_consents",
  "assessments",
  "assessment_answers",
  "adaptive_questions",
  "case_state_versions",
  "analysis_runs",
  "reports",
  "safety_flags",
] as const;

export type TracerTableName = (typeof TRACER_TABLES)[number];

export type TracerTables = Record<TracerTableName, Record<string, unknown>[]>;

export function createEmptyTables(): TracerTables {
  return {
    purchases: [],
    marketing_consents: [],
    assessments: [],
    assessment_answers: [],
    adaptive_questions: [],
    case_state_versions: [],
    analysis_runs: [],
    reports: [],
    safety_flags: [],
  };
}

function isoFromMs(value?: number) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function msFromIso(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function storeToTables(store: TracerStore): TracerTables {
  const tables = createEmptyTables();
  const purchaseIdByAssessment = new Map(
    store.purchases.map((purchase) => [purchase.assessmentId, purchase.id]),
  );

  for (const purchase of store.purchases) {
    tables.purchases.push({
      id: purchase.id,
      lemon_order_id: purchase.lemonOrderId,
      lemon_webhook_id: purchase.lemonWebhookId,
      email: purchase.email,
      status: "paid",
      raw_payload: null,
    });
  }

  for (const consent of store.marketingConsents) {
    tables.marketing_consents.push({
      id: randomUUID(),
      email: consent.email,
      consented: consent.consented,
      consent_copy_version: consent.consentCopyVersion,
      source: consent.source,
      consented_at: consent.consentedAt ?? null,
      withdrawn_at: consent.withdrawnAt ?? null,
      sync_status: "unsynced",
    });
  }

  for (const assessment of store.assessments) {
    tables.assessments.push({
      id: assessment.id,
      purchase_id: purchaseIdByAssessment.get(assessment.id) ?? null,
      status: assessment.status,
      access_token_hash: assessment.accessTokenHash,
      access_expires_at: new Date(assessment.accessExpiresAt).toISOString(),
      progress: { draftBody: assessment.draftBody ?? null },
      product_consent_version: assessment.productConsentVersion ?? null,
      product_consented_at: assessment.productConsentedAt ?? null,
      safety_level: assessment.safetyLevel ?? "none",
      report_depth: assessment.reportDepth ?? "full",
      retention_deadline: isoFromMs(assessment.retentionDeadline),
      email: assessment.email,
      report_access_token_hash: assessment.reportAccessTokenHash ?? null,
      report_access_expires_at: isoFromMs(assessment.reportAccessExpiresAt),
    });

    for (const [questionId, answer] of Object.entries(assessment.answers)) {
      tables.assessment_answers.push({
        id: randomUUID(),
        assessment_id: assessment.id,
        question_id: questionId,
        answer,
      });
    }
  }

  for (const question of store.adaptiveQuestions) {
    tables.adaptive_questions.push({
      id: randomUUID(),
      assessment_id: question.assessmentId,
      checkpoint: question.checkpoint,
      origin_fork: question.forkId,
      question_id: question.id,
      question_text: question.questionText,
      answer: question.answer ?? null,
      rationale: question.rationale,
    });
  }

  for (const version of store.caseStateVersions) {
    tables.case_state_versions.push({
      id: randomUUID(),
      assessment_id: version.assessmentId,
      stage: version.stage,
      snapshot: version.snapshot,
      created_at: version.createdAt,
    });
  }

  for (const run of lastRunsByIdempotencyKey(store.analysisRuns)) {
    tables.analysis_runs.push({
      id: randomUUID(),
      assessment_id: run.assessmentId,
      stage: run.stage,
      attempt: run.attempt,
      prompt_version: run.promptVersion,
      model: run.model,
      status: run.status,
      token_usage: run.tokenUsage ?? null,
      cost_usd: run.costUsd ?? null,
      error: run.error ?? null,
      idempotency_key: run.idempotencyKey,
      output: run.output ?? null,
      created_at: run.createdAt ?? new Date().toISOString(),
    });
  }

  for (const report of store.reports) {
    tables.reports.push({
      id: randomUUID(),
      assessment_id: report.assessmentId,
      generated_json: {
        assessmentId: report.assessmentId,
        engineVersion: report.engineVersion,
        sections: report.sections,
      },
      edited_content: report.editedSections ?? null,
      status: report.status,
      access_token_hash:
        store.assessments.find((item) => item.id === report.assessmentId)?.reportAccessTokenHash ??
        null,
      access_expires_at: isoFromMs(
        store.assessments.find((item) => item.id === report.assessmentId)?.reportAccessExpiresAt,
      ),
    });
  }

  for (const flag of store.safetyFlags) {
    tables.safety_flags.push({
      id: randomUUID(),
      assessment_id: flag.assessmentId,
      flag_type: flag.type,
      severity: flag.severity,
      evidence_refs: flag.evidenceRefs,
      handling_instruction: flag.handlingInstruction ?? null,
    });
  }

  return tables;
}

export function tablesToStore(tables: TracerTables): TracerStore {
  const store = createEmptyTracerStore();
  const assessmentsByPurchase = new Map<string, string>();

  for (const row of tables.assessments) {
    const id = String(row.id);
    const purchaseId = row.purchase_id ? String(row.purchase_id) : "";
    if (purchaseId) {
      assessmentsByPurchase.set(purchaseId, id);
    }
    const progress = (row.progress ?? {}) as { draftBody?: string | null };
    const answers: Record<string, unknown> = {};
    for (const answer of tables.assessment_answers.filter((item) => String(item.assessment_id) === id)) {
      answers[String(answer.question_id)] = answer.answer;
    }
    const assessment: AssessmentRecord = {
      id,
      email: String(row.email ?? ""),
      accessTokenHash: String(row.access_token_hash),
      accessExpiresAt: msFromIso(row.access_expires_at) ?? Date.now(),
      status: row.status as AssessmentStatus,
      answers,
      draftBody: progress.draftBody ?? undefined,
      reportAccessTokenHash: row.report_access_token_hash
        ? String(row.report_access_token_hash)
        : undefined,
      reportAccessExpiresAt: msFromIso(row.report_access_expires_at),
      productConsentVersion: row.product_consent_version
        ? String(row.product_consent_version)
        : undefined,
      productConsentedAt: row.product_consented_at ? String(row.product_consented_at) : undefined,
      safetyLevel: (row.safety_level as AssessmentRecord["safetyLevel"]) ?? "none",
      reportDepth: (row.report_depth as AssessmentRecord["reportDepth"]) ?? "full",
      retentionDeadline: msFromIso(row.retention_deadline),
    };
    store.assessments.push(assessment);
  }

  for (const row of tables.purchases) {
    const id = String(row.id);
    const purchase: PurchaseRecord = {
      id,
      lemonOrderId: String(row.lemon_order_id),
      lemonWebhookId: String(row.lemon_webhook_id ?? row.lemon_order_id),
      email: String(row.email),
      assessmentId: assessmentsByPurchase.get(id) ?? "",
    };
    store.purchases.push(purchase);
  }

  for (const row of tables.marketing_consents) {
    const consent: MarketingConsentRecord = {
      email: String(row.email),
      consented: Boolean(row.consented),
      consentCopyVersion: String(row.consent_copy_version),
      source: String(row.source),
      consentedAt: row.consented_at ? String(row.consented_at) : undefined,
      withdrawnAt: row.withdrawn_at ? String(row.withdrawn_at) : undefined,
    };
    store.marketingConsents.push(consent);
  }

  for (const row of tables.adaptive_questions) {
    const question: AdaptiveQuestionRecord = {
      id: String(row.question_id ?? row.id),
      assessmentId: String(row.assessment_id),
      checkpoint: row.checkpoint as AdaptiveQuestionRecord["checkpoint"],
      forkId: row.origin_fork as ForkId,
      questionText: String(row.question_text),
      answer: row.answer ?? undefined,
      rationale: String(row.rationale ?? ""),
    };
    store.adaptiveQuestions.push(question);
  }

  for (const row of tables.case_state_versions) {
    store.caseStateVersions.push({
      assessmentId: String(row.assessment_id),
      stage: String(row.stage),
      snapshot: caseStateSchema.parse(row.snapshot),
      createdAt: String(row.created_at),
    });
  }

  for (const row of tables.analysis_runs) {
    const run: AnalysisRunRecord = {
      assessmentId: String(row.assessment_id),
      stage: row.stage as AnalysisStage,
      attempt: Number(row.attempt ?? 1),
      promptVersion: String(row.prompt_version ?? ""),
      model: String(row.model ?? ""),
      status: row.status as AnalysisRunRecord["status"],
      tokenUsage: (row.token_usage as AnalysisRunRecord["tokenUsage"]) ?? undefined,
      costUsd: row.cost_usd === null || row.cost_usd === undefined ? undefined : Number(row.cost_usd),
      error: row.error ? String(row.error) : undefined,
      idempotencyKey: String(row.idempotency_key),
      output: row.output ?? undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
    };
    store.analysisRuns.push(run);
  }

  for (const row of tables.reports) {
    const generated = (row.generated_json ?? {}) as Partial<Report>;
    const report: ReportRecord = {
      assessmentId: String(row.assessment_id),
      engineVersion: generated.engineVersion === "engine.v2" ? "engine.v2" : "engine.v2",
      sections: generated.sections ?? [],
      status: row.status as ReportRecord["status"],
      editedSections: (row.edited_content as Report["sections"] | null) ?? undefined,
    };
    store.reports.push(report);
    const assessment = store.assessments.find((item) => item.id === report.assessmentId);
    if (assessment && row.access_token_hash && !assessment.reportAccessTokenHash) {
      assessment.reportAccessTokenHash = String(row.access_token_hash);
      assessment.reportAccessExpiresAt = msFromIso(row.access_expires_at);
    }
  }

  for (const row of tables.safety_flags) {
    store.safetyFlags.push({
      assessmentId: String(row.assessment_id),
      type: String(row.flag_type),
      severity: row.severity as "low" | "moderate" | "high",
      evidenceRefs: Array.isArray(row.evidence_refs) ? (row.evidence_refs as string[]) : [],
      handlingInstruction: row.handling_instruction ? String(row.handling_instruction) : undefined,
    });
  }

  return store;
}
