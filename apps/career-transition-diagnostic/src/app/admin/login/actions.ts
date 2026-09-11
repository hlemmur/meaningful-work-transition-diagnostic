"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startOperatorLogin } from "@/server/admin/session";

export async function loginAdminAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const origin = (await headers()).get("origin") ?? "";
  let result: { kind: "session" | "magic-link" };
  try {
    result = await startOperatorLogin(email, { origin });
  } catch {
    redirect("/admin/login?error=1");
  }
  if (result.kind === "magic-link") {
    redirect("/admin/login?sent=1");
  }
  redirect("/admin");
}
