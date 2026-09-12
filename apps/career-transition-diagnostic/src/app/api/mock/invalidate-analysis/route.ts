import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import type { AnalysisStage } from "@/engine/pipeline/models";
import { ANALYSIS_STAGES } from "@/engine/pipeline/models";
import { supabasePersistenceEnabled } from "@/server/tracer/repository";
import { invalidateAnalysisFromStage } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMockMode() || supabasePersistenceEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json()) as {
    assessmentId?: string;
    fromStage?: string;
  };
  if (!body.assessmentId || !body.fromStage) {
    return NextResponse.json({ error: "assessmentId and fromStage required" }, { status: 400 });
  }
  if (!ANALYSIS_STAGES.includes(body.fromStage as AnalysisStage)) {
    return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
  }
  const result = await invalidateAnalysisFromStage(
    body.assessmentId,
    body.fromStage as AnalysisStage,
  );
  return NextResponse.json({ ok: true, ...result });
}
