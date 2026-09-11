import { cookies } from "next/headers";
import { isMockMode } from "@/config/app-mode";
import { ADMIN_COOKIE, isAllowlistedAdmin } from "./allowlist";

export function mockAdminSessionsEnabled() {
  return isMockMode();
}

export async function getAdminSession() {
  if (!mockAdminSessionsEnabled()) {
    return null;
  }
  const email = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!email || !isAllowlistedAdmin(email)) {
    return null;
  }
  return { email };
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

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
