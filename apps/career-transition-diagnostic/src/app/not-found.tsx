import { JournalShell } from "@/components/journal-shell";
import Link from "next/link";

export default function NotFound() {
  return (
    <JournalShell>
      <main className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">This link is not available</h1>
        <p className="leading-7 text-muted">
          The page may have expired, or this address was never a private assessment link. You can go
          home, or request a new link from an expired assessment page.
        </p>
        <Link className="w-fit text-sm underline" href="/">
          Home
        </Link>
      </main>
    </JournalShell>
  );
}
