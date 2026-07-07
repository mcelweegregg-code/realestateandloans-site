-- Surplus link pool + word-count-scaled injection cap.
--
-- The engine now caps injected links at 1 per ~400 words (no fixed ceiling)
-- and ranks gate-passing candidates by combined relevancy+trust score.
-- Candidates that pass every gate (competitor, trust, freshness, relevancy)
-- but get cut by the cap are vetted, reusable work: they're logged with the
-- new status 'surplus' and offered to future posts in the same topic
-- category before those posts pay for a fresh web search.
--
--   - topic_id references the pipeline's existing topics table (provenance:
--     which run discovered the candidate). Reuse matching happens at the
--     topics.category level ('probate', 'divorce', ...) via join — a
--     surplus source found for one probate post serves any probate post.
--     Null for file-mode/test runs, which are excluded from reuse.
--   - Surplus rows are single-use: once reused (or found dead at reuse
--     time), consumed_at is stamped and the row is never offered again.
--     A row that merely fails the fresh relevancy check for one specific
--     claim stays unconsumed — still valid for other posts.
--   - Rows are never status-flipped: a reused surplus row keeps its
--     original discovery log; the new injection writes its own
--     status='injected' row.
--
-- Idempotent like 0001/0006/0007. Apply AFTER 0007 (same table lineage).
-- Do not run automatically — review, then apply via the Supabase SQL editor
-- or `supabase db push`.

-- --------------------------------------------------------------- new columns

alter table injected_links add column if not exists topic_id            uuid references topics(id);
alter table injected_links add column if not exists consumed_at         timestamptz;
alter table injected_links add column if not exists consumed_by_post_id uuid references posts(id);
alter table injected_links add column if not exists consumed_reason     text;  -- 'reused for new post' / 'dead URL: ...' — audit trail

-- ------------------------------------------------------------ status values
-- CHECK constraints can't be altered in place; drop + re-add (idempotent).

alter table injected_links drop constraint if exists injected_links_status_check;
alter table injected_links add constraint injected_links_status_check
  check (status in ('injected', 'flagged', 'surplus'));

-- ------------------------------------------------------------- reuse lookup
-- Partial index matching exactly the reuse query: unconsumed surplus rows
-- for a set of topic ids.

create index if not exists injected_links_surplus_idx
  on injected_links (topic_id)
  where status = 'surplus' and consumed_at is null;
