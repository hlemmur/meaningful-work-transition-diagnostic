import { isMockMode } from "@/config/app-mode";

export function MockModeBadge() {
  if (!isMockMode()) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="MOCK MODE"
      className="print:hidden fixed top-3 right-3 z-50 rounded-full bg-[#b65f3e] px-3 py-1 text-xs font-semibold tracking-wide text-white shadow"
    >
      MOCK MODE
    </div>
  );
}
