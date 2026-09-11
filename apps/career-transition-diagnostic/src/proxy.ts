import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isAllowlistedAdmin } from "@/server/admin/allowlist";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const email = request.cookies.get(ADMIN_COOKIE)?.value;
  const authed = Boolean(email && isAllowlistedAdmin(email));

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !authed) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    return NextResponse.redirect(login);
  }

  if (pathname === "/api/analysis" && !authed) {
    return NextResponse.json({ error: "Admin required" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/analysis"],
};
