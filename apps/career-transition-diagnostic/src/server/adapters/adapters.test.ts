import { afterEach, describe, expect, it, vi } from "vitest";
import { createVendorAdapters } from "./index";
import { resetMockOutbox } from "./resend/mock";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.PAYMENTS_ENABLED;
  delete process.env.LEMON_SQUEEZY_CHECKOUT_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL_CHEAP;
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

  it("fails closed for live Lemon, OpenAI, and Resend until the launch gate and credentials exist", async () => {
    process.env.APP_MODE = "live";
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.LEMON_SQUEEZY_CHECKOUT_URL;
    const adapters = createVendorAdapters();

    await expect(adapters.commerce.createCheckout({ email: "buyer@example.com" })).rejects.toThrow(
      "Paid checkout is disabled until the launch gate is green.",
    );
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow("OpenAI live adapter is not configured");
    await expect(
      adapters.email.send({ to: "buyer@example.com", subject: "x", text: "y" }),
    ).rejects.toThrow("Resend live adapter is not configured");
  });

  it("returns the Lemon sandbox checkout URL only after the launch gate is enabled", async () => {
    process.env.APP_MODE = "live";
    process.env.PAYMENTS_ENABLED = "true";
    process.env.LEMON_SQUEEZY_CHECKOUT_URL = "https://lemon.test/checkout";
    const adapters = createVendorAdapters();
    await expect(adapters.commerce.createCheckout({ email: "buyer@example.com" })).resolves.toEqual({
      checkoutUrl: "https://lemon.test/checkout",
      orderId: "lemon-pending",
    });
  });

  it("posts structured OpenAI Responses payloads when a live key is present", async () => {
    process.env.APP_MODE = "live";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_MODEL_CHEAP = "gpt-4.1-mini";
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            consciousExplanationTags: ["stall"],
            unresolvedQuestions: [],
          }),
          usage: { input_tokens: 12, output_tokens: 8 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const adapters = createVendorAdapters();
    const result = await adapters.llm.completeStructured({
      stage: "pass1",
      input: { assessmentId: "a1" },
    });

    expect(result.output).toEqual({
      consciousExplanationTags: ["stall"],
      unresolvedQuestions: [],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.name).toBe("pass1");
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer sk-test" }),
    );
  });

  it("fails closed when live OpenAI returns malformed JSON", async () => {
    process.env.APP_MODE = "live";
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ output_text: "not-json" }), { status: 200 })),
    );
    const adapters = createVendorAdapters();
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow(/malformed|JSON/i);
  });
});
