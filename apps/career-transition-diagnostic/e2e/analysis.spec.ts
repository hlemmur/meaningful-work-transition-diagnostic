import { expect, test } from "@playwright/test";

test("admin can run the analysis pipeline without delivering a report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).last().click();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByText(/Lena will review/)).toBeVisible();

  await page.goto("/admin");
  const assessmentId = await page.locator("[data-assessment-id]").last().getAttribute("data-assessment-id");
  expect(assessmentId).toBeTruthy();

  const response = await page.request.post("/api/analysis", {
    data: { assessmentId },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { status: string; sectionCount: number };
  expect(body.status).toBe("completed");
  expect(body.sectionCount).toBeGreaterThan(0);

  await page.goto("/mock/outbox");
  await expect(page.getByText("Your report is ready")).toHaveCount(0);
});
