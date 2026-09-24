import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const formState = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: () => ({
      pending: formState.pending,
      data: null,
      method: null,
      action: null,
    }),
  };
});

import { AnalysisSubmitButton } from "./analysis-submit-button";

describe("AnalysisSubmitButton", () => {
  beforeEach(() => {
    formState.pending = false;
  });

  it("uses the correct idle action label", () => {
    expect(
      renderToStaticMarkup(createElement(AnalysisSubmitButton, { resume: false })),
    ).toContain("Run analysis");
    expect(
      renderToStaticMarkup(createElement(AnalysisSubmitButton, { resume: true })),
    ).toContain("Resume analysis");
  });

  it("shows a disabled running state while the analysis action is pending", () => {
    formState.pending = true;

    const html = renderToStaticMarkup(
      createElement(AnalysisSubmitButton, { resume: true }),
    );

    expect(html).toContain("Analysis running…");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("Resume analysis");
  });
});
