const COOKIE = "mwtd_admin";

export function adminAllowlist() {
  return (process.env.ADMIN_EMAIL_ALLOWLIST ?? "lena@example.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedAdmin(email: string) {
  return adminAllowlist().includes(email.trim().toLowerCase());
}

export const ADMIN_COOKIE = COOKIE;
