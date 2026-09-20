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
  it("accepts a complete evidence-grounded maintaining loop", () => {
    const parsed = finalFormulationSchema.parse({
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Seeking certainty keeps action suspended.",
      maintenanceMechanism: mechanism,
      maintainingLoop: {
        goal: "Choose meaningful work responsibly.",
        trigger: "A concrete option appears.",
        response: "More certainty is sought before acting.",
        payoff: "Options and self-image remain protected.",
        cost: "No direct evidence about fit accumulates.",
        selfConfirmingResult: "The missing evidence makes certainty feel even more necessary.",
        evidenceRefs: ["a:Q2.1", "a:Q4.2"],
      },
      whyItFits: ["a:Q2.1", "a:Q4.2"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    });

    expect(parsed.maintainingLoop?.goal).toBe("Choose meaningful work responsibly.");
  });

  it("rejects a loop that repeats the same statement as every step", () => {
    const repeated = "Nothing changes.";
    const result = finalFormulationSchema.safeParse({
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Seeking certainty keeps action suspended.",
      maintenanceMechanism: mechanism,
      maintainingLoop: {
        goal: repeated,
        trigger: repeated,
        response: repeated,
        payoff: repeated,
        cost: repeated,
        selfConfirmingResult: repeated,
        evidenceRefs: ["a:Q2.1", "a:Q4.2"],
      },
      whyItFits: ["a:Q2.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate maintaining-loop evidence refs", () => {
    const result = finalFormulationSchema.safeParse({
      selectedHypothesisId: "hyp-1",
      maintenanceFormulation: "Seeking certainty keeps action suspended.",
      maintenanceMechanism: mechanism,
      maintainingLoop: {
        goal: "Choose meaningful work.",
        trigger: "A concrete option appears.",
        response: "Action is delayed.",
        payoff: "Options remain open.",
        cost: "No evidence accumulates.",
        selfConfirmingResult: "More certainty feels necessary.",
        evidenceRefs: ["a:Q2.1", "a:Q2.1"],
      },
      whyItFits: ["a:Q2.1"],
      whatItDoesNotExplain: [],
      strongestAlternative: "Job-shape mismatch.",
      unresolvedForks: [],
    });

    expect(result.success).toBe(false);
  });
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
