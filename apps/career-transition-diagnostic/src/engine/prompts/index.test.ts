import { describe, expect, it } from "vitest";
import { promptRegistry } from "./index";

const FORK_IDS = [
  "history_vs_stated_cause",
  "impostor_filter_vs_inexperience",
  "container_loss_vs_capacity",
  "legitimacy_loop",
  "work_vs_identity_vs_job_shape",
  "money_infrastructure_vs_misalignment",
  "background_income_relief_vs_replacement",
  "rational_caution_vs_hidden_bargain",
] as const;

function expectMentions(text: string, needles: string[]) {
  for (const needle of needles) {
    expect(text, `missing “${needle}”`).toMatch(new RegExp(needle, "i"));
  }
}

describe("promptRegistry contracts", () => {
  it("bumps every stub off v1 and names a JSON contract", () => {
    for (const [key, prompt] of Object.entries(promptRegistry)) {
      expect(prompt.version, key).toMatch(/\.v(?:[2-9]|\d{2,})$/);
      expect(prompt.text.length, key).toBeGreaterThan(200);
      expect(prompt.text, key).toMatch(/empty arrays? are valid/i);
    }
  });

  it("lists fork ids and checkpoint fields for A–D and safety", () => {
    for (const key of ["checkpointA", "checkpointB", "checkpointC", "checkpointD"] as const) {
      expectMentions(promptRegistry[key].text, [
        "openForks",
        "adaptiveQuestion",
        "0 or 1",
        "safety",
        ...FORK_IDS,
      ]);
      expect(promptRegistry[key].text).toMatch(/Jungian/i);
    }

    expectMentions(promptRegistry.checkpointSafety.text, ["none", "high", "skip remaining depth"]);
  });

  it("states pass 1–10 field, enum, and count contracts", () => {
    expectMentions(promptRegistry.pass1.text, [
      "consciousExplanationTags",
      "unresolvedQuestions",
      "Q11.3",
    ]);
    expectMentions(promptRegistry.pass2.text, [
      "contradictions",
      "at least 1",
      "originForks",
      "scores",
      ...FORK_IDS,
    ]);
    expectMentions(promptRegistry.pass3.text, [
      "3-5",
      "hypotheses",
      "psychological",
      "identity",
      "practical",
      "environmental",
      "economic",
      "occupational",
      "developmental",
      "structural",
      "originForks",
      "scoring",
      "confidence",
      "weak",
      "tentative",
      "moderate",
      "strong",
    ]);
    expectMentions(promptRegistry.pass4.text, [
      "hypothesisId",
      "strongestMundaneAlternative",
      "counterEvidenceRefs",
      "missingEvidence",
      "confirmationBiasRisk",
      "overPsychologizingRisk",
      "evidenceActuallyUniqueToHypothesis",
      "rankAdjustment",
      "raise",
      "keep",
      "lower",
      "reject",
      "reason",
    ]);
    // pass5
expectMentions(promptRegistry.pass5.text, [
  "hypothesisId",
  "verdict",
  "supports",
  "weakens",
  "splits",
  "insufficient",
  "interpretation",
  "evidenceRefs",
  "exactClientMaterialUsed",
  "imageAnalysis",
  "literalFacts",
  "fieldEvidenceRefs",
  "personalAssociations",
  "plausibleReadings",
  "supportsHypothesisIds",
  "weakensHypothesisIds",
  "unresolvedSymbolicQuestion",
  "projectionInterpretations",
  "projectionEvidenceRefs",
  "possibleDisownedValue",
  "literalEnactmentRisk",
  "matureExpression",
  "overallNote",
]);
expect(promptRegistry.pass5.text).toMatch(
  /omit the projection interpretation record when no interpretive field is warranted/i,
);
    // pass6
expectMentions(promptRegistry.pass6.text, [
  "selectedHypothesisId",
  "forkResolutions",
  "forkId",
  "status",
  "leans_a",
  "leans_b",
  "both",
  "unresolved",
  "not_relevant",
  "finalFormulation",
  "maintenanceFormulation",
  "maintenanceMechanism",
  "maintainingLoop",
  "selfConfirmingResult",
  "developmentalFormulation",
  "at least two",
  "whyItFits",
  "whatItDoesNotExplain",
  "strongestAlternative",
  "unresolvedForks",
  "hiddenPosition",
  "alternative",
]);
    expectMentions(promptRegistry.pass7.text, [
      "jungianLenses",
      "0-3",
      "omitReason",
      "You are a Puer",
      "tentative",
    ]);
    // pass8
expectMentions(promptRegistry.pass8.text, [
  "competingHypothesisIds",
  "manipulatedVariable",
  "heldConstant",
  "outcomeInterpretations",
  "outcome",
  "favors",
  "because",
]);
    expect(promptRegistry.pass8.text).toMatch(/exactly one|exact id|exactly matching/i);
    expect(promptRegistry.pass8.text).not.toMatch(/\bpipe\b/i);
    expect(promptRegistry.pass8.text).not.toMatch(/\bprovider\b/i);

    expectMentions(promptRegistry.pass9.text, [
      "sections",
      "peel",
      "evidenceRefs",
      "problem",
      "reality",
      "contradiction",
      "alternative",
      "experiment",
      "questions",
      "close",
      "caseSnapshot",
      "evidenceAllowlist",
      "answersByQuestionId",
      "distinct question",
      "Q11.3",
      "requestedInsight",
      "image",
      "projection",
      "money",
      "Tier-A",
      "polarity",
      "second person",
      "the client",
      "requiredTitles",
      "possibleCompensatoryAim",
      "finalFormulation",
      "selectedHypothesisId",
      "maintenanceFormulation",
      "maintainingLoop",
      "developmentalFormulation",
      "The developmental tension",
      "whyItFits",
      "whatItDoesNotExplain",
      "strongestAlternative",
      "unresolvedForks",
      "somatic",
      "dialogue",
      "exactly 3",
      "working formulation",
      "provisional",
    ]);

    expect(promptRegistry.pass9.text).not.toMatch(/\bpipe\b/i);
    expect(promptRegistry.pass9.text).not.toMatch(/\bprovider\b/i);
    expect(promptRegistry.pass9.text).not.toMatch(/\bmustCiteIn\b/i);
    expect(promptRegistry.pass9.version).toBe("pass-9.v15");
    expect(promptRegistry.pass9.text).toMatch(/couldInvalidateWholeFormulation/);
    expect(promptRegistry.pass9.text).toMatch(/invalidat\w* the whole formulation/i);
    expect(promptRegistry.pass9.text).toMatch(/What may also be true/);
    expect(promptRegistry.pass9.text).not.toMatch(/Freedom is childish/i);

    expect(promptRegistry.pass9.text).toMatch(
      /never generate.*reply|second turn of dialogue|new speech/i,
    );
    expect(promptRegistry.pass9.text).toMatch(
      /body location only if|mention a body location only if/i,
    );
    expect(promptRegistry.pass9.text).toMatch(
      /you are a puer\/senex|archetypal identity/i,
    )

    expectMentions(promptRegistry.pass10.text, [
      "failingSectionIds",
      "regeneratedSections",
      "Q11.3",
      "requestedInsight",
      "draftReport",
      "evidenceAllowlist",
      "distinct question",
      "Tier-A",
      "the client",
      "requiredTitles",
      "possibleCompensatoryAim",
      "finalFormulation",
      "maintenanceFormulation",
      "maintenanceMechanism",
      "maintainingLoop",
      "developmentalFormulation",
      "strongestAlternative",
      "whatItDoesNotExplain",
      "unresolvedForks",
      "somatic",
      "dialogue",
      "questions",
      "exactly 3",
      "close",
      "provisional",
    ]);

    expect(promptRegistry.pass10.text).not.toMatch(/\bmustCiteIn\b/i);

    expect(promptRegistry.pass10.text).toMatch(
      /invent.*body|body location/i,
    );

    expect(promptRegistry.pass10.text).toMatch(
      /second turn of dialogue|new imaginal speech|writes speech/i,
    );

    expect(promptRegistry.pass10.text).toMatch(
      /turns? a hypothesis into a fact|hypothesis.*fact/i,
    );

    expect(promptRegistry.pass10.text).toMatch(
      /you are a puer\/senex|archetypal identity/i,
    );

    expect(promptRegistry.pass10.version).toBe("pass-10.v14");
    expect(promptRegistry.pass10.text).toMatch(/couldInvalidateWholeFormulation/);
    expect(promptRegistry.pass10.text).toMatch(/invalidat\w* the whole formulation/i);
    expect(promptRegistry.pass8.version).toBe("pass-8.v8");
    expect(promptRegistry.pass8.text).toMatch(/existing factor/i);
    expect(promptRegistry.pass8.text).toMatch(/favors to "inconclusive"/i);
    expect(promptRegistry.pass8.text).toMatch(/No result proves an unconscious motive/i);
    expect(promptRegistry.pass8.text).not.toMatch(/the result proves the unconscious motive/i);
    expect(promptRegistry.pass6.version).toBe("pass-6.v9");
    expect(promptRegistry.pass6.text).toMatch(/otherwise return null/i);
    expect(promptRegistry.pass6.text).not.toMatch(/otherwise omit it/i);
    expect(promptRegistry.pass6.text).toMatch(/possibleThird: null \| string/);
    expect(promptRegistry.pass6.text).toMatch(/practical_primary/);
    expect(promptRegistry.pass6.text).toMatch(/psychological_primary/);
    expect(promptRegistry.pass6.text).toMatch(/layered/);
    expect(promptRegistry.pass6.text).toMatch(/unresolved/);
    expect(promptRegistry.pass6.text).toMatch(/Do not manufacture balance/i);
    expect(promptRegistry.pass6.text).not.toMatch(/either practical or psychological/i);
  });
});
