import { afterEach, describe, expect, it, vi } from "vitest";
import { createVendorAdapters } from "./index";
import { resetMockOutbox } from "./resend/mock";

afterEach(() => {
  process.env.APP_MODE = "mock";
  delete process.env.LLM_MODE;
  delete process.env.PAYMENTS_ENABLED;
  delete process.env.LEMON_SQUEEZY_CHECKOUT_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL_CHEAP;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL_CHEAP;
  delete process.env.GEMINI_MODEL_STRONG;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  resetMockOutbox();
  vi.unstubAllGlobals();
});

describe("mock vendor adapters", () => {
  it("never calls fetch for Lemon Squeezy, the LLM, or Resend", async () => {
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

  it("keeps Lemon and Resend mocked when LLM_MODE is live without a Gemini key", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const adapters = createVendorAdapters();

    await expect(adapters.commerce.createCheckout({ email: "buyer@example.com" })).resolves.toEqual({
      checkoutUrl: "/mock/checkout",
      orderId: "mock-order-1",
    });
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow("Gemini live adapter is not configured");
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

  it("fails closed for live Lemon, Gemini, and Resend until the launch gate and credentials exist", async () => {
    process.env.APP_MODE = "live";
    delete process.env.PAYMENTS_ENABLED;
    delete process.env.LEMON_SQUEEZY_CHECKOUT_URL;
    const adapters = createVendorAdapters();

    await expect(adapters.commerce.createCheckout({ email: "buyer@example.com" })).rejects.toThrow(
      "Paid checkout is disabled until the launch gate is green.",
    );
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow("Gemini live adapter is not configured");
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

  it("posts generateContent payloads when LLM_MODE is live and a Gemini key is present", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.GEMINI_MODEL_CHEAP = "gemini-2.5-flash";
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      consciousExplanationTags: ["stall"],
                      unresolvedQuestions: [],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8 },
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
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(init.headers).toEqual(
      expect.objectContaining({ "x-goog-api-key": "gemini-test" }),
    );
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.type).toBe("object");
    expect(body.generationConfig.responseSchema.additionalProperties).toBeUndefined();
    expect(body.generationConfig.responseSchema.$defs).toBeUndefined();
    expect(body.contents[0].parts[0].text).toContain("a1");
  });

  it("coerces live Gemini numeric strings and null arrays before returning", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          consciousExplanationTags: ["stall"],
                          unresolvedQuestions: null,
                          scoring: { evidenceCoverage: "0.4" },
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const adapters = createVendorAdapters();
    const result = await adapters.llm.completeStructured({
      stage: "pass1",
      input: { assessmentId: "a1" },
    });
    expect(result.output.unresolvedQuestions).toEqual([]);
    expect(result.output.scoring).toEqual({ evidenceCoverage: 0.4 });
  });

  it("requests nullable Pass 5 projection fields and omits an all-null interpretation", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                projectionInterpretations: [{
                  projectionEvidenceRefs: ["a1:Q5.1"],
                  possibleDisownedValue: null,
                  literalEnactmentRisk: null,
                  matureExpression: null,
                }],
              }),
            }],
          },
        }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const adapters = createVendorAdapters();
    const result = await adapters.llm.completeStructured({
      stage: "pass5",
      input: { assessmentId: "a1" },
    });

    expect(result.output.projectionInterpretations).toEqual([]);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const item = body.generationConfig.responseSchema.properties.projectionInterpretations.items;
    expect(item.required).toEqual([
      "projectionEvidenceRefs",
      "possibleDisownedValue",
      "literalEnactmentRisk",
      "matureExpression",
    ]);
    expect(item.properties.matureExpression.nullable).toBe(true);
  });

  it("requests a nullable Pass 8 manipulated variable and omits null from imaginal output", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                experiments: [{
                  kind: "imaginal",
                  manipulatedVariable: null,
                }],
              }),
            }],
          },
        }],
      }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const adapters = createVendorAdapters();
    const result = await adapters.llm.completeStructured({
      stage: "pass8",
      input: { assessmentId: "a1" },
    });

    expect(result.output.experiments).toEqual([{ kind: "imaginal" }]);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const item = body.generationConfig.responseSchema.properties.experiments.items;
    expect(item.required).toContain("strategy");
    expect(item.required).toContain("learningAim");
    expect(item.required).not.toContain("manipulatedVariable");
    if (item.properties.manipulatedVariable) {
      expect(item.properties.manipulatedVariable.nullable).toBe(true);
    }
  });

  it("ignores leftover OpenAI model ids and still posts to Gemini", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    process.env.OPENAI_MODEL_CHEAP = "gpt-4.1-mini";
    delete process.env.GEMINI_MODEL_CHEAP;
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      consciousExplanationTags: ["stall"],
                      unresolvedQuestions: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const adapters = createVendorAdapters();
    await adapters.llm.completeStructured({
      stage: "pass1",
      input: { assessmentId: "a1" },
      model: "gpt-4.1-mini",
    });

    const [url] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
  });

  it("reports Gemini HTTP status when a key is set and generateContent fails", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "INVALID_ARGUMENT: response schema" } }), {
            status: 400,
          }),
      ),
    );
    const adapters = createVendorAdapters();
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow(/Gemini HTTP 400[\s\S]*INVALID_ARGUMENT/i);
  });

  it("fails closed when live Gemini returns malformed JSON", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }),
            { status: 200 },
          ),
      ),
    );
    const adapters = createVendorAdapters();
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow(/malformed|JSON/i);
  });

  it("fails closed when live Gemini returns empty candidates", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })),
    );
    const adapters = createVendorAdapters();
    await expect(
      adapters.llm.completeStructured({ stage: "pass1", input: { assessmentId: "a1" } }),
    ).rejects.toThrow(/empty/i);
  });

  it("sanitizes a nested pass schema so Gemini does not receive additionalProperties or null unions", async () => {
    process.env.APP_MODE = "mock";
    process.env.LLM_MODE = "live";
    process.env.GEMINI_API_KEY = "gemini-test";
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ hiddenPosition: null, alternative: "rest" }) }],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);
    const adapters = createVendorAdapters();
    await adapters.llm.completeStructured({
      stage: "pass6",
      input: { assessmentId: "a1" },
    });
    const body = JSON.parse(String((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const schema = body.generationConfig.responseSchema as Record<string, unknown>;
    expect(JSON.stringify(schema)).not.toContain("additionalProperties");
    expect(JSON.stringify(schema)).not.toContain("$defs");
    expect(schema.properties).toEqual(
      expect.objectContaining({
        hiddenPosition: expect.objectContaining({
          type: "object",
          nullable: true,
        }),
      }),
    );
  });

  it("posts Resend payloads in live mode and does not require a mock outbox", async () => {
    process.env.APP_MODE = "live";
    process.env.RESEND_API_KEY = "re-test";
    process.env.RESEND_FROM = "Lena <reports@example.com>";
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const adapters = createVendorAdapters();

    await adapters.email.send({
      to: "buyer@example.com",
      subject: "Your assessment link",
      text: "Open your assessment: /a/token",
    });

    expect(adapters.email.listOutbox()).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Lena <reports@example.com>",
      to: ["buyer@example.com"],
      subject: "Your assessment link",
      text: "Open your assessment: /a/token",
    });
  });
});
