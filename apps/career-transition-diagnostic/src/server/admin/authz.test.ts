import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE } from "./allowlist";
import { operatorEmailForMode, sessionFromOperatorEmail } from "./authz";
import { startOperatorLogin, magicLinkRedirectTo } from "./session";
import { proxy } from "@/proxy";

const originalAppMode = process.env.APP_MODE;

afterEach(() => {
  if (originalAppMode === undefined) {
    delete process.env.APP_MODE;
  } else {
    process.env.APP_MODE = originalAppMode;
  }
  delete process.env.ADMIN_EMAIL_ALLOWLIST;
  delete process.env.APP_URL;
});

function adminRequest(cookieEmail?: string) {
  const headers = new Headers();
  if (cookieEmail) {
    headers.set("cookie", `${ADMIN_COOKIE}=${cookieEmail}`);
  }
  return new NextRequest("http://localhost/admin", { headers });
}

describe("operator session resolution", () => {
  it("accepts an allowlisted email and rejects everyone else", () => {
    expect(sessionFromOperatorEmail("lena@example.com")).toEqual({ email: "lena@example.com" });
    expect(sessionFromOperatorEmail("other@example.com")).toBeNull();
    expect(sessionFromOperatorEmail(undefined)).toBeNull();
  });

  it("uses the unsigned cookie only in mock mode", () => {
    process.env.APP_MODE = "mock";
    expect(
      operatorEmailForMode({
        mockCookieEmail: "lena@example.com",
        liveUserEmail: "ops@example.com",
      }),
    ).toBe("lena@example.com");

    process.env.APP_MODE = "live";
    expect(
      operatorEmailForMode({
        mockCookieEmail: "lena@example.com",
        liveUserEmail: "ops@example.com",
      }),
    ).toBe("ops@example.com");
  });
});

describe("startOperatorLogin", () => {
  it("starts a mock cookie session and never sends a magic link", async () => {
    process.env.APP_MODE = "mock";
    const startMockSession = vi.fn();
    const sendMagicLink = vi.fn();

    await expect(
      startOperatorLogin("lena@example.com", { startMockSession, sendMagicLink }),
    ).resolves.toEqual({ kind: "session" });
    expect(startMockSession).toHaveBeenCalledWith("lena@example.com");
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it("sends a magic link in live mode and never sets the mock cookie", async () => {
    process.env.APP_MODE = "live";
    const startMockSession = vi.fn();
    const sendMagicLink = vi.fn();

    await expect(
      startOperatorLogin("lena@example.com", {
        startMockSession,
        sendMagicLink,
        origin: "https://staging.example",
      }),
    ).resolves.toEqual({ kind: "magic-link" });
    expect(startMockSession).not.toHaveBeenCalled();
    expect(sendMagicLink).toHaveBeenCalledWith(
      "lena@example.com",
      "https://staging.example/auth/callback",
    );
  });

  it("rejects a non-allowlisted email before sending anything", async () => {
    process.env.APP_MODE = "live";
    const sendMagicLink = vi.fn();
    await expect(
      startOperatorLogin("stranger@example.com", { sendMagicLink, origin: "https://x.test" }),
    ).rejects.toThrow("Email is not allowlisted");
    expect(sendMagicLink).not.toHaveBeenCalled();
  });

  it("prefers APP_URL over Origin and refuses a relative callback", async () => {
    process.env.APP_MODE = "live";
    process.env.APP_URL = "https://app.example";
    const sendMagicLink = vi.fn();
    await startOperatorLogin("lena@example.com", {
      sendMagicLink,
      origin: "https://spoofed.example",
    });
    expect(sendMagicLink).toHaveBeenCalledWith(
      "lena@example.com",
      "https://app.example/auth/callback",
    );

    delete process.env.APP_URL;
    expect(() => magicLinkRedirectTo("")).toThrow(/APP_URL is required/);
    expect(() => magicLinkRedirectTo("/admin")).toThrow(/APP_URL is required/);
    await expect(
      startOperatorLogin("lena@example.com", { sendMagicLink: vi.fn(), origin: "" }),
    ).rejects.toThrow(/APP_URL is required/);
  });
});

describe("admin proxy", () => {
  it("allows the mock cookie only while APP_MODE is mock", async () => {
    process.env.APP_MODE = "mock";
    const allowed = await proxy(adminRequest("lena@example.com"));
    expect(allowed.headers.get("location")).toBeNull();

    process.env.APP_MODE = "live";
    const blocked = await proxy(adminRequest("lena@example.com"), { liveUserEmail: null });
    expect(blocked.headers.get("location")).toContain("/admin/login");
  });

  it("allows an allowlisted live Supabase user through /admin and /api/analysis", async () => {
    process.env.APP_MODE = "live";
    const admin = await proxy(adminRequest(), { liveUserEmail: "lena@example.com" });
    expect(admin.headers.get("location")).toBeNull();

    const analysis = await proxy(new NextRequest("http://localhost/api/analysis"), {
      liveUserEmail: "lena@example.com",
    });
    expect(analysis.status).not.toBe(401);

    const rejected = await proxy(adminRequest(), { liveUserEmail: "stranger@example.com" });
    expect(rejected.headers.get("location")).toContain("/admin/login");
  });
});
