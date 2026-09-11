import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TracerDb } from "./repository";
import { TRACER_TABLES, type TracerTableName, type TracerTables } from "./mapper";

const DELETE_ORDER: TracerTableName[] = [
  "safety_flags",
  "analysis_runs",
  "case_state_versions",
  "adaptive_questions",
  "assessment_answers",
  "reports",
  "assessments",
  "marketing_consents",
  "purchases",
];

const INSERT_ORDER: TracerTableName[] = [
  "purchases",
  "marketing_consents",
  "assessments",
  "assessment_answers",
  "adaptive_questions",
  "case_state_versions",
  "analysis_runs",
  "reports",
  "safety_flags",
];

function throwIfError(error: { message: string } | null, action: string) {
  if (error) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }
}

export class SupabaseTracerDb implements TracerDb {
  constructor(private readonly client: SupabaseClient) {}

  async loadAll(): Promise<TracerTables> {
    const tables = {} as TracerTables;
    for (const table of TRACER_TABLES) {
      const { data, error } = await this.client.from(table).select("*");
      throwIfError(error, `select ${table}`);
      tables[table] = (data ?? []) as Record<string, unknown>[];
    }
    return tables;
  }

  async replaceAll(tables: TracerTables) {
    // Beta-scale snapshot replace. Callers must serialize via withStore so two
    // overlapping requests cannot load the same snapshot and drop each other's writes.
    for (const table of DELETE_ORDER) {
      const { error } = await this.client.from(table).delete().not("id", "is", null);
      throwIfError(error, `delete ${table}`);
    }
    for (const table of INSERT_ORDER) {
      const rows = tables[table];
      if (rows.length === 0) {
        continue;
      }
      const { error } = await this.client.from(table).insert(rows);
      throwIfError(error, `insert ${table}`);
    }
  }
}

export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
