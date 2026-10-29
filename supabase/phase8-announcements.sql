-- =====================================================================
-- AVARA — Phase 8: announcements (the scrolling "latest news" bar at the top)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once. Needs public.is_admin() (already in your project).
--
-- You add, edit, switch on/off and schedule the messages from
-- admin.html > Announcements. Visitors only ever see messages that are
-- switched on and inside their start/end dates. No messages = the bar
-- shows your tagline "Inspired by Nature. Perfected by Science".
-- =====================================================================

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  text_en    text check (char_length(text_en) <= 200),
  text_ar    text check (char_length(text_ar) <= 200),
  link_url   text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^(https?://|/|#)')),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint announcements_has_text check (coalesce(trim(text_en), '') <> '' or coalesce(trim(text_ar), '') <> '')
);

alter table public.announcements enable row level security;

drop policy if exists "announcements public read" on public.announcements;
drop policy if exists "announcements admin all"   on public.announcements;

-- Visitors: only live messages.
create policy "announcements public read" on public.announcements
  for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

-- Admins: everything (including switched-off and scheduled ones).
create policy "announcements admin all" on public.announcements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.announcements from anon;
grant select on public.announcements to anon;
grant select, insert, update, delete on public.announcements to authenticated;
