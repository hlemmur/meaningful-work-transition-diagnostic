import type { EmailAdapter, EmailMessage, OutboxEmail } from "../types";

const outbox: OutboxEmail[] = [];

export function resetMockOutbox() {
  outbox.length = 0;
}

export const mockEmailAdapter: EmailAdapter = {
  async send(message: EmailMessage) {
    outbox.push({
      ...message,
      sentAt: "2026-09-11T00:00:00.000Z",
    });
  },
  listOutbox() {
    return [...outbox];
  },
};
