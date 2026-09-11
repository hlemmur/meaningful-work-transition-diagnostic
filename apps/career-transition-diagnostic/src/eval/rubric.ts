import type { Report, ReportSection } from "@/engine/schemas/analysis";
import type { CaseState } from "@/engine/schemas/case-state";

export type RubricFinding = {
  id: string;
  passed: boolean;
  detail: string;
};

export type RubricResult = {
  passed: boolean;
  findings: RubricFinding[];
};

const FAILURE_PATTERNS: { id: string; re: RegExp; detail: string }[] = [
  {
    id: "puer-diagnosis",
    re: /you are a puer/i,
    detail: "Report must not diagnose the person as a Puer.",
  },
  {
    id: "confidence-only",
    re: /just need (more )?confidence|lack of confidence is the (whole |only )?cause/i,
    detail: "Report must not collapse the stall to confidence-only.",
  },
  {
    id: "alignment-money",
    re: /follow (your )?(alignment|purpose).{0,80}money|money (will )?comes? (from |through )?(ease|alignment|purpose)/i,
    detail: "Report must not claim that alignment or purpose produces money.",
  },
];

function finding(id: string, passed: boolean, detail: string): RubricFinding {
  return { id, passed, detail };
}

function joinedText(sections: ReportSection[]) {
  return sections.map((section) => `${section.title}\n${section.body}`).join("\n");
}

export function evaluateReport(input: {
  report: Pick<Report, "engineVersion" | "sections">;
  caseState?: Pick<CaseState, "practicalContext" | "hypotheses" | "jungianLenses">;
}): RubricResult {
  const findings: RubricFinding[] = [];
  const sections = input.report.sections ?? [];
  const text = joinedText(sections);

  findings.push(
    finding(
      "engine-version",
      input.report.engineVersion === "engine.v2",
      "Report must be engine.v2.",
    ),
  );
  findings.push(
    finding("has-sections", sections.length > 0, "Report must contain sections."),
  );

  const missingEvidence = sections.filter((section) => section.evidenceRefs.length === 0);
  findings.push(
    finding(
      "evidence-mapping",
      missingEvidence.length === 0,
      missingEvidence.length
        ? `Unsupported claims in: ${missingEvidence.map((item) => item.id).join(", ")}`
        : "Every major claim has evidence references.",
    ),
  );

  const generic = sections.filter((section) => section.body.trim().length < 24);
  findings.push(
    finding(
      "generic-restatement",
      generic.length === 0,
      generic.length
        ? `Generic or empty restatement in: ${generic.map((item) => item.id).join(", ")}`
        : "Sections are specific enough to be more than a restatement.",
    ),
  );

  for (const pattern of FAILURE_PATTERNS) {
    findings.push(
      finding(pattern.id, !pattern.re.test(text), pattern.detail),
    );
  }

  const jungianOverreach = /you are (an? )?(puer|senex|anima|animus|hero|shadow)/i.test(text);
  findings.push(
    finding(
      "jungian-overreach",
      !jungianOverreach,
      "Jungian language must not name the person as an archetype.",
    ),
  );

  const constraints = input.caseState?.practicalContext.constraints.length ?? 0;
  if (constraints > 0) {
    const hasPracticalHypothesis = (input.caseState?.hypotheses ?? []).some((item) =>
      ["practical", "economic", "occupational"].includes(item.category),
    );
    const hasRivalSection = sections.some((section) => /alternative|reality|constraint/i.test(section.title));
    findings.push(
      finding(
        "practical-rival",
        hasPracticalHypothesis || hasRivalSection,
        "A practical rival must exist when constraints are in evidence.",
      ),
    );
  }

  return {
    passed: findings.every((item) => item.passed),
    findings,
  };
}
