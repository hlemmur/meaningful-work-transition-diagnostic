import type { ReactNode } from "react";

type JournalShellProps = {
  children: ReactNode;
};

export function JournalShell({ children }: JournalShellProps) {
  return (
    <div data-shell="journal" className="flex min-h-full flex-1 flex-col bg-paper text-ink">
      <header className="mx-auto w-full max-w-2xl px-6 pt-16">
        <p className="text-sm uppercase tracking-[0.2em] text-terracotta">
          Radical Creation Coaching
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">{children}</div>
      <footer className="mx-auto w-full max-w-2xl px-6 pb-10">
        <a className="text-sm text-muted underline" href="/privacy">
          Privacy
        </a>
      </footer>
    </div>
  );
}
