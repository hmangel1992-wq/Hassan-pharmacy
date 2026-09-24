-- =====================================================================
-- AVARA — starter catalogue (24 products, Arabic + English)
-- Run once in: Supabase Dashboard > SQL Editor > New query > Run
-- Run supabase/add-stock.sql first (it creates the stock column).
-- Safe to run twice: a product is skipped if one with the same English name exists.
-- Every product starts with 20 units. Change quantities in the admin page.
-- =====================================================================

insert into public.products
  (dept, cat, type, name_en, name_ar, desc_en, desc_ar, size_en, size_ar, price, is_new, is_active, sort_order, stock)
select v.*
from (values
  ('medical', 'vitamins', 'dropper', 'Vitamin D3 Drops', 'قطرات فيتامين D3', 'Daily vitamin D in an easy-to-dose dropper.', 'فيتامين D يومي في قطّارة سهلة الجرعة.', '15 ml', '15 مل', 14.00, true, true, 10, 20),
  ('medical', 'vitamins', 'tub', 'Omega-3 Softgels', 'كبسولات أوميغا 3', 'Omega-3 fatty acids in an easy-to-swallow softgel.', 'أحماض أوميغا 3 الدهنية في كبسولة سهلة البلع.', '60 softgels', '60 كبسولة', 19.00, false, true, 20, 20),
  ('medical', 'vitamins', 'tub', 'Vitamin C + Zinc', 'فيتامين C + زنك', 'A vitamin C and zinc tablet for your everyday routine.', 'قرص فيتامين C وزنك لروتينك اليومي.', '30 tablets', '30 قرصاً', 12.00, false, true, 30, 20),
  ('medical', 'firstaid', 'pump', 'Antiseptic Wound Spray', 'بخّاخ مطهّر للجروح', 'Spray-on antiseptic for cleaning minor cuts and scrapes.', 'مطهّر بخّاخ لتنظيف الجروح والخدوش البسيطة.', '100 ml', '100 مل', 8.00, false, true, 40, 20),
  ('medical', 'firstaid', 'box', 'First Aid Essentials Kit', 'حقيبة الإسعافات الأولية', 'Bandages, dressings and the basics for home, car or travel.', 'ضمّادات وأساسيات للمنزل والسيارة والسفر.', '1 kit', 'عبوة واحدة', 22.00, false, true, 50, 20),
  ('medical', 'devices', 'box', 'Digital Thermometer', 'ميزان حرارة رقمي', 'Quick, easy-to-read temperature checks at home.', 'قياس سريع وواضح للحرارة في المنزل.', '1 unit', 'قطعة واحدة', 9.00, false, true, 60, 20),
  ('medical', 'firstaid', 'tube', 'Hand Sanitising Gel', 'جل تعقيم اليدين', 'A quick-drying gel for clean hands on the go.', 'جل سريع الجفاف لنظافة اليدين أينما كنت.', '100 ml', '100 مل', 6.00, false, true, 70, 20),
  ('medical', 'devices', 'box', 'Blood Pressure Monitor', 'جهاز قياس ضغط الدم', 'An upper-arm monitor for checking your readings at home.', 'جهاز للذراع لقياس قراءاتك في المنزل.', '1 unit', 'قطعة واحدة', 39.00, false, true, 80, 20),
  ('athlete', 'recovery', 'tube', 'Magnesium Recovery Gel', 'جل المغنيسيوم للاستشفاء', 'A cooling gel to massage in after training.', 'جل منعش للتدليك بعد التمرين.', '100 ml', '100 مل', 13.00, false, true, 10, 20),
  ('athlete', 'nutrition', 'sachet', 'Electrolyte Sachets', 'أكياس الأملاح المعدنية', 'Mix into water to replace minerals lost through sweat.', 'تُخلط بالماء لتعويض المعادن التي يفقدها الجسم بالتعرّق.', '14 sachets', '14 كيساً', 16.00, true, true, 20, 20),
  ('athlete', 'recovery', 'jar', 'Cooling Muscle Balm', 'بلسم مبرّد للعضلات', 'A menthol balm for tired legs and shoulders.', 'بلسم بالمنثول للساقين والكتفين المتعبين.', '75 ml', '75 مل', 15.00, false, true, 30, 20),
  ('athlete', 'recovery', 'tub', 'Collagen Powder', 'مسحوق الكولاجين', 'Unflavoured collagen to add to your daily routine.', 'كولاجين بدون نكهة لإضافته إلى روتينك اليومي.', '30 servings', '30 حصة', 24.00, false, true, 40, 20),
  ('athlete', 'protection', 'tube', 'Sport Sunscreen SPF 50', 'واقي شمس رياضي SPF 50', 'Broad-spectrum SPF 50 for outdoor training.', 'حماية واسعة الطيف SPF 50 للتمارين في الهواء الطلق.', '100 ml', '100 مل', 17.00, false, true, 50, 20),
  ('athlete', 'nutrition', 'tub', 'Plant Protein, Vanilla', 'بروتين نباتي بالفانيلا', 'Plant-based protein powder for after training.', 'مسحوق بروتين نباتي لما بعد التمرين.', '900 g', '900 غ', 38.00, false, true, 60, 20),
  ('athlete', 'recovery', 'box', 'Kinesiology Tape', 'شريط كينزيولوجي', 'Flexible support tape for training and competition.', 'شريط مرن للدعم أثناء التمرين والمنافسة.', '1 roll', 'لفّة واحدة', 11.00, false, true, 70, 20),
  ('athlete', 'nutrition', 'tub', 'BCAA Powder, Lemon', 'مسحوق BCAA بالليمون', 'Amino acid powder with a light lemon flavour.', 'مسحوق أحماض أمينية بنكهة الليمون الخفيفة.', '300 g', '300 غ', 27.00, false, true, 80, 20),
  ('beauty', 'serums', 'dropper', 'Radiance Serum', 'سيروم النضارة', 'A lightweight serum for a fresh, even-looking glow.', 'سيروم خفيف لإشراقة منعشة وموحّدة.', '30 ml', '30 مل', 34.00, true, true, 10, 20),
  ('beauty', 'serums', 'pump', 'Radiance Mist Serum', 'سيروم ميست النضارة', 'A fine mist serum to layer or refresh through the day.', 'سيروم بخّاخ ناعم لطبقة إضافية أو لانتعاش خلال اليوم.', '100 ml', '100 مل', 28.00, false, true, 20, 20),
  ('beauty', 'moisture', 'tube', 'Barrier Cream', 'كريم حماية البشرة', 'Rich daily moisture that comforts dry skin.', 'ترطيب غني يومي يريح البشرة الجافة.', '50 ml', '50 مل', 26.00, false, true, 30, 20),
  ('beauty', 'cleanse', 'pump', 'Gentle Gel Cleanser', 'جل منظّف لطيف', 'A soft gel that cleanses without stripping.', 'جل ناعم ينظّف دون أن يجفّف البشرة.', '150 ml', '150 مل', 18.00, false, true, 40, 20),
  ('beauty', 'cleanse', 'jar', 'Clay Purifying Mask', 'ماسك الطين المنقّي', 'A weekly clay mask for clean, smooth-feeling skin.', 'ماسك طين أسبوعي لبشرة نظيفة وناعمة.', '75 ml', '75 مل', 21.00, false, true, 50, 20),
  ('beauty', 'moisture', 'tube', 'Daily Fluid SPF 30', 'مرطّب يومي SPF 30', 'Light daily sun protection, under makeup or on its own.', 'حماية يومية خفيفة من الشمس، تحت المكياج أو وحدها.', '50 ml', '50 مل', 24.00, false, true, 60, 20),
  ('beauty', 'moisture', 'jar', 'Overnight Repair Cream', 'كريم الترميم الليلي', 'A comforting night cream for skin that feels tired.', 'كريم ليلي مريح للبشرة المتعبة.', '50 ml', '50 مل', 32.00, false, true, 70, 20),
  ('beauty', 'cleanse', 'tube', 'Gentle Exfoliating Scrub', 'مقشّر لطيف للوجه', 'A fine scrub that smooths skin without irritation.', 'مقشّر ناعم يصقل البشرة دون تهييج.', '75 ml', '75 مل', 19.00, false, true, 80, 20)
) as v(dept, cat, type, name_en, name_ar, desc_en, desc_ar, size_en, size_ar, price, is_new, is_active, sort_order, stock)
where not exists (select 1 from public.products p where p.name_en = v.name_en);
