#!/usr/bin/env node
/*
 * AVARA — Phase 4 step 6 patch (articles)
 *   1. vercel.json : adds the /articles and /ar/articles addresses.
 *   2. api/sitemap.js (or sitemap.js) : lists the articles for Google.
 * Run from the project root:   node apply-articles-patch.js
 * Safe to run twice.
 */
const fs = require('fs');

function patchVercel() {
  const file = 'vercel.json';
  if (!fs.existsSync(file)) { console.log('vercel.json not found: run this from the project root'); return false; }
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const cfg = JSON.parse(raw);
  cfg.rewrites = cfg.rewrites || [];
  const want = [
    { source: '/articles/:slug', destination: '/api/articles?lang=en&slug=:slug' },
    { source: '/ar/articles/:slug', destination: '/api/articles?lang=ar&slug=:slug' },
    { source: '/articles', destination: '/api/articles?lang=en' },
    { source: '/ar/articles', destination: '/api/articles?lang=ar' },
  ];
  let added = 0;
  want.forEach((w) => {
    if (cfg.rewrites.some((r) => r.source === w.source)) return;
    // keep them near the top, before any broad rule
    cfg.rewrites.unshift(w); added++;
  });
  if (added) {
    let out = JSON.stringify(cfg, null, 2) + '\n';
    if (crlf) out = out.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, out);
  }
  console.log('vercel.json: ' + (added ? added + ' rewrite(s) added' : 'already up to date'));
  return true;
}

function patchSitemap() {
  const file = ['api/sitemap.js', 'sitemap.js'].find((f) => fs.existsSync(f));
  if (!file) { console.log('sitemap.js not found, skipped'); return; }
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  let t = raw.replace(/\r\n/g, '\n');
  if (t.includes('articles?is_published')) { console.log(file + ': already up to date'); return; }

  const a1 = "  const pages = [['/', '/ar/'], ['/beauty', '/ar/beauty'], ['/athlete', '/ar/athlete']]";
  const a2 = '${pages}${prods}</urlset>';
  if (t.split(a1).length !== 2 || t.split(a2).length !== 2) {
    console.error(file + ': could not find the expected lines. Nothing changed. Send me this file and I will adjust the patch.');
    process.exit(1);
  }
  const block =
`  // Published articles (English and Arabic pages only when that language has been written).
  let articles = [];
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/articles?is_published=eq.true&select=slug,title_en,body_en,title_ar,body_ar&order=published_at.desc&limit=1000\`, {
      headers: { apikey: ANON, Authorization: \`Bearer \${ANON}\` },
    });
    if (r.ok) articles = await r.json();
    else console.error('sitemap: articles', r.status);
  } catch (e) { console.error('sitemap articles failed', e); }
  const arts = articles.map((a) => {
    const en = a.title_en && a.body_en, ar = a.title_ar && a.body_ar;
    if (en && ar) return entry('/articles/' + a.slug, '/ar/articles/' + a.slug);
    if (en) return \`<url><loc>\${esc(SITE + '/articles/' + a.slug)}</loc></url>\`;
    if (ar) return \`<url><loc>\${esc(SITE + '/ar/articles/' + a.slug)}</loc></url>\`;
    return '';
  }).join('');

`;
  t = t.replace(a1, () => block + a1.replace("['/athlete', '/ar/athlete']]", "['/athlete', '/ar/athlete'], ['/articles', '/ar/articles']]"));
  t = t.replace(a2, () => '${pages}${prods}${arts}</urlset>');
  fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
  console.log(file + ': articles added');
}

if (patchVercel()) patchSitemap();
console.log('\nDone. Make sure api/articles.js is in your api folder, then commit and push.');
