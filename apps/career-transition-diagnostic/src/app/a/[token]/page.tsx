import { notFound } from "next/navigation";
import {
  recordConsentAction,
  saveAnswerAction,
  submitAssessmentAction,
} from "@/server/tracer/actions";
import {
  getAssessmentByAccessToken,
  inspectAccessToken,
} from "@/server/tracer/service";
import { RequestNewLinkForm } from "@/components/request-new-link-form";

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

  const save = saveAnswerAction.bind(null, token);
  const submit = submitAssessmentAction.bind(null, token);
  const locked = assessment.status !== "in_progress";

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Assessment</h1>
      <form className="flex flex-col gap-4" action={save}>
        <label className="text-sm font-medium" htmlFor="q1-1">
          In your own words, what is the work/career situation you’re struggling
          with right now?
        </label>
        <textarea
          id="q1-1"
          name="answer"
          className="min-h-40 rounded border border-[#e6d8cc] bg-white p-3"
          defaultValue={assessment.answers["Q1.1"] ?? ""}
          disabled={locked}
        />
        {query.saved === "1" ? <p>Saved.</p> : null}
        {query.submitted === "1" ? (
          <p>Submitted. Lena will review before any report is delivered.</p>
        ) : null}
        <div className="flex gap-3">
          <button
            className="rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea] disabled:opacity-50"
            type="submit"
            disabled={locked}
          >
            Save answer
          </button>
          <button
            className="rounded-full border border-[#2b211c] px-5 py-3 text-sm font-medium disabled:opacity-50"
            formAction={submit}
            disabled={locked}
          >
            Submit assessment
          </button>
        </div>
      </form>
    </main>
  );
}
