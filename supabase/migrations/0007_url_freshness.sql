-- Freshness moves from per-domain to per-URL granularity.
--
-- Publish date is a per-page fact, not a per-domain one: a single early
-- verdict on one article was permanently blocking (or blanket-passing) every
-- other page on that domain (confirmed: opelon.com, lawvex.com). The verdict
-- semantics are unchanged — one-time and PERMANENT per page, never touched
-- by the recheck scheduler — only the key changes, from domain to full URL.
--
-- The old domains.freshness_verdict / domains.publish_date columns are
-- dropped rather than migrated: the engine never recorded which URL produced
-- each domain-level verdict, so the data is meaningless at either
-- granularity. All 21 affected rows were audited on 2026-07-03 before this
-- migration was written; dropping the columns clears them atomically and
-- every domain's next candidacy re-evaluates fresh, per-URL, with the fixed
-- publish-date extractor.
--
-- Everything genuinely domain-level (business_type, market, is_competitor,
-- trust_score, risk_tier, allowlisted, cross_mention_count, liveness) stays
-- on domains untouched.
--
-- Idempotent like 0001/0006. Do not run automatically — review, then apply
-- via the Supabase SQL editor or `supabase db push`.

-- ------------------------------------------------------------ url_freshness

create table if not exists url_freshness (
  url               text primary key,          -- as fetched, fragment stripped (see urlCacheKey in lib/links/domains.js)
  domain            text not null references domains(domain),
  freshness_verdict boolean not null,          -- permanent, per page; never rechecked
  publish_date      date,                      -- null = undetectable
  reason            text,                      -- human-readable verdict rationale, for debugging/audit
  checked_at        timestamptz not null default now()
);

-- Non-unique domain reference: lets us find/clear all of a domain's URL
-- verdicts (e.g. if a domain is later allowlisted after some of its URLs
-- were rejected for staleness).
create index if not exists url_freshness_domain_idx on url_freshness (domain);

-- ------------------------------------------------- drop domain-level columns

alter table domains drop column if exists freshness_verdict;
alter table domains drop column if exists publish_date;

-- ------------------------------------------------------------------- RLS
-- Same posture as 0001/0006: server-side service-role access only.

alter table url_freshness enable row level security;
