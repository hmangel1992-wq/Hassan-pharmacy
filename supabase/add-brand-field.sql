-- =====================================================================
-- AVARA store — add the Brand field
-- Run this once if your products table doesn't have a "brand" column yet.
-- Safe to run any time: it only adds the column if missing, and never
-- touches or deletes any existing product. If you're running schema.sql
-- or beauty-recategorize.sql fresh, they already include this — you don't
-- need this file too.
-- =====================================================================

alter table public.products add column if not exists brand text;

-- Optional: enforce the same 80-character limit the admin form uses.
-- Skip this if you already have longer brand text saved somewhere.
alter table public.products drop constraint if exists products_brand_check;
alter table public.products add constraint products_brand_check check (char_length(brand) <= 80);
