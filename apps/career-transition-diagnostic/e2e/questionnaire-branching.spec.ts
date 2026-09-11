import { expect, type Page } from "@playwright/test";
import { test } from "./base";
import { sendToLena, startAssessment } from "./questionnaire";

async function advanceTo(page: Page, pattern: RegExp, maxSteps = 80) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.getByText(pattern).isVisible()) {
      return;
    }
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled({ timeout: 20000 });
    await next.click();
    await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  }
  throw new Error(`Did not reach ${pattern}`);
}

test("shows the optional nuance field after choosing other", async ({ page }) => {
  await startAssessment(page);
  await page.getByLabel("Other").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/don’t misread your situation/i)).toBeVisible();
});

test("uses focal fallback when no avoided actions are named", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /postponed, avoided, or abandoned/i);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/single next action/i)).toBeVisible();
});

test("asks which avoided action matters most when one is named", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /postponed, avoided, or abandoned/i);
  await page.getByLabel("Avoided action 1").fill("Send the website");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/matters most right now/i)).toBeVisible();
  await expect(page.getByLabel("Send the website")).toBeVisible();
});

test("asks what was different after a yes on temporary ease", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /temporarily disappeared or became much easier/i);
  await page.getByLabel("Yes").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/What was different then/i)).toBeVisible();
});

test("lets someone name one to three admired figures", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /envy, fascination, or longing/i);
  await page.getByLabel("Admired figure 1").fill("A working potter");
  await page.getByRole("button", { name: "Add another" }).click();
  await page.getByLabel("Admired figure 2").fill("A studio owner");
  await expect(page.getByLabel("Admired figure 2")).toHaveValue("A studio owner");
});

test("flushes a typed answer before submit so it is not lost", async ({ page }) => {
  await startAssessment(page);
  const next = page.getByRole("button", { name: "Next", exact: true });
  while (await next.isVisible()) {
    await expect(next).toBeEnabled({ timeout: 20_000 });
    await next.click();
    await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Send to Lena" })).toBeVisible();
  await page.locator("textarea").fill("I want the report to see the stall.");
  await page.getByRole("button", { name: "Send to Lena" }).click();
  await page.getByRole("button", { name: "Confirm send" }).click();
  await expect(page.getByText(/Lena will review/)).toBeVisible();
  await expect(page.locator("textarea")).toHaveValue("I want the report to see the stall.");
  await expect(page.locator("textarea")).toBeDisabled();
});

test("restores progress after refresh and locks answers after submit", async ({ page }) => {
  await startAssessment(page);
  await page.getByLabel("Other").check();
  await expect(async () => {
    await page.reload();
    await expect(page.getByLabel("Other")).toBeChecked();
  }).toPass();
  await expect(page.getByText("Saved.")).toHaveCount(0);
  await sendToLena(page);
  await expect(page.locator("input, textarea").first()).toBeDisabled();
});
