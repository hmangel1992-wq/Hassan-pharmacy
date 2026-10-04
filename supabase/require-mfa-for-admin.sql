-- =====================================================================
-- AVARA — OPTIONAL: make the database itself demand two-step sign-in
-- for every admin action.
--
-- !!! ONLY run this AFTER you have set up two-step sign-in in
-- !!! admin.html > Settings and confirmed you can sign in with a code.
-- !!! If you run it without a working authenticator you will be locked
-- !!! out of the admin page (the store itself keeps working).
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- ROLLBACK (if you ever get locked out, run this in the SQL Editor):
-- create or replace function public.is_admin() returns boolean language sql security definer
--   set search_path = public stable as $$
--   select exists (select 1 from public.admins where user_id = auth.uid());
-- $$;
