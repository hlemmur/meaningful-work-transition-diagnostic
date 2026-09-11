import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAllowlistedAdmin } from "./allowlist";

export async function getAdminSession() {
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
