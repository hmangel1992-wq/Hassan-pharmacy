#!/usr/bin/env node
/*
 * AVARA — Phase 4 step 2 patch (analytics)
 * 1. api/product.js : adds Plausible + a "WhatsApp Product" click event to the /p/<product> pages.
 * 2. vercel.json    : lets the browser load Plausible (script-src and connect-src).
 * Run from the project root:   node apply-analytics-patch.js
 * Safe to run twice. If an anchor is not found it stops and writes nothing for that file.
 */
const fs = require('fs');

// Change this if your Plausible site name is different (it must match the site you add in Plausible).
const DOMAIN = 'avara-nu-beige.vercel.app';

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { crlf: raw.includes('\r\n'), text: raw.replace(/\r\n/g, '\n') };
}
function save(file, f) { fs.writeFileSync(file, f.crlf ? f.text.replace(/\n/g, '\r\n') : f.text); }
function rep(f, label, from, to, done) {
  if (f.text.includes(done)) { console.log('  skip (already applied):', label); return; }
  const n = f.text.split(from).length - 1;
  if (n !== 1) throw new Error(`Anchor for "${label}" found ${n} times (expected 1). Nothing was written for this file.`);
  f.text = f.text.replace(from, () => to);
  console.log('  ok:', label);
}

function patchProduct() {
  const file = fs.existsSync('api/product.js') ? 'api/product.js' : (fs.existsSync('product.js') ? 'product.js' : null);
  if (!file) { console.log('api/product.js not found, skipped'); return; }
  console.log(file);
  const f = load(file);
  rep(f, 'analytics script in <head>',
    '<style>${STYLE}</style>\n</head>',
    '<script defer data-domain="' + DOMAIN + '" src="https://plausible.io/js/script.js"></script>\n' +
    '<script>window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}</script>\n' +
    '<style>${STYLE}</style>\n</head>',
    'plausible.io/js/script.js');
  rep(f, 'WhatsApp click event',
    '${esc(T.rights)}</footer>\n</body>',
    '${esc(T.rights)}</footer>\n' +
    "<script>document.addEventListener('click',function(e){var a=e.target.closest('a[data-ask]');if(a&&window.plausible)window.plausible('WhatsApp Product',{props:{product:a.getAttribute('data-ask')}})});</script>\n" +
    '</body>',
    "window.plausible('WhatsApp Product'");
  rep(f, 'mark the WhatsApp button',
    '<a class="btn line" href="${wa}" target="_blank" rel="noopener">${esc(T.ask)}</a>',
    '<a class="btn line" data-ask="${esc(p.name_en)}" href="${wa}" target="_blank" rel="noopener">${esc(T.ask)}</a>',
    'data-ask="${esc(p.name_en)}"');
  save(file, f);
}

function patchVercel() {
  const file = 'vercel.json';
  if (!fs.existsSync(file)) { console.log('vercel.json not found, skipped'); return; }
  console.log(file);
  const f = load(file);
  rep(f, 'allow Plausible script',
    "script-src 'self' 'unsafe-inline';",
    "script-src 'self' 'unsafe-inline' https://plausible.io;",
    'unsafe-inline\' https://plausible.io;');
  rep(f, 'allow Plausible events',
    "connect-src 'self' https://*.supabase.co;",
    "connect-src 'self' https://*.supabase.co https://plausible.io;",
    'supabase.co https://plausible.io;');
  save(file, f);
}

try {
  patchProduct();
  patchVercel();
  console.log('\nDone.');
} catch (e) {
  console.error('\nStopped: ' + e.message);
  process.exit(1);
}
