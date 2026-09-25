import { isLiveLlmMode, isMockMode } from "@/config/app-mode";

export function llmBadgeLabel(live: boolean) {
  return live ? "LIVE LLM" : "FIXTURE LLM";
}

export function MockModeBadge() {
  const live = isLiveLlmMode();
  const llmLabel = llmBadgeLabel(live);

  return (
    <div className="print:hidden fixed top-3 right-3 z-50 flex gap-2">
      {isMockMode() ? (
        <div
          role="status"
          aria-label="MOCK MODE"
          className="rounded-full bg-terracotta px-3 py-1 text-xs font-semibold tracking-wide text-paper shadow"
        >
          MOCK MODE
        </div>
      ) : null}
      <LlmBadge label={llmLabel} live={live} />
    </div>
  );
}

function LlmBadge({ label, live }: { label: string; live: boolean }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-paper shadow ${
        live ? "bg-ink" : "bg-terracotta/80"
      }`}
    >
      {label}
    </div>
  );
}
