import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    await page.request.post("/api/mock/reset");
    await runFixture(page);
  },
  request: async ({ request }, runFixture) => {
    await request.post("/api/mock/reset");
    await runFixture(request);
  },
});

export { expect };
