import { defineConfig, devices } from "@playwright/test";

const useDevServer = process.env.PLAYWRIGHT_DEV === "1";
const testPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: process.env.CI
        ? { ...devices["Desktop Chrome"] }
        : { channel: "chrome" },
    },
  ],
  webServer: {
    command: useDevServer
      ? `bun run dev -- --hostname 127.0.0.1 --port ${testPort}`
      : `bun run start -- --hostname 127.0.0.1 --port ${testPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      APP_MODE: "mock",
      // Local .env.local may set LLM_MODE=live; e2e must stay on fixtures.
      LLM_MODE: "",
    },
  },
});
