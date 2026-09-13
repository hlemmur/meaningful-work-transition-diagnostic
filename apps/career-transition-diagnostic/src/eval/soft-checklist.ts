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
  "imaginal_sibling",
  "aim_sibling",
  "projection_gold",
  "cm_layer_feel",
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
    /aim|develop|structure in service|aliveness|compensatory/i.test(hidden);
  const hasProtect = /protect|protective|keeps|shield|bargain/i.test(hidden);
  const hasDialogue =
    /ask|speak|say|said|voice|image|scene|obstacle|dialogue|reply|whisper/i.test(
      `${reality}\n${hidden}`,
    );
  const hasImaginalExperiment = artifact.caseState.experiments.some(
    (item) => item.kind === "imaginal",
  );
  const hasImageAlive =
    /:Q10\./.test(
      [...sections.find((s) => s.id === "reality")?.evidenceRefs ?? [],
        ...sections.find((s) => s.id === "hidden")?.evidenceRefs ?? []].join(" "),
    ) || /image|scene|association|pipe|gate|threshold/i.test(`${reality}\n${hidden}`);
  const hasProjectionGold =
    /hooked|own (the |that )?|wanted quality|claim(ing)? (space|pace)|gold/i.test(
      depth,
    ) || /admir|fascination|reject/i.test(contradiction);
  const hasCharge = /shame|terror|freeze|chest|throat|body|charge|fear/i.test(peel);
  const hasSpeech = Boolean(artifact.caseState.symbolicMaterial.obstacleSpeech?.trim());

  const drafts: Record<SoftDimId, Pick<SoftChecklistNote, "rating" | "note">> = {
    surprise: {
      rating: /yet|while|split|dual|both|and yet/i.test(peel) ? "adequate" : "thin",
      note: "Offline draft: look for fused domains the conscious story had not already joined.",
    },
    image_alive: {
      rating: hasImageAlive ? "strong" : "thin",
      note: hasImageAlive
        ? "Offline draft: image/associations appear as living material in reality/hidden."
        : "Offline draft: image may still read as garnish — check Q10 presence in peel.",
    },
    imaginal_sibling: {
      rating: !hasSpeech
        ? "n/a"
        : hasDialogue || hasImaginalExperiment
          ? "adequate"
          : "missing",
      note: !hasSpeech
        ? "No obstacleSpeech in CaseState; imaginal sibling not required."
        : hasDialogue || hasImaginalExperiment
          ? "Offline draft: speech engaged via dialogue language and/or imaginal experiment."
          : "Offline draft: speech present but peel lacks dialogue/imaginal engagement.",
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
    cm_layer_feel: {
      rating: hasCharge ? "adequate" : "thin",
      note: hasCharge
        ? "Offline draft: charge/body language present; confirm it leads a depth beat before theory."
        : "Offline draft: affect indicated path may lack body/charge lead.",
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
