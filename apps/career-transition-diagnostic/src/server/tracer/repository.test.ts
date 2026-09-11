import { afterEach, describe, expect, it } from "vitest";
import {
  MemoryTracerDb,
  MemoryTracerRepository,
  TableTracerRepository,
  bindTracerRepository,
  getActiveStore,
  resetRepositoryBinding,
  supabasePersistenceEnabled,
  withStore,
} from "./repository";
import { createEmptyTracerStore } from "./records";
import {
  completePaidOrder,
  getAssessmentByAccessToken,
  recordWelcomeConsent,
  resetMockTracerStore,
  saveAnswer,
} from "./service";

afterEach(async () => {
  process.env.APP_MODE = "mock";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetRepositoryBinding();
  await resetMockTracerStore();
});

describe("tracer repository", () => {
  it("does not enable supabase persistence without service-role credentials", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(supabasePersistenceEnabled()).toBe(false);
  });

  it("keeps independent memory repositories isolated", async () => {
    const first = new MemoryTracerRepository();
    const second = new MemoryTracerRepository();
    const store = await first.begin();
    store.assessments.push({
      id: "a1",
      email: "buyer@example.com",
      accessTokenHash: "hash",
      accessExpiresAt: Date.now() + 60_000,
      status: "in_progress",
      answers: { "Q1.1": "kept" },
    });
    await first.commit(store);

    expect((await second.begin()).assessments).toEqual([]);
    expect((await first.begin()).assessments[0]?.answers["Q1.1"]).toBe("kept");
  });

  it("reloads a saved answer from a fresh table repository against the same database", async () => {
    const db = new MemoryTracerDb();
    const writer = new TableTracerRepository(db);
    const store = createEmptyTracerStore();
    store.purchases.push({
      id: "p1",
      lemonOrderId: "order-1",
      lemonWebhookId: "wh-1",
      email: "buyer@example.com",
      assessmentId: "a1",
    });
    store.assessments.push({
      id: "a1",
      email: "buyer@example.com",
      accessTokenHash: "hash",
      accessExpiresAt: Date.now() + 60_000,
      status: "in_progress",
      answers: { "Q1.1": "structure is the issue" },
      productConsentVersion: "product-consent.v1",
    });
    await writer.commit(store);

    const reader = new TableTracerRepository(db);
    const reloaded = await reader.begin();
    expect(reloaded.assessments[0]?.answers["Q1.1"]).toBe("structure is the issue");
    expect(reloaded.purchases[0]?.assessmentId).toBe("a1");
  });

  it("keeps a paid assessment answer after binding a fresh repository to the same database", async () => {
    const db = new MemoryTracerDb();
    bindTracerRepository(new TableTracerRepository(db));

    const paid = await completePaidOrder({
      email: "buyer@example.com",
      lemonOrderId: "order-reload",
      lemonWebhookId: "wh-reload",
    });
    await recordWelcomeConsent({
      accessToken: paid.accessToken as string,
      productConsent: true,
      marketingOptIn: false,
    });
    await saveAnswer(paid.accessToken as string, "Q1.1", "I already know the work");

    bindTracerRepository(new TableTracerRepository(db));
    const reloaded = await getAssessmentByAccessToken(paid.accessToken as string);
    expect(reloaded?.answers["Q1.1"]).toBe("I already know the work");
    expect(reloaded?.email).toBe("buyer@example.com");
  });

  it("serializes overlapping table-backed writes so later commits keep earlier rows", async () => {
    const db = new MemoryTracerDb();
    bindTracerRepository(new TableTracerRepository(db));

    let releaseFirst!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstHasStore!: () => void;
    const firstReady = new Promise<void>((resolve) => {
      firstHasStore = resolve;
    });

    const first = withStore(async () => {
      getActiveStore().assessments.push({
        id: "a1",
        email: "one@example.com",
        accessTokenHash: "hash-a1",
        accessExpiresAt: Date.now() + 60_000,
        status: "in_progress",
        answers: {},
      });
      firstHasStore();
      await holdFirst;
    });

    await firstReady;
    const second = withStore(async () => {
      getActiveStore().assessments.push({
        id: "a2",
        email: "two@example.com",
        accessTokenHash: "hash-a2",
        accessExpiresAt: Date.now() + 60_000,
        status: "in_progress",
        answers: {},
      });
    });
    releaseFirst();
    await Promise.all([first, second]);

    const reloaded = await new TableTracerRepository(db).begin();
    expect(reloaded.assessments.map((item) => item.id).sort()).toEqual(["a1", "a2"]);
  });
});
