export function isMockMode(): boolean {
  return process.env.APP_MODE === "mock";
}

export function isLiveLlmMode(): boolean {
  if (process.env.LLM_MODE === "live") return true;
  if (process.env.LLM_MODE === "mock") return false;
  return !isMockMode();
}

export function assertMockMode(feature = "This action") {
  if (!isMockMode()) {
    throw new Error(`${feature} is only available in mock mode`);
  }
}

export function afterDeliveryPath() {
  return isMockMode() ? "/mock/outbox" : "/admin?delivered=1";
}
