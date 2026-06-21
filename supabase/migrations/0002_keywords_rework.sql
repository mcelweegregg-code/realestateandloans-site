-- Keyword tracking rework for realestateandloans.com.
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- Replaces the original keyword/topic_tags/priority `keywords` table (0001)
-- with a simpler primary/secondary `keywords` table plus a `topic_keywords`
-- join table, so blog generation can pull each topic's own primary_keyword
-- (still on topics.primary_keyword) plus two associated supporting keywords.
--
-- The old keywords table was orphaned: no application code (cron, generation,
-- admin UI, draft API) read or wrote it; only scripts/seed.js's generic upsert
-- path touched it, against content/seed/keywords.sample.json, which was never
-- run against live Supabase. Dropping it cleanly is therefore safe.
--
-- The topics and posts tables are untouched. posts.keywords_used is unrelated
-- and stays as-is.

-- --------------------------------------------------- drop old keywords table
-- cascade clears the RLS posture and any dependents from 0001; the table held
-- no data anyone depends on.

drop table if exists keywords cascade;

-- ----------------------------------------------------------- keywords (new)

create table keywords (
  id          uuid primary key default gen_random_uuid(),
  term        text not null unique,
  tier        text not null check (tier in ('primary', 'secondary')),
  created_at  timestamp with time zone default now()
);

-- ------------------------------------------------------------ topic_keywords
-- Two supporting keyword associations per topic. on delete cascade keeps the
-- join table clean if a topic or keyword is ever removed.

create table topic_keywords (
  topic_id    uuid references topics(id) on delete cascade,
  keyword_id  uuid references keywords(id) on delete cascade,
  primary key (topic_id, keyword_id)
);

-- ------------------------------------------------------------------- RLS
-- Match the existing posture: enable RLS with no policies so the anon key is
-- denied everything; serverless functions use the service-role key, which
-- bypasses RLS. ENABLE ROW LEVEL SECURITY is a no-op if already enabled.

alter table keywords       enable row level security;
alter table topic_keywords enable row level security;
