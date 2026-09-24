-- =====================================================================
-- AVARA — stock tracking
-- Run once in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once.
-- =====================================================================

-- 1. Stock column. Existing products start at 0: set real quantities in the admin page.
alter table public.products
  add column if not exists stock integer not null default 0 check (stock >= 0);

-- 2. Placing an order now checks stock and deducts it, atomically.
--    The row lock (for update) means two customers can never buy the last unit.
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
     where id = (v_item->>'id')::uuid and is_active
       for update;
    if not found then
      raise exception 'Product unavailable';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Not enough stock for %', v_prod.name_en;
    end if;

    update public.products set stock = stock - v_qty where id = v_prod.id;

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

-- 3. Cancelling an order puts its items back in stock.
--    Re-opening a cancelled order takes them out again (fails if stock ran out).
create or replace function public.sync_stock_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_sign integer;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_sign := 1;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    v_sign := -1;
  else
    return new;
  end if;

  for v_item in select * from jsonb_array_elements(new.items) loop
    update public.products
       set stock = stock + v_sign * (v_item->>'qty')::integer
     where id = (v_item->>'id')::uuid;
  end loop;
  return new;
end;
$$;

drop trigger if exists orders_sync_stock on public.orders;
create trigger orders_sync_stock
  after update of status on public.orders
  for each row execute function public.sync_stock_on_status();
