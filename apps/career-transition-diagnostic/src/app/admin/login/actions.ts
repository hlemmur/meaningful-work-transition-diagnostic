"use server";

import { redirect } from "next/navigation";
import { startAdminSession } from "@/server/admin/session";

export async function loginAdminAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  try {
    await startAdminSession(email);
  } catch {
    redirect("/admin/login?error=1");
  }
  redirect("/admin");
}
