#!/usr/bin/env node
/*
 * AVARA — real home page
 *
 *   BEFORE: "/" was the Medical care page.
 *   AFTER:  "/" is a home page: headline, department tiles (with the photos you already have),
 *           featured products, shopping facts, customer reviews, about, contact and the chat.
 *           The Medical care page moves to /medical (and /ar/medical). Beauty and Athlete do not move.
 *
 * Changes these files (every one is optional except the template and the builder):
 *   tools/template.html   new home panel + styles + featured-picks script + English/Arabic text
 *   tools/build-pages.js  builds the home page and /medical pages, correct titles, links, structured data
 *   api/sitemap.js        lists /medical and /ar/medical
 *   api/product.js        "Medical care" links point to /medical
 *   api/articles.js       same
 *   vercel.json           adds the /medical and /ar/medical addresses
 *   sw.js                 new cache version, so visitors get the new pages
 *
 * Run from the project root:   node apply-home-page-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');

const first = (list) => list.find((f) => fs.existsSync(f));

/* ---------- 1. Styles for the home page ---------- */
const HOME_CSS = `
  /* =========================================================
     Home page
     ========================================================= */
  .hero.hero--home{
    display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: center;
    gap: clamp(24px, 5vw, 72px); min-height: clamp(420px, 44vw, 580px);
    padding: clamp(40px, 6vw, 84px) max(24px, calc((100% - 1240px) / 2));
    background: linear-gradient(135deg, var(--mint) 0%, #F3FBF9 58%, var(--ivory) 100%);
  }
  .home-hero__eyebrow{ font-size: .86rem; letter-spacing: .16em; text-transform: uppercase; color: var(--teal-deep); font-weight: 500; }
  [lang="ar"] .home-hero__eyebrow{ letter-spacing: 0; text-transform: none; }
  .home-hero__h{ margin-top: 14px; font-weight: 300; line-height: 1.08; font-size: clamp(2.4rem, 5.4vw, 4.6rem); color: var(--ink); }
  [lang="ar"] .home-hero__h{ font-weight: 400; line-height: 1.3; }
  .home-hero__s{ margin-top: 18px; max-width: 40ch; font-size: clamp(1.02rem, 1.4vw, 1.25rem); color: var(--ink-soft); }
  .home-hero__cta{ margin-top: 30px; display: flex; flex-wrap: wrap; gap: 12px; }
  .home-hero__art{ position: relative; display: flex; align-items: flex-end; justify-content: center; padding: 24px 0 8px; }
  .home-hero__art::before{
    content: ""; position: absolute; inset: 4% 8% 0; border-radius: 50%;
    background: radial-gradient(circle at 50% 45%, #FFFFFF 0%, rgba(255,255,255,.55) 45%, rgba(255,255,255,0) 72%);
  }
  .home-hero__art .pack{ position: relative; width: clamp(110px, 17vw, 220px); height: auto; filter: drop-shadow(0 18px 22px rgba(31,95,107,.16)); }
  .home-hero__art .pack:nth-child(1){ margin-inline-end: -4%; transform: translateY(6px) rotate(-4deg); }
  .home-hero__art .pack:nth-child(2){ width: clamp(130px, 21vw, 270px); z-index: 1; }
  .home-hero__art .pack:nth-child(3){ margin-inline-start: -4%; transform: translateY(6px) rotate(4deg); }
  @media (max-width: 860px){
    .hero.hero--home{ grid-template-columns: 1fr; min-height: 0; text-align: center; padding: 44px 24px 28px; }
    .home-hero__s{ margin-inline: auto; }
    .home-hero__cta{ justify-content: center; }
    .home-hero__art .pack{ width: 26vw; }
    .home-hero__art .pack:nth-child(2){ width: 32vw; }
  }
  @media (max-width: 460px){ .home-hero__cta .btn{ width: 100%; } }

  .dtiles{ margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .dtile{ display: flex; flex-direction: column; background: var(--white); border: 1px solid var(--mint-2); text-decoration: none; overflow: hidden; transition: border-color .3s ease, box-shadow .3s ease; }
  .dtile:hover{ border-color: var(--teal-deep); box-shadow: 0 12px 30px rgba(31,95,107,.12); }
  .dtile__img{ display: block; aspect-ratio: 16 / 9; overflow: hidden; background: var(--wall); }
  .dtile__img img{ width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
  .dtile:hover .dtile__img img{ transform: scale(1.04); }
  .dtile__body{ display: flex; flex-direction: column; gap: 10px; padding: 24px 26px 26px; flex: 1; }
  .dtile__name{ font-size: 1.45rem; font-weight: 400; line-height: 1.2; }
  .dtile__desc{ color: var(--ink-soft); flex: 1; }
  @media (max-width: 860px){ .dtiles{ grid-template-columns: 1fr; } }
  #featured .grid{ margin-top: 36px; }
  #grid-featured .card__foot{ margin-top: auto; }
  #featured[hidden]{ display: none; }
</style>
</head>
<body id="top">`;

/* ---------- 2. The home panel ---------- */
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
function tile(panel, i18nName, i18nDesc) {
  return `        <a class="dtile" href="#panel-${panel}">
          <span class="dtile__img"><img src="/assets/hero-${panel}-800.webp" alt="" width="800" height="469" loading="lazy"></span>
          <span class="dtile__body">
            <span class="dtile__name" data-i18n="${i18nName}"></span>
            <span class="dtile__desc" data-i18n="${i18nDesc}"></span>
            <span class="tile__go"><span data-i18n="shop">Shop</span>${arrow}</span>
          </span>
        </a>`;
}
const HOME_TOP = `<!-- ============ PANEL: HOME ============ -->
<div class="panel" data-panel="home" id="panel-home">

  <section class="hero hero--home" aria-label="AVARA">
    <div class="home-hero__copy">
      <p class="home-hero__eyebrow" data-i18n="hero_tag"></p>
      <p class="home-hero__h" data-i18n="hero_h_home"></p>
      <p class="home-hero__s" data-i18n="hero_s_home"></p>
      <div class="home-hero__cta">
        <a class="btn btn--solid" href="#departments" data-i18n="cta_depts"></a>
        <a class="btn btn--line" href="#chat" data-i18n="chat_cta"></a>
      </div>
    </div>
    <div class="home-hero__art" aria-hidden="true">
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-tube"/></svg>
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-dropper"/></svg>
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-pump"/></svg>
    </div>
  </section>

  <section class="section" id="departments" aria-labelledby="deptTitle" style="padding-bottom:40px">
    <div class="wrap">
      <h2 class="h2" id="deptTitle" data-i18n="dept_title">Shop by department</h2>
      <div class="dtiles">
${tile('medical', 'nav_medical', 'tile_medical')}
${tile('beauty', 'nav_beauty_full', 'tile_beauty')}
${tile('athlete', 'nav_athlete_full', 'tile_athlete')}
      </div>
    </div>
  </section>

  <section class="section section--mist" id="featured" aria-labelledby="featuredTitle" hidden>
    <div class="wrap">
      <h2 class="h2" id="featuredTitle" data-i18n="featured_title">Featured picks</h2>
      <p class="lead" data-i18n="featured_sub">A few products from across our three departments.</p>
      <div class="grid" id="grid-featured"></div>
    </div>
  </section>

`;
const HOME_BOTTOM = `
</div>

<!-- ============ PANEL: MEDICAL ============ -->`;

/* ---------- 3. Featured picks: real products only ---------- */
const FEATURED_JS = `
  /* ---------- Home: featured picks (real products only) ---------- */
  // In stock; products with a photo, on sale or new come first, then your own order from admin.
  // Spread across the three departments, at most 8. The section stays hidden until there is something to show.
  function renderFeatured(){
    var sec = $('#featured'), grid = $('#grid-featured'); if(!sec || !grid) return;
    if(loadState !== 'ok'){ sec.hidden = true; return; }
    var by = {medical: [], beauty: [], athlete: []};
    PRODUCTS.forEach(function(p, i){
      if(avail(p) <= 0 || !by[p.dept]) return;
      by[p.dept].push({p: p, k: (p.img ? 0 : 4) + (p.salePrice != null ? 0 : 2) + (p.isNew ? 0 : 1), i: i});
    });
    var lists = ['medical', 'beauty', 'athlete'].map(function(d){
      return by[d].sort(function(a, b){ return a.k - b.k || a.i - b.i; });
    });
    var picks = [];
    for(var n = 0; picks.length < 8 && n < 8; n++){
      lists.forEach(function(l){ if(picks.length < 8 && l[n]) picks.push(l[n].p); });
    }
    sec.hidden = !picks.length;
    grid.innerHTML = picks.map(function(p){
      var priceHtml = p.salePrice != null
        ? '<span class="card__price card__price--sale" dir="ltr"><span class="card__price-was">' + money(p.price) + '</span><span class="card__price-now">' + money(p.salePrice) + '</span></span>'
        : '<span class="card__price" dir="ltr">' + money(p.price) + '</span>';
      return '<article class="card">' +
        '<div class="card__media" data-open="' + esc(p.id) + '">' + media(p) + (p.isNew ? '<span class="badge">' + t('badge_new') + '</span>' : '') + '</div>' +
        '<div class="card__body">' +
          '<p class="card__cat">' + (p.brand ? esc(p.brand) + ' · ' : '') + esc(catLabel(p)) + '</p>' +
          '<h3 class="card__name"><button class="card__name-btn" type="button" data-open="' + esc(p.id) + '">' + esc(name(p)) + '</button></h3>' +
          '<div class="card__foot"><span class="card__size">' + esc(pick({en: p.size[0], ar: p.size[1]})) + '</span>' + priceHtml + '</div>' +
          '<button class="btn btn--line" type="button" data-add="' + esc(p.id) + '">' + t('add') + '</button>' +
        '</div></article>';
    }).join('');
  }

`;

/* ---------- 4. New text ---------- */
const TXT_EN = `show_more:'Show more', show_less:'Show less',
      hero_h_home:'Your Health Matters', hero_s_home:'Medical advice, athlete care and beauty, in one trusted place.',
      cta_depts:'Shop by department', featured_title:'Featured picks', featured_sub:'A few products from across our three departments.',`;
const TXT_AR = `show_more:'عرض المزيد', show_less:'عرض أقل',
      hero_h_home:'صحتك تهمّنا', hero_s_home:'نصائح طبية ورعاية رياضية وعناية بالجمال، في مكان واحد تثق به.',
      cta_depts:'تسوّق حسب القسم', featured_title:'مختارات لك', featured_sub:'مجموعة منتجات من أقسامنا الثلاثة.',`;

/* ---------- Jobs ---------- */
function count(t, s) { return t.split(s).length - 1; }

function applyEdits(t, edits, name, problems) {
  for (const [find, rep] of edits) {
    const n = count(t, find);
    if (n !== 1) { problems.push(name + ': expected 1 match but found ' + n + ' for: ' + find.split('\n')[0].slice(0, 90)); continue; }
    t = t.replace(find, () => rep);
  }
  return t;
}

// Cuts text from the line that starts with `from` up to (not including) `to`. Both must exist exactly once.
function cut(t, from, to, name, problems) {
  if (count(t, from) !== 1 || count(t, to) !== 1) { problems.push(name + ': could not find the block starting ' + from.trim().slice(0, 60)); return null; }
  const a = t.indexOf(from), b = t.indexOf(to);
  if (a > b) { problems.push(name + ': blocks are in an unexpected order near ' + from.trim().slice(0, 60)); return null; }
  return { block: t.slice(a, b), rest: t.slice(0, a) + t.slice(b) };
}

const MEDICAL_MARK = '<!-- ============ PANEL: MEDICAL (home) ============ -->';
const BEAUTY_MARK = '</div>\n\n<!-- ============ PANEL: BEAUTY ============ -->';

function templateJob(t, problems) {
  const name = 'template';
  if (t.includes('id="panel-home"')) return { t, done: true };
  t = applyEdits(t, [
    ['</style>\n</head>\n<body id="top">', HOME_CSS],
    ['<a class="brand" href="#panel-medical"', '<a class="brand" href="#panel-home"'],
    ["var activePanel = document.documentElement.getAttribute('data-panel') || 'medical';", "var activePanel = document.documentElement.getAttribute('data-panel') || 'home';"],
    ["return d === 'medical' ? b + '/' : b + '/' + d; }", "return d === 'home' ? b + '/' : b + '/' + d; }"],
    ['DEPTS.forEach(renderDept); renderCart(); runSearch();', 'DEPTS.forEach(renderDept); renderFeatured(); renderCart(); runSearch();'],
    ['    DEPTS.forEach(renderDept);\n    applyStore();', '    DEPTS.forEach(renderDept); renderFeatured();\n    applyStore();'],
    ["show_more:'Show more', show_less:'Show less',", TXT_EN],
    ["show_more:'عرض المزيد', show_less:'عرض أقل',", TXT_AR],
    ['  /* ---------- Panels (Medical / Beauty / Athlete are separate screens, not scroll anchors) ---------- */', FEATURED_JS + '  /* ---------- Panels (Medical / Beauty / Athlete are separate screens, not scroll anchors) ---------- */'],
  ], name, problems);

  // Shop-by-department tiles are replaced by the new tiles on the home page.
  const a = cut(t, '  <section class="section" id="departments"', '  <section class="section" id="medical"', name, problems);
  if (a) t = a.rest;
  // Facts, reviews, about, contact and chat move from the Medical page to the home page.
  const b = cut(t, '  <section class="section facts" id="facts"', BEAUTY_MARK, name, problems);
  if (b) t = b.rest;
  if (count(t, MEDICAL_MARK) !== 1) problems.push(name + ': could not find the "PANEL: MEDICAL (home)" comment');
  if (a && b && count(t, MEDICAL_MARK) === 1) {
    t = t.replace(MEDICAL_MARK, () => HOME_TOP + b.block.replace(/\s+$/, '') + '\n' + HOME_BOTTOM);
  }
  return { t, done: false };
}

const META_ADD = `// Home page: takes over the old Medical title and description; the Medical page gets its own.
META.en.home = Object.assign({}, META.en.medical, { h1: 'AVARA — Health care and cosmetics', hero: null });
META.ar.home = Object.assign({}, META.ar.medical, { h1: 'AVARA — رعاية صحية ومستحضرات تجميل', hero: null });
Object.assign(META.en.medical, {
  title: 'Medical care | AVARA: medical advice, vitamins and everyday essentials',
  desc: 'Medical advice, vitamins, first aid and health devices from AVARA. Straight answers on symptoms and medication questions. Prescription-only medicines are not sold online.',
  h1: 'AVARA — Medical care',
});
Object.assign(META.ar.medical, {
  title: 'الرعاية الطبية | AVARA: نصائح طبية وفيتامينات وأساسيات يومية',
  desc: 'نصائح طبية وفيتامينات وإسعافات أولية وأجهزة صحية من AVARA. إجابات واضحة عن الأعراض وأسئلة الأدوية. لا تُباع الأدوية التي تُصرف بوصفة طبية عبر الإنترنت.',
  h1: 'AVARA — الرعاية الطبية',
});

const abs = (u) => SITE + u;`;

function builderJob(t, problems) {
  const name = 'builder';
  if (t.includes("panel: 'home'")) return { t, done: true };
  t = applyEdits(t, [
    ["  { lang: 'en', panel: 'medical', file: 'index.html',      url: '/' },",
     "  { lang: 'en', panel: 'home',    file: 'index.html',      url: '/' },\n  { lang: 'en', panel: 'medical', file: 'medical.html',    url: '/medical' },"],
    ["  { lang: 'ar', panel: 'medical', file: 'ar/index.html',   url: '/ar/' },",
     "  { lang: 'ar', panel: 'home',    file: 'ar/index.html',   url: '/ar/' },\n  { lang: 'ar', panel: 'medical', file: 'ar/medical.html', url: '/ar/medical' },"],
    ['const abs = (u) => SITE + u;', META_ADD],
    ["const heroBase = '/assets/' + meta.hero.replace(/\\.jpg$/, '');", "const heroBase = meta.hero ? '/assets/' + meta.hero.replace(/\\.jpg$/, '') : null;"],
    ["  addLink(doc, { rel: 'preload', as: 'image', href: heroBase", "  if (heroBase) addLink(doc, { rel: 'preload', as: 'image', href: heroBase"],
    ["if (page.panel === 'medical') {", "if (page.panel === 'home') {"],
    ["item: abs(urlOf(page.lang, 'medical'))", "item: abs(urlOf(page.lang, 'home'))"],
    ["name: ar ? I18N.ar['nav_' + page.panel + '_full'] : I18N.en['nav_' + page.panel + '_full'], item: pageUrl",
     "name: (ar ? I18N.ar : I18N.en)['nav_' + page.panel + '_full'] || (ar ? I18N.ar : I18N.en)['nav_' + page.panel], item: pageUrl"],
  ], name, problems);
  return { t, done: false };
}

const MED_OLD = "medical: { en: 'Medical care', ar: 'الرعاية الطبية', path: '' },";
const MED_NEW = "medical: { en: 'Medical care', ar: 'الرعاية الطبية', path: 'medical' },";

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'builder', required: true, file: first(['tools/build-pages.js', 'build-pages.js']), run: builderJob },
  { label: 'sitemap', file: first(['api/sitemap.js', 'sitemap.js']), run: (t, p) => {
      if (t.includes("['/medical', '/ar/medical']")) return { t, done: true };
      return { t: applyEdits(t, [["[['/', '/ar/'], ['/beauty', '/ar/beauty']", "[['/', '/ar/'], ['/medical', '/ar/medical'], ['/beauty', '/ar/beauty']"]], 'sitemap', p), done: false };
  } },
  { label: 'product pages', file: first(['api/product.js', 'product.js']), run: (t, p) => {
      if (t.includes(MED_NEW)) return { t, done: true };
      return { t: applyEdits(t, [[MED_OLD, MED_NEW]], 'product pages', p), done: false };
  } },
  { label: 'article pages', file: first(['api/articles.js', 'articles.js']), run: (t, p) => {
      if (t.includes(MED_NEW)) return { t, done: true };
      return { t: applyEdits(t, [[MED_OLD, MED_NEW]], 'article pages', p), done: false };
  } },
  { label: 'vercel.json', file: first(['vercel.json']), run: (t, p) => {
      let j;
      try { j = JSON.parse(t); } catch (e) { p.push('vercel.json: is not valid JSON'); return { t, done: false }; }
      j.rewrites = j.rewrites || [];
      const have = (s) => j.rewrites.some((r) => r.source === s);
      if (have('/medical') && have('/ar/medical')) return { t, done: true };
      if (!have('/medical')) j.rewrites.push({ source: '/medical', destination: '/medical.html' });
      if (!have('/ar/medical')) j.rewrites.push({ source: '/ar/medical', destination: '/ar/medical.html' });
      return { t: JSON.stringify(j, null, 2) + '\n', done: false };
  } },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      if (t.includes('// home page')) return { t, done: true };
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';/);
      if (!m) { p.push("sw.js: could not find the CACHE_VERSION line"); return { t, done: false }; }
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // home page"), done: false };
  } },
];

/* ---------- Plan everything first, write only if all is well ---------- */
const plan = [];
const problems = [];
for (const j of jobs) {
  if (!j.file) {
    if (j.required) problems.push('Could not find the ' + j.label + '. Run this from the project root.');
    else console.log('Skipped (not found): ' + j.label);
    continue;
  }
  const raw = fs.readFileSync(j.file, 'utf8');
  const crlf = raw.includes('\r\n');
  const before = problems.length;
  const res = j.run(raw.replace(/\r\n/g, '\n'), problems);
  if (problems.length > before) continue;
  if (res.done) { console.log(j.file + ': already up to date'); continue; }
  plan.push({ file: j.file, raw, out: crlf ? res.t.replace(/\n/g, '\r\n') : res.t });
}

if (problems.length) {
  console.error('Nothing was changed. Please send me the file(s) named below and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
if (plan.length) console.log('\nNext: node tools/build-pages.js   then commit and push.');
