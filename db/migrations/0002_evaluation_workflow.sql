-- Adds the human-in-the-loop evaluation/decision/email-approval workflow on top
-- of the existing schema. Additive only — nothing here drops or renames the
-- original applications/candidates/scores/drafts/emails_log tables, so the
-- original upload -> score -> draft -> send flow keeps working unchanged.

create type recommendation_type as enum ('strong_advance', 'advance', 'hold', 'do_not_advance');
create type confidence_level as enum ('high', 'medium', 'low');
create type review_status_type as enum ('pending_review', 'approved', 'overridden');
create type email_outcome_type as enum ('strong_advance', 'advance', 'hold', 'reject');
create type email_status_type as enum ('draft', 'approved', 'sent', 'failed');
create type reason_detail_type as enum ('none', 'brief', 'custom');

-- One row per evaluation run (re-evaluating a candidate adds a new row rather
-- than overwriting, so history is preserved). The application always reads
-- its most recent evaluation by created_at.
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  rubric_version text not null,
  candidate_summary jsonb not null,
  must_have_gates jsonb not null default '[]',
  gates_requiring_validation jsonb not null default '[]',
  strongest_matches jsonb not null default '[]',
  transferable_experience jsonb not null default '[]',
  material_gaps jsonb not null default '[]',
  risk_factors jsonb not null default '[]',
  internal_reasoning text not null,
  candidate_facing_reason text not null,
  recommended_role text,
  overall_score numeric not null,
  ai_recommendation recommendation_type not null,
  ai_confidence confidence_level not null,
  created_at timestamptz not null default now()
);
create index idx_evaluations_application_id on evaluations(application_id, created_at desc);

create table evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  criterion text not null,
  weight numeric not null,
  score integer not null check (score between 0 and 5),
  weighted_score numeric not null,
  evidence jsonb not null default '[]',
  missing_evidence jsonb not null default '[]',
  confidence confidence_level not null,
  interview_questions jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index idx_evaluation_criteria_evaluation_id on evaluation_criteria(evaluation_id);

-- Recruiter decision state lives on applications so the candidate queue can
-- filter/sort on it without joining evaluations every time.
alter table applications
  add column ai_recommendation recommendation_type,
  add column ai_confidence confidence_level,
  add column final_recommendation recommendation_type,
  add column recommendation_overridden boolean not null default false,
  add column review_status review_status_type not null default 'pending_review',
  add column reviewed_at timestamptz,
  add column reviewer text,
  add column email_status email_status_type not null default 'draft';

create index idx_applications_review_status on applications(review_status);
create index idx_applications_ai_recommendation on applications(ai_recommendation);
create index idx_applications_email_status on applications(email_status);

-- Extend drafts with the richer email-composer/approval fields. draft_type stays
-- as-is for the original flow; new code paths use email_outcome instead.
alter table drafts
  add column email_outcome email_outcome_type,
  add column recipient text,
  add column tone text not null default 'warm_professional',
  add column reason_detail_level reason_detail_type not null default 'brief',
  add column status email_status_type not null default 'draft',
  add column ai_generated boolean not null default true,
  add column recruiter_edited boolean not null default false,
  add column approved_at timestamptz;

-- Extend emails_log with Resend delivery tracking + idempotency.
alter table emails_log
  add column idempotency_key text,
  add column resend_message_id text,
  add column status text not null default 'sent',
  add column error_message text,
  add column is_test boolean not null default false;
create unique index idx_emails_log_idempotency_key on emails_log(idempotency_key) where idempotency_key is not null;

-- Audit timeline: one append-only row per lifecycle event.
create table decision_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_decision_events_application_id on decision_events(application_id, created_at asc);
