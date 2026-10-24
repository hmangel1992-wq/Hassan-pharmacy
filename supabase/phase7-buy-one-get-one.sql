-- =====================================================================
-- AVARA — Phase 7: "buy one, get one free" promotions
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Run AFTER phase4-promotions.sql and phase4-discount-codes.sql. Safe to run more than once.
--
-- A promotion can now be a "Buy N, get 1 free" offer on the products you pick (admin > Promotions).
-- The rule is applied on the SERVER when the order row is created, so the price can't be changed from
-- the browser, and the order alert and dashboard see the final total:
--   * For each picked product, every (N + 1) units in the order include 1 free unit
--     (buy 1 get 1 free: 2 units cost 1; 3 units cost 2; 4 units cost 2).
--   * If a product is in more than one live offer, the best one for the customer applies once.
--   * Only offers that are turned on and inside their dates count.
--   * It stacks with a discount code, but the two together never take more than the products cost.
--   * The delivery fee is never discounted. Free units still leave the stock, as they are shipped.
--
-- Adds:
--   * promotions.kind ('normal' or 'bogo') and promotions.buy_qty (N, from 1 to 5)
--   * orders.promo_discount and orders.promo_note (what the free units were worth, and which items)
--   * a trigger on orders that applies it (works with every checkout version, no other change)
-- =====================================================================

alter table public.promotions add column if not exists kind text not null default 'normal';
alter table public.promotions add column if not exists buy_qty integer not null default 1;

alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions add constraint promotions_kind_check check (kind in ('normal', 'bogo'));
alter table public.promotions drop constraint if exists promotions_buy_qty_check;
alter table public.promotions add constraint promotions_buy_qty_check check (buy_qty between 1 and 5);

alter table public.orders add column if not exists promo_discount numeric(10,2) not null default 0;
alter table public.orders add column if not exists promo_note text;

-- Runs after orders_apply_discount and before orders_apply_region (triggers run in alphabetical order).
create or replace function public.orders_apply_promo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub  numeric;
  v_b    numeric;
  v_note text;
begin
  select coalesce(sum((i->>'price')::numeric * (i->>'qty')::integer), 0)
    into v_sub from jsonb_array_elements(new.items) i;

  with li as (
    select i->>'id'                         as id,
           max(i->>'name_en')               as name,
           max((i->>'price')::numeric)      as price,
           sum((i->>'qty')::integer)        as qty
      from jsonb_array_elements(new.items) i
     group by i->>'id'
  ),
  best as (
    select li.id, li.name, li.price, li.qty, min(p.buy_qty) as buy
      from li
      join public.promotions p
        on p.kind = 'bogo'
       and p.is_active
       and (p.starts_at is null or p.starts_at <= now())
       and (p.ends_at   is null or p.ends_at   >  now())
       and li.id = any (p.product_ids)
     group by li.id, li.name, li.price, li.qty
  ),
  free as (
    select name, price, (qty / (buy + 1)) as units from best where qty >= buy + 1
  )
  select coalesce(sum(price * units), 0),
         string_agg(units::text || ' × ' || coalesce(name, '') || ' free', ', ' order by name)
    into v_b, v_note
    from free;

  -- Never take more than the products cost together with a discount code.
  v_b := least(coalesce(v_b, 0), greatest(v_sub - coalesce(new.discount, 0), 0));
  if v_b <= 0 then
    return new;
  end if;

  new.promo_discount := v_b;
  new.promo_note     := 'Buy & get free: ' || v_note;
  new.discount       := coalesce(new.discount, 0) + v_b;
  new.total          := greatest(new.total - v_b, 0);
  return new;
end;
$$;
revoke all on function public.orders_apply_promo() from public;

drop trigger if exists orders_apply_promo on public.orders;
create trigger orders_apply_promo
  before insert on public.orders
  for each row execute function public.orders_apply_promo();
