import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { executeAnalysis } from "./run";
import { buildStageLlmInput } from "./stage-input";
import type { CaseState } from "../schemas/case-state";
import type { LlmAdapter } from "@/server/adapters/types";

function peelSections(assessmentId = "a1") {
  const q = (id: string) => `${assessmentId}:${id}`;
  return [
    {
      id: "problem",
      title: "The problem as you see it",
      body: "You stall when marketing your coaching offer — an identity bind after leaving IT.",
      evidenceRefs: [q("Q1.1")],
    },
    {
      id: "reality",
      title: "What reality says",
      body: "Your ADHD constraints and missing structure are part of the picture.",
      evidenceRefs: [q("Q0.4"), q("Q0.5")],
    },
    {
      id: "contradiction",
      title: "The contradiction at the center",
      body: "You want freedom and still keep the offer secret.",
      evidenceRefs: [q("Q1.1"), q("Q1.3")],
    },
    {
      id: "alternative",
      title: "Another plausible interpretation",
      body: "Your stall may be a practical skill gap, not a hidden stance.",
      evidenceRefs: [q("Q0.5")],
    },
    {
      id: "experiment",
      title: "Your experiment",
      body: "For two weeks, run your outreach under external deadlines and watch charge.",
      evidenceRefs: [q("Q1.1")],
    },
  ];
}

function seededCase(assessmentId = "a1"): CaseState {
  const state = emptyCaseState(assessmentId);
  state.consciousNarrative.statedProblem = [
    {
      id: `${assessmentId}:Q1.1`,
      assessmentId,
      questionId: "Q1.1",
      rawQuote: "I quit IT and freeze on marketing my coaching.",
      normalizedMeaning: "I quit IT and freeze on marketing my coaching.",
      evidenceType: "self_interpretation",
    },
  ];
  state.practicalContext.constraints = [
    {
      id: `${assessmentId}:Q0.5`,
      assessmentId,
      questionId: "Q0.5",
      rawQuote: "I have ADHD",
      normalizedMeaning: "I have ADHD",
      evidenceType: "practical_constraint",
    },
  ];
  state.contradictions = [
    {
      id: "c1",
      statementA: "I want freedom through coaching",
      statementB: "I keep the offer secret",
      evidenceA: [`${assessmentId}:Q1.1`],
      evidenceB: [`${assessmentId}:Q1.1`],
      significance: "central",
      categories: ["identity"],
      originForks: ["work_vs_identity_vs_job_shape"],
      scores: {
        evidenceStrength: 0.8,
        recurrence: 0.7,
        explanatoryImportance: 0.9,
        charge: 0.8,
      },
    },
  ];
  state.hypotheses = [
    {
      id: "h1",
      title: "Structure as aliveness proxy",
      category: "developmental",
      observedPattern: "Avoids exposure that would make the new role real",
      evidenceFor: [`${assessmentId}:Q1.1`],
      evidenceAgainst: [],
      contradictionsExplained: ["c1"],
      contradictionsNotExplained: [],
      simplerAlternatives: ["skill gap only"],
      missingInformation: [],
      originForks: ["work_vs_identity_vs_job_shape"],
      scoring: {
        evidenceCoverage: 0.7,
        crossContextRecurrence: 0.6,
        contradictionResolution: 0.7,
        personSpecificity: 0.8,
        developmentalFit: 0.7,
        imageConstraintFit: 0.5,
        counterEvidencePenalty: 0.1,
        simplerAlternativePenalty: 0.2,
      },
      confidence: "moderate",
    },
  ];
  state.userFinalReflection.requestedInsight = "sharp angles I cannot unsee";
  return state;
}

describe("buildStageLlmInput", () => {
  it("adds Tier-A case snapshot for pass2+ including early analysis passes", () => {
    const state = seededCase();
    state.projections.admiredFigures = [
      {
        id: "a1:Q5.1:fig",
        figure: "A grounded mentor",
        wantedQuality: "claims space",
        evidenceRefs: ["a1:Q5.1"],
      },
    ];
    state.money.easyMoneyHistory = [
      {
        id: "a1:Q8.2",
        assessmentId: "a1",
        questionId: "Q8.2",
        rawQuote: "Money arrived through industry demand",
        normalizedMeaning: "Money arrived through industry demand",
        evidenceType: "history",
      },
    ];
    state.symbolicMaterial.scene = "A rusty pipe";
    const input = buildStageLlmInput({
      stage: "pass2",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "long answer", "Q11.3": "sharp angles" },
      fixture: "happy",
    });
    const snapshot = input.caseSnapshot as Record<string, unknown>;
    expect(snapshot).toBeDefined();
    expect(snapshot.tierA).toEqual(
      expect.objectContaining({
        image: expect.objectContaining({ scene: "A rusty pipe" }),
      }),
    );
    expect(String(snapshot.requestedInsightNote)).toMatch(/not the report spine/i);
    expect(input.requestedInsight).toBe("sharp angles I cannot unsee");
  });

  it("exposes Tier-A citeRefs and requiredCitations so pass9 can satisfy hard gates", () => {
    const state = seededCase("a1");
    state.symbolicMaterial = {
      scene: "A rusty pipe across a threshold",
      surroundings: "Muddy water",
      obstacleSpeech: "Stay mid-crossing",
    };
    state.projections.admiredFigures = [
      {
        id: "a1:Q5.1:fig",
        figure: "A grounded mentor",
        wantedQuality: "claims space",
        evidenceRefs: ["a1:Q5.1"],
      },
    ];
    state.projections.rejectedFigures = [
      {
        id: "a1:Q6.1:fig",
        figure: "A hustler",
        judgedQuality: "sells air",
        evidenceRefs: ["a1:Q6.1"],
      },
    ];
    state.money.easyMoneyHistory = [
      {
        id: "a1:Q8.2",
        assessmentId: "a1",
        questionId: "Q8.2",
        rawQuote: "Money arrived through industry demand",
        normalizedMeaning: "Money arrived through industry demand",
        evidenceType: "history",
      },
    ];

    const snapshot = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: {
        "Q1.1": "stall",
        "Q5.1": "mentor",
        "Q6.1": "hustler",
        "Q8.2": "industry money",
        "Q10.1": "A rusty pipe",
        "Q10.2": "Muddy water",
        "Q10.6": "Stay mid-crossing",
      },
    }).caseSnapshot as {
      evidenceAllowlist: string[];
      tierA: {
        image: { citeRefs: string[] };
        projections: { admired: Array<{ evidenceRefs: string[] }> };
        money: { citeRefs: string[] };
      };
      requiredCitations: {
        image: { mustCiteIn: string[]; refs: string[] };
        projection: { mustCiteIn: string[]; refs: string[] };
        money: { mustCiteIn: string[]; refs: string[] };
      };
    };

    expect(snapshot.tierA.image.citeRefs).toEqual(
      expect.arrayContaining(["a1:Q10.1", "a1:Q10.2", "a1:Q10.6"]),
    );
    expect(snapshot.tierA.projections.admired[0]?.evidenceRefs).toContain("a1:Q5.1");
    expect(snapshot.tierA.money.citeRefs).toContain("a1:Q8.2");
    expect(snapshot.evidenceAllowlist).toEqual(
      expect.arrayContaining(["a1:Q10.1", "a1:Q5.1", "a1:Q6.1", "a1:Q8.2"]),
    );
    expect(snapshot.requiredCitations.image).toEqual({
      mustCiteIn: ["reality", "hidden"],
      refs: expect.arrayContaining(["a1:Q10.1", "a1:Q10.6"]),
    });
    expect(snapshot.requiredCitations.projection).toEqual({
      mustCiteIn: ["contradiction", "hidden"],
      refs: expect.arrayContaining(["a1:Q5.1", "a1:Q6.1"]),
    });
    expect(snapshot.requiredCitations.money).toEqual({
      mustCiteIn: ["reality", "alternative"],
      refs: expect.arrayContaining(["a1:Q8.2"]),
    });
  });

  it("adds a bounded case snapshot for pass9 and pass10", () => {
    const answers = {
      "Q0.5": "I have ADHD",
      "Q1.1": "I quit IT and freeze on marketing my coaching.",
      "Q11.3": "sharp angles I cannot unsee",
    };
    const forPass9 = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q0.5",
      caseState: seededCase(),
      answers,
      fixture: "happy",
    });
    const snapshot = forPass9.caseSnapshot as Record<string, unknown>;
    expect(snapshot).toEqual(
      expect.objectContaining({
        evidenceAllowlist: expect.arrayContaining(["a1:Q1.1", "a1:Q0.5"]),
        contradictions: [
          expect.objectContaining({
            id: "c1",
            statementA: "I want freedom through coaching",
          }),
        ],
        hypotheses: [
          expect.objectContaining({
            id: "h1",
            title: "Structure as aliveness proxy",
            observedPattern: "Avoids exposure that would make the new role real",
          }),
        ],
      }),
    );
    expect(snapshot.answersByQuestionId).toEqual(
      expect.objectContaining({
        "Q1.1": "I quit IT and freeze on marketing my coaching.",
        "Q0.5": "I have ADHD",
      }),
    );
    expect(snapshot.requestedInsightNote).toMatch(/not the report spine/i);

    const forPass10 = buildStageLlmInput({
      stage: "pass10",
      assessmentId: "a1",
      evidenceRef: "a1:Q0.5",
      caseState: seededCase(),
      answers,
      draftReport: {
        sections: [
          {
            id: "problem",
            title: "problem",
            body: "thin paraphrase of sharp angles I cannot unsee",
            evidenceRefs: ["a1:Q0.5"],
          },
        ],
      },
    });
    expect(forPass10.caseSnapshot).toBeTruthy();
    expect(forPass10.draftReport).toEqual({
      sections: [
        expect.objectContaining({
          id: "problem",
          evidenceRefs: ["a1:Q0.5"],
        }),
      ],
    });
  });

  it("wires pass10 executeAnalysis input with draftReport for the critic", async () => {
    const captured: Array<{ stage: string; input: Record<string, unknown> }> = [];
    const llm: LlmAdapter = {
      async completeStructured(request) {
        captured.push({ stage: request.stage, input: request.input });
        if (request.stage === "pass9") {
          return {
            stage: request.stage,
            fixture: "happy",
            output: {
              sections: peelSections("a1"),
            },
            model: request.model ?? "mock-strong",
            usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
          };
        }
        return {
          stage: request.stage,
          fixture: "happy",
          output: { failingSectionIds: [], regeneratedSections: [] },
          model: request.model ?? "mock-cheap",
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
        };
      },
    };

    await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase("a1"),
      completedStages: ["pass1", "pass2", "pass3", "pass4", "pass5", "pass6", "pass7", "pass8"],
      llm,
      persistRun() {},
      persistCaseState() {},
    });

    const pass10 = captured.find((item) => item.stage === "pass10");
    expect(pass10?.input).toEqual(
      expect.objectContaining({
        draftReport: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ id: "problem", evidenceRefs: ["a1:Q1.1"] }),
          ]),
        }),
        caseSnapshot: expect.objectContaining({
          evidenceAllowlist: expect.arrayContaining(["a1:Q1.1"]),
        }),
      }),
    );
  });

  it("trims long answer strings so the snapshot stays bounded", () => {
    const long = "x".repeat(2000);
    const input = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: seededCase(),
      answers: { "Q1.1": long, "Q2.1": long, "Q3.1": long },
    });
    const answers = (input.caseSnapshot as { answersByQuestionId: Record<string, string> })
      .answersByQuestionId;
    expect(answers["Q1.1"]!.length).toBeLessThanOrEqual(420);
    expect(Object.keys(answers).length).toBeLessThanOrEqual(40);
  });

  it("wires pass9 executeAnalysis input with a case snapshot for the live adapter", async () => {
    const captured: Array<{ stage: string; input: Record<string, unknown> }> = [];
    const llm: LlmAdapter = {
      async completeStructured(request) {
        captured.push({ stage: request.stage, input: request.input });
        if (request.stage === "pass9") {
          return {
            stage: request.stage,
            fixture: "happy",
            output: {
              sections: peelSections("a1"),
            },
            model: request.model ?? "mock-strong",
            usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
          };
        }
        return {
          stage: request.stage,
          fixture: "happy",
          output: { failingSectionIds: [], regeneratedSections: [] },
          model: request.model ?? "mock-cheap",
          usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.001 },
        };
      },
    };

    await executeAnalysis({
      assessmentId: "a1",
      answers: { "Q1.1": "I quit IT and freeze on marketing." },
      previousCaseState: seededCase("a1"),
      completedStages: ["pass1", "pass2", "pass3", "pass4", "pass5", "pass6", "pass7", "pass8"],
      llm,
      persistRun() {},
      persistCaseState() {},
    });

    const pass9 = captured.find((item) => item.stage === "pass9");
    expect(pass9?.input).toEqual(
      expect.objectContaining({
        caseSnapshot: expect.objectContaining({
          evidenceAllowlist: expect.arrayContaining(["a1:Q1.1"]),
          answersByQuestionId: expect.objectContaining({
            "Q1.1": "I quit IT and freeze on marketing.",
          }),
        }),
      }),
    );
  });
});
