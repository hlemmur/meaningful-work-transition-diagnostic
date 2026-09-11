import { requireAdminPage } from "@/server/admin/guard";
import { listReviewQueueView } from "@/server/tracer/service";
import { ReviewQueueTable } from "./review-queue-table";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{ delivered?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdminPage();
  const queue = await listReviewQueueView();
  const { delivered } = await searchParams;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
      {delivered ? (
        <p className="text-sm text-muted">Report link emailed to the customer.</p>
      ) : null}
      <p className="leading-7 text-muted">
        Open a case to read the draft, then send. Nothing is delivered from this list.
      </p>
      {queue.length === 0 ? (
        <p>No submissions yet.</p>
      ) : (
        <ReviewQueueTable queue={queue} />
      )}
    </main>
  );
}
