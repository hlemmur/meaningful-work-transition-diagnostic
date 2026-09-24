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

test("analysis form shows a pending state while its real server action is in flight", async ({
  page,
}) => {
  const assessmentId = "pending-state-regression";
  const restored = await page.request.post("/api/mock/restore-case", {
    data: {
      accessToken: "pending-state-access-token",
      assessmentId,
      email: "buyer@example.com",
      answers: {
        "Q1.1": "A fictional submitted case for the pending-state browser regression.",
      },
    },
  });
  expect(restored.ok()).toBe(true);

  await adminLogin(page);
  await page.goto(`/admin/${assessmentId}`);

  const submit = page.locator("[data-analysis-submit]");
  await expect(submit).toHaveText("Run analysis");
  let releaseRequest!: () => void;
  const requestCanFinish = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  const actionUrl = page.url();
  await page.route(actionUrl, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await requestCanFinish;
    await route.continue();
  });

  const actionResponse = page.waitForResponse(
    (response) => response.url() === actionUrl && response.request().method() === "POST",
  );
  const submission = submit.click();
  try {
    await expect(submit).toHaveText("Analysis running…");
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("aria-busy", "true");
  } finally {
    releaseRequest();
    const response = await actionResponse;
    await response.finished();
    await submission;
    await page.unroute(actionUrl);
  }
});
