import "server-only";

import { isMockMode } from "@/config/app-mode";
import { mockCommerceAdapter } from "./lemon/mock";
import { liveCommerceAdapter, liveEmailAdapter } from "./live";
import { liveLlmAdapter } from "./openai/live";
import { mockLlmAdapter } from "./openai/mock";
import { mockEmailAdapter } from "./resend/mock";
import type { VendorAdapters } from "./types";

export function createVendorAdapters(): VendorAdapters {
  if (isMockMode()) {
    return {
      commerce: mockCommerceAdapter,
      llm: mockLlmAdapter,
      email: mockEmailAdapter,
    };
  }

  return {
    commerce: liveCommerceAdapter,
    llm: liveLlmAdapter,
    email: liveEmailAdapter,
  };
}
