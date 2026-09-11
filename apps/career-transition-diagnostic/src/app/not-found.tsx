import { JournalShell } from "@/components/journal-shell";

export default function NotFound() {
  return (
    <JournalShell>
      <main className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Not found</h1>
        <p className="leading-7 text-muted">This link is not available.</p>
      </main>
    </JournalShell>
  );
}
