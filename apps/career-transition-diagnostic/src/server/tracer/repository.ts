import { AsyncLocalStorage } from "node:async_hooks";
import { createEmptyTracerStore, type TracerStore } from "./records";
import { createEmptyTables, storeToTables, tablesToStore, type TracerTables } from "./mapper";
import { SupabaseTracerDb, createServiceRoleClient } from "./supabase";

export type TracerDb = {
  loadAll(): Promise<TracerTables>;
  replaceAll(tables: TracerTables): Promise<void>;
};

export type TracerRepository = {
  begin(): Promise<TracerStore>;
  commit(store: TracerStore): Promise<void>;
  reset(): Promise<void>;
};

export class MemoryTracerRepository implements TracerRepository {
  private readonly store: TracerStore;

  constructor(store: TracerStore = createEmptyTracerStore()) {
    this.store = store;
  }

  async begin() {
    return this.store;
  }

  async commit(_store: TracerStore) {
    return;
  }

  async reset() {
    this.store.assessments.length = 0;
    this.store.purchases.length = 0;
    this.store.marketingConsents.length = 0;
    this.store.adaptiveQuestions.length = 0;
    this.store.caseStateVersions.length = 0;
    this.store.safetyFlags.length = 0;
    this.store.analysisRuns.length = 0;
    this.store.reports.length = 0;
  }
}

export class TableTracerRepository implements TracerRepository {
  constructor(private readonly db: TracerDb) {}

  async begin() {
    return tablesToStore(await this.db.loadAll());
  }

  async commit(store: TracerStore) {
    await this.db.replaceAll(storeToTables(store));
  }

  async reset() {
    await this.db.replaceAll(createEmptyTables());
  }
}

export class MemoryTracerDb implements TracerDb {
  private tables: TracerTables = createEmptyTables();

  async loadAll() {
    return structuredClone(this.tables);
  }

  async replaceAll(tables: TracerTables) {
    this.tables = structuredClone(tables);
  }
}

const storeAls = new AsyncLocalStorage<TracerStore>();
let bound: TracerRepository | undefined;
let writeChain: Promise<void> = Promise.resolve();

function enqueueExclusiveWrite<T>(work: () => Promise<T>): Promise<T> {
  const run = writeChain.then(work, work);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function supabasePersistenceEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function bindTracerRepository(repository: TracerRepository) {
  bound = repository;
}

export function getRepository(): TracerRepository {
  if (!bound) {
    bound = supabasePersistenceEnabled()
      ? new TableTracerRepository(new SupabaseTracerDb(createServiceRoleClient()))
      : new MemoryTracerRepository();
  }
  return bound;
}

export function resetRepositoryBinding() {
  bound = undefined;
}

export function getActiveStore(): TracerStore {
  const store = storeAls.getStore();
  if (!store) {
    throw new Error("Tracer store is not active");
  }
  return store;
}

export async function withStore<T>(fn: () => T | Promise<T>): Promise<T> {
  const existing = storeAls.getStore();
  if (existing) {
    return fn();
  }
  return enqueueExclusiveWrite(async () => {
    const repository = getRepository();
    const store = await repository.begin();
    return storeAls.run(store, async () => {
      const result = await fn();
      await repository.commit(store);
      return result;
    });
  });
}
