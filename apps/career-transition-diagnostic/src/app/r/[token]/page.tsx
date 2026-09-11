import { notFound } from "next/navigation";
import { getDeliveredReport } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const report = getDeliveredReport(token);

  if (!report) {
    notFound();
  }

  return (
    <main className="report-page mx-auto flex min-h-full max-w-2xl flex-col gap-6 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Private report</h1>
      {report.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-xl font-medium">{section.title}</h2>
          <p className="leading-7">{section.body}</p>
        </section>
      ))}
      <p className="print:hidden leading-7 text-[#4a3b34]" data-coaching-cta="true">
        If you want to continue this inquiry 1:1, you can ask Lena about coaching.
      </p>
      <p className="print:hidden text-sm text-[#4a3b34]">Use your browser print dialog to save a PDF.</p>
    </main>
  );
}
