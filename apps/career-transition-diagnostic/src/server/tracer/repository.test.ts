import { afterEach, describe, expect, it } from "vitest";
import {
  MemoryTracerDb,
  MemoryTracerRepository,
  TableTracerRepository,
  bindTracerRepository,
  getActiveStore,
  getRepository,
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

  it("reuses one repository instance on globalThis across getRepository calls", () => {
    const created = getRepository();
    expect(getRepository()).toBe(created);
  });

  it("does not rewrite tables for a read-only withStore", async () => {
    const db = new MemoryTracerDb();
    let replaces = 0;
    const counting = {
      loadAll: () => db.loadAll(),
      async replaceAll(tables: Awaited<ReturnType<MemoryTracerDb["loadAll"]>>) {
        replaces += 1;
        await db.replaceAll(tables);
      },
    };
    bindTracerRepository(new TableTracerRepository(counting));
    await withStore(() => getActiveStore().assessments.length);
    expect(replaces).toBe(0);
  });

  it("does not rewrite populated tables for a read-only withStore", async () => {
    const db = new MemoryTracerDb();
    const writer = new TableTracerRepository(db);
    const seeded = createEmptyTracerStore();
    seeded.purchases.push({
      id: "p1",
      lemonOrderId: "order-1",
      lemonWebhookId: "wh-1",
      email: "buyer@example.com",
      assessmentId: "a1",
    });
    seeded.assessments.push({
      id: "a1",
      email: "buyer@example.com",
      accessTokenHash: "hash",
      accessExpiresAt: Date.now() + 60_000,
      status: "in_progress",
      answers: { "Q1.1": "customer secret" },
      productConsentVersion: "product-consent.v1",
    });
    await writer.commit(seeded);

    let replaces = 0;
    const counting = {
      loadAll: () => db.loadAll(),
      async replaceAll(tables: Awaited<ReturnType<MemoryTracerDb["loadAll"]>>) {
        replaces += 1;
        await db.replaceAll(tables);
      },
    };
    bindTracerRepository(new TableTracerRepository(counting));
    const answer = await withStore(() => getActiveStore().assessments[0]?.answers["Q1.1"]);
    expect(answer).toBe("customer secret");
    expect(replaces).toBe(0);

    const reloaded = await new TableTracerRepository(db).begin();
    expect(reloaded.assessments[0]?.answers["Q1.1"]).toBe("customer secret");
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

  it("commits a retried failure without wiping other rows when idempotency keys collide", async () => {
    const seenKeys: string[] = [];
    const db = {
      async loadAll() {
        return (await new MemoryTracerDb().loadAll());
      },
      async replaceAll(tables: Awaited<ReturnType<MemoryTracerDb["loadAll"]>>) {
        const keys = tables.analysis_runs.map((row) => String(row.idempotency_key));
        seenKeys.push(...keys);
        if (new Set(keys).size !== keys.length) {
          throw new Error(
            'duplicate key value violates unique constraint "analysis_runs_idempotency_key_key"',
          );
        }
        await new MemoryTracerDb().replaceAll(tables);
      },
    };
    const writer = new TableTracerRepository(db);
    const store = createEmptyTracerStore();
    store.assessments.push({
      id: "a1",
      email: "buyer@example.com",
      accessTokenHash: "hash",
      accessExpiresAt: Date.now() + 60_000,
      status: "review_pending",
      answers: { "Q1.1": "I stall" },
    });
    store.analysisRuns.push(
      {
        assessmentId: "a1",
        stage: "pass3",
        attempt: 1,
        promptVersion: "pass-3",
        model: "mock",
        status: "failure",
        error: "first",
        idempotencyKey: "a1:pass3:failure",
        createdAt: "2026-09-24T00:00:00.000Z",
      },
      {
        assessmentId: "a1",
        stage: "pass3",
        attempt: 2,
        promptVersion: "pass-3",
        model: "mock",
        status: "failure",
        error: "second",
        idempotencyKey: "a1:pass3:failure",
        createdAt: "2026-09-24T00:01:00.000Z",
      },
    );

    await expect(writer.commit(store)).resolves.toBeUndefined();
    expect(seenKeys).toEqual(["a1:pass3:failure"]);
  });
});
