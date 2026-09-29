-- Must run standalone (not batched with statements that USE these new values) —
-- Postgres disallows using a newly-added enum value inside the same implicit
-- transaction that added it.
alter type application_status add value if not exists 'evaluation_failed';
alter type email_status_type add value if not exists 'not_generated';
alter type email_status_type add value if not exists 'draft_generated';
alter type email_status_type add value if not exists 'edited';
alter type email_status_type add value if not exists 'ready_for_review';
alter type email_status_type add value if not exists 'sent_in_test_mode';
