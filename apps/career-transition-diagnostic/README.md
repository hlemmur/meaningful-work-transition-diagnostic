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

`APP_MODE=mock` mocks **Lemon Squeezy and Resend**. The MOCK MODE badge is required on customer and admin screens in that mode.

`LLM_MODE` is independent. Leave it unset (or `mock`) so Vitest/CI use fixture LLM output and never hit the network. Set `LLM_MODE=live` with `GEMINI_API_KEY` to call Google AI Studio Gemini for analysis and checkpoints while checkout and outbox stay mocked.

Persistence is real whenever `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Vitest and CI stay on the in-memory store when those are unset. Table-backed commits still replace the full snapshot; `withStore` serializes those writes in-process so overlapping requests on one instance cannot drop each other's rows. Multi-instance writers are out of scope for this beta.

`APP_MODE=live` uses live Gemini (unless `LLM_MODE=mock`), Resend, and operator magic-link auth. Paid checkout stays off until the launch gate below is green (`PAYMENTS_ENABLED` remains `false` in `.env.example`).

## Environment

Copy `.env.example` to `.env.local`. Never prefix service credentials with `NEXT_PUBLIC_`. Never commit `.env.local`.

| Variable | Purpose |
| --- | --- |
| `APP_MODE` | `mock` or `live` (Lemon and Resend) |
| `LLM_MODE` | Unset/`mock` for fixtures; `live` for Gemini |
| `PAYMENTS_ENABLED` | Live Lemon checkout. Keep `false` until the staging checklist is green |
| `LEMON_SQUEEZY_CHECKOUT_URL` | Sandbox/live checkout URL. Ignored until payments are enabled |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | HMAC secret. Live webhooks send the digest in `x-signature` |
| `GEMINI_API_KEY` | Google AI Studio key. Fail closed if `LLM_MODE=live` and this is missing |
| `GEMINI_MODEL_CHEAP` / `GEMINI_MODEL_STRONG` | Live model ids. Default both `gemini-2.5-flash` |
| `RESEND_API_KEY` / `RESEND_FROM` | Transactional email. Bodies contain `/a/` or `/r/` links only |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Persistence + Auth magic links |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side assessment store. Never expose to the browser |
| `APP_URL` | Absolute site origin for live magic-link redirects (`https://staging.example`) |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated operator emails |
| `CRON_SECRET` | Bearer token for `GET /api/cron/retention` |
| `RETENTION_DAYS` | Default 90 |

Webhook endpoint: `POST /api/webhooks/lemon-squeezy` with header `x-signature`.

Operator sign-in: mock mode sets a local unsigned cookie. Live mode emails a Supabase magic link and completes at `/auth/callback`. Set `APP_URL` to the absolute origin and add `{APP_URL}/auth/callback` to the Supabase Auth redirect allowlist.

## Live Gemini with mock checkout

Keep payments mocked. Call real Gemini for analysis and checkpoints:

```bash
# .env.local (never committed)
APP_MODE=mock
LLM_MODE=live
GEMINI_API_KEY=          # AI Studio key
GEMINI_MODEL_CHEAP=gemini-2.5-flash
GEMINI_MODEL_STRONG=gemini-2.5-flash
```

```bash
bun run dev
```

1. Mock purchase on `/mock/checkout`.
2. Send the assessment to Lena; open `/mock/outbox`.
3. Sign in at `/admin` as `lena@example.com`.
4. **Run analysis** on the case. Checkpoints in the questionnaire also call Gemini.

The MOCK MODE badge still means Lemon and Resend are mocked.

## Launch gate

Paid live checkout stays off until `PAYMENTS_ENABLED=true` **and** `LEMON_SQUEEZY_CHECKOUT_URL` is set. Do not flip that switch in this repository until staging is green.

Staging checks:

1. Five benchmark fixtures remain structurally valid and fail banned patterns (confidence-only, “you are a Puer”, alignment-money). Local: `bun run test -- tests/eval.test.ts`. Re-run analysis on staging with live Gemini.
2. Lemon sandbox webhook replay to `/api/webhooks/lemon-squeezy` creates one assessment. An invalid `x-signature` returns 401.
3. Live Lemon, Gemini, and Resend adapters fail closed if credentials are removed. Covered by `src/server/adapters/adapters.test.ts`.
4. Manual delete from the review case and `GET /api/cron/retention` with `Authorization: Bearer $CRON_SECRET` purge answers and reports in Supabase.
5. Marketing export at `/admin/export` is operator-authed, excludes withdrawn consents, and contains no answers.
6. Customer surfaces load no third-party analytics pixels (`src/config/analytics.test.ts`).

Only after that checklist is green: set `PAYMENTS_ENABLED=true` and `LEMON_SQUEEZY_CHECKOUT_URL` on staging, then production.
