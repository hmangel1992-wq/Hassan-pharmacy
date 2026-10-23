#!/usr/bin/env node
/*
 * AVARA — new business email: avaracare@zohomail.com
 *
 * Replaces souna.92@gmail.com with avaracare@zohomail.com in every page, script, manifest and text file of the project
 * (contact section, footer, policies page, structured data, order-alert code). Prints how many places changed in each file.
 *
 * Run from the project root:   node apply-email-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. Every changed file gets a .bak copy.
 * To preview without changing anything:   node apply-email-patch.js --check
 */
const fs = require('fs');
const path = require('path');

const OLD = 'souna.92@gmail.com';
const NEW = 'avaracare@zohomail.com';
const CHECK = process.argv.includes('--check');

const TEXT = /\.(html|js|json|txt|xml|webmanifest|css|md)$/i;
const SKIP_DIR = new Set(['node_modules', '.git', '.vercel', 'vendor', 'claude']);
const SKIP_FILE = /(\.bak$|package-lock\.json$|skills-lock\.json$|^apply-.*\.js$|supabase.*\.js$)/i;

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

if (!plan.length) { console.log('Already up to date: ' + OLD + ' is not mentioned any more.'); process.exit(0); }
plan.forEach((p) => console.log((CHECK ? 'would change ' : 'changing ') + p.file + ' (' + p.n + ' place' + (p.n > 1 ? 's' : '') + ')'));
if (CHECK) { console.log('\nNothing was changed (preview only).'); process.exit(0); }

for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
}
console.log('\nDone: ' + total + ' mentions replaced. Next: node tools/build-pages.js   then commit and push.');
console.log('Also check any order-alert email address stored as a setting in Vercel (Environment Variables) or Supabase, since those are not in the files.');
