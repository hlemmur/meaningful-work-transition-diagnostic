import { expect, type Page } from "@playwright/test";

export async function adminLogin(page: Page, email = "lena@example.com") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
}
