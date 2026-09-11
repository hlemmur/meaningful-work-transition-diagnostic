import { isMockMode } from "@/config/app-mode";
import { JournalShell } from "@/components/journal-shell";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LinkRequestedPage() {
  return (
    <JournalShell>
      <main className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Check your email</h1>
        <p className="leading-7 text-muted">
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
    </JournalShell>
  );
}
