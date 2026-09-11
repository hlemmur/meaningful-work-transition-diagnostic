import { expect, test } from "./base";
import { adminLogin } from "./admin";
import { sendToLena, startAssessment } from "./questionnaire";

test("walks the mock purchase-to-approved-report path", async ({ page }) => {
  await startAssessment(page);
  await expect(page.getByRole("status", { name: "MOCK MODE" })).toBeVisible();
  await expect(page.getByText("Situation · 1 of")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit assessment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send to Lena" })).toHaveCount(0);

  await expect(async () => {
    await page.getByLabel("Employed, considering a change").click();
    await expect(page.getByLabel("Employed, considering a change")).toBeChecked({ timeout: 5_000 });
  }).toPass();
  await expect(page.getByText("Saved.")).toHaveCount(0);
  await expect(async () => {
    await page.reload();
    await expect(page.getByLabel("Employed, considering a change")).toBeChecked();
  }).toPass();

  await sendToLena(page);

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
