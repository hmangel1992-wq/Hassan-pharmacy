#!/usr/bin/env node
/*
 * AVARA — new domain: avaracare.online
 *
 *   1. Replaces avara-nu-beige.vercel.app with avaracare.online in every page, script, manifest, robots.txt
 *      and sitemap file of the project: canonical links, social previews, structured data, the sitemap address,
 *      and the Plausible site name (data-domain).
 *   2. Adds a permanent redirect in vercel.json so the old address sends people to the same page on the new one.
 *      The /api/ paths are left out on purpose, so an order-alert webhook that still points at the old address keeps working.
 *
 * Run from the project root:   node apply-domain-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. Nothing is written unless every file can be read. Every changed file gets a .bak copy.
 * To preview without changing anything:   node apply-domain-patch.js --check
 */
const fs = require('fs');
const path = require('path');

const OLD = 'avara-nu-beige.vercel.app';
const NEW = 'avaracare.online';
const CHECK = process.argv.includes('--check');

const TEXT = /\.(html|js|json|txt|xml|webmanifest|css|md)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', '.vercel', 'vendor', 'claude']);
const SKIP_FILE = /(\.bak$|package-lock\.json$|skills-lock\.json$|^apply-.*\.js$|^vercel\.json$|supabase.*\.js$)/i;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, out); }
    else if (TEXT.test(e.name) && !SKIP_FILE.test(e.name)) out.push(p);
  }
  return out;
}

const plan = [];
let total = 0;
for (const f of walk('.', [])) {
  const raw = fs.readFileSync(f, 'utf8');
  const n = raw.split(OLD).length - 1;
  if (!n) continue;
  total += n;
  plan.push({ file: f, raw, out: raw.split(OLD).join(NEW), n });
}

// vercel.json: permanent redirect from the old address (not for /api/ paths).
let vercel = null;
if (fs.existsSync('vercel.json')) {
  const raw = fs.readFileSync('vercel.json', 'utf8');
  let j;
  try { j = JSON.parse(raw); } catch (e) { console.error('vercel.json is not valid JSON. Nothing was changed.'); process.exit(1); }
  j.redirects = j.redirects || [];
  const has = j.redirects.some((r) => (r.has || []).some((h) => h.value === OLD));
  if (!has) {
    j.redirects.push({
      source: '/((?!api/).*)',
      has: [{ type: 'host', value: OLD }],
      destination: 'https://' + NEW + '/$1',
      permanent: true,
    });
    vercel = { file: 'vercel.json', raw, out: JSON.stringify(j, null, 2) + (raw.includes('\r\n') ? '\r\n' : '\n') };
    if (raw.includes('\r\n')) vercel.out = vercel.out.replace(/\n/g, '\r\n');
  }
} else {
  console.log('vercel.json not found: the redirect from the old address was skipped.');
}

if (!plan.length && !vercel) { console.log('Already up to date: ' + OLD + ' is not mentioned any more and the redirect is in place.'); process.exit(0); }

plan.forEach((p) => console.log((CHECK ? 'would change ' : 'changing ') + p.file + ' (' + p.n + ' place' + (p.n > 1 ? 's' : '') + ')'));
if (vercel) console.log((CHECK ? 'would add ' : 'adding ') + 'redirect from ' + OLD + ' in vercel.json');
if (CHECK) { console.log('\nNothing was changed (preview only).'); process.exit(0); }

for (const p of plan.concat(vercel ? [vercel] : [])) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
}
console.log('\nDone: ' + total + ' mentions replaced. Next: node tools/build-pages.js   then commit and push.');
