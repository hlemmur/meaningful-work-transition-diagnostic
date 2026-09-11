import { expect, test } from "./base";
import { adminLogin } from "./admin";

test("walks the mock purchase-to-approved-report path", async ({ page }) => {
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

  await expect(page.getByText(/current situation/i)).toBeVisible();
  await expect(async () => {
    await page.getByLabel("employed considering").click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 5_000 });
  }).toPass();
  await expect(async () => {
    await page.reload();
    await expect(page.getByLabel("employed considering")).toBeChecked();
  }).toPass();

  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText(/Lena will review/)).toBeVisible();

  await adminLogin(page);
  await page.getByRole("link", { name: "Open case" }).last().click();
  await expect(page.getByRole("heading", { name: "Case review" })).toBeVisible();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByText("The problem as you see it")).toBeVisible();
  await page.getByRole("button", { name: "Approve report" }).click();

  await expect(page.getByText("Your report is ready").last()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "structure is being asked to serve aliveness",
  );
  await page.getByRole("link", { name: "Open report" }).last().click();
  await expect(page.getByRole("heading", { level: 1, name: "Private report" })).toBeVisible();
});
