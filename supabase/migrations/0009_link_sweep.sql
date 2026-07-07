-- Support for the hourly link-injection sweep cron (api/cron/sweep-links.js).
--
--   - posts.links_checked_at: idempotency marker. The sweep targets
--     pending_review posts where this is null and stamps it after a
--     successful run — including runs that found zero qualifying sources,
--     which would otherwise be re-swept (and re-billed) every hour under a
--     "no injected_links rows" predicate. A failed run leaves it null so
--     the post retries on the next sweep. Null it manually to force a
--     re-sweep of a specific post.
--   - injected_links.relevancy_reasoning: the Sonnet relevancy scorer's
--     one-sentence rationale, persisted so the admin review panel can show
--     it and visually flag reasoning that signals a contradiction with the
--     draft's claim.
--
-- Idempotent like 0001/0006/0007/0008. Apply after 0007 and 0008.
-- Do not run automatically — review, then apply via the Supabase SQL
-- editor or `supabase db push`.

alter table posts add column if not exists links_checked_at timestamptz;

alter table injected_links add column if not exists relevancy_reasoning text;
