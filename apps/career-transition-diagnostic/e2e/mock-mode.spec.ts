import { expect, test } from "./base";
import { adminLogin } from "./admin";

test("customer and admin screens show the MOCK MODE badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await expect(page.getByRole("status", { name: "FIXTURE LLM" })).toBeVisible();

  await adminLogin(page);
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await expect(page.getByRole("status", { name: "FIXTURE LLM" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
});

test("mock email outbox is available without live vendors", async ({ page }) => {
  await page.goto("/mock/outbox");
  await expect(page.getByRole("heading", { name: "Mock email outbox" })).toBeVisible();
});
