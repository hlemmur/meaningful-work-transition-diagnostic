import { loginAdminAction } from "./actions";
import { isMockMode } from "@/config/app-mode";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { error, sent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Operator sign in</h1>
      <p className="leading-7 text-[#4a3b34]">
        {isMockMode()
          ? "Allowlisted email only. This mock session is local and is not used in live mode."
          : "Allowlisted email only. We will email a magic link for this browser."}
      </p>
      {error ? (
        <p className="text-sm text-[#b65f3e]">That email is not on the operator allowlist.</p>
      ) : null}
      {sent ? (
        <p className="text-sm text-[#4a3b34]">Check your email for a sign-in link.</p>
      ) : null}
      <form action={loginAdminAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded border border-[#e6d8cc] bg-white px-3 py-2"
            name="email"
            type="email"
            defaultValue={isMockMode() ? "lena@example.com" : ""}
            required
          />
        </label>
        <button
          className="w-fit rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
          type="submit"
        >
          {isMockMode() ? "Sign in" : "Email me a magic link"}
        </button>
      </form>
    </main>
  );
}
