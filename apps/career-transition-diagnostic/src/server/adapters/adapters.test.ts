import { afterEach, describe, expect, it, vi } from "vitest";
import { createVendorAdapters } from "./index";
import { resetMockOutbox } from "./resend/mock";

afterEach(() => {
  process.env.APP_MODE = "mock";
  resetMockOutbox();
  vi.unstubAllGlobals();
});

describe("mock vendor adapters", () => {
  it("never calls fetch for Lemon Squeezy, OpenAI, or Resend", async () => {
    process.env.APP_MODE = "mock";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const adapters = createVendorAdapters();

    await adapters.commerce.createCheckout({ email: "buyer@example.com" });
    await adapters.llm.completeStructured({
      stage: "pass1-lite",
      input: { assessmentId: "a1" },
    });
    await adapters.email.send({
      to: "buyer@example.com",
      subject: "Your assessment link",
      text: "https://example.test/a/token",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("queues transactional email in the mock outbox", async () => {
    process.env.APP_MODE = "mock";
    const adapters = createVendorAdapters();

    await adapters.email.send({
      to: "buyer@example.com",
      subject: "Your assessment link",
      text: "https://example.test/a/token",
    });

    expect(adapters.email.listOutbox()).toEqual([
      expect.objectContaining({
        to: "buyer@example.com",
        subject: "Your assessment link",
      }),
    ]);
  });

  it("returns a local mock checkout URL and a deterministic LLM fixture", async () => {
    process.env.APP_MODE = "mock";
    const adapters = createVendorAdapters();

    await expect(
      adapters.commerce.createCheckout({ email: "buyer@example.com" }),
    ).resolves.toEqual({
      checkoutUrl: "/mock/checkout",
      orderId: "mock-order-1",
    });

    await expect(
      adapters.llm.completeStructured({
        stage: "pass1-lite",
        input: { assessmentId: "a1" },
      }),
    ).resolves.toEqual({
      stage: "pass1-lite",
      fixture: "deterministic-pass1-lite",
      output: { ok: true },
    });
  });
});
