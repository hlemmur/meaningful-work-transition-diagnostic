# Career Transition Diagnostic

Next.js App Router application for the Meaningful Work Transition Diagnostic paid beta.

```bash
cp .env.example .env.local
bun install
bun run test
bun run test:e2e
bun run dev
```

`APP_MODE=mock` keeps Lemon Squeezy, OpenAI, and Resend on deterministic adapters. The MOCK MODE badge is required on customer and admin screens.

## Launch gate

Paid live checkout stays off until `PAYMENTS_ENABLED=true` and a Lemon Squeezy checkout URL is set. Staging checks that must pass before that switch:

1. Five benchmark fixtures produce structurally valid reports and fail the banned patterns (confidence-only, “you are a Puer”, alignment-money).
2. Webhook replay creates one assessment; invalid signatures are rejected.
3. Live Lemon / OpenAI / Resend adapters fail closed without credentials.
4. Manual delete and the daily `/api/cron/retention` purge remove answers and reports. Authorize the cron with `CRON_SECRET`.
5. Marketing export excludes withdrawn consents and never includes answers.
6. Customer surfaces load no third-party analytics.
