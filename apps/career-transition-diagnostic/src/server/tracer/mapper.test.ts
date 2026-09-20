import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { createEmptyTables, tablesToStore } from "./mapper";

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
