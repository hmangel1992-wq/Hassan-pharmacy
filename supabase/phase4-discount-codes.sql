-- =====================================================================
-- AVARA — Phase 4, step 4: discount codes (first-order and loyalty offers)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Run AFTER phase4-order-tracking.sql. Safe to run more than once.
--
-- Adds:
--   * public.discount_codes   - codes you create in admin.html > Discounts
--   * orders.discount / orders.discount_code - what each order saved
--   * public.check_discount(code, phone, subtotal) - lets the cart preview a code
--   * public.place_order(..., p_code) - the same checkout as before plus an optional code.
--     It calls your existing 5-argument place_order first (so stock, minimum order, delivery
--     fee and rate limits all behave exactly as today) and applies the discount on the
--     SERVER while the order row is created, so the price can't be changed from the browser
--     and the order alert / dashboard see the final total. If the code is not valid the
--     whole order is cancelled and the stock is put back.
--   * public.track_order now also returns the discount and the product ids.
--
-- Rules every code follows:
--   * The discount applies to the products only, never to the delivery fee.
--   * One use per phone number per code.
--   * Optional: first orders only, minimum spend, maximum number of uses, expiry date.
-- =====================================================================

create table if not exists public.discount_codes (
  code            text primary key
                    check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  percent         numeric(5,2) check (percent > 0 and percent <= 100),
  amount          numeric(10,2) check (amount > 0),
  first_order_only boolean not null default false,
  min_subtotal    numeric(10,2) not null default 0 check (min_subtotal >= 0),
  max_uses        integer check (max_uses is null or max_uses > 0),
  used_count      integer not null default 0 check (used_count >= 0),
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  check ((percent is not null)::int + (amount is not null)::int = 1)
);

alter table public.discount_codes enable row level security;
drop policy if exists "codes admin all" on public.discount_codes;
create policy "codes admin all" on public.discount_codes for all
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.discount_codes from anon;
grant select, insert, update, delete on public.discount_codes to authenticated;

alter table public.orders add column if not exists discount numeric(10,2) not null default 0;
alter table public.orders add column if not exists discount_code text;

-- Internal: decides whether a code works for this phone and subtotal.
-- Returns {"ok": true, "discount": 4.50} or {"ok": false, "reason": "...", "min": 20}.
-- p_phone may be null (the cart previews a code before the phone is typed): the phone checks are then
-- skipped here and done again when the order is placed.
create or replace function public._discount_for(p_code text, p_phone text, p_subtotal numeric, p_exclude_order bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c      public.discount_codes;
  v_code   text := upper(trim(coalesce(p_code, '')));
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_disc   numeric;
begin
  select * into v_c from public.discount_codes where code = v_code;
  if not found or not v_c.is_active then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_c.expires_at is not null and v_c.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_c.max_uses is not null and v_c.used_count >= v_c.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'used_up');
  end if;
  if coalesce(p_subtotal, 0) < v_c.min_subtotal then
    return jsonb_build_object('ok', false, 'reason', 'min', 'min', v_c.min_subtotal);
  end if;

  if char_length(v_digits) >= 6 then
    if exists (
      select 1 from public.orders o
       where right(regexp_replace(o.phone, '\D', '', 'g'), 8) = v_digits
         and o.discount_code = v_code
         and o.status <> 'cancelled'
         and o.order_no is distinct from p_exclude_order
    ) then
      return jsonb_build_object('ok', false, 'reason', 'already_used');
    end if;
    if v_c.first_order_only and exists (
      select 1 from public.orders o
       where right(regexp_replace(o.phone, '\D', '', 'g'), 8) = v_digits
         and o.status <> 'cancelled'
         and o.order_no is distinct from p_exclude_order
    ) then
      return jsonb_build_object('ok', false, 'reason', 'first_order');
    end if;
  end if;

  if v_c.percent is not null then
    v_disc := round(p_subtotal * v_c.percent / 100, 2);
  else
    v_disc := least(v_c.amount, p_subtotal);
  end if;
  return jsonb_build_object('ok', true, 'discount', v_disc);
end;
$$;
revoke all on function public._discount_for(text, text, numeric, bigint) from public;

-- Public: the cart calls this to show the discount before the order is placed.
create or replace function public.check_discount(p_code text, p_phone text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_code is null or char_length(trim(p_code)) < 3 or char_length(p_code) > 30 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Rate limit (uses rl_hit from phase2-security.sql; skipped if it is missing).
  begin
    v_ok := public.rl_hit('code:all', 600, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
    v_ok := public.rl_hit('code:' || right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8), 30, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
  exception
    when undefined_function then null;
  end;

  return public._discount_for(p_code, p_phone, p_subtotal) || jsonb_build_object('code', upper(trim(p_code)));
end;
$$;
revoke all on function public.check_discount(text, text, numeric) from public;
grant execute on function public.check_discount(text, text, numeric) to anon, authenticated;

-- The discount is applied the moment the order row is created (BEFORE INSERT), so the new order
-- already has its final total and discount when it is saved. That matters for the order alert
-- (Telegram / email) and the admin dashboard, which both read the row as it is first inserted.
-- place_order(..., p_code) below hands the code to this trigger for the length of one checkout.
create or replace function public.orders_apply_discount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(current_setting('avara.discount_code', true), '')));
  v_sub  numeric;
  v_res  jsonb;
  v_disc numeric;
begin
  if v_code = '' then
    return new;
  end if;

  select coalesce(sum((i->>'price')::numeric * (i->>'qty')::integer), 0)
    into v_sub from jsonb_array_elements(new.items) i;

  v_res := public._discount_for(v_code, new.phone, v_sub, null);
  if not (v_res->>'ok')::boolean then
    raise exception 'Discount code: %', v_res->>'reason';   -- rolls back the whole order
  end if;
  v_disc := (v_res->>'discount')::numeric;

  new.discount      := v_disc;
  new.discount_code := v_code;
  new.total         := greatest(new.total - v_disc, 0);
  return new;
end;
$$;
revoke all on function public.orders_apply_discount() from public;

drop trigger if exists orders_apply_discount on public.orders;
create trigger orders_apply_discount
  before insert on public.orders
  for each row execute function public.orders_apply_discount();

-- Checkout with an optional discount code. Same arguments as the existing place_order, plus p_code.
create or replace function public.place_order(
  p_name    text,
  p_phone   text,
  p_address text,
  p_notes   text,
  p_items   jsonb,
  p_code    text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_no   bigint;
begin
  if v_code = '' then
    return public.place_order(p_name, p_phone, p_address, p_notes, p_items);
  end if;

  -- Lock the code so two orders can't both take its last use.
  perform 1 from public.discount_codes where code = v_code for update;

  -- The normal checkout (stock, minimum order, delivery fee, rate limits). The trigger above
  -- reads the code from this setting (valid for this checkout only) and applies the discount.
  perform set_config('avara.discount_code', v_code, true);
  v_no := public.place_order(p_name, p_phone, p_address, p_notes, p_items);
  perform set_config('avara.discount_code', '', true);

  -- Safety net: the order must carry the code, otherwise cancel everything.
  if not exists (select 1 from public.orders where order_no = v_no and discount_code = v_code) then
    raise exception 'Discount code: invalid';
  end if;
  update public.discount_codes set used_count = used_count + 1 where code = v_code;

  return v_no;
end;
$$;
revoke all on function public.place_order(text, text, text, text, jsonb, text) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, text) to anon, authenticated;

-- Order tracking now also shows the discount (and the product ids, used by "order again").
create or replace function public.track_order(p_order_no bigint, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_row    public.orders;
  v_ok     boolean;
begin
  if p_order_no is null or char_length(v_digits) < 6 then
    return null;
  end if;

  begin
    v_ok := public.rl_hit('track:' || p_order_no::text, 10, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
    v_ok := public.rl_hit('track:all', 300, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
  exception
    when undefined_function then null;
  end;

  select * into v_row from public.orders where order_no = p_order_no;

  if not found or right(regexp_replace(v_row.phone, '\D', '', 'g'), 8) <> v_digits then
    return null;
  end if;

  return jsonb_build_object(
    'order_no',      v_row.order_no,
    'status',        v_row.status,
    'status_note',   v_row.status_note,
    'created_at',    v_row.created_at,
    'total',         v_row.total,
    'delivery_fee',  v_row.delivery_fee,
    'discount',      v_row.discount,
    'discount_code', v_row.discount_code,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i->>'id', 'name_en', i->>'name_en', 'name_ar', i->>'name_ar',
               'qty', i->'qty', 'price', i->'price')), '[]'::jsonb)
        from jsonb_array_elements(v_row.items) i
    )
  );
end;
$$;
revoke all on function public.track_order(bigint, text) from public;
grant execute on function public.track_order(bigint, text) to anon, authenticated;
