-- Meaningful Work Transition Diagnostic beta schema
-- Browser clients never receive service credentials; RLS stays locked for anon.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  lemon_order_id text not null unique,
  lemon_webhook_id text unique,
  email text not null,
  status text not null default 'paid',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_consents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  consented boolean not null default false,
  consent_copy_version text not null,
  source text not null,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  sync_status text not null default 'unsynced',
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.purchases (id),
  status text not null default 'created',
  access_token_hash text not null unique,
  access_expires_at timestamptz not null,
  progress jsonb not null default '{}'::jsonb,
  product_consent_version text,
  safety_level text not null default 'none',
  retention_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_id text not null,
  answer jsonb not null,
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_id)
);

create table if not exists public.adaptive_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  checkpoint text not null,
  origin_fork text not null,
  question_text text not null,
  answer jsonb,
  rationale text,
  created_at timestamptz not null default now()
);

create table if not exists public.case_state_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  stage text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  stage text not null,
  attempt integer not null default 1,
  prompt_version text,
  model text,
  status text not null,
  token_usage jsonb,
  cost_usd numeric,
  error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  generated_json jsonb,
  edited_content jsonb,
  status text not null default 'draft',
  access_token_hash text unique,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_flags (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  flag_type text not null,
  severity text not null,
  evidence_refs jsonb,
  handling_instruction text,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;
alter table public.marketing_consents enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.adaptive_questions enable row level security;
alter table public.case_state_versions enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.reports enable row level security;
alter table public.safety_flags enable row level security;
