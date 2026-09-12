import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { supabasePersistenceEnabled } from "@/server/tracer/repository";
import { restoreMockSubmittedCase } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMockMode() || supabasePersistenceEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json()) as {
    accessToken?: string;
    email?: string;
    answers?: Record<string, unknown>;
    assessmentId?: string;
  };
  if (!body.accessToken || !body.email || !body.answers || typeof body.answers !== "object") {
    return NextResponse.json({ error: "Invalid restore payload" }, { status: 400 });
  }
  const restored = await restoreMockSubmittedCase({
    accessToken: body.accessToken,
    email: body.email,
    answers: body.answers,
    assessmentId: body.assessmentId,
  });
  return NextResponse.json({ ok: true, ...restored });
}
