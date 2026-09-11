import "server-only";

import { paymentsEnabled } from "@/config/launch-gate";
import type { CommerceAdapter, EmailAdapter, LlmAdapter } from "./types";

function missingLiveConfig(vendor: string): never {
  throw new Error(`${vendor} live adapter is not configured. Use APP_MODE=mock locally.`);
}

export const liveCommerceAdapter: CommerceAdapter = {
  async createCheckout() {
    if (!paymentsEnabled()) {
      throw new Error("Paid checkout is disabled until the launch gate is green.");
    }
    const checkoutUrl = process.env.LEMON_SQUEEZY_CHECKOUT_URL;
    if (!checkoutUrl) {
      missingLiveConfig("Lemon Squeezy");
    }
    return { checkoutUrl, orderId: "lemon-pending" };
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
