import { expect, test } from "./base";
import { adminLogin } from "./admin";

test("keeps unapproved reports off the customer link and delivers after review", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Continue in mock checkout" }).click();
  await page.getByRole("button", { name: "Complete mock purchase" }).click();
  await page.getByRole("link", { name: "Open assessment" }).last().click();
  await page.locator("#product-consent").check();
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(page.getByText(/Lena will review/)).toBeVisible({ timeout: 5_000 });
  }).toPass();

  const blocked = await page.goto("/r/not-a-real-report-token");
  expect(blocked?.status()).toBe(404);

  await adminLogin(page);
  await page.getByRole("link", { name: "Open case" }).last().click();
  await expect(page.getByRole("heading", { name: "Case review" })).toBeVisible();
  await expect(page.getByText("Analysis: not started").first()).toBeVisible();
  const caseUrl = page.url();
  await page.getByRole("button", { name: "Run analysis" }).click();
  await expect(page.getByText("The problem as you see it")).toBeVisible();
  await expect(page.getByText(/Evidence:/).first()).toBeVisible();
  await page.locator("textarea").first().fill("Edited hypothesis language only.");
  await page.getByRole("button", { name: "Save edits" }).click();

  await page.getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByText("Your report is ready").last()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Edited hypothesis language only.");
  const reportLink = page.getByRole("link", { name: "Open report" }).last();
  const href = await reportLink.getAttribute("href");
  await reportLink.click();
  await expect(page.getByRole("heading", { level: 1, name: "Private report" })).toBeVisible();
  await expect(page.getByText("Edited hypothesis language only.")).toBeVisible();
  await expect(page.locator("[data-coaching-cta]")).toBeVisible();
  await expect(page.getByText(/save a PDF/i)).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-coaching-cta]")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.goto(caseUrl);
  await expect(page.getByRole("heading", { name: "Case review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete access" })).toBeVisible();
  await page.getByRole("button", { name: "Delete access" }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  const revoked = await page.goto(href ?? "/r/missing");
  expect(revoked?.status()).toBe(404);
});

test("sends operators without a session to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Operator sign in" })).toBeVisible();
});
