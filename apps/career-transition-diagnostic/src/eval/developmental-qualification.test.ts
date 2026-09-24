import { describe, expect, it } from "vitest";
import { emptyCaseState } from "@/engine/checkpoints/empty-case-state";
import { evaluateDevelopmentalQualification } from "./developmental-qualification";

describe("developmental qualification rubric", () => {
  it("passes practical restraint and rejects an invented developmental section", () => {
    const state = emptyCaseState("practical");
    const restrained = evaluateDevelopmentalQualification(state, []);
    expect(restrained.hardPassed).toBe(true);

    const invented = evaluateDevelopmentalQualification(state, [{
      id: "developmental", title: "The developmental tension", body: "A tension.", evidenceRefs: ["practical:Q2.1"],
    }]);
    expect(invented.hardPassed).toBe(false);
  });

  it("requires a developmental formulation to span independent domains and appear in the report", () => {
    const state = emptyCaseState("positive");
    state.finalFormulation = {
      selectedHypothesisId: "h1",
      maintenanceFormulation: "Delay recurs.",
      maintenanceMechanism: { trigger: "Choice", response: "Delay", shortTermFunction: "Relief", longTermCost: "No evidence", reinforcingConsequence: "Uncertainty" },
      developmentalFormulation: {
        consciousPole: "freedom", compensatingPole: "structure", coreOpposition: "freedom and structure",
        possibleDevelopmentalTask: "Integrate both.", uncertainty: "Practical causes remain live.",
        evidenceRefs: ["positive:Q2.1", "positive:Q6.1"],
      },
      whyItFits: ["Recurs"], whatItDoesNotExplain: ["Market"], strongestAlternative: "Job shape", unresolvedForks: [],
    };
    const result = evaluateDevelopmentalQualification(state, [{
      id: "developmental", title: "The developmental tension", body: "You may be integrating freedom and structure.", evidenceRefs: ["positive:Q2.1", "positive:Q6.1"],
    }]);
    expect(result.hardPassed).toBe(true);
  });
});
