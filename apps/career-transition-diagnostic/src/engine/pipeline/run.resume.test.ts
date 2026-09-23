import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { executeAnalysis } from "./run";

const originAnswers = JSON.parse(
  readFileSync(
    join(__dirname, "../test-support/fixtures/origin-case-answers.json"),
    "utf8",
  ),
) as Record<string, unknown>;

describe("analysis resume extraction", () => {
  it("does not drop contradiction-derived open forks when later passes resume", async () => {
    const previous = extractCaseStateFull("resume-forks", originAnswers);
    previous.openForks = [
      "container_loss_vs_capacity",
      "history_vs_stated_cause",
      "rational_caution_vs_hidden_bargain",
      "background_income_relief_vs_replacement",
    ];
    previous.hypotheses = [
      {
        id: "hyp-depth",
        title: "Container loss",
        category: "psychological",
        observedPattern: "Action appears when someone else holds the frame.",
        evidenceFor: ["resume-forks:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["container_loss_vs_capacity"],
        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.7,
          contradictionResolution: 0.7,
          personSpecificity: 0.6,
          developmentalFit: 0.5,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0,
          simplerAlternativePenalty: 0,
        },
        confidence: "moderate",
      },
    ];

    const result = await executeAnalysis({
      assessmentId: "resume-forks",
      answers: originAnswers,
      previousCaseState: previous,
      completedStages: [
        "pass1",
        "pass2",
        "pass3",
        "pass4",
        "pass5",
        "pass6",
        "pass7",
      ],
      llm: mockLlmAdapter,
      persistRun() {},
      persistCaseState() {},
    });

    expect(result.caseState.openForks).toEqual(
      expect.arrayContaining([
        "container_loss_vs_capacity",
        "history_vs_stated_cause",
      ]),
    );
  });
});
