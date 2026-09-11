import { redirect } from "next/navigation";
import { sessionFromOperatorEmail } from "@/server/admin/authz";
import { exchangeMagicLinkCode, signOutLiveOperator } from "@/server/admin/supabase-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    redirect("/admin/login?error=1");
  }

  let email: string | null;
  try {
    email = await exchangeMagicLinkCode(code);
  } catch {
    redirect("/admin/login?error=1");
  }

  if (!sessionFromOperatorEmail(email)) {
    try {
      await signOutLiveOperator();
    } catch {
      // Ignore sign-out failures after a rejected login.
    }
    redirect("/admin/login?error=1");
  }

  redirect("/admin");
}
