import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FailedAnalysisNotice } from "./failed-analysis-notice";

describe("FailedAnalysisNotice", () => {
  it("shows the failed stage and a short Zod summary without the raw payload", () => {
    const html = renderToStaticMarkup(
      createElement(FailedAnalysisNotice, {
        stage: "pass3",
        error: "Schema validation failed for pass3: hypotheses: Too small: expected array to have >=3 items",
      }),
    );

    expect(html).toContain("Failed stage: pass3");
    expect(html).toContain("hypotheses");
    expect(html).toContain("Too small");
    expect(html).not.toContain("consciousExplanationTags");
  });

  it("renders nothing when analysis has not failed", () => {
    const html = renderToStaticMarkup(createElement(FailedAnalysisNotice, {}));
    expect(html).toBe("");
  });
});
