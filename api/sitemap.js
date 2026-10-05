// Vercel serverless function: GET /sitemap.xml (vercel.json rewrites it here).
// Lists the department pages and every visible product, in English and Arabic,
// with language alternates, so search engines discover new products automatically.

const SITE = (process.env.SITE_URL || 'https://avara-nu-beige.vercel.app').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://wmmgzwjiaoyjilftkjir.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtbWd6d2ppYW95amlsZnRramlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzMxNzAsImV4cCI6MjEwNTgwOTE3MH0.ta9s3UliyYC12vnZhaeySGgrVydKm5tqSF4xVIRwr0k';

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function slugify(s) {
  const x = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return x || 'product';
}

function entry(en, ar) {
  const links = ar
    ? `<xhtml:link rel="alternate" hreflang="en" href="${esc(SITE + en)}"/><xhtml:link rel="alternate" hreflang="ar" href="${esc(SITE + ar)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(SITE + en)}"/>`
    : '';
  const one = (u) => `<url><loc>${esc(SITE + u)}</loc>${links}</url>`;
  return one(en) + (ar ? one(ar) : '');
}

module.exports = async function handler(req, res) {
  let products = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?is_active=eq.true&select=id,name_en&order=sort_order&limit=5000`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (r.ok) products = await r.json();
    else console.error('sitemap: supabase', r.status);
  } catch (e) { console.error('sitemap failed', e); }

  const pages = [['/', '/ar/'], ['/beauty', '/ar/beauty'], ['/athlete', '/ar/athlete']].map(([en, ar]) => entry(en, ar)).join('') +
    `<url><loc>${esc(SITE + '/policies')}</loc></url>`;
  const prods = products.map((p) => { const s = slugify(p.name_en) + '-' + p.id; return entry('/p/' + s, '/ar/p/' + s); }).join('');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${pages}${prods}</urlset>`
  );
};
