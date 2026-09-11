import type { AnalysisRunRecord } from "@/engine/pipeline/run";
import type { Report } from "@/engine/schemas/analysis";
import type { ForkId } from "@/engine/schemas/analysis";
import type { SafetyFlag } from "@/engine/schemas/evidence";
import type { ExistingAdaptiveQuestion } from "@/engine/checkpoints/schema";
import type { CaseState } from "@/engine/schemas/case-state";

export type AssessmentStatus = "in_progress" | "review_pending" | "approved";

export type AssessmentRecord = {
  id: string;
  email: string;
  accessTokenHash: string;
  accessExpiresAt: number;
  status: AssessmentStatus;
  answers: Record<string, unknown>;
  draftBody?: string;
  reportAccessTokenHash?: string;
  reportAccessExpiresAt?: number;
  productConsentVersion?: string;
  productConsentedAt?: string;
  safetyLevel?: "none" | "high";
  reportDepth?: "full" | "reduced";
  retentionDeadline?: number;
};

export type AdaptiveQuestionRecord = ExistingAdaptiveQuestion & {
  assessmentId: string;
  rationale: string;
};

export type CaseStateVersionRecord = {
  assessmentId: string;
  stage: string;
  snapshot: CaseState;
  createdAt: string;
};

export type SafetyFlagRecord = SafetyFlag & {
  assessmentId: string;
};

export type PurchaseRecord = {
  id: string;
  lemonOrderId: string;
  lemonWebhookId: string;
  email: string;
  assessmentId: string;
};

export type MarketingConsentRecord = {
  email: string;
  consented: boolean;
  consentCopyVersion: string;
  source: string;
  consentedAt?: string;
  withdrawnAt?: string;
};

export type ReportRecord = Report & {
  status: "draft" | "approved" | "deleted";
  editedSections?: Report["sections"];
};

export type TracerStore = {
  assessments: AssessmentRecord[];
  purchases: PurchaseRecord[];
  marketingConsents: MarketingConsentRecord[];
  adaptiveQuestions: AdaptiveQuestionRecord[];
  caseStateVersions: CaseStateVersionRecord[];
  safetyFlags: SafetyFlagRecord[];
  analysisRuns: AnalysisRunRecord[];
  reports: ReportRecord[];
};

export function createEmptyTracerStore(): TracerStore {
  return {
    assessments: [],
    purchases: [],
    marketingConsents: [],
    adaptiveQuestions: [],
    caseStateVersions: [],
    safetyFlags: [],
    analysisRuns: [],
    reports: [],
  };
}

export type ForkIdRecord = ForkId;
