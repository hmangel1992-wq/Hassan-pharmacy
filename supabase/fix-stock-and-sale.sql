-- =====================================================================
-- AVARA — FIX: stock checking + sale price together
-- Run this ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- (after add-stock.sql). Safe to run more than once.
--
-- Why: add-stock.sql re-created place_order using the regular price,
-- which silently undid the sale-price logic from add-images-and-sale.sql.
-- This version does both: it charges the sale price when one is set AND
-- checks / deducts stock under a row lock.
-- =====================================================================

-- Make sure the stock column exists (no-op if add-stock.sql already ran).
alter table public.products
  add column if not exists stock integer not null default 0 check (stock >= 0);

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
  v_price  numeric;
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

    -- Lock the row so two customers can never buy the last unit.
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

    -- Sale price wins when set; this is also what is stored on the order.
    v_price := coalesce(v_prod.sale_price, v_prod.price);

    v_lines := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name_en', v_prod.name_en, 'name_ar', v_prod.name_ar,
      'price', v_price, 'qty', v_qty
    );
    v_total := v_total + v_price * v_qty;
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

-- ---------------------------------------------------------------------
-- OPTIONAL one-time step: every existing product starts at stock 0, so
-- nothing can be ordered until you set real quantities (admin page >
-- Edit > Stock). To give everything a starting quantity of 20 instead,
-- remove the two dashes in front of the next line and run it:
-- ---------------------------------------------------------------------
-- update public.products set stock = 20 where stock = 0;
