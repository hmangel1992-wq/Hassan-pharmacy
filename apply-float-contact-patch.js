#!/usr/bin/env node
/*
 * AVARA — floating help button on every public page
 *   A round button in the bottom corner (bottom-left on Arabic pages). Tap it and two choices open:
 *     - "Chat with our assistant": scrolls to the chat on the home page, or opens the home page chat from any other page
 *     - "Message us on WhatsApp": opens WhatsApp on 76 681 395 with a ready message
 *   It hides while the cart is open, works in English and Arabic, and counts clicks in Plausible ("Float Click").
 *
 *   Pages that get it: the six storefront pages (through tools/template.html), the tracking page, the review page,
 *   the policies page, and the product and article pages (api/product.js and api/articles.js).
 *   The admin page is NOT touched.
 *
 * You need this file in place first: assets/float-contact.js   (it is the button itself)
 * Run from the project root:   node apply-float-contact-patch.js
 * Then:                        node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');

const first = (list) => list.find((f) => fs.existsSync(f));
const TAG = '<script src="/assets/float-contact.js" defer></script>\n';

if (!fs.existsSync('assets/float-contact.js')) {
  console.error('assets/float-contact.js is missing. Copy it into the assets folder first, then run this again.');
  process.exit(1);
}

const jobs = [
  { label: 'template', file: first(['tools/template.html', 'template.html']) },
  { label: 'track page', file: first(['track.html', 'public/track.html']) },
  { label: 'review page', file: first(['review.html', 'public/review.html']) },
  { label: 'policies page', file: first(['policies.html', 'public/policies.html']) },
  { label: 'product pages', file: first(['api/product.js', 'product.js']) },
  { label: 'article pages', file: first(['api/articles.js', 'articles.js']) },
];

const plan = [];
let problems = 0;
for (const j of jobs) {
  if (!j.file) { problems++; console.error('Could not find the ' + j.label + '. Run this from the project root.'); continue; }
  const raw = fs.readFileSync(j.file, 'utf8');
  const crlf = raw.includes('\r\n');
  const t = raw.replace(/\r\n/g, '\n');
  if (t.includes('float-contact.js')) { console.log(j.file + ': already up to date'); continue; }
  const n = t.split('</body>').length - 1;
  if (n !== 1) {
    problems++;
    console.error(j.file + ': expected one </body> but found ' + n);
    continue;
  }
  const out = t.replace('</body>', () => TAG + '</body>');
  plan.push({ file: j.file, raw, out: crlf ? out.replace(/\n/g, '\r\n') : out });
}

if (problems) {
  console.error('\nNothing was changed. Send me the file(s) named above and I will adjust the patch.');
  process.exit(1);
}
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
if (plan.length) console.log('\nNext: node tools/build-pages.js   then commit and push.');
