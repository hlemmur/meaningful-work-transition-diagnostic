import { describe, expect, it } from "vitest";
import { finalFormulationSchema } from "./analysis";

const mechanism = {
  trigger: "Unstructured time begins.",
  response: "Action is deferred while certainty is sought.",
  shortTermFunction: "Avoids premature commitment.",
  longTermCost: "Evidence about fit never accumulates.",
  reinforcingConsequence: "The lack of evidence makes more certainty feel necessary.",
};

describe("finalFormulationSchema", () => {
  it("normalizes a legacy central formulation without losing its wording", () => {
    const parsed = finalFormulationSchema.parse({
      selectedHypothesisId: "hyp-1",
      centralFormulation: "Loss of structure sustains the stall.",
      whyItFits: ["a:Q1.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "The labor market is unusually weak.",
      unresolvedForks: [],
    });

    expect(parsed.maintenanceFormulation).toBe(
      "Loss of structure sustains the stall.",
    );
    expect(parsed.maintenanceMechanism).toEqual({
      trigger: "Not recorded in the legacy formulation.",
      response: "Loss of structure sustains the stall.",
      shortTermFunction: "Not recorded in the legacy formulation.",
      longTermCost: "Not recorded in the legacy formulation.",
      reinforcingConsequence: "Not recorded in the legacy formulation.",
    });
    expect(parsed).not.toHaveProperty("centralFormulation");
  });

  it("accepts a grounded cross-domain developmental formulation", () => {
    const parsed = finalFormulationSchema.parse({
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Seeking certainty keeps action suspended.",
      maintenanceMechanism: mechanism,
      developmentalFormulation: {
        consciousPole: "Freedom",
        compensatingPole: "Commitment",
        coreOpposition: "Freedom versus commitment",
        possibleDevelopmentalTask: "Test forms of commitment that preserve agency.",
        possibleThird: "Chosen structure",
        uncertainty: "This may instead be a job-shape mismatch.",
        evidenceRefs: ["a:Q2.1", "a:Q6.2"],
      },
      whyItFits: ["a:Q2.1", "a:Q6.2"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    });

    expect(parsed.developmentalFormulation?.possibleThird).toBe("Chosen structure");
  });

  it("rejects developmental formulations grounded in only one evidence domain", () => {
    const result = finalFormulationSchema.safeParse({
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Seeking certainty keeps action suspended.",
      maintenanceMechanism: mechanism,
      developmentalFormulation: {
        consciousPole: "Freedom",
        compensatingPole: "Commitment",
        coreOpposition: "Freedom versus commitment",
        possibleDevelopmentalTask: "Commit more fully.",
        uncertainty: "Tentative.",
        evidenceRefs: ["a:Q6.1", "a:Q6.2"],
      },
      whyItFits: ["a:Q6.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    });

    expect(result.success).toBe(false);
  });
});
