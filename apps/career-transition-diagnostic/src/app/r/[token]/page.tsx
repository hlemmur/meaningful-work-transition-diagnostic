import { notFound } from "next/navigation";
import { JournalShell } from "@/components/journal-shell";
import { ReportLetter } from "@/components/report-letter";
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
      <main>
        <ReportLetter sections={report.sections} />
      </main>
    </JournalShell>
  );
}
