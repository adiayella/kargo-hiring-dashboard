-- Test-mode email delivery tracking + hold-email subtype + safe defaults.
alter table applications alter column email_status set default 'not_generated';

alter table drafts add column if not exists hold_subtype text; -- 'request_info' | 'neutral_update'

alter table emails_log add column if not exists delivery_mode text not null default 'test';
alter table emails_log add column if not exists intended_recipient text; -- candidate's real email, kept for audit even though actual delivery went elsewhere in test mode
