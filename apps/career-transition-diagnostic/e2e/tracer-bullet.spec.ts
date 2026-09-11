import { expect, test } from "@playwright/test";

test("walks the mock purchase-to-approved-report path", async ({ page }) => {
  const answer = "I left a career that still pays my bills.";

  await page.goto("/");
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();

  await expect(page.getByRole("heading", { name: "Mock email outbox" })).toBeVisible();
  await expect(page.getByText("Your assessment link").first()).toBeVisible();
  await page.getByRole("link", { name: "Open assessment" }).last().click();

  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await expect(page.locator("#marketing-opt-in")).not.toBeChecked();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();

  await page.getByLabel(/work\/career situation/).fill(answer);
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/work\/career situation/)).toHaveValue(answer);

  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText(/Lena will review/)).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await page.getByRole("button", { name: "Approve report" }).click();

  await expect(page.getByText("Your report is ready")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "structure is being asked to serve aliveness",
  );
  await page.getByRole("link", { name: "Open report" }).click();
  await expect(page.getByRole("heading", { name: "Private report" })).toBeVisible();
});
