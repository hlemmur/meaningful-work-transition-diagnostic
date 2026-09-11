import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(process.cwd());

const SURFACES = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/a/[token]/page.tsx",
  "src/app/r/[token]/page.tsx",
  "src/questionnaire/QuestionnaireFlow.tsx",
  "src/app/globals.css",
];

describe("no answer-bearing third-party analytics", () => {
  it("does not load analytics pixels or trackers on customer surfaces", () => {
    const blob = SURFACES.map((file) => readFileSync(resolve(ROOT, file), "utf8")).join("\n");
    expect(blob).not.toMatch(
      /gtag\(|googletagmanager|google-analytics|plausible\.io|mixpanel|segment\.com|posthog|hotjar|analytics\.js/i,
    );
  });
});
