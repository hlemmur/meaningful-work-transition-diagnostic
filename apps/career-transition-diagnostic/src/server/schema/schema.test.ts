import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function allMigrationsSql() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("beta schema migration", () => {
  it("creates the required tables", () => {
    const sql = allMigrationsSql();
    const tables = [
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

    for (const table of tables) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}`, "i"));
    }
  });

  it("aligns runtime assessment fields and unique marketing email", () => {
    const sql = allMigrationsSql();
    expect(sql).toMatch(/alter table public\.assessments[\s\S]*add column if not exists email text/i);
    expect(sql).toMatch(/product_consented_at/i);
    expect(sql).toMatch(/report_depth/i);
    expect(sql).toMatch(/alter table public\.analysis_runs[\s\S]*add column if not exists output jsonb/i);
    expect(sql).toMatch(/question_id/i);
    expect(sql).toMatch(/unique \(email\)/i);
  });
});
