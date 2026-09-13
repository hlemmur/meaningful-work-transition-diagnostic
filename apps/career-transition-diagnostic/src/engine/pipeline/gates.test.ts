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
} from "./gates";

const originAnswers = JSON.parse(
  readFileSync(join(__dirname, "fixtures/origin-case-answers.json"), "utf8"),
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

describe("Tier-A citation gates", () => {
  const origin = extractCaseStateFull("o1", originAnswers);

  it("image_cited fails when rich associations exist but reality/hidden omit image", () => {
    const sections = [
      section("reality", "Practical constraints dominate.", ["o1:Q0.5"]),
      section("hidden", "One hypothesis about structure.", ["o1:Q9.2"]),
      section("experiment", "Imagine the pipe across a threshold.", ["o1:Q1.1"]),
    ];
    const finding = imageCited(sections, origin);
    expect(finding.passed).toBe(false);
    expect(finding.id).toBe("image_cited");
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

  it("projection_cited passes with Q5 refs on contradiction", () => {
    const sections = [
      section(
        "contradiction",
        "Admiration for grounded mentors marks a hooked quality of claiming space.",
        ["o1:Q1.2", "o1:Q5.1"],
      ),
      section("hidden", "Protection keeps lightness.", ["o1:Q9.2"]),
    ];
    expect(projectionCited(sections, origin).passed).toBe(true);
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

  it("money_cited passes with Q8 refs on reality", () => {
    const sections = [
      section(
        "reality",
        "Industry machinery once delivered income.",
        ["o1:Q8.4", "o1:Q0.5"],
      ),
      section("alternative", "Skill gap may suffice.", ["o1:Q0.5"]),
    ];
    expect(moneyCited(sections, origin).passed).toBe(true);
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

  it("imaginalWhenSpeech skips without obstacleSpeech", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    expect(
      imaginalWhenSpeech([section("reality", "Practical notes only.", ["g1:Q1.1"])], state).passed,
    ).toBe(true);
  });

  it("imaginalWhenSpeech fails when speech exists without imaginal or dialogue", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    state.symbolicMaterial.obstacleSpeech = "Turn back before you are seen.";
    const sections = [
      section("reality", "Money pressure is real and ADHD constraints matter.", ["g1:Q1.1"]),
      section("hidden", "One hypothesis about authority outside.", ["g1:Q1.1"]),
    ];
    expect(imaginalWhenSpeech(sections, state).passed).toBe(false);
  });

  it("imaginalWhenSpeech passes with generic dialogue engagement (no origin tokens)", () => {
    const state = extractCaseStateFull("g1", { "Q1.1": "stall" });
    state.symbolicMaterial.obstacleSpeech = "Turn back before you are seen.";
    const sections = [
      section(
        "reality",
        "You ask the image what it wants; its voice says you are unequipped at the threshold.",
        ["g1:Q1.1"],
      ),
    ];
    expect(imaginalWhenSpeech(sections, state).passed).toBe(true);
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
});
