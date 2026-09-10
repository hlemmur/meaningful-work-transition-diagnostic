export const ADAPTIVE_PREFERRED_MAX = 4;
export const ADAPTIVE_HARD_CAP = 6;
export const ADAPTIVE_MAX_PER_FORK = 2;

export type AdaptiveCheckpoint = "A" | "B" | "C" | "D";

export type AdaptiveItem = {
  checkpoint: AdaptiveCheckpoint;
  forkId: string;
};

export type AdaptiveValidation = {
  ok: boolean;
  reason?: string;
};

export function validateAdaptivePlan(items: AdaptiveItem[]): AdaptiveValidation {
  if (items.length > ADAPTIVE_HARD_CAP) {
    return { ok: false, reason: `hard cap ${ADAPTIVE_HARD_CAP}` };
  }

  const perFork = new Map<string, number>();
  for (const item of items) {
    const count = (perFork.get(item.forkId) ?? 0) + 1;
    if (count > ADAPTIVE_MAX_PER_FORK) {
      return { ok: false, reason: `max ${ADAPTIVE_MAX_PER_FORK} adaptive questions per fork` };
    }
    perFork.set(item.forkId, count);
  }

  if (items.length > ADAPTIVE_PREFERRED_MAX) {
    return { ok: false, reason: `preferred max ${ADAPTIVE_PREFERRED_MAX}` };
  }

  return { ok: true };
}
