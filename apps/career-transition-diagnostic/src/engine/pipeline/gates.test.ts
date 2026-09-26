import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { reportSectionSchema } from "@/engine/schemas/analysis";
import { cumulativeExperiment } from "./cumulative-experiment";
import {
  assertCaseStateCompleteness,
  isParaphraseOf,
  critiquesNonEmpty,
  imageCited,
  projectionCited,
  moneyCited,
  reportLayerCoverage,
  secondPersonVoice,
  plainTitles,
  noAnalystOpeners,
  protectionAndAimInPeel,
  imaginalWhenSpeech,
  antiInflationDiagnosis,
  experimentBoundToHypothesis,
  experimentCopyAgrees,
  imageVoteAdequate,
  senexScoldOnly,
  somaticProvenance,
  questionsAndCloseAdequate,
  developmentalSectionAdequate,
  developmentalSectionQuality,
  epistemicallyUncalibratedSectionIds,
  closeSynthesisAdequate,
  closeInverseProof,
} from "./gates";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "../test-support/fixtures/origin-case-answers.json"), "utf8"),
) as Record<string, unknown>;

function section(
  id: string,
  body: string,
  evidenceRefs: string[],
) {
  return reportSectionSchema.parse({
    id,
    title: id,
    body,
    evidenceRefs,
  });
}

describe("pipeline gates", () => {
  it("requires a developmental report section only when a developmental formulation survived", () => {
    const state = extractCaseStateFull("a1", {
      "Q2.1": "I want freedom.",
      "Q6.1": "I admire people who commit.",
    });
    state.finalFormulation = {
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A choice becomes concrete.",
        response: "Commitment is deferred.",
        shortTermFunction: "Preserves options.",
        longTermCost: "Evidence does not accumulate.",
        reinforcingConsequence: "Uncertainty persists.",
      },
      developmentalFormulation: {
        consciousPole: "Freedom",
        compensatingPole: "Commitment",
        coreOpposition: "Freedom versus commitment",
        possibleDevelopmentalTask: "Try chosen structure.",
        uncertainty: "A job-shape mismatch may suffice.",
        evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
      },
      whyItFits: ["a1:Q2.1", "a1:Q6.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    };

    expect(developmentalSectionAdequate([], state).passed).toBe(false);
    expect(
      developmentalSectionAdequate(
        [section("developmental", "A possible tension.", ["a1:Q2.1", "a1:Q6.1"])],
        state,
      ).passed,
    ).toBe(true);

    state.finalFormulation.developmentalFormulation = undefined;
    expect(developmentalSectionAdequate([], state).passed).toBe(true);
  });
  it("detects Q11.3 paraphrases", () => {
    const insight = "I hope it shows me some sharp angles that I can't unsee";
    expect(
      isParaphraseOf(
        "Relying on external intellectual revelations as a substitute for gradual emotional integration",
        insight,
      ),
    ).toBe(false);
    expect(isParaphraseOf(insight, insight)).toBe(true);
    expect(
      isParaphraseOf(
        "sharp angles I cannot unsee that shift my perspective",
        insight,
      ),
    ).toBe(true);
  });

  it("passes completeness when origin answers are fully extracted", () => {
    const state = extractCaseStateFull("o1", originAnswers);
    expect(assertCaseStateCompleteness(state, originAnswers).passed).toBe(true);
  });

  it("fails completeness when answered Tier-A sections are empty in CaseState", () => {
    const state = extractCaseStateFull("o1", {});
    const finding = assertCaseStateCompleteness(state, originAnswers);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/projections|money|hiddenBargain|symbolic/i);
  });

  it("requires non-empty critiques", () => {
    expect(critiquesNonEmpty([]).passed).toBe(false);
    expect(critiquesNonEmpty([{ hypothesisId: "h1" }]).passed).toBe(true);
  });
});

describe("experiment binding gate", () => {
  function experimentState() {
    const state = extractCaseStateFull("exp", {
      "Q1.1": "I keep stalling.",
    });

    state.hypotheses = [
      {
        id: "hyp-structure",
        title: "Missing structure",
        category: "structural",

        observedPattern:
          "Action drops when external structure disappears.",

        evidenceFor: ["exp:Q1.1"],
        evidenceAgainst: [],

        contradictionsExplained: [],
        contradictionsNotExplained: [],

        simplerAlternatives: [
          "The stall may mainly reflect missing business skill.",
        ],

        missingInformation: [],

        originForks: [
          "container_loss_vs_capacity",
        ],

        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.7,
          contradictionResolution: 0.8,
          personSpecificity: 0.8,
          developmentalFit: 0.6,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0.2,
        },

        confidence: "moderate",
      },
      {
        id: "hyp-skill",
        title: "Skill gap",
        category: "practical",

        observedPattern:
          "The person has limited experience with this task.",

        evidenceFor: ["exp:Q1.1"],
        evidenceAgainst: [],

        contradictionsExplained: [],
        contradictionsNotExplained: [],

        simplerAlternatives: [],

        missingInformation: [],

        originForks: [
          "container_loss_vs_capacity",
        ],

        scoring: {
          evidenceCoverage: 0.6,
          crossContextRecurrence: 0.5,
          contradictionResolution: 0.6,
          personSpecificity: 0.5,
          developmentalFit: 0.3,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0,
        },

        confidence: "moderate",
      },
    ];

    state.openForks = [
      "container_loss_vs_capacity",
    ];

    return state;
  }

  it("allows recognizable legacy prose binding for persisted experiments", () => {
    const state = experimentState();

    const legacyExperiments = [
      {
        kind: "behavioral",
        title: "Legacy structure test",
        hypothesisTested:
          "Missing structure may explain the stall",
        action:
          "Add external accountability.",
        duration: "1 week",
        whatToObserve: [
          "Whether execution changes.",
        ],
        resultSupportingHypothesis:
          "Execution improves.",
        resultWeakeningHypothesis:
          "Execution stays unchanged.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
      },
    ];

    expect(
      experimentBoundToHypothesis(
        state,
        legacyExperiments,
      ).passed,
    ).toBe(true);

  });

  it("passes a direct cumulative Change→Observe experiment", () => {
    const state = experimentState();
    state.experiments = [
      cumulativeExperiment({
        title: "Your experiment",
        hypothesisTested: "hyp-structure",
        strategy: "direct",
        action:
          "Use a one-page template for the next draft while holding exposure private.",
        practicalCondition: {
          factor: "ambiguity of the next step",
          currentState: "blank page each time",
          temporaryChange: "one-page template",
          whyThisFactor: "Ambiguity is carrying part of the freeze.",
          processDimensions: ["ambiguity", "self_initiation"],
          sharedDimensions: [],
        },
        learningAim:
          "When the template changed, starting became easier, while visibility charge remained.",
      }),
    ];
    expect(experimentBoundToHypothesis(state).passed).toBe(true);
  });

  it("rejects analogue strategy without a cited Q4 source", () => {
    const state = experimentState();
    state.parallelPatterns = {
      lowerStakesExample: "Booking a haircut feels easier.",
      evidenceRefs: ["a1:Q4.11"],
    };
    state.experiments = [
      cumulativeExperiment({
        title: "Your experiment",
        hypothesisTested: "hyp-structure",
        strategy: "analogue",
        action: "Book a haircut appointment this week using a fixed slot.",
        practicalCondition: {
          factor: "self_initiation",
          currentState: "core deed is too hot",
          temporaryChange: "fixed slot",
          whyThisFactor: "Lower-stakes initiation is already supplied.",
          processDimensions: ["self_initiation"],
          sharedDimensions: ["self_initiation"],
        },
        learningAim:
          "When the fixed slot changed, booking became easier, while core visibility charge remained.",
      }),
    ];
    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/Q4\.10|Q4\.11|Q4\.12|sourceRef/i);
  });

  it("rejects inventing an analogue kitchen task when none was supplied", () => {
    const state = experimentState();
    state.experiments = [
      cumulativeExperiment({
        title: "Your experiment",
        hypothesisTested: "hyp-structure",
        strategy: "analogue",
        action: "Try cleaning your kitchen for twenty minutes.",
        practicalCondition: {
          factor: "initiation",
          currentState: "stuck",
          temporaryChange: "kitchen cleaning",
          whyThisFactor: "invented",
          processDimensions: ["self_initiation"],
          sharedDimensions: ["self_initiation"],
          sourceRef: "a1:Q4.11",
        },
        learningAim:
          "When kitchen cleaning changed, starting became easier, while core charge remained.",
      }),
    ];
    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
  });

  it("rejects learningAim that does not use the When X / Y / Z shape", () => {
    const state = experimentState();
    state.experiments = [
      cumulativeExperiment({
        title: "Your experiment",
        hypothesisTested: "hyp-structure",
        strategy: "direct",
        learningAim: "Prove which hypothesis wins after the timer.",
      }),
    ];
    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/learningAim/i);
  });

  it("passes when hypothesisTested exactly matches a live hypothesis id", () => {
    const state = experimentState();

    state.experiments = [
      {
        kind: "behavioral",
        title: "Structure test",
        hypothesisTested: "hyp-structure",
        action:
          "Add external accountability while holding task difficulty unchanged.",
        duration: "2 weeks",
        whatToObserve:
          ["Number of five planned task attempts completed under accountability."],
        resultSupportingHypothesis:
          "Execution improves materially.",
        resultWeakeningHypothesis:
          "Execution remains unchanged.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: ["hyp-skill"],
        manipulatedVariable: "external accountability",
        heldConstant: ["task difficulty"],
        outcomeInterpretations: [
          {
            outcome: "At least four of five planned attempts are completed under accountability.",
            favors: "hyp-structure",
            because: "Execution changed when structure changed while task difficulty stayed stable.",
          },
          {
            outcome: "Completion stays low and errors cluster in unfamiliar task steps.",
            favors: "hyp-skill",
            because: "Persistent task-specific errors fit limited experience better than missing structure.",
          },
        ],
      },
    ];

    expect(
      experimentBoundToHypothesis(state).passed,
    ).toBe(true);
  });

  it("accepts a ten-minute private draft whose layers update independently", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Private draft",
      hypothesisTested: "hyp-structure",
      action: "Write one ten-minute private draft and optionally show it to one trusted person, holding task difficulty unchanged.",
      duration: "10 minutes",
      whatToObserve: ["Whether one draft is completed."],
      resultSupportingHypothesis: "The draft is completed.",
      resultWeakeningHypothesis: "The draft is not completed.",
      riskLevel: "low",
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private structure",
      heldConstant: ["task difficulty"],
      sessionMinutes: 10,
      audienceCount: 1,
      exposure: "private",
      reversible: true,
      outcomeInterpretations: [
        {
          outcome: "One ten-minute draft is completed in private.",
          favors: "hyp-structure",
          because: "A bounded private structure was enough to produce the draft.",
          layerUpdates: [
            { layer: "practical", effect: "strengthens" },
            { layer: "psychological", effect: "unchanged" },
          ],
        },
        {
          outcome: "The private draft is completed and a visible send still freezes.",
          favors: "hyp-skill",
          because: "Visibility stays charged after the private action improves.",
          layerUpdates: [
            { layer: "practical", effect: "unchanged" },
            { layer: "psychological", effect: "strengthens" },
          ],
        },
        {
          outcome: "Neither the private draft nor the trusted share changes completed attempts.",
          favors: "hyp-structure",
          because: "No change leaves both layers inconclusive.",
          layerUpdates: [
            { layer: "practical", effect: "inconclusive" },
            { layer: "psychological", effect: "new_unknown" },
          ],
        },
      ],
    }];
    expect(experimentBoundToHypothesis(state).passed).toBe(true);
  });

  it("accepts a private peer review that keeps the existing offer stable without a commercial ask and records an inconclusive logistical outcome", () => {
    const state = experimentState();
    state.hypotheses = [
      {
        id: "hyp-image-defense-bargain",
        title: "Defense of Idealized Self-Image",
        category: "psychological",
        observedPattern: "Freezing before social exposure and public commercial testing.",
        evidenceFor: ["exp:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["container_loss_vs_capacity"],
        scoring: {
          evidenceCoverage: 0.6,
          crossContextRecurrence: 0.5,
          contradictionResolution: 0.6,
          personSpecificity: 0.5,
          developmentalFit: 0.3,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0,
        },
        confidence: "moderate",
      },
      {
        id: "hyp-adhd-container-collapse",
        title: "Container loss",
        category: "practical",
        observedPattern: "Paralysis in unstructured solo work after leaving a structured job.",
        evidenceFor: ["exp:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["container_loss_vs_capacity"],
        scoring: {
          evidenceCoverage: 0.6,
          crossContextRecurrence: 0.5,
          contradictionResolution: 0.6,
          personSpecificity: 0.5,
          developmentalFit: 0.3,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0,
        },
        confidence: "moderate",
      },
      {
        id: "hyp-identity-contamination-fear",
        title: "Identity contamination",
        category: "psychological",
        observedPattern: "Rejecting commercial promotion out of fear of losing authenticity.",
        evidenceFor: ["exp:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: ["container_loss_vs_capacity"],
        scoring: {
          evidenceCoverage: 0.6,
          crossContextRecurrence: 0.5,
          contradictionResolution: 0.6,
          personSpecificity: 0.5,
          developmentalFit: 0.3,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0,
        },
        confidence: "moderate",
      },
    ];
    state.experiments = [{
      kind: "behavioral",
      title: "Private Single-Peer Offer Review",
      hypothesisTested: "hyp-image-defense-bargain",
      action: "Select one trusted colleague or friend from your past professional network. In a single 20-minute private session, share your existing one-page coaching offer draft directly with them via email or direct message, asking for their single impression regarding clarity, without any sales solicitation, public posting, or commercial ask.",
      duration: "20 minutes",
      whatToObserve: [
        "Whether resistance or freeze emerges during the solitary preparation of the draft or selectively at the moment of transmitting it for evaluation",
        "Somatic tension or dread when asking for feedback privately versus when contemplating public social media broadcast",
        "Emotional response upon receiving honest peer commentary regarding the offering",
      ],
      resultSupportingHypothesis: "Freeze appears at the moment of sending.",
      resultWeakeningHypothesis: "The draft cannot be prepared in the window.",
      riskLevel: "low",
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-adhd-container-collapse", "hyp-identity-contamination-fear"],
      manipulatedVariable: "Social exposure scope (confining review to a private, trusted 1-on-1 peer exchange instead of broadcast marketing)",
      heldConstant: [
        "Existing core coaching offer draft content (no new positioning created)",
        "Solitary desk workspace and private drafting condition",
        "Zero commercial conversion or sales pressure",
      ],
      sessionMinutes: 20,
      audienceCount: 1,
      exposure: "trusted",
      reversible: true,
      outcomeInterpretations: [
        {
          outcome: "Drafting and preparing the text happens smoothly, but acute freeze, rationalization, and impulse to withdraw arise specifically when attempting to send the draft to the trusted peer.",
          favors: "hyp-image-defense-bargain",
          because: "The bottleneck is triggered specifically by interpersonal evaluation and testing an imperfect reality against another person's view, rather than executive dysfunction or lack of structure.",
          layerUpdates: [
            { layer: "psychological", effect: "strengthens" },
            { layer: "practical", effect: "unchanged" },
            { layer: "developmental", effect: "strengthens" },
          ],
        },
        {
          outcome: "Inability to select a recipient or format the text within the 20-minute window due to wandering attention, disorganization, or task switching, without significant dread of peer judgment.",
          favors: "hyp-adhd-container-collapse",
          because: "The breakdown occurs at the level of self-initiated executive sequencing in an unstructured solo environment rather than emotional defense against exposure.",
          layerUpdates: [
            { layer: "practical", effect: "strengthens" },
            { layer: "psychological", effect: "weakens" },
            { layer: "developmental", effect: "unchanged" },
          ],
        },
        {
          outcome: "The draft is sent and reviewed easily, but acute distress and hesitation arise specifically if the offering text contains any commercial phrasing or value claims that feel like commercial marketing.",
          favors: "hyp-identity-contamination-fear",
          because: "The freeze is bound to identity conflict regarding commercial selling and fear of losing authenticity rather than fear of general competence evaluation.",
          layerUpdates: [
            { layer: "psychological", effect: "strengthens" },
            { layer: "practical", effect: "unchanged" },
            { layer: "developmental", effect: "strengthens" },
          ],
        },
        {
          outcome: "External technical difficulties or peer non-responsiveness prevent the feedback exchange from concluding during the allocated window.",
          favors: "inconclusive",
          because: "Extraneous logistical factors interrupted the session, preventing discrimination between executive dysregulation, image defense, and identity conflict.",
          layerUpdates: [
            { layer: "practical", effect: "inconclusive" },
            { layer: "psychological", effect: "inconclusive" },
            { layer: "developmental", effect: "inconclusive" },
          ],
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed, finding.detail).toBe(true);
  });

  it.skip("rejects a held factor the action never names, even when the action says existing and without (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Unnamed constant",
      hypothesisTested: "hyp-structure",
      action: "Share the existing note with one person without a public post.",
      duration: "20 minutes",
      whatToObserve: ["Whether one draft is sent."],
      resultSupportingHypothesis: "The draft is sent.",
      resultWeakeningHypothesis: "The draft is not sent.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private sharing",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "One draft is sent within 20 minutes.",
          favors: "hyp-structure",
          because: "Sending changed when the step was private.",
        },
        {
          outcome: "The draft stays unsent and errors cluster in the unfamiliar steps.",
          favors: "hyp-skill",
          because: "The block stays in the unfamiliar steps.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/heldConstant/i);
  });

  it.skip("rejects an outcome that favors neither a live explanation nor inconclusive (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Unknown favor",
      hypothesisTested: "hyp-structure",
      action: "Share the existing draft while holding task difficulty unchanged.",
      duration: "20 minutes",
      whatToObserve: ["Whether one draft is sent."],
      resultSupportingHypothesis: "The draft is sent.",
      resultWeakeningHypothesis: "The draft is not sent.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private sharing",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "One draft is sent within 20 minutes.",
          favors: "hyp-structure",
          because: "The private step produced a sent draft.",
        },
        {
          outcome: "The draft stays unsent and errors cluster in unfamiliar steps.",
          favors: "not-a-live-explanation",
          because: "An unnamed explanation is not a rival.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/different live explanations/i);
  });

  it.skip("rejects an inconclusive outcome that names no observable event (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Vague interruption",
      hypothesisTested: "hyp-structure",
      action: "Share the existing draft while holding task difficulty unchanged.",
      duration: "20 minutes",
      whatToObserve: ["Whether one draft is sent."],
      resultSupportingHypothesis: "The draft is sent.",
      resultWeakeningHypothesis: "The draft is not sent.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private sharing",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "One draft is sent within 20 minutes.",
          favors: "hyp-structure",
          because: "The private step produced a sent draft.",
        },
        {
          outcome: "Errors stay clustered in unfamiliar steps.",
          favors: "hyp-skill",
          because: "The block stays in the unfamiliar steps.",
        },
        {
          outcome: "The feeling shifted.",
          favors: "inconclusive",
          because: "Nothing concrete interrupted the session.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/observable/i);
  });

  function rivalHypothesis(
    id: string,
    title: string,
    category: "psychological" | "practical",
  ) {
    return {
      id,
      title,
      category,
      observedPattern: title,
      evidenceFor: ["exp:Q1.1"],
      evidenceAgainst: [],
      contradictionsExplained: [],
      contradictionsNotExplained: [],
      simplerAlternatives: [],
      missingInformation: [],
      originForks: ["container_loss_vs_capacity" as const],
      scoring: {
        evidenceCoverage: 0.6,
        crossContextRecurrence: 0.5,
        contradictionResolution: 0.6,
        personSpecificity: 0.5,
        developmentalFit: 0.3,
        imageConstraintFit: 0.5,
        counterEvidencePenalty: 0.1,
        simplerAlternativePenalty: 0,
      },
      confidence: "moderate" as const,
    };
  }

  it("accepts the stored peer-offering review whose discriminating outcome says freezing", () => {
    const state = experimentState();
    state.hypotheses = [
      rivalHypothesis("hyp-hidden-bargain-potential", "Hidden bargain", "psychological"),
      rivalHypothesis("hyp-executive-container-collapse", "Container collapse", "practical"),
      rivalHypothesis("hyp-commercial-soul-conflict", "Commercial soul", "psychological"),
    ];
    state.experiments = [{
      kind: "behavioral",
      title: "Scaffolded Peer Offering Review",
      hypothesisTested: "hyp-hidden-bargain-potential",
      action: "Schedule a single 25-minute quiet co-working video call with one trusted peer where you read your existing one-page coaching offering aloud to them and ask for their plain understanding of what problem it solves, without making any commercial pitch or social media post.",
      duration: "25 minutes",
      whatToObserve: [
        "Whether having a live external container enables immediate execution or if freezing persists",
        "Somatic and emotional responses during reading (such as anxiety, sadness, or shame about being seen)",
        "Whether resistance focuses on executive initiation, fear of judgment, or moral aversion to commercial language",
      ],
      resultSupportingHypothesis: "Even when external accountability and co-presence are fully supplied, intense internal resistance or shame arises around having the offering witnessed, confirming that preserving uncommitted potential operates independently of executive structure.",
      resultWeakeningHypothesis: "Once the live relational container and session time are established, reading and reviewing the draft proceeds smoothly without debilitating freeze, suggesting executive scaffolding deficits were the primary barrier.",
      riskLevel: "low",
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-executive-container-collapse", "hyp-commercial-soul-conflict"],
      manipulatedVariable: "Relational co-presence and external pacing during task execution",
      heldConstant: [
        "Using your existing coaching offering draft on paper without drafting new copy",
        "A private relational setting with one peer, completely excluding public social media posting or commercial sales asks",
      ],
      sessionMinutes: 25,
      audienceCount: 1,
      exposure: "trusted",
      reversible: true,
      outcomeInterpretations: [
        {
          outcome: "With the live peer container active, reading and reviewing the draft proceeds with clear focus and minimal emotional distress, but initiating solo self-directed work remains blocked when unprompted.",
          favors: "hyp-executive-container-collapse",
          because: "External relational scaffolding directly resolves the execution block, demonstrating that executive dysfunction and missing structure are the principal operational friction.",
          layerUpdates: [
            { layer: "practical", effect: "strengthens" },
            { layer: "psychological", effect: "weakens" },
            { layer: "developmental", effect: "unchanged" },
          ],
        },
        {
          outcome: "Despite the presence of the trusted peer container, acute shame and freezing emerge during reading, accompanied by strong impulses to deprecate the work or hide the text from view.",
          favors: "hyp-hidden-bargain-potential",
          because: "Resistance persists even when practical executive support is present, pointing toward a protective defense against reality testing and vulnerability.",
          layerUpdates: [
            { layer: "practical", effect: "unchanged" },
            { layer: "psychological", effect: "strengthens" },
            { layer: "developmental", effect: "strengthens" },
          ],
        },
        {
          outcome: "The reading is executed easily, but acute distress arises specifically around feeling like an infobusiness hustler who sells air or loses soul for money.",
          favors: "hyp-commercial-soul-conflict",
          because: "The block is specifically localized to moral and identity conflict regarding commercial offerings rather than executive initiation or general exposure.",
          layerUpdates: [
            { layer: "practical", effect: "unchanged" },
            { layer: "psychological", effect: "strengthens" },
            { layer: "developmental", effect: "weakens" },
          ],
        },
        {
          outcome: "The peer is unresponsive or the call is interrupted before the offering can be read aloud, leaving the interaction uncompleted within the 25-minute window.",
          favors: "inconclusive",
          because: "A concrete logistical interruption prevented the live test of task execution under relational scaffolding.",
          layerUpdates: [
            { layer: "practical", effect: "inconclusive" },
            { layer: "psychological", effect: "inconclusive" },
            { layer: "developmental", effect: "inconclusive" },
          ],
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed, finding.detail).toBe(true);
  });

  it.each([
    ["freezing", "Acute freezing appears before the peer hears the offering."],
    ["froze", "The person froze before the peer hears the offering."],
    ["frozen", "The offering stays frozen before the peer hears it."],
    ["charging", "The person keeps charging a fee before the peer hears the offering."],
    ["completing", "The person is completing it before the peer hears the offering."],
    ["scoring", "The person is scoring the step before the peer hears the offering."],
    ["messaging", "The person is messaging before the peer hears the offering."],
    ["prototyping", "The person is prototyping before the peer hears the offering."],
    ["noting", "The person is noting a reaction before the peer hears the offering."],
    ["mistaking", "The person is mistaking the step before the peer hears the offering."],
  ])("accepts %s as an observable outcome inflection", (_label, outcome) => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Inflected outcome",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding task difficulty unchanged.",
      duration: "2 weeks",
      whatToObserve: ["Number of five planned task attempts completed under accountability."],
      resultSupportingHypothesis: "Execution improves materially.",
      resultWeakeningHypothesis: "Execution remains unchanged.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome,
          favors: "hyp-structure",
          because: "The changed condition produced this event while task difficulty stayed stable.",
        },
        {
          outcome: "Completion stays low and errors cluster in unfamiliar task steps.",
          favors: "hyp-skill",
          because: "Persistent task-specific errors fit limited experience better than missing structure.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed, finding.detail).toBe(true);
  });

  it.skip("rejects shame and hiding during reading when no observable event word is present (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.hypotheses = [
      rivalHypothesis("hyp-hidden-bargain-potential", "Hidden bargain", "psychological"),
      rivalHypothesis("hyp-executive-container-collapse", "Container collapse", "practical"),
    ];
    state.experiments = [{
      kind: "behavioral",
      title: "Shame without an event",
      hypothesisTested: "hyp-hidden-bargain-potential",
      action: "Read the existing offering aloud to one peer while holding the draft unchanged.",
      duration: "25 minutes",
      whatToObserve: ["Whether reading the existing offering proceeds."],
      resultSupportingHypothesis: "Shame appears.",
      resultWeakeningHypothesis: "Reading proceeds.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-executive-container-collapse"],
      manipulatedVariable: "reading the existing offering",
      heldConstant: ["existing offering draft"],
      outcomeInterpretations: [
        {
          outcome: "Despite the presence of the trusted peer container, acute shame emerges during reading, accompanied by strong impulses to deprecate the work or hide the text from view.",
          favors: "hyp-hidden-bargain-potential",
          because: "Resistance persists even when a peer is present.",
        },
        {
          outcome: "The draft is reviewed with minimal distress.",
          favors: "hyp-executive-container-collapse",
          because: "The peer container was enough to move the draft.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/observable/i);
  });

  it.skip("rejects one discriminating outcome plus an inconclusive interruption (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Single discrimination",
      hypothesisTested: "hyp-structure",
      action: "Share the existing draft while holding task difficulty unchanged.",
      duration: "25 minutes",
      whatToObserve: ["Whether one draft is sent."],
      resultSupportingHypothesis: "The draft is sent.",
      resultWeakeningHypothesis: "The call stops.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private sharing",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "Acute freezing appears before the peer hears the offering.",
          favors: "hyp-structure",
          because: "The private step still produced a freeze.",
        },
        {
          outcome: "The peer is unresponsive or the call is interrupted before the offering can be read aloud, leaving the interaction uncompleted within the 25-minute window.",
          favors: "inconclusive",
          because: "A logistical interruption stopped the session before either explanation could be favored.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/different live explanations/i);
  });

  it.skip("rejects success and failure labels even when an inconclusive interruption is also recorded (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Binary plus interruption",
      hypothesisTested: "hyp-structure",
      action: "Share the existing draft while holding task difficulty unchanged.",
      duration: "25 minutes",
      whatToObserve: ["Whether one draft is sent."],
      resultSupportingHypothesis: "Success.",
      resultWeakeningHypothesis: "Failure.",
      riskLevel: "low",
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "private sharing",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        { outcome: "Success", favors: "hyp-structure", because: "The test worked." },
        { outcome: "Failure", favors: "hyp-skill", because: "The test failed." },
        {
          outcome: "The peer is unresponsive or the call is interrupted before the offering can be read aloud, leaving the interaction uncompleted within the 25-minute window.",
          favors: "inconclusive",
          because: "The interruption is not evidence for either explanation.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/non-success\/failure outcomes/i);
  });

  it.skip("rejects oversized, inverse-proof, and invented-body experiments (retired discrimination contract; CAR-130)", () => {
    const cases: Array<{ patch: Record<string, unknown>; pattern: RegExp }> = [
      {
        patch: { sessionMinutes: 90, audienceCount: 3, exposure: "public" },
        pattern: /justification/i,
      },
      {
        patch: {
          sessionMinutes: 10,
          audienceCount: 1,
          exposure: "private",
          outcomeInterpretations: [
            {
              outcome: "The structure test failed, therefore shadow protection is primary.",
              favors: "hyp-structure",
              because: "Failure isolates the real cause.",
              layerUpdates: [
                { layer: "practical", effect: "weakens" },
                { layer: "psychological", effect: "inconclusive" },
              ],
            },
            {
              outcome: "Four of five attempts are completed.",
              favors: "hyp-skill",
              because: "Completion changed with the variable.",
              layerUpdates: [
                { layer: "practical", effect: "strengthens" },
                { layer: "psychological", effect: "unchanged" },
              ],
            },
          ],
        },
        pattern: /proves a motive|primary/i,
      },
      {
        patch: {
          action: "Notice tightness in your chest during one ten-minute private draft while holding task difficulty unchanged.",
          sessionMinutes: 10,
          audienceCount: 1,
          exposure: "private",
          outcomeInterpretations: [
            {
              outcome: "One draft is completed.",
              favors: "hyp-structure",
              because: "The private step changed output.",
              layerUpdates: [
                { layer: "practical", effect: "strengthens" },
                { layer: "psychological", effect: "unchanged" },
              ],
            },
            {
              outcome: "Errors stay in unfamiliar task steps.",
              favors: "hyp-skill",
              because: "Task errors fit the rival.",
              layerUpdates: [
                { layer: "practical", effect: "inconclusive" },
                { layer: "psychological", effect: "unchanged" },
              ],
            },
          ],
        },
        pattern: /chest/i,
      },
    ];
    for (const { patch, pattern } of cases) {
      const state = experimentState();
      state.experiments = [{
        kind: "behavioral",
        title: "Structure test",
        hypothesisTested: "hyp-structure",
        action: "Add external accountability while holding task difficulty unchanged.",
        duration: "10 minutes",
        whatToObserve: ["Completed drafts."],
        resultSupportingHypothesis: "Output rises.",
        resultWeakeningHypothesis: "Output stays low.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: ["hyp-skill"],
        manipulatedVariable: "external accountability",
        heldConstant: ["task difficulty"],
        outcomeInterpretations: [
          {
            outcome: "Four of five planned attempts are completed.",
            favors: "hyp-structure",
            because: "Execution changed when structure changed.",
          },
          {
            outcome: "Errors cluster in unfamiliar task steps.",
            favors: "hyp-skill",
            because: "Task-specific errors fit the rival.",
          },
        ],
        ...patch,
      }];
      const result = experimentBoundToHypothesis(state);
      expect(result.passed, pattern.source).toBe(false);
      expect(result.detail, pattern.source).toMatch(pattern);
    }
  });

  it("rejects a report that turns one trusted recipient into three", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Private share",
      hypothesisTested: "hyp-structure",
      action: "Show one private draft to one trusted person while holding task difficulty unchanged.",
      duration: "10 minutes",
      whatToObserve: ["Whether the draft is completed."],
      resultSupportingHypothesis: "The draft is completed.",
      resultWeakeningHypothesis: "The draft is not completed.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "trusted feedback",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [],
    }];
    const mismatch = experimentCopyAgrees([
      section("experiment", "Send the draft to three colleagues this week.", ["exp:Q1.1"]),
    ], state);
    expect(mismatch.passed).toBe(false);
    const match = experimentCopyAgrees([
      section("experiment", "Show the draft to one trusted person.", ["exp:Q1.1"]),
    ], state);
    expect(match.passed).toBe(true);
  });

  it("accepts concrete artifact and action outcomes outside the original keyword list", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Artifact comparison",
      hypothesisTested: "hyp-structure",
      action: "Change external accountability while holding prototype scope unchanged.",
      duration: "2 weeks",
      whatToObserve: ["Prototype revisions and sharing behavior."],
      resultSupportingHypothesis: "The prototype is finished and shared.",
      resultWeakeningHypothesis: "Domain-specific defects persist.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["prototype scope"],
      outcomeInterpretations: [
        {
          outcome: "A private prototype is finished and shared without repeated revision.",
          favors: "hyp-structure",
          because: "Finishing the stable artifact after accountability changes favors structure.",
        },
        {
          outcome: "The same prototype retains domain-specific defects despite stable support.",
          favors: "hyp-skill",
          because: "Persistent defects in the unchanged artifact favor the skill explanation.",
        },
      ],
    }];

    expect(experimentBoundToHypothesis(state).passed).toBe(true);
  });

  it("accepts a private-versus-public exposure test that holds a 45-minute block constant", () => {
    const state = experimentState();
    state.hypotheses = [
      {
        ...state.hypotheses[0],
        id: "protective_bargain_eternal_potential",
        title: "Protective bargain",
        observedPattern: "Public exposure threatens an untested identity.",
      },
      {
        ...state.hypotheses[1],
        id: "container_loss_adhd_scaffolding",
        title: "Container loss",
        observedPattern: "Action needs an external accountability container.",
      },
    ];
    state.experiments = [{
      kind: "behavioral",
      title: "Scaffolded Outreach: Public Broadcast vs. Direct Private Offer",
      hypothesisTested: "protective_bargain_eternal_potential",
      action:
        "Schedule two separate 45-minute co-working sessions with a body-doubling partner to hold the external structural container strictly constant. In session A, write and send two direct private messages offering a coaching session. In session B, under the exact same co-working container and time boundary, draft and publish one public post.",
      duration: "one week",
      whatToObserve: ["Whether initiation freezes only on the public post."],
      resultSupportingHypothesis: "Private messages go out and the public post freezes.",
      resultWeakeningHypothesis: "Both tasks stall.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: ["one peer"],
      competingHypothesisIds: ["container_loss_adhd_scaffolding"],
      manipulatedVariable: "Degree of public identity exposure (private direct message vs. public broadcast)",
      heldConstant: [
        "Coaching offer substance, price, and scope",
        "External accountability container (real-time body doubling)",
        "Task duration and environment (45 minutes per block)",
      ],
      outcomeInterpretations: [
        {
          outcome: "Execution succeeds in direct private outreach but freezes during the public post.",
          favors: "protective_bargain_eternal_potential",
          because: "The container was present, and the remaining block was public visibility.",
        },
        {
          outcome: "Execution stalls equally on both private outreach and public posting.",
          favors: "container_loss_adhd_scaffolding",
          because: "Initiation failed even with the same accountability container.",
        },
      ],
    }];

    expect(experimentBoundToHypothesis(state).passed).toBe(true);
  });

  it.skip("rejects vague internal-state outcomes without a measure or observable action (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Internal impression",
      hypothesisTested: "hyp-structure",
      action: "Change external accountability while holding task difficulty unchanged.",
      duration: "2 weeks",
      whatToObserve: ["Whether the experience feels different."],
      resultSupportingHypothesis: "The experience feels easier.",
      resultWeakeningHypothesis: "The experience feels harder.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "Focus feels stronger and continuing feels easier.",
          favors: "hyp-structure",
          because: "The subjective shift could fit added structure.",
        },
        {
          outcome: "Focus feels weaker and continuing feels harder.",
          favors: "hyp-skill",
          because: "The subjective shift could fit limited experience.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/observable/i);
  });

  it.skip("rejects success and failure paraphrases with generic experiment wording (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Generic result wording",
      hypothesisTested: "hyp-structure",
      action: "Change external accountability while holding task difficulty unchanged.",
      duration: "2 weeks",
      whatToObserve: ["Completed attempts and task-specific errors."],
      resultSupportingHypothesis: "The experiment works well.",
      resultWeakeningHypothesis: "The experiment does not work well.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "The experiment works well.",
          favors: "hyp-structure",
          because: "The test appears successful.",
        },
        {
          outcome: "The experiment does not work well.",
          favors: "hyp-skill",
          because: "The test appears unsuccessful.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/non-success\/failure outcomes/i);
  });

  it.skip("rejects a behavioral experiment whose manipulated variable is irrelevant to its action (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [
      {
        kind: "behavioral",
        title: "Irrelevant manipulation",
        hypothesisTested: "hyp-structure",
        action: "Change external coffee brands while completing the same outreach task.",
        duration: "2 weeks",
        whatToObserve: ["Completed outreach attempts under each coffee brand."],
        resultSupportingHypothesis: "Execution improves with structure.",
        resultWeakeningHypothesis: "Execution does not improve.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: ["hyp-skill"],
        manipulatedVariable: "external accountability",
        heldConstant: ["outreach task", "time available"],
        outcomeInterpretations: [
          {
            outcome: "Four of five outreach attempts are completed with accountability.",
            favors: "hyp-structure",
            because: "The changed structure altered execution while the task stayed stable.",
          },
          {
            outcome: "Completion remains low and errors cluster around unfamiliar task steps.",
            favors: "hyp-skill",
            because: "Stable difficulty despite structure would fit a skill gap better.",
          },
        ],
      },
    ];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/manipulatedVariable.*action/i);
  });

  it("passes when hypothesisTested exactly matches an open fork id", () => {
    const state = experimentState();

    state.experiments = [
      {
        kind: "behavioral",
        title: "Fork test",
        hypothesisTested:
          "container_loss_vs_capacity",
        action:
          "Change external structure while holding task difficulty stable.",
        duration: "2 weeks",
        whatToObserve:
          ["Whether structure changes execution."],
        resultSupportingHypothesis:
          "Execution improves.",
        resultWeakeningHypothesis:
          "Execution does not improve.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: ["hyp-skill"],
        manipulatedVariable: "external structure",
        heldConstant: ["task difficulty"],
        outcomeInterpretations: [
          {
            outcome: "At least four of five planned attempts are completed with external structure.",
            favors: "container_loss_vs_capacity",
            because: "Changing structure changed execution while task difficulty stayed stable.",
          },
          {
            outcome: "Completion stays low and errors cluster in unfamiliar task steps.",
            favors: "hyp-skill",
            because: "Task-specific errors despite structure fit the skill explanation better.",
          },
        ],
      },
    ];

    expect(
      experimentBoundToHypothesis(state).passed,
    ).toBe(true);
  });

  it.skip("fails free-form hypothesisTested prose (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();

    state.experiments = [
      {
        kind: "behavioral",
        title: "Loose test",
        hypothesisTested:
          "Maybe missing structure is the real issue",
        action: "Try more accountability.",
        duration: "1 week",
        whatToObserve: ["Whether action changes."],
        resultSupportingHypothesis:
          "More action.",
        resultWeakeningHypothesis:
          "No change.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
    ];

    const finding =
      experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(
      /exactly match/i,
    );
  });

  it.skip("fails unknown competing hypothesis ids (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();

    state.experiments = [
      {
        kind: "behavioral",
        title: "Bad rival",
        hypothesisTested: "hyp-structure",
        action: "Try more accountability.",
        duration: "1 week",
        whatToObserve: ["Whether action changes."],
        resultSupportingHypothesis:
          "More action.",
        resultWeakeningHypothesis:
          "No change.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [
          "hyp-does-not-exist",
        ],
        heldConstant: [],
        outcomeInterpretations: [],
      },
    ];

    const finding =
      experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(
      /unknown competingHypothesisIds/i,
    );
  });

  it.skip("rejects outcomes that all favor the same hypothesis (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "One-sided outcome map",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding task difficulty stable.",
      duration: "2 weeks",
      whatToObserve: ["Completed attempts and task-specific errors."],
      resultSupportingHypothesis: "Completion rises.",
      resultWeakeningHypothesis: "Completion stays low.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "Four of five attempts are completed.",
          favors: "hyp-structure",
          because: "Added structure coincided with more execution.",
        },
        {
          outcome: "One of five attempts is completed.",
          favors: "hyp-structure",
          because: "The structure dose may have been too weak.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/different live explanations/i);
  });

  it.skip("rejects success-versus-failure labels without observable outcomes (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Binary labels",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding task difficulty stable.",
      duration: "2 weeks",
      whatToObserve: ["Completed attempts."],
      resultSupportingHypothesis: "Success.",
      resultWeakeningHypothesis: "Failure.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        { outcome: "Success", favors: "hyp-structure", because: "The test worked." },
        { outcome: "Failure", favors: "hyp-skill", because: "The test failed." },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/non-success\/failure outcomes/i);
  });

  it.skip("rejects outcome mappings without a stated reason (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Missing rationale",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding task difficulty stable.",
      duration: "2 weeks",
      whatToObserve: ["Completed attempts and task-specific errors."],
      resultSupportingHypothesis: "Completion rises.",
      resultWeakeningHypothesis: "Task-specific errors persist.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "Four of five attempts are completed.",
          favors: "hyp-structure",
          because: "Execution changed under added structure.",
        },
        {
          outcome: "Errors persist in unfamiliar task steps.",
          favors: "hyp-skill",
          because: "",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/for stated reasons/i);
  });

  it.skip("rejects a false exposure experiment that varies structure instead of exposure (retired discrimination contract; CAR-130)", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Public exposure test",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding task difficulty stable.",
      duration: "2 weeks",
      whatToObserve: ["Whether public visibility changes completion."],
      resultSupportingHypothesis: "Completion rises.",
      resultWeakeningHypothesis: "Completion stays low.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "Four of five visible attempts are completed.",
          favors: "hyp-structure",
          because: "Execution improved under added accountability.",
        },
        {
          outcome: "Errors persist in unfamiliar task steps.",
          favors: "hyp-skill",
          because: "Stable errors fit limited experience better.",
        },
      ],
    }];

    const finding = experimentBoundToHypothesis(state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/must vary exposure/i);
  });

  it("allows an accountability experiment whose stable task happens to be outreach", () => {
    const state = experimentState();
    state.experiments = [{
      kind: "behavioral",
      title: "Accountability on a stable outreach task",
      hypothesisTested: "hyp-structure",
      action: "Add external accountability while holding outreach task difficulty stable.",
      duration: "2 weeks",
      whatToObserve: ["Completed outreach attempts out of five and task-specific errors."],
      resultSupportingHypothesis: "Completion rises under accountability.",
      resultWeakeningHypothesis: "Task-specific errors persist.",
      riskLevel: "low",
      layerUpdates: [],
      practicalRequirements: [],
      competingHypothesisIds: ["hyp-skill"],
      manipulatedVariable: "external accountability",
      heldConstant: ["outreach task difficulty"],
      outcomeInterpretations: [
        {
          outcome: "At least four of five outreach attempts are completed.",
          favors: "hyp-structure",
          because: "Execution changed under accountability while the outreach task stayed stable.",
        },
        {
          outcome: "Completion stays low and errors cluster in unfamiliar outreach steps.",
          favors: "hyp-skill",
          because: "Persistent task-specific errors fit limited experience better.",
        },
      ],
    }];

    expect(experimentBoundToHypothesis(state).passed).toBe(true);
  });

  it("requires at least one behavioral experiment", () => {
    const state = experimentState();
    state.symbolicMaterial.scene = "A locked garden gate.";
    state.experiments = [
      {
        kind: "imaginal",
        title: "Ask the gate",
        hypothesisTested: "hyp-structure",
        action: "Ask the supplied gate what changes when support is added, then stop.",
        duration: "10 minutes",
        whatToObserve: ["What associations arise."],
        resultSupportingHypothesis: "Support changes the scene.",
        resultWeakeningHypothesis: "Support makes no difference.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
    ];

    const finding = experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/behavioral or integrated experiment|imaginal experiment must be grounded/i);
  });

  it("rejects imaginal experiments without supplied symbolic material", () => {
    const state = experimentState();
    const baseExperiment = {
      title: "Structure test",
      hypothesisTested: "hyp-structure",
      duration: "1 week",
      whatToObserve: ["What changes."],
      resultSupportingHypothesis: "The scene or behavior changes.",
      resultWeakeningHypothesis: "Nothing changes.",
      riskLevel: "low" as const,
      practicalRequirements: [],
      competingHypothesisIds: [],
      heldConstant: [],
      outcomeInterpretations: [],
    };
    state.experiments = [
      {
        ...baseExperiment,
        kind: "behavioral",
        action: "Add one accountability session while holding the task stable.",
      },
      {
        ...baseExperiment,
        kind: "imaginal",
        title: "Ask an imagined gate",
        action: "Imagine a gate and ask what it wants.",
      },
    ];

    const finding = experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/imaginal.*supplied symbolic material/i);
  });

  it("rejects imaginal experiments that script unsupplied dialogue", () => {
    const state = experimentState();
    state.symbolicMaterial.scene = "A locked garden gate.";
    state.symbolicMaterial.obstacleSpeech = "Stay until the ground is yours.";
    const common = {
      hypothesisTested: "hyp-structure",
      duration: "1 week",
      whatToObserve: ["What changes."],
      resultSupportingHypothesis: "The response changes.",
      resultWeakeningHypothesis: "The response stays stable.",
      riskLevel: "low" as const,
      practicalRequirements: [],
      competingHypothesisIds: [],
      heldConstant: [],
      outcomeInterpretations: [],
    };
    state.experiments = [
      {
        ...common,
        kind: "behavioral",
        title: "Structure test",
        action: "Add accountability while keeping the task stable.",
      },
      {
        ...common,
        kind: "imaginal",
        title: "Scripted gate reply",
        action: 'Ask the supplied gate what it wants. The gate answers "Leave now."',
      },
    ];

    const finding = experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/invented|unsupplied|dialogue/i);
  });

  it("rejects imaginal experiments built around unrelated invented imagery", () => {
    const state = experimentState();
    state.symbolicMaterial.scene = "A locked garden gate.";
    state.experiments = [
      {
        kind: "behavioral",
        title: "Structure test",
        hypothesisTested: "hyp-structure",
        action: "Add accountability while keeping the task stable.",
        duration: "1 week",
        whatToObserve: ["What changes."],
        resultSupportingHypothesis: "The response changes.",
        resultWeakeningHypothesis: "The response stays stable.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
      {
        kind: "imaginal",
        title: "Invented dragon",
        hypothesisTested: "hyp-structure",
        action: "Imagine a red dragon circling a mountain and follow it into a cave.",
        duration: "10 minutes",
        whatToObserve: ["What the dragon reveals."],
        resultSupportingHypothesis: "The dragon demands support.",
        resultWeakeningHypothesis: "The dragon disappears.",
        riskLevel: "low",
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
    ];

    const finding = experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/grounded|supplied symbolic material/i);
  });

  it("rejects unsupplied imaginal replies without double quotes", () => {
    const state = experimentState();
    state.symbolicMaterial.scene = "A locked garden gate.";
    state.symbolicMaterial.obstacleSpeech = "Stay until the ground is yours.";
    state.experiments = [
      {
        kind: "behavioral",
        title: "Structure test",
        hypothesisTested: "hyp-structure",
        action: "Add accountability while keeping the task stable.",
        duration: "1 week",
        whatToObserve: ["What changes."],
        resultSupportingHypothesis: "The response changes.",
        resultWeakeningHypothesis: "The response stays stable.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
      {
        kind: "imaginal",
        title: "Invented reply",
        hypothesisTested: "hyp-structure",
        action: "Return to A locked garden gate. Ask once; it replies 'Leave now.'",
        duration: "10 minutes",
        whatToObserve: ["What changes."],
        resultSupportingHypothesis: "The supplied scene changes.",
        resultWeakeningHypothesis: "The supplied scene stays stable.",
        riskLevel: "low",
      layerUpdates: [],
        practicalRequirements: [],
        competingHypothesisIds: [],
        heldConstant: [],
        outcomeInterpretations: [],
      },
    ];

    const finding = experimentBoundToHypothesis(state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/invented|unsupplied|dialogue/i);
  });
});

describe("Tier-A citation gates", () => {
  const origin = extractCaseStateFull("o1", originAnswers);

  it("image_cited passes when rich associations are cited in any interpretive section", () => {
    const sections = [
      section(
        "alternative",
        "The image may point toward a different explanation of the stall.",
        ["o1:Q10.1"],
      ),
    ];

    expect(
      imageCited(sections, origin).passed,
    ).toBe(true);
  });

  it("image_cited fails when rich associations exist but no Q10 evidence appears", () => {
    const sections = [
      section(
        "reality",
        "Practical constraints dominate.",
        ["o1:Q0.5"],
      ),
      section(
        "hidden",
        "One hypothesis about structure.",
        ["o1:Q9.2"],
      ),
    ];

    expect(
      imageCited(sections, origin).passed,
    ).toBe(false);
  });

  it("image_cited passes when reality cites Q10", () => {
    const sections = [
      section(
        "reality",
        "The pipe associations mark mid-crossing.",
        ["o1:Q10.1", "o1:Q0.5"],
      ),
      section("hidden", "Structure still carries authority.", ["o1:Q9.2"]),
    ];
    expect(imageCited(sections, origin).passed).toBe(true);
  });

  it("image_cited is disarmed without rich associations", () => {
    const thin = extractCaseStateFull("o1", { "Q1.1": "I stall" });
    const sections = [section("reality", "No image work.", ["o1:Q1.1"])];
    expect(imageCited(sections, thin).passed).toBe(true);
  });

  it("image_cited fails when Q10 appears only as experiment garnish", () => {
    const sections = [
      section(
        "reality",
        "Practical constraints dominate.",
        ["o1:Q0.5"],
      ),
      section(
        "experiment",
        "Use the image during the exercise.",
        ["o1:Q10.1"],
      ),
    ];

    expect(
      imageCited(sections, origin).passed,
    ).toBe(false);
  });

  it("projection_cited fails when figures exist but contradiction/hidden omit them", () => {
    const sections = [
      section("contradiction", "Wanting freedom and structure.", ["o1:Q1.2"]),
      section("hidden", "Protection keeps lightness.", ["o1:Q9.2"]),
      section("reality", "Constraints are real.", ["o1:Q0.5"]),
    ];
    const finding = projectionCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("projection_cited");
  });

  it("projection_cited fails when only hooked-quality language is present without Q5/Q6 refs", () => {
    const sections = [
      section(
        "contradiction",
        "Admiration for grounded mentors marks a hooked quality of claiming space.",
        ["o1:Q1.2"],
      ),
      section("hidden", "Protection keeps lightness.", ["o1:Q9.2"]),
    ];
    expect(projectionCited(sections, origin).passed).toBe(false);
  });

  it("projection_cited passes when projection evidence appears anywhere", () => {
    const sections = [
      section(
        "alternative",
        "Your admiration may point toward a quality you value.",
        ["o1:Q5.1"],
      ),
    ];

    expect(
      projectionCited(sections, origin).passed,
    ).toBe(true);
  });

  it("money_cited fails when money buckets exist but reality/alternative omit them", () => {
    const sections = [
      section("reality", "Deadlines and legitimacy matter.", ["o1:Q0.5"]),
      section("alternative", "Maybe missing skill, not a stance.", ["o1:Q0.5"]),
      section("hidden", "Money still arrives somehow.", ["o1:Q9.2"]),
    ];
    const finding = moneyCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("money_cited");
  });

  it("money_cited passes when money evidence appears anywhere", () => {
    const sections = [
      section(
        "hidden",
        "Your relationship to ease may depend partly on how work used to deliver income.",
        ["o1:Q8.4"],
      ),
    ];

    expect(
      moneyCited(sections, origin).passed,
    ).toBe(true);
  });

  it("reportLayerCoverage fails when indicated layers are missing", () => {
    const sections = [
      section("problem", "You stall.", ["o1:Q1.1"]),
      section("reality", "Only practical notes.", ["o1:Q0.5"]),
    ];
    expect(reportLayerCoverage(sections, origin).passed).toBe(false);
  });

  it("reportLayerCoverage passes with generic persona/symbol language (no origin tokens)", () => {
    const state = extractCaseStateFull("gen", {
      "Q1.1": "I stall on making the offer real.",
      "Q5.1": "A mentor who claims space",
      "Q10.1": "A dark hallway with a locked door ahead",
      "Q10.2": "Cold stone walls",
      "Q10.6": "Turn back before you are seen",
    });
    state.affect.chargeIntensity = 2;
    state.affect.emotions = [
      {
        id: "gen:Q2.1",
        assessmentId: "gen",
        questionId: "Q2.1",
        rawQuote: "anxiety and freeze",
        normalizedMeaning: "anxiety and freeze",
        evidenceType: "emotion",
      },
    ];
    state.hiddenBargain.benefitsOfStaying = [
      {
        id: "gen:Q9.2",
        assessmentId: "gen",
        questionId: "Q9.2",
        rawQuote: "Keeps identity intact",
        normalizedMeaning: "Keeps identity intact",
        evidenceType: "self_interpretation",
      },
    ];
    state.history.supportiveStructures = [
      {
        id: "gen:Q4.1",
        assessmentId: "gen",
        questionId: "Q4.1",
        rawQuote: "Years inside an institution",
        normalizedMeaning: "Years inside an institution",
        evidenceType: "history",
      },
    ];

    const sections = [
      section(
        "problem",
        "You stall when the role must become real — an identity and self-image bind.",
        ["gen:Q1.1"],
      ),
      section(
        "reality",
        "The scene and associations mark a locked threshold; anxiety and freeze show in the body.",
        ["gen:Q10.1", "gen:Q10.6"],
      ),
      section(
        "contradiction",
        "You admire figures who claim space while rejecting those who hustle for legitimacy.",
        ["gen:Q5.1"],
      ),
      section(
        "hidden",
        "One hypothesis: the bargain protects you from ordinary exposure.",
        ["gen:Q9.2"],
      ),
      section(
        "alternative",
        "A skill gap and missing institutional history may suffice without depth.",
        ["gen:Q4.1"],
      ),
      section("experiment", "For two weeks, ship one small public offer.", ["gen:Q1.1"]),
    ];
    expect(reportLayerCoverage(sections, state).passed).toBe(true);
  });
});

describe("client voice gates", () => {
  it("second_person fails on the-client diction", () => {
    const sections = [
      section("problem", "The client presents a stall after leaving IT.", ["o1:Q1.1"]),
      section("reality", "Practical constraints matter.", ["o1:Q0.5"]),
    ];
    expect(secondPersonVoice(sections).passed).toBe(false);
  });

  it("second_person passes You-address without the-client", () => {
    const sections = [
      section("problem", "You stall after leaving IT.", ["o1:Q1.1"]),
      section("reality", "Your constraints include ADHD and money pressure.", ["o1:Q0.5"]),
    ];
    expect(secondPersonVoice(sections).passed).toBe(true);
  });

  it("plain_titles fails on thesis subtitles", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "problem",
        title: "The Stated Predicament and Economic Pressure",
        body: "You stall after leaving IT for coaching.",
        evidenceRefs: ["o1:Q1.1"],
      }),
    ];
    expect(plainTitles(sections).passed).toBe(false);
  });

  it("plain_titles accepts The-… near-canonical peel labels", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "hidden",
        title: "The hidden position",
        body: "You may be protecting a purity bargain.",
        evidenceRefs: ["o1:Q9.2"],
      }),
      reportSectionSchema.parse({
        id: "alternative",
        title: "The alternative",
        body: "Your stall may be a skill and structure gap.",
        evidenceRefs: ["o1:Q0.5"],
      }),
      reportSectionSchema.parse({
        id: "experiment",
        title: "The experiment",
        body: "For two weeks you run a minimum viable offer.",
        evidenceRefs: ["o1:Q1.1"],
      }),
      reportSectionSchema.parse({
        id: "jungian",
        title: "The Jungian lens",
        body: "A polarity may illuminate the stall without diagnosing you.",
        evidenceRefs: ["o1:Q2.1"],
      }),
    ];
    expect(plainTitles(sections).passed).toBe(true);
  });

  it("no_analyst_openers fails on clinical essay openers", () => {
    const sections = [
      section(
        "reality",
        "Examining the deeper structural layers reveals evocative imagery in your pipe scene.",
        ["o1:Q10.1"],
      ),
    ];
    expect(noAnalystOpeners(sections).passed).toBe(false);
  });
});

describe("soft-depth conditional peel gates", () => {
  it("protectionAndAimInPeel skips when hidden is absent", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    expect(protectionAndAimInPeel([section("problem", "You stall.", ["g1:Q1.1"])], state).passed).toBe(
      true,
    );
  });

  it("protectionAndAimInPeel fails when CaseState has aim but peel only names protection", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    state.hiddenPosition = {
      consciousPosition: "freedom",
      observedPattern: "stall",
      possibleHiddenPosition: "keeps authority outside",
      protectiveFunction: ["Protects ethereal identity"],
      possibleCompensatoryAim: "structure in service of aliveness",
      threatenedByChange: [],
      developmentalTension: { poleA: "a", poleB: "b" },
      imageVoteSummary: "n/a",
      evidenceRefs: ["g1:Q1.1"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };
    const sections = [
      section("hidden", "Your protection keeps lightness without ordinary exposure.", ["g1:Q1.1"]),
    ];
    expect(protectionAndAimInPeel(sections, state).passed).toBe(false);
  });

  it("protectionAndAimInPeel passes when peel names both siblings", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    state.hiddenPosition = {
      consciousPosition: "freedom",
      observedPattern: "stall",
      possibleHiddenPosition: "keeps authority outside",
      protectiveFunction: ["Protects ethereal identity"],
      possibleCompensatoryAim: "structure in service of aliveness",
      threatenedByChange: [],
      developmentalTension: { poleA: "a", poleB: "b" },
      imageVoteSummary: "n/a",
      evidenceRefs: ["g1:Q1.1"],
      counterEvidenceRefs: [],
      confidence: "moderate",
    };
    const sections = [
      section(
        "hidden",
        "Your protection keeps lightness; the developmental aim may be structure in service of aliveness.",
        ["g1:Q1.1"],
      ),
    ];
    expect(protectionAndAimInPeel(sections, state).passed).toBe(true);
  });

  it("imaginalWhenSpeech passes without obstacleSpeech when no dialogue is invented", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });

    const sections = [
      section(
        "reality",
        "You face practical uncertainty.",
        ["g1:Q1.1"],
      ),
    ];

    expect(
      imaginalWhenSpeech(sections, state).passed,
    ).toBe(true);
  });

  it("imaginalWhenSpeech does not require dialogue when supplied speech exists", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });

    state.symbolicMaterial.obstacleSpeech =
      "Turn back before you are seen.";

    const sections = [
      section(
        "reality",
        "You described a threshold image alongside practical uncertainty.",
        ["g1:Q1.1", "g1:Q10.6"],
      ),
    ];

    expect(
      imaginalWhenSpeech(sections, state).passed,
    ).toBe(true);
  });

  it("imaginalWhenSpeech allows supplied speech without inventing a reply", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });

    state.symbolicMaterial.obstacleSpeech =
      "Turn back before you are seen.";

    const sections = [
      section(
        "reality",
        'The obstacle says, "Turn back before you are seen." You can treat that as material to explore rather than as a verdict.',
        ["g1:Q10.6"],
      ),
    ];

    expect(
      imaginalWhenSpeech(sections, state).passed,
    ).toBe(true);
  });

  it("imaginalWhenSpeech fails generated second-turn dialogue", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });

    state.symbolicMaterial.obstacleSpeech =
      "Turn back before you are seen.";

    const sections = [
      section(
        "hidden",
        'The obstacle says, "Turn back before you are seen." You reply that you are ready now.',
        ["g1:Q10.6"],
      ),
    ];

    const finding =
      imaginalWhenSpeech(sections, state);

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(
      /second turn|imaginal reply/i,
    );
  });

  it("does not treat watching how you respond as image dialogue", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });
    state.symbolicMaterial.obstacleSpeech = "you are lost. you failed.";
    const sections = [
      section(
        "experiment",
        "Try two weeks of body-doubling. Moving forward, watching how you respond to structured body-doubling across both weeks.",
        ["g1:Q1.1"],
      ),
    ];

    expect(imaginalWhenSpeech(sections, state).passed).toBe(true);
  });

  it("does not treat you answer as image dialogue", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    const sections = [
      section(
        "questions",
        "What would you answer if the next step stayed private?",
        ["g1:Q1.1"],
      ),
    ];

    expect(imaginalWhenSpeech(sections, state).passed).toBe(true);
  });

  it("rejects a reply spoken by the image", () => {
    const state = extractCaseStateFull("g1", {
      "Q1.1": "stall",
    });
    const sections = [
      section(
        "jungian",
        "The image replies that you should turn back.",
        ["g1:Q10.1"],
      ),
    ];

    expect(imaginalWhenSpeech(sections, state).passed).toBe(false);
  });


  it("antiInflationDiagnosis fails on romance of eternal becoming", () => {
    expect(
      antiInflationDiagnosis(
        "Your stall is the romance of eternal becoming rather than ordinary steps.",
      ).passed,
    ).toBe(false);
    expect(
      antiInflationDiagnosis(
        "One hypothesis: possibility preferred over incarnation, without diagnosing you as an archetype.",
      ).passed,
    ).toBe(true);
  });
  it("allows exact supplied image speech", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked gate.",
      "Q10.6":
        "Turn back until the ground is yours.",
    });

    const sections = [
      section(
        "reality",
        'The obstacle says, "Turn back until the ground is yours." You can treat that as material rather than a verdict.',
        ["img:Q10.6"],
      ),
    ];

    expect(
      imaginalWhenSpeech(
        sections,
        state,
      ).passed,
    ).toBe(true);
  });
  it("fails invented attributed image speech", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked gate.",
      "Q10.6":
        "Turn back until the ground is yours.",
    });

    const sections = [
      section(
        "reality",
        'The obstacle says, "You are not ready yet."',
        ["img:Q10.6"],
      ),
    ];

    const finding =
      imaginalWhenSpeech(
        sections,
        state,
      );

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(
      /does not match|imaginal speech/i,
    );
  });
  it("fails attributed image speech when none was supplied", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked gate.",
    });

    const sections = [
      section(
        "reality",
        'The gate says, "Wait here."',
        ["img:Q10.1"],
      ),
    ];

    expect(
      imaginalWhenSpeech(
        sections,
        state,
      ).passed,
    ).toBe(false);
  });
});

describe("image vote adequacy gate", () => {
  it("passes when there is no rich symbolic material", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
    });

    expect(
      imageVoteAdequate(state).passed,
    ).toBe(true);
  });

  it("fails when rich symbolic material has no persisted votes", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked door",
      "Q10.2": "A dark corridor",
      "Q10.6": "Do not go further",
    });

    state.hypotheses = [
      {
        id: "hyp-a",
        title: "Exposure hypothesis",
        category: "psychological",
        observedPattern:
          "Action stops near visible exposure.",
        evidenceFor: ["img:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: [],
        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.7,
          contradictionResolution: 0.7,
          personSpecificity: 0.8,
          developmentalFit: 0.6,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0.2,
        },
        confidence: "moderate",
      },
    ];

    state.imageVotes = [];
    state.imageVote = undefined;

    expect(
      imageVoteAdequate(state).passed,
    ).toBe(false);
  });

  it("passes when a leading hypothesis receives a grounded image vote", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked door",
      "Q10.2": "A dark corridor",
      "Q10.6": "Do not go further",
    });

    state.hypotheses = [
      {
        id: "hyp-a",
        title: "Exposure hypothesis",
        category: "psychological",
        observedPattern:
          "Action stops near visible exposure.",
        evidenceFor: ["img:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: [],
        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.7,
          contradictionResolution: 0.7,
          personSpecificity: 0.8,
          developmentalFit: 0.6,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0.2,
        },
        confidence: "moderate",
      },
    ];

    state.imageVotes = [
      {
        hypothesisId: "hyp-a",
        verdict: "supports",
        interpretation:
          "The blocked threshold is consistent with the exposure hypothesis.",
        evidenceRefs: [
          "img:Q10.1",
          "img:Q10.6",
        ],
        exactClientMaterialUsed: [
          "A locked door",
          "Do not go further",
        ],
      },
    ];

    expect(
      imageVoteAdequate(state).passed,
    ).toBe(true);
  });

  it("fails an ungrounded insufficient vote on rich symbolic material", () => {
    const state = extractCaseStateFull("img", {
      "Q1.1": "I stall.",
      "Q10.1": "A locked door",
      "Q10.2": "A dark corridor",
      "Q10.6": "Do not go further",
    });

    state.hypotheses = [
      {
        id: "hyp-a",
        title: "Exposure hypothesis",
        category: "psychological",
        observedPattern:
          "Action stops near visible exposure.",
        evidenceFor: ["img:Q1.1"],
        evidenceAgainst: [],
        contradictionsExplained: [],
        contradictionsNotExplained: [],
        simplerAlternatives: [],
        missingInformation: [],
        originForks: [],
        scoring: {
          evidenceCoverage: 0.8,
          crossContextRecurrence: 0.7,
          contradictionResolution: 0.7,
          personSpecificity: 0.8,
          developmentalFit: 0.6,
          imageConstraintFit: 0.5,
          counterEvidencePenalty: 0.1,
          simplerAlternativePenalty: 0.2,
        },
        confidence: "moderate",
      },
    ];

    state.imageVotes = [
      {
        hypothesisId: "hyp-a",
        verdict: "insufficient",
        interpretation:
          "Not enough information.",
        evidenceRefs: [],
        exactClientMaterialUsed: [],
      },
    ];

    expect(
      imageVoteAdequate(state).passed,
    ).toBe(false);
  });

  it("senexScoldOnly fails grind-only framing", () => {
    const finding = senexScoldOnly(
      "You just need more discipline. Stop seeking insight and force yourself through the work.",
    );

    expect(finding.passed).toBe(false);
  });
  it("senexScoldOnly allows discipline inside a genuine polarity", () => {
    const finding = senexScoldOnly(
      "More discipline may matter, but the tension between structure and autonomy needs both poles rather than one replacing the other.",
    );

    expect(finding.passed).toBe(true);
  });
  it("senexScoldOnly does not require aliveness or possibility language", () => {
    const finding = senexScoldOnly(
      "The developmental tension may be between consistency and responsiveness; integrating both matters more than simply working harder.",
    );

    expect(finding.passed).toBe(true);
  });
});

describe("somatic provenance gate", () => {
  it("passes when report makes no explicit body claim", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });

    const sections = [
      section(
        "reality",
        "You describe hesitation before exposure.",
        ["som:Q1.1"],
      ),
    ];

    expect(
      somaticProvenance(
        sections,
        state,
      ).passed,
    ).toBe(true);
  });

  it("fails when report invents a body location", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });

    const sections = [
      section(
        "reality",
        "You feel the conflict as tightness in your chest.",
        ["som:Q1.1"],
      ),
    ];

    const finding =
      somaticProvenance(
        sections,
        state,
      );

    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(
      /body|somatic|sensory/i,
    );
  });

  it("does not treat an instruction to track somatic tension as a body claim", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });
    expect(state.affect.bodyResponses).toEqual([]);
    const sections = [
      section(
        "experiment",
        "Draft one note to relevant contacts. Track your somatic tension, the number of revisions made, and whether you send it.",
        ["som:Q1.1"],
      ),
    ];

    expect(somaticProvenance(sections, state).passed).toBe(true);
  });

  it("allows tracking somatic tension when no body location is claimed", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });
    const sections = [
      section(
        "experiment",
        "Draft one note. Track your somatic tension and the number of revisions, without naming a body location.",
        ["som:Q1.1"],
      ),
    ];

    expect(somaticProvenance(sections, state).passed).toBe(true);
  });

  it("still rejects an asserted somatic sensation that is not an observation instruction", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });
    const sections = [
      section(
        "reality",
        "You feel somatic tension whenever the work becomes public.",
        ["som:Q1.1"],
      ),
    ];

    expect(somaticProvenance(sections, state).passed).toBe(false);
  });

  it("still rejects a sensation asserted in a later sentence after an observation verb", () => {
    const state = extractCaseStateFull("som", {
      "Q1.1": "I keep stalling.",
    });
    const sections = [
      section(
        "reality",
        "Notice the pattern. You feel somatic tension whenever the work becomes public.",
        ["som:Q1.1"],
      ),
    ];

    expect(somaticProvenance(sections, state).passed).toBe(false);
  });

  it("does not mistake practical pressure for a somatic claim", () => {
    const state = extractCaseStateFull("som", {
      "Q0.5": "Financial pressure is real.",
      "Q1.1": "I keep stalling.",
    });

    const sections = [
      section(
        "reality",
        "You are under real financial pressure.",
        ["som:Q0.5"],
      ),
    ];

    expect(
      somaticProvenance(sections, state).passed,
    ).toBe(true);
  });
});
describe("questions and close gate", () => {
  it("identifies only the section with an unsupported certain psychological claim", () => {
    const sections = [
      section(
        "contradiction",
        "You unconsciously avoid committing because success would expose you.",
        ["a1:Q1.1"],
      ),
      section(
        "alternative",
        "A practical job-shape mismatch may also explain the delay.",
        ["a1:Q0.5"],
      ),
    ];

    expect(epistemicallyUncalibratedSectionIds(sections)).toEqual([
      "contradiction",
    ]);
  });

  it("does not let a hedge in one clause mask certainty in another", () => {
    expect(epistemicallyUncalibratedSectionIds([
      section("contradiction", "A practical mismatch may matter, but secretly you fear success.", ["a1:Q1.1"]),
    ])).toEqual(["contradiction"]);
  });

  it("treats unhedged guardian/Self/shadow/anima assignment as epistemically uncalibrated", () => {
    expect(epistemicallyUncalibratedSectionIds([
      section("jungian", "The obstacle is a threshold guardian blocking your path.", ["a1:Q4.1"]),
    ])).toEqual(["jungian"]);
    expect(epistemicallyUncalibratedSectionIds([
      section(
        "jungian",
        "One possible Jungian amplification is that the obstacle could be approached as a threshold guardian.",
        ["a1:Q4.1"],
      ),
    ])).toEqual([]);
  });

  it("does not treat unresolved question text as a declarative certainty claim", () => {
    expect(epistemicallyUncalibratedSectionIds([
      section("questions", "When do you avoid taking the next step? What do you fear losing? What evidence would change your view?", ["a1:Q1.1"]),
    ])).toEqual([]);
  });

  it("passes exactly three questions and a close", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "questions",
        title: "questions",
        body: "1. If clearer structure made execution substantially easier for you, what tension around visibility would still remain? 2. What evidence would weaken the hypothesis for you? 3. What remains unexplained for you?",
        evidenceRefs: ["a1:Q1.1"],
        questionIntents: [
          { question: "If clearer structure made execution substantially easier for you, what tension around visibility would still remain?", targetUncertainty: "Residual tension", couldWeakenSelectedFormulation: false },
          { question: "What evidence would weaken the hypothesis for you?", targetUncertainty: "Whether the formulation fits", couldWeakenSelectedFormulation: true },
          { question: "What remains unexplained for you?", targetUncertainty: "The unresolved remainder", couldWeakenSelectedFormulation: false },
        ],
      }),
      section(
        "close",
        "You can treat this as a working formulation rather than a verdict.",
        ["a1:Q1.1"],
      ),
    ];

    expect(
      questionsAndCloseAdequate(
        sections,
      ).passed,
    ).toBe(true);
  });

  it("rejects a practical-vs-psychological binary question", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "questions",
        title: "questions",
        body: "1. If clearer structure made execution substantially easier for you, what tension around visibility would still remain? 2. Is your primary difficulty missing structure or social vulnerability? 3. What remains unexplained for you?",
        evidenceRefs: ["a1:Q1.1"],
        questionIntents: [
          { question: "If clearer structure made execution substantially easier for you, what tension around visibility would still remain?", targetUncertainty: "Residual", couldWeakenSelectedFormulation: true, couldInvalidateWholeFormulation: true },
          { question: "Is your primary difficulty missing structure or social vulnerability?", targetUncertainty: "Binary", couldWeakenSelectedFormulation: false },
          { question: "What remains unexplained for you?", targetUncertainty: "Unknown", couldWeakenSelectedFormulation: false },
        ],
      }),
      section("close", "A working formulation.", ["a1:Q1.1"]),
    ];
    const state = extractCaseStateFull("a1", { "Q1.1": "I keep stalling." });
    const result = questionsAndCloseAdequate(sections, state);
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/binary/i);
  });

  it("requires a residual-layer question", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "questions",
        title: "questions",
        body: "1. What happens when you test this? 2. What evidence would weaken the hypothesis for you? 3. What remains unexplained for you?",
        evidenceRefs: ["a1:Q1.1"],
        questionIntents: [
          { question: "What happens when you test this?", targetUncertainty: "Behavior", couldWeakenSelectedFormulation: true, couldInvalidateWholeFormulation: true },
          { question: "What evidence would weaken the hypothesis for you?", targetUncertainty: "Fit", couldWeakenSelectedFormulation: false },
          { question: "What remains unexplained for you?", targetUncertainty: "Unknown", couldWeakenSelectedFormulation: false },
        ],
      }),
      section("close", "A working formulation.", ["a1:Q1.1"]),
    ];
    const state = extractCaseStateFull("a1", { "Q1.1": "I keep stalling." });
    const result = questionsAndCloseAdequate(sections, state);
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/residual-layer/i);
  });

  it("fails inverse-proof close language via closeInverseProof", () => {
    const finding = closeInverseProof([
      section(
        "close",
        "If structure works, then the practical hypothesis is primary and wins.",
        ["a1:Q1.1"],
      ),
    ]);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("close-inverse-proof");
    expect(closeInverseProof([
      section(
        "close",
        "If the practical change helps a lot, that contribution is clearly important and psychological material is not retired.",
        ["a1:Q1.1"],
      ),
    ]).passed).toBe(true);
  });

  it("ignores a preamble before three numbered questions", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "questions",
        title: "questions",
        body: "Stay with these questions as inquiry tools rather than seeking immediate answers: 1. If clearer structure made execution substantially easier for you, what tension around visibility would still remain? 2. When you notice the pattern, what boundary feels adult to you? 3. What remains unexplained for you?",
        evidenceRefs: ["a1:Q1.1"],
        questionIntents: [
          { question: "If clearer structure made execution substantially easier for you, what tension around visibility would still remain?", targetUncertainty: "Residual tension", couldWeakenSelectedFormulation: true, couldInvalidateWholeFormulation: true },
          { question: "When you notice the pattern, what boundary feels adult to you?", targetUncertainty: "Which boundary is at stake", couldWeakenSelectedFormulation: false },
          { question: "What remains unexplained for you?", targetUncertainty: "The unresolved remainder", couldWeakenSelectedFormulation: false },
        ],
      }),
      section(
        "close",
        "You can treat this as a working formulation rather than a verdict.",
        ["a1:Q1.1"],
      ),
    ];

    const state = extractCaseStateFull("a1", { "Q1.1": "I keep stalling." });
    expect(questionsAndCloseAdequate(sections, state).passed).toBe(true);
  });

  it("rejects questions that only choose among supplied explanations", () => {
    const sections = [
      reportSectionSchema.parse({
        id: "questions",
        title: "questions",
        body: "1. Which of your two explanations do you prefer? 2. Which hypothesis feels closer to you? 3. What would you test next?",
        evidenceRefs: ["a1:Q1.1"],
        questionIntents: [
          { question: "Which of your two explanations do you prefer?", targetUncertainty: "Preference", couldWeakenSelectedFormulation: true, couldInvalidateWholeFormulation: false },
          { question: "Which hypothesis feels closer to you?", targetUncertainty: "Fit", couldWeakenSelectedFormulation: false, couldInvalidateWholeFormulation: false },
          { question: "What would you test next?", targetUncertainty: "Action", couldWeakenSelectedFormulation: false, couldInvalidateWholeFormulation: false },
        ],
      }),
      section("close", "You can treat this as a working formulation.", ["a1:Q1.1"]),
    ];
    const state = extractCaseStateFull("a1", { "Q1.1": "I keep stalling." });
    const result = questionsAndCloseAdequate(sections, state);
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/whole formulation/i);
  });

  it("fails when the questions section has fewer than three questions", () => {
    const sections = [
      section(
        "questions",
        "What would you test? What remains unexplained?",
        ["a1:Q1.1"],
      ),
      section(
        "close",
        "You can treat this as a working formulation.",
        ["a1:Q1.1"],
      ),
    ];

    expect(
      questionsAndCloseAdequate(
        sections,
      ).passed,
    ).toBe(false);
  });

  it("rejects leading questions and preloaded answers", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    const questions = reportSectionSchema.parse({
      id: "questions",
      title: "questions",
      body: "Why do you avoid commitment? What do you notice? What remains unknown for you?",
      evidenceRefs: ["a1:Q1.1"],
      questionIntents: [
        { question: "Why do you avoid commitment?", targetUncertainty: "Commitment", couldWeakenSelectedFormulation: true },
        { question: "What do you notice?", targetUncertainty: "Observation", couldWeakenSelectedFormulation: false },
        { question: "What remains unknown for you?", targetUncertainty: "Unknowns", couldWeakenSelectedFormulation: false },
      ],
    });
    expect(questionsAndCloseAdequate([questions, section("close", "A working formulation.", ["a1:Q1.1"])], state).passed).toBe(false);
  });

  it("rejects duplicate intents that leave a rendered question unvalidated", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    const repeated = "What evidence would weaken this formulation for you?";
    const questions = reportSectionSchema.parse({
      id: "questions", title: "questions",
      body: `${repeated} Why do you avoid commitment? What remains unknown for you?`,
      evidenceRefs: ["a1:Q1.1"],
      questionIntents: [
        { question: repeated, targetUncertainty: "Fit", couldWeakenSelectedFormulation: true },
        { question: repeated, targetUncertainty: "Action", couldWeakenSelectedFormulation: false },
        { question: repeated, targetUncertainty: "Unknowns", couldWeakenSelectedFormulation: false },
      ],
    });
    expect(questionsAndCloseAdequate([questions, section("close", "A working formulation.", ["a1:Q1.1"])], state).passed).toBe(false);
  });

  it("rejects a close that omits the rival, unknowns, and updating evidence", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A visible next step appears.", response: "Action pauses.", shortTermFunction: "Uncertainty falls.", longTermCost: "Evidence stays scarce.", reinforcingConsequence: "More certainty feels necessary.",
      },
      whyItFits: ["Delay recurs."], whatItDoesNotExplain: ["Market fit."], strongestAlternative: "The role may simply be a poor job-shape match.", unresolvedForks: [],
    };
    expect(closeSynthesisAdequate([
      section("close", "You can treat certainty as a working formulation.", ["a1:Q1.1"]),
    ], state).passed).toBe(false);
  });

  it("rejects generic token overlap as a substitute for synthesis", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "A recurring pattern delays visible commitment.",
      maintenanceMechanism: { trigger: "Visibility", response: "Delay", shortTermFunction: "Relief", longTermCost: "No learning", reinforcingConsequence: "Uncertainty continues" },
      whyItFits: ["It recurs"], whatItDoesNotExplain: ["Fit"],
      strongestAlternative: "Practical market uncertainty may explain the pause.", unresolvedForks: [],
    };
    expect(closeSynthesisAdequate([
      section("close", "The pattern and practical unknowns remain; evidence could change it.", ["a1:Q1.1"]),
    ], state).passed).toBe(false);
  });

  it("accepts a developmental section that keeps value, danger, and an unknown third", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A visible next step appears.", response: "Action pauses.", shortTermFunction: "Uncertainty falls.", longTermCost: "Evidence stays scarce.", reinforcingConsequence: "More certainty feels necessary.",
      },
      developmentalFormulation: {
        consciousPole: "freedom",
        compensatingPole: "structure",
        coreOpposition: "freedom and structure",
        possibleDevelopmentalTask: "Relate to freedom and structure without ranking either pole.",
        uncertainty: "ADHD remains true.",
        evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
      },
      whyItFits: ["Delay recurs."],
      whatItDoesNotExplain: ["Market fit."],
      strongestAlternative: "The role may simply be a poor job-shape match.",
      unresolvedForks: [],
    };
    const good = "Freedom may protect aliveness and openness, while also making continuity hard to sustain. Structure may protect continuity and material safety, while also carrying the danger of deadening or externally imposed form. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.";
    expect(developmentalSectionQuality([
      section("developmental", good, ["a1:Q2.1"]),
    ], state).passed).toBe(true);
    for (const bad of [
      "Freedom is childish; structure is mature. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.",
      "Your psyche wants discipline. Freedom may protect aliveness while structure carries danger. This is a pattern you may be able to observe and relate to; it is not the whole of who you are. What might arise between these positions is not yet known.",
      "Integrate both. Freedom may protect aliveness while structure carries the danger of deadening. This is a pattern you may be able to observe and relate to; it is not the whole of who you are.",
    ]) {
      expect(developmentalSectionQuality([
        section("developmental", bad, ["a1:Q2.1"]),
      ], state).passed, bad).toBe(false);
    }
    state.finalFormulation = {
      ...state.finalFormulation,
      developmentalFormulation: undefined,
    };
    expect(developmentalSectionQuality([], state).passed).toBe(true);
    expect(developmentalSectionQuality([
      section("developmental", good, ["a1:Q2.1"]),
    ], state).passed).toBe(false);
  });

  it("rejects a close that treats a failed practical test as proof of a psychological primary", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A visible next step appears.", response: "Action pauses.", shortTermFunction: "Uncertainty falls.", longTermCost: "Evidence stays scarce.", reinforcingConsequence: "More certainty feels necessary.",
      },
      whyItFits: ["Delay recurs."],
      whatItDoesNotExplain: ["Market fit."],
      strongestAlternative: "The role may simply be a poor job-shape match.",
      unresolvedForks: [],
    };
    const result = closeSynthesisAdequate([
      section(
        "close",
        "Waiting for certainty sustains delay, and a poor job-shape match remains possible. Unknowns remain, and new evidence can update the formulation. Structure failed, therefore persona protection is primary.",
        ["a1:Q1.1"],
      ),
    ], state);
    expect(result.passed).toBe(false);
    expect(result.detail).toMatch(/proof that another is primary/i);
  });

  it("accepts a close that says the formulation should be updated and names the developmental task", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "The cycle repeats because making big outward leaps creates an image of decisive courage, while freezing at the point of commercial exposure protects an idealized sense of potential from being tested and judged by reality.",
      maintenanceMechanism: {
        trigger: "Commercial exposure.",
        response: "Freezing.",
        shortTermFunction: "Potential stays untested.",
        longTermCost: "The offer stays private.",
        reinforcingConsequence: "The image of courage remains.",
      },
      developmentalFormulation: {
        consciousPole: "independence",
        compensatingPole: "containment",
        coreOpposition: "potential versus accountability",
        possibleDevelopmentalTask: "Tolerating ordinary, imperfect visibility and routine containment without interpreting structure as a loss of soul or freedom.",
        uncertainty: "The third is unknown.",
        evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
      },
      whyItFits: ["Exposure freezes."],
      whatItDoesNotExplain: ["Skill."],
      strongestAlternative: "Loss of institutional scaffolding and ADHD executive collapse, where the absence of external deadlines and direct dependencies dissolves operational momentum regardless of psychological conflict.",
      unresolvedForks: [],
    };
    const stored = "As a provisional working formulation, your transition appears suspended between two intertwined layers: practical ADHD executive disruption following the removal of corporate scaffolding, and a protective maintenance loop where freezing at the point of commercial exposure preserves an idealized sense of potential and shields you from public evaluation. The strongest alternative remains that your paralysis is fundamentally an operational container deficit compounded by the steep learning curve of client acquisition under acute financial pressure. Whether 1-to-1 coaching represents your true occupational vehicle or an unsustainable bridge remains an open question. This formulation should be updated based on how your nervous system responds to low-stakes external sharing and structured accountability.";
    const withTask = `${stored} The developmental task is tolerating ordinary visibility and routine containment.`;
    expect(closeSynthesisAdequate([
      section("close", withTask, ["a1:Q1.1"]),
    ], state).passed).toBe(true);
    expect(closeSynthesisAdequate([
      section("close", withTask.replace("updated", "updating"), ["a1:Q1.1"]),
    ], state).passed).toBe(true);
  });

  it("still rejects the stored close when it omits the developmental task", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "The cycle repeats because making big outward leaps creates an image of decisive courage, while freezing at the point of commercial exposure protects an idealized sense of potential from being tested and judged by reality.",
      maintenanceMechanism: {
        trigger: "Commercial exposure.",
        response: "Freezing.",
        shortTermFunction: "Potential stays untested.",
        longTermCost: "The offer stays private.",
        reinforcingConsequence: "The image of courage remains.",
      },
      developmentalFormulation: {
        consciousPole: "independence",
        compensatingPole: "containment",
        coreOpposition: "potential versus accountability",
        possibleDevelopmentalTask: "Tolerating ordinary, imperfect visibility and routine containment without interpreting structure as a loss of soul or freedom.",
        uncertainty: "The third is unknown.",
        evidenceRefs: ["a1:Q2.1", "a1:Q6.1"],
      },
      whyItFits: ["Exposure freezes."],
      whatItDoesNotExplain: ["Skill."],
      strongestAlternative: "Loss of institutional scaffolding and ADHD executive collapse, where the absence of external deadlines and direct dependencies dissolves operational momentum regardless of psychological conflict.",
      unresolvedForks: [],
    };
    const stored = "As a provisional working formulation, your transition appears suspended between two intertwined layers: practical ADHD executive disruption following the removal of corporate scaffolding, and a protective maintenance loop where freezing at the point of commercial exposure preserves an idealized sense of potential and shields you from public evaluation. The strongest alternative remains that your paralysis is fundamentally an operational container deficit compounded by the steep learning curve of client acquisition under acute financial pressure. Whether 1-to-1 coaching represents your true occupational vehicle or an unsustainable bridge remains an open question. This formulation should be updated based on how your nervous system responds to low-stakes external sharing and structured accountability.";
    const finding = closeSynthesisAdequate([
      section("close", stored, ["a1:Q1.1"]),
    ], state);
    expect(finding.passed).toBe(false);
    expect(finding.detail).toMatch(/warranted development/i);
  });

  it("rejects updated wording that does not synthesize the maintenance formulation", () => {
    const state = extractCaseStateFull("a1", originAnswers);
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Waiting for certainty sustains delay.",
      maintenanceMechanism: {
        trigger: "A visible next step appears.",
        response: "Action pauses.",
        shortTermFunction: "Uncertainty falls.",
        longTermCost: "Evidence stays scarce.",
        reinforcingConsequence: "More certainty feels necessary.",
      },
      whyItFits: ["Delay recurs."],
      whatItDoesNotExplain: ["Market fit."],
      strongestAlternative: "The role may simply be a poor job-shape match.",
      unresolvedForks: [],
    };
    expect(closeSynthesisAdequate([
      section("close", "A different story remains open, and the formulation should be updated later.", ["a1:Q1.1"]),
    ], state).passed).toBe(false);
  });
});
