import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_HARD_CAP,
  ADAPTIVE_MAX_PER_FORK,
  ADAPTIVE_PREFERRED_MAX,
  validateAdaptivePlan,
} from "./adaptive";

describe("adaptive limits", () => {
  it("accepts a preferred plan of at most four questions and two per fork", () => {
    expect(
      validateAdaptivePlan([
        { checkpoint: "A", forkId: "history_vs_stated_cause" },
        { checkpoint: "B", forkId: "legitimacy_loop" },
        { checkpoint: "C", forkId: "work_vs_identity_vs_job_shape" },
        { checkpoint: "D", forkId: "rational_caution_vs_hidden_bargain" },
      ]),
    ).toEqual({ ok: true });
  });

  it("rejects more than two questions on the same fork", () => {
    expect(
      validateAdaptivePlan([
        { checkpoint: "A", forkId: "legitimacy_loop" },
        { checkpoint: "B", forkId: "legitimacy_loop" },
        { checkpoint: "C", forkId: "legitimacy_loop" },
      ]),
    ).toEqual({
      ok: false,
      reason: `max ${ADAPTIVE_MAX_PER_FORK} adaptive questions per fork`,
    });
  });

  it("rejects more than the hard cap of six", () => {
    const plan = Array.from({ length: 7 }, (_, index) => ({
      checkpoint: "A" as const,
      forkId: `fork-${index}`,
    }));

    expect(validateAdaptivePlan(plan)).toEqual({
      ok: false,
      reason: `hard cap ${ADAPTIVE_HARD_CAP}`,
    });
  });

  it("warns when preferred max of four is exceeded but hard cap is not", () => {
    expect(ADAPTIVE_PREFERRED_MAX).toBe(4);
    expect(
      validateAdaptivePlan([
        { checkpoint: "A", forkId: "a" },
        { checkpoint: "B", forkId: "b" },
        { checkpoint: "C", forkId: "c" },
        { checkpoint: "D", forkId: "d" },
        { checkpoint: "D", forkId: "e" },
      ]),
    ).toEqual({
      ok: false,
      reason: `preferred max ${ADAPTIVE_PREFERRED_MAX}`,
    });
  });
});
