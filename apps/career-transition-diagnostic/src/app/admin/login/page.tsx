import { loginAdminAction } from "./actions";
import { mockAdminSessionsEnabled } from "@/server/admin/authz";
import { LoginEmailField } from "./login-email-field";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const { error, sent } = await searchParams;
  const mock = mockAdminSessionsEnabled();
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Operator sign in</h1>
      <p className="leading-7 text-muted">
        {mock
          ? "Allowlisted email only. This mock session is local and is not used in live mode."
          : "Allowlisted email only. We will email a magic link for this browser."}
      </p>
      {error ? (
        <p className="text-sm text-terracotta">That email is not on the operator allowlist.</p>
      ) : null}
      {sent ? (
        <p className="text-sm text-muted">Check your email for a sign-in link.</p>
      ) : null}
      <form action={loginAdminAction} className="flex flex-col gap-3">
        <LoginEmailField />
        <button
          className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
          type="submit"
        >
          {mock ? "Sign in" : "Email me a magic link"}
        </button>
      </form>
    </main>
  );
}
