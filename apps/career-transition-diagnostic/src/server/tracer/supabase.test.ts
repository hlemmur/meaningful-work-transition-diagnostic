import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRACER_TABLES, createEmptyTables } from "./mapper";
import { SupabaseTracerDb } from "./supabase";

type Row = Record<string, unknown>;

function createCappedClient(tables: Record<string, Row[]>, maxRows: number) {
  return {
    from(table: string) {
      const rows = [...(tables[table] ?? [])].sort((left, right) =>
        String(left.id).localeCompare(String(right.id)),
      );
      return {
        select(_columns: string, options?: { count?: "exact" | "planned" | "estimated" }) {
          const result = {
            order() {
              return result;
            },
            range(from: number, to: number) {
              const page = rows.slice(from, to + 1).slice(0, maxRows);
              return Promise.resolve({
                data: page,
                error: null,
                count: options?.count ? rows.length : null,
              });
            },
            then(
              resolve: (value: unknown) => unknown,
              reject?: (reason: unknown) => unknown,
            ) {
              return Promise.resolve({
                data: rows.slice(0, maxRows),
                error: null,
                count: options?.count ? rows.length : null,
              }).then(resolve, reject);
            },
          };
          return result;
        },
      };
    },
  } as unknown as SupabaseClient;
}

function seedAnswers(count: number) {
  const tables = createEmptyTables();
  tables.assessment_answers = Array.from({ length: count }, (_, index) => ({
    id: `ans-${String(index).padStart(4, "0")}`,
    assessment_id: "a1",
    question_id: `Q${index}`,
    answer: `value-${index}`,
  }));
  return tables;
}

describe("SupabaseTracerDb.loadAll", () => {
  it("keeps every row when the Data API caps each select below the table size", async () => {
    const seeded = seedAnswers(5);
    const db = new SupabaseTracerDb(createCappedClient(seeded, 2));

    const loaded = await db.loadAll();

    expect(loaded.assessment_answers.map((row) => row.question_id)).toEqual(
      seeded.assessment_answers.map((row) => row.question_id),
    );
  });

  it("does not invent rows for empty tables", async () => {
    const db = new SupabaseTracerDb(createCappedClient(createEmptyTables(), 2));

    const loaded = await db.loadAll();

    for (const table of TRACER_TABLES) {
      expect(loaded[table]).toEqual([]);
    }
  });

  it("does not drop a short final page after a full page", async () => {
    const seeded = seedAnswers(3);
    const db = new SupabaseTracerDb(createCappedClient(seeded, 2));

    const loaded = await db.loadAll();

    expect(loaded.assessment_answers).toHaveLength(3);
    expect(loaded.assessment_answers.at(-1)?.question_id).toBe("Q2");
  });

  it("crosses the default PostgREST 1000-row cap without losing answers", async () => {
    const seeded = seedAnswers(1001);
    const db = new SupabaseTracerDb(createCappedClient(seeded, 1000));

    const loaded = await db.loadAll();

    expect(loaded.assessment_answers).toHaveLength(1001);
    expect(loaded.assessment_answers[1000]?.question_id).toBe("Q1000");
  });
});
