export type PassTokenUsage = {
  stage: string;
  attempt: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
};

export type TokenUsageSummary = {
  passes: PassTokenUsage[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
  };
};

export function summarizePassTokenUsage(
  runs: Array<{
    stage: string;
    attempt: number;
    model: string;
    status: string;
    tokenUsage?: { inputTokens: number; outputTokens: number };
    costUsd?: number;
  }>,
): TokenUsageSummary {
  const passes = runs
    .filter((run) => run.status === "success")
    .map((run) => {
      const inputTokens = run.tokenUsage?.inputTokens ?? 0;
      const outputTokens = run.tokenUsage?.outputTokens ?? 0;
      return {
        stage: run.stage,
        attempt: run.attempt,
        model: run.model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsd: run.costUsd,
      };
    });

  const totals = passes.reduce(
    (acc, pass) => ({
      inputTokens: acc.inputTokens + pass.inputTokens,
      outputTokens: acc.outputTokens + pass.outputTokens,
      totalTokens: acc.totalTokens + pass.totalTokens,
      costUsd: Math.round((acc.costUsd + (pass.costUsd ?? 0)) * 1e6) / 1e6,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
  );

  return { passes, totals };
}

export function formatPassTokenUsageTable(summary: TokenUsageSummary): string {
  const header = "| Pass | Attempt | Model | Prompt | Completion | Total | Cost USD |";
  const sep = "| --- | ---: | --- | ---: | ---: | ---: | ---: |";
  const rows = summary.passes.map(
    (pass) =>
      `| ${pass.stage} | ${pass.attempt} | ${pass.model} | ${pass.inputTokens} | ${pass.outputTokens} | ${pass.totalTokens} | ${(pass.costUsd ?? 0).toFixed(4)} |`,
  );
  const footer = `| **total** |  |  | **${summary.totals.inputTokens}** | **${summary.totals.outputTokens}** | **${summary.totals.totalTokens}** | **${summary.totals.costUsd.toFixed(4)}** |`;
  return [header, sep, ...rows, footer].join("\n");
}
