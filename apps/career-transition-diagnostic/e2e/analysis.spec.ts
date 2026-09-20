import { expect, test } from "./base";
import { adminLogin } from "./admin";
import { sendToLena, startAssessment } from "./questionnaire";

test("rejects unauthenticated analysis runs", async ({ request }) => {
  const response = await request.post("/api/analysis", {
    data: { assessmentId: "missing" },
  });
  expect(response.status()).toBe(401);
});

test("admin can run the analysis pipeline without delivering a report", async ({ page }) => {
  await startAssessment(page);
  await sendToLena(page);

  await adminLogin(page);
  const assessmentId = await page.locator("[data-assessment-id]").last().getAttribute("data-assessment-id");
  expect(assessmentId).toBeTruthy();
  await expect(page.locator("[data-analysis-status]").last()).toHaveAttribute(
    "data-analysis-status",
    "not started",
  );

  const response = await page.request.post("/api/analysis", {
    data: { assessmentId },
  });
  if (!response.ok()) {
    throw new Error(`analysis ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as {
    status: string;
    failedStage: string | null;
    sectionCount: number;
  };
  expect(body.status, JSON.stringify(body)).toBe("completed");
  expect(body.sectionCount).toBeGreaterThan(0);

  await page.goto("/mock/outbox");
  await expect(page.getByText("Your report is ready")).toHaveCount(0);
});
