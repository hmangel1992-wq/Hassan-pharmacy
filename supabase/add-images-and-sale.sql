-- =====================================================================
-- AVARA store — photo galleries (up to 3 photos) + sale prices
-- Run this once if your products table doesn't have "images" or
-- "sale_price" yet. Safe to run any time: it only adds what's missing,
-- and never touches or deletes any existing product. If you're running
-- schema.sql fresh, it already includes this — you don't need this file.
-- =====================================================================

-- 1. Photo gallery: up to 3 photos per product. Existing single photos
--    (image_url) are copied in automatically as each product's first photo.
alter table public.products add column if not exists images text[] not null default '{}';
alter table public.products drop constraint if exists products_images_check;
alter table public.products add constraint products_images_check
  check (array_length(images,1) is null or array_length(images,1) <= 3);
update public.products set images = array[image_url]
  where image_url is not null and coalesce(array_length(images,1), 0) = 0;

-- 2. Sale price: must be lower than the regular price when set.
alter table public.products add column if not exists sale_price numeric(10,2);
alter table public.products drop constraint if exists products_sale_price_check;
alter table public.products add constraint products_sale_price_check
  check (sale_price is null or (sale_price >= 0 and sale_price < price));

-- 3. Orders must charge (and remember) the sale price when one is set.
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
      'price', coalesce(v_prod.sale_price, v_prod.price), 'qty', v_qty
    );
    v_total := v_total + coalesce(v_prod.sale_price, v_prod.price) * v_qty;
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
