# Meaningful Work Transition Diagnostic

Paid beta of a self-paced Jungian-informed career-transition diagnostic.

The application lives in [`apps/career-transition-diagnostic`](apps/career-transition-diagnostic). This repository is intentionally separate from the personal knowledge hub.

## Local development

1. Install [Bun](https://bun.sh).
2. Copy `apps/career-transition-diagnostic/.env.example` to `.env.local`.
3. Keep `APP_MODE=mock`.
4. From the app directory:

```bash
bun install
bun run test
bun run dev
```

The **MOCK MODE** badge must remain visible on customer and admin screens while Lemon Squeezy and Resend are mocked. Checkout and outbox never call those vendors in `APP_MODE=mock`. Optional live Gemini (`LLM_MODE=live`) does not change the badge.

Paid live checkout stays off (`PAYMENTS_ENABLED=false`) until the staging launch-gate checklist in [`apps/career-transition-diagnostic/README.md`](apps/career-transition-diagnostic/README.md) is green.

Optional local database:

```bash
cd apps/career-transition-diagnostic
supabase start
```

## Product constraints

- No MindStudio
- No customer accounts
- Lena reviews every report before delivery
- Service credentials stay server-side
