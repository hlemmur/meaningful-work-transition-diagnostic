export const ENGINE_VERSION = "engine.v2" as const;

export {
  ANALYTICAL_OS,
  ANALYTICAL_OS_VERSION,
  ANALYTICAL_OS_REQUIRED_PHRASES,
  ANALYTICAL_OS_BANNED_PHRASES,
  ANALYTICAL_OS_MAX_CHARS,
} from "./analytical-os";
export { passCardFor, PASS_CARD_STAGES } from "./pass-cards";

type PromptStub = {
  version: string;
  text: string;
};

const FORK_IDS =
  "history_vs_stated_cause, impostor_filter_vs_inexperience, container_loss_vs_capacity, legitimacy_loop, work_vs_identity_vs_job_shape, money_infrastructure_vs_misalignment, background_income_relief_vs_replacement, rational_caution_vs_hidden_bargain";

const EMPTY_ARRAYS = "Empty arrays are valid.";

const CHECKPOINT_JSON = `Return JSON with openForks (array of fork ids: ${FORK_IDS}), safety { level: none|high, flags }, and adaptiveQuestion null or { forkId, rationale, questionText }. Select 0 or 1 adaptive question. ${EMPTY_ARRAYS} No Jungian labels.`;

export const promptRegistry = {
  checkpointA: {
    version: "checkpoint-a.v2",
    text: `Pass 1-lite after Section 2. Extract facts, actions, and the stated problem. Prefer origin fork history vs stated cause. ${CHECKPOINT_JSON}`,
  },
  checkpointB: {
    version: "checkpoint-b.v2",
    text: `Pass 1-lite after Section 4. Update affect, gaze, container, and evidence absorption. Prefer container-loss, impostor-filter, or legitimacy loop. ${CHECKPOINT_JSON}`,
  },
  checkpointC: {
    version: "checkpoint-c.v2",
    text: `Pass 1-lite after Section 7. Discriminate work vs identity vs job-shape. ${CHECKPOINT_JSON}`,
  },
  checkpointD: {
    version: "checkpoint-d.v2",
    text: `Pass 1-lite after Section 9. Discriminate rational caution vs hidden bargain, and background income as relief vs replacement. Stay within the total adaptive cap. ${CHECKPOINT_JSON}`,
  },
  checkpointSafety: {
    version: "checkpoint-safety.v2",
    text: `Classify crisis or acute distress. Return safety.level none or high. Do not send free-text or safety content to analytics. If high, skip remaining depth probes and reduce later report depth. ${EMPTY_ARRAYS} Flags may be an empty array.`,
  },
  pass1: {
    version: "pass-1.v2",
    text: `Extract CaseState facts, client interpretations, identity claims, and practical constraints. Do not treat Q11.3 as a conclusion. Return JSON { consciousExplanationTags: string[], unresolvedQuestions: string[] }. ${EMPTY_ARRAYS}`,
  },
  pass2: {
    version: "pass-2.v2",
    text: `Generate up to 6 contradictions and keep 1 central plus up to 2 secondary. Rank by charge, recurrence, and explanatory importance. Return JSON { contradictions } with at least 1 item. Each contradiction needs id, statementA, statementB, evidenceA, evidenceB, significance, categories, originForks, scores { evidenceStrength, recurrence, explanatoryImportance, charge } as numbers. originForks must be from: ${FORK_IDS}. ${EMPTY_ARRAYS}`,
  },
  pass3: {
    version: "pass-3.v2",
    text: `Generate 3-5 competing hypotheses including at least one mundane candidate when evidence warrants it. Return JSON { hypotheses } with 3-5 items. Each needs id, title, category (psychological|identity|practical|environmental|economic|occupational|developmental|structural), observedPattern, evidenceFor, evidenceAgainst, contradictionsExplained, contradictionsNotExplained, simplerAlternatives, missingInformation, originForks (${FORK_IDS}), scoring { evidenceCoverage, crossContextRecurrence, contradictionResolution, personSpecificity, developmentalFit, imageConstraintFit, counterEvidencePenalty, simplerAlternativePenalty } as numbers, confidence (weak|tentative|moderate|strong). ${EMPTY_ARRAYS} Do not invent hypotheses to pad the count.`,
  },
  pass4: {
    version: "pass-4.v2",
    text: `Adversarial critic: assume the previous analyst is over-psychologizing. Prefer a sufficient mundane explanation. Return JSON { critiques: [{ hypothesisId, mundaneAlternative, survives: boolean }] }. ${EMPTY_ARRAYS}`,
  },
  pass5: {
    version: "pass-5.v2",
    text: `Image vote before resolution. Personal associations outrank symbol dictionaries. A weaken verdict must drop rank. Return JSON { votes: at least 1 of { hypothesisId, verdict: supports|weakens|splits|insufficient, note, evidenceRefs }, overallNote: string }. ${EMPTY_ARRAYS}`,
  },
  pass6: {
    version: "pass-6.v3",
    text: `Resolve Hidden Position as hypothesis language. Never use requestedInsight as possibleHiddenPosition. Keep a concrete alternative. Return JSON { hiddenPosition: nullable object with consciousPosition, observedPattern, possibleHiddenPosition, protectiveFunction, possibleCompensatoryAim (required non-empty string when hiddenPosition is present — name protection AND developmental aim, e.g. structure in service of aliveness), threatenedByChange, developmentalTension { poleA, poleB }, imageVoteSummary, evidenceRefs, counterEvidenceRefs, confidence tentative|moderate|strong; alternative: string }. ${EMPTY_ARRAYS} hiddenPosition may be null.`,
  },
  pass7: {
    version: "pass-7.v3",
    text: `Jungian amplification only after resolution. Return JSON { jungianLenses: 0-3 items, omitReason?: string }. Zero concepts is acceptable ONLY with a non-empty omitReason explaining why no lens is warranted. Never say You are a Puer. Each lens needs concept, observedPatternItIlluminates, whyUseful, evidenceRefs, limitsOfInterpretation, confidence tentative|moderate|strong. ${EMPTY_ARRAYS}`,
  },
  pass8: {
    version: "pass-8.v3",
    text: `Reality check plus experiments. Always include at least one behavioral experiment bound to the winning hypothesis or open fork. When charge is indicated or caseSnapshot.tierA.image has scene/obstacleSpeech, also include one short kind:imaginal sibling that engages that image speech/scene (not garnish-only). Return JSON { realityCheck: { sufficientWithoutDepth, categories, narrative, evidenceRefs }, experiments: at least 1 of { kind: behavioral|imaginal, title, hypothesisTested, action, duration, whatToObserve, resultSupportingHypothesis, resultWeakeningHypothesis, riskLevel: low|moderate, practicalRequirements } }. ${EMPTY_ARRAYS}`,
  },
  pass9: {
    version: "pass-9.v8",
    text: `Compose the full client report in peel order from caseSnapshot evidence — not from requestedInsight. Voice: second person only (You/Your); never refer to the person as “the client.” Titles MUST equal caseSnapshot.requiredTitles[id] for each section — no thesis subtitles. Ban clinical/essay openers (presents a compelling, examining the deeper, evocative imagery, sophisticated psychological bargain, from a process-oriented). When caseSnapshot.requiredCitations is non-null for a Tier-A bucket, you MUST copy those refs into evidenceRefs on the named mustCiteIn sections (image → reality/hidden with …:Q10.*; projection → contradiction/hidden with …:Q5./:Q6.*; money → reality/alternative with …:Q8.). Use tierA.image.citeRefs / tierA.money.citeRefs / projection evidenceRefs — never invent tierA-image, tierA-projections, or similar placeholders. Open peel image → projection → money → bargain when those buckets exist. When hiddenPosition.possibleCompensatoryAim is present, name protection AND that aim as siblings in the hidden section (prefer structure in service of aliveness wording when it fits). If tierA.image.obstacleSpeech is non-empty, give 1–2 turns of second-person dialogue with that speech in reality or hidden. When projections include wantedQuality or judgedQuality, include one ownership-of-gold beat as hypothesis — never “you are the Shadow.” When affect/charge is indicated, include a body locus or protecting emotion in a depth beat before theory. Prefer short claim→cite beats from answersByQuestionId / evidence quotes over theory-without-case-facts. Hypothesis language; ban diagnostic eternal-youth / "you are a puer|senex" / romance-of-eternal-becoming identity framing (client quotes OK); prefer polarity/compensation. Jungian section stays thin. Return JSON { sections: array of { id, title, body, evidenceRefs } }. Required section ids in order: problem, reality, contradiction, hidden (omit only if no hiddenPosition survived), alternative, experiment, jungian (omit only if no jungian lenses). Every body must be at least 2-3 substantive paragraphs tied to evidenceRefs. Across the report, evidenceRefs must cite at least 3 distinct question ids (e.g. Q1.1, Q0.4, Q1.3). Never use Q11.3 / requestedInsight as the narrative spine or the only plot. Never return a single thin section. ${EMPTY_ARRAYS}`,
  },
  pass10: {
    version: "pass-10.v8",
    text: `Report critic. Inspect draftReport.sections against caseSnapshot. Fail sections that: paraphrase requestedInsight / Q11.3 as the narrative spine; use third-person “the client” / clinical essay diction / titles that ignore requiredTitles; omit Tier-A caseSnapshot.requiredCitations when present (image …:Q10. in reality/hidden; projection …:Q5./:Q6.; money …:Q8.); invent tierA-* placeholder refs; use inflation diagnosis phrasing (eternal youth identity, you are a puer/senex, romance of eternal becoming / endless becoming as identity — client quotes OK); name protection in hidden without possibleCompensatoryAim when that field is present on the snapshot; ignore non-empty tierA.image.obstacleSpeech (no dialogue and no imaginal engagement); write multi-paragraph theory without concrete facts from answersByQuestionId / evidenceAllowlist; share a single question id across the whole draft; are one-sentence or missing peel ids (problem/reality/contradiction/alternative/experiment); Jungian overreach; ignored constraints; thin alternatives. Regenerate only failing sections — keep the same peel section ids, write multi-paragraph second-person bodies grounded in case facts, and cite diverse evidenceRefs from evidenceAllowlist / requiredCitations (≥3 distinct question ids across the full draft after merge). Return JSON { failingSectionIds: string[], regeneratedSections: [{ id, title, body, evidenceRefs }] }. If the draft is already grounded, return empty arrays. ${EMPTY_ARRAYS}`,
  },
} satisfies Record<string, PromptStub>;
