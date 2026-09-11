# Career Transition Diagnostic

Next.js App Router application for the Meaningful Work Transition Diagnostic paid beta.

```bash
cp .env.example .env.local
bun install
bun run test
bun run test:e2e
bun run dev
```

## Modes

`APP_MODE=mock` mocks **vendors only** (Lemon Squeezy, OpenAI, Resend). The MOCK MODE badge is required on customer and admin screens in that mode.

Persistence is real whenever `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Vitest and CI stay on the in-memory store when those are unset.

`APP_MODE=live` uses live OpenAI, Resend, and operator magic-link auth. Paid checkout stays off until the launch gate below is green (`PAYMENTS_ENABLED` remains `false` in `.env.example`).

## Environment

Copy `.env.example` to `.env.local`. Never prefix service credentials with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `APP_MODE` | `mock` or `live` |
| `PAYMENTS_ENABLED` | Live Lemon checkout. Keep `false` until the staging checklist is green |
| `LEMON_SQUEEZY_CHECKOUT_URL` | Sandbox/live checkout URL. Ignored until payments are enabled |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | HMAC secret. Live webhooks send the digest in `x-signature` |
| `OPENAI_API_KEY` | Live Responses API. Fail closed if missing |
| `OPENAI_MODEL_CHEAP` / `OPENAI_MODEL_STRONG` | Live model ids. Do not use `mock-*` in live |
| `RESEND_API_KEY` / `RESEND_FROM` | Transactional email. Bodies contain `/a/` or `/r/` links only |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Persistence + Auth magic links |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side assessment store. Never expose to the browser |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated operator emails |
| `CRON_SECRET` | Bearer token for `GET /api/cron/retention` |
| `RETENTION_DAYS` | Default 90 |

Webhook endpoint: `POST /api/webhooks/lemon-squeezy` with header `x-signature`.

Operator sign-in: mock mode sets a local unsigned cookie. Live mode emails a Supabase magic link and completes at `/auth/callback`. Add that callback URL to the Supabase Auth redirect allowlist.

## Launch gate

Paid live checkout stays off until `PAYMENTS_ENABLED=true` **and** `LEMON_SQUEEZY_CHECKOUT_URL` is set. Do not flip that switch in this repository until staging is green.

Staging checks:

1. Five benchmark fixtures remain structurally valid and fail banned patterns (confidence-only, “you are a Puer”, alignment-money). Local: `bun run test -- tests/eval.test.ts`. Re-run analysis on staging with live OpenAI.
2. Lemon sandbox webhook replay to `/api/webhooks/lemon-squeezy` creates one assessment. An invalid `x-signature` returns 401.
3. Live Lemon, OpenAI, and Resend adapters fail closed if credentials are removed. Covered by `src/server/adapters/adapters.test.ts`.
4. Manual delete from the review case and `GET /api/cron/retention` with `Authorization: Bearer $CRON_SECRET` purge answers and reports in Supabase.
5. Marketing export at `/admin/export` is operator-authed, excludes withdrawn consents, and contains no answers.
6. Customer surfaces load no third-party analytics pixels (`src/config/analytics.test.ts`).

Only after that checklist is green: set `PAYMENTS_ENABLED=true` and `LEMON_SQUEEZY_CHECKOUT_URL` on staging, then production.
