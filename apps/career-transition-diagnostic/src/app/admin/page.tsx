import { approveAssessmentAction } from "@/server/tracer/actions";
import { listReviewQueue } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const queue = listReviewQueue();

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
      <p className="leading-7 text-[#4a3b34]">
        Nothing is delivered until a report is approved.
      </p>
      {queue.length === 0 ? (
        <p>No submissions yet.</p>
      ) : (
        <ul className="space-y-4">
          {queue.map((assessment) => {
            const approve = approveAssessmentAction.bind(null, assessment.id);
            return (
              <li key={assessment.id} className="rounded border border-[#e6d8cc] bg-white p-4">
                <p className="text-sm uppercase tracking-wide">{assessment.status}</p>
                {assessment.draftBody ? (
                  <p className="mt-2 leading-7">{assessment.draftBody}</p>
                ) : null}
                {assessment.status === "review_pending" ? (
                  <form action={approve} className="mt-4">
                    <button
                      className="rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
                      type="submit"
                    >
                      Approve report
                    </button>
                  </form>
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
