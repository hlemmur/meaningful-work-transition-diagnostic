import "server-only";

import type { EmailAdapter, EmailMessage } from "../types";

export const liveEmailAdapter: EmailAdapter = {
  async send(message: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      throw new Error("Resend live adapter is not configured. Use APP_MODE=mock locally.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend request failed with status ${response.status}`);
    }
  },
  listOutbox() {
    return [];
  },
};
