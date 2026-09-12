import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAllowlistedAdmin } from "./allowlist";
import { mockAdminSessionsEnabled, sessionFromOperatorEmail } from "./authz";
import { readLiveUserEmail, sendOperatorMagicLink, signOutLiveOperator } from "./supabase-auth";

export { mockAdminSessionsEnabled };

export async function getAdminSession() {
  if (mockAdminSessionsEnabled()) {
    const email = (await cookies()).get(ADMIN_COOKIE)?.value;
    return sessionFromOperatorEmail(email);
  }
  return sessionFromOperatorEmail(await readLiveUserEmail());
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Admin required");
  }
  return session;
}

export async function startAdminSession(email: string) {
  if (!mockAdminSessionsEnabled()) {
    throw new Error("Mock operator sessions are disabled");
  }
  if (!isAllowlistedAdmin(email)) {
    throw new Error("Email is not allowlisted");
  }
  (await cookies()).set(ADMIN_COOKIE, email.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export type OperatorLoginDeps = {
  startMockSession?: (email: string) => Promise<void>;
  sendMagicLink?: (email: string, redirectTo: string) => Promise<void>;
  origin?: string;
};

export async function startOperatorLogin(email: string, deps: OperatorLoginDeps = {}) {
  const normalized = email.trim().toLowerCase();
  if (!isAllowlistedAdmin(normalized)) {
    throw new Error("Email is not allowlisted");
  }
  if (mockAdminSessionsEnabled()) {
    await (deps.startMockSession ?? startAdminSession)(normalized);
    return { kind: "session" as const };
  }
  const origin = deps.origin ?? "";
  await (deps.sendMagicLink ?? sendOperatorMagicLink)(
    normalized,
    magicLinkRedirectTo(origin),
  );
  return { kind: "magic-link" as const };
}

export function magicLinkRedirectTo(origin?: string) {
  const base = (process.env.APP_URL || origin || "").trim().replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL("/auth/callback", `${base}/`);
  } catch {
    throw new Error("APP_URL is required for live operator magic links");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL is required for live operator magic links");
  }
  return url.toString();
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
  if (!mockAdminSessionsEnabled()) {
    try {
      await signOutLiveOperator();
    } catch {
      // Live sign-out is best-effort when auth is not configured.
    }
  }
}
