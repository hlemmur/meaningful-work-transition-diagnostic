import { afterEach, describe, expect, it } from "vitest";
import { GET as retentionCron } from "@/app/api/cron/retention/route";
import { resetMockTracerStore } from "@/server/tracer/service";

afterEach(async () => {
  delete process.env.CRON_SECRET;
  await resetMockTracerStore();
});

describe("retention cron", () => {
  it("rejects requests without the cron secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const response = await retentionCron(new Request("http://127.0.0.1/api/cron/retention"));
    expect(response.status).toBe(401);
  });

  it("runs the purge when authorized", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const response = await retentionCron(
      new Request("http://127.0.0.1/api/cron/retention", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ purged: 0 });
  });
});
