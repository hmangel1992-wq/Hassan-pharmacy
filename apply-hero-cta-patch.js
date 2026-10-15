#!/usr/bin/env node
/*
 * AVARA — hero buttons ("Shop Medical care / Beauty care / Athlete care")
 *   1. The button now scrolls straight to the filters and the products (before, it stopped at the section
 *      title and the text above the products, so the items were still below the screen).
 *   2. The button is bigger and easier to notice: a soft pulsing glow and a small arrow that bobs downward.
 *      It uses your existing teal colours. The animation switches off for visitors who have "reduce motion" on.
 *
 * Run from the project root:   node apply-hero-cta-patch.js
 * Then:                        node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing and tells you which one.
 */
const fs = require('fs');
const file = ['tools/template.html', 'template.html'].find((f) => fs.existsSync(f));
if (!file) { console.error('tools/template.html not found: run this from the project root'); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes('ctaPulse')) { console.log(file + ': already up to date'); process.exit(0); }

const edits = [];
const edit = (find, replace) => edits.push([find, replace]);

edit('  .panel[hidden]{ display: none; }',
`  /* Hero call-to-action: easy to spot, with a gentle pulse and a downward arrow */
  .hero__cta{
    display: inline-flex; align-items: center; gap: .7em;
    padding: .95em 2.3em; font-weight: 600; letter-spacing: .03em;
    font-size: clamp(.9rem, 1.3vw, 1.2rem);
    animation: ctaPulse 2.4s ease-out infinite;
    transition: background .25s ease, transform .25s ease, border-color .25s ease;
  }
  .hero__cta:hover{ transform: translateY(-2px); animation-play-state: paused; }
  .hero__cta::after{
    content: ""; width: .5em; height: .5em; flex: none;
    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: rotate(45deg) translateY(-2px); animation: ctaBob 1.6s ease-in-out infinite;
  }
  @keyframes ctaPulse{
    0%   { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 0 rgba(47,143,157,.55); }
    70%  { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 18px rgba(47,143,157,0); }
    100% { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 0 rgba(47,143,157,0); }
  }
  @keyframes ctaBob{
    0%, 100% { transform: rotate(45deg) translate(-2px, -2px); }
    50%      { transform: rotate(45deg) translate(2px, 2px); }
  }
  @media (max-width: 760px){
    .hero__cta{ display: flex; width: 100%; max-width: 340px; margin: 18px auto 8px; padding: 1.05em 1.6em; font-size: 1.05rem; }
  }
  .panel[hidden]{ display: none; }`);

edit('href="#medical" data-i18n="hero_cta_medical"', 'href="#tools-medical" data-i18n="hero_cta_medical"');
edit('href="#beauty" data-i18n="hero_cta_beauty"', 'href="#collTabs-beauty" data-i18n="hero_cta_beauty"');
edit('href="#athlete" data-i18n="hero_cta_athlete"', 'href="#tools-athlete" data-i18n="hero_cta_athlete"');

for (const [find] of edits) {
  const n = t.split(find).length - 1;
  if (n !== 1) {
    console.error(file + ': expected one match but found ' + n + ' for:\n  ' + find.split('\n')[0].slice(0, 110) +
      '\nNothing changed. Send me this file and I will adjust the patch.');
    process.exit(1);
  }
}
for (const [find, replace] of edits) t = t.replace(find, () => replace);
fs.writeFileSync(file + '.bak', raw);
fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log(file + ': hero buttons now scroll to the products and stand out (backup saved as ' + file + '.bak)');
console.log('\nNext: node tools/build-pages.js   then commit and push.');
