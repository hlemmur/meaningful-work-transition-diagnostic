import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createVendorAdapters } from "../adapters";
import type { OutboxEmail } from "../adapters/types";

export type AssessmentStatus = "in_progress" | "review_pending" | "approved";

export type AssessmentRecord = {
  id: string;
  email: string;
  accessTokenHash: string;
  status: AssessmentStatus;
  answers: Record<string, string>;
  draftBody?: string;
  reportAccessTokenHash?: string;
};

type TracerStore = {
  assessments: AssessmentRecord[];
};

const DRAFT_BODY =
  "A possible hidden position is that structure is being asked to serve aliveness.";

function getStore(): TracerStore {
  const globalState = globalThis as typeof globalThis & { __mwtdTracer?: TracerStore };
  if (!globalState.__mwtdTracer) {
    globalState.__mwtdTracer = { assessments: [] };
  }
  return globalState.__mwtdTracer;
}

export function resetMockTracerStore() {
  getStore().assessments.length = 0;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(24).toString("hex");
}

function requireAssessmentByHash(hash: string) {
  const assessment = getStore().assessments.find((item) => item.accessTokenHash === hash);
  if (!assessment) {
    throw new Error("Assessment not found");
  }
  return assessment;
}

export function getAssessmentByAccessToken(accessToken: string) {
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

export async function completeMockPurchase(email: string) {
  const accessToken = createToken();
  const accessTokenHash = hashToken(accessToken);
  const assessment: AssessmentRecord = {
    id: randomUUID(),
    email,
    accessTokenHash,
    status: "in_progress",
    answers: {},
  };
  getStore().assessments.push(assessment);

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

  return {
    assessmentId: assessment.id,
    accessToken,
    accessTokenHash,
    accessEmail,
  };
}

export async function saveAnswer(accessToken: string, questionId: string, value: string) {
  const assessment = requireAssessmentByHash(hashToken(accessToken));
  if (assessment.status !== "in_progress") {
    throw new Error("Answers are locked after submit");
  }
  assessment.answers[questionId] = value;
  return assessment;
}

export async function submitAssessment(accessToken: string) {
  const assessment = requireAssessmentByHash(hashToken(accessToken));
  if (assessment.status !== "in_progress") {
    throw new Error("Assessment already submitted");
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
