-- =====================================================================
-- AVARA store — Beauty re-categorization
-- Run this once if schema.sql / seed.sql were already applied BEFORE the
-- Beauty section had its three collections (Avara Care / Avara Hair /
-- Avara Cosmetics) and the Brand field. Safe to run even on a brand-new
-- project.
-- =====================================================================

-- 1. Add the columns the old schema didn't have yet (no-op if they exist).
alter table public.products add column if not exists collection text;
alter table public.products add column if not exists brand text;
create index if not exists products_dept_coll_idx on public.products (dept, collection, sort_order);

-- 2. The old flat Beauty categories (serums / moisture / cleanse) don't
--    exist in the new taxonomy, so replace the old sample Beauty products
--    with a fresh set spread across the three collections, each with an
--    example Brand filled in. This ONLY touches dept = 'beauty' — Medical
--    advice and Athlete section rows, and any real products you've
--    already added yourself, are untouched.
--    If you've already replaced the sample Beauty products with your own,
--    skip this delete and instead set each product's collection and brand
--    by hand from the admin dashboard.
delete from public.products where dept = 'beauty';

insert into public.products
  (dept, collection, cat, brand, type, name_en, name_ar, desc_en, desc_ar, size_en, size_ar, price, is_new, sort_order)
values
  ('beauty','avara_care','cleanser','CeraVe','pump','Gentle Gel Cleanser','جل منظّف لطيف','A soft gel that cleanses without stripping.','جل ناعم ينظّف دون أن يجفّف البشرة.','150 ml','150 مل',18.00,false,170),
  ('beauty','avara_care','moisturizers','Cetaphil','tube','Barrier Cream','كريم حماية البشرة','Rich daily moisture that comforts dry skin.','ترطيب غني يومي يريح البشرة الجافة.','50 ml','50 مل',26.00,false,180),
  ('beauty','avara_care','sun_care','La Roche-Posay','tube','Daily Fluid SPF 30','مرطّب يومي SPF 30','Light daily sun protection, under makeup or on its own.','حماية يومية خفيفة من الشمس، تحت المكياج أو وحدها.','50 ml','50 مل',24.00,false,190),
  ('beauty','avara_care','mask_patches','Nivea','jar','Clay Purifying Mask','ماسك الطين المنقّي','A weekly clay mask for clean, smooth-feeling skin.','ماسك طين أسبوعي لبشرة نظيفة وناعمة.','75 ml','75 مل',21.00,false,200),
  ('beauty','avara_hair','hair_care','Kérastase','pump','Nourishing Shampoo','شامبو مغذٍّ','A gentle daily shampoo that cleans without weighing hair down.','شامبو يومي لطيف ينظّف دون أن يثقل الشعر.','250 ml','250 مل',16.00,true,210),
  ('beauty','avara_hair','hair_treatment','L''Oréal Professionnel','jar','Repair Hair Mask','ماسك ترميم الشعر','A weekly mask for dry or over-styled hair.','ماسك أسبوعي للشعر الجاف أو المتعب من التصفيف.','200 ml','200 مل',19.00,false,220),
  ('beauty','avara_hair','hair_color','Garnier','box','Ash Brown Hair Color Kit','طقم صبغة شعر بني رمادي','A full at-home colour kit with conditioning treatment included.','طقم تلوين منزلي كامل مع بلسم عناية.','1 kit','عبوة واحدة',23.00,false,230),
  ('beauty','avara_hair','hair_styling','Moroccanoil','dropper','Argan Styling Oil','زيت الأرغان لتصفيف الشعر','A light oil that smooths frizz and adds shine.','زيت خفيف يهذّب الشعر ويمنحه لمعاناً.','50 ml','50 مل',17.00,false,240),
  ('beauty','avara_cosmetics','face','Maybelline','pump','Mattifying Foundation','فاونديشن مطفي','A buildable, natural-finish foundation for all-day wear.','فاونديشن قابل للتدرّج بلمسة نهائية طبيعية تدوم طوال اليوم.','30 ml','30 مل',27.00,true,250),
  ('beauty','avara_cosmetics','eyes','NYX','tube','Volumising Mascara','ماسكارا لتكثيف الرموش','Lengthens and defines lashes without clumping.','يطوّل ويحدّد الرموش دون تكتّل.','10 ml','10 مل',15.00,false,260),
  ('beauty','avara_cosmetics','lips','Rimmel','tube','Hydrating Lip Tint','ملوّن شفاه مرطّب','A sheer, moisturising tint with a natural flush of colour.','ملوّن شفاف ومرطّب بلمسة لون طبيعية.','4 g','4 غ',13.00,false,270),
  ('beauty','avara_cosmetics','makeup_tools','Real Techniques','box','Makeup Sponge Set','طقم إسفنجات مكياج','A set of blending sponges for a seamless, natural finish.','طقم إسفنجات مزج للحصول على لمسة نهائية طبيعية ومتجانسة.','1 set','طقم واحد',9.00,false,280);
