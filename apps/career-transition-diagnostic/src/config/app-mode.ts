export function isMockMode(): boolean {
  return process.env.APP_MODE === "mock";
}
