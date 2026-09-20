import type { SoftDimId } from "./framework-fidelity";
import type { FrameworkArtifact, FrameworkFidelityResult } from "./framework-fidelity";

export type SoftChecklistNote = {
  id: SoftDimId;
  question: string;
  /** Mentor / offline soft rating — not a hard gate. */
  rating: "strong" | "adequate" | "thin" | "missing" | "n/a";
  note: string;
};

const REQUIRED_SOFT_IDS: SoftDimId[] = [
  "surprise",
  "image_alive",
  "imaginal_grounding",
  "aim_sibling",
  "projection_gold",
  "affect_grounding",
  "bridge_to_11",
];

export function requiredSoftChecklistIds(): SoftDimId[] {
  return [...REQUIRED_SOFT_IDS];
}

/** Empty fillable slots from fidelity template (generic ids only). */
export function blankSoftChecklist(
  template: FrameworkFidelityResult["softChecklistTemplate"],
): SoftChecklistNote[] {
  return template.map((item) => ({
    id: item.id,
    question: item.question,
    rating: "n/a" as const,
    note: "",
  }));
}

/**
 * Heuristic draft notes for offline mentor fill. Does not invent origin tokens;
 * reads peel text only. Mentors should edit ratings/notes before treating as final.
 */
export function draftSoftChecklistFromArtifact(
  artifact: FrameworkArtifact,
  template: FrameworkFidelityResult["softChecklistTemplate"],
): SoftChecklistNote[] {
  const sections = artifact.report.sections;
  const peel = sections.map((section) => section.body).join("\n");
  const hidden = sections.find((section) => section.id === "hidden")?.body ?? "";
  const reality = sections.find((section) => section.id === "reality")?.body ?? "";
  const contradiction =
    sections.find((section) => section.id === "contradiction")?.body ?? "";
  const depth = `${reality}\n${hidden}\n${contradiction}`;

  const hasAim =
    /aim|develop|compensatory|growth|emerg/i.test(hidden);
  const hasProtect = /protect|protective|keeps|shield|bargain/i.test(hidden);
  const hasImaginalExperiment = artifact.caseState.experiments.some(
    (item) => item.kind === "imaginal",
  );
  const hasSymbolicMaterial = Object.values(artifact.caseState.symbolicMaterial).some(
    (value) => Array.isArray(value) ? value.length > 0 : Boolean(value?.trim()),
  );
  const hasImageAlive =
    /:Q10\./.test(
      [...sections.find((s) => s.id === "reality")?.evidenceRefs ?? [],
        ...sections.find((s) => s.id === "hidden")?.evidenceRefs ?? []].join(" "),
    );
  const hasProjectionGold =
    /hooked|own (the |that )?|wanted quality|gold/i.test(
      depth,
    ) || /admir|fascination|reject/i.test(contradiction);
  const hasCharge = /shame|terror|freeze|fear|anxiety|emotion|chest|throat|body|charge/i.test(peel);
  const affectIndicated =
    (artifact.caseState.affect.chargeIntensity ?? 0) > 0 ||
    artifact.caseState.affect.emotions.length > 0 ||
    artifact.caseState.affect.bodyResponses.length > 0;

  const drafts: Record<SoftDimId, Pick<SoftChecklistNote, "rating" | "note">> = {
    surprise: {
      rating: /yet|while|split|dual|both|and yet/i.test(peel) ? "adequate" : "thin",
      note: "Offline draft: look for fused domains the conscious story had not already joined.",
    },
    image_alive: {
      rating: hasImageAlive ? "strong" : "thin",
      note: hasImageAlive
        ? "Offline draft: supplied symbolic material is cited in reality/hidden."
        : "Offline draft: check whether supplied symbolic material constrains an interpretive section.",
    },
    imaginal_grounding: {
      rating: !hasImaginalExperiment ? "n/a" : hasSymbolicMaterial ? "adequate" : "missing",
      note: !hasImaginalExperiment
        ? "No imaginal experiment was used or required."
        : hasSymbolicMaterial
          ? "Offline draft: imaginal experiment has supplied symbolic material; confirm it invents no reply."
          : "Offline draft: imaginal experiment lacks supplied symbolic material.",
    },
    aim_sibling: {
      rating: hasProtect && hasAim ? "strong" : hasProtect || hasAim ? "thin" : "missing",
      note:
        hasProtect && hasAim
          ? "Offline draft: hidden names protection and developmental aim as siblings."
          : "Offline draft: protection/aim twin incomplete in peel text.",
    },
    projection_gold: {
      rating: hasProjectionGold ? "adequate" : "thin",
      note: hasProjectionGold
        ? "Offline draft: projection figures/hooked quality appear; confirm gold-to-own as hypothesis."
        : "Offline draft: projection gold thin — wanted/judged quality may be omitted.",
    },
    affect_grounding: {
      rating: !affectIndicated ? "n/a" : hasCharge ? "adequate" : "thin",
      note: !affectIndicated
        ? "No affect language is required because the case supplies none."
        : hasCharge
          ? "Offline draft: supplied affect language appears; confirm any body location is evidence-backed."
          : "Offline draft: supplied emotion or charge may be missing from the report.",
    },
    bridge_to_11: {
      rating: "adequate",
      note: "Offline draft: if peel stays second-person, case-specific, and open — 1:1 can continue here.",
    },
  };

  return template.map((item) => ({
    id: item.id,
    question: item.question,
    ...drafts[item.id],
  }));
}
