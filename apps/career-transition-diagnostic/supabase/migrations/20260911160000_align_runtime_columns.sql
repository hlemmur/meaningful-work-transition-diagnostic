-- Align runtime assessment fields with Postgres.
-- Service-role access only; RLS stays locked for anon.

alter table public.assessments
  add column if not exists email text,
  add column if not exists product_consented_at timestamptz,
  add column if not exists report_depth text not null default 'full',
  add column if not exists report_access_token_hash text,
  add column if not exists report_access_expires_at timestamptz;

alter table public.assessments
  alter column status set default 'in_progress';

alter table public.analysis_runs
  add column if not exists output jsonb;

alter table public.adaptive_questions
  add column if not exists question_id text;

alter table public.marketing_consents
  add constraint marketing_consents_email_key unique (email);
