import type { LlmAdapter } from "../types";

export const mockLlmAdapter: LlmAdapter = {
  async completeStructured({ stage }) {
    return {
      stage,
      fixture: `deterministic-${stage}`,
      output: { ok: true },
    };
  },
};
