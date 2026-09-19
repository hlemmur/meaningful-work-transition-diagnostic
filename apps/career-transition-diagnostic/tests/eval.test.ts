import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateReport } from "@/eval/rubric";
import { resetMockOutbox } from "@/server/adapters/resend/mock";
import {
  completeMockPurchase,
  getDraftReport,
  listCaseStateVersions,
  recordWelcomeConsent,
  resetMockTracerStore,
  runAnalysisPipeline,
  saveAnswer,
  submitAssessment,
} from "@/server/tracer/service";
import { BENCHMARK_CASES } from "./benchmarks";

afterEach(async () => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  await resetMockTracerStore();
});

beforeEach(async () => {
  process.env.APP_MODE = "mock";
});

describe("launch-gate report rubric", () => {
  it("rejects confidence-only, Puer diagnosis, and alignment-money reports", () => {
    const bad = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          {
            id: "problem",
            title: "The problem",
            body: "You just need more confidence. You are a Puer. Follow alignment and money comes.",
            evidenceRefs: ["a1:Q1.1"],
          },
        ],
      },
    });

    expect(bad.passed).toBe(false);
    expect(bad.findings.filter((item) => !item.passed).map((item) => item.id)).toEqual(
      expect.arrayContaining(["puer-diagnosis", "confidence-only", "alignment-money", "jungian-overreach"]),
    );
  });

  it("rejects unsupported claims with no evidence mapping", () => {
    const bad = evaluateReport({
      report: {
        engineVersion: "engine.v2",
        sections: [
          {
            id: "problem",
            title: "The problem",
            body: "A specific stall sits next to a desire for more alive work.",
            evidenceRefs: [],
          },
        ],
      },
    });
    expect(bad.findings.find((item) => item.id === "evidence-mapping")?.passed).toBe(false);
  });
});

describe("five benchmark fixtures", () => {
  it("produce structurally valid reports that pass the human rubric", async () => {
    for (const benchmark of BENCHMARK_CASES) {
      const purchase = await completeMockPurchase(`${benchmark.id}@example.com`);
      await recordWelcomeConsent({
        accessToken: purchase.accessToken,
        productConsent: true,
        marketingOptIn: false,
      });
      for (const [questionId, value] of Object.entries(benchmark.answers)) {
        await saveAnswer(purchase.accessToken, questionId, value);
      }
      await submitAssessment(purchase.accessToken);
      const result = await runAnalysisPipeline(purchase.assessmentId);
      const draft = await getDraftReport(purchase.assessmentId);
      const caseState = (await listCaseStateVersions(purchase.assessmentId)).at(-1)?.snapshot;

      expect(result.status, benchmark.id).toBe("completed");
      expect(draft?.generated.engineVersion, benchmark.id).toBe("engine.v2");
      const rubric = evaluateReport({
        report: draft!.generated,
        caseState,
      });
      const reportRefs = draft!.generated.sections.map((section) => ({
        id: section.id,
        refs: section.evidenceRefs,
      }));
      
      expect(
        rubric.passed,
        `${benchmark.id}: ${JSON.stringify({
          findings: rubric.findings,
          reportRefs,
        })}`,
      ).toBe(true);
      await resetMockTracerStore();
    }
  });
});
