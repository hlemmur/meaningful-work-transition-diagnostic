import { expect, type Page } from "@playwright/test";
import { test } from "./base";
import { startAssessment } from "./questionnaire";

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

async function fillBackground(page: Page, text: string) {
  await advanceTo(page, /professional background/i);
  await page.locator("textarea").fill(text);
}

test("high safety shows support copy and skips depth probes after checkpoint A", async ({ page }) => {
  await startAssessment(page);
  await fillBackground(page, "I have suicidal thoughts and cannot function.");
  await advanceTo(page, /temporarily disappeared or became much easier/i);
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled({ timeout: 20000 });
  await next.click();
  await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  await expect(page.getByText(/contact local emergency services/i)).toBeVisible();
  await advanceTo(page, /worst thing you imagine could realistically happen/i);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/what would that mean about you/i)).toHaveCount(0);
});

test("checkpoint LLM failure still continues the form", async ({ page }) => {
  await startAssessment(page);
  await fillBackground(page, "FORCE_LLM_FAILURE");
  await advanceTo(page, /temporarily disappeared or became much easier/i);
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled({ timeout: 20000 });
  await next.click();
  await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  await expect(page.getByText(/Imagine that tomorrow you actually do this/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "If you actually did it" })).toBeVisible();
});
