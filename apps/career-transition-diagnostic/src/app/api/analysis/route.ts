import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { getAdminSession } from "@/server/admin/session";
import { runAnalysisPipeline } from "@/server/tracer/service";
import type { AnalysisFixture } from "@/engine/pipeline/fixtures";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    assessmentId?: string;
    fixture?: AnalysisFixture;
  };
  if (!body.assessmentId) {
    return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
  }

  try {
    const result = await runAnalysisPipeline(body.assessmentId, {
      fixture: isMockMode() ? body.fixture : undefined,
    });
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
