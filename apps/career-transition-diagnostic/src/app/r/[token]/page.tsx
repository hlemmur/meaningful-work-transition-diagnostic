import { notFound } from "next/navigation";
import { JournalShell } from "@/components/journal-shell";
import { getDeliveredReport } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const report = await getDeliveredReport(token);

  if (!report) {
    notFound();
  }

  return (
    <JournalShell>
      <main className="report-page flex flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Private report</h1>
        {report.sections.map((section) => (
          <section key={section.id} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-medium">{section.title}</h2>
            <p className="leading-7">{section.body}</p>
          </section>
        ))}
        <p className="print:hidden leading-7 text-muted" data-coaching-cta="true">
          If you want to continue this inquiry 1:1, you can ask Lena about coaching.
        </p>
        <p className="print:hidden text-sm text-muted">Use your browser print dialog to save a PDF.</p>
      </main>
    </JournalShell>
  );
}
