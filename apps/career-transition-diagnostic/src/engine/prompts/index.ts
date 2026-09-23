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
    version: "pass-6.v6",
    text: `Resolve the case after contradiction generation, competing hypotheses, adversarial critique, and image voting. Do not restart the analysis from scratch.

  Choose selectedHypothesisId from the hypotheses present in caseSnapshot. Resolve each materially relevant open fork rather than silently ignoring it. A fork may lean one way, remain both, remain unresolved, or be not relevant.

  Produce one FinalFormulation that later report stages must treat as the working analytical spine. maintenanceFormulation and maintenanceMechanism explain why the pattern repeats now. maintainingLoop is optional: include it only when at least two supplied evidence refs support a recurring goal → trigger → response → payoff → cost → selfConfirmingResult cycle. Do not force a loop onto a sufficient practical explanation, repeat one statement as every step, or assume a predefined legitimacy pattern. developmentalFormulation is optional and describes a possible developmental meaning, never the maintenance cause. Include developmentalFormulation only when its opposition recurs across at least two independent questionnaire domains; otherwise omit it. Never force polarity onto a practical-only case. State what the selected hypothesis explains, what it does not explain, the strongest alternative, and unresolved forks. Do not present either formulation as certainty.

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
      maintenanceFormulation,
      maintenanceMechanism: {
        trigger,
        response,
        shortTermFunction,
        longTermCost,
        reinforcingConsequence
      },
      maintainingLoop?: {
        goal,
        trigger,
        response,
        payoff,
        cost,
        selfConfirmingResult,
        evidenceRefs
      },
      developmentalFormulation?: {
        consciousPole,
        compensatingPole,
        coreOpposition,
        possibleDevelopmentalTask,
        possibleThird?,
        uncertainty,
        evidenceRefs
      },
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
    version: "pass-9.v11",
    text: `Compose the full client report in peel order from caseSnapshot evidence — not from requestedInsight.

  Voice and stance:
  - Write in second person (You/Your); never refer to the person as “the client.”
  - Use hypothesis language. Interpretations are provisional, not diagnoses or verdicts.
  - Never turn an interpretive hypothesis into a fact.
  - Ban clinical/essay openers such as “presents a compelling”, “examining the deeper”, “evocative imagery”, “sophisticated psychological bargain”, and “from a process-oriented”.
  - Never name the person as an archetype. Never say “you are a puer/senex” or otherwise turn Jungian language into archetypal identity.
  - Never treat eternal youth, eternal becoming, or similar Jungian language as the person's identity.
  - Jungian language should illuminate a pattern, polarity, or process rather than define the person.

  Evidence provenance:
  - Every substantive claim must be grounded in evidenceRefs from caseSnapshot.evidenceAllowlist.
  - Never invent evidence refs.
  - Prefer concrete client material from caseSnapshot.answersByQuestionId and CaseState over generic theory.
  - Across the report, cite at least 3 distinct question ids when that evidence exists.
  - Never use Q11.3 / requestedInsight as the narrative spine or substitute it for evidence.
  - Tier-A image, projection, and money material should be used when psychologically relevant, but there is no fixed section choreography. If used interpretively, cite the corresponding supplied refs.
  - Do not invent body sensations, emotions, image details, image speech, dialogue, associations, or other client material.
  - Mention a body location only if corresponding supplied somatic evidence exists.
  - If supplied image speech is quoted or explicitly attributed to the image/obstacle, reproduce only the person's supplied speech. Never generate a reply, a second turn of dialogue, new speech, or a scripted exchange.

  Analytical shape:
  - Use caseSnapshot.finalFormulation as the resolved analytical spine when present. Preserve finalFormulation.selectedHypothesisId, finalFormulation.maintenanceFormulation, finalFormulation.maintenanceMechanism, optional finalFormulation.maintainingLoop, finalFormulation.whyItFits, finalFormulation.whatItDoesNotExplain, finalFormulation.strongestAlternative, and finalFormulation.unresolvedForks. Do not replace that resolution with a newly invented formulation.
  - When maintainingLoop exists, explain the recurring cycle as a provisional working model in the most relevant interpretive section and synthesize it briefly in the close. Do not present payoff or selfConfirmingResult as known motive.
  - When finalFormulation.developmentalFormulation exists, keep it explicitly tentative and render it in a developmental section titled “The developmental tension”. Do not infer this section from hiddenPosition or Jungian lenses alone.
  - Distinguish conscious explanation from enacted reality.
  - Make the central contradiction genuinely explanatory, not merely a restatement.
  - Preserve a plausible mundane/practical rival.
  - When caseSnapshot.hiddenPosition survived, preserve both hiddenPosition.protectiveFunction and hiddenPosition.possibleCompensatoryAim in the hidden section. Treat them as sibling hypotheses: what the pattern may protect, and what development may be asking for.
  - Do not collapse development into discipline/grind as the only valid pole.
  - Projection may be framed as a quality the person could potentially reclaim; never claim that the admired/rejected figure “is” the person's unconscious truth.
  - Keep any hidden bargain interpretation provisional rather than presenting it as motive-reading.
  - Jungian section should stay thin and only appear when jungianLenses survived.

  Required report order:
  1. problem
  2. reality
  3. contradiction
  4. hidden — only when a hiddenPosition survived
  5. developmental — only when finalFormulation.developmentalFormulation survived
  6. alternative
  7. experiment
  8. jungian — only when jungianLenses survived
  9. questions
  10. close

  Titles MUST equal caseSnapshot.requiredTitles[id].

  Questions:
  - Include exactly 3 personalized unresolved questions.
  - Each question must address the person directly using you/your.
  - Each question should genuinely arise from this person's evidence.
  - Do not answer those questions for the person.

  Close:
  - End with a short working formulation.
  - Explicitly frame it as provisional and testable, not settled truth.

  Return JSON {
    sections: array of {
      id,
      title,
      body,
      evidenceRefs
    }
  }.

  Required ids are problem, reality, contradiction, alternative, experiment, questions, close.
  hidden, developmental, and jungian are conditional.
  Never return a single thin section. ${EMPTY_ARRAYS}`,
  },
  pass10: {
    version: "pass-10.v11",
    text: `Act as the final report critic. Inspect draftReport.sections against caseSnapshot and regenerate only failing sections.

  Fail a section when it:
  - uses Q11.3 / requestedInsight as the narrative spine;
  - uses third-person “the client”, violates second-person voice, uses clinical essay diction, or uses a title that differs from caseSnapshot.requiredTitles[id];
  - contains substantive claims without valid evidenceRefs from caseSnapshot.evidenceAllowlist;
  - invents evidence refs or Tier-A placeholder refs;
  - invents body sensations, emotions, body locations, image details, associations, or other client material;
  - makes a somatic claim without corresponding supplied somatic evidence;
  - invents image dialogue, writes speech that was not supplied, creates new imaginal speech, or generates a second turn of dialogue;
  - changes supplied image speech rather than preserving the person's actual words;
  - turns a hypothesis into a fact or otherwise presents an interpretation as established psychological truth;
  - uses archetypal identity framing such as “you are a puer/senex/shadow”;
  - treats eternal becoming, eternal youth, or similar Jungian language as the person's identity;
  - treats discipline/grind as the only developmental answer;
  - when caseSnapshot.hiddenPosition exists, omits hiddenPosition.protectiveFunction or hiddenPosition.possibleCompensatoryAim from the hidden section;
  - contradicts, silently replaces, or materially drifts from caseSnapshot.finalFormulation, including finalFormulation.maintenanceFormulation, finalFormulation.maintenanceMechanism, finalFormulation.maintainingLoop, finalFormulation.strongestAlternative, finalFormulation.whatItDoesNotExplain, or finalFormulation.unresolvedForks;
  - states a maintainingLoop payoff or selfConfirmingResult as settled motive rather than a provisional working model;
  - adds a developmental section when caseSnapshot.finalFormulation.developmentalFormulation is absent, or omits/drifts from it when present;
  - ignores a materially relevant practical rival or constraint;
  - contains theory without concrete facts from caseSnapshot.answersByQuestionId;
  - is generic, one-sentence, or merely restates the person's stated problem;
  - leaves the report with fewer than 3 distinct question ids when sufficient case evidence exists.

  For Tier-A image, projection, and money material:
  - require interpretive use when it materially constrains the formulation;
  - do not require those refs in predetermined sections;
  - if a section interprets that material, it must cite corresponding refs from evidenceAllowlist.

  Questions section:
  - must contain exactly 3 personalized unresolved questions;
  - each question must address the person directly using you/your;
  - do not answer those questions for the person.

  Close section:
  - must contain a short provisional working formulation;
  - fail it if it presents the formulation as diagnosis, settled truth, or verdict.

  Required ids:
  problem, reality, contradiction, alternative, experiment, questions, close.

  hidden is conditional on a surviving hiddenPosition.
  developmental is conditional on finalFormulation.developmentalFormulation.
  jungian is conditional on surviving jungianLenses.

  Regenerate only failing sections. Preserve valid sections and section ids.

  Return JSON {
    failingSectionIds: string[],
    regeneratedSections: [
      {
        id,
        title,
        body,
        evidenceRefs
      }
    ]
  }.

  If the draft already satisfies the contract, return empty arrays. ${EMPTY_ARRAYS}`,
  },
} satisfies Record<string, PromptStub>;
