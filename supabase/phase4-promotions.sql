-- =====================================================================
-- AVARA — Phase 4, step 8: promotions banner (items and bundles)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once.
--
-- Adds public.promotions. You create promotions in admin.html > Promotions by
-- picking one or more products from your product list. Visitors only see promotions that are
-- turned on and inside their start/end dates. A promotion shows only the products that are in stock.
-- =====================================================================

create table if not exists public.promotions (
  id          uuid primary key default gen_random_uuid(),
  title_en    text,
  title_ar    text,
  text_en     text,
  text_ar     text,
  product_ids text[]  not null check (cardinality(product_ids) between 1 and 8),
  code        text    check (code is null or code ~ '^[A-Z0-9_-]{3,30}$'),   -- optional discount code applied in the cart
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.promotions enable row level security;
drop policy if exists "promotions read live" on public.promotions;
create policy "promotions read live" on public.promotions for select
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists "promotions admin all" on public.promotions;
create policy "promotions admin all" on public.promotions for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
