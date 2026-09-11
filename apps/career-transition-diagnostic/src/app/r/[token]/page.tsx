import { notFound } from "next/navigation";
import { getAssessmentByReportToken } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { token } = await params;
  const assessment = getAssessmentByReportToken(token);

  if (!assessment || assessment.status !== "approved") {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Private report</h1>
      <p className="leading-7">{assessment.draftBody}</p>
    </main>
  );
}
