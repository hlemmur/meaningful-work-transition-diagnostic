import "server-only";

import type { CommerceAdapter, EmailAdapter, LlmAdapter } from "./types";

function missingLiveConfig(vendor: string): never {
  throw new Error(`${vendor} live adapter is not configured. Use APP_MODE=mock locally.`);
}

export const liveCommerceAdapter: CommerceAdapter = {
  async createCheckout() {
    missingLiveConfig("Lemon Squeezy");
  },
};

export const liveLlmAdapter: LlmAdapter = {
  async completeStructured() {
    missingLiveConfig("OpenAI");
  },
};

export const liveEmailAdapter: EmailAdapter = {
  async send() {
    missingLiveConfig("Resend");
  },
  listOutbox() {
    return [];
  },
};
