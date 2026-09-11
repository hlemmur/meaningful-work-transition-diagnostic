import "server-only";

import { isLiveLlmMode, isMockMode } from "@/config/app-mode";
import { mockCommerceAdapter } from "./lemon/mock";
import { liveCommerceAdapter } from "./live";
import { liveEmailAdapter } from "./resend/live";
import { liveLlmAdapter } from "./gemini/live";
import { mockLlmAdapter } from "./openai/mock";
import { mockEmailAdapter } from "./resend/mock";
import type { VendorAdapters } from "./types";

export function createVendorAdapters(): VendorAdapters {
  return {
    commerce: isMockMode() ? mockCommerceAdapter : liveCommerceAdapter,
    llm: isLiveLlmMode() ? liveLlmAdapter : mockLlmAdapter,
    email: isMockMode() ? mockEmailAdapter : liveEmailAdapter,
  };
}
