import type { Experiment, ProcessDimension } from "@/engine/schemas/analysis";

type CumulativeOverrides = Partial<Experiment> & {
  title: string;
  action?: string;
  strategy?: NonNullable<Experiment["strategy"]>;
  hypothesisTested?: string;
  practicalCondition?: NonNullable<Experiment["practicalCondition"]>;
};

/** Shared cumulative experiment shape for fixtures and gate tests. */
export function cumulativeExperiment(
  overrides: CumulativeOverrides = {
    title: "Your experiment",
    action: "Use a one-page template for the next draft while holding exposure private.",
  },
): Experiment {
  const strategy = overrides.strategy ?? "direct";
  const temporaryChange =
    overrides.practicalCondition?.temporaryChange ?? "one-page template";
  const action =
    overrides.action ??
    `Use a ${temporaryChange} for the next draft while holding exposure private.`;

  const practicalCondition = overrides.practicalCondition ?? {
    factor: "ambiguity of the next step",
    currentState: "no shared template; each attempt restarts from blank",
    temporaryChange,
    whyThisFactor: "Client evidence shows ambiguity carries part of the freeze.",
    processDimensions: ["ambiguity", "self_initiation"] as ProcessDimension[],
    sharedDimensions: [] as ProcessDimension[],
  };

  return {
    kind: overrides.kind ?? "behavioral",
    title: overrides.title,
    strategy,
    targetPattern: overrides.targetPattern ?? "initiation stall under ambiguity",
    practicalCondition,
    action,
    duration: overrides.duration ?? "one 25-minute session",
    observe: overrides.observe ?? {
      whatBecomesEasier: "Starting the draft inside a fixed container",
      whatRemainsDifficult: "Any later visibility or evaluation charge",
      whatChangesForm: "Whether stall moves from starting to sharing",
      unexpectedMaterial: "Any image, affect, or impulse that appears when starting becomes possible",
    },
    deepen: overrides.deepen,
    bridge: overrides.bridge,
    learningAim:
      overrides.learningAim ??
      "When the template changed, starting became easier, while visibility charge remained.",
    layerUpdates: overrides.layerUpdates ?? [
      {
        layer: "practical",
        ifObserved: "Starting completes inside the template",
        effect: "strengthens",
        implication: "The ambiguity container is an important contributor.",
      },
      {
        layer: "psychological",
        ifObserved: "Visibility charge remains after starting works",
        effect: "unchanged",
        implication: "Psychological material is not retired by the practical change.",
      },
      {
        layer: "practical",
        ifObserved: "Neither starting nor charge shifts",
        effect: "inconclusive",
        implication: "The particular practical change did not clarify the layers.",
      },
      {
        layer: "psychological",
        ifObserved: "Unexpected affect or image appears",
        effect: "new_unknown",
        implication: "New material entered; keep both layers open.",
      },
    ],
    hypothesisTested: overrides.hypothesisTested,
    whatToObserve: overrides.whatToObserve ?? [
      "whether starting completes",
      "what charge remains",
    ],
    resultSupportingHypothesis: overrides.resultSupportingHypothesis ?? "",
    resultWeakeningHypothesis: overrides.resultWeakeningHypothesis ?? "",
    riskLevel: overrides.riskLevel ?? "low",
    practicalRequirements: overrides.practicalRequirements ?? ["timer", "template"],
    competingHypothesisIds: overrides.competingHypothesisIds ?? [],
    manipulatedVariable: overrides.manipulatedVariable,
    heldConstant: overrides.heldConstant ?? ["exposure"],
    outcomeInterpretations: overrides.outcomeInterpretations ?? [],
    sessionMinutes: overrides.sessionMinutes ?? 25,
    audienceCount: overrides.audienceCount ?? 0,
    exposure: overrides.exposure ?? "private",
    reversible: overrides.reversible ?? true,
    largerActionJustification: overrides.largerActionJustification,
  };
}
