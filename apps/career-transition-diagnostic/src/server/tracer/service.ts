import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getQuestion } from "@/questionnaire/questionnaire.v2";
import { createVendorAdapters } from "../adapters";
import type { OutboxEmail } from "../adapters/types";
import {
  MARKETING_CONSENT_COPY_VERSION,
  PRODUCT_CONSENT_COPY_VERSION,
  type MarketingContact,
  type WelcomeConsentInput,
} from "../consent/copy";

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
  productConsentVersion?: string;
  productConsentedAt?: string;
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

type TracerStore = {
  assessments: AssessmentRecord[];
  purchases: PurchaseRecord[];
  marketingConsents: MarketingConsentRecord[];
};

const DRAFT_BODY =
  "A possible hidden position is that structure is being asked to serve aliveness.";
const ACCESS_TTL_MS = Number(process.env.ACCESS_TOKEN_TTL_MS ?? 7 * 24 * 60 * 60 * 1000);

function getStore(): TracerStore {
  const globalState = globalThis as typeof globalThis & { __mwtdTracer?: TracerStore };
  if (!globalState.__mwtdTracer) {
    globalState.__mwtdTracer = {
      assessments: [],
      purchases: [],
      marketingConsents: [],
    };
  }
  return globalState.__mwtdTracer;
}

export function resetMockTracerStore() {
  const store = getStore();
  store.assessments.length = 0;
  store.purchases.length = 0;
  store.marketingConsents.length = 0;
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

export function inspectAccessToken(accessToken: string) {
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

export function getAssessmentByAccessToken(accessToken: string) {
  if (inspectAccessToken(accessToken) !== "valid") {
    return undefined;
  }
  return getStore().assessments.find((item) => item.accessTokenHash === hashToken(accessToken));
}

export function getAssessmentByReportToken(reportToken: string) {
  return getStore().assessments.find(
    (item) => item.reportAccessTokenHash === hashToken(reportToken),
  );
}

export function listReviewQueue() {
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
    accessExpiresAt: Date.now() + ACCESS_TTL_MS,
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

export function expireAccessToken(accessToken: string) {
  const assessment = getStore().assessments.find(
    (item) => item.accessTokenHash === hashToken(accessToken),
  );
  if (assessment) {
    assessment.accessExpiresAt = Date.now() - 1;
  }
}

export async function requestNewAccessLink(email: string) {
  const assessment = [...getStore().assessments].reverse().find((item) => item.email === email);
  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const accessToken = createToken();
  assessment.accessTokenHash = hashToken(accessToken);
  assessment.accessExpiresAt = Date.now() + ACCESS_TTL_MS;
  const accessEmail = await emailAccessLink(email, accessToken);
  return { accessToken, accessEmail };
}

export async function recordWelcomeConsent(input: WelcomeConsentInput) {
  if (!input.productConsent) {
    throw new Error("Product consent is required");
  }

  const assessment = getAssessmentByAccessToken(input.accessToken);
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
}

export function exportMarketingContacts(): MarketingContact[] {
  return getStore()
    .marketingConsents.filter((item) => item.consented && !item.withdrawnAt && item.consentedAt)
    .map((item) => ({
      email: item.email,
      consentCopyVersion: item.consentCopyVersion,
      consentedAt: item.consentedAt as string,
      source: item.source,
    }));
}

export function withdrawMarketingConsent(email: string) {
  const record = getStore().marketingConsents.find((item) => item.email === email);
  if (record) {
    record.consented = false;
    record.withdrawnAt = new Date().toISOString();
  }
}

function assertKnownAnswer(questionId: string, value: unknown) {
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
  const assessment = requireAssessmentByHash(hashToken(accessToken));
  if (assessment.status !== "in_progress") {
    throw new Error("Answers are locked after submit");
  }
  if (!assessment.productConsentVersion) {
    throw new Error("Consent required");
  }
  assertKnownAnswer(questionId, value);
  assessment.answers[questionId] = value;
  return assessment;
}

export async function submitAssessment(accessToken: string) {
  const assessment = requireAssessmentByHash(hashToken(accessToken));
  if (assessment.status !== "in_progress") {
    throw new Error("Assessment already submitted");
  }
  if (!assessment.productConsentVersion) {
    throw new Error("Consent required");
  }
  assessment.status = "review_pending";
  assessment.draftBody = DRAFT_BODY;
  return assessment;
}

export async function approveAssessment(assessmentId: string) {
  const assessment = getStore().assessments.find((item) => item.id === assessmentId);
  if (!assessment || assessment.status !== "review_pending") {
    throw new Error("Assessment is not waiting for review");
  }

  const reportToken = createToken();
  assessment.reportAccessTokenHash = hashToken(reportToken);
  assessment.status = "approved";

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
}
