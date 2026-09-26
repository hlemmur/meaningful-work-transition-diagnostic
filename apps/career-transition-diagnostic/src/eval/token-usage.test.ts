import { describe, expect, it } from "vitest";
import { formatPassTokenUsageTable, summarizePassTokenUsage } from "./token-usage";

describe("pass token usage summary", () => {
  it("aggregates successful passes and ignores failures", () => {
    const summary = summarizePassTokenUsage([
      {
        stage: "pass1",
        attempt: 1,
        model: "cheap",
        status: "success",
        tokenUsage: { inputTokens: 100, outputTokens: 40 },
        costUsd: 0.01,
      },
      {
        stage: "pass2",
        attempt: 1,
        model: "cheap",
        status: "failure",
        tokenUsage: { inputTokens: 50, outputTokens: 10 },
        costUsd: 0.002,
      },
      {
        stage: "pass9",
        attempt: 2,
        model: "strong",
        status: "success",
        tokenUsage: { inputTokens: 200, outputTokens: 80 },
        costUsd: 0.05,
      },
    ]);

    expect(summary.passes).toHaveLength(2);
    expect(summary.totals).toEqual({
      inputTokens: 300,
      outputTokens: 120,
      totalTokens: 420,
      costUsd: 0.06,
    });
  });

  it("formats a markdown table with totals", () => {
    const table = formatPassTokenUsageTable(
      summarizePassTokenUsage([
        {
          stage: "pass8",
          attempt: 1,
          model: "strong",
          status: "success",
          tokenUsage: { inputTokens: 10, outputTokens: 5 },
          costUsd: 0.0012,
        },
      ]),
    );
    expect(table).toContain("| Pass | Attempt | Model | Prompt | Completion | Total | Cost USD |");
    expect(table).toContain("| pass8 | 1 | strong | 10 | 5 | 15 | 0.0012 |");
    expect(table).toContain("| **total** |");
    expect(table).toContain("**15**");
  });
});
