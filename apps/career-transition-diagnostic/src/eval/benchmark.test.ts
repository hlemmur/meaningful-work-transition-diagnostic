import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artifactFromStore, scoreBenchmark, type BenchmarkStore } from "./benchmark";
import type { ScoreableArtifact } from "./persist-artifact";

const gold = JSON.parse(
  readFileSync(join(__dirname, "fixtures/origin-gold-mock-artifact.json"), "utf8"),
) as ScoreableArtifact;

describe("scoreBenchmark", () => {
  it("hard-passes the checked-in origin gold mock artifact", () => {
    const result = scoreBenchmark(gold);
    expect(result.frameworkHardPassed).toBe(true);
    expect(result.rubricPassed).toBe(true);
    expect(result.framework.softChecklistTemplate.map((item) => item.id)).toContain("surprise");
  });

  it("fails a report that diagnoses the person as an archetype", () => {
    const artifact: ScoreableArtifact = {
      ...gold,
      report: {
        ...gold.report,
        sections: gold.report.sections.map((section) =>
          section.id === "problem"
            ? { ...section, body: `${section.body} You are a puer.` }
            : section,
        ),
      },
    };
    const result = scoreBenchmark(artifact);
    expect(result.passed).toBe(false);
    expect(result.rubric.findings.find((item) => item.id === "puer-diagnosis")?.passed).toBe(false);
  });
});

describe("artifactFromStore", () => {
  it("builds a scoreable artifact from the latest stored report", () => {
    const store: BenchmarkStore = {
      assessments: [{ id: "origin-real-local", answers: gold.answers }],
      reports: [
        {
          assessmentId: "origin-real-local",
          status: "draft",
          engineVersion: gold.report.engineVersion,
          sections: gold.report.sections,
        },
      ],
      caseStateVersions: [
        { assessmentId: "origin-real-local", snapshot: gold.caseState },
      ],
    };
    const artifact = artifactFromStore(store, "origin-real-local");
    expect(artifact.meta.assessmentId).toBe("origin-real-local");
    expect(artifact.report.sections.length).toBe(gold.report.sections.length);
  });
});
