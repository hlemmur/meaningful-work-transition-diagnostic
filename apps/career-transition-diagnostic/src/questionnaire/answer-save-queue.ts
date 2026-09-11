export function createAnswerSaveQueue(
  save: (questionId: string, value: unknown) => Promise<void>,
) {
  let pending: { id: string; value: unknown } | null = null;
  let chain: Promise<boolean> = Promise.resolve(true);

  async function drain(): Promise<boolean> {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        await save(next.id, next.value);
      } catch {
        if (!pending) {
          pending = next;
        }
        return false;
      }
    }
    return true;
  }

  return {
    queue(id: string, value: unknown) {
      pending = { id, value };
    },
    hasPending() {
      return pending !== null;
    },
    flush(): Promise<boolean> {
      chain = chain.then(drain, drain);
      return chain;
    },
  };
}
