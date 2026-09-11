export function isMockMode(): boolean {
  return process.env.APP_MODE === "mock";
}

export function assertMockMode(feature = "This action") {
  if (!isMockMode()) {
    throw new Error(`${feature} is only available in mock mode`);
  }
}
