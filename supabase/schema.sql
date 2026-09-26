-- =====================================================================
-- AVARA store — Supabase schema
-- Run this once in: Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- ---------- 1. Tables ------------------------------------------------

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  dept        text not null check (dept in ('medical','athlete','beauty')),
  collection  text,   -- Beauty only: 'avara_care' | 'avara_hair' | 'avara_cosmetics'
  cat         text not null,
  brand       text check (char_length(brand) <= 80),   -- e.g. 'La Roche-Posay', 'Optimum Nutrition' — not a filter category, just a product spec
  type        text not null default 'box'
              check (type in ('dropper','tube','pump','jar','tub','box','sachet')),
  name_en     text not null check (char_length(name_en) between 1 and 120),
  name_ar     text not null check (char_length(name_ar) between 1 and 120),
  desc_en     text check (char_length(desc_en) <= 400),
  desc_ar     text check (char_length(desc_ar) <= 400),
  size_en     text check (char_length(size_en) <= 40),
  size_ar     text check (char_length(size_ar) <= 40),
  price       numeric(10,2) not null check (price >= 0),
  is_new      boolean not null default false,
  is_active   boolean not null default true,
  image_url   text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       bigint generated always as identity,
  customer_name  text not null check (char_length(customer_name) between 2 and 100),
  phone          text not null check (char_length(phone) between 6 and 30),
  address        text check (char_length(address) <= 300),
  notes          text check (char_length(notes) <= 500),
  items          jsonb not null,
  total          numeric(10,2) not null check (total >= 0),
  status         text not null default 'new'
                 check (status in ('new','confirmed','delivered','cancelled')),
  created_at     timestamptz not null default now()
);

-- Users listed here are store admins (they must also exist in Auth > Users)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create index if not exists products_dept_idx on public.products (dept, sort_order);
create index if not exists products_dept_coll_idx on public.products (dept, collection, sort_order);

-- Safe to re-run: adds the columns above if this schema was applied before
-- the Beauty collections, or the Brand field, existed.
alter table public.products add column if not exists collection text;
alter table public.products add column if not exists brand text;
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- 2. Admin check -------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- 3. Row level security ------------------------------------

alter table public.products enable row level security;
alter table public.orders   enable row level security;
alter table public.admins   enable row level security;

-- Products: public reads active items, admin does everything
drop policy if exists "products public read"  on public.products;
drop policy if exists "products admin insert" on public.products;
drop policy if exists "products admin update" on public.products;
drop policy if exists "products admin delete" on public.products;

create policy "products public read"  on public.products for select
  using (is_active or public.is_admin());
create policy "products admin insert" on public.products for insert
  with check (public.is_admin());
create policy "products admin update" on public.products for update
  using (public.is_admin()) with check (public.is_admin());
create policy "products admin delete" on public.products for delete
  using (public.is_admin());

-- Orders: no public access at all (customers order through place_order below)
drop policy if exists "orders admin read"   on public.orders;
drop policy if exists "orders admin update" on public.orders;
drop policy if exists "orders admin delete" on public.orders;

create policy "orders admin read"   on public.orders for select using (public.is_admin());
create policy "orders admin update" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
create policy "orders admin delete" on public.orders for delete using (public.is_admin());

-- Admins: a signed-in user can only see their own row (used by admin.html)
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select
  using (user_id = auth.uid());

-- Belt and braces: the anonymous role gets no write access to tables
revoke insert, update, delete on public.products from anon;
revoke all on public.orders from anon;
revoke all on public.admins from anon;

-- ---------- 4. Placing an order (the ONLY public write) ---------------
-- Prices are read from the products table on the server, so a customer
-- cannot change a price or total by editing the page.

create or replace function public.place_order(
  p_name    text,
  p_phone   text,
  p_address text,
  p_notes   text,
  p_items   jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   jsonb;
  v_prod   public.products;
  v_qty    integer;
  v_lines  jsonb   := '[]'::jsonb;
  v_total  numeric := 0;
  v_no     bigint;
begin
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'A name is required';
  end if;
  if p_phone is null or char_length(trim(p_phone)) < 6 then
    raise exception 'A phone number is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'The cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_prod
      from public.products
     where id = (v_item->>'id')::uuid and is_active;
    if not found then
      raise exception 'Product unavailable';
    end if;

    v_lines := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name_en', v_prod.name_en, 'name_ar', v_prod.name_ar,
      'price', v_prod.price, 'qty', v_qty
    );
    v_total := v_total + v_prod.price * v_qty;
  end loop;

  insert into public.orders (customer_name, phone, address, notes, items, total)
  values (trim(p_name), trim(p_phone),
          nullif(trim(coalesce(p_address, '')), ''),
          nullif(trim(coalesce(p_notes, '')), ''),
          v_lines, v_total)
  returning order_no into v_no;

  return v_no;
end;
$$;

revoke all on function public.place_order(text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;

-- ---------- 5. Image storage ------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product images admin insert" on storage.objects;
drop policy if exists "product images admin update" on storage.objects;
drop policy if exists "product images admin delete" on storage.objects;

create policy "product images admin insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
-- Reading images needs no policy: the bucket is public.
