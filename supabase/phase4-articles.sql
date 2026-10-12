-- =====================================================================
-- AVARA — Phase 4, step 6: health and skin-care articles (English + Arabic)
-- Run ONCE in: Supabase Dashboard > SQL Editor > New query > Run
-- Safe to run more than once.
--
-- Adds public.articles. Visitors (and Google) can read only PUBLISHED articles.
-- You write and publish them in admin.html > Articles.
-- Two short example articles are added as DRAFTS (not visible to visitors).
-- Read and edit them, then tick "Published" in admin when you are happy with them.
--
-- Writing format for the body (plain text):
--   a blank line starts a new paragraph
--   a line starting with "## " is a heading
--   lines starting with "- " make a bullet list
-- =====================================================================

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  category     text not null default 'medical' check (category in ('medical', 'athlete', 'beauty')),
  title_en     text,
  title_ar     text,
  summary_en   text,
  summary_ar   text,
  body_en      text,
  body_ar      text,
  image_url    text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.articles_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.is_published and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch before insert or update on public.articles
  for each row execute function public.articles_touch();

alter table public.articles enable row level security;
drop policy if exists "articles read published" on public.articles;
create policy "articles read published" on public.articles for select using (is_published);
drop policy if exists "articles admin all" on public.articles;
create policy "articles admin all" on public.articles for all
  using (public.is_admin()) with check (public.is_admin());
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;

-- ---------- Two example drafts (general advice, please review before publishing) ----------
insert into public.articles (slug, category, title_en, title_ar, summary_en, summary_ar, body_en, body_ar, is_published)
values (
 'daily-sun-protection', 'beauty',
 'Daily sun protection: the one skin-care step that matters most',
 'الحماية اليومية من الشمس: أهم خطوة في العناية بالبشرة',
 'Why sunscreen belongs in every morning routine, and how to use it well.',
 'لماذا يجب أن يكون واقي الشمس جزءاً من كل روتين صباحي، وكيف تستخدمه بشكل صحيح.',
 $b$Sunscreen is the most useful step in a daily skin-care routine, because sunlight is the main cause of premature skin ageing and of most skin damage.

## How to use it
- Choose a broad-spectrum sunscreen with SPF 30 or higher.
- Apply it as the last step of your morning routine, before makeup.
- Use enough: about a teaspoon for the face and neck.
- Reapply every two hours when outdoors, and after swimming or heavy sweating.

## Good to know
Clouds and car windows do not block all UV rays, so daily use matters even on grey days. Hats and shade add extra protection.

If you have sensitive skin, a skin condition, or notice a mole that changes, please ask a doctor or pharmacist for advice.$b$,
 $b$واقي الشمس هو أهم خطوة في روتين العناية اليومية بالبشرة، لأن أشعة الشمس هي السبب الرئيسي لتقدّم البشرة المبكر ولمعظم أضرار الجلد.

## كيف تستخدمه
- اختر واقي شمس واسع الطيف بعامل حماية SPF 30 أو أعلى.
- ضعه كآخر خطوة في روتين الصباح وقبل المكياج.
- استخدم كمية كافية: نحو ملعقة صغيرة للوجه والرقبة.
- أعد وضعه كل ساعتين عند التواجد في الخارج، وبعد السباحة أو التعرّق الشديد.

## من المفيد أن تعرف
الغيوم وزجاج السيارة لا يحجبان كل الأشعة فوق البنفسجية، لذلك يبقى الاستخدام اليومي مهماً حتى في الأيام الغائمة. القبعات والظل يضيفان حماية إضافية.

إذا كانت بشرتك حساسة أو لديك مشكلة جلدية أو لاحظت تغيّراً في شامة، يرجى استشارة الطبيب أو الصيدلي.$b$,
 false
), (
 'staying-hydrated-when-active', 'athlete',
 'Staying hydrated when you train',
 'الحفاظ على الترطيب أثناء التمرين',
 'Simple habits to drink enough before, during and after exercise.',
 'عادات بسيطة لشرب كمية كافية من السوائل قبل التمرين وأثناءه وبعده.',
 $b$Water supports temperature control, joint comfort and energy, and even mild dehydration can make training feel harder.

## Simple habits
- Drink regularly through the day instead of waiting until you are very thirsty.
- Have a glass of water an hour or two before training.
- During long or hot sessions, sip small amounts every 15 to 20 minutes.
- Pale yellow urine is a simple sign that you are drinking enough.

## After training
Replace what you lost with water and a normal meal. For sessions longer than an hour, or in heat, an electrolyte drink can help.

Needs differ from person to person. If you have a heart, kidney or other medical condition, ask your doctor how much fluid is right for you.$b$,
 $b$يساعد الماء على تنظيم حرارة الجسم وراحة المفاصل والطاقة، وحتى الجفاف الخفيف قد يجعل التمرين أصعب.

## عادات بسيطة
- اشرب الماء بانتظام خلال اليوم ولا تنتظر حتى تشعر بعطش شديد.
- اشرب كوب ماء قبل التمرين بساعة أو ساعتين.
- في الجلسات الطويلة أو الحارة، ارتشف كميات صغيرة كل 15 إلى 20 دقيقة.
- البول الأصفر الفاتح علامة بسيطة على أنك تشرب ما يكفي.

## بعد التمرين
عوّض ما فقدته بالماء ووجبة عادية. وفي الجلسات التي تزيد على ساعة أو في الحر، قد يفيد مشروب الإلكتروليت.

تختلف الاحتياجات من شخص لآخر. إذا كنت تعاني من مرض في القلب أو الكلى أو حالة طبية أخرى، فاسأل طبيبك عن كمية السوائل المناسبة لك.$b$,
 false
)
on conflict (slug) do nothing;
