import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewQueueTable } from "./review-queue-table";

const row = {
  id: "a1",
  email: "buyer@example.com",
  status: "review_pending" as const,
  safetyLevel: "none" as const,
  analysisStatus: "completed",
};

describe("review queue table", () => {
  it("is a triage table with email and human status and no Approve control", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewQueueTable, { queue: [row] }),
    );

    expect(html).toContain("<table");
    expect(html).toContain("buyer@example.com");
    expect(html).toContain("Waiting for review");
    expect(html).toContain("None");
    expect(html).toContain("Completed");
    expect(html).toContain("Open case");
    expect(html).toContain("href=\"/admin/a1\"");
    expect(html).toContain("data-assessment-id=\"a1\"");
    expect(html).toContain("data-analysis-status=\"completed\"");
    expect(html).not.toContain("Approve report");
    expect(html).not.toContain("review_pending");
    expect(html).not.toContain("Marketing export");
  });
});
