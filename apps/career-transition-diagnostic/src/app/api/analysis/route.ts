import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/session";
import { runAnalysisPipeline } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    assessmentId?: string;
  };
  if (!body.assessmentId) {
    return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
  }

  try {
    const result = await runAnalysisPipeline(body.assessmentId);
    return NextResponse.json({
      status: result.status,
      failedStage: result.failedStage ?? null,
      reportDepth: result.caseState.hiddenPosition ? "full" : "reduced",
      sectionCount: result.report?.sections.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
