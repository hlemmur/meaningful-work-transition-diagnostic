import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isMockMode } from "@/config/app-mode";
import { ADMIN_COOKIE } from "@/server/admin/allowlist";
import { isOperatorAuthed } from "@/server/admin/authz";
import { readLiveUserEmailFromRequest } from "@/server/admin/supabase-auth";

export type ProxyOptions = {
  liveUserEmail?: string | null;
};

export async function proxy(request: NextRequest, options: ProxyOptions = {}) {
  const { pathname } = request.nextUrl;
  const mockCookieEmail = request.cookies.get(ADMIN_COOKIE)?.value;
  let liveUserEmail = options.liveUserEmail ?? null;
  let response = NextResponse.next();

  if (!isMockMode() && options.liveUserEmail === undefined) {
    const live = await readLiveUserEmailFromRequest(request);
    liveUserEmail = live.email;
    response = live.response;
  }

  const authed = isOperatorAuthed({ mockCookieEmail, liveUserEmail });

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !authed) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  if (pathname === "/api/analysis" && !authed) {
    return NextResponse.json({ error: "Admin required" }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/analysis"],
};
