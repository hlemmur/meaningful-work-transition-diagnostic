import { notFound } from "next/navigation";
import { recordConsentAction } from "@/server/tracer/actions";
import {
  getAssessmentByAccessToken,
  inspectAccessToken,
  listAdaptiveQuestions,
} from "@/server/tracer/service";
import { SUPPORT_COPY } from "@/engine/checkpoints/bank";
import { RequestNewLinkForm } from "@/components/request-new-link-form";
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
  const tokenState = inspectAccessToken(token);

  if (tokenState === "missing") {
    notFound();
  }

  if (tokenState === "expired") {
    return (
      <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">Link expired</h1>
        <p>Request a new private assessment link. This does not sign you up for marketing.</p>
        <RequestNewLinkForm />
      </main>
    );
  }

  const assessment = getAssessmentByAccessToken(token);
  if (!assessment) {
    notFound();
  }

  if (!assessment.productConsentVersion) {
    const consent = recordConsentAction.bind(null, token);
    return (
      <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-tight">Before you begin</h1>
        <p className="leading-7 text-[#4a3b34]">
          This diagnostic is self-paced. Lena reviews every report before delivery.
          Required consent is for the product. Marketing is optional and off by default.
        </p>
        <form className="flex flex-col gap-4" action={consent}>
          <label className="flex items-start gap-3">
            <input id="product-consent" name="productConsent" type="checkbox" required />
            <span>I consent to the assessment, privacy notice, and human review of my answers.</span>
          </label>
          <label className="flex items-start gap-3">
            <input id="marketing-opt-in" name="marketingOptIn" type="checkbox" />
            <span>Email me occasional notes. Leave this unchecked unless you want that.</span>
          </label>
          <button
            className="w-fit rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
            type="submit"
          >
            Continue to assessment
          </button>
        </form>
      </main>
    );
  }

  const locked = assessment.status !== "in_progress";

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Assessment</h1>
      <QuestionnaireFlow
        token={token}
        initialAnswers={assessment.answers}
        locked={locked}
        submitted={query.submitted === "1"}
        initialAdaptive={listAdaptiveQuestions(assessment.id).map((item) => ({
          id: item.id,
          checkpoint: item.checkpoint,
          forkId: item.forkId,
          questionText: item.questionText,
        }))}
        initialSafetyLevel={assessment.safetyLevel ?? "none"}
        initialSupportCopy={assessment.safetyLevel === "high" ? SUPPORT_COPY : null}
      />
    </main>
  );
}
