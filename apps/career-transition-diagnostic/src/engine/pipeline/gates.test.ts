import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractCaseStateFull } from "@/engine/checkpoints/extract";
import { reportSectionSchema } from "@/engine/schemas/analysis";
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
  imageVoteAdequate,
  senexScoldOnly,
  somaticProvenance,
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
  it("passes when hypothesisTested exactly matches a live hypothesis id", () => {
    const state = experimentState();

    state.experiments = [
      {
        kind: "behavioral",
        title: "Structure test",
        hypothesisTested: "hyp-structure",
        action:
          "Add external accountability while leaving the task unchanged.",
        duration: "2 weeks",
        whatToObserve:
          ["Whether execution changes under added structure."],
        resultSupportingHypothesis:
          "Execution improves materially.",
        resultWeakeningHypothesis:
          "Execution remains unchanged.",
        riskLevel: "low",
        practicalRequirements: [],
        competingHypothesisIds: ["hyp-skill"],
        manipulatedVariable: "external accountability",
        heldConstant: ["task", "offer"],
        outcomeInterpretations: [],
      },
    ];

    expect(
      experimentBoundToHypothesis(state).passed,
    ).toBe(true);
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
        practicalRequirements: [],
        competingHypothesisIds: [],
        manipulatedVariable: "external structure",
        heldConstant: ["task difficulty"],
        outcomeInterpretations: [],
      },
    ];

    expect(
      experimentBoundToHypothesis(state).passed,
    ).toBe(true);
  });

  it("fails free-form hypothesisTested prose", () => {
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

  it("fails unknown competing hypothesis ids", () => {
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