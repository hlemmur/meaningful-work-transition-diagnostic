import { expect, type Page, test } from "@playwright/test";

async function startAssessment(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).last().click();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
}

async function advanceTo(page: Page, pattern: RegExp, maxSteps = 80) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.getByText(pattern).isVisible()) {
      return;
    }
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (await next.isDisabled()) {
      throw new Error(`Stopped before matching ${pattern}`);
    }
    await next.click();
  }
  throw new Error(`Did not reach ${pattern}`);
}

test("shows the optional nuance field after choosing other", async ({ page }) => {
  await startAssessment(page);
  await page.getByLabel("other").check();
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
  await page.getByRole("button", { name: "Add another" }).click();
  await page.getByLabel("Avoided action 1").fill("Send the website");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/matters most right now/i)).toBeVisible();
  await expect(page.getByLabel("Send the website")).toBeVisible();
});

test("asks what was different after a yes on temporary ease", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /temporarily disappeared or became much easier/i);
  await page.getByLabel("yes").check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/What was different then/i)).toBeVisible();
});

test("lets someone name one to three admired figures", async ({ page }) => {
  await startAssessment(page);
  await advanceTo(page, /envy, fascination, or longing/i);
  await page.getByLabel("Admired figure 1").fill("A working potter");
  await page.getByRole("button", { name: "Add another" }).click();
  await page.getByLabel("Admired figure 2").fill("A studio owner");
  await expect(page.getByText("Saving…").or(page.getByText("Saved."))).toBeVisible();
});

test("restores progress after refresh and locks answers after submit", async ({ page }) => {
  await startAssessment(page);
  await page.getByLabel("other").check();
  await expect(async () => {
    await page.reload();
    await expect(page.getByLabel("other")).toBeChecked();
  }).toPass();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText(/Lena will review/)).toBeVisible();
  await expect(page.getByLabel("other")).toBeDisabled();
});
