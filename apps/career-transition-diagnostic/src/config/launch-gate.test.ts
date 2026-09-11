import { afterEach, describe, expect, it } from "vitest";
import { paymentsEnabled } from "./launch-gate";

const original = {
  APP_MODE: process.env.APP_MODE,
  PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
};

afterEach(() => {
  process.env.APP_MODE = original.APP_MODE;
  process.env.PAYMENTS_ENABLED = original.PAYMENTS_ENABLED;
});

describe("paid launch gate", () => {
  it("keeps mock checkout available in mock mode", () => {
    process.env.APP_MODE = "mock";
    delete process.env.PAYMENTS_ENABLED;
    expect(paymentsEnabled()).toBe(true);
  });

  it("blocks live payments until PAYMENTS_ENABLED is true", () => {
    process.env.APP_MODE = "live";
    delete process.env.PAYMENTS_ENABLED;
    expect(paymentsEnabled()).toBe(false);
    process.env.PAYMENTS_ENABLED = "true";
    expect(paymentsEnabled()).toBe(true);
  });
});
