import { describe, expect, it } from "vitest";
import { visibleReportBody, visibleReportSection } from "./customer-prose";

describe("customer report prose", () => {
  it("removes filled and empty evidence-marker brackets from the live report phrasing", () => {
    const body = visibleReportBody(
      "You planned the transition [origin-case:Q0.1b, origin-case:Q2.4]. The call stopped [,,,, ]. A bare assessment:Q2.2 remains. Also [origin-real-local:Q1.3].",
    );

    expect(body).not.toContain("[origin-case:Q0.1b, origin-case:Q2.4]");
    expect(body).not.toContain("[,,,, ]");
    expect(body).not.toContain("assessment:Q2.2");
    expect(body).not.toContain("[origin-real-local:Q1.3]");
    expect(body).toContain("You planned the transition.");
    expect(body).toContain("The call stopped.");
    expect(body).toContain("A bare remains.");
    expect(body).toContain("Also.");
  });

  it("keeps evidenceRefs when the visible body is cleaned", () => {
    const section = {
      id: "problem",
      title: "The problem as you see it",
      body: "Stalled at execution [origin-case:Q0.3b, ].",
      evidenceRefs: ["origin-case:Q0.2", "origin-case:Q0.3b"],
    };

    const visible = visibleReportSection(section);

    expect(visible.body).toBe("Stalled at execution.");
    expect(visible.evidenceRefs).toEqual(["origin-case:Q0.2", "origin-case:Q0.3b"]);
    expect(section.evidenceRefs).toEqual(["origin-case:Q0.2", "origin-case:Q0.3b"]);
    expect(section.body).toContain("[origin-case:Q0.3b, ]");
  });

  it("does not delete ordinary brackets or a sentence with no marker", () => {
    expect(visibleReportBody("You called it [a tender romance].")).toBe(
      "You called it [a tender romance].",
    );
    expect(visibleReportBody("Keep the note [aside, for later] in place.")).toBe(
      "Keep the note [aside, for later] in place.",
    );
    expect(visibleReportBody("No marker in this sentence.")).toBe("No marker in this sentence.");
  });
});
