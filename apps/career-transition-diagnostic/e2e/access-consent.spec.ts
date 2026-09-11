import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

function sign(rawBody: string) {
  return createHmac("sha256", "mock-webhook-secret").update(rawBody).digest("hex");
}

test("rejects invalid webhook signatures and ignores replays", async ({ request }) => {
  const rawBody = JSON.stringify({
    meta: { event_name: "order_created", webhook_id: "wh-playwright-1" },
    data: {
      id: "order-playwright-1",
      attributes: { user_email: "webhook@example.com", status: "paid" },
    },
  });

  const invalid = await request.post("/api/webhooks/lemon-squeezy", {
    data: rawBody,
    headers: { "content-type": "application/json", "x-signature": "00" },
  });
  expect(invalid.status()).toBe(401);

  const headers = {
    "content-type": "application/json",
    "x-signature": sign(rawBody),
  };
  const first = await request.post("/api/webhooks/lemon-squeezy", { data: rawBody, headers });
  const replay = await request.post("/api/webhooks/lemon-squeezy", { data: rawBody, headers });
  const firstJson = await first.json();
  const replayJson = await replay.json();
  expect(first.ok()).toBeTruthy();
  expect(firstJson.created).toBe(true);
  expect(replayJson.created).toBe(false);
  expect(replayJson.assessmentId).toBe(firstJson.assessmentId);
});

test("keeps marketing export empty when the opt-in stays unchecked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).click();
  await expect(page.locator("#marketing-opt-in")).not.toBeChecked();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  await page.goto("/admin/export");
  await expect(page.getByText("No current marketing opt-ins.")).toBeVisible();
});
