// Vercel serverless function:
//   GET /articles, /ar/articles            -> list of published articles
//   GET /articles/<slug>, /ar/articles/<slug> -> one article
// (vercel.json rewrites those paths here). Pages are rendered on the server so Google and
// WhatsApp can read them without running JavaScript. Articles are written in admin.html > Articles.

const SITE = (process.env.SITE_URL || 'https://avaracare.online').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wmmgzwjiaoyjilftkjir.supabase.co').replace(/\/$/, '');
// The anon key is public by design (it is also in config.js); row-level security protects the data.
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtbWd6d2ppYW95amlsZnRramlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzMxNzAsImV4cCI6MjEwNTgwOTE3MH0.ta9s3UliyYC12vnZhaeySGgrVydKm5tqSF4xVIRwr0k';
const DOMAIN = 'avaracare.online';   // the Plausible site name
const WA = '96176681395';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DEPT = {
  medical: { en: 'Medical care', ar: 'الرعاية الطبية', path: 'medical' },
  athlete: { en: 'Athlete care', ar: 'الرعاية الرياضية', path: 'athlete' },
  beauty: { en: 'Beauty care', ar: 'العناية بالجمال', path: 'beauty' },
};

const TXT = {
  en: { home: 'Home', articles: 'Health & care advice', lead: 'Practical, easy-to-follow advice for your health, your training and your skin, from the AVARA team.',
        all: 'All', read: 'Read article', none: 'No articles yet. Please check back soon.', shop: 'Shop {dept}', ask: 'Ask us on WhatsApp',
        disclaimer: 'This article is general information. It does not replace advice from a doctor or pharmacist.', updated: 'Updated',
        policies: 'Privacy and policies', lang: 'العربية', notFound: 'Article not found', back: 'All articles',
        tag: 'Inspired by Nature. Perfected by Science', rights: '© 2026 AVARA. All rights reserved.', wa: 'Hello AVARA, I have a question about: {title}' },
  ar: { home: 'الرئيسية', articles: 'نصائح الصحة والعناية', lead: 'نصائح عملية وسهلة لصحتك وتمارينك وبشرتك، من فريق AVARA.',
        all: 'الكل', read: 'اقرأ المقال', none: 'لا توجد مقالات بعد. يرجى العودة قريباً.', shop: 'تسوّق {dept}', ask: 'اسألنا عبر واتساب',
        disclaimer: 'هذا المقال معلومات عامة ولا يغني عن استشارة الطبيب أو الصيدلي.', updated: 'آخر تحديث',
        policies: 'الخصوصية والسياسات', lang: 'English', notFound: 'المقال غير موجود', back: 'كل المقالات',
        tag: 'مستوحاة من الطبيعة، مصقولة بالعلم', rights: '© 2026 AVARA. جميع الحقوق محفوظة.', wa: 'مرحباً AVARA، لدي سؤال عن: {title}' },
};

async function rest(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}

const STYLE = `
:root{--teal:#2F8F9D;--teal-deep:#1F5F6B;--mint:#DFF4F1;--mint-2:#C6E5E0;--ivory:#FAF9F6;--ink:#2C2C2C;--ink-soft:#5B5F5F;--font:'Jost','Tajawal',system-ui,-apple-system,'Segoe UI',sans-serif}
[lang=ar]{--font:'Tajawal','Jost',system-ui,-apple-system,'Segoe UI',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);line-height:1.7;color:var(--ink);background:var(--ivory);-webkit-font-smoothing:antialiased}
a{color:var(--teal-deep)}
.bar{background:var(--teal-deep);color:#fff;text-align:center;font-size:.84rem;letter-spacing:.12em;padding:9px 16px}
[lang=ar] .bar{letter-spacing:0}
header{background:rgba(250,249,246,.96);border-bottom:1px solid var(--mint-2)}
.head{width:min(1000px,100% - 48px);margin-inline:auto;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:16px}
.head img{height:26px;width:auto;display:block}
.head a{text-decoration:none;color:var(--ink);font-size:.95rem}
main{width:min(760px,100% - 48px);margin-inline:auto;padding:32px 0 80px}
main.wide{width:min(1000px,100% - 48px)}
.crumbs{font-size:.88rem;color:var(--ink-soft);margin-bottom:22px}
.crumbs a{color:var(--ink-soft)}
h1{font-size:clamp(1.7rem,3.6vw,2.4rem);font-weight:400;line-height:1.25;margin:6px 0 12px}
.lead{color:var(--ink-soft);margin-bottom:22px;max-width:60ch}
.cat{font-size:.82rem;color:var(--teal-deep);font-weight:500;letter-spacing:.06em;text-transform:uppercase}
[lang=ar] .cat{letter-spacing:0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px}
.chips a{padding:6px 14px;border:1px solid var(--teal-deep);border-radius:999px;text-decoration:none;color:var(--ink);font-size:.9rem}
.chips a[aria-current=true]{background:var(--teal-deep);color:#fff}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:22px}
.card{background:#fff;border:1px solid var(--mint-2);display:flex;flex-direction:column;text-decoration:none;color:var(--ink)}
.card:hover{border-color:var(--teal-deep)}
.card__img{aspect-ratio:16/9;background:radial-gradient(ellipse at 50% 35%,#fff 0%,var(--mint) 62%,var(--mint-2) 100%);overflow:hidden}
.card__img img{width:100%;height:100%;object-fit:cover;display:block}
.card__body{padding:18px 18px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h2{font-size:1.15rem;font-weight:500;line-height:1.35}
.card p{color:var(--ink-soft);font-size:.95rem}
.card__more{margin-top:auto;color:var(--teal-deep);font-weight:500;font-size:.92rem}
.hero{margin:18px 0 26px;aspect-ratio:16/9;overflow:hidden;background:var(--mint)}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.meta{color:var(--ink-soft);font-size:.88rem;margin-bottom:18px}
.prose h2{font-size:1.3rem;font-weight:500;margin:28px 0 8px}
.prose p{margin:0 0 16px}
.prose ul{margin:0 0 18px;padding-inline-start:1.3rem}
.prose li{margin-bottom:6px}
.note{margin:30px 0 24px;padding:14px 16px;background:var(--mint);font-size:.9rem;color:var(--ink-soft)}
.btns{display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.4rem;font-weight:500;font-size:.95rem;text-decoration:none;border:1px solid var(--teal-deep);border-radius:2px}
.btn.solid{background:var(--teal-deep);color:#fff}
.btn.solid:hover{background:var(--ink);border-color:var(--ink)}
.btn.line{color:var(--ink)}.btn.line:hover{background:var(--mint)}
footer{background:var(--teal-deep);color:#fff;text-align:center;font-size:.88rem;padding:20px 16px}
footer a{color:#fff}
`;

// Turns the plain-text body written in admin into safe HTML:
// blank line = new paragraph, "## " = heading, "- " = bullet list. Everything is escaped.
function renderBody(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(esc).join(' ') + '</p>'); para = []; } };
  const flushList = () => { if (list.length) { out.push('<ul>' + list.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith('## ')) { flushPara(); flushList(); out.push('<h2>' + esc(line.slice(3).trim()) + '</h2>'); continue; }
    if (/^[-*] /.test(line)) { flushPara(); list.push(line.slice(2).trim()); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
}

function shell({ lang, title, desc, canonical, alternates, ogImage, ld, body, noindex, ogType }) {
  const T = TXT[lang];
  const alts = (alternates || []).map((a) => `<link rel="alternate" hreflang="${a.l}" href="${esc(a.href)}">`).join('\n');
  const other = (alternates || []).filter((a) => a.l !== lang && a.l !== 'x-default')[0];
  const switchHref = other ? other.href.replace(SITE, '') : (lang === 'ar' ? '/articles' : '/ar/articles');
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
${alts}
<meta name="theme-color" content="#2F8F9D">
<meta property="og:site_name" content="AVARA">
<meta property="og:type" content="${ogType || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
<script defer data-domain="${DOMAIN}" src="https://plausible.io/js/script.js"></script>
<script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>
<style>${STYLE}</style>
</head>
<body>
<div class="bar">${esc(T.tag)}</div>
<header><div class="head">
  <a href="${lang === 'ar' ? '/ar/' : '/'}" aria-label="AVARA"><img src="/assets/logo.png" alt="AVARA" width="132" height="26"></a>
  <a href="${esc(switchHref)}">${esc(T.lang)}</a>
</div></header>
${body}
<footer><a href="/policies">${esc(T.policies)}</a><br>${esc(T.rights)}</footer>
<script src="/assets/float-contact.js" defer></script>
</body>
</html>`;
}

function send(res, status, html, cache) {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  return res.send(html);
}

function notFound(res, lang) {
  const T = TXT[lang];
  const p = lang === 'ar' ? '/ar/articles' : '/articles';
  const body = `<main><h1>${esc(T.notFound)}</h1><p style="margin:16px 0"><a href="${p}">${esc(T.back)}</a></p></main>`;
  return send(res, 404, shell({ lang, title: T.notFound + ' | AVARA', desc: T.notFound, body, noindex: true }), 'public, s-maxage=60');
}

const has = (a, lang) => !!(a['title_' + lang] && a['body_' + lang]);

async function list(req, res, lang) {
  const T = TXT[lang];
  const prefix = lang === 'ar' ? '/ar' : '';
  const cat = DEPT[req.query.cat] ? String(req.query.cat) : '';
  const rows = await rest('articles?is_published=eq.true&select=slug,category,title_en,title_ar,summary_en,summary_ar,body_en,body_ar,image_url,published_at&order=published_at.desc&limit=200');
  const items = rows.filter((a) => has(a, lang) && (!cat || a.category === cat));
  const chips = ['', 'medical', 'athlete', 'beauty'].map((c) =>
    `<a href="${prefix}/articles${c ? '?cat=' + c : ''}"${c === cat ? ' aria-current="true"' : ''}>${esc(c ? DEPT[c][lang] : T.all)}</a>`).join('');
  const cards = items.map((a) => {
    const t = a['title_' + lang], s = a['summary_' + lang];
    return `<a class="card" href="${prefix}/articles/${esc(a.slug)}">
  <div class="card__img">${a.image_url ? `<img src="${esc(a.image_url)}" alt="" loading="lazy" width="640" height="360">` : ''}</div>
  <div class="card__body"><span class="cat">${esc(DEPT[a.category] ? DEPT[a.category][lang] : '')}</span><h2>${esc(t)}</h2>${s ? `<p>${esc(s)}</p>` : ''}<span class="card__more">${esc(T.read)} ›</span></div></a>`;
  }).join('');
  const canonical = SITE + prefix + '/articles';
  const alternates = [{ l: 'en', href: SITE + '/articles' }, { l: 'ar', href: SITE + '/ar/articles' }, { l: 'x-default', href: SITE + '/articles' }];
  const body = `<main class="wide">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}/">${esc(T.home)}</a> › ${esc(T.articles)}</nav>
  <h1>${esc(T.articles)}</h1>
  <p class="lead">${esc(T.lead)}</p>
  <div class="chips">${chips}</div>
  ${items.length ? `<div class="list">${cards}</div>` : `<p class="lead">${esc(T.none)}</p>`}
</main>`;
  return send(res, 200, shell({ lang, title: `${T.articles} | AVARA`, desc: T.lead, canonical, alternates, body, noindex: !!cat }),
    'public, s-maxage=300, stale-while-revalidate=86400');
}

async function one(req, res, lang, slug) {
  const T = TXT[lang];
  if (!SLUG.test(slug)) return notFound(res, lang);
  const rows = await rest(`articles?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*&limit=1`);
  const a = rows && rows[0];
  if (!a) return notFound(res, lang);
  if (!has(a, lang)) {
    const other = lang === 'ar' ? 'en' : 'ar';
    if (has(a, other)) { res.setHeader('Location', (other === 'ar' ? '/ar' : '') + '/articles/' + slug); res.status(302); return res.end(); }
    return notFound(res, lang);
  }
  const prefix = lang === 'ar' ? '/ar' : '';
  const title = a['title_' + lang];
  const summary = a['summary_' + lang] || '';
  const dept = DEPT[a.category] || DEPT.medical;
  const canonical = `${SITE}${prefix}/articles/${slug}`;
  const alternates = [];
  if (has(a, 'en')) alternates.push({ l: 'en', href: `${SITE}/articles/${slug}` });
  if (has(a, 'ar')) alternates.push({ l: 'ar', href: `${SITE}/ar/articles/${slug}` });
  alternates.push({ l: 'x-default', href: `${SITE}${has(a, 'en') ? '' : '/ar'}/articles/${slug}` });
  const published = a.published_at || a.created_at;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description: summary || undefined,
    image: a.image_url ? [a.image_url] : undefined, inLanguage: lang,
    datePublished: published, dateModified: a.updated_at || published,
    mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: 'AVARA' },
  };
  const date = new Date(a.updated_at || published).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' });
  const deptHref = `${prefix}${dept.path ? '/' + dept.path : '/'}`;
  const wa = `https://wa.me/${WA}?text=${encodeURIComponent(T.wa.replace('{title}', title))}`;
  const body = `<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}/">${esc(T.home)}</a> › <a href="${prefix}/articles">${esc(T.articles)}</a></nav>
  <span class="cat">${esc(dept[lang])}</span>
  <h1>${esc(title)}</h1>
  <p class="meta">${esc(T.updated)} ${esc(date)}</p>
  ${a.image_url ? `<div class="hero"><img src="${esc(a.image_url)}" alt="${esc(title)}" width="1000" height="563" fetchpriority="high"></div>` : ''}
  <article class="prose">${renderBody(a['body_' + lang])}</article>
  <p class="note">${esc(T.disclaimer)}</p>
  <div class="btns">
    <a class="btn solid" href="${esc(deptHref)}">${esc(T.shop.replace('{dept}', dept[lang]))}</a>
    <a class="btn line" href="${wa}" target="_blank" rel="noopener">${esc(T.ask)}</a>
  </div>
</main>`;
  return send(res, 200, shell({ lang, title: `${title} | AVARA`, desc: (summary || title).slice(0, 200), canonical, alternates, ogImage: a.image_url, ld, body, ogType: 'article' }),
    'public, s-maxage=300, stale-while-revalidate=86400');
}

module.exports = async function handler(req, res) {
  const lang = req.query.lang === 'ar' ? 'ar' : 'en';
  const slug = String(req.query.slug || '').toLowerCase();
  try {
    return slug ? await one(req, res, lang, slug) : await list(req, res, lang);
  } catch (err) {
    console.error('articles failed', err);
    return send(res, 502, shell({ lang, title: 'AVARA', desc: 'AVARA', body: '<main><p>Please try again shortly.</p></main>', noindex: true }), 'no-store');
  }
};
module.exports.renderBody = renderBody;
