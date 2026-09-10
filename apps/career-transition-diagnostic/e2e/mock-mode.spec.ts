import { expect, test } from "@playwright/test";

test("customer and admin screens show the MOCK MODE badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
});

test("mock email outbox is available without live vendors", async ({ page }) => {
  await page.goto("/mock/outbox");
  await expect(page.getByRole("heading", { name: "Mock email outbox" })).toBeVisible();
});
