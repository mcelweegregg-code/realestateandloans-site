-- Autoblog pipeline schema for realestateandloans.com.
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- Schema follows the autoblog plan, extended per the generation prompt spec:
-- topics carry description / primary keyword / guiding questions / category,
-- posts carry internal links, rag_fallback, the craft audit, and the social
-- drafts (LinkedIn / Facebook) that must persist with the post between
-- generation and publish. Image handling is deferred to v2; the images table
-- exists but nothing populates it yet and posts.image_used stays null.
--
-- This script is fully idempotent: every object uses IF NOT EXISTS (or, for
-- enum types, a duplicate_object-guarded DO block, since PostgreSQL has no
-- CREATE TYPE IF NOT EXISTS). It can be re-run safely after a partial run
-- without aborting on "already exists" conflicts. Assumes the `vector`
-- extension is already enabled (Supabase dashboard, 0.8.0).

create extension if not exists vector;

-- ---------------------------------------------------------------- enums
-- PostgreSQL has no CREATE TYPE IF NOT EXISTS; guard each enum so a retry
-- after a partial run does not abort the whole script.

do $$ begin
  create type topic_status as enum (
    'upcoming', 'reminder_sent', 'recorded', 'generating', 'published', 'auto_generated'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type post_status as enum ('draft', 'pending_review', 'published');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type image_source as enum ('owned', 'stock');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type chunk_source as enum ('voice_memo', 'post');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- topics

create table if not exists topics (
  id                uuid primary key default gen_random_uuid(),
  order_index       integer not null unique,
  title             text not null,
  description       text,           -- 1-2 sentences, injected as {{TOPIC_DESCRIPTION}}
  primary_keyword   text,           -- injected as {{PRIMARY_KEYWORD}}
  guiding_questions text[],         -- 3-4 questions shown to Gregg before recording
  category          text check (category in ('probate', 'divorce', 'market', 'community', 'buyer-seller', 'local')),
  scheduled_date    date,
  status            topic_status not null default 'upcoming',
  created_at        timestamptz not null default now()
);

create index if not exists topics_scheduled_date_idx on topics (scheduled_date);
create index if not exists topics_status_idx on topics (status);

-- ------------------------------------------------------------ voice_memos

create table if not exists voice_memos (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references topics(id),
  transcript   text not null,
  recorded_at  timestamptz not null default now(),
  tov_signals  jsonb           -- dynamic TOV extraction output (pre-pass)
);

create index if not exists voice_memos_topic_id_idx on voice_memos (topic_id);

-- ----------------------------------------------------------------- posts

create table if not exists posts (
  id               uuid primary key default gen_random_uuid(),
  topic_id         uuid references topics(id),
  voice_memo_id    uuid references voice_memos(id),  -- null = RAG fallback run
  slug             text not null unique,
  title            text not null,
  body_md          text not null,
  meta_title       text,
  meta_description text,
  primary_keyword  text,
  keywords_used    text[],
  internal_link_a  text,           -- Pool A URL used (realestateandloans.com)
  internal_link_b  text,           -- Pool B URL used (greggmcelwee.com)
  image_used       text,           -- nullable until image handling lands in v2
  rag_fallback     boolean not null default false,
  craft_audit      text,           -- Call 3 audit log, for editor review
  social_linkedin  text,           -- LinkedIn draft, held until publish
  social_facebook  text,           -- Facebook draft, held until publish
  status           post_status not null default 'draft',
  generated_at     timestamptz not null default now(),
  published_at     timestamptz
);

create index if not exists posts_status_idx on posts (status);
create index if not exists posts_topic_id_idx on posts (topic_id);

-- -------------------------------------------------------------- keywords

create table if not exists keywords (
  id          uuid primary key default gen_random_uuid(),
  keyword     text not null unique,
  topic_tags  text[],
  priority    integer not null default 3 check (priority between 1 and 5)
);

-- ---------------------------------------------------------------- images
-- v2: table exists so the schema is stable, but nothing writes to it yet.

create table if not exists images (
  id              uuid primary key default gen_random_uuid(),
  filename        text not null unique,
  source          image_source not null,
  alt_text        text,
  used            boolean not null default false,
  used_in_post_id uuid references posts(id)
);

-- ----------------------------------------------------------- system_config

create table if not exists system_config (
  key   text primary key,
  value text not null
);

insert into system_config (key, value) values
  ('editor_toggle', 'on'),
  ('publish_time', '06:02'),
  ('reminder_hours_before', '24'),
  ('fallback_cutoff', 'publish_time')
on conflict (key) do nothing;

-- ---------------------------------------------------------- content_chunks
-- RAG store. Chunked transcript / post body text with embeddings from
-- OpenAI text-embedding-3-small (1536 dims).

create table if not exists content_chunks (
  id          uuid primary key default gen_random_uuid(),
  source_type chunk_source not null,
  source_id   uuid not null,    -- voice_memos.id or posts.id per source_type
  chunk_index integer not null,
  content     text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

create index if not exists content_chunks_embedding_idx
  on content_chunks using hnsw (embedding vector_cosine_ops);

-- Semantic search used by the RAG fallback (top-N chunks for a topic query).
create or replace function match_content_chunks(
  query_embedding vector(1536),
  match_count     int default 5
)
returns table (
  id          uuid,
  source_type chunk_source,
  source_id   uuid,
  content     text,
  similarity  float
)
language sql stable
as $$
  select
    id,
    source_type,
    source_id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from content_chunks
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ------------------------------------------------------------------- RLS
-- All access goes through serverless functions using the service-role key,
-- which bypasses RLS. Enabling RLS with no policies denies everything to
-- the anon key, so a leaked anon key exposes nothing. ENABLE ROW LEVEL
-- SECURITY is a no-op if already enabled, so this is safe to re-run.

alter table topics         enable row level security;
alter table voice_memos    enable row level security;
alter table posts          enable row level security;
alter table keywords       enable row level security;
alter table images         enable row level security;
alter table system_config  enable row level security;
alter table content_chunks enable row level security;
