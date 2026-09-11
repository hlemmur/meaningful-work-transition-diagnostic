import { NextResponse } from "next/server";
import { runAssessmentCheckpoint } from "@/server/tracer/service";
import type { AdaptiveCheckpoint } from "@/questionnaire/adaptive";

export const dynamic = "force-dynamic";

const CHECKPOINTS = new Set(["A", "B", "C", "D"]);

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; checkpoint?: string };
  if (!body.token || !CHECKPOINTS.has(body.checkpoint ?? "")) {
    return NextResponse.json({ error: "Invalid checkpoint request" }, { status: 400 });
  }

  try {
    const result = await runAssessmentCheckpoint(
      body.token,
      body.checkpoint as AdaptiveCheckpoint,
    );
    return NextResponse.json({
      adaptiveQuestion: result.adaptiveQuestion,
      safetyLevel: result.safetyLevel,
      supportCopy: result.supportCopy,
      reportDepth: result.reportDepth,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkpoint failed";
    const status = message === "Consent required" || message === "Assessment not found" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
