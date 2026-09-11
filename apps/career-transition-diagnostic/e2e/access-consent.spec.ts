import { createHmac } from "node:crypto";
import { expect, test } from "./base";
import { adminLogin } from "./admin";

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
  expect(firstJson).not.toHaveProperty("accessToken");
  expect(JSON.stringify(firstJson)).not.toMatch(/accessToken/);
});

test("keeps marketing export empty when the opt-in stays unchecked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).click();
  await expect(page.getByRole("heading", { name: "Coaching, not therapy" })).toBeVisible();
  await expect(page.getByText("processed with artificial intelligence")).toBeVisible();
  await expect(page.getByText("Copy version product-consent.v1")).toBeVisible();
  await expect(page.locator("#marketing-opt-in")).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "Assessment" })).toHaveCount(0);
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  await expect(page.getByRole("heading", { name: "Situation" })).toBeVisible();
  await adminLogin(page);
  await page.goto("/admin/export");
  await expect(page.getByText("No current marketing opt-ins.")).toBeVisible();
});

test("privacy notice uses the same versioned product copy", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy for this diagnostic" })).toBeVisible();
  await expect(page.getByText("Copy versions product-consent.v1")).toBeVisible();
  await expect(page.getByText("Raw answers are kept for 90 days")).toBeVisible();
  await expect(page.getByText("This is optional and not required to take the assessment.")).toBeVisible();
});

test("retention cron rejects missing authorization", async ({ request }) => {
  const response = await request.get("/api/cron/retention");
  expect(response.status()).toBe(401);
});
