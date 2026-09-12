import { describe, expect, it } from "vitest";
import { REQUIRED_PEEL_SECTION_IDS } from "@/engine/schemas/analysis";
import { evaluateReport } from "./rubric";

describe("evaluateReport evidence grounding", () => {
  const section = (id: string, body: string, evidenceRefs: string[]) => ({
    id: id as (typeof REQUIRED_PEEL_SECTION_IDS)[number],
    title: id,
    body,
    evidenceRefs,
  });

  it("fails when every section cites only one question id like the live miss", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: REQUIRED_PEEL_SECTION_IDS.map((id) =>
          section(
            id,
            "You seek sharp angles that you cannot unsee to shift perspective toward your vision.",
            ["a1:Q0.5"],
          ),
        ),
      },
      requestedInsight: "sharp angles that I can't unsee and will help me to shift my perspective",
    });
    expect(result.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "diverse-evidence-refs")?.passed).toBe(false);
    expect(result.findings.find((item) => item.id === "requested-insight-spine")?.passed).toBe(false);
  });

  it("passes a multi-ref peel report that is not Q11.3-only", () => {
    const result = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          section("problem", "The stall shows up as freezing when marketing the coaching offer.", [
            "a1:Q1.1",
          ]),
          section("reality", "Money pressure and ADHD constraints are part of the picture.", [
            "a1:Q0.4",
            "a1:Q0.5",
          ]),
          section("contradiction", "Wanting exposure and keeping the website secret sit together.", [
            "a1:Q1.1",
            "a1:Q1.3",
          ]),
          section("alternative", "A practical skill and structure gap may be enough without depth.", [
            "a1:Q0.5",
          ]),
          section("experiment", "Two weeks of external deadlines tests whether structure restores motion.", [
            "a1:Q1.1",
          ]),
        ],
      },
      requestedInsight: "sharp angles that I can't unsee",
    });
    expect(result.findings.find((item) => item.id === "diverse-evidence-refs")?.passed).toBe(true);
    expect(result.findings.find((item) => item.id === "requested-insight-spine")?.passed).toBe(true);
    expect(result.passed).toBe(true);
  });
});
