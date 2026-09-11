import Link from "next/link";
import { requireAdminPage } from "@/server/admin/guard";
import { approveAndDeliverAction } from "./review-actions";
import { listReviewQueueView } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPage();
  const queue = await listReviewQueueView();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
      <p className="leading-7 text-[#4a3b34]">
        Nothing is delivered until a report is approved.
      </p>
      <Link className="text-sm underline" href="/admin/export">
        Marketing export
      </Link>
      {queue.length === 0 ? (
        <p>No submissions yet.</p>
      ) : (
        <ul className="space-y-4">
          {queue.map((assessment) => {
            return (
              <li
                key={assessment.id}
                data-assessment-id={assessment.id}
                data-safety-level={assessment.safetyLevel}
                data-analysis-status={assessment.analysisStatus}
                className="rounded border border-[#e6d8cc] bg-white p-4"
              >
                <p className="text-sm uppercase tracking-wide">{assessment.status}</p>
                <p className="mt-1 text-sm">Safety: {assessment.safetyLevel}</p>
                <p className="text-sm">Analysis: {assessment.analysisStatus}</p>
                <Link
                  className="mt-3 inline-block text-sm underline"
                  href={`/admin/${assessment.id}`}
                >
                  Open case
                </Link>
                {assessment.status === "review_pending" &&
                assessment.analysisStatus === "completed" ? (
                  <form action={approveAndDeliverAction.bind(null, assessment.id)} className="mt-3">
                    <button
                      className="rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
                      type="submit"
                    >
                      Approve report
                    </button>
                  </form>
                ) : assessment.status === "review_pending" ? (
                  <p className="mt-2 text-sm">Open the case to run analysis before approving.</p>
                ) : assessment.status === "deleted" ? (
                  <p className="mt-2 text-sm">Customer access removed.</p>
                ) : (
                  <p className="mt-2 text-sm">Approved and queued for delivery.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
