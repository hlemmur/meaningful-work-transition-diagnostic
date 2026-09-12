import { describe, expect, it } from "vitest";
import { failingReportSectionIds } from "./report-grounding";

describe("failingReportSectionIds", () => {
  it("fails every section when the draft cites only one question id", () => {
    const ids = failingReportSectionIds({
      sections: [
        { id: "problem", body: "A concrete stall about marketing the offer.", evidenceRefs: ["a1:Q0.5"] },
        { id: "reality", body: "ADHD and money pressure sit in the picture.", evidenceRefs: ["a1:Q0.5"] },
        { id: "contradiction", body: "Wanting exposure and hiding the site.", evidenceRefs: ["a1:Q0.5"] },
      ],
    });
    expect(ids).toEqual(["problem", "reality", "contradiction"]);
  });

  it("fails every section when bodies are a requestedInsight spine", () => {
    const ids = failingReportSectionIds({
      sections: [
        {
          id: "problem",
          body: "You seek sharp angles that you cannot unsee to shift perspective.",
          evidenceRefs: ["a1:Q1.1", "a1:Q0.4", "a1:Q1.3"],
        },
        {
          id: "reality",
          body: "Sharp angles you cannot unsee will shift perspective toward vision.",
          evidenceRefs: ["a1:Q1.1", "a1:Q0.4"],
        },
        {
          id: "contradiction",
          body: "The need for sharp angles you cannot unsee remains the plot.",
          evidenceRefs: ["a1:Q1.3"],
        },
      ],
      requestedInsight: "sharp angles that I can't unsee and will help me to shift my perspective",
    });
    expect(ids).toEqual(["problem", "reality", "contradiction"]);
  });

  it("passes a grounded multi-ref draft", () => {
    const ids = failingReportSectionIds({
      sections: [
        {
          id: "problem",
          body: "The stall shows up as freezing when marketing the coaching offer to strangers.",
          evidenceRefs: ["a1:Q1.1"],
        },
        {
          id: "reality",
          body: "Money pressure and ADHD constraints are part of the practical picture here.",
          evidenceRefs: ["a1:Q0.4", "a1:Q0.5"],
        },
        {
          id: "contradiction",
          body: "Wanting exposure and keeping the website secret sit together in one pattern.",
          evidenceRefs: ["a1:Q1.3"],
        },
      ],
      requestedInsight: "sharp angles that I can't unsee",
    });
    expect(ids).toEqual([]);
  });
});
