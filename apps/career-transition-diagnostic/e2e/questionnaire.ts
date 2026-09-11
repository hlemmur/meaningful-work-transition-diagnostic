import { expect, type Page } from "@playwright/test";

export async function startAssessment(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Begin the diagnostic" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).last().click();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  await expect(page.getByRole("heading", { name: "Situation" })).toBeVisible();
}

export async function sendToLena(page: Page, maxSteps = 120) {
  for (let step = 0; step < maxSteps; step += 1) {
    const send = page.getByRole("button", { name: "Send to Lena" });
    if (await send.isVisible()) {
      await send.click();
      await page.getByRole("button", { name: "Confirm send" }).click();
      await expect(page.getByText(/Lena will review/)).toBeVisible();
      return;
    }
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled({ timeout: 20_000 });
    await next.click();
    await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  }
  throw new Error("Did not reach Send to Lena");
}
