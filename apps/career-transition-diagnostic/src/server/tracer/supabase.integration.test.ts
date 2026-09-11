import { describe, expect, it } from "vitest";
import { createEmptyTables } from "./mapper";
import { supabasePersistenceEnabled } from "./repository";

describe("supabase persistence integration", () => {
  it("is skipped until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set", async () => {
    if (!supabasePersistenceEnabled()) {
      expect(createEmptyTables().assessments).toEqual([]);
      return;
    }

    const { createServiceRoleClient, SupabaseTracerDb } = await import("./supabase");
    const { TableTracerRepository } = await import("./repository");
    const {
      completePaidOrder,
      getAssessmentByAccessToken,
      recordWelcomeConsent,
      saveAnswer,
    } = await import("./service");
    const { bindTracerRepository, resetRepositoryBinding } = await import("./repository");

    const makeRepo = () =>
      new TableTracerRepository(new SupabaseTracerDb(createServiceRoleClient()));
    bindTracerRepository(makeRepo());
    const paid = await completePaidOrder({
      email: "buyer@example.com",
      lemonOrderId: `order-${Date.now()}`,
      lemonWebhookId: `wh-${Date.now()}`,
    });
    await recordWelcomeConsent({
      accessToken: paid.accessToken as string,
      productConsent: true,
      marketingOptIn: false,
    });
    await saveAnswer(paid.accessToken as string, "Q1.1", "I already know the work");

    bindTracerRepository(makeRepo());
    const reloaded = await getAssessmentByAccessToken(paid.accessToken as string);
    expect(reloaded?.answers["Q1.1"]).toBe("I already know the work");
    resetRepositoryBinding();
  });
});
