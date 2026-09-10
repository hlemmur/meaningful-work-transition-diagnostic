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

The **MOCK MODE** badge must remain visible on customer and admin screens while adapters are mocked. Lemon Squeezy, OpenAI, and Resend are never called in mock mode.

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
