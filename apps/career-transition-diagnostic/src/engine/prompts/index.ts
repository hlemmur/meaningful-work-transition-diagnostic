export const ENGINE_VERSION = "engine.v2" as const;

type PromptStub = {
  version: string;
  text: string;
};

export const promptRegistry = {
  checkpointA: {
    version: "checkpoint-a.v1",
    text: "Pass 1-lite after Section 2. Extract facts, actions, and the stated problem. Select 0 or 1 adaptive question. Prefer origin fork history vs stated cause. No Jungian labels.",
  },
  checkpointB: {
    version: "checkpoint-b.v1",
    text: "Pass 1-lite after Section 4. Update affect, gaze, container, and evidence absorption. Select 0 or 1 adaptive question. Prefer container-loss, impostor-filter, or legitimacy loop.",
  },
  checkpointC: {
    version: "checkpoint-c.v1",
    text: "Pass 1-lite after Section 7. Discriminate work vs identity vs job-shape. Select 0 or 1 adaptive question. No Jungian terminology.",
  },
  checkpointD: {
    version: "checkpoint-d.v1",
    text: "Pass 1-lite after Section 9. Discriminate rational caution vs hidden bargain, and background income as relief vs replacement. Select 0 or 1 adaptive question. Stay within the total adaptive cap.",
  },
  checkpointSafety: {
    version: "checkpoint-safety.v1",
    text: "Classify crisis or acute distress. Do not send free-text or safety content to analytics. If high, skip remaining depth probes and reduce later report depth.",
  },
  pass1: {
    version: "pass-1.v1",
    text: "Extract CaseState facts, client interpretations, identity claims, and practical constraints. Do not treat Q11.3 as a conclusion.",
  },
  pass2: {
    version: "pass-2.v1",
    text: "Generate up to 6 contradictions and keep 1 central plus up to 2 secondary. Rank by charge, recurrence, and explanatory importance.",
  },
  pass3: {
    version: "pass-3.v1",
    text: "Generate 3-5 competing hypotheses including at least one mundane candidate when evidence warrants it.",
  },
  pass4: {
    version: "pass-4.v1",
    text: "Adversarial critic: assume the previous analyst is over-psychologizing. Prefer a sufficient mundane explanation.",
  },
  pass5: {
    version: "pass-5.v1",
    text: "Image vote before resolution. Personal associations outrank symbol dictionaries. A weaken verdict must drop rank.",
  },
  pass6: {
    version: "pass-6.v1",
    text: "Resolve Hidden Position as hypothesis language. Never use requestedInsight as possibleHiddenPosition. Keep a concrete alternative.",
  },
  pass7: {
    version: "pass-7.v1",
    text: "Jungian amplification only after resolution. Zero concepts is acceptable. Never say You are a Puer.",
  },
  pass8: {
    version: "pass-8.v1",
    text: "Reality check plus one behavioral experiment. Add one short imaginal only if charge or image vote warrants it.",
  },
  pass9: {
    version: "pass-9.v1",
    text: "Compose the report in peel order. Hypothesis language, evidence-backed claims, no clinical diagnosis.",
  },
  pass10: {
    version: "pass-10.v1",
    text: "Report critic. Fail unsupported claims, Jungian overreach, ignored constraints, thin alternatives, or Q11.3 used as hidden position. Regenerate only failing sections.",
  },
} satisfies Record<string, PromptStub>;
