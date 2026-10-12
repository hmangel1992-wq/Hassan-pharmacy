-- =====================================================================
-- AVARA — Phase 4, step 5: back-in-stock requests
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once.
--
-- Adds:
--   * public.stock_requests          - "tell me when it is back" requests from customers
--   * public.request_restock(...)    - the storefront calls this (rate limited, one request per
--                                      phone number per product, only for products that are sold out)
-- Only you (admin) can read the list. Customers cannot read or change it.
-- Nothing is sent automatically: you see the waiting list in admin.html > Waiting list and
-- message each customer yourself with one tap on WhatsApp.
-- =====================================================================

create table if not exists public.stock_requests (
  id           bigint generated always as identity primary key,
  product_id   text        not null,
  product_name text        not null,
  name         text,
  phone        text        not null,
  phone_key    text        not null,          -- last 8 digits, used to avoid duplicates
  lang         text        not null default 'en' check (lang in ('en', 'ar')),
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  unique (product_id, phone_key)
);

alter table public.stock_requests enable row level security;
drop policy if exists "stock_requests admin all" on public.stock_requests;
create policy "stock_requests admin all" on public.stock_requests for all
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.stock_requests from anon;
grant select, insert, update, delete on public.stock_requests to authenticated;

create or replace function public.request_restock(
  p_product_id text,
  p_phone      text,
  p_name       text default null,
  p_lang       text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key    text := right(v_digits, 8);
  v_name   text := nullif(left(trim(coalesce(p_name, '')), 80), '');
  v_pname  text;
  v_stock  integer;
  v_ok     boolean;
begin
  if p_product_id is null or char_length(v_digits) < 6 or char_length(v_digits) > 15 then
    return jsonb_build_object('ok', false, 'reason', 'phone');
  end if;

  -- Rate limit (uses rl_hit from phase2-security.sql; skipped if it is missing).
  begin
    v_ok := public.rl_hit('restock:all', 300, 600);
    if v_ok is false then raise exception 'Too many requests'; end if;
    v_ok := public.rl_hit('restock:' || v_key, 10, 600);
    if v_ok is false then raise exception 'Too many requests'; end if;
  exception
    when undefined_function then null;
  end;

  select name_en, stock into v_pname, v_stock
    from public.products
   where id::text = p_product_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if coalesce(v_stock, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'in_stock');
  end if;

  insert into public.stock_requests (product_id, product_name, name, phone, phone_key, lang)
  values (p_product_id, v_pname, v_name, left(trim(p_phone), 30), v_key,
          case when p_lang = 'ar' then 'ar' else 'en' end)
  on conflict (product_id, phone_key) do update
    set notified_at = null,                     -- asking again after being told puts them back on the list
        name = coalesce(excluded.name, public.stock_requests.name),
        lang = excluded.lang;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.request_restock(text, text, text, text) from public;
grant execute on function public.request_restock(text, text, text, text) to anon, authenticated;
