import type { AnalysisStage } from "../pipeline/models";

const PASS_CARDS: Partial<Record<AnalysisStage | string, string>> = {
  pass2: `Rank contradictions by charge × recurrence × explanatory importance. Prefer life contradictions (freedom vs container loss; self-auth vs freeze) over Q11.3 meta-hunger. Penalize candidates whose evidence is mostly Q11.* when Tier-A exists.`,
  pass3: `Include at least one mundane/practical rival when constraints warrant. Keep person-specific patterns. Do not invent depth from requestedInsight.`,
  pass4: `Adversarial critic: assume over-psychologizing. Return at least one critique. Prefer sufficient mundane explanation when evidence allows.`,
  pass5: `Personal associations outrank symbol dictionaries. If Q10 has scene + speech/surroundings, do not vote insufficient without citing those associations.`,
  pass6: `Hidden position is hypothesis language. Never use requestedInsight / Q11.3 as possibleHiddenPosition (including paraphrase). Name protective function AND possibleCompensatoryAim (structure serving aliveness). Omit hiddenPosition entirely only when critic+constraints win.`,
  pass7: `Jungian amplification only after resolution. 0–3 lenses. Empty jungianLenses ALWAYS requires non-empty omitReason. Never diagnose the person as an archetype. Each lens needs limitsOfInterpretation.`,
  pass8: `One behavioral experiment bound to the winning hypothesis or open fork. Reject unbound mentor-critique when container_loss or legitimacy_loop is open. Add short imaginal only if charge or image warrants.`,
  pass9: `Compose peel-order report from caseSnapshot/tierA — not requestedInsight. Multi-paragraph sections; diverse evidenceRefs. Name Magician hunger; do not feed it with certainty.`,
  pass10: `Fail sections that paraphrase Q11.3 as spine, lack diverse evidence, thin alternatives, Jungian overreach, ignored constraints, or grind-only developmental frames.`,
};

export function passCardFor(stage: string) {
  return PASS_CARDS[stage] ?? "";
}

export const PASS_CARD_STAGES = Object.keys(PASS_CARDS);
