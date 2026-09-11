import { afterEach, describe, expect, it } from "vitest";
import { afterDeliveryPath, assertMockMode, isMockMode } from "./app-mode";

const originalAppMode = process.env.APP_MODE;

afterEach(() => {
  if (originalAppMode === undefined) {
    delete process.env.APP_MODE;
  } else {
    process.env.APP_MODE = originalAppMode;
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
