import { describe, expect, it } from "vitest";
import { humanAnalysisStatus, humanSafetyLevel, humanStatus } from "./operator-copy";

describe("operator copy", () => {
  it("uses sentence-case labels instead of snake_case machine status", () => {
    expect(humanStatus("review_pending")).toBe("Waiting for review");
    expect(humanStatus("approved")).toBe("Approved");
    expect(humanStatus("deleted")).toBe("Access removed");
    expect(humanSafetyLevel("none")).toBe("None");
    expect(humanSafetyLevel("high")).toBe("High");
    expect(humanAnalysisStatus("not started")).toBe("Not started");
    expect(humanAnalysisStatus("completed")).toBe("Completed");
    expect(humanStatus("review_pending")).not.toContain("_");
  });
});
