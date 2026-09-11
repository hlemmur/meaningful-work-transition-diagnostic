import { afterEach, describe, expect, it } from "vitest";
import { POST as mockReset } from "./route";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("mock reset route", () => {
  it("resets the in-memory store in mock mode", async () => {
    process.env.APP_MODE = "mock";
    const response = await mockReset();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not wipe a durable store through the unauthenticated mock reset", async () => {
    process.env.APP_MODE = "mock";
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const response = await mockReset();
    expect(response.status).toBe(404);
  });
});
