-- Kargo Hiring Dashboard schema for Neon Postgres.
-- Run this against your Neon database (SQL editor, psql, or a migration tool).
--
-- Access model: this app has no login. It connects directly to this database
-- with a service-level Postgres connection string (server-only secret, never
-- exposed to the browser). The Next.js dashboard itself is unauthenticated —
-- anyone who can reach the deployed URL can view/act on this data. Add real
-- auth before deploying anywhere public.

create extension if not exists "pgcrypto";

create type application_role as enum ('PM', 'SPM');
create type application_status as enum (
  'new',
  'processing',
  'scored',
  'invited',
  'rejected',
  'contacted',
  'no_response_yet'
);
create type score_band as enum ('Reject', 'Hold', 'Strong Pool');
create type draft_type as enum ('invite', 'hold', 'reject');
create type send_type as enum ('drafted', 'compose');

create table applications (
  id uuid primary key default gen_random_uuid(),
  candidate_name text,
  email text,
  phone text,
  role application_role not null,
  file_url text not null,
  file_name text not null,
  status application_status not null default 'new',
  weighted_total numeric,
  band score_band,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  extracted_json jsonb not null, -- anonymized structured CV data, no PII, sent to the LLM
  raw_text text not null,        -- full extracted text, server-side only, may contain PII
  created_at timestamptz not null default now()
);
create unique index idx_candidates_application_id on candidates(application_id);

create table scores (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  criterion text not null,
  weight numeric not null,
  score integer not null check (score between 0 and 5),
  evidence_text text not null,
  weighted_total numeric not null,
  band score_band not null,
  rationale_summary text not null,
  created_at timestamptz not null default now()
);
create index idx_scores_application_id on scores(application_id);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  brief_text text not null,
  email_subject text not null,
  email_body text not null,
  draft_type draft_type not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_drafts_application_id on drafts(application_id);

create table emails_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  recipient text not null,
  subject text not null,
  body text not null,
  send_type send_type not null,
  sent_at timestamptz not null default now()
);
create index idx_emails_log_application_id on emails_log(application_id);

create index idx_applications_role on applications(role);
create index idx_applications_band on applications(band);
create index idx_applications_status on applications(status);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applications_set_updated_at
before update on applications
for each row execute function set_updated_at();
