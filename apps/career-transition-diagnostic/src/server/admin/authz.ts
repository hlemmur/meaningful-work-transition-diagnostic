import { isMockMode, supabasePersistenceEnabled } from "@/config/app-mode";
import { isAllowlistedAdmin } from "./allowlist";

export function mockAdminSessionsEnabled() {
  return isMockMode() && !supabasePersistenceEnabled();
}

export function sessionFromOperatorEmail(email: string | undefined | null) {
  if (!email || !isAllowlistedAdmin(email)) {
    return null;
  }
  return { email: email.trim().toLowerCase() };
}

export function operatorEmailForMode(input: {
  mockCookieEmail?: string;
  liveUserEmail?: string | null;
}) {
  return mockAdminSessionsEnabled() ? input.mockCookieEmail : input.liveUserEmail;
}

export function isOperatorAuthed(input: {
  mockCookieEmail?: string;
  liveUserEmail?: string | null;
}) {
  return Boolean(sessionFromOperatorEmail(operatorEmailForMode(input)));
}
