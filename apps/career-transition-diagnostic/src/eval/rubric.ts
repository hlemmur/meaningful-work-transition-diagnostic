import type { Report, ReportSection } from "@/engine/schemas/analysis";
import { REQUIRED_PEEL_SECTION_IDS } from "@/engine/schemas/analysis";
import type { CaseState } from "@/engine/schemas/case-state";
import {
  hasDiverseEvidenceRefs,
  isRequestedInsightSpine,
  MIN_DISTINCT_EVIDENCE_QUESTION_IDS,
} from "@/engine/pipeline/report-grounding";

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
    id: "eternal-youth-identity",
    re: /you are (an? )?eternal youth|eternal[- ]youth (complex|identity|archetype)/i,
    detail: "Report must not treat eternal youth as the person's identity.",
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
  {
    id: "senex-scold",
    re: /grow up and (work|grind)|stop seeking (insight|revelation)|just (need )?(more )?discipline/i,
    detail: "Report must not collapse development to senex-scold / grind-only.",
  },
  {
    id: "magician-feed",
    re: /this report (finally )?proves you (are|were) legitimate/i,
    detail: "Report must not feed Magician hunger with authorizing certainty.",
  },
];

const POLARITY_LANGUAGE = /polarity|enantiodromia|\bboth\b|compensation/i;
const CHARGE_LANGUAGE = /shame|terror|freeze|chest|throat|body|charge/i;

function finding(id: string, passed: boolean, detail: string): RubricFinding {
  return { id, passed, detail };
}

function joinedText(sections: ReportSection[]) {
  return sections.map((section) => `${section.title}\n${section.body}`).join("\n");
}

export function evaluateReport(input: {
  report: Pick<Report, "engineVersion" | "sections">;
  caseState?: Partial<
    Pick<CaseState, "practicalContext" | "hypotheses" | "jungianLenses" | "affect">
  >;
  requestedInsight?: string;
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
  const present = new Set(sections.map((section) => section.id));
  const missingPeel = REQUIRED_PEEL_SECTION_IDS.filter((id) => !present.has(id));
  findings.push(
    finding(
      "peel-sections",
      missingPeel.length === 0,
      missingPeel.length
        ? `Missing peel sections: ${missingPeel.join(", ")}`
        : "Core peel-order sections are present.",
    ),
  );

  findings.push(
    finding(
      "diverse-evidence-refs",
      hasDiverseEvidenceRefs(sections),
      hasDiverseEvidenceRefs(sections)
        ? `Evidence refs span at least ${MIN_DISTINCT_EVIDENCE_QUESTION_IDS} question ids.`
        : `Evidence refs must cite at least ${MIN_DISTINCT_EVIDENCE_QUESTION_IDS} distinct question ids across the report.`,
    ),
  );

  const insight = input.requestedInsight?.trim();
  if (insight) {
    const spine = isRequestedInsightSpine(sections, insight);
    findings.push(
      finding(
        "requested-insight-spine",
        !spine,
        spine
          ? "Report bodies collapse onto Q11.3 requestedInsight instead of case evidence."
          : "Report is not a Q11.3-only paraphrase spine.",
      ),
    );
  }

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

  const unanchoredAlone =
    /unanchored ideal/i.test(text) && !POLARITY_LANGUAGE.test(text);
  findings.push(
    finding(
      "unanchored-ideal-alone",
      !unanchoredAlone,
      unanchoredAlone
        ? "Unanchored ideal as sole frame requires polarity/process language."
        : "Unanchored ideal is not used as a sole frame without polarity language.",
    ),
  );

  const affect = input.caseState?.affect;
  const affectIndicated =
    Boolean(affect) &&
    ((affect!.chargeIntensity ?? 0) >= 1 || (affect!.emotions?.length ?? 0) > 0);
  if (affectIndicated) {
    const hasCharge = CHARGE_LANGUAGE.test(text);
    findings.push(
      finding(
        "charge-language",
        hasCharge,
        hasCharge
          ? "Peel includes charge/body language where affect is indicated."
          : "Affect is indicated in CaseState but peel lacks charge/body language.",
      ),
    );
  }

  const constraints = input.caseState?.practicalContext?.constraints.length ?? 0;
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
