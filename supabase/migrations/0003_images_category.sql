-- Add a category column to images so blog images can be loosely linked to
-- topics by category (probate / divorce / market / community / buyer-seller /
-- local) rather than per-topic. The check values match topics.category (0001)
-- exactly. Idempotent: safe to re-run.
--
-- Apply via the Supabase SQL editor or `supabase db push`.

alter table images add column if not exists category text;

-- Postgres has no ADD CONSTRAINT IF NOT EXISTS; guard so a retry does not abort.
do $$ begin
  alter table images add constraint images_category_check
    check (category in ('probate', 'divorce', 'market', 'community', 'buyer-seller', 'local'));
exception
  when duplicate_object then null;
end $$;

create index if not exists images_category_idx on images (category);
