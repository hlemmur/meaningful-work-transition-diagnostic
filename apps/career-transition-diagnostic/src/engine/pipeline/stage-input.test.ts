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
    {
      id: "questions",
      title: "Three questions to stay with",
      body:
        "What would make you question this explanation? What changes when you test structure directly? What still feels unexplained to you?",
      evidenceRefs: [
        q("Q1.1"),
        q("Q1.3"),
      ],
      questionIntents: [
        { question: "What would make you question this explanation?", targetUncertainty: "Whether the explanation fits", relatedHypothesisId: "h1", couldWeakenSelectedFormulation: true },
        { question: "What changes when you test structure directly?", targetUncertainty: "Whether structure changes action", relatedHypothesisId: "h1", couldWeakenSelectedFormulation: false },
        { question: "What still feels unexplained to you?", targetUncertainty: "The unexplained remainder", couldWeakenSelectedFormulation: false },
      ],
    },
    {
      id: "close",
      title: "A working formulation",
      body:
        "You can treat this as a working formulation rather than a verdict.",
      evidenceRefs: [
        q("Q1.1"),
      ],
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
        crossDomainReach: 0.8,
        noveltyOfConnection: 0.7,
        consciousAwarenessPenalty: 0.2,
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
  it("carries unresolved symbolic readings and projection interpretations into later snapshots", () => {
    const state = seededCase();
    state.imageAnalysis = {
      literalFacts: [{ text: "A locked gate.", evidenceRefs: ["a1:Q10.1"] }],
      personalAssociations: [{ text: "Wait here.", evidenceRefs: ["a1:Q10.6"] }],
      plausibleReadings: [
        {
          interpretation: "The gate may concern permission.",
          supportsHypothesisIds: ["hyp-depth"],
          weakensHypothesisIds: [],
          evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
        },
        {
          interpretation: "The gate may concern route clarity.",
          supportsHypothesisIds: ["hyp-practical"],
          weakensHypothesisIds: [],
          evidenceRefs: ["a1:Q10.1"],
        },
      ],
      unresolvedSymbolicQuestion: "Permission or route clarity?",
    };
    state.projectionInterpretations = [{
      projectionEvidenceRefs: ["a1:Q5.1"],
      possibleDisownedValue: "Decisiveness may be a value to reclaim.",
      literalEnactmentRisk: "Do not copy the figure literally.",
      matureExpression: "Test one bounded decisive action.",
    }];

    const input = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: {},
    }) as { caseSnapshot: {
      imageAnalysis: { plausibleReadings: unknown[]; unresolvedSymbolicQuestion?: string };
      projectionInterpretations: unknown[];
    } };

    expect(input.caseSnapshot.imageAnalysis.plausibleReadings).toHaveLength(2);
    expect(input.caseSnapshot.imageAnalysis.unresolvedSymbolicQuestion).toMatch(/permission/i);
    expect(input.caseSnapshot.projectionInterpretations).toHaveLength(1);
  });

  it("carries a resolved maintaining loop into report-stage snapshots", () => {
    const state = seededCase();
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A concrete choice appears.",
        response: "Commitment is deferred.",
        shortTermFunction: "Options remain open.",
        longTermCost: "No fit evidence accumulates.",
        reinforcingConsequence: "More certainty feels necessary.",
      },
      maintainingLoop: {
        goal: "Choose meaningful work.",
        trigger: "A concrete choice appears.",
        response: "Commitment is deferred.",
        payoff: "Options remain open.",
        cost: "No fit evidence accumulates.",
        selfConfirmingResult: "More certainty feels necessary.",
        evidenceRefs: ["a1:Q0.5", "a1:Q1.1"],
      },
      whyItFits: ["a1:Q1.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "ADHD and job shape.",
      unresolvedForks: [],
    };

    const input = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "stall" },
    });

    const snapshot = input.caseSnapshot as {
      finalFormulation?: {
        maintainingLoop?: typeof state.finalFormulation.maintainingLoop;
      };
    };
    expect(snapshot.finalFormulation?.maintainingLoop).toEqual(
      state.finalFormulation.maintainingLoop,
    );
  });

  it("carries layerRelationship into later-stage snapshots", () => {
    const state = seededCase();
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A concrete choice appears.",
        response: "Commitment is deferred.",
        shortTermFunction: "Options remain open.",
        longTermCost: "No fit evidence accumulates.",
        reinforcingConsequence: "More certainty feels necessary.",
      },
      layerRelationship: {
        mode: "layered",
        practicalHypothesisIds: ["h-practical"],
        psychologicalHypothesisIds: ["h1"],
        relationship: "Structure helps, and the visibility charge remains.",
        uncertainty: "The third has not emerged.",
        evidenceRefs: ["a1:Q0.5", "a1:Q3.3"],
      },
      whyItFits: ["a1:Q1.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "ADHD and job shape.",
      unresolvedForks: [],
    };

    const input = buildStageLlmInput({
      stage: "pass8",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "stall" },
    });
    const snapshot = input.caseSnapshot as {
      finalFormulation?: { layerRelationship?: { mode: string } };
    };
    expect(snapshot.finalFormulation?.layerRelationship?.mode).toBe("layered");
  });

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

  it("exposes protectiveFunction and possibleCompensatoryAim on snapshot hiddenPosition", () => {
    const state = seededCase("a1");
    state.hiddenPosition = {
      consciousPosition: "I want freedom",
      observedPattern: "Stalls when the offer must become real",
      possibleHiddenPosition: "Keeps authority outside while claiming autonomy",
      protectiveFunction: [
        "Protects ethereal identity from ordinary exposure",
        `${"x".repeat(400)} keep-tail`,
      ],
      possibleCompensatoryAim: `structure in service of aliveness ${"y".repeat(400)}`,
      threatenedByChange: ["Loss of lightness"],
      developmentalTension: { poleA: "freedom", poleB: "container" },
      imageVoteSummary: "image mid-crossing",
      evidenceRefs: ["a1:Q9.3"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };

    const withHidden = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "stall" },
    }).caseSnapshot as {
      hiddenPosition: {
        protectiveFunction: string[];
        possibleCompensatoryAim: string;
        possibleHiddenPosition: string;
      } | null;
    };

    expect(withHidden.hiddenPosition).toEqual(
      expect.objectContaining({
        possibleHiddenPosition: "Keeps authority outside while claiming autonomy",
        protectiveFunction: [
          "Protects ethereal identity from ordinary exposure",
          expect.stringMatching(/^x+…$/),
        ],
        possibleCompensatoryAim: expect.stringMatching(/^structure in service of aliveness y+…$/),
      }),
    );
    expect(withHidden.hiddenPosition!.protectiveFunction[1]!.length).toBeLessThanOrEqual(401);
    expect(withHidden.hiddenPosition!.possibleCompensatoryAim.length).toBeLessThanOrEqual(401);

    const withoutHidden = buildStageLlmInput({
      stage: "pass9",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: seededCase("a1"),
      answers: { "Q1.1": "stall" },
    }).caseSnapshot as { hiddenPosition: null };

    expect(withoutHidden.hiddenPosition).toBeNull();
  });

  it("exposes openForks and experimentBindings for closed-set pass8 bind", () => {
    const state = seededCase("a1");
    state.openForks = ["rational_caution_vs_hidden_bargain", "background_income_relief_vs_replacement"];
    state.hypotheses = [
      { ...state.hypotheses[0]!, id: "hyp-2-image-protection-bargain" },
      {
        ...state.hypotheses[0]!,
        id: "hyp-1-container-loss",
        title: "Container loss",
      },
    ];

    const snapshot = buildStageLlmInput({
      stage: "pass8",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "stall" },
    }).caseSnapshot as {
      openForks: string[];
      experimentBindings: {
        hypothesisIds: string[];
        openForkIds: string[];
        preferredHypothesisId?: string;
      };
    };

    expect(snapshot.openForks).toEqual([
      "rational_caution_vs_hidden_bargain",
      "background_income_relief_vs_replacement",
    ]);
    expect(snapshot.experimentBindings).toEqual({
      hypothesisIds: ["hyp-2-image-protection-bargain", "hyp-1-container-loss"],
      openForkIds: [
        "rational_caution_vs_hidden_bargain",
        "background_income_relief_vs_replacement",
      ],
      preferredHypothesisId: "hyp-2-image-protection-bargain",
    });
  });

  it("omits preferredHypothesisId and uses empty openForkIds when none exist", () => {
    const state = seededCase("a1");
    state.openForks = [];
    state.hypotheses = [];

    const snapshot = buildStageLlmInput({
      stage: "pass8",
      assessmentId: "a1",
      evidenceRef: "a1:Q1.1",
      caseState: state,
      answers: { "Q1.1": "stall" },
    }).caseSnapshot as {
      openForks: string[];
      experimentBindings: {
        hypothesisIds: string[];
        openForkIds: string[];
        preferredHypothesisId?: string;
      };
    };

    expect(snapshot.openForks).toEqual([]);
    expect(snapshot.experimentBindings).toEqual({
      hypothesisIds: [],
      openForkIds: [],
    });
    expect(snapshot.experimentBindings).not.toHaveProperty("preferredHypothesisId");
  });

  it("exposes Tier-A citeRefs and report-wide coverage requirements", () => {
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
        image: { mustAppearInReport: boolean; refs: string[] };
        projection: { mustAppearInReport: boolean; refs: string[] };
        money: { mustAppearInReport: boolean; refs: string[] };
      };
      requiredTitles: Record<string, string>;
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
      mustAppearInReport: true,
      refs: expect.arrayContaining([
        "a1:Q10.1",
        "a1:Q10.6",
      ]),
    });
    expect(snapshot.requiredCitations.projection).toEqual({
      mustAppearInReport: true,
      refs: expect.arrayContaining([
        "a1:Q5.1",
        "a1:Q6.1",
      ]),
    });

    expect(snapshot.requiredCitations.money).toEqual({
      mustAppearInReport: true,
      refs: expect.arrayContaining([
        "a1:Q8.2",
      ]),
    });

    expect(snapshot.requiredTitles).toEqual(
      expect.objectContaining({
        problem: "The problem as you see it",
        hidden: "A possible hidden position",
        experiment: "Your experiment",
        jungian: "A Jungian lens",
      }),
    );
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
