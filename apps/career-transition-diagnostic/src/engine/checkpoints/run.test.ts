import { describe, expect, it } from "vitest";
import { mockLlmAdapter } from "@/server/adapters/openai/mock";
import { ADAPTIVE_QUESTION_BANK } from "./bank";
import { SUPPORT_COPY } from "./bank";
import { runCheckpoint } from "./run";

const llm = mockLlmAdapter;

describe("adaptive checkpoints A–D", () => {
  it("asks a history follow-up after section 2 when that fork is open", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "A",
      answers: {
        "Q1.1": "I left a career that still pays my bills.",
        "Q1.3": "I lack confidence.",
        "Q2.2": "I rewrote the website twice.",
      },
      llm,
    });

    expect(result.adaptiveQuestion?.forkId).toBe("history_vs_stated_cause");
    expect(result.adaptiveQuestion?.questionText).toBe(
      ADAPTIVE_QUESTION_BANK.history_vs_stated_cause.questionText,
    );
    expect(result.adaptiveQuestion?.questionText).not.toMatch(/puer|shadow|archetype/i);
    expect(result.caseState.consciousNarrative.statedProblem[0]?.rawQuote).toContain(
      "pays my bills",
    );
    expect(result.safetyLevel).toBe("none");
  });

  it("returns zero questions for a fixture that is already determined", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "A",
      answers: { "Q1.1": "FORCE_NONE_FIXTURE" },
      llm: {
        async completeStructured(request) {
          return mockLlmAdapter.completeStructured({
            ...request,
            input: { ...request.input, fixture: "none" },
          });
        },
      },
    });

    expect(result.adaptiveQuestion).toBeNull();
    expect(result.caseState.assessmentId).toBe("assess-1");
  });

  it("records high safety, skips adaptive questions, and reduces report depth", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "A",
      answers: {
        "Q0.5": "I have suicidal thoughts and cannot function.",
      },
      llm,
    });

    expect(result.safetyLevel).toBe("high");
    expect(result.adaptiveQuestion).toBeNull();
    expect(result.supportCopy).toBe(SUPPORT_COPY);
    expect(result.reportDepth).toBe("reduced");
    expect(result.caseState.safetyFlags[0]?.severity).toBe("high");
    expect(JSON.stringify(result.caseState.safetyFlags)).not.toMatch(/suicid/i);
  });

  it("continues without an extra question when the checkpoint LLM fails", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "B",
      answers: { "Q1.1": "FORCE_LLM_FAILURE" },
      llm,
    });

    expect(result.adaptiveQuestion).toBeNull();
    expect(result.safetyLevel).toBe("none");
  });

  it("keeps a prior high safety flag when a later checkpoint LLM fails", async () => {
    const llmCalls: string[] = [];
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "B",
      answers: { "Q1.1": "FORCE_LLM_FAILURE" },
      previousSafetyLevel: "high",
      llm: {
        async completeStructured(request) {
          llmCalls.push(request.stage);
          throw new Error("later checkpoint LLM should not run after high safety");
        },
      },
    });

    expect(result.safetyLevel).toBe("high");
    expect(result.adaptiveQuestion).toBeNull();
    expect(result.reportDepth).toBe("reduced");
    expect(result.supportCopy).toBe(SUPPORT_COPY);
    expect(llmCalls).toEqual([]);
  });

  it("does not ask an adaptive follow-up after a prior high safety flag", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "B",
      answers: {
        "Q1.1": "I left a career that still pays my bills.",
        "Q1.3": "I lack confidence.",
        "Q2.2": "I rewrote the website twice.",
      },
      previousSafetyLevel: "high",
      llm,
    });

    expect(result.safetyLevel).toBe("high");
    expect(result.adaptiveQuestion).toBeNull();
    expect(result.reportDepth).toBe("reduced");
  });

  it("will not exceed the preferred cap of four adaptive questions", async () => {
    const existing = [
      {
        id: "QA.1",
        checkpoint: "A" as const,
        forkId: "history_vs_stated_cause" as const,
        questionText: "already asked",
      },
      {
        id: "QB.1",
        checkpoint: "B" as const,
        forkId: "container_loss_vs_capacity" as const,
        questionText: "already asked",
      },
      {
        id: "QC.1",
        checkpoint: "C" as const,
        forkId: "work_vs_identity_vs_job_shape" as const,
        questionText: "already asked",
      },
      {
        id: "QD.1",
        checkpoint: "D" as const,
        forkId: "rational_caution_vs_hidden_bargain" as const,
        questionText: "already asked",
      },
    ];

    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "D",
      answers: {},
      existingAdaptive: existing,
      llm,
    });

    expect(result.adaptiveQuestion).toBeNull();
  });

  it("skips shame/identity adaptives when charge is high or too much was tapped", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "B",
      answers: { "Q3.2": 9 },
      llm: {
        async completeStructured(request) {
          return mockLlmAdapter.completeStructured({
            ...request,
            input: { ...request.input, fixture: "legitimacy_loop" },
          });
        },
      },
    });

    expect(result.adaptiveQuestion).toBeNull();
  });

  it("allows a second question on the same fork within the per-fork cap", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "B",
      answers: {},
      existingAdaptive: [
        {
          id: "QA.1",
          checkpoint: "A",
          forkId: "history_vs_stated_cause",
          questionText: "already asked",
        },
      ],
      llm: {
        async completeStructured(request) {
          return mockLlmAdapter.completeStructured({
            ...request,
            input: { ...request.input, fixture: "history_vs_stated_cause" },
          });
        },
      },
    });

    expect(result.adaptiveQuestion?.forkId).toBe("history_vs_stated_cause");
    expect(result.adaptiveQuestion?.id).toBe("QB.1");
  });

  it("uses canonical bank copy even if the LLM paraphrases", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "A",
      answers: {
        "Q1.3": "I lack confidence.",
        "Q2.2": "I rewrote the website twice.",
      },
      llm: {
        async completeStructured() {
          return {
            stage: "checkpoint-A",
            fixture: "paraphrase",
            output: {
              openForks: ["history_vs_stated_cause"],
              safety: { level: "none", flags: [] },
              adaptiveQuestion: {
                forkId: "history_vs_stated_cause",
                rationale: "internal",
                questionText: "Can you say more about why that happened?",
              },
            },
          };
        },
      },
    });

    expect(result.adaptiveQuestion?.questionText).toBe(
      ADAPTIVE_QUESTION_BANK.history_vs_stated_cause.questionText,
    );
  });

  it("drops Jung-speak or leading adaptive copy", async () => {
    const result = await runCheckpoint({
      assessmentId: "assess-1",
      checkpoint: "A",
      answers: {},
      llm: {
        async completeStructured(request) {
          return mockLlmAdapter.completeStructured({
            ...request,
            input: { ...request.input, fixture: "jung-speak" },
          });
        },
      },
    });

    expect(result.adaptiveQuestion).toBeNull();
  });
});
