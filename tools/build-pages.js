#!/usr/bin/env node
/*
 * AVARA page builder
 * ------------------
 * tools/template.html is the ONE file you edit for the storefront.
 * This script turns it into six real pages, each with its own URL, title,
 * description, canonical link, language alternates and pre-translated text:
 *
 *   /            index.html          English  Medical care (home)
 *   /beauty      beauty.html         English  Beauty care
 *   /athlete     athlete.html        English  Athlete care
 *   /ar/         ar/index.html       Arabic   Medical care (home)
 *   /ar/beauty   ar/beauty.html      Arabic   Beauty care
 *   /ar/athlete  ar/athlete.html     Arabic   Athlete care
 *
 * Run from the project root, after every change to tools/template.html:
 *   npm install --no-save jsdom
 *   node tools/build-pages.js
 * Optional: SITE_URL=https://your-domain.com node tools/build-pages.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SITE = (process.env.SITE_URL || 'https://avara-nu-beige.vercel.app').replace(/\/$/, '');
const ROOT = path.join(__dirname, '..');
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

// Pull the Arabic text out of the template so the Arabic pages ship pre-translated HTML.
const m = tpl.match(/var I18N = (\{[\s\S]*?\n  \});\n\n  \/\* -+ Catalogue/);
if (!m) throw new Error('Could not find the I18N block in tools/template.html');
const I18N = new Function('return ' + m[1])();

const PAGES = [
  { lang: 'en', panel: 'medical', file: 'index.html',      url: '/' },
  { lang: 'en', panel: 'beauty',  file: 'beauty.html',     url: '/beauty' },
  { lang: 'en', panel: 'athlete', file: 'athlete.html',    url: '/athlete' },
  { lang: 'ar', panel: 'medical', file: 'ar/index.html',   url: '/ar/' },
  { lang: 'ar', panel: 'beauty',  file: 'ar/beauty.html',  url: '/ar/beauty' },
  { lang: 'ar', panel: 'athlete', file: 'ar/athlete.html', url: '/ar/athlete' },
];
const urlOf = (lang, panel) => PAGES.find((p) => p.lang === lang && p.panel === panel).url;

const META = {
  en: {
    medical: {
      title: 'AVARA | Health care and cosmetics: medical care, beauty and athlete care',
      desc: 'AVARA is a health care and cosmetics store. Medical advice and everyday essentials, beauty and hair care, and recovery for athletes. Inspired by Nature. Perfected by Science.',
      h1: 'AVARA — Medical care', image: 'hero-banner.jpg', hero: 'hero-medical.jpg',
      alt: 'A smiling woman beside vitamin D3, omega-3 fish oil, a digital thermometer and La Roche-Posay Cicaplast balm.',
    },
    beauty: {
      title: 'Beauty care | AVARA: skin care, hair care and cosmetics',
      desc: 'Shop skin care, hair care and cosmetics at AVARA: Avara Care, Avara Hair and Avara Cosmetics, with brands such as La Roche-Posay, CeraVe and Kérastase.',
      h1: 'AVARA — Beauty care', image: 'hero-beauty.jpg', hero: 'hero-beauty.jpg',
      alt: 'A woman with glowing skin beside beauty products from La Roche-Posay, Estée Lauder, Lancôme, Kérastase, MAC and NARS.',
    },
    athlete: {
      title: 'Athlete care | AVARA: recovery, hydration and protection',
      desc: 'Recovery, hydration, nutrition and sun protection for training days and rest days. Shop athlete care at AVARA.',
      h1: 'AVARA — Athlete care', image: 'hero-athlete.jpg', hero: 'hero-athlete.jpg',
      alt: 'A woman in sportswear with a towel and a water bottle, beside La Roche-Posay, Vichy, Kérastase and CeraVe products and a shaker.',
    },
  },
  ar: {
    medical: {
      title: 'AVARA | رعاية صحية ومستحضرات تجميل: الرعاية الطبية والجمال والرياضة',
      desc: 'AVARA متجر للرعاية الصحية ومستحضرات التجميل. نصائح طبية وأساسيات يومية، وعناية بالبشرة والشعر، واستشفاء للرياضيين. مستوحاة من الطبيعة، مصقولة بالعلم.',
      h1: 'AVARA — الرعاية الطبية', image: 'hero-banner.jpg', hero: 'hero-medical.jpg',
      alt: 'امرأة مبتسمة بجانب فيتامين D3 وزيت السمك أوميغا 3 وميزان حرارة رقمي ومرطّب لا روش بوزيه سيكابلاست.',
    },
    beauty: {
      title: 'العناية بالجمال | AVARA: بشرة وشعر ومستحضرات تجميل',
      desc: 'تسوّقي العناية بالبشرة والشعر ومستحضرات التجميل من AVARA: أفارا كير وأفارا هير وأفارا كوزمتكس، مع ماركات مثل لا روش بوزيه وسيرافي وكيراستاز.',
      h1: 'AVARA — العناية بالجمال', image: 'hero-beauty.jpg', hero: 'hero-beauty.jpg',
      alt: 'امرأة ببشرة مشرقة بجانب منتجات جمال من لا روش بوزيه وإستي لودر ولانكوم وكيراستاز وماك ونارس.',
    },
    athlete: {
      title: 'الرعاية الرياضية | AVARA: استشفاء وترطيب وحماية',
      desc: 'استشفاء وترطيب وتغذية وحماية من الشمس لأيام التمرين وأيام الراحة. تسوّق الرعاية الرياضية من AVARA.',
      h1: 'AVARA — الرعاية الرياضية', image: 'hero-athlete.jpg', hero: 'hero-athlete.jpg',
      alt: 'امرأة بملابس رياضية مع منشفة وزجاجة ماء بجانب منتجات لا روش بوزيه وفيشي وكيراستاز وسيرافي وشيكر.',
    },
  },
};

const abs = (u) => SITE + u;

function addMeta(doc, attrs) {
  const el = doc.createElement('meta');
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  doc.head.appendChild(el);
}
function addLink(doc, attrs) {
  const el = doc.createElement('link');
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  doc.head.appendChild(el);
}
function addLd(doc, id, obj) {
  const el = doc.createElement('script');
  el.type = 'application/ld+json';
  if (id) el.id = id;
  el.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
  doc.head.appendChild(el);
}

PAGES.forEach((page) => {
  const dom = new JSDOM(tpl);
  const doc = dom.window.document;
  const html = doc.documentElement;
  const meta = META[page.lang][page.panel];
  const ar = page.lang === 'ar';
  const other = PAGES.find((p) => p.panel === page.panel && p.lang !== page.lang);

  html.setAttribute('lang', page.lang);
  html.setAttribute('dir', ar ? 'rtl' : 'ltr');
  html.setAttribute('data-lang', page.lang);
  html.setAttribute('data-panel', page.panel);
  html.setAttribute('data-alt-url', other.url);

  // ---- Arabic pages ship translated text (the script keeps it in sync at runtime) ----
  if (ar) {
    const D = I18N.ar;
    doc.querySelectorAll('[data-i18n]').forEach((el) => { const v = D[el.getAttribute('data-i18n')]; if (v) el.textContent = v; });
    doc.querySelectorAll('[data-i18n-ph]').forEach((el) => { const v = D[el.getAttribute('data-i18n-ph')]; if (v) el.setAttribute('placeholder', v); });
    doc.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = D[el.getAttribute('data-i18n-aria')]; if (v) el.setAttribute('aria-label', v); });
    const lb = doc.getElementById('langBtn'); lb.textContent = D.langBtn; lb.setAttribute('lang', 'en');
  }

  // ---- English pages: fill any text that the template leaves to the script (e.g. the hero headlines) ----
  if (!ar) {
    doc.querySelectorAll('[data-i18n]').forEach((el) => {
      if (!el.textContent.trim()) { const v = I18N.en[el.getAttribute('data-i18n')]; if (v) el.textContent = v; }
    });
  }

  // ---- Which department is showing ----
  doc.querySelectorAll('.panel').forEach((p) => {
    if (p.getAttribute('data-panel') === page.panel) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
  });
  doc.querySelectorAll('#nav a[data-nav-panel]').forEach((a) => {
    if (a.getAttribute('data-nav-panel') === page.panel) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  // ---- Hero images: the visible one loads first, the hidden ones wait ----
  doc.querySelectorAll('.hero img').forEach((img) => {
    const panelName = img.closest('.panel').getAttribute('data-panel');
    if (panelName === page.panel) {
      img.setAttribute('fetchpriority', 'high');
      img.setAttribute('alt', meta.alt);
    } else {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('alt', META[page.lang][panelName].alt);
    }
  });
  const activePanelEl = doc.querySelector(`.panel[data-panel="${page.panel}"]`);
  const h1 = doc.createElement('h1');
  h1.className = 'sr-only';
  h1.textContent = meta.h1;
  activePanelEl.insertBefore(h1, activePanelEl.firstChild);

  // ---- Links: in-page anchors that live on another department become real URLs ----
  doc.querySelectorAll('a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href');
    const id = href.slice(1);
    if (!id) return;
    if (id.startsWith('panel-')) { a.setAttribute('href', urlOf(page.lang, id.slice(6))); return; }
    const target = doc.getElementById(id);
    const owner = target && target.closest('.panel');
    const pn = owner && owner.getAttribute('data-panel');
    if (pn && pn !== page.panel) {
      a.setAttribute('href', urlOf(page.lang, pn) + (id === pn ? '' : '#' + id));
    }
  });

  // ---- Head: replace the placeholder social tags with per-page ones ----
  doc.head.querySelectorAll('meta[property^="og:"], meta[name="description"], meta[name^="twitter:"], link[rel="canonical"], title').forEach((n) => n.remove());
  const title = doc.createElement('title'); title.textContent = meta.title; doc.head.appendChild(title);
  const pageUrl = abs(page.url);
  addMeta(doc, { name: 'description', content: meta.desc });
  addLink(doc, { rel: 'canonical', href: pageUrl });
  ['en', 'ar'].forEach((l) => addLink(doc, { rel: 'alternate', hreflang: l, href: abs(urlOf(l, page.panel)) }));
  addLink(doc, { rel: 'alternate', hreflang: 'x-default', href: abs(urlOf('en', page.panel)) });
  addMeta(doc, { property: 'og:site_name', content: 'AVARA' });
  addMeta(doc, { property: 'og:type', content: 'website' });
  addMeta(doc, { property: 'og:title', content: meta.title });
  addMeta(doc, { property: 'og:description', content: meta.desc });
  addMeta(doc, { property: 'og:url', content: pageUrl });
  addMeta(doc, { property: 'og:image', content: abs('/assets/' + meta.image) });
  addMeta(doc, { property: 'og:locale', content: ar ? 'ar_AR' : 'en_US' });
  addMeta(doc, { property: 'og:locale:alternate', content: ar ? 'en_US' : 'ar_AR' });
  addMeta(doc, { name: 'twitter:card', content: 'summary_large_image' });
  const heroBase = '/assets/' + meta.hero.replace(/\.jpg$/, '');
  addLink(doc, { rel: 'preload', as: 'image', href: heroBase + '-1536.webp', imagesrcset: heroBase + '-800.webp 800w, ' + heroBase + '-1536.webp 1536w', imagesizes: '100vw', fetchpriority: 'high' });

  // ---- Structured data ----
  if (page.panel === 'medical') {
    addLd(doc, 'ld-business', {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: 'AVARA', inLanguage: ['en', 'ar'] },
        {
          '@type': 'HealthAndBeautyBusiness', '@id': abs('/#business'), name: 'AVARA', url: abs('/'),
          logo: abs('/assets/logo.png'), image: abs('/assets/hero-banner.jpg'),
          slogan: 'Inspired by Nature. Perfected by Science.',
          telephone: '+96176681395', email: 'souna.92@gmail.com',
        },
      ],
    });
  } else {
    addLd(doc, null, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AVARA', item: abs(urlOf(page.lang, 'medical')) },
        { '@type': 'ListItem', position: 2, name: ar ? I18N.ar['nav_' + page.panel + '_full'] : I18N.en['nav_' + page.panel + '_full'], item: pageUrl },
      ],
    });
  }

  const out = path.join(ROOT, page.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, dom.serialize());
  console.log('wrote', page.file, '->', page.url);
});
