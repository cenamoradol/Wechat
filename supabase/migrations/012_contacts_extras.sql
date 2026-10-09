-- 012_contacts_extras.sql
-- Add tags (text[]) notes (text) to contacts + GIN index for tag search.

alter table public.contacts
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text;

-- GIN index for fast tag filtering (e.g. tags @> ARRAY['vip'])
create index if not exists contacts_tags_gin_idx
  on public.contacts
  using gin (tags);

-- Trigram index for case-insensitive name/email search
create extension if not exists pg_trgm;
create index if not exists contacts_search_idx
  on public.contacts
  using gin (
    (coalesce(full_name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone_e164, ''))
    gin_trgm_ops
  );