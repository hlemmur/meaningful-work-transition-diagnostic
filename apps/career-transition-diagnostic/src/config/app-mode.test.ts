import { afterEach, describe, expect, it } from "vitest";
import { afterDeliveryPath, assertMockMode, isLiveLlmMode, isMockMode } from "./app-mode";

const originalAppMode = process.env.APP_MODE;
const originalLlmMode = process.env.LLM_MODE;

afterEach(() => {
  if (originalAppMode === undefined) {
    delete process.env.APP_MODE;
  } else {
    process.env.APP_MODE = originalAppMode;
  }
  if (originalLlmMode === undefined) {
    delete process.env.LLM_MODE;
  } else {
    process.env.LLM_MODE = originalLlmMode;
  }
});

describe("isMockMode", () => {
  it("is true when APP_MODE is mock", () => {
    process.env.APP_MODE = "mock";
    expect(isMockMode()).toBe(true);
  });

  it("is false when APP_MODE is live", () => {
    process.env.APP_MODE = "live";
    expect(isMockMode()).toBe(false);
  });

  it("blocks mock-only actions in live mode", () => {
    process.env.APP_MODE = "live";
    expect(() => assertMockMode("Mock purchase")).toThrow(
      "Mock purchase is only available in mock mode",
    );
    process.env.APP_MODE = "mock";
    expect(() => assertMockMode("Mock purchase")).not.toThrow();
  });

  it("sends operators to the mock outbox only in mock mode", () => {
    process.env.APP_MODE = "mock";
    expect(afterDeliveryPath()).toBe("/mock/outbox");
    process.env.APP_MODE = "live";
    expect(afterDeliveryPath()).toBe("/admin?delivered=1");
  });
});

describe("isLiveLlmMode", () => {
  it("is false when APP_MODE is mock and LLM_MODE is unset", () => {
    process.env.APP_MODE = "mock";
    delete process.env.LLM_MODE;
    expect(isLiveLlmMode()).toBe(false);
  });

  it("is true when LLM_MODE is live even if checkout stays mocked", () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    expect(isLiveLlmMode()).toBe(true);
  });

  it("inherits APP_MODE when LLM_MODE is unset", () => {
    process.env.APP_MODE = "live";
    delete process.env.LLM_MODE;
    expect(isLiveLlmMode()).toBe(true);
  });
});
