import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { supabasePersistenceEnabled } from "@/server/tracer/repository";
import { importMockTracerStore } from "@/server/tracer/service";
import type { TracerStore } from "@/server/tracer/records";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isMockMode() || supabasePersistenceEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const store = (await request.json()) as TracerStore;
  if (!store || !Array.isArray(store.assessments)) {
    return NextResponse.json({ error: "Invalid store payload" }, { status: 400 });
  }
  const summary = await importMockTracerStore(store);
  return NextResponse.json({ ok: true, ...summary });
}
