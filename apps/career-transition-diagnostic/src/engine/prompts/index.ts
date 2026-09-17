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
    version: "pass-1.v3",
    text: `Review the already-extracted caseSnapshot. Do not re-extract CaseState and do not invent facts. Identify the client's explicit explanations and the most important unresolved ambiguities that later analysis should discriminate. Treat Q11.3/requestedInsight only as a wish for the report, never as evidence or a conclusion. Return JSON { consciousExplanationTags: string[], unresolvedQuestions: string[] }. ${EMPTY_ARRAYS}`,
  },
  pass2: {
    version: "pass-2.v3",
    text: `Generate up to 6 evidence-grounded contradictions, then keep 1 central plus up to 2 secondary. A useful contradiction connects parts of the case the person has not already explicitly connected; do not merely restate their stated problem or Q11.3. Prefer contradictions with evidence across multiple domains and penalize formulations the client has already clearly articulated.
  
  Return JSON { contradictions } with at least 1 item. Each contradiction needs:
  - id
  - statementA
  - statementB
  - evidenceA
  - evidenceB
  - significance
  - categories
  - originForks
  - scores {
      evidenceStrength,
      recurrence,
      explanatoryImportance,
      charge,
      crossDomainReach,
      noveltyOfConnection,
      consciousAwarenessPenalty
    }
  
  All scores are numbers from 0 to 1. consciousAwarenessPenalty is HIGH when the client already explicitly states the same connection; noveltyOfConnection is HIGH when the contradiction links evidence they have not themselves connected. crossDomainReach is HIGH when it joins distinct areas such as identity, behavior, money, structure, projection, fantasy, or history. originForks must be from: ${FORK_IDS}. ${EMPTY_ARRAYS}`,
  },
  pass3: {
    version: "pass-3.v2",
    text: `Generate 3-5 competing hypotheses including at least one mundane candidate when evidence warrants it. Return JSON { hypotheses } with 3-5 items. Each needs id, title, category (psychological|identity|practical|environmental|economic|occupational|developmental|structural), observedPattern, evidenceFor, evidenceAgainst, contradictionsExplained, contradictionsNotExplained, simplerAlternatives, missingInformation, originForks (${FORK_IDS}), scoring { evidenceCoverage, crossContextRecurrence, contradictionResolution, personSpecificity, developmentalFit, imageConstraintFit, counterEvidencePenalty, simplerAlternativePenalty } as numbers, confidence (weak|tentative|moderate|strong). ${EMPTY_ARRAYS} Do not invent hypotheses to pad the count.`,
  },
  pass4: {
    version: "pass-4.v3",
    text: `Act as an adversarial critic of every hypothesis. Assume the previous analyst may be over-psychologizing, overfitting emotionally vivid material, or preferring an elegant story over a sufficient mundane explanation.
  
  For each hypothesis, identify:
  - the strongest mundane alternative
  - actual counter-evidence
  - important missing evidence
  - confirmation-bias risk
  - over-psychologizing risk
  - evidence that is genuinely more specific to this hypothesis than to its rivals
  - whether the hypothesis should be raised, kept, lowered, or rejected
  
  Do not reject a depth hypothesis merely because a practical explanation exists; ask whether the practical explanation accounts for the same recurrence, contradiction, and cross-domain evidence.
  
  Return JSON {
    critiques: [{
      hypothesisId,
      strongestMundaneAlternative,
      counterEvidenceRefs,
      missingEvidence,
      confirmationBiasRisk,
      overPsychologizingRisk,
      evidenceActuallyUniqueToHypothesis,
      rankAdjustment: "raise"|"keep"|"lower"|"reject",
      reason
    }]
  }. ${EMPTY_ARRAYS}`,
  },
  pass5: {
    version: "pass-5.v3",
    text: `Use symbolic material as an adversarial constraint on the leading hypotheses, not as decoration and not as a symbol dictionary. Personal associations outrank generic symbolic meanings. Vote independently on the relevant top hypotheses.
  
  For each vote choose:
  - supports: the supplied image materially fits this hypothesis
  - weakens: the supplied image materially conflicts with it
  - splits: the image appears to support more than one psychological or practical center
  - insufficient: the supplied material is too thin to constrain the hypothesis
  
  Never invent imagery, speech, bodily sensation, or associations. exactClientMaterialUsed must identify only supplied evidence refs actually used in the interpretation.
  
  Return JSON {
    votes: [{
      hypothesisId,
      verdict: "supports"|"weakens"|"splits"|"insufficient",
      interpretation,
      evidenceRefs,
      exactClientMaterialUsed
    }],
    overallNote: string
  }. Return at least 1 vote. ${EMPTY_ARRAYS}`,
  },
  pass6: {
    version: "pass-6.v4",
    text: `Resolve the case after contradiction generation, competing hypotheses, adversarial critique, and image voting. Do not restart the analysis from scratch.
  
  Choose selectedHypothesisId from the hypotheses present in caseSnapshot. Resolve each materially relevant open fork rather than silently ignoring it. A fork may lean one way, remain both, remain unresolved, or be not relevant.
  
  Produce one FinalFormulation that later report stages must treat as the working analytical spine. It must state what the selected hypothesis explains, what it does not explain, the strongest alternative, and unresolved forks. Do not present the formulation as certainty.
  
  hiddenPosition is optional and must be null when practical/environmental/economic explanation is sufficient or when evidence does not warrant a deeper hidden stance. If hiddenPosition is present:
  - use hypothesis language
  - name both protective function and possible developmental/compensatory aim
  - do not use requestedInsight/Q11.3 as possibleHiddenPosition
  - do not diagnose the client
  - do not convert symbolic material into factual claims
  
  Return JSON {
    selectedHypothesisId: string,
    forkResolutions: [{
      forkId,
      status: "leans_a"|"leans_b"|"both"|"unresolved"|"not_relevant",
      interpretation,
      evidenceRefs,
      importance: "low"|"medium"|"high",
      reportWorthiness: boolean
    }],
    finalFormulation: {
      selectedHypothesisId,
      centralFormulation,
      whyItFits: string[],
      whatItDoesNotExplain: string[],
      strongestAlternative,
      unresolvedForks
    },
    hiddenPosition: null | {
      consciousPosition,
      observedPattern,
      possibleHiddenPosition,
      protectiveFunction,
      possibleCompensatoryAim,
      threatenedByChange,
      developmentalTension: { poleA, poleB },
      imageVoteSummary,
      evidenceRefs,
      counterEvidenceRefs,
      confidence: "tentative"|"moderate"|"strong"
    },
    alternative: string
  }. ${EMPTY_ARRAYS}`,
  },
  pass7: {
    version: "pass-7.v3",
    text: `Jungian amplification only after resolution. Return JSON { jungianLenses: 0-3 items, omitReason?: string }. Zero concepts is acceptable ONLY with a non-empty omitReason explaining why no lens is warranted. Never say You are a Puer. Each lens needs concept, observedPatternItIlluminates, whyUseful, evidenceRefs, limitsOfInterpretation, confidence tentative|moderate|strong. ${EMPTY_ARRAYS}`,
  },
  pass8: {
    version: "pass-8.v5",
    text: `Produce a reality check and at least one low-risk behavioral experiment. The behavioral experiment should discriminate between at least two live explanations when possible rather than merely encouraging action.
  
  Use caseSnapshot.finalFormulation.selectedHypothesisId when present. hypothesisTested must use exactly one id from caseSnapshot.experimentBindings.hypothesisIds or caseSnapshot.experimentBindings.openForkIds; do not use free-form prose in hypothesisTested.
  
  For a behavioral experiment:
  - competingHypothesisIds should name meaningful rival hypotheses when available
  - manipulatedVariable should name what is deliberately changed
  - heldConstant should name what should stay as stable as practical
  - outcomeInterpretations should explain how different observable results would favor different explanations
  
  An imaginal experiment is optional. Use it only when supplied symbolic material is sufficiently rich and analytically relevant. Never script the figure's answer, invent dialogue, or place words in the image's mouth. You may ask the client a new question to the image/figure, but stop before answering it.
  
  Return JSON {
    realityCheck: {
      sufficientWithoutDepth,
      categories,
      narrative,
      evidenceRefs
    },
    experiments: [{
      kind: "behavioral"|"imaginal",
      title,
      hypothesisTested,
      action,
      duration,
      whatToObserve,
      resultSupportingHypothesis,
      resultWeakeningHypothesis,
      riskLevel: "low"|"moderate",
      practicalRequirements,
      competingHypothesisIds,
      manipulatedVariable,
      heldConstant,
      outcomeInterpretations: [{
        outcome,
        favors,
        because
      }]
    }]
  }. ${EMPTY_ARRAYS}`,
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
