import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import {
  hypothesisCritiqueSchema,
  hypothesisSchema,
  imageVoteSchema,
  reportSectionSchema,
  type ForkId,
} from "@/engine/schemas/analysis";
import { CANONICAL_PEEL_TITLES } from "./gates";
import { applyImageVotes, applyResolution, sanitizeReportSections } from "./invariants";
import { buildCaseSnapshot, STAGE_INPUT_TRIM, trimText } from "./stage-input";
import { pass6OutputSchema } from "./stage-schemas";

function hypothesis(id: string) {
  return hypothesisSchema.parse({
    id,
    title: `Hypothesis ${id}`,
    category: "identity",
    observedPattern: "A synthetic pattern for invariant testing.",
    evidenceFor: ["a1:Q1.1"],
    evidenceAgainst: [],
    contradictionsExplained: [],
    contradictionsNotExplained: [],
    simplerAlternatives: [],
    missingInformation: [],
    originForks: ["history_vs_stated_cause"],
    scoring: {
      evidenceCoverage: 0.5,
      crossContextRecurrence: 0.5,
      contradictionResolution: 0.5,
      personSpecificity: 0.5,
      developmentalFit: 0.5,
      imageConstraintFit: 0.5,
      counterEvidencePenalty: 0,
      simplerAlternativePenalty: 0,
    },
    confidence: "tentative",
  });
}

function resolutionOutput(
  selectedHypothesisId: string,
  forkId: ForkId = "history_vs_stated_cause",
) {
  return pass6OutputSchema.parse({
    selectedHypothesisId,
    forkResolutions: [
      {
        forkId,
        status: "leans_a",
        interpretation: "Synthetic resolution.",
        evidenceRefs: ["a1:Q1.1"],
        importance: "high",
        reportWorthiness: true,
      },
    ],
    finalFormulation: {
      selectedHypothesisId,
      maintenanceFormulation: "Synthetic formulation.",
      maintenanceMechanism: {
        trigger: "A next step becomes concrete.",
        response: "Action is deferred.",
        shortTermFunction: "Avoids premature commitment.",
        longTermCost: "No new evidence accumulates.",
        reinforcingConsequence: "Uncertainty therefore persists.",
      },
      whyItFits: ["Synthetic reason."],
      whatItDoesNotExplain: ["Synthetic limitation."],
      strongestAlternative: "Synthetic alternative.",
      unresolvedForks: [],
    },
    hiddenPosition: null,
    alternative: "Synthetic alternative.",
  });
}

describe("applyImageVotes", () => {
  it("persists multiple grounded symbolic readings and projection interpretation separately", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q5.1": "I admire founders who act before certainty; I want their boldness.",
      "Q10.1": "A locked garden gate at dusk.",
      "Q10.2": "A visible path continues beyond it.",
      "Q10.6": "Wait until the ground is yours.",
    });
    state.hypotheses = [hypothesis("hyp-depth"), hypothesis("hyp-practical")];

    applyImageVotes(state, {
      votes: [
        {
          hypothesisId: "hyp-depth",
          verdict: "splits",
          interpretation: "The threshold can fit either authorization or ordinary uncertainty.",
          evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
          exactClientMaterialUsed: ["a1:Q10.1", "a1:Q10.6"],
        },
      ],
      imageAnalysis: {
        literalFacts: [
          { text: "A locked garden gate at dusk.", evidenceRefs: ["a1:Q10.1"] },
        ],
        personalAssociations: [
          { text: "Wait until the ground is yours.", evidenceRefs: ["a1:Q10.6"] },
        ],
        plausibleReadings: [
          {
            interpretation: "The gate may represent waiting for authorization.",
            supportsHypothesisIds: ["hyp-depth"],
            weakensHypothesisIds: [],
            evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
          },
          {
            interpretation: "The visible path may preserve an ordinary direction problem.",
            supportsHypothesisIds: ["hyp-practical"],
            weakensHypothesisIds: [],
            evidenceRefs: ["a1:Q10.1", "a1:Q10.2"],
          },
        ],
        unresolvedSymbolicQuestion: "Is the gate about permission or route clarity?",
      },
      projectionInterpretations: [
        {
          projectionEvidenceRefs: ["a1:Q5.1"],
          possibleDisownedValue: "Acting before certainty may be a disowned value.",
          literalEnactmentRisk: "This does not imply copying the admired founders literally.",
          matureExpression: "Try one bounded action while retaining ordinary caution.",
        },
      ],
      overallNote: "The image remains split.",
    });

    expect(state.imageAnalysis?.plausibleReadings).toHaveLength(2);
    expect(state.imageAnalysis?.unresolvedSymbolicQuestion).toMatch(/permission/i);
    expect(state.projectionInterpretations).toHaveLength(1);
    expect(state.projections.admiredFigures[0]?.figure).toMatch(/founders/i);
    expect(state.projections.admiredFigures[0]).not.toHaveProperty("matureExpression");
  });

  it("accepts snapshot-trimmed Q10 text that the model actually sees", () => {
    const scene = `A locked garden gate at dusk. ${"The path keeps going past the trees. ".repeat(20)}`;
    const speech = `Wait until the ground is yours. ${"Do not step until the crossing is finished. ".repeat(16)}`;
    expect(scene.length).toBeGreaterThan(STAGE_INPUT_TRIM.maxQuoteChars);
    expect(speech.length).toBeGreaterThan(STAGE_INPUT_TRIM.maxAnswerChars);

    const answers = {
      "Q1.1": "I keep stalling.",
      "Q10.1": scene,
      "Q10.6": speech,
    };
    const state = extractCaseStateFull("a1", answers);
    state.hypotheses = [hypothesis("hyp-live")];
    const snapshot = buildCaseSnapshot({ caseState: state, answers });
    const snapshotScene = String(snapshot.signals.symbolicMaterial.scene);
    const snapshotSpeech = String(snapshot.signals.symbolicMaterial.obstacleSpeech);
    expect(snapshotScene).not.toBe(scene);
    expect(snapshotSpeech).not.toBe(speech);

    applyImageVotes(state, {
      votes: [{
        hypothesisId: "hyp-live",
        verdict: "supports",
        interpretation: "The supplied threshold image fits the stall.",
        evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
        exactClientMaterialUsed: ["a1:Q10.1", "a1:Q10.6"],
      }],
      imageAnalysis: {
        literalFacts: [{ text: snapshotScene, evidenceRefs: ["a1:Q10.1"] }],
        personalAssociations: [{ text: snapshotSpeech, evidenceRefs: ["a1:Q10.6"] }],
        plausibleReadings: [{
          interpretation: "The gate may represent waiting for authorization.",
          supportsHypothesisIds: ["hyp-live"],
          weakensHypothesisIds: [],
          evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
        }],
      },
      projectionInterpretations: [],
      overallNote: "Synthetic.",
    });

    expect(state.imageAnalysis?.literalFacts[0]?.text).toBe(snapshotScene);
    expect(state.imageAnalysis?.personalAssociations[0]?.text).toBe(snapshotSpeech);
  });

  it("accepts snapshot-trimmed Q10 text when Gemini omits the truncation marker", () => {
    const scene = `A locked garden gate at dusk. ${"The path keeps going past the trees. ".repeat(20)}`;
    const speech = `Wait until the ground is yours. ${"Do not step until the crossing is finished. ".repeat(16)}`;
    const answers = {
      "Q1.1": "I keep stalling.",
      "Q10.1": scene,
      "Q10.6": speech,
    };
    const state = extractCaseStateFull("a1", answers);
    state.hypotheses = [hypothesis("hyp-live")];
    const snapshot = buildCaseSnapshot({ caseState: state, answers });
    const snapshotScene = String(snapshot.signals.symbolicMaterial.scene);
    const snapshotSpeech = String(snapshot.signals.symbolicMaterial.obstacleSpeech);
    expect(snapshotScene.endsWith("…")).toBe(true);
    expect(snapshotSpeech.endsWith("…")).toBe(true);

    applyImageVotes(state, {
      votes: [{
        hypothesisId: "hyp-live",
        verdict: "supports",
        interpretation: "The supplied threshold image fits the stall.",
        evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
        exactClientMaterialUsed: ["a1:Q10.1", "a1:Q10.6"],
      }],
      imageAnalysis: {
        literalFacts: [{ text: snapshotScene.slice(0, -1), evidenceRefs: ["a1:Q10.1"] }],
        personalAssociations: [{ text: snapshotSpeech.slice(0, -1), evidenceRefs: ["a1:Q10.6"] }],
        plausibleReadings: [],
      },
      projectionInterpretations: [],
      overallNote: "Synthetic.",
    });

    expect(state.imageAnalysis?.literalFacts[0]?.text).toBe(snapshotScene.slice(0, -1));
    expect(state.imageAnalysis?.personalAssociations[0]?.text).toBe(snapshotSpeech.slice(0, -1));
  });

  it("rejects marker-free text from outside the Pass 5 symbolic snapshot boundary", () => {
    const scene = `A locked garden gate at dusk. ${"The path keeps going past the trees. ".repeat(20)}`;
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": scene,
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];
    const snapshotAnswer = String(trimText(scene, STAGE_INPUT_TRIM.maxAnswerChars));
    expect(snapshotAnswer.endsWith("…")).toBe(true);
    // Allowed: snapshot with ellipsis, or exact maxAnswerChars prefix without ellipsis.
    // Cutting into a content word (not only trailing whitespace) stays outside the boundary
    // after normalize(), which collapses trailing spaces.
    const allowedPrefix = snapshotAnswer.slice(0, -1);
    const outsideBoundary = `${allowedPrefix.trimEnd().slice(0, -12)}…`;

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: outsideBoundary, evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [{ text: "Wait here.", evidenceRefs: ["a1:Q10.6"] }],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/not exact supplied client material/i);
  });

  it("preserves a literal ellipsis in short supplied symbolic material", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A tunnel that keeps going…",
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "A tunnel that keeps going", evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [{ text: "Wait here.", evidenceRefs: ["a1:Q10.6"] }],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/not exact supplied client material/i);
  });

  it("still accepts exact full-length supplied symbolic text", () => {
    const scene = `A locked garden gate at dusk. ${"The path keeps going past the trees. ".repeat(20)}`;
    const speech = `Wait until the ground is yours. ${"Do not step until the crossing is finished. ".repeat(16)}`;
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": scene,
      "Q10.6": speech,
    });
    state.hypotheses = [hypothesis("hyp-live")];

    applyImageVotes(state, {
      votes: [{
        hypothesisId: "hyp-live",
        verdict: "supports",
        interpretation: "The supplied threshold image fits the stall.",
        evidenceRefs: ["a1:Q10.1", "a1:Q10.6"],
        exactClientMaterialUsed: ["a1:Q10.1", "a1:Q10.6"],
      }],
      imageAnalysis: {
        literalFacts: [{ text: scene, evidenceRefs: ["a1:Q10.1"] }],
        personalAssociations: [{ text: speech, evidenceRefs: ["a1:Q10.6"] }],
        plausibleReadings: [],
      },
      projectionInterpretations: [],
      overallNote: "Synthetic.",
    });

    expect(state.imageAnalysis?.literalFacts[0]?.text).toBe(scene);
  });

  it("still rejects invented symbolic text when the supplied Q10 material is long", () => {
    const scene = `A locked garden gate at dusk. ${"The path keeps going past the trees. ".repeat(20)}`;
    const speech = `Wait until the ground is yours. ${"Do not step until the crossing is finished. ".repeat(16)}`;
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": scene,
      "Q10.6": speech,
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "A completely invented forest scene.", evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [{ text: speech, evidenceRefs: ["a1:Q10.6"] }],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/not exact supplied client material/i);
  });

  it("rejects an exact image answer cited under the neighboring question", () => {
    const state = extractCaseStateFull("origin-case", {
      "Q1.1": "I keep stalling.",
      "Q10.3": "frustration that I am so far away from entrance",
      "Q10.4": "darkness, unknown",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "insufficient",
          interpretation: "The image is too thin to decide.",
          evidenceRefs: ["origin-case:Q10.4"],
          exactClientMaterialUsed: ["origin-case:Q10.4"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "darkness, unknown", evidenceRefs: ["origin-case:Q10.3"] }],
          personalAssociations: [],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/not exact supplied client material/i);
  });

  it("rejects invented personal associations", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "A locked gate.", evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [{ text: "The gate fears success.", evidenceRefs: ["a1:Q10.6"] }],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/not exact supplied client material/i);
  });

  it("rejects valid symbolic text placed in the wrong fact or association bucket", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "Wait here.", evidenceRefs: ["a1:Q10.6"] }],
          personalAssociations: [],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/literal fact.*matching provenance/i);
  });

  it("rejects an invented extra ref attached to supplied symbolic text", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{
            text: "A locked gate.",
            evidenceRefs: ["a1:Q10.1", "a1:Q10.99"],
          }],
          personalAssociations: [],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/matching provenance/i);
  });

  it("rejects symbolic readings that reference a non-live hypothesis", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
      "Q10.6": "Wait here.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "splits",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "A locked gate.", evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [{ text: "Wait here.", evidenceRefs: ["a1:Q10.6"] }],
          plausibleReadings: [{
            interpretation: "Invented center.",
            supportsHypothesisIds: ["hyp-invented"],
            weakensHypothesisIds: [],
            evidenceRefs: ["a1:Q10.1"],
          }],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/non-live hypothesis/i);
  });

  it("rejects projection interpretations that are not grounded in raw projection evidence", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q5.1": "I admire decisive founders.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "insufficient",
          evidenceRefs: ["a1:Q1.1"],
          exactClientMaterialUsed: [],
        }],
        imageAnalysis: { literalFacts: [], personalAssociations: [], plausibleReadings: [] },
        projectionInterpretations: [{
          projectionEvidenceRefs: ["a1:Q6.1"],
          possibleDisownedValue: "Decisiveness.",
        }],
        overallNote: "Thin image.",
      }),
    ).toThrow(/raw supplied projection evidence/i);
  });

  it("keeps thin symbolic material explicitly insufficient", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A road.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [{
          hypothesisId: "hyp-live",
          verdict: "supports",
          evidenceRefs: ["a1:Q10.1"],
          exactClientMaterialUsed: ["a1:Q10.1"],
        }],
        imageAnalysis: {
          literalFacts: [{ text: "A road.", evidenceRefs: ["a1:Q10.1"] }],
          personalAssociations: [],
          plausibleReadings: [],
        },
        projectionInterpretations: [],
        overallNote: "Synthetic.",
      }),
    ).toThrow(/thin symbolic material.*insufficient/i);
  });

  it("rejects votes for hypotheses that are not in the current case", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [
          {
            hypothesisId: "hyp-invented",
            verdict: "insufficient",
            evidenceRefs: ["a1:Q1.1"],
            exactClientMaterialUsed: [],
          },
        ],
        imageAnalysis: { literalFacts: [], personalAssociations: [], plausibleReadings: [] },
        projectionInterpretations: [],
        overallNote: "Synthetic invalid vote.",
      }),
    ).toThrow(/image vote.*live hypothesis/i);
  });

  it("rejects rich-image votes that do not target a live leading hypothesis", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate blocks a vivid path.",
      "Q10.2": "The scene feels cold and exposed.",
    });
    state.hypotheses = [hypothesis("hyp-live")];

    expect(() =>
      applyImageVotes(state, {
        votes: [
          {
            hypothesisId: "hyp-invented",
            verdict: "supports",
            interpretation: "The image supports an invented candidate.",
            evidenceRefs: ["a1:Q10.1"],
            exactClientMaterialUsed: ["a1:Q10.1"],
          },
        ],
        imageAnalysis: { literalFacts: [], personalAssociations: [], plausibleReadings: [] },
        projectionInterpretations: [],
        overallNote: "Synthetic invalid vote.",
      }),
    ).toThrow(/image vote.*live hypothesis/i);
  });
});

describe("applyResolution", () => {
  it("keeps developmental formulation when a practical hypothesis is selected under layered mode", () => {
    const state = supportedResolutionState();
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.developmentalFormulation = keptFormulation();
    output.finalFormulation.layerRelationship = {
      mode: "layered",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: ["hyp-depth"],
      relationship: "Both layers remain live.",
      uncertainty: "Neither layer is settled.",
      evidenceRefs: ["a1:Q2.2", "a1:Q0.5"],
    };
    output.hiddenPosition = chargedHidden();

    const resolved = applyResolution(state, output);

    expect(resolved.finalFormulation?.developmentalFormulation?.consciousPole).toBe("freedom");
  });

  it("drops developmental formulation only for practical_primary when development is not warranted", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [
      hypothesisSchema.parse({
        ...hypothesis("hyp-practical"),
        category: "practical",
      }),
    ];
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.developmentalFormulation = {
      consciousPole: "Freedom",
      compensatingPole: "Commitment",
      coreOpposition: "Freedom versus commitment",
      possibleDevelopmentalTask: "Try chosen structure.",
      uncertainty: "The practical explanation may be sufficient.",
      evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
    };
    output.finalFormulation.layerRelationship = {
      mode: "practical_primary",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: [],
      relationship: "Practical conditions are sufficient.",
      uncertainty: "Depth is not warranted.",
      evidenceRefs: ["a1:Q1.1"],
    };

    const resolved = applyResolution(state, output);

    expect(resolved.finalFormulation?.developmentalFormulation).toBeUndefined();
  });

  it("rejects a developmental task that makes one pole defeat the other", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];
    state.behavior.actionsTaken = [{
      id: "a1:Q2.2",
      assessmentId: "a1",
      questionId: "Q2.2",
      normalizedMeaning: "Visibility freezes finished work.",
      evidenceType: "behavior",
    }];
    state.affect.emotions = [{
      id: "a1:Q3.3",
      assessmentId: "a1",
      questionId: "Q3.3",
      normalizedMeaning: "shame",
      evidenceType: "emotion",
    }];
    state.history.earlierOccurrences = [{
      id: "a1:Q4.8",
      assessmentId: "a1",
      questionId: "Q4.8",
      normalizedMeaning: "External structure carried continuity.",
      evidenceType: "history",
    }];
    const output = resolutionOutput("hyp-live");
    output.finalFormulation.developmentalFormulation = {
      consciousPole: "Freedom",
      compensatingPole: "Structure",
      coreOpposition: "Freedom versus structure",
      possibleDevelopmentalTask: "Choosing structure as the task so freedom must defeat itself.",
      uncertainty: "Practical pressure remains.",
      evidenceRefs: ["a1:Q2.2", "a1:Q4.8"],
    };

    expect(() => applyResolution(state, output)).toThrow(/coexist|defeat the other/i);
  });

  it("rejects developmental evidence refs that are not present in the case", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];
    const output = resolutionOutput("hyp-live");
    output.finalFormulation.developmentalFormulation = {
      consciousPole: "Freedom",
      compensatingPole: "Commitment",
      coreOpposition: "Freedom versus commitment",
      possibleDevelopmentalTask:
        "discovering a form in which Freedom and Commitment can coexist without either having to defeat the other",
      uncertainty: "A job-shape mismatch may suffice.",
      evidenceRefs: ["a1:Q98.1", "a1:Q99.1"],
    };

    expect(() => applyResolution(state, output)).toThrow(/developmental.*evidence/i);
  });

  it("drops a maintaining loop only for practical_primary when development is not warranted", () => {
    const state = extractCaseStateFull("a1", {
      "Q0.5": "The labor market in my field collapsed.",
      "Q2.1": "The stall began after layoffs.",
    });
    state.hypotheses = [
      hypothesisSchema.parse({
        ...hypothesis("hyp-practical"),
        category: "practical",
      }),
    ];
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.maintainingLoop = {
      goal: "Find work.",
      trigger: "A listing appears.",
      response: "Apply.",
      payoff: "A chance of work.",
      cost: "Time spent.",
      selfConfirmingResult: "Market feedback remains weak.",
      evidenceRefs: ["a1:Q0.5", "a1:Q2.1"],
    };
    output.finalFormulation.layerRelationship = {
      mode: "practical_primary",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: [],
      relationship: "Labor-market conditions are sufficient.",
      uncertainty: "Depth is not warranted.",
      evidenceRefs: ["a1:Q0.5"],
    };

    expect(applyResolution(state, output).finalFormulation?.maintainingLoop).toBeUndefined();
  });

  it("rejects a maintaining loop grounded in invented evidence", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];
    const output = resolutionOutput("hyp-live");
    output.finalFormulation.maintainingLoop = {
      goal: "Choose work.",
      trigger: "A choice appears.",
      response: "Delay.",
      payoff: "Options remain open.",
      cost: "No evidence accumulates.",
      selfConfirmingResult: "More certainty feels necessary.",
      evidenceRefs: ["a1:Q98.1", "a1:Q99.1"],
    };

    expect(() => applyResolution(state, output)).toThrow(/maintaining loop.*evidence/i);
  });

  it("rejects invented loop evidence before omitting a practical loop", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [
      hypothesisSchema.parse({
        ...hypothesis("hyp-practical"),
        category: "practical",
      }),
    ];
    state.openForks = ["history_vs_stated_cause"];
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.maintainingLoop = {
      goal: "Find work.",
      trigger: "A listing appears.",
      response: "Apply.",
      payoff: "A chance of work.",
      cost: "Time spent.",
      selfConfirmingResult: "Market feedback remains weak.",
      evidenceRefs: ["a1:Q98.1", "a1:Q99.1"],
    };

    expect(() => applyResolution(state, output)).toThrow(/maintaining loop.*evidence/i);
  });
  it("rejects a final formulation that selects a nonexistent hypothesis", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];

    expect(() =>
      applyResolution(state, resolutionOutput("hyp-invented")),
    ).toThrow(/selected hypothesis.*live/i);
  });

  it("rejects stale critique references before resolving the case", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];
    state.hypothesisCritiques = [
      hypothesisCritiqueSchema.parse({
        hypothesisId: "hyp-invented",
        strongestMundaneAlternative: "Synthetic alternative.",
        counterEvidenceRefs: [],
        missingEvidence: [],
        confirmationBiasRisk: "Synthetic risk.",
        overPsychologizingRisk: "Synthetic risk.",
        evidenceActuallyUniqueToHypothesis: [],
        rankAdjustment: "keep",
        reason: "Synthetic critique.",
      }),
    ];

    expect(() =>
      applyResolution(state, resolutionOutput("hyp-live")),
    ).toThrow(/critique.*live hypothesis/i);
  });

  it("rejects stale image-vote references before resolving the case", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];
    state.imageVotes = [
      imageVoteSchema.parse({
        hypothesisId: "hyp-invented",
        verdict: "supports",
        evidenceRefs: ["a1:Q10.1"],
        exactClientMaterialUsed: ["a1:Q10.1"],
      }),
    ];

    expect(() =>
      applyResolution(state, resolutionOutput("hyp-live")),
    ).toThrow(/image vote.*live hypothesis/i);
  });

  it("rejects resolutions for forks that are not open in the case", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [hypothesis("hyp-live")];
    state.openForks = ["history_vs_stated_cause"];

    expect(() =>
      applyResolution(
        state,
        resolutionOutput("hyp-live", "legitimacy_loop"),
      ),
    ).toThrow(/fork.*not open/i);
  });
});

describe("sanitizeReportSections", () => {
  it("normalizes near-miss peel titles to canonical labels by section id", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q2.1": "I want work that feels alive.",
    });
    state.hiddenPosition = {
      consciousPosition: "I lack confidence",
      observedPattern: "freeze at outreach",
      possibleHiddenPosition: "purity bargain",
      protectiveFunction: ["keeps potential intact"],
      possibleCompensatoryAim: "structure in service of aliveness",
      threatenedByChange: ["exposure"],
      developmentalTension: { poleA: "freedom", poleB: "structure" },
      imageVoteSummary: "supports",
      evidenceRefs: ["a1:Q1.1"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };
    state.jungianLenses = [
      {
        concept: "compensation",
        observedPatternItIlluminates: "stall beside desire",
        whyUseful: "names a balancing movement",
        evidenceRefs: ["a1:Q2.1"],
        limitsOfInterpretation: "may be practical only",
        confidence: "tentative",
      },
    ];

    const sanitized = sanitizeReportSections(
      [
        reportSectionSchema.parse({
          id: "hidden",
          title: "The hidden position",
          body: "You may be protecting a purity bargain.",
          evidenceRefs: ["a1:Q1.1"],
        }),
        reportSectionSchema.parse({
          id: "experiment",
          title: "Experiments you can run this week",
          body: "For two weeks you try a minimum viable offer.",
          evidenceRefs: ["a1:Q1.1"],
        }),
        reportSectionSchema.parse({
          id: "jungian",
          title: "The Jungian lens",
          body: "A polarity may illuminate without diagnosing you.",
          evidenceRefs: ["a1:Q2.1"],
        }),
      ],
      state,
    );

    expect(sanitized.map((section) => [section.id, section.title])).toEqual([
      ["hidden", CANONICAL_PEEL_TITLES.hidden],
      ["experiment", CANONICAL_PEEL_TITLES.experiment],
      ["jungian", CANONICAL_PEEL_TITLES.jungian],
    ]);
  });

  it("does not carve a leftover Q4.10 citation down to 0 when only Q4.1 is in the case", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q4.1": "This started years ago.",
    });
    const [section] = sanitizeReportSections(
      [
        reportSectionSchema.parse({
          id: "problem",
          title: "The problem as you see it",
          body: "The stall shows up in lower-stakes work too [a1:Q4.10].",
          evidenceRefs: ["a1:Q1.1"],
        }),
      ],
      state,
    );

    expect(section?.body).toContain("[a1:Q4.10]");
    expect(section?.body).not.toContain("[0]");
    expect(section?.body).not.toMatch(/\b0\b/);
  });

  it("strips an exact canonical id from prose and keeps client brackets and metadata", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
    });
    const [section] = sanitizeReportSections(
      [
        reportSectionSchema.parse({
          id: "problem",
          title: "The problem as you see it",
          body: "You wrote [the gate] and cited [a1:Q1.1] in the draft.",
          evidenceRefs: ["a1:Q1.1"],
        }),
      ],
      state,
    );
    expect(section?.body).toContain("[the gate]");
    expect(section?.body).not.toContain("a1:Q1.1");
    expect(section?.evidenceRefs).toEqual(["a1:Q1.1"]);
  });

  it("drops invented assessment-scoped evidence refs", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.1": "A locked gate.",
    });

    const sections = [
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body:
          "You have both practical and symbolic material.",
        evidenceRefs: [
          "a1:Q10.1",
          "a1:Q99.7",
        ],
      }),
    ];

    const sanitized =
      sanitizeReportSections(
        sections,
        state,
      );

    expect(
      sanitized[0]?.evidenceRefs,
    ).toEqual(["a1:Q10.1"]);
  });

  it("preserves the obstacle and ahead question provenance", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
      "Q10.3": "A synthetic stone wall blocks the path.",
    });
    const section = reportSectionSchema.parse({
      id: "reality",
      title: "What reality says",
      body: "You describe a concrete obstacle in the scene.",
      evidenceRefs: ["a1:Q10.3"],
    });

    expect(
      sanitizeReportSections([section], state)[0]?.evidenceRefs,
    ).toEqual(["a1:Q10.3"]);
  });

  it("fails closed when every supplied evidence ref is invented", () => {
    const state = extractCaseStateFull("a1", {
      "Q1.1": "I keep stalling.",
    });

    const sections = [
      reportSectionSchema.parse({
        id: "reality",
        title: "What reality says",
        body:
          "You keep encountering the same stall.",
        evidenceRefs: [
          "a1:Q99.7",
        ],
      }),
    ];

    expect(() =>
      sanitizeReportSections(
        sections,
        state,
      ),
    ).toThrow(/no supported evidence refs/i);
  });
});

const originFixtureAnswers = JSON.parse(
  readFileSync(
    join(__dirname, "../test-support/fixtures/origin-case-answers.json"),
    "utf8",
  ),
) as Record<string, unknown>;

function originImageVote(text: string, evidenceRef: string) {
  return {
    votes: [{
      hypothesisId: "hyp-live",
      verdict: "supports" as const,
      interpretation: "The supplied image is compatible with the stall.",
      evidenceRefs: [evidenceRef],
      exactClientMaterialUsed: [evidenceRef],
    }],
    imageAnalysis: {
      literalFacts: [],
      personalAssociations: [{ text, evidenceRefs: [evidenceRef] }],
      plausibleReadings: [],
    },
    projectionInterpretations: [],
    overallNote: "Origin fixture provenance.",
  };
}

describe("origin fixture symbolic provenance", () => {
  function prepared() {
    const state = extractCaseStateFull("a1", originFixtureAnswers);
    state.hypotheses = [hypothesis("hyp-live")];
    const snapshot = buildCaseSnapshot({ caseState: state, answers: originFixtureAnswers });
    const speech = String(snapshot.signals.symbolicMaterial.obstacleSpeech);
    return { state, speech };
  }

  it("accepts the trimmed Q10.6 snapshot the model actually sees", () => {
    const { state, speech } = prepared();
    expect(String(originFixtureAnswers["Q10.6"]).length).toBeGreaterThan(
      STAGE_INPUT_TRIM.maxQuoteChars,
    );
    expect(speech.endsWith("…")).toBe(true);

    applyImageVotes(state, originImageVote(speech, "a1:Q10.6"));

    expect(state.imageAnalysis?.personalAssociations[0]?.text).toBe(speech);
  });

  it("accepts the maxAnswerChars prefix without ellipsis (live truncation flake)", () => {
    const { state } = prepared();
    const full = String(originFixtureAnswers["Q10.6"]);
    expect(full.length).toBeGreaterThan(STAGE_INPUT_TRIM.maxAnswerChars);
    const prefix = full.slice(0, STAGE_INPUT_TRIM.maxAnswerChars);
    expect(prefix.endsWith("…")).toBe(false);

    applyImageVotes(state, originImageVote(prefix, "a1:Q10.6"));

    expect(state.imageAnalysis?.personalAssociations[0]?.text).toBe(prefix);
  });

  it("rejects a paraphrase of the obstacle speech", () => {
    const { state } = prepared();
    expect(() =>
      applyImageVotes(
        state,
        originImageVote(
          "Frustration that the passage is too far from the entrance to turn back.",
          "a1:Q10.6",
        ),
      ),
    ).toThrow(/not exact supplied client material/i);
  });

  it("rejects the obstacle text when it is filed as a personal association", () => {
    const { state } = prepared();
    const obstacle = String(originFixtureAnswers["Q10.3"]);
    expect(() =>
      applyImageVotes(state, originImageVote(obstacle, "a1:Q10.3")),
    ).toThrow(/not exact supplied client material/i);
  });

  it("rejects a lightly cleaned paraphrase of the snapshot", () => {
    const { state, speech } = prepared();
    const cleaned = `${speech.slice(0, -1).trim()} and that means the attempt failed.`;
    expect(() =>
      applyImageVotes(state, originImageVote(cleaned, "a1:Q10.6")),
    ).toThrow(/not exact supplied client material/i);
  });
});

function layerEvidence(
  questionId: string,
  meaning: string,
  evidenceType: "practical_constraint" | "behavior" | "emotion" | "history",
) {
  return {
    id: `a1:${questionId}`,
    assessmentId: "a1",
    questionId,
    normalizedMeaning: meaning,
    evidenceType,
  };
}

function supportedResolutionState() {
  const state = emptyCaseState("a1");
  state.practicalContext.constraints = [
    layerEvidence("Q0.5", "ADHD and money pressure remain.", "practical_constraint"),
  ];
  state.behavior.actionsTaken = [
    layerEvidence("Q2.2", "A private draft was finished before visibility froze the send.", "behavior"),
  ];
  state.affect.emotions = [layerEvidence("Q3.3", "fear", "emotion")];
  state.history.earlierOccurrences = [
    layerEvidence("Q4.8", "External structure carried continuity.", "history"),
  ];
  state.projections.rejectedFigures = [{
    id: "p1",
    figure: "dependent colleague",
    judgedQuality: "neediness",
    evidenceRefs: ["a1:Q6.1"],
  }];
  state.symbolicMaterial = { scene: "a private draft beside a dark gate" };
  state.hypotheses = [
    hypothesisSchema.parse({ ...hypothesis("hyp-practical"), category: "practical" }),
    hypothesisSchema.parse({ ...hypothesis("hyp-depth"), category: "psychological" }),
  ];
  state.openForks = ["history_vs_stated_cause"];
  return state;
}

function chargedHidden() {
  return {
    consciousPosition: "I need a better system.",
    observedPattern: "Visibility freezes finished work.",
    possibleHiddenPosition: "Being seen may threaten a protected freedom.",
    protectiveFunction: ["Keeps the work private"],
    possibleCompensatoryAim: "Structure in service of aliveness",
    threatenedByChange: ["Being seen"],
    developmentalTension: { poleA: "freedom", poleB: "structure" },
    imageVoteSummary: "unresolved",
    evidenceRefs: ["a1:Q2.2"],
    counterEvidenceRefs: [],
    confidence: "tentative" as const,
  };
}

function keptFormulation(possibleThird?: string) {
  return {
    consciousPole: "freedom",
    compensatingPole: "structure",
    coreOpposition: "freedom and structure",
    possibleDevelopmentalTask:
      "discovering a form in which freedom and structure can coexist without either having to defeat the other",
    ...(possibleThird ? { possibleThird } : {}),
    uncertainty: "Practical pressure remains true.",
    evidenceRefs: ["a1:Q2.2", "a1:Q4.8"],
  };
}

describe("layered Pass 6 resolution", () => {
  it("keeps supported depth when the selected hypothesis is practical", () => {
    const state = supportedResolutionState();
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.developmentalFormulation = keptFormulation();
    output.finalFormulation.layerRelationship = {
      mode: "layered",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: ["hyp-depth"],
      relationship: "External structure helps, and visibility stays affectively charged.",
      uncertainty: "Neither layer is settled.",
      evidenceRefs: ["a1:Q0.5", "a1:Q3.3"],
    };
    output.hiddenPosition = chargedHidden();

    const resolved = applyResolution(state, output);

    expect(resolved.finalFormulation?.developmentalFormulation?.consciousPole).toBe("freedom");
    expect(resolved.finalFormulation?.layerRelationship?.mode).toBe("layered");
    expect(resolved.hiddenPosition?.possibleHiddenPosition).toMatch(/protected freedom/i);
  });

  it("does not let sufficientWithoutDepth delete independently supported depth", () => {
    const state = supportedResolutionState();
    state.realityCheck = {
      sufficientWithoutDepth: true,
      categories: ["constraints"],
      narrative: "Practical conditions explain much of the stall.",
      evidenceRefs: ["a1:Q0.5"],
    };
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.developmentalFormulation = keptFormulation();
    output.hiddenPosition = chargedHidden();

    const resolved = applyResolution(state, output);

    expect(resolved.finalFormulation?.developmentalFormulation).toBeDefined();
    expect(resolved.hiddenPosition).toBeDefined();
  });

  it("omits a manufactured third and keeps an emergent one grounded in supplied action", () => {
    const manufactured = supportedResolutionState();
    const manufacturedOutput = resolutionOutput("hyp-depth");
    manufacturedOutput.finalFormulation.developmentalFormulation = keptFormulation(
      "Integrate both poles as a compromise.",
    );
    manufacturedOutput.hiddenPosition = chargedHidden();
    expect(
      applyResolution(manufactured, manufacturedOutput).finalFormulation?.developmentalFormulation?.possibleThird,
    ).toBeUndefined();

    const emergent = supportedResolutionState();
    const emergentOutput = resolutionOutput("hyp-depth");
    emergentOutput.finalFormulation.developmentalFormulation = keptFormulation(
      "A private draft beside the dark gate is not either pole.",
    );
    emergentOutput.hiddenPosition = chargedHidden();
    expect(
      applyResolution(emergent, emergentOutput).finalFormulation?.developmentalFormulation?.possibleThird,
    ).toMatch(/private draft/i);

    const ungrounded = supportedResolutionState();
    const ungroundedOutput = resolutionOutput("hyp-depth");
    ungroundedOutput.finalFormulation.developmentalFormulation = keptFormulation(
      "A cosmic mandate settles the opposition.",
    );
    ungroundedOutput.hiddenPosition = chargedHidden();
    expect(
      applyResolution(ungrounded, ungroundedOutput).finalFormulation?.developmentalFormulation?.possibleThird,
    ).toBeUndefined();
  });

  it("retries by failing when layered mode omits the developmental formulation", () => {
    const state = supportedResolutionState();
    const output = resolutionOutput("hyp-depth");
    output.finalFormulation.layerRelationship = {
      mode: "layered",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: ["hyp-depth"],
      relationship: "Both layers remain live.",
      uncertainty: "The developmental task was not stated.",
      evidenceRefs: ["a1:Q2.2", "a1:Q3.3"],
    };
    output.hiddenPosition = chargedHidden();

    expect(() => applyResolution(state, output)).toThrow(/omitted developmentalFormulation/i);
  });

  it("rejects layered mode that is only two category labels", () => {
    const state = emptyCaseState("a1");
    state.hypotheses = [
      hypothesisSchema.parse({ ...hypothesis("hyp-practical"), category: "practical" }),
      hypothesisSchema.parse({ ...hypothesis("hyp-depth"), category: "psychological" }),
    ];
    state.openForks = ["history_vs_stated_cause"];
    const output = resolutionOutput("hyp-practical");
    output.finalFormulation.developmentalFormulation = keptFormulation();
    output.finalFormulation.layerRelationship = {
      mode: "layered",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: ["hyp-depth"],
      relationship: "Two labels were available.",
      uncertainty: "No independent pattern was supplied.",
      evidenceRefs: ["a1:Q1.1"],
    };

    expect(() => applyResolution(state, output)).toThrow(/category labels/i);
  });

  it("rejects psychological-primary when the practical rival is merely present", () => {
    const state = supportedResolutionState();
    state.hypothesisCritiques = [
      hypothesisCritiqueSchema.parse({
        hypothesisId: "hyp-practical",
        strongestMundaneAlternative: "The market.",
        counterEvidenceRefs: [],
        missingEvidence: [],
        confirmationBiasRisk: "Low.",
        overPsychologizingRisk: "Low.",
        evidenceActuallyUniqueToHypothesis: ["a1:Q0.5"],
        rankAdjustment: "keep",
        reason: "The practical rival is still live.",
      }),
    ];
    const output = resolutionOutput("hyp-depth");
    output.finalFormulation.developmentalFormulation = keptFormulation();
    output.finalFormulation.layerRelationship = {
      mode: "psychological_primary",
      practicalHypothesisIds: ["hyp-practical"],
      psychologicalHypothesisIds: ["hyp-depth"],
      relationship: "Depth leads while money constraints remain.",
      uncertainty: "The practical rival was not weakened.",
      evidenceRefs: ["a1:Q2.2", "a1:Q3.3"],
    };
    output.hiddenPosition = chargedHidden();

    expect(() => applyResolution(state, output)).toThrow(/weakened practical rival/i);
  });

  it("rejects a hidden stance that has no conscious ego position", () => {
    const state = supportedResolutionState();
    const output = resolutionOutput("hyp-depth");
    output.hiddenPosition = {
      ...chargedHidden(),
      consciousPosition: "   ",
    };

    expect(() => applyResolution(state, output)).toThrow(/conscious ego position/i);
  });
});
