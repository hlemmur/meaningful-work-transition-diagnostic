import { questions } from "@/questionnaire/questionnaire.v2";
import type { ReportSection } from "@/engine/schemas/analysis";
import type { CaseState } from "@/engine/schemas/case-state";

export type QualificationScore = {
  id: "developmental_restraint" | "developmental_grounding";
  passed: boolean;
  detail: string;
  hard: true;
};

const sectionByQuestionId = new Map(
  questions.map((question) => [question.id, question.section]),
);

function evidenceDomains(refs: string[]) {
  return new Set(
    refs.flatMap((ref) => {
      const questionId = ref.match(/:([^:]+)$/)?.[1];
      const section = questionId ? sectionByQuestionId.get(questionId) : undefined;
      return section === undefined ? [] : [section];
    }),
  );
}

export function evaluateDevelopmentalQualification(
  state: CaseState,
  sections: ReportSection[],
) {
  const formulation = state.finalFormulation?.developmentalFormulation;
  const reportSection = sections.find((section) => section.id === "developmental");
  const restraintPassed = Boolean(formulation) === Boolean(reportSection);
  const groundingPassed = !formulation || (
    evidenceDomains(formulation.evidenceRefs).size >= 2 &&
    Boolean(reportSection) &&
    formulation.evidenceRefs.every((ref) => reportSection?.evidenceRefs.includes(ref))
  );
  const scores: QualificationScore[] = [
    {
      id: "developmental_restraint",
      passed: restraintPassed,
      detail: restraintPassed
        ? "Developmental report inclusion matches the resolved formulation."
        : "Developmental formulation and report section inclusion disagree.",
      hard: true,
    },
    {
      id: "developmental_grounding",
      passed: groundingPassed,
      detail: groundingPassed
        ? "Developmental evidence is absent or grounded across independent domains."
        : "Developmental evidence must span two domains and survive into the report section.",
      hard: true,
    },
  ];
  return {
    hardPassed: scores.every((score) => score.passed),
    scores,
  };
}
