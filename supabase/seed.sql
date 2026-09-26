-- =====================================================================
-- AVARA store — sample products (optional)
-- Run AFTER schema.sql. These are placeholders: edit or delete them
-- from the admin dashboard and add your real products.
-- =====================================================================

insert into public.products
  (dept, collection, cat, type, name_en, name_ar, desc_en, desc_ar, size_en, size_ar, price, is_new, sort_order)
values
  ('medical',null,'vitamins','dropper','Vitamin D3 Drops','قطرات فيتامين D3','Daily vitamin D in an easy-to-dose dropper.','فيتامين D يومي في قطّارة سهلة الجرعة.','15 ml','15 مل',14.00,true,10),
  ('medical',null,'vitamins','tub','Omega-3 Softgels','كبسولات أوميغا 3','Omega-3 fatty acids in an easy-to-swallow softgel.','أحماض أوميغا 3 الدهنية في كبسولة سهلة البلع.','60 softgels','60 كبسولة',19.00,false,20),
  ('medical',null,'vitamins','tub','Vitamin C + Zinc','فيتامين C + زنك','A vitamin C and zinc tablet for your everyday routine.','قرص فيتامين C وزنك لروتينك اليومي.','30 tablets','30 قرصاً',12.00,false,30),
  ('medical',null,'firstaid','pump','Antiseptic Wound Spray','بخّاخ مطهّر للجروح','Spray-on antiseptic for cleaning minor cuts and scrapes.','مطهّر بخّاخ لتنظيف الجروح والخدوش البسيطة.','100 ml','100 مل',8.00,false,40),
  ('medical',null,'firstaid','box','First Aid Essentials Kit','حقيبة الإسعافات الأولية','Bandages, dressings and the basics for home, car or travel.','ضمّادات وأساسيات للمنزل والسيارة والسفر.','1 kit','عبوة واحدة',22.00,false,50),
  ('medical',null,'devices','box','Digital Thermometer','ميزان حرارة رقمي','Quick, easy-to-read temperature checks at home.','قياس سريع وواضح للحرارة في المنزل.','1 unit','قطعة واحدة',9.00,false,60),
  ('medical',null,'firstaid','tube','Hand Sanitising Gel','جل تعقيم اليدين','A quick-drying gel for clean hands on the go.','جل سريع الجفاف لنظافة اليدين أينما كنت.','100 ml','100 مل',6.00,false,70),
  ('medical',null,'devices','box','Blood Pressure Monitor','جهاز قياس ضغط الدم','An upper-arm monitor for checking your readings at home.','جهاز للذراع لقياس قراءاتك في المنزل.','1 unit','قطعة واحدة',39.00,false,80),
  ('athlete',null,'recovery','tube','Magnesium Recovery Gel','جل المغنيسيوم للاستشفاء','A cooling gel to massage in after training.','جل منعش للتدليك بعد التمرين.','100 ml','100 مل',13.00,false,90),
  ('athlete',null,'nutrition','sachet','Electrolyte Sachets','أكياس الأملاح المعدنية','Mix into water to replace minerals lost through sweat.','تُخلط بالماء لتعويض المعادن التي يفقدها الجسم بالتعرّق.','14 sachets','14 كيساً',16.00,true,100),
  ('athlete',null,'recovery','jar','Cooling Muscle Balm','بلسم مبرّد للعضلات','A menthol balm for tired legs and shoulders.','بلسم بالمنثول للساقين والكتفين المتعبين.','75 ml','75 مل',15.00,false,110),
  ('athlete',null,'recovery','tub','Collagen Powder','مسحوق الكولاجين','Unflavoured collagen to add to your daily routine.','كولاجين بدون نكهة لإضافته إلى روتينك اليومي.','30 servings','30 حصة',24.00,false,120),
  ('athlete',null,'protection','tube','Sport Sunscreen SPF 50','واقي شمس رياضي SPF 50','Broad-spectrum SPF 50 for outdoor training.','حماية واسعة الطيف SPF 50 للتمارين في الهواء الطلق.','100 ml','100 مل',17.00,false,130),
  ('athlete',null,'nutrition','tub','Plant Protein, Vanilla','بروتين نباتي بالفانيلا','Plant-based protein powder for after training.','مسحوق بروتين نباتي لما بعد التمرين.','900 g','900 غ',38.00,false,140),
  ('athlete',null,'recovery','box','Kinesiology Tape','شريط كينزيولوجي','Flexible support tape for training and competition.','شريط مرن للدعم أثناء التمرين والمنافسة.','1 roll','لفّة واحدة',11.00,false,150),
  ('athlete',null,'nutrition','tub','BCAA Powder, Lemon','مسحوق BCAA بالليمون','Amino acid powder with a light lemon flavour.','مسحوق أحماض أمينية بنكهة الليمون الخفيفة.','300 g','300 غ',27.00,false,160),
  ('beauty','avara_care','cleanser','pump','Gentle Gel Cleanser','جل منظّف لطيف','A soft gel that cleanses without stripping.','جل ناعم ينظّف دون أن يجفّف البشرة.','150 ml','150 مل',18.00,false,170),
  ('beauty','avara_care','moisturizers','tube','Barrier Cream','كريم حماية البشرة','Rich daily moisture that comforts dry skin.','ترطيب غني يومي يريح البشرة الجافة.','50 ml','50 مل',26.00,false,180),
  ('beauty','avara_care','sun_care','tube','Daily Fluid SPF 30','مرطّب يومي SPF 30','Light daily sun protection, under makeup or on its own.','حماية يومية خفيفة من الشمس، تحت المكياج أو وحدها.','50 ml','50 مل',24.00,false,190),
  ('beauty','avara_care','mask_patches','jar','Clay Purifying Mask','ماسك الطين المنقّي','A weekly clay mask for clean, smooth-feeling skin.','ماسك طين أسبوعي لبشرة نظيفة وناعمة.','75 ml','75 مل',21.00,false,200),
  ('beauty','avara_hair','hair_care','pump','Nourishing Shampoo','شامبو مغذٍّ','A gentle daily shampoo that cleans without weighing hair down.','شامبو يومي لطيف ينظّف دون أن يثقل الشعر.','250 ml','250 مل',16.00,true,210),
  ('beauty','avara_hair','hair_treatment','jar','Repair Hair Mask','ماسك ترميم الشعر','A weekly mask for dry or over-styled hair.','ماسك أسبوعي للشعر الجاف أو المتعب من التصفيف.','200 ml','200 مل',19.00,false,220),
  ('beauty','avara_hair','hair_color','box','Ash Brown Hair Color Kit','طقم صبغة شعر بني رمادي','A full at-home colour kit with conditioning treatment included.','طقم تلوين منزلي كامل مع بلسم عناية.','1 kit','عبوة واحدة',23.00,false,230),
  ('beauty','avara_hair','hair_styling','dropper','Argan Styling Oil','زيت الأرغان لتصفيف الشعر','A light oil that smooths frizz and adds shine.','زيت خفيف يهذّب الشعر ويمنحه لمعاناً.','50 ml','50 مل',17.00,false,240),
  ('beauty','avara_cosmetics','face','pump','Mattifying Foundation','فاونديشن مطفي','A buildable, natural-finish foundation for all-day wear.','فاونديشن قابل للتدرّج بلمسة نهائية طبيعية تدوم طوال اليوم.','30 ml','30 مل',27.00,true,250),
  ('beauty','avara_cosmetics','eyes','tube','Volumising Mascara','ماسكارا لتكثيف الرموش','Lengthens and defines lashes without clumping.','يطوّل ويحدّد الرموش دون تكتّل.','10 ml','10 مل',15.00,false,260),
  ('beauty','avara_cosmetics','lips','tube','Hydrating Lip Tint','ملوّن شفاه مرطّب','A sheer, moisturising tint with a natural flush of colour.','ملوّن شفاف ومرطّب بلمسة لون طبيعية.','4 g','4 غ',13.00,false,270),
  ('beauty','avara_cosmetics','makeup_tools','box','Makeup Sponge Set','طقم إسفنجات مكياج','A set of blending sponges for a seamless, natural finish.','طقم إسفنجات مزج للحصول على لمسة نهائية طبيعية ومتجانسة.','1 set','طقم واحد',9.00,false,280);
