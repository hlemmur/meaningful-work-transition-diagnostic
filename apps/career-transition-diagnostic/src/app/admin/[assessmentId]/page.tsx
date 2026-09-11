import {
  approveAndDeliverAction,
  deleteAccessAction,
  resendLinkAction,
  runAnalysisFromAdminAction,
  saveEditsAction,
} from "../review-actions";
import { requireAdminPage } from "@/server/admin/guard";
import { getAdminCase } from "@/server/tracer/service";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type AdminCasePageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default async function AdminCasePage({ params }: AdminCasePageProps) {
  await requireAdminPage();
  const { assessmentId } = await params;
  let adminCase;
  try {
    adminCase = await getAdminCase(assessmentId);
  } catch {
    notFound();
  }

  const sections = adminCase.draft?.generated.sections ?? [];
  const failedStage = adminCase.analysisStatus.failedStage;
  const pending = adminCase.assessment.status === "review_pending";
  const canEdit = pending && adminCase.draft?.status === "draft";
  const canApprove = pending && adminCase.analysisStatus.label === "completed";
  const save = saveEditsAction.bind(null, assessmentId);
  const run = runAnalysisFromAdminAction.bind(null, assessmentId);
  const approve = approveAndDeliverAction.bind(null, assessmentId);
  const resend = resendLinkAction.bind(null, assessmentId);
  const remove = deleteAccessAction.bind(null, assessmentId);

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-20">
      <Link className="text-sm underline" href="/admin">
        Back to queue
      </Link>
      <p className="text-sm uppercase tracking-wide">{adminCase.assessment.status}</p>
      <h1 className="text-3xl font-semibold tracking-tight">Case review</h1>
      <p>Safety: {adminCase.safetyLevel}</p>
      <p>Analysis: {adminCase.analysisStatus.label}</p>
      {failedStage ? <p>Failed stage: {failedStage}</p> : null}

      {pending ? (
        <form action={run}>
          <button
            className="rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
            type="submit"
          >
            {failedStage ? "Resume analysis" : "Run analysis"}
          </button>
        </form>
      ) : null}

      {sections.length > 0 && canEdit ? (
        <form action={save} className="flex flex-col gap-4">
          <input type="hidden" name="count" value={String(sections.length)} />
          {sections.map((section, index) => (
            <article key={section.id} className="rounded border border-[#e6d8cc] bg-white p-4">
              <input type="hidden" name={`id-${index}`} value={section.id} />
              <input type="hidden" name={`title-${index}`} value={section.title} />
              <input type="hidden" name={`refs-${index}`} value={section.evidenceRefs.join(",")} />
              <h2 className="font-medium">{section.title}</h2>
              <p className="text-xs text-[#4a3b34]">
                Evidence: {section.evidenceRefs.join(", ") || "none"}
              </p>
              <label className="mt-2 block text-sm">
                Body
                <textarea
                  className="mt-1 min-h-28 w-full rounded border border-[#e6d8cc] p-2"
                  name={`body-${index}`}
                  defaultValue={section.body}
                />
              </label>
            </article>
          ))}
          <button
            className="w-fit rounded-full border border-[#2b211c] px-5 py-3 text-sm"
            type="submit"
          >
            Save edits
          </button>
        </form>
      ) : sections.length > 0 ? (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <article key={section.id} className="rounded border border-[#e6d8cc] bg-white p-4">
              <h2 className="font-medium">{section.title}</h2>
              <p className="text-xs text-[#4a3b34]">
                Evidence: {section.evidenceRefs.join(", ") || "none"}
              </p>
              <p className="mt-2 leading-7">{section.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <p>Run analysis to generate an evidence-linked draft.</p>
      )}

      {canApprove ? (
        <form action={approve}>
          <button
            className="rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
            type="submit"
          >
            Approve report
          </button>
        </form>
      ) : pending ? (
        <p className="text-sm">Run analysis before approving.</p>
      ) : (
        <div className="flex gap-3">
          <form action={resend}>
            <button className="rounded-full border border-[#2b211c] px-5 py-3 text-sm" type="submit">
              Resend link
            </button>
          </form>
          <form action={remove}>
            <button className="rounded-full border border-[#b65f3e] px-5 py-3 text-sm" type="submit">
              Delete access
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
