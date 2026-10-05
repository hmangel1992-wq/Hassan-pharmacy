// Vercel serverless function: GET /p/<slug>-<id>  and  /ar/p/<slug>-<id>
// (vercel.json rewrites those paths here). Returns a real, server-rendered product page
// with its own title, description, social preview image and Product structured data,
// so Google and WhatsApp can read it without running any JavaScript.

const SITE = (process.env.SITE_URL || 'https://avara-nu-beige.vercel.app').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wmmgzwjiaoyjilftkjir.supabase.co').replace(/\/$/, '');
// The anon key is public by design (it is also in config.js); row-level security protects the data.
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtbWd6d2ppYW95amlsZnRramlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzMxNzAsImV4cCI6MjEwNTgwOTE3MH0.ta9s3UliyYC12vnZhaeySGgrVydKm5tqSF4xVIRwr0k';
const WA = '96176681395';
const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n).toFixed(2);

function slugify(s) {
  const x = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return x || 'product';
}

const DEPT = {
  medical: { en: 'Medical care', ar: 'الرعاية الطبية', path: '' },
  athlete: { en: 'Athlete care', ar: 'الرعاية الرياضية', path: 'athlete' },
  beauty: { en: 'Beauty care', ar: 'العناية بالجمال', path: 'beauty' },
};

const TXT = {
  en: { home: 'Home', brand: 'Brand', size: 'Size', inStock: 'In stock', low: 'Only {n} left', out: 'Out of stock', shop: 'Shop in the store',
        ask: 'Ask on WhatsApp', related: 'You may also like', policies: 'Privacy and policies', lang: 'العربية', wa: 'Hello AVARA, I have a question about: {name}',
        notFound: 'Product not found', back: 'Back to the store', tag: 'Inspired by Nature. Perfected by Science', rights: '© 2026 AVARA. All rights reserved.' },
  ar: { home: 'الرئيسية', brand: 'العلامة', size: 'الحجم', inStock: 'متوفر', low: 'متبقّي {n} فقط', out: 'غير متوفر', shop: 'تسوّق في المتجر',
        ask: 'اسأل عبر واتساب', related: 'قد يعجبك أيضاً', policies: 'الخصوصية والسياسات', lang: 'English', wa: 'مرحباً AVARA، لدي سؤال عن: {name}',
        notFound: 'المنتج غير موجود', back: 'العودة إلى المتجر', tag: 'مستوحاة من الطبيعة، مصقولة بالعلم', rights: '© 2026 AVARA. جميع الحقوق محفوظة.' },
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
body{font-family:var(--font);line-height:1.65;color:var(--ink);background:var(--ivory);-webkit-font-smoothing:antialiased}
a{color:var(--teal-deep)}
.bar{background:var(--teal-deep);color:#fff;text-align:center;font-size:.84rem;letter-spacing:.12em;padding:9px 16px}
[lang=ar] .bar{letter-spacing:0}
header{background:rgba(250,249,246,.96);border-bottom:1px solid var(--mint-2)}
.head{width:min(1000px,100% - 48px);margin-inline:auto;padding:16px 0;display:flex;align-items:center;justify-content:space-between;gap:16px}
.head img{height:26px;width:auto;display:block}
.head a{text-decoration:none;color:var(--ink);font-size:.95rem}
main{width:min(1000px,100% - 48px);margin-inline:auto;padding:32px 0 80px}
.crumbs{font-size:.88rem;color:var(--ink-soft);margin-bottom:22px}
.crumbs a{color:var(--ink-soft)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start}
.media{aspect-ratio:4/5;background:radial-gradient(ellipse at 50% 35%,#fff 0%,var(--mint) 62%,var(--mint-2) 100%);display:grid;place-items:center;overflow:hidden}
.media img{width:100%;height:100%;object-fit:cover}
.cat{font-size:.82rem;color:var(--ink-soft);font-weight:500;letter-spacing:.06em}
[lang=ar] .cat{letter-spacing:0}
h1{font-size:clamp(1.6rem,3.4vw,2.2rem);font-weight:400;line-height:1.2;margin:6px 0 12px}
.price{font-size:1.5rem;font-weight:500;margin:6px 0}
.price del{font-size:1rem;color:var(--ink-soft);font-weight:400;margin-inline-end:8px}
.price ins{text-decoration:none;color:var(--teal-deep);font-weight:600}
.meta{color:var(--ink-soft);margin-bottom:6px}
.stock{font-weight:500;margin:8px 0}
.stock.low{color:#9A5B00}.stock.out{color:#8A2E20}
.desc{color:var(--ink-soft);margin:14px 0 22px}
.btns{display:grid;gap:10px;max-width:360px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.4rem;font-weight:500;font-size:.95rem;text-decoration:none;border:1px solid var(--teal-deep);border-radius:2px}
.btn.solid{background:var(--teal-deep);color:#fff}
.btn.solid:hover{background:var(--ink);border-color:var(--ink)}
.btn.line{color:var(--ink)}.btn.line:hover{background:var(--mint)}
.rel{margin-top:28px;border-top:1px solid var(--mint-2)}
.rel h2{font-size:1rem;font-weight:500;margin:14px 0 6px}
.rel a{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--mint-2);text-decoration:none;color:var(--ink)}
.rel a:hover{color:var(--teal-deep)}
footer{background:var(--teal-deep);color:#fff;text-align:center;font-size:.88rem;padding:20px 16px}
footer a{color:#fff}
@media(max-width:760px){.grid{grid-template-columns:1fr;gap:22px}}
`;

function shell({ lang, title, desc, canonical, alternates, ogImage, ld, body, noindex }) {
  const T = TXT[lang];
  const alts = (alternates || []).map((a) => `<link rel="alternate" hreflang="${a.l}" href="${esc(a.href)}">`).join('\n');
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
<meta property="og:type" content="${noindex ? 'website' : 'product'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
<style>${STYLE}</style>
</head>
<body>
<div class="bar">${esc(T.tag)}</div>
<header><div class="head">
  <a href="${lang === 'ar' ? '/ar/' : '/'}" aria-label="AVARA"><img src="/assets/logo.png" alt="AVARA" width="132" height="26"></a>
  <a href="${esc((alternates || []).filter((a) => a.l !== lang && a.l !== 'x-default').map((a) => a.href.replace(SITE, ''))[0] || (lang === 'ar' ? '/' : '/ar/'))}">${esc(T.lang)}</a>
</div></header>
${body}
<footer><a href="/policies">${esc(T.policies)}</a><br>${esc(T.rights)}</footer>
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
  const body = `<main><h1>${esc(T.notFound)}</h1><p style="margin:16px 0"><a href="${lang === 'ar' ? '/ar/' : '/'}">${esc(T.back)}</a></p></main>`;
  return send(res, 404, shell({ lang, title: T.notFound + ' | AVARA', desc: T.notFound, body, noindex: true }), 'public, s-maxage=60');
}

module.exports = async function handler(req, res) {
  const lang = req.query.lang === 'ar' ? 'ar' : 'en';
  const T = TXT[lang];
  const slugParam = String(req.query.slug || '');
  const m = slugParam.match(UUID);
  if (!m) return notFound(res, lang);
  const id = m[1].toLowerCase();

  try {
    const rows = await rest(`products?id=eq.${id}&is_active=eq.true&select=*&limit=1`);
    const p = rows && rows[0];
    if (!p) return notFound(res, lang);

    const prefix = lang === 'ar' ? '/ar' : '';
    const slug = slugify(p.name_en) + '-' + p.id;
    const canonicalPath = `${prefix}/p/${slug}`;
    // One address per product: send old or mistyped slugs to the right one.
    if (slugParam.toLowerCase() !== slug.toLowerCase()) {
      res.setHeader('Location', canonicalPath);
      res.status(301);
      return res.end();
    }

    const dept = DEPT[p.dept] || DEPT.medical;
    const name = lang === 'ar' ? (p.name_ar || p.name_en) : p.name_en;
    const desc = (lang === 'ar' ? (p.desc_ar || p.desc_en) : p.desc_en) || '';
    const size = lang === 'ar' ? (p.size_ar || p.size_en) : p.size_en;
    const images = (Array.isArray(p.images) && p.images.length ? p.images : (p.image_url ? [p.image_url] : [])).filter(Boolean);
    const now = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
    const stock = p.stock == null ? null : Number(p.stock);
    const out = stock != null && stock <= 0;
    const low = stock != null && stock > 0 && stock <= 5;
    const pageTitle = `${name}${p.brand ? ' · ' + p.brand : ''} | AVARA`;
    const metaDesc = (desc || `${name} — ${lang === 'ar' ? dept.ar : dept.en}`).slice(0, 200);

    const canonical = SITE + canonicalPath;
    const otherPrefix = lang === 'ar' ? '' : '/ar';
    const alternates = [
      { l: 'en', href: SITE + '/p/' + slug },
      { l: 'ar', href: SITE + '/ar/p/' + slug },
      { l: 'x-default', href: SITE + '/p/' + slug },
    ];

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name, sku: p.id,
      description: desc || undefined,
      image: images.length ? images : undefined,
      brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
      offers: {
        '@type': 'Offer', url: canonical, priceCurrency: 'USD', price: now.toFixed(2),
        availability: out ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };

    let related = [];
    try {
      related = await rest(`products?dept=eq.${p.dept}&cat=eq.${encodeURIComponent(p.cat)}&is_active=eq.true&id=neq.${p.id}&stock=gt.0&select=id,name_en,name_ar,price,sale_price&order=sort_order&limit=4`);
    } catch (e) { related = []; }

    const deptHref = `${prefix}${dept.path ? '/' + dept.path : '/'}`;
    const shopHref = `${deptHref}#p-${p.id}`;
    const wa = `https://wa.me/${WA}?text=${encodeURIComponent(T.wa.replace('{name}', name))}`;
    const priceHtml = p.sale_price != null
      ? `<span class="price" dir="ltr"><del>${money(p.price)}</del><ins>${money(p.sale_price)}</ins></span>`
      : `<span class="price" dir="ltr">${money(p.price)}</span>`;

    const body = `<main>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix || ''}/">${esc(T.home)}</a> › <a href="${esc(deptHref)}">${esc(lang === 'ar' ? dept.ar : dept.en)}</a> › ${esc(name)}</nav>
  <div class="grid">
    <div class="media">${images[0] ? `<img src="${esc(images[0])}" alt="${esc(name)}" width="800" height="1000" fetchpriority="high">` : ''}</div>
    <div>
      <p class="cat">${p.brand ? esc(p.brand) : esc(lang === 'ar' ? dept.ar : dept.en)}</p>
      <h1>${esc(name)}</h1>
      ${priceHtml}
      ${size ? `<p class="meta">${esc(T.size)}: ${esc(size)}</p>` : ''}
      <p class="stock ${out ? 'out' : low ? 'low' : ''}">${esc(out ? T.out : low ? T.low.replace('{n}', stock) : T.inStock)}</p>
      ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
      <div class="btns">
        ${out ? '' : `<a class="btn solid" href="${esc(shopHref)}">${esc(T.shop)}</a>`}
        <a class="btn line" href="${wa}" target="_blank" rel="noopener">${esc(T.ask)}</a>
      </div>
      ${related.length ? `<div class="rel"><h2>${esc(T.related)}</h2>${related.map((r) => {
        const rn = lang === 'ar' ? (r.name_ar || r.name_en) : r.name_en;
        const rp = r.sale_price != null ? r.sale_price : r.price;
        return `<a href="${prefix}/p/${slugify(r.name_en)}-${r.id}"><span>${esc(rn)}</span><span dir="ltr">${money(rp)}</span></a>`;
      }).join('')}</div>` : ''}
    </div>
  </div>
</main>`;

    return send(res, 200, shell({ lang, title: pageTitle, desc: metaDesc, canonical, alternates, ogImage: images[0], ld, body }),
      'public, s-maxage=300, stale-while-revalidate=86400');
  } catch (err) {
    console.error('product page failed', err);
    return send(res, 502, shell({ lang, title: 'AVARA', desc: 'AVARA', body: '<main><p>Please try again shortly.</p></main>', noindex: true }), 'no-store');
  }
};
