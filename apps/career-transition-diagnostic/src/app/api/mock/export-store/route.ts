import { NextResponse } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { supabasePersistenceEnabled } from "@/server/tracer/repository";
import { exportMockTracerStore } from "@/server/tracer/service";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMockMode() || supabasePersistenceEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const store = await exportMockTracerStore();
  return NextResponse.json(store);
}
