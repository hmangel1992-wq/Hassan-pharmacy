-- =====================================================================
-- AVARA — Phase 4, step 1: order tracking
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Run AFTER phase1-settings-and-delivery.sql. Safe to run more than once.
--
-- Adds:
--   * orders.status_note        - a short message you write per order
--   * a new status "out_for_delivery"
--   * public.track_order(no, phone) - lets a customer see ONLY the status,
--     note, items and total of their own order, and only when the order
--     number AND phone match. It never returns name or address.
--     Failed lookups are rate-limited per order number.
-- =====================================================================

alter table public.orders add column if not exists status_note text
  check (char_length(status_note) <= 300);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new','confirmed','out_for_delivery','delivered','cancelled'));

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

  -- Rate limit (uses rl_hit from phase2-security.sql; skipped if it is missing).
  begin
    v_ok := public.rl_hit('track:' || p_order_no::text, 10, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
    v_ok := public.rl_hit('track:all', 300, 600);
    if v_ok is false then raise exception 'Too many attempts'; end if;
  exception
    when undefined_function then null;
  end;

  select * into v_row from public.orders where order_no = p_order_no;

  -- Same empty answer whether the order does not exist or the phone is wrong.
  if not found or right(regexp_replace(v_row.phone, '\D', '', 'g'), 8) <> v_digits then
    return null;
  end if;

  return jsonb_build_object(
    'order_no',     v_row.order_no,
    'status',       v_row.status,
    'status_note',  v_row.status_note,
    'created_at',   v_row.created_at,
    'total',        v_row.total,
    'delivery_fee', v_row.delivery_fee,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name_en', i->>'name_en', 'name_ar', i->>'name_ar',
               'qty', i->'qty', 'price', i->'price')), '[]'::jsonb)
        from jsonb_array_elements(v_row.items) i
    )
  );
end;
$$;

revoke all on function public.track_order(bigint, text) from public;
grant execute on function public.track_order(bigint, text) to anon, authenticated;
