-- External link injection: domain cache + injected-link log.
--
-- The domains table is the core cost lever of the link pipeline: one row per
-- domain ever classified. Cache hits are DB reads; API calls (search, fetch,
-- Haiku/Sonnet scoring, RDAP) only fire for domains not yet cached, so cost
-- scales with unique new domains, not post volume.
--
-- Semantics baked into the schema:
--   - freshness_verdict is PERMANENT once set (a page's publish date doesn't
--     change). The recheck scheduler never touches it.
--   - liveness and trust drift are rechecked on independent clocks, keyed by
--     last_liveness_check / last_trust_check and risk_tier ('trusted' =
--     .gov/.edu/allowlisted domains, long recheck interval; 'standard' =
--     everything else, shorter interval).
--   - allowlisted is the per-client curated list that bypasses the 2-year
--     freshness rule (.org gets no blanket pass).
--   - cross_mention_count tallies how often the domain surfaces across search
--     calls over time; it feeds the free trust-score proxy.
--
-- Idempotent like 0001: IF NOT EXISTS everywhere, duplicate_object-guarded
-- DO block for the enum. Do not run automatically — review, then apply via
-- the Supabase SQL editor or `supabase db push`.

do $$ begin
  create type link_risk_tier as enum ('trusted', 'standard');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- domains

create table if not exists domains (
  domain              text primary key,          -- registrable domain, lowercase, no scheme
  business_type       text,                      -- Haiku-extracted; null = not yet classified
  market              text,                      -- Haiku-extracted geo/market; null = not yet classified
  is_competitor       boolean,                   -- computed: same business_type AND geo overlap with client
  trust_score         integer check (trust_score between 0 and 100),
  trust_signals       jsonb,                     -- component scores for auditability (age, structural, mentions, https)
  freshness_verdict   boolean,                   -- permanent, set once; never rechecked
  publish_date        date,                      -- publish date of the page that set the verdict, null if undetectable
  allowlisted         boolean not null default false,  -- curated per-client bypass of the 2-year rule
  cross_mention_count integer not null default 0,
  risk_tier           link_risk_tier not null default 'standard',
  is_live             boolean,
  last_liveness_check timestamptz,
  last_trust_check    timestamptz,
  first_seen          timestamptz not null default now()
);

-- Competitor comparison query (candidate.business_type == client.business_type
-- AND market overlap) scans on these two columns together.
create index if not exists domains_business_type_market_idx
  on domains (business_type, market);

-- Recheck scheduler orders by time since last check, per tier.
create index if not exists domains_last_liveness_check_idx
  on domains (risk_tier, last_liveness_check);

-- ------------------------------------------------------------ injected_links
-- Log of every link the pipeline injected (or flagged for manual review):
-- the link, its scores at injection time, and the injection date.

create table if not exists injected_links (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references posts(id),   -- null for file-mode / test runs
  draft_ref       text,                        -- slug or filename when post_id is null
  url             text not null,
  domain          text not null references domains(domain),
  anchor_text     text not null,
  claim           text,                        -- the claim the link supports
  relevancy_score integer check (relevancy_score between 0 and 100),
  trust_score     integer check (trust_score between 0 and 100),
  status          text not null check (status in ('injected', 'flagged')),
  injected_at     timestamptz not null default now()
);

create index if not exists injected_links_post_id_idx on injected_links (post_id);
create index if not exists injected_links_domain_idx on injected_links (domain);

-- ------------------------------------------------------------------- RLS
-- Same posture as 0001: all access is server-side via the service-role key;
-- RLS with no policies denies everything to the anon key.

alter table domains        enable row level security;
alter table injected_links enable row level security;
