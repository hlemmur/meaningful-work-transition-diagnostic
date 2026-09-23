import type { AnalysisStage } from "../pipeline/models";

const PASS_CARDS: Partial<Record<AnalysisStage | string, string>> = {
  pass2: `Rank contradictions by evidence strength, recurrence, explanatory importance, charge, cross-domain reach, and novelty of connection, while penalizing contradictions the person has already explicitly formulated. Prefer contradictions that connect multiple parts of the case over simple restatements of the presenting problem. Q11.3/requestedInsight is never evidence.`,

  pass3: `Generate multiple live explanations for the pattern, including mundane/practical rivals when constraints warrant. Keep hypotheses person-specific and evidence-grounded. Do not manufacture psychological depth merely because the person requested a deep insight. Preserve uncertainty when several explanations fit.`,

  pass4: `Adversarial critic: actively test confirmation bias and over-psychologizing. For each important hypothesis, identify the strongest mundane alternative, counter-evidence, missing evidence, evidence genuinely distinctive to the hypothesis, and whether its rank should raise, stay, lower, or be rejected. Critiques must be substantive, not ceremonial.`,

  pass5: `Vote symbolic material independently against the relevant leading hypotheses. Preserve literal facts and personal associations verbatim, retain multiple grounded readings and an unresolved symbolic question when warranted, and keep projection interpretation separate from raw projection evidence. Personal associations outrank generic symbol dictionaries. A symbolic image may support, weaken, split, or be insufficient for a hypothesis. Never invent imagery, associations, dialogue, body sensations, or supplied facts.`,

  pass6: `Resolve the case without forcing false certainty. Select the best-supported working hypothesis, resolve relevant analytic forks where evidence allows, and explicitly preserve unresolved or split tensions where it does not. finalFormulation must separate the maintenance account of why the pattern repeats now from an optional developmental meaning. Add maintainingLoop only for a grounded recurring cycle; never force a predefined loop or attach one to a sufficient practical explanation. Only formulate a developmental opposition when it recurs across at least two evidence domains; never force it onto a practical-only case. State what fits, what remains unexplained, and the strongest live alternative. hiddenPosition is optional and must use hypothesis language; never derive it from requestedInsight/Q11.3.`,

  pass7: `Use Jungian amplification only after the case has been resolved on ordinary evidence. Return 0–3 lenses only when they genuinely add explanatory value. Concepts should describe tensions, dynamics, projection, compensation, shadow, polarity, or development without turning them into identity labels or diagnoses. Each lens needs limitsOfInterpretation.`,

  pass8: `Create at least one low-risk behavioral experiment bound to a live hypothesis or analytic fork by exact id. Prefer experiments that discriminate between competing explanations: state what variable changes, what remains stable, what to observe, and how different outcomes would favor different explanations. Imaginal work is optional and only appropriate when supplied symbolic material is rich enough; never script the answer to a new imaginal question.`,

  pass9: `Write the report from caseSnapshot.finalFormulation and supplied evidence, not from requestedInsight/Q11.3. Use second-person voice and requiredTitles. Prefer claim→cite→interpretation. Preserve the strongest alternative and meaningful unresolved forks. Use symbolic material, projection, money, history, structure, hidden bargain, affect, and Jungian concepts only when they materially illuminate this particular case. Never force a fixed sequence of psychological layers. Never invent dialogue, bodily locations, motives, memories, imagery, associations, or evidenceRefs. Hidden position remains hypothetical. Jungian language stays thin and non-diagnostic.`,

  pass10: `Act as a strict provenance and reasoning critic. Fail report sections that invent facts, dialogue, body locations, motives, imagery, associations, or evidenceRefs; turn hypotheses into facts; erase strong alternatives or unresolved forks; ignore supplied constraints; weaken mundane explanations without evidence; use categorical Jungian identity labels; misrepresent experiments; use third-person client language; or violate requiredTitles. Regenerate only failing sections and preserve valid ones unchanged.`,
};

export function passCardFor(stage: string) {
  return PASS_CARDS[stage] ?? "";
}

export const PASS_CARD_STAGES = Object.keys(PASS_CARDS);
