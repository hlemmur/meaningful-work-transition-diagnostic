import { describe, expect, it } from "vitest";
import { createAnswerSaveQueue } from "./answer-save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("answer save queue", () => {
  it("does not let an earlier in-flight save overwrite a later answer", async () => {
    const first = deferred<void>();
    const beganFirst = deferred<void>();
    const writes: string[] = [];
    const queue = createAnswerSaveQueue(async (_id, value) => {
      if (writes.length === 0 && String(value) === "employed_considering") {
        beganFirst.resolve();
        await first.promise;
      }
      writes.push(String(value));
    });

    queue.queue("Q0.1", "employed_considering");
    const firstFlush = queue.flush();
    await beganFirst.promise;

    queue.queue("Q0.1", "unemployed");
    const secondFlush = queue.flush();

    first.resolve();
    await Promise.all([firstFlush, secondFlush]);

    expect(writes).toEqual(["employed_considering", "unemployed"]);
  });

  it("saves only the latest queued value when several updates land before flush", async () => {
    const writes: string[] = [];
    const queue = createAnswerSaveQueue(async (_id, value) => {
      writes.push(String(value));
    });

    queue.queue("Q1.1", "I left");
    queue.queue("Q1.1", "I left a career");
    queue.queue("Q1.1", "I left a career that still pays my bills.");
    await queue.flush();

    expect(writes).toEqual(["I left a career that still pays my bills."]);
  });

  it("returns false on failure and retries the same pending answer", async () => {
    let attempts = 0;
    const queue = createAnswerSaveQueue(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("network");
      }
    });

    queue.queue("Q0.4", 7);
    await expect(queue.flush()).resolves.toBe(false);
    await expect(queue.flush()).resolves.toBe(true);
    expect(attempts).toBe(2);
  });
});
