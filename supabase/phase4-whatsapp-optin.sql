-- =====================================================================
-- AVARA — Phase 4, step 7: WhatsApp opt-in list (offers and news)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once.
--
-- Adds:
--   * public.wa_subscribers   - customers who tick the box at checkout (consent is recorded)
--   * public.wa_subscribe(...) - the store calls this right after an order is placed
--     To stop strangers from signing up someone else's number, it only accepts a phone
--     that matches an order placed in the last 2 hours.
-- Only you (admin) can read or change the list.
-- =====================================================================

create table if not exists public.wa_subscribers (
  id              bigint generated always as identity primary key,
  name            text,
  phone           text        not null,
  phone_key       text        not null unique,       -- last 8 digits: one row per phone
  lang            text        not null default 'en' check (lang in ('en', 'ar')),
  source          text        not null default 'checkout',
  consent_text    text,                               -- the wording the customer agreed to
  created_at      timestamptz not null default now(),
  unsubscribed_at timestamptz
);

alter table public.wa_subscribers enable row level security;
drop policy if exists "wa_subscribers admin all" on public.wa_subscribers;
create policy "wa_subscribers admin all" on public.wa_subscribers for all
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.wa_subscribers from anon;
grant select, insert, update, delete on public.wa_subscribers to authenticated;

create or replace function public.wa_subscribe(
  p_order_no bigint,
  p_phone    text,
  p_name     text default null,
  p_lang     text default 'en',
  p_consent  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_key    text := right(v_digits, 8);
  v_ok     boolean;
begin
  if p_order_no is null or char_length(v_digits) < 6 or char_length(v_digits) > 15 then
    return jsonb_build_object('ok', false, 'reason', 'phone');
  end if;

  begin
    v_ok := public.rl_hit('wasub:all', 300, 600);
    if v_ok is false then raise exception 'Too many requests'; end if;
    v_ok := public.rl_hit('wasub:' || v_key, 5, 600);
    if v_ok is false then raise exception 'Too many requests'; end if;
  exception
    when undefined_function then null;
  end;

  -- The number must belong to an order that was just placed.
  if not exists (
    select 1 from public.orders o
     where o.order_no = p_order_no
       and right(regexp_replace(o.phone, '\D', '', 'g'), 8) = v_key
       and o.created_at > now() - interval '2 hours'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'order');
  end if;

  insert into public.wa_subscribers (name, phone, phone_key, lang, consent_text)
  values (nullif(left(trim(coalesce(p_name, '')), 80), ''), left(trim(p_phone), 30), v_key,
          case when p_lang = 'ar' then 'ar' else 'en' end, left(p_consent, 300))
  on conflict (phone_key) do update
    set unsubscribed_at = null,                    -- ticking the box again is a new consent
        name  = coalesce(excluded.name, public.wa_subscribers.name),
        lang  = excluded.lang,
        consent_text = coalesce(excluded.consent_text, public.wa_subscribers.consent_text);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.wa_subscribe(bigint, text, text, text, text) from public;
grant execute on function public.wa_subscribe(bigint, text, text, text, text) to anon, authenticated;
