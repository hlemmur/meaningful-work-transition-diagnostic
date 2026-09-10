import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260911000000_beta_tables.sql",
);

describe("beta schema migration", () => {
  it("creates the required tables", () => {
    const sql = readFileSync(MIGRATION, "utf8");
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
});
