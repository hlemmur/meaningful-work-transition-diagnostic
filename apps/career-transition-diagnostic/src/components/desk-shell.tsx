import Link from "next/link";
import type { ReactNode } from "react";

type DeskShellProps = {
  children: ReactNode;
};

export function DeskShell({ children }: DeskShellProps) {
  return (
    <div data-shell="desk" className="flex min-h-full flex-1 flex-col bg-paper text-ink">
      <header className="border-b border-hairline">
        <nav
          aria-label="Operator"
          className="mx-auto flex max-w-4xl gap-5 px-6 py-3 text-sm"
        >
          <Link className="underline" href="/admin">
            Queue
          </Link>
          <Link className="underline" href="/admin/export">
            Marketing export
          </Link>
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8">{children}</div>
    </div>
  );
}
