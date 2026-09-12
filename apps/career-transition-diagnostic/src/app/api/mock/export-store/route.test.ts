import { afterEach, describe, expect, it } from "vitest";
import { GET as exportStore } from "./route";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("mock export-store route", () => {
  it("does not export a durable store through the unauthenticated route", async () => {
    process.env.APP_MODE = "mock";
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const response = await exportStore();
    expect(response.status).toBe(404);
  });
});
