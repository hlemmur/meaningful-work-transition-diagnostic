import { afterEach, describe, expect, it } from "vitest";
import { POST as restoreCase } from "./route";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("mock restore-case route", () => {
  it("does not restore through the unauthenticated route when a durable store is configured", async () => {
    process.env.APP_MODE = "mock";
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const response = await restoreCase(
      new Request("http://127.0.0.1/api/mock/restore-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: "token",
          email: "buyer@example.com",
          answers: { "Q1.1": "no" },
        }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
