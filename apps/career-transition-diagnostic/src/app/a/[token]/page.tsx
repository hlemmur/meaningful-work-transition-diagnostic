import { notFound } from "next/navigation";
import { recordConsentAction } from "@/server/tracer/actions";
import {
  getAssessmentByAccessToken,
  inspectAccessToken,
  listAdaptiveQuestions,
} from "@/server/tracer/service";
import { SUPPORT_COPY } from "@/engine/checkpoints/bank";
import { JournalShell } from "@/components/journal-shell";
import { RequestNewLinkForm } from "@/components/request-new-link-form";
import { WelcomeConsentForm } from "@/components/welcome-consent-form";
import { QuestionnaireFlow } from "@/questionnaire/QuestionnaireFlow";

export const dynamic = "force-dynamic";

type AssessmentPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; submitted?: string }>;
};

export default async function AssessmentPage({
  params,
  searchParams,
}: AssessmentPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const tokenState = await inspectAccessToken(token);

  if (tokenState === "missing") {
    notFound();
  }

  if (tokenState === "expired") {
    return (
      <JournalShell>
        <main className="flex flex-col gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Link expired</h1>
          <p>Request a new private assessment link. This does not sign you up for marketing.</p>
          <RequestNewLinkForm expiredToken={token} />
        </main>
      </JournalShell>
    );
  }

  const assessment = await getAssessmentByAccessToken(token);
  if (!assessment) {
    notFound();
  }

  if (!assessment.productConsentVersion) {
    return <WelcomeConsentForm action={recordConsentAction.bind(null, token)} />;
  }

  const locked = assessment.status !== "in_progress";
  const adaptive = await listAdaptiveQuestions(assessment.id);

  return (
    <JournalShell>
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Assessment</h1>
        <QuestionnaireFlow
          token={token}
          initialAnswers={assessment.answers}
          locked={locked}
          submitted={query.submitted === "1"}
          initialAdaptive={adaptive.map((item) => ({
            id: item.id,
            checkpoint: item.checkpoint,
            forkId: item.forkId,
            questionText: item.questionText,
          }))}
          initialSafetyLevel={assessment.safetyLevel ?? "none"}
          initialSupportCopy={assessment.safetyLevel === "high" ? SUPPORT_COPY : null}
        />
      </main>
    </JournalShell>
  );
}
