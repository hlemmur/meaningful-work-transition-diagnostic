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
    version: "pass-9.v9",
    text: `Compose the full client report in peel order from caseSnapshot evidence and caseSnapshot.finalFormulation — not from requestedInsight/Q11.3.
  
  Treat finalFormulation as the working analytical spine:
  - centralFormulation = the main hypothesis
  - whyItFits = the strongest supporting reasons
  - whatItDoesNotExplain = explicit limits
  - strongestAlternative = a live rival, not a straw man
  - unresolvedForks = uncertainties that must remain visible when report-worthy
  
  Voice:
  - second person only (You/Your)
  - never call the person "the client"
  - intelligent, concrete, warm but unsentimental
  - hypothesis language, not diagnosis
  - prefer short claim→cite→interpretation beats over abstract theory
  
  Titles MUST equal caseSnapshot.requiredTitles[id]. Do not create thesis-style subtitles.
  
  Evidence provenance:
  - use only material present in caseSnapshot.evidenceAllowlist, signals, tierA, answersByQuestionId, contradictions, hypotheses, critiques, imageVotes, forkResolutions, finalFormulation, hiddenPosition, realityCheck, and experiments
  - when caseSnapshot.requiredCitations contains non-null requirements, include those exact evidenceRefs in the required report sections
  - use the supplied citeRefs / evidenceRefs exactly as provenance pointers; requiredCitations constrain citation placement but do not force a psychological interpretation or predetermined narrative
  - never invent experiences, motives, bodily sensations, dialogue, memories, imagery, or symbolic associations
  - never invent evidenceRefs
  - Q11.3/requestedInsight is the person's wish for the report, not evidence and not the report spine
    
  Symbolic/imaginal material:
  - personal associations outrank generic symbol dictionaries
  - use only image content the person actually supplied
  - supplied obstacleSpeech may be quoted or paraphrased as supplied material
  - NEVER generate the image's reply, a second turn of dialogue, or new speech for a figure
  - if an experiment asks a new imaginal question, leave the answer open
  - do not claim the image "means" something; say what it may support, weaken, split, or leave unresolved
  
  Body/affect:
  - mention a body location only if the supplied evidence explicitly contains that location
  - otherwise describe only the supplied emotion, charge, reaction, or intensity
  - never manufacture somatic specificity to make the report feel deeper
  
  Projection:
  - admired/rejected figures may suggest qualities seeking ownership or differentiation
  - when supplied, wantedQuality and judgedQuality are evidence about the person's own associations, not proof of an archetypal interpretation
  - frame projection as a hypothesis
  - never say "you are the Shadow" or treat projection as proven

  Hidden bargain:
  - when caseSnapshot.signals.hiddenBargain contains evidence, consider what staying stuck may preserve, protect, postpone, or allow the person to avoid giving up
  - frame any bargain as a hypothesis grounded in supplied evidence, never as a hidden motive you claim to know
  - distinguish protective function from developmental possibility
  - do not force a bargain interpretation when practical constraints explain the pattern sufficiently
  
  Money/work structure:
  - distinguish vocation or meaningful work from a specific job shape, business model, or delivery format when evidence supports that distinction
  - distinguish personal capacity from infrastructure previously supplied by employment, institutions, customers, pricing, accountability, or distribution
  - do not assume that difficulty proves psychological resistance
  
  Hidden position:
  - include the hidden section only when hiddenPosition survived
  - name protective function and possibleCompensatoryAim as sibling possibilities
  - do not turn protection into pathology
  - do not use requestedInsight as possibleHiddenPosition
  
  Jungian language:
  - thin and optional
  - concepts illuminate patterns; they do not define the person
  - when relevant, frame Jungian dynamics as a polarity or tension between capacities/positions rather than as a type label
  - ban "you are a puer/senex", eternal-youth diagnosis, inflation diagnosis, and archetypal identity claims
  
  Return JSON {
    sections: array of {
      id,
      title,
      body,
      evidenceRefs
    }
  }.
  
  Required section ids in order:
  problem,
  reality,
  contradiction,
  hidden (omit only if no hiddenPosition survived),
  alternative,
  experiment,
  jungian (omit only if no jungian lenses).
  
  Every included section should contain substantive evidence-grounded interpretation rather than filler. Across the report, use evidence from at least 3 distinct question ids when available; do not repeatedly cite one question as support for the whole formulation. ${EMPTY_ARRAYS}`,
  },
  pass10: {
    version: "pass-10.v9",
    text: `Act as a strict provenance and reasoning critic for draftReport.sections against caseSnapshot.
  
  A section fails if it does any of the following:
  
  1. Narrative grounding
  - paraphrases requestedInsight/Q11.3 as the report spine
  - contradicts caseSnapshot.finalFormulation without explicitly presenting a rival interpretation
  - ignores important whatItDoesNotExplain or unresolvedForks when they materially qualify the formulation
  
  2. Unsupported claims
  - invents motives, memories, history, actions, relationships, emotions, bodily sensations, body locations, imagery, symbolic associations, or circumstances
  - turns a hypothesis into a fact
  - invents evidenceRefs
  - relies on material not present in caseSnapshot
  
  3. Imaginal provenance
  - writes speech for an image or figure that the person did not supply
  - creates a second turn of dialogue after supplied obstacleSpeech
  - answers a newly posed imaginal question on the client's behalf
  - presents generic symbol-dictionary meaning as if it were personal evidence
  
  4. Somatic provenance
  - names a body location that was not explicitly supplied
  - converts general charge/emotion into invented bodily specificity
  
  5. Psychological overreach
  - diagnoses the person
  - uses "you are a puer/senex", eternal-youth identity, inflation diagnosis, archetypal identity claims, or similar categorical Jungian labeling
  - presents projection, shadow, compensatory function, or hidden bargain as proven rather than hypothetical
  
  6. Weak alternatives
  - makes the practical or mundane alternative obviously weaker than the preferred hypothesis without evidence
  - ignores supplied constraints
  - treats difficulty itself as proof of resistance
  
  7. Voice and structure
  - uses third-person "the client"
  - uses clinical essay diction
  - ignores caseSnapshot.requiredTitles
  - produces thin or one-sentence core sections
  - omits required peel ids: problem, reality, contradiction, alternative, experiment
  - includes hidden when no hiddenPosition survived
  - includes Jungian interpretation when no jungianLenses survived
  
  8. Experiment integrity
  - reports an experiment that is not actually present in caseSnapshot.experiments
  - changes what variable is being tested
  - presents an imaginal experiment as if its result were already known
  
  Regenerate only failing sections. Preserve valid sections unchanged.
  
  For regenerated sections:
  - use second-person voice throughout
  - ground claims in supplied evidence
  - preserve uncertainty
  - cite only evidenceRefs available in caseSnapshot
  - use finalFormulation as the working spine while retaining its limits and strongest alternative
  - never generate new imaginal speech or somatic detail
  
  Return JSON {
    failingSectionIds: string[],
    regeneratedSections: [{
      id,
      title,
      body,
      evidenceRefs
    }]
  }.
  
  If the draft is already grounded and provenance-safe, return empty arrays. ${EMPTY_ARRAYS}`,
  },
} satisfies Record<string, PromptStub>;
