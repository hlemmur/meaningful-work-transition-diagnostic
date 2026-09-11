import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { resetMockOutbox } from "@/server/adapters/resend/mock";
import { resetMockTracerStore } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isMockMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  resetMockOutbox();
  resetMockTracerStore();
  return NextResponse.json({ ok: true });
}
