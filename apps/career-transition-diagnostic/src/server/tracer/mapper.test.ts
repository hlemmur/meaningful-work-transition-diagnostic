import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import type { AnalysisRunRecord } from "@/engine/pipeline/run";
import {
  createEmptyTables,
  lastRunsByIdempotencyKey,
  storeToTables,
  tablesToStore,
  uniqueIdempotencyKey,
} from "./mapper";
import { createEmptyTracerStore } from "./records";

function run(overrides: Partial<AnalysisRunRecord>): AnalysisRunRecord {
  return {
    assessmentId: "a1",
    stage: "pass3",
    attempt: 1,
    promptVersion: "pass-3",
    model: "mock",
    status: "failure",
    idempotencyKey: "a1:pass3:failure",
    ...overrides,
  };
}

describe("tablesToStore", () => {
  it("normalizes a persisted legacy final formulation on resume", () => {
    const snapshot = emptyCaseState("legacy");
    (snapshot as unknown as Record<string, unknown>).finalFormulation = {
      selectedHypothesisId: "hyp-legacy",
      centralFormulation: "External structure carried action.",
      whyItFits: ["legacy:Q2.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "A job-shape mismatch.",
      unresolvedForks: [],
    };
    const tables = createEmptyTables();
    tables.case_state_versions.push({
      assessment_id: "legacy",
      stage: "pass6",
      snapshot,
      created_at: "2026-09-21T00:00:00.000Z",
    });

    const restored = tablesToStore(tables).caseStateVersions[0]?.snapshot;

    expect(restored?.finalFormulation?.maintenanceFormulation).toBe(
      "External structure carried action.",
    );
    expect(restored?.finalFormulation?.maintenanceMechanism.response).toBe(
      "External structure carried action.",
    );
  });
});

describe("analysis run idempotency keys", () => {
  it("keeps the latest run when two rows share an idempotency key", () => {
    const collapsed = lastRunsByIdempotencyKey([
      run({ error: "first", createdAt: "2026-09-24T00:00:00.000Z" }),
      run({ error: "second", attempt: 2, createdAt: "2026-09-24T00:01:00.000Z" }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.error).toBe("second");
    expect(collapsed[0]?.attempt).toBe(2);
  });

  it("leaves a new key unchanged and suffixes a colliding key", () => {
    const existing = [run({ idempotencyKey: "a1:pass3:failure" })];
    expect(uniqueIdempotencyKey(existing, "a1:pass1:success")).toBe("a1:pass1:success");
    expect(uniqueIdempotencyKey(existing, "a1:pass3:failure")).toMatch(
      /^a1:pass3:failure:[0-9a-f-]{36}$/,
    );
  });

  it("does not drop runs that already have distinct keys", () => {
    const collapsed = lastRunsByIdempotencyKey([
      run({ stage: "pass1", status: "success", idempotencyKey: "a1:pass1:success" }),
      run({ error: "schema", idempotencyKey: "a1:pass3:failure" }),
    ]);

    expect(collapsed.map((item) => item.idempotencyKey)).toEqual([
      "a1:pass1:success",
      "a1:pass3:failure",
    ]);
  });

  it("emits one analysis_runs row per key so snapshot replace cannot violate uniqueness", () => {
    const store = createEmptyTracerStore();
    store.analysisRuns.push(
      run({ stage: "pass1", status: "success", idempotencyKey: "a1:pass1:success" }),
      run({ error: "first", createdAt: "t1" }),
      run({ error: "second", attempt: 2, createdAt: "t2" }),
    );

    const rows = storeToTables(store).analysis_runs;
    const keys = rows.map((row) => row.idempotency_key);

    expect(keys).toEqual(["a1:pass1:success", "a1:pass3:failure"]);
    expect(rows.find((row) => row.idempotency_key === "a1:pass3:failure")?.error).toBe("second");
  });
});
