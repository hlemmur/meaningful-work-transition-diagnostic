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
      expect(prompt.version, key).toMatch(/\.v[2-9]\d*$/);
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
  "overallNote",
]);
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
  "centralFormulation",
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
      "caseSnapshot",
      "finalFormulation",
      "centralFormulation",
      "whatItDoesNotExplain",
      "strongestAlternative",
      "unresolvedForks",
      "distinct question",
      "Q11.3",
      "requestedInsight",
      "image",
      "projection",
      "money",
      "bargain",
      "polarity",
      "second person",
      "the client",
      "requiredCitations",
      "citeRefs",
      "requiredTitles",
      "possibleCompensatoryAim",
      "obstacleSpeech",
      "wantedQuality",
      "claim→cite",
      "body location",
      "symbol",
      "hypothesis",
    ]);
    
    expect(promptRegistry.pass9.text).toMatch(
      /never generate.*reply|second turn of dialogue|new speech/i,
    );
    expect(promptRegistry.pass9.text).toMatch(
      /body location only if|mention a body location only if/i,
    );
    expect(promptRegistry.pass9.text).toMatch(
      /you are a puer\/senex|archetypal identity/i,
    )
    expect(promptRegistry.pass9.text).not.toMatch(/\bpipe\b/i);
    expect(promptRegistry.pass9.text).not.toMatch(/\bprovider\b/i);
    
    expect(promptRegistry.pass9.version).toBe("pass-9.v9");
    
    expectMentions(promptRegistry.pass10.text, [
      "failingSectionIds",
      "regeneratedSections",
      "Q11.3",
      "requestedInsight",
      "draftReport",
      "caseSnapshot",
      "finalFormulation",
      "whatItDoesNotExplain",
      "unresolvedForks",
      "evidenceRefs",
      "requiredTitles",
      "one-sentence",
      "the client",
      "second-person",
      "body location",
      "imaginal",
      "dialogue",
      "symbol",
      "hypothesis",
      "constraints",
      "experiment",
    ]);
    
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
    
    expect(promptRegistry.pass10.version).toBe("pass-10.v9");
    expect(promptRegistry.pass8.version).toBe("pass-8.v5");
  });
});
