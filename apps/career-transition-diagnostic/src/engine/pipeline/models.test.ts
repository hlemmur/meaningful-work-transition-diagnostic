import { afterEach, describe, expect, it } from "vitest";
import { costForModel, modelForStage } from "./models";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.LLM_MODE;
  delete process.env.GEMINI_MODEL_CHEAP;
  delete process.env.GEMINI_MODEL_STRONG;
  delete process.env.OPENAI_MODEL_CHEAP;
  delete process.env.OPENAI_MODEL_STRONG;
});

describe("modelForStage", () => {
  it("returns mock-cheap and mock-strong when the LLM is mocked", () => {
    process.env.APP_MODE = "mock";
    delete process.env.LLM_MODE;
    expect(modelForStage("pass1")).toBe("mock-cheap");
    expect(modelForStage("pass3")).toBe("mock-strong");
  });

  it("reads Gemini env when LLM_MODE is live", () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_MODEL_CHEAP = "gemini-2.5-flash";
    process.env.GEMINI_MODEL_STRONG = "gemini-2.5-pro";
    expect(modelForStage("pass1")).toBe("gemini-2.5-flash");
    expect(modelForStage("pass6")).toBe("gemini-2.5-pro");
  });

  it("defaults both live Gemini tiers to gemini-2.5-flash", () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    delete process.env.GEMINI_MODEL_CHEAP;
    delete process.env.GEMINI_MODEL_STRONG;
    expect(modelForStage("pass2")).toBe("gemini-2.5-flash");
    expect(modelForStage("pass9")).toBe("gemini-2.5-flash");
  });

  it("does not use leftover OPENAI_MODEL ids", () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.OPENAI_MODEL_CHEAP = "gpt-4.1-mini";
    process.env.OPENAI_MODEL_STRONG = "gpt-4.1";
    expect(modelForStage("pass1")).toBe("gemini-2.5-flash");
    expect(modelForStage("pass3")).toBe("gemini-2.5-flash");
  });
});

describe("costForModel", () => {
  it("does not treat gemini ids as strong because they contain no strong substring", () => {
    expect(costForModel("gemini-2.5-flash")).toBe(0.002);
    expect(costForModel("custom-strong-preview")).toBe(0.002);
  });

  it("prices mock-strong without scanning the model id for a substring", () => {
    expect(costForModel("mock-strong")).toBe(0.02);
    expect(costForModel("mock-cheap")).toBe(0.002);
  });

  it("prices the configured Gemini strong id higher when it differs from cheap", () => {
    process.env.GEMINI_MODEL_CHEAP = "gemini-2.5-flash";
    process.env.GEMINI_MODEL_STRONG = "gemini-2.5-pro";
    expect(costForModel("gemini-2.5-pro")).toBe(0.02);
    expect(costForModel("gemini-2.5-flash")).toBe(0.002);
  });
});
