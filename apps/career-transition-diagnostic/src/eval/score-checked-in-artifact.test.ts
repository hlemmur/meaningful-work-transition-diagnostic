import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateFrameworkFidelity } from "./framework-fidelity";

const artifactPath = join(__dirname, "fixtures/origin-gold-mock-artifact.json");

describe("checked-in framework artifact", () => {
  it("scores origin-gold mock artifact hard-pass", () => {
    expect(existsSync(artifactPath)).toBe(true);
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const result = evaluateFrameworkFidelity(artifact);
    expect(result.hardPassed).toBe(true);
  });
});
