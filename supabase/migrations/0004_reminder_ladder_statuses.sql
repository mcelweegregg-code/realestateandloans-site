-- Three-step reminder ladder: the cron now emails Gregg 3, 2, and 1 days
-- before scheduled_date, tracking progress via three new statuses.
--
-- Approach is additive: the legacy 'reminder_sent' value stays in the enum
-- (dropping an enum value requires rebuilding the type and every column
-- using it), but nothing writes it anymore. Existing rows are backfilled to
-- 'reminder_sent_1d' in 0005 — Postgres does not allow adding an enum value
-- and using it inside the same transaction, so the backfill is a separate
-- migration. Run this file first, then 0005.

alter type topic_status add value if not exists 'reminder_sent_3d';
alter type topic_status add value if not exists 'reminder_sent_2d';
alter type topic_status add value if not exists 'reminder_sent_1d';
