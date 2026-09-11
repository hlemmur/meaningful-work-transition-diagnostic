import { isMockMode } from "@/config/app-mode";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LinkRequestedPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="leading-7 text-[#4a3b34]">
        If this link belongs to a purchase, a new private assessment link is on the way. This
        does not sign you up for marketing.
      </p>
      {isMockMode() ? (
        <p>
          In mock mode the message is in the{" "}
          <Link className="underline" href="/mock/outbox">
            outbox
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
