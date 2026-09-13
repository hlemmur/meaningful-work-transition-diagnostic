import type { CaseState } from "@/engine/schemas/case-state";
import type { Report, ReportSection } from "@/engine/schemas/analysis";
import {
  experimentBoundToHypothesis,
  isParaphraseOf,
  reportLayerCoverage,
  senexScoldOnly,
} from "@/engine/pipeline/gates";
import { isRequestedInsightSpine } from "@/engine/pipeline/report-grounding";

export type SoftDimId = "surprise" | "image_alive" | "cm_layer_feel" | "bridge_to_11";

export type FrameworkScore = {
  id: string;
  passed: boolean;
  detail: string;
  hard: boolean;
};

export type FrameworkFidelityResult = {
  hardPassed: boolean;
  scores: FrameworkScore[];
  softChecklistTemplate: Array<{ id: SoftDimId; question: string }>;
};

export type FrameworkArtifact = {
  answers: Record<string, unknown>;
  caseState: CaseState;
  report: Pick<Report, "engineVersion" | "sections">;
  critiques?: unknown[];
};

function score(id: string, passed: boolean, detail: string, hard = true): FrameworkScore {
  return { id, passed, detail, hard };
}

function joined(sections: ReportSection[]) {
  return sections.map((section) => `${section.title}\n${section.body}`).join("\n");
}

export function evaluateFrameworkFidelity(artifact: FrameworkArtifact): FrameworkFidelityResult {
  const { caseState, report, answers } = artifact;
  const sections = report.sections ?? [];
  const text = joined(sections);
  const requested = caseState.userFinalReflection.requestedInsight ?? String(answers["Q11.3"] ?? "");
  const scores: FrameworkScore[] = [];

  const hidden = caseState.hiddenPosition?.possibleHiddenPosition ?? "";
  const central = caseState.contradictions[0];
  const q113Spine =
    (requested && isRequestedInsightSpine(sections, requested)) ||
    (requested && hidden && isParaphraseOf(hidden, requested)) ||
    (requested &&
      central &&
      isParaphraseOf(`${central.statementA} ${central.statementB}`, requested));
  scores.push(
    score(
      "no_q113_spine",
      !q113Spine,
      q113Spine
        ? "Central contradiction or hidden position paraphrases Q11.3."
        : "Analysis is not Q11.3-spined.",
    ),
  );

  const hasTierAAnswers =
    Boolean(answers["Q5.1"] || answers["Q6.1"] || answers["Q8.2"] || answers["Q9.2"] || answers["Q10.1"]);
  const refs = sections.flatMap((section) => section.evidenceRefs).join(" ");
  const tierAUsed =
    !hasTierAAnswers ||
    /:Q5\.|:Q6\.|:Q8\.|:Q9\.|:Q10\./.test(refs) ||
    /projection|money|bargain|pipe|structure|container/i.test(text);
  scores.push(
    score(
      "tier_a_used",
      tierAUsed,
      tierAUsed ? "Tier-A evidence appears in the analysis." : "Tier-A answers exist but were unused.",
    ),
  );

  const peelIds = ["problem", "reality", "contradiction", "alternative", "experiment"] as const;
  const present = new Set(sections.map((section) => section.id));
  const peelOk =
    peelIds.every((id) => present.has(id)) &&
    sections.every((section) => section.body.trim().length >= 40);
  scores.push(
    score(
      "peel_complete",
      peelOk,
      peelOk ? "Peel sections present with substantive bodies." : "Peel incomplete or too thin.",
    ),
  );

  const protection =
    /protect|protective|keeps|shield|bargain|benefit of staying/i.test(text) ||
    (caseState.hiddenPosition?.protectiveFunction.length ?? 0) > 0;
  const aim =
    /aim|develop|structure in service|aliveness|compensatory|asking you to/i.test(text) ||
    Boolean(caseState.hiddenPosition?.possibleCompensatoryAim) ||
    /omit|no hidden/i.test(text);
  scores.push(
    score(
      "protection_and_aim",
      !caseState.hiddenPosition || (protection && aim),
      caseState.hiddenPosition
        ? protection && aim
          ? "Protection and developmental aim both present."
          : "Hidden position lacks protection+aim balance."
        : "No hidden position; protection/aim check skipped.",
    ),
  );

  const diagnosed = /you are (an? )?(puer|senex|anima|animus|hero|shadow)/i.test(text);
  const lensesOk =
    caseState.jungianLenses.every(
      (lens) => lens.evidenceRefs.length > 0 && lens.limitsOfInterpretation.trim().length > 0,
    ) &&
    (caseState.jungianLenses.length > 0 ||
      Boolean(caseState.jungianOmitReason) ||
      !(
        caseState.history.supportiveStructures.length ||
        caseState.hiddenBargain.developmentalAsk.length
      ));
  scores.push(
    score(
      "jungian_discipline",
      !diagnosed && lensesOk,
      diagnosed
        ? "Jungian overreach: archetypal diagnosis of the person."
        : lensesOk
          ? "Jungian discipline held."
          : "Empty lenses without omitReason while polarity warranted.",
    ),
  );

  const bind = experimentBoundToHypothesis(caseState);
  scores.push(score("experiment_fork_fit", bind.passed, bind.detail));

  const constraints = caseState.practicalContext.constraints.length > 0;
  const honored =
    !constraints ||
    caseState.hypotheses.some((item) =>
      ["practical", "economic", "occupational"].includes(item.category),
    ) ||
    /constraint|ADHD|practical|financial/i.test(text);
  scores.push(
    score(
      "constraints_honored",
      honored,
      honored ? "Constraints honored." : "Q0.5 constraints psychologized away.",
    ),
  );

  const clinical = /you have (a |an )?(complex|disorder|diagnosis)|unconscious is definitely/i.test(text);
  scores.push(
    score(
      "hypothesis_language",
      !clinical,
      clinical ? "Uses clinical/absolute unconscious claims." : "Hypothesis language held.",
    ),
  );

  const senex = senexScoldOnly(text);
  scores.push(score("structure_not_grind", senex.passed, senex.detail));

  const remediations = caseState.gateRemediations ?? [];
  scores.push(
    score(
      "gates_survived",
      true,
      remediations.length
        ? `Gate remediations (warn): ${remediations.join("; ")}`
        : "No gate remediations required.",
      false,
    ),
  );

  const layers = reportLayerCoverage(sections, caseState);
  scores.push(score("layer_coverage", layers.passed, layers.detail));

  const inflation =
    /you are (an? )?eternal youth|eternal[- ]youth (complex|identity|archetype)|you are (an? )?(puer|senex)\b/i.test(
      text,
    ) ||
    (/unanchored ideal/i.test(text) && !/polarity|enantiodromia|\bboth\b|compensation/i.test(text));
  scores.push(
    score(
      "anti_inflation",
      !inflation,
      inflation
        ? "Client-facing inflation or unanchored ideal without polarity language."
        : "No client-facing inflation diagnosis.",
    ),
  );

  const affectIndicated =
    (caseState.affect.chargeIntensity ?? 0) >= 1 || caseState.affect.emotions.length > 0;
  if (affectIndicated) {
    const hasCharge = /shame|terror|freeze|chest|throat|body|charge/i.test(text);
    scores.push(
      score(
        "charge_language",
        hasCharge,
        hasCharge
          ? "Peel includes charge/body language."
          : "Affect indicated but peel lacks charge/body language.",
      ),
    );
  }

  return {
    hardPassed: scores.filter((item) => item.hard).every((item) => item.passed),
    scores,
    softChecklistTemplate: [
      {
        id: "surprise",
        question: "Did it connect domains the conscious story had not already fused?",
      },
      {
        id: "image_alive",
        question: "Was the Section 10 image treated as living association, not discarded fluff?",
      },
      {
        id: "cm_layer_feel",
        question: "Does a depth beat lead with body/charge before theory?",
      },
      {
        id: "bridge_to_11",
        question: "Would 1:1 feel like continuation of this inquiry?",
      },
    ],
  };
}
