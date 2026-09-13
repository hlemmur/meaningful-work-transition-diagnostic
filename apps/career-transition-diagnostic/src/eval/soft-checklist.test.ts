import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { evaluateFrameworkFidelity } from "./framework-fidelity";
import {
  blankSoftChecklist,
  draftSoftChecklistFromArtifact,
  requiredSoftChecklistIds,
} from "./soft-checklist";

describe("soft checklist (CAR-78)", () => {
  it("exposes generic soft dim ids without origin tokens", () => {
    const ids = requiredSoftChecklistIds();
    expect(ids).toEqual([
      "surprise",
      "image_alive",
      "imaginal_sibling",
      "aim_sibling",
      "projection_gold",
      "cm_layer_feel",
      "bridge_to_11",
    ]);
    expect(ids.join(" ")).not.toMatch(/\bpipe\b|\bprovider\b|\bhustler\b/i);
  });

  it("blank checklist mirrors required soft ids", () => {
    const blank = blankSoftChecklist(
      requiredSoftChecklistIds().map((id) => ({ id, question: id })),
    );
    expect(blank.map((item) => item.id)).toEqual(requiredSoftChecklistIds());
    expect(blank.every((item) => item.note === "" && item.rating === "n/a")).toBe(true);
  });

  it("drafts soft notes from a persisted live artifact when present", () => {
    const path = join(
      process.cwd(),
      ".local/eval-artifacts/origin-case-live-pass9-resume-213700ab.json",
    );
    if (!existsSync(path)) {
      expect(existsSync(path)).toBe(false);
      return;
    }
    const artifact = JSON.parse(readFileSync(path, "utf8")) as {
      answers: Record<string, unknown>;
      caseState: never;
      report: never;
    };
    const fidelity = evaluateFrameworkFidelity(artifact);
    expect(fidelity.hardPassed).toBe(true);
    const notes = draftSoftChecklistFromArtifact(artifact, fidelity.softChecklistTemplate);
    expect(notes.map((item) => item.id)).toEqual(requiredSoftChecklistIds());
    expect(notes.find((item) => item.id === "aim_sibling")?.rating).toMatch(/strong|adequate/);
    expect(notes.find((item) => item.id === "imaginal_sibling")?.rating).toMatch(
      /strong|adequate|n\/a/,
    );
    expect(notes.every((item) => !/\bprovider\b/i.test(item.note))).toBe(true);
  });

  it("checked-in soft-depth notes use generic ids and stay redacted", () => {
    const notes = JSON.parse(
      readFileSync(join(__dirname, "fixtures/soft-depth-smoke-checklist-notes.json"), "utf8"),
    ) as {
      hardPassed: boolean;
      softChecklist: Array<{ id: string; rating: string; note: string }>;
    };
    expect(notes.hardPassed).toBe(true);
    expect(notes.softChecklist.map((item) => item.id)).toEqual(requiredSoftChecklistIds());
    const blob = JSON.stringify(notes);
    expect(blob).not.toMatch(/\bpipe\b/i);
    expect(blob).not.toMatch(/Stefan|Selma|Martin/i);
  });
});
