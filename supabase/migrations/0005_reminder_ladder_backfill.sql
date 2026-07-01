-- Backfill for 0004: topics sitting at the legacy 'reminder_sent' status
-- already received the old "goes out tomorrow" email, which corresponds to
-- the final rung of the new ladder — map them to 'reminder_sent_1d' so they
-- get no duplicate reminders. Must run in a separate transaction from 0004
-- (new enum values are unusable until the adding transaction commits).

update topics set status = 'reminder_sent_1d' where status = 'reminder_sent';
