import { afterEach, describe, expect, it } from "vitest";
import { isMockMode } from "@/config/app-mode";
import { isAllowlistedAdmin } from "./allowlist";
import { mockAdminSessionsEnabled } from "./authz";

const originalAppMode = process.env.APP_MODE;

afterEach(() => {
  if (originalAppMode === undefined) {
    delete process.env.APP_MODE;
  } else {
    process.env.APP_MODE = originalAppMode;
  }
  delete process.env.ADMIN_EMAIL_ALLOWLIST;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("admin allowlist", () => {
  it("accepts the default operator email", () => {
    delete process.env.ADMIN_EMAIL_ALLOWLIST;
    expect(isAllowlistedAdmin("lena@example.com")).toBe(true);
    expect(isAllowlistedAdmin("other@example.com")).toBe(false);
  });

  it("accepts a configured allowlist", () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "lena@example.com, ops@example.com";
    expect(isAllowlistedAdmin("ops@example.com")).toBe(true);
  });
});

describe("mock operator sessions", () => {
  it("are enabled only in mock mode without live persistence", () => {
    process.env.APP_MODE = "mock";
    expect(isMockMode()).toBe(true);
    expect(mockAdminSessionsEnabled()).toBe(true);
    process.env.APP_MODE = "live";
    expect(isMockMode()).toBe(false);
    expect(mockAdminSessionsEnabled()).toBe(false);
  });
});
