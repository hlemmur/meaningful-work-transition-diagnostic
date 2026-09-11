import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getQuestion } from "@/questionnaire/questionnaire.v2";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";
import { createVendorAdapters } from "../adapters";
import type { OutboxEmail } from "../adapters/types";
import { runCheckpoint } from "@/engine/checkpoints/run";
import { isAdaptiveQuestionId } from "@/engine/checkpoints/schema";
import { SUPPORT_COPY } from "@/engine/checkpoints/bank";
import { executeAnalysis, type AnalysisPipelineResult } from "@/engine/pipeline/run";
import type { AnalysisFixture } from "@/engine/pipeline/fixtures";
import type { AnalysisStage } from "@/engine/pipeline/models";
import type { ForkId } from "@/engine/schemas/analysis";
import {
  MARKETING_CONSENT_COPY_VERSION,
  PRODUCT_CONSENT_COPY_VERSION,
  type MarketingContact,
  type WelcomeConsentInput,
} from "../consent/copy";
import { retentionMs } from "@/config/launch-gate";
import { getActiveStore, getRepository, withStore } from "./repository";
import type { AssessmentRecord, MarketingConsentRecord } from "./records";

export type {
  AdaptiveQuestionRecord,
  AssessmentRecord,
  AssessmentStatus,
  CaseStateVersionRecord,
  MarketingConsentRecord,
  PurchaseRecord,
  ReportRecord,
  SafetyFlagRecord,
} from "./records";

const DRAFT_BODY =
  "A possible hidden position is that structure is being asked to serve aliveness.";

function accessTtlMs() {
  return Number(process.env.ACCESS_TOKEN_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);
}

function getStore() {
  return getActiveStore();
}

export async function resetMockTracerStore() {
  await getRepository().reset();
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(24).toString("hex");
}

function requireAssessmentByHash(hash: string) {
  const assessment = getStore().assessments.find((item) => item.accessTokenHash === hash);
  if (!assessment || assessment.accessExpiresAt <= Date.now()) {
    throw new Error("Assessment not found");
  }
  return assessment;
}

export async function inspectAccessToken(accessToken: string) {
  return withStore(() => inspectAccessTokenInStore(accessToken));
}

function inspectAccessTokenInStore(accessToken: string) {
  const assessment = getStore().assessments.find(
    (item) => item.accessTokenHash === hashToken(accessToken),
  );
  if (!assessment) {
    return "missing" as const;
  }
  if (assessment.accessExpiresAt <= Date.now()) {
    return "expired" as const;
  }
  return "valid" as const;
}

export async function getAssessmentByAccessToken(accessToken: string) {
  return withStore(() => {
    if (inspectAccessTokenInStore(accessToken) !== "valid") {
      return undefined;
    }
    return getStore().assessments.find((item) => item.accessTokenHash === hashToken(accessToken));
  });
}

export async function getAssessmentByReportToken(reportToken: string) {
  return withStore(() => {
    const assessment = getStore().assessments.find(
      (item) => item.reportAccessTokenHash === hashToken(reportToken),
    );
    if (!assessment || assessment.status !== "approved") {
      return undefined;
    }
    if (assessment.reportAccessExpiresAt && assessment.reportAccessExpiresAt <= Date.now()) {
      return undefined;
    }
    const report = getStore().reports.find((item) => item.assessmentId === assessment.id);
    if (report?.status === "deleted") {
      return undefined;
    }
    return assessment;
  });
}

function analysisStatusInStore(assessmentId: string) {
  const runs = getStore().analysisRuns.filter((item) => item.assessmentId === assessmentId);
  const successes = new Set(runs.filter((run) => run.status === "success").map((run) => run.stage));
  const failed = [...runs]
    .reverse()
    .find((run) => run.status === "failure" && !successes.has(run.stage));
  if (failed) {
    return { label: `failed at ${failed.stage}`, failedStage: failed.stage };
  }
  if (successes.has("pass10")) {
    return { label: "completed" as const, failedStage: undefined };
  }
  if (successes.size === 0) {
    return { label: "not started" as const, failedStage: undefined };
  }
  return { label: [...successes].at(-1) ?? "in progress", failedStage: undefined };
}

export async function analysisStatusFor(assessmentId: string) {
  return withStore(() => analysisStatusInStore(assessmentId));
}

export async function listReviewQueueView() {
  return withStore(() =>
    listReviewQueueInStore().map((assessment) => {
      const report = getStore().reports.find((item) => item.assessmentId === assessment.id);
      return {
        id: assessment.id,
        status: report?.status === "deleted" ? "deleted" : assessment.status,
        safetyLevel: assessment.safetyLevel ?? "none",
        analysisStatus: analysisStatusInStore(assessment.id).label,
      };
    }),
  );
}

export async function listReviewQueue() {
  return withStore(() => listReviewQueueInStore());
}

function listReviewQueueInStore() {
  return getStore().assessments.filter(
    (item) => item.status === "review_pending" || item.status === "approved",
  );
}

async function emailAccessLink(email: string, accessToken: string) {
  const adapters = createVendorAdapters();
  await adapters.email.send({
    to: email,
    subject: "Your assessment link",
    text: `Open your assessment: /a/${accessToken}`,
  });
  const accessEmail = adapters.email.listOutbox().at(-1);
  if (!accessEmail) {
    throw new Error("Access email was not recorded");
  }
  return accessEmail;
}

function createAssessment(email: string) {
  const accessToken = createToken();
  const assessment: AssessmentRecord = {
    id: randomUUID(),
    email,
    accessTokenHash: hashToken(accessToken),
    accessExpiresAt: Date.now() + accessTtlMs(),
    status: "in_progress",
    answers: {},
  };
  getStore().assessments.push(assessment);
  return { assessment, accessToken };
}

export async function completePaidOrder(input: {
  email: string;
  lemonOrderId: string;
  lemonWebhookId: string;
}) {
  return withStore(async () => {
    const existing = getStore().purchases.find((item) => item.lemonOrderId === input.lemonOrderId);
    if (existing) {
      return {
        assessmentId: existing.assessmentId,
        created: false,
      };
    }

    const { assessment, accessToken } = createAssessment(input.email);
    getStore().purchases.push({
      id: randomUUID(),
      lemonOrderId: input.lemonOrderId,
      lemonWebhookId: input.lemonWebhookId,
      email: input.email,
      assessmentId: assessment.id,
    });

    const accessEmail = await emailAccessLink(input.email, accessToken);
    return {
      assessmentId: assessment.id,
      accessToken,
      accessTokenHash: assessment.accessTokenHash,
      accessEmail,
      created: true,
    };
  });
}

export async function completeMockPurchase(email: string) {
  const result = await completePaidOrder({
    email,
    lemonOrderId: `mock-order-${randomUUID()}`,
    lemonWebhookId: `mock-webhook-${randomUUID()}`,
  });
  if (!result.accessToken || !result.accessEmail || !result.accessTokenHash) {
    throw new Error("Mock purchase did not create an access token");
  }
  return {
    assessmentId: result.assessmentId,
    accessToken: result.accessToken,
    accessTokenHash: result.accessTokenHash,
    accessEmail: result.accessEmail,
  };
}

export async function expireAccessToken(accessToken: string) {
  return withStore(() => {
    const assessment = getStore().assessments.find(
      (item) => item.accessTokenHash === hashToken(accessToken),
    );
    if (assessment) {
      assessment.accessExpiresAt = Date.now() - 1;
    }
  });
}

export async function requestNewAccessLink(expiredToken: string) {
  return withStore(async () => {
    const assessment = getStore().assessments.find(
      (item) => item.accessTokenHash === hashToken(expiredToken),
    );
    if (!assessment || inspectAccessTokenInStore(expiredToken) !== "expired") {
      return { sent: false as const };
    }

    const accessToken = createToken();
    assessment.accessTokenHash = hashToken(accessToken);
    assessment.accessExpiresAt = Date.now() + accessTtlMs();
    const accessEmail = await emailAccessLink(assessment.email, accessToken);
    return { sent: true as const, accessToken, accessEmail };
  });
}

export async function recordWelcomeConsent(input: WelcomeConsentInput) {
  if (!input.productConsent) {
    throw new Error("Product consent is required");
  }

  return withStore(() => {
    if (inspectAccessTokenInStore(input.accessToken) !== "valid") {
      throw new Error("Assessment not found");
    }
    const assessment = getStore().assessments.find(
      (item) => item.accessTokenHash === hashToken(input.accessToken),
    );
    if (!assessment) {
      throw new Error("Assessment not found");
    }

    assessment.productConsentVersion = PRODUCT_CONSENT_COPY_VERSION;
    assessment.productConsentedAt = new Date().toISOString();

    const existing = getStore().marketingConsents.find((item) => item.email === assessment.email);
    if (input.marketingOptIn) {
      const record: MarketingConsentRecord = {
        email: assessment.email,
        consented: true,
        consentCopyVersion: MARKETING_CONSENT_COPY_VERSION,
        source: "welcome",
        consentedAt: new Date().toISOString(),
        withdrawnAt: undefined,
      };
      if (existing) {
        Object.assign(existing, record);
      } else {
        getStore().marketingConsents.push(record);
      }
    } else if (!existing) {
      getStore().marketingConsents.push({
        email: assessment.email,
        consented: false,
        consentCopyVersion: MARKETING_CONSENT_COPY_VERSION,
        source: "welcome",
      });
    }

    return assessment;
  });
}

export async function exportMarketingContacts(): Promise<MarketingContact[]> {
  return withStore(() =>
    getStore()
      .marketingConsents.filter((item) => item.consented && !item.withdrawnAt && item.consentedAt)
      .map((item) => ({
        email: item.email,
        consentCopyVersion: item.consentCopyVersion,
        consentedAt: item.consentedAt as string,
        source: item.source,
      })),
  );
}

export async function withdrawMarketingConsent(email: string) {
  return withStore(() => {
    const record = getStore().marketingConsents.find((item) => item.email === email);
    if (record) {
      record.consented = false;
      record.withdrawnAt = new Date().toISOString();
    }
  });
}

function assertKnownAnswer(assessment: AssessmentRecord, questionId: string, value: unknown) {
  if (isAdaptiveQuestionId(questionId)) {
    const known = getStore().adaptiveQuestions.some(
      (item) => item.assessmentId === assessment.id && item.id === questionId,
    );
    if (!known || typeof value !== "string") {
      throw new Error(known ? "Invalid answer" : "Unknown question");
    }
    return;
  }

  const question = getQuestion(questionId);
  if (!question) {
    throw new Error("Unknown question");
  }

  switch (question.inputType) {
    case "select":
    case "yes_no_unsure":
    case "long_text":
    case "short_text":
      if (typeof value !== "string") {
        throw new Error("Invalid answer");
      }
      return;
    case "scale":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Invalid answer");
      }
      return;
    case "control":
      if (value !== true) {
        throw new Error("Invalid answer");
      }
      return;
    case "multi_select":
    case "sentence_completions":
    case "loop":
    case "avoided_actions":
      if (!Array.isArray(value)) {
        throw new Error("Invalid answer");
      }
      return;
    case "paired_text":
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid answer");
      }
      return;
    default:
      return;
  }
}

export async function saveAnswer(accessToken: string, questionId: string, value: unknown) {
  return withStore(() => {
    const assessment = requireAssessmentByHash(hashToken(accessToken));
    if (assessment.status !== "in_progress") {
      throw new Error("Answers are locked after submit");
    }
    if (!assessment.productConsentVersion) {
      throw new Error("Consent required");
    }
    assertKnownAnswer(assessment, questionId, value);
    assessment.answers[questionId] = value;
    const adaptive = getStore().adaptiveQuestions.find(
      (item) => item.assessmentId === assessment.id && item.id === questionId,
    );
    if (adaptive) {
      adaptive.answer = value;
    }
    return assessment;
  });
}

export async function submitAssessment(accessToken: string) {
  return withStore(() => {
    const assessment = requireAssessmentByHash(hashToken(accessToken));
    if (assessment.status !== "in_progress") {
      throw new Error("Assessment already submitted");
    }
    if (!assessment.productConsentVersion) {
      throw new Error("Consent required");
    }
    assessment.status = "review_pending";
    assessment.draftBody = DRAFT_BODY;
    assessment.retentionDeadline = Date.now() + retentionMs();
    return assessment;
  });
}

export async function approveAssessment(assessmentId: string) {
  return withStore(async () => {
    const assessment = getStore().assessments.find((item) => item.id === assessmentId);
    if (!assessment || assessment.status !== "review_pending") {
      throw new Error("Assessment is not waiting for review");
    }
    if (analysisStatusInStore(assessmentId).label !== "completed") {
      throw new Error("Analysis must complete before approval");
    }
    const existingReport = getStore().reports.find((item) => item.assessmentId === assessmentId);
    if (!existingReport || existingReport.status === "deleted") {
      throw new Error("Draft report not found");
    }

    const reportToken = createToken();
    assessment.reportAccessTokenHash = hashToken(reportToken);
    assessment.reportAccessExpiresAt = Date.now() + accessTtlMs();
    assessment.status = "approved";
    const report = getStore().reports.find((item) => item.assessmentId === assessmentId);
    if (report && report.status !== "deleted") {
      report.status = "approved";
    }

    const adapters = createVendorAdapters();
    await adapters.email.send({
      to: assessment.email,
      subject: "Your report is ready",
      text: `Open your private report: /r/${reportToken}`,
    });

    const reportEmail = adapters.email.listOutbox().at(-1) as OutboxEmail;

    return {
      reportToken,
      reportEmail,
      draftBody: assessment.draftBody ?? DRAFT_BODY,
    };
  });
}

export async function listAdaptiveQuestions(assessmentId: string) {
  return withStore(() =>
    getStore().adaptiveQuestions.filter((item) => item.assessmentId === assessmentId),
  );
}

export async function listCaseStateVersions(assessmentId: string) {
  return withStore(() =>
    getStore().caseStateVersions.filter((item) => item.assessmentId === assessmentId),
  );
}

export async function listAnalysisRuns(assessmentId: string) {
  return withStore(() =>
    getStore().analysisRuns.filter((item) => item.assessmentId === assessmentId),
  );
}

function getDraftReportInStore(assessmentId: string) {
  const report = getStore().reports.find((item) => item.assessmentId === assessmentId);
  if (!report || report.status === "deleted") {
    return undefined;
  }
  return {
    status: report.status,
    generated: {
      assessmentId: report.assessmentId,
      engineVersion: report.engineVersion,
      sections: report.editedSections ?? report.sections,
    },
  };
}

export async function getDraftReport(assessmentId: string) {
  return withStore(() => getDraftReportInStore(assessmentId));
}

export async function getDeliveredReport(reportToken: string) {
  return withStore(() => {
    const assessment = getStore().assessments.find(
      (item) => item.reportAccessTokenHash === hashToken(reportToken),
    );
    if (!assessment || assessment.status !== "approved") {
      return undefined;
    }
    if (assessment.reportAccessExpiresAt && assessment.reportAccessExpiresAt <= Date.now()) {
      return undefined;
    }
    const report = getStore().reports.find((item) => item.assessmentId === assessment.id);
    if (report?.status === "deleted") {
      return undefined;
    }
    const draft = getDraftReportInStore(assessment.id);
    const sections =
      draft?.generated.sections ??
      [
        {
          id: "draft",
          title: "Overview",
          body: assessment.draftBody ?? DRAFT_BODY,
          evidenceRefs: [],
        },
      ];
    return {
      assessmentId: assessment.id,
      email: assessment.email,
      sections,
      safetyLevel: assessment.safetyLevel ?? "none",
    };
  });
}

export async function saveReportEdits(
  assessmentId: string,
  sections: { id: string; title: string; body: string; evidenceRefs: string[] }[],
) {
  return withStore(() => {
    const assessment = getStore().assessments.find((item) => item.id === assessmentId);
    const report = getStore().reports.find((item) => item.assessmentId === assessmentId);
    if (
      !assessment ||
      assessment.status === "approved" ||
      !report ||
      report.status === "deleted" ||
      report.status === "approved"
    ) {
      throw new Error("Approved reports cannot be edited");
    }
    report.editedSections = sections;
    return report;
  });
}

export async function resendReportLink(assessmentId: string) {
  return withStore(async () => {
    const assessment = getStore().assessments.find((item) => item.id === assessmentId);
    if (!assessment || assessment.status !== "approved") {
      throw new Error("Report is not approved");
    }
    const reportToken = createToken();
    assessment.reportAccessTokenHash = hashToken(reportToken);
    assessment.reportAccessExpiresAt = Date.now() + accessTtlMs();
    const adapters = createVendorAdapters();
    await adapters.email.send({
      to: assessment.email,
      subject: "Your report is ready",
      text: `Open your private report: /r/${reportToken}`,
    });
    const reportEmail = adapters.email.listOutbox().at(-1) as OutboxEmail;
    return { reportToken, reportEmail };
  });
}

function purgeAssessmentContent(assessmentId: string) {
  const store = getStore();
  const assessment = store.assessments.find((item) => item.id === assessmentId);
  if (!assessment) {
    throw new Error("Assessment not found");
  }
  assessment.answers = {};
  assessment.draftBody = undefined;
  assessment.reportAccessTokenHash = undefined;
  assessment.reportAccessExpiresAt = undefined;
  store.adaptiveQuestions = store.adaptiveQuestions.filter((item) => item.assessmentId !== assessmentId);
  store.caseStateVersions = store.caseStateVersions.filter((item) => item.assessmentId !== assessmentId);
  store.safetyFlags = store.safetyFlags.filter((item) => item.assessmentId !== assessmentId);
  store.analysisRuns = store.analysisRuns.filter((item) => item.assessmentId !== assessmentId);
  const report = store.reports.find((item) => item.assessmentId === assessmentId);
  if (report) {
    report.status = "deleted";
    report.sections = [];
    report.editedSections = undefined;
  }
  return assessment;
}

export async function deleteAssessmentData(assessmentId: string) {
  return withStore(() => purgeAssessmentContent(assessmentId));
}

export async function deleteReportAccess(assessmentId: string) {
  return deleteAssessmentData(assessmentId);
}

export async function purgeExpiredAssessments(now = Date.now()) {
  return withStore(() => {
    let purged = 0;
    for (const assessment of getStore().assessments) {
      if (!assessment.retentionDeadline || assessment.retentionDeadline > now) {
        continue;
      }
      const hadContent =
        Object.keys(assessment.answers).length > 0 ||
        Boolean(
          getStore().reports.find(
            (item) => item.assessmentId === assessment.id && item.status !== "deleted",
          ),
        );
      purgeAssessmentContent(assessment.id);
      if (hadContent) {
        purged += 1;
      }
    }
    return purged;
  });
}

export async function getAdminCase(assessmentId: string) {
  return withStore(() => {
    const assessment = getStore().assessments.find((item) => item.id === assessmentId);
    if (!assessment) {
      throw new Error("Assessment not found");
    }
    return {
      assessment,
      safetyLevel: assessment.safetyLevel ?? "none",
      runs: getStore().analysisRuns.filter((item) => item.assessmentId === assessmentId),
      analysisStatus: analysisStatusInStore(assessmentId),
      draft: getDraftReportInStore(assessmentId),
    };
  });
}

export async function runAnalysisPipeline(
  assessmentId: string,
  options: { fixture?: AnalysisFixture; failStage?: AnalysisStage } = {},
): Promise<AnalysisPipelineResult> {
  return withStore(async () => {
    const assessment = getStore().assessments.find((item) => item.id === assessmentId);
    if (!assessment) {
      throw new Error("Assessment not found");
    }
    if (assessment.status !== "review_pending") {
      throw new Error("Analysis runs only after submit");
    }

    const adapters = createVendorAdapters();
    const priorRuns = getStore().analysisRuns.filter((item) => item.assessmentId === assessmentId);
    const completed = priorRuns.filter((item) => item.status === "success").map((item) => item.stage);
    const previous = getStore()
      .caseStateVersions.filter((item) => item.assessmentId === assessmentId)
      .at(-1)?.snapshot;
    const existingReport = getDraftReportInStore(assessmentId)?.generated;

    const result = await executeAnalysis({
      assessmentId,
      answers: assessment.answers,
      previousCaseState: previous,
      completedStages: completed,
      priorRuns,
      existingReport,
      llm: adapters.llm,
      fixture: options.fixture,
      failStage: options.failStage,
      persistRun(run) {
        getStore().analysisRuns.push({
          ...run,
          createdAt: new Date().toISOString(),
        });
      },
      persistCaseState(stage, snapshot) {
        getStore().caseStateVersions.push({
          assessmentId,
          stage,
          snapshot,
          createdAt: new Date().toISOString(),
        });
      },
    });
    if (result.report) {
      const store = getStore();
      const existing = store.reports.find((item) => item.assessmentId === assessmentId);
      if (existing) {
        existing.sections = result.report.sections;
        existing.engineVersion = result.report.engineVersion;
        existing.status = "draft";
      } else {
        store.reports.push({ ...result.report, status: "draft" });
      }
    }
    return result;
  });
}

export async function runAssessmentCheckpoint(
  accessToken: string,
  checkpoint: AdaptiveCheckpoint,
) {
  return withStore(async () => {
    const assessment = requireAssessmentByHash(hashToken(accessToken));
    if (assessment.status !== "in_progress") {
      throw new Error("Assessment already submitted");
    }
    if (!assessment.productConsentVersion) {
      throw new Error("Consent required");
    }

    const store = getStore();
    const existing = store.adaptiveQuestions.filter((item) => item.assessmentId === assessment.id);
    const alreadyRan = store.caseStateVersions.some(
      (item) => item.assessmentId === assessment.id && item.stage === `checkpoint-${checkpoint}`,
    );
    if (alreadyRan) {
      const stored = existing.find((item) => item.checkpoint === checkpoint);
      return {
        adaptiveQuestion: stored
          ? {
              id: stored.id,
              checkpoint: stored.checkpoint,
              forkId: stored.forkId,
              questionText: stored.questionText,
            }
          : null,
        safetyLevel: assessment.safetyLevel ?? "none",
        supportCopy: assessment.safetyLevel === "high" ? SUPPORT_COPY : null,
        reportDepth: assessment.reportDepth ?? "full",
      };
    }

    const previous = store.caseStateVersions
      .filter((item) => item.assessmentId === assessment.id)
      .at(-1)?.snapshot;

    const adapters = createVendorAdapters();
    const result = await runCheckpoint({
      assessmentId: assessment.id,
      checkpoint,
      answers: assessment.answers,
      existingAdaptive: existing,
      previousCaseState: previous,
      llm: adapters.llm,
    });

    store.caseStateVersions.push({
      assessmentId: assessment.id,
      stage: `checkpoint-${checkpoint}`,
      snapshot: result.caseState,
      createdAt: new Date().toISOString(),
    });

    assessment.safetyLevel = result.safetyLevel;
    assessment.reportDepth = result.reportDepth;
    if (result.safetyLevel === "high") {
      for (const flag of result.caseState.safetyFlags) {
        store.safetyFlags.push({ ...flag, assessmentId: assessment.id });
      }
    }

    if (result.adaptiveQuestion) {
      store.adaptiveQuestions.push({
        assessmentId: assessment.id,
        id: result.adaptiveQuestion.id,
        checkpoint: result.adaptiveQuestion.checkpoint,
        forkId: result.adaptiveQuestion.forkId as ForkId,
        questionText: result.adaptiveQuestion.questionText,
        rationale: result.adaptiveQuestion.rationale,
      });
    }

    return {
      adaptiveQuestion: result.adaptiveQuestion
        ? {
            id: result.adaptiveQuestion.id,
            checkpoint: result.adaptiveQuestion.checkpoint,
            forkId: result.adaptiveQuestion.forkId,
            questionText: result.adaptiveQuestion.questionText,
          }
        : null,
      safetyLevel: result.safetyLevel,
      supportCopy: result.supportCopy,
      reportDepth: result.reportDepth,
    };
  });
}
