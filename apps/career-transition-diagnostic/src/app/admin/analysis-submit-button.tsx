"use client";

import { useFormStatus } from "react-dom";

export function AnalysisSubmitButton({ resume }: { resume: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      aria-live="polite"
      className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Analysis running…" : resume ? "Resume analysis" : "Run analysis"}
    </button>
  );
}
