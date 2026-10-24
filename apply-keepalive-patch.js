#!/usr/bin/env node
/*
 * AVARA — daily "keep alive" ping so the free Supabase project is never paused for inactivity
 *
 *   Supabase's free plan pauses a project after 7 days without activity. This adds:
 *     api/keepalive.js   a tiny page that reads one product row from Supabase (nothing is changed or stored)
 *     vercel.json        a Vercel Cron Job that calls it once a day (06:00 UTC)
 *   Real visitors and orders also count as activity; this is the safety net for quiet weeks.
 *
 * It copies the Supabase address and public (anon) key from your existing api/sitemap.js, so nothing new to type.
 *
 * Run from the project root:   node apply-keepalive-patch.js
 * Then push. (Cron jobs run on the production deployment only.)
 * Safe to run twice. If something it expects is missing, it changes nothing at all and tells you.
 */
const fs = require('fs');

const problems = [];
if (!fs.existsSync('api') || !fs.statSync('api').isDirectory()) problems.push('There is no api folder here. Run this from the project root.');
if (!fs.existsSync('vercel.json')) problems.push('vercel.json was not found. Run this from the project root.');
if (problems.length) { console.error('Nothing was changed:\n'); problems.forEach((x) => console.error(' - ' + x)); process.exit(1); }

// Reuse the two lines that already hold your Supabase address and public key.
let urlLine = null, keyLines = null;
if (fs.existsSync('api/sitemap.js')) {
  const s = fs.readFileSync('api/sitemap.js', 'utf8').replace(/\r\n/g, '\n');
  const u = s.match(/^const SUPABASE_URL = .*;$/m);
  const k = s.match(/^const ANON = [\s\S]*?;$/m);
  if (u && k) { urlLine = u[0]; keyLines = k[0]; }
}
if (!urlLine) {
  console.log('Note: could not copy the Supabase address from api/sitemap.js. The ping will use the SUPABASE_URL and SUPABASE_ANON_KEY settings from Vercel instead.');
  urlLine = "const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\\/$/, '');";
  keyLines = "const ANON = process.env.SUPABASE_ANON_KEY || '';";
}

const CODE = `// Vercel serverless function: GET /api/keepalive (called once a day by a Vercel Cron Job, see vercel.json).
// Reads one product row so Supabase sees activity and does not pause the free project. It changes nothing.

${urlLine}
${keyLines}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await fetch(\`\${SUPABASE_URL}/rest/v1/products?select=id&limit=1\`, {
      headers: { apikey: ANON, Authorization: \`Bearer \${ANON}\` },
    });
    if (!r.ok) { console.error('keepalive: supabase', r.status); return res.status(502).json({ ok: false, status: r.status }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('keepalive failed', e);
    return res.status(502).json({ ok: false });
  }
};
`;

const raw = fs.readFileSync('vercel.json', 'utf8');
let j;
try { j = JSON.parse(raw); } catch (e) { console.error('vercel.json is not valid JSON. Nothing was changed.'); process.exit(1); }
j.crons = j.crons || [];
const hasCron = j.crons.some((c) => c.path === '/api/keepalive');
const hasFile = fs.existsSync('api/keepalive.js');
if (hasCron && hasFile) { console.log('Already up to date.'); process.exit(0); }

if (!hasFile) { fs.writeFileSync('api/keepalive.js', CODE); console.log('api/keepalive.js: created'); }
if (!hasCron) {
  j.crons.push({ path: '/api/keepalive', schedule: '0 6 * * *' });
  const crlf = raw.includes('\r\n');
  let out = JSON.stringify(j, null, 2) + '\n';
  if (crlf) out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync('vercel.json.bak', raw);
  fs.writeFileSync('vercel.json', out);
  console.log('vercel.json: cron job added (backup saved as vercel.json.bak)');
}
console.log('\nNext: commit and push. Then in Vercel open your project > Settings > Cron Jobs to see it listed.');
