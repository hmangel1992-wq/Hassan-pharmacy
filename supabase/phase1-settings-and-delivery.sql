-- =====================================================================
-- AVARA — Phase 1: store settings, delivery fee, minimum order
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Run AFTER fix-stock-and-sale.sql. Safe to run more than once.
--
-- Adds:
--   * public.settings  - one row you edit from admin.html > Settings
--                        (delivery fee, free-delivery threshold, minimum order,
--                         address, opening hours, payment text, trust note)
--   * orders.delivery_fee - the fee charged on each order
--   * place_order now enforces the minimum order and adds the delivery fee
--     on the SERVER, so the total can't be changed from the browser.
-- With the defaults (fee 0, minimum 0) checkout behaves exactly as before.
-- =====================================================================

create table if not exists public.settings (
  id                 integer primary key default 1 check (id = 1),
  delivery_fee       numeric(10,2) not null default 0 check (delivery_fee >= 0),
  free_delivery_over numeric(10,2) check (free_delivery_over is null or free_delivery_over >= 0),
  min_order          numeric(10,2) not null default 0 check (min_order >= 0),
  address_en  text check (char_length(address_en)  <= 300),
  address_ar  text check (char_length(address_ar)  <= 300),
  hours_en    text check (char_length(hours_en)    <= 300),
  hours_ar    text check (char_length(hours_ar)    <= 300),
  delivery_en text check (char_length(delivery_en) <= 300),
  delivery_ar text check (char_length(delivery_ar) <= 300),
  payment_en  text check (char_length(payment_en)  <= 300),
  payment_ar  text check (char_length(payment_ar)  <= 300),
  trust_en    text check (char_length(trust_en)    <= 400),
  trust_ar    text check (char_length(trust_ar)    <= 400),
  map_url     text check (char_length(map_url)     <= 500)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;

drop policy if exists "settings public read"  on public.settings;
drop policy if exists "settings admin insert" on public.settings;
drop policy if exists "settings admin update" on public.settings;

create policy "settings public read"  on public.settings for select using (true);
create policy "settings admin insert" on public.settings for insert with check (public.is_admin());
create policy "settings admin update" on public.settings for update
  using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.settings from anon;
grant select on public.settings to anon, authenticated;

alter table public.orders add column if not exists delivery_fee numeric(10,2) not null default 0;

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
  v_set    public.settings;
  v_qty    integer;
  v_price  numeric;
  v_lines  jsonb   := '[]'::jsonb;
  v_total  numeric := 0;
  v_fee    numeric := 0;
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
     where id = (v_item->>'id')::uuid and is_active
       for update;
    if not found then
      raise exception 'Product unavailable';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Not enough stock for %', v_prod.name_en;
    end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;

    v_price := coalesce(v_prod.sale_price, v_prod.price);
    v_lines := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name_en', v_prod.name_en, 'name_ar', v_prod.name_ar,
      'price', v_price, 'qty', v_qty
    );
    v_total := v_total + v_price * v_qty;
  end loop;

  -- Minimum order and delivery fee, both decided on the server.
  -- Any exception here rolls back the stock deductions above.
  select * into v_set from public.settings where id = 1;
  if found then
    if v_set.min_order > 0 and v_total < v_set.min_order then
      raise exception 'Below minimum order';
    end if;
    if v_set.delivery_fee > 0
       and not (coalesce(v_set.free_delivery_over, 0) > 0 and v_total >= v_set.free_delivery_over) then
      v_fee := v_set.delivery_fee;
    end if;
  end if;
  v_total := v_total + v_fee;

  insert into public.orders (customer_name, phone, address, notes, items, total, delivery_fee)
  values (trim(p_name), trim(p_phone),
          nullif(trim(coalesce(p_address, '')), ''),
          nullif(trim(coalesce(p_notes, '')), ''),
          v_lines, v_total, v_fee)
  returning order_no into v_no;

  return v_no;
end;
$$;

revoke all on function public.place_order(text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;
