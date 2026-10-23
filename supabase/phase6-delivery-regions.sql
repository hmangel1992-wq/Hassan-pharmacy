-- =====================================================================
-- AVARA — Phase 6: delivery fee by region
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Run AFTER phase4-discount-codes.sql. Safe to run more than once.
--
-- Adds:
--   * public.delivery_regions  - the regions customers choose at checkout. The 8 governorates of
--                                Lebanon are added with NO fee yet; set each fee in admin.html > Settings.
--                                A region with no fee uses the general delivery fee from Settings.
--   * orders.delivery_region   - the region the customer chose
--   * a trigger that fixes the delivery fee, total and address of the order ON THE SERVER, so the
--     price can't be changed from the browser. The region is also written at the start of the
--     address, so it shows in the admin Orders list and in your order alert without any other change.
--   * place_order(..., p_code, p_region) - the same checkout as today plus the chosen region.
--     It calls your existing 6-argument place_order (stock, minimum order, discount code, rate
--     limits all behave exactly as before).
--
-- The "free delivery over" amount in Settings still applies to every region.
-- Old pages that are still cached in a customer's browser keep working with the general fee.
-- =====================================================================

create table if not exists public.delivery_regions (
  id         bigint generated always as identity primary key,
  name_en    text not null check (char_length(name_en) between 1 and 80),
  name_ar    text not null check (char_length(name_ar) between 1 and 80),
  fee        numeric(10,2) check (fee is null or fee >= 0),
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.delivery_regions (name_en, name_ar, sort_order)
select v.name_en, v.name_ar, v.sort_order
  from (values
    ('Beirut',          'بيروت',        1),
    ('Mount Lebanon',   'جبل لبنان',    2),
    ('North Lebanon',   'الشمال',       3),
    ('Akkar',           'عكار',         4),
    ('Baalbek-Hermel',  'بعلبك الهرمل', 5),
    ('Beqaa',           'البقاع',       6),
    ('South Lebanon',   'الجنوب',       7),
    ('Nabatieh',        'النبطية',      8)
  ) as v(name_en, name_ar, sort_order)
 where not exists (select 1 from public.delivery_regions);

alter table public.delivery_regions enable row level security;
drop policy if exists "regions public read"  on public.delivery_regions;
drop policy if exists "regions admin insert" on public.delivery_regions;
drop policy if exists "regions admin update" on public.delivery_regions;
drop policy if exists "regions admin delete" on public.delivery_regions;

create policy "regions public read"  on public.delivery_regions for select using (is_active or public.is_admin());
create policy "regions admin insert" on public.delivery_regions for insert with check (public.is_admin());
create policy "regions admin update" on public.delivery_regions for update using (public.is_admin()) with check (public.is_admin());
create policy "regions admin delete" on public.delivery_regions for delete using (public.is_admin());

revoke all on public.delivery_regions from anon;
grant select on public.delivery_regions to anon, authenticated;
grant insert, update, delete on public.delivery_regions to authenticated;

alter table public.orders add column if not exists delivery_region text;

-- Fixes the fee on the order row itself (BEFORE INSERT), the same way discount codes are applied.
-- Runs after orders_apply_discount (triggers run in alphabetical order), and only when
-- place_order(..., p_region) handed it a region for this one checkout.
create or replace function public.orders_apply_region()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  text := nullif(trim(coalesce(current_setting('avara.region_id', true), '')), '');
  v_reg public.delivery_regions;
  v_set public.settings;
  v_sub numeric;
  v_fee numeric;
begin
  if v_id is null then
    return new;
  end if;

  select * into v_reg from public.delivery_regions where id = v_id::bigint and is_active;
  if not found then
    raise exception 'Delivery region: invalid';
  end if;

  select coalesce(sum((i->>'price')::numeric * (i->>'qty')::integer), 0)
    into v_sub from jsonb_array_elements(new.items) i;

  select * into v_set from public.settings where id = 1;

  -- This region's fee, or the general fee when the region has none. Free delivery over the threshold.
  v_fee := coalesce(v_reg.fee, v_set.delivery_fee, 0);
  if coalesce(v_set.free_delivery_over, 0) > 0 and v_sub >= v_set.free_delivery_over then
    v_fee := 0;
  end if;

  new.total           := greatest(new.total - coalesce(new.delivery_fee, 0) + v_fee, 0);
  new.delivery_fee    := v_fee;
  new.delivery_region := v_reg.name_en;
  new.address         := v_reg.name_en || case when new.address is null or new.address = '' then '' else ' — ' || new.address end;
  return new;
end;
$$;
revoke all on function public.orders_apply_region() from public;

drop trigger if exists orders_apply_region on public.orders;
create trigger orders_apply_region
  before insert on public.orders
  for each row execute function public.orders_apply_region();

-- Checkout with a delivery region. The 6-argument place_order does the real work.
create or replace function public.place_order(
  p_name    text,
  p_phone   text,
  p_address text,
  p_notes   text,
  p_items   jsonb,
  p_code    text,
  p_region  bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no bigint;
begin
  if p_region is null then
    if exists (select 1 from public.delivery_regions where is_active) then
      raise exception 'Delivery region required';
    end if;
  else
    if not exists (select 1 from public.delivery_regions where id = p_region and is_active) then
      raise exception 'Delivery region: invalid';
    end if;
    perform set_config('avara.region_id', p_region::text, true);
  end if;

  -- Same call the store makes today: without a discount code, the 5-argument version; with one, the 6-argument version.
  if nullif(trim(coalesce(p_code, '')), '') is null then
    v_no := public.place_order(p_name, p_phone, p_address, p_notes, p_items);
  else
    v_no := public.place_order(p_name, p_phone, p_address, p_notes, p_items, p_code);
  end if;

  perform set_config('avara.region_id', '', true);
  return v_no;
end;
$$;
revoke all on function public.place_order(text, text, text, text, jsonb, text, bigint) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, text, bigint) to anon, authenticated;
