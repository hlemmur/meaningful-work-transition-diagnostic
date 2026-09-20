import { expect, type Page } from "@playwright/test";

const syntheticStatedProblem =
  "A fictional participant is testing a meaningful career change through one small observable experiment.";

async function persistedAnswer(page: Page, questionId: string) {
  const response = await page.request.get("/api/mock/export-store");
  expect(response.ok()).toBe(true);
  const store = (await response.json()) as {
    assessments?: Array<{ answers?: Record<string, unknown> }>;
  };
  return store.assessments?.at(-1)?.answers?.[questionId];
}

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
  let seededStatedProblem = false;

  for (let step = 0; step < maxSteps; step += 1) {
    const statedProblem = page.locator("#Q1-1");
    if (!seededStatedProblem && (await statedProblem.isVisible())) {
      await statedProblem.fill(syntheticStatedProblem);
      await expect.poll(() => persistedAnswer(page, "Q1.1")).toBe(syntheticStatedProblem);
      seededStatedProblem = true;
    }

    const send = page.getByRole("button", { name: "Send to Lena" });
    if (await send.isVisible()) {
      await send.click();
      await page.getByRole("button", { name: "Confirm send" }).click();
      await expect(page.getByText(/Lena will review/)).toBeVisible();
      await expect.poll(() => persistedAnswer(page, "Q1.1")).toBe(syntheticStatedProblem);
      return;
    }
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled({ timeout: 20_000 });
    const questionPane = page.locator(".question-pane");
    const previousQuestion = await questionPane.textContent();
    await next.click();
    await expect
      .poll(() => questionPane.textContent(), { timeout: 20_000 })
      .not.toBe(previousQuestion);
    await expect(page.getByText(/Preparing the next part of your reflection/)).toHaveCount(0);
  }
  throw new Error("Did not reach Send to Lena");
}
