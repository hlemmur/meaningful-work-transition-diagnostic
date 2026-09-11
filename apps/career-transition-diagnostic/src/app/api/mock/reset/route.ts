import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { resetMockOutbox } from "@/server/adapters/resend/mock";
import { supabasePersistenceEnabled } from "@/server/tracer/repository";
import { resetMockTracerStore } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isMockMode() || supabasePersistenceEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  resetMockOutbox();
  await resetMockTracerStore();
  return NextResponse.json({ ok: true });
}
