import { describe, expect, it } from "vitest";
import { isAllowlistedAdmin } from "./allowlist";

describe("admin allowlist", () => {
  it("accepts the default operator email", () => {
    delete process.env.ADMIN_EMAIL_ALLOWLIST;
    expect(isAllowlistedAdmin("lena@example.com")).toBe(true);
    expect(isAllowlistedAdmin("other@example.com")).toBe(false);
  });

  it("accepts a configured allowlist", () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "lena@example.com, ops@example.com";
    expect(isAllowlistedAdmin("ops@example.com")).toBe(true);
    delete process.env.ADMIN_EMAIL_ALLOWLIST;
  });
});
