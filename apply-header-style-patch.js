#!/usr/bin/env node
/*
 * AVARA — a more stylish top bar (announcement strip + menu bar with the pages, search, language and cart)
 *
 * Pick one with --style (you can switch any time by running it again with another style):
 *   node apply-header-style-patch.js --style=glass   (default) a floating frosted-glass capsule with a round teal cart button;
 *                                                    the active page is a soft mint pill, links get a growing underline
 *   node apply-header-style-patch.js --style=luxe    editorial and light: logo centred, small spaced capital links with a fine
 *                                                    animated line, thin teal hairline under the bar
 *   node apply-header-style-patch.js --style=deep    the brand's deep teal bar with a white logo, a white pill on the active page
 *                                                    and a white round cart button; the announcement strip turns soft mint
 * All styles: the bar gains a soft shadow once you scroll, the cart button gives a small bounce when something is added,
 * and the phone menu is restyled to match. English and Arabic (right-to-left) both work.
 *
 * Changes:  tools/template.html (style block + one small script) and sw.js (new cache version).
 * Run from the project root, then:  node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 * Note: the Track, Review, Policies and Articles pages have their own copy of the bar and are not changed by this patch.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

const arg = process.argv.find((a) => a.startsWith('--style='));
const STYLE = arg ? arg.slice(8).toLowerCase() : 'glass';

const COMMON = `.site-header .tool{ transition: background .2s ease, color .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
.site-header .tool:active{ transform: scale(.94); }
.site-header #cartBtn.is-bump{ animation: avCartBump .5s ease; }
@keyframes avCartBump{ 0%, 100%{ transform: scale(1); } 40%{ transform: scale(1.18); } }`;
const STYLES = {
  glass: `/* style: glass - a floating frosted capsule */
:root{ --header-h: 88px; }
.announce{ font-size: .76rem; letter-spacing: .2em; text-transform: uppercase; padding: 7px 16px; background: linear-gradient(90deg, var(--teal-deep), #266F7C 50%, var(--teal-deep)); }
.site-header{ padding-top: 12px; background: transparent; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; pointer-events: none; }
.site-header > *{ pointer-events: auto; }
.site-header__in{
  height: 64px; width: min(1240px, 100% - 32px); padding-inline: 28px 14px; gap: 24px;
  background: rgba(255,255,255,.74); -webkit-backdrop-filter: blur(18px) saturate(1.5); backdrop-filter: blur(18px) saturate(1.5);
  border: 1px solid rgba(255,255,255,.9); border-radius: 999px;
  box-shadow: 0 10px 34px rgba(31,95,107,.14), inset 0 1px 0 rgba(255,255,255,.9);
  transition: height .3s ease, background .3s ease, box-shadow .3s ease;
}
.site-header.is-scrolled .site-header__in{ height: 56px; background: rgba(255,255,255,.95); box-shadow: 0 12px 38px rgba(31,95,107,.22), inset 0 1px 0 #fff; }
.nav a{ position: relative; padding: 8px 17px; border: 0; border-radius: 999px; font-size: .93rem; transition: background .25s ease, color .25s ease; }
.nav a::after{ content: ""; position: absolute; inset-inline: 17px; bottom: 4px; height: 2px; border-radius: 2px; background: var(--teal); transform: scaleX(0); transition: transform .3s cubic-bezier(.2,.7,.2,1); }
.nav a:hover{ border: 0; color: var(--teal-deep); }
.nav a:hover::after{ transform: scaleX(1); }
.nav a[aria-current="page"]{ border: 0; background: var(--mint); color: var(--teal-deep); font-weight: 500; }
.nav a[aria-current="page"]::after{ display: none; }
.site-header .tool{ border-radius: 999px; }
.site-header .tool--install{ border-color: rgba(47,143,157,.45); }
.site-header #cartBtn{ width: 44px; height: 44px; padding: 0; background: var(--teal-deep); }
.site-header #cartBtn svg{ stroke: #fff; }
.site-header #cartBtn:hover{ background: var(--ink); transform: translateY(-1px); }
.site-header .tool__count{ top: -4px; inset-inline-end: -4px; background: #fff; color: var(--teal-deep); box-shadow: 0 0 0 2px var(--teal-deep); }
.search-panel{ inset-inline: 16px; top: calc(100% - 6px); border: 1px solid var(--mint-2); border-radius: 22px; box-shadow: 0 18px 44px rgba(31,95,107,.18); }
@media (max-width: 980px){
  .site-header__in{ padding-inline: 12px; border-radius: 30px; gap: 8px; }
  .nav{ inset-inline: 16px; top: calc(100% - 6px); border: 1px solid var(--mint-2); border-radius: 22px; padding: 8px 22px 14px; box-shadow: 0 18px 44px rgba(31,95,107,.18); }
  .nav a{ border-radius: 0; padding: 14px 4px; border-bottom: 1px solid var(--mint-2); background: none; }
  .nav a::after{ display: none; }
  .nav a[aria-current="page"]{ background: none; }
  .nav li:last-child a{ border-bottom: 0; }
}`,
  luxe: `/* style: luxe - editorial, centered logo, hairline details */
:root{ --header-h: 84px; }
.announce{ font-size: .7rem; letter-spacing: .3em; text-transform: uppercase; padding: 8px 16px; }
.site-header{ background: rgba(250,249,246,.94); border-bottom: 0; box-shadow: 0 1px 0 var(--mint-2); transition: box-shadow .3s ease; }
.site-header::after{ content: ""; position: absolute; inset-inline: 0; bottom: -1px; height: 1px; pointer-events: none; background: linear-gradient(90deg, transparent, var(--teal) 50%, transparent); opacity: .6; }
.site-header.is-scrolled{ box-shadow: 0 1px 0 var(--mint-2), 0 14px 30px rgba(31,95,107,.1); }
@media (min-width: 981px){
  .site-header__in{ grid-template-columns: 1fr auto 1fr; }
  .brand{ order: 2; justify-self: center; }
  .brand img{ height: 30px; }
  .nav{ order: 1; justify-content: flex-start; gap: clamp(14px, 1.7vw, 26px); }
  .tools{ order: 3; justify-self: end; }
}
.nav a{ position: relative; padding: 8px 0; border: 0; font-size: .72rem; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
[lang="ar"] .nav a{ text-transform: none; font-size: .94rem; font-weight: 500; }
.nav a::after{ content: ""; position: absolute; inset-inline: 0; bottom: 0; height: 1px; background: var(--teal-deep); transform: scaleX(0); transform-origin: left; transition: transform .35s cubic-bezier(.2,.7,.2,1); }
[dir="rtl"] .nav a::after{ transform-origin: right; }
.nav a:hover{ border: 0; }
.nav a:hover::after, .nav a[aria-current="page"]::after{ transform: scaleX(1); }
.nav a[aria-current="page"]{ border: 0; }
.site-header .tool{ min-width: 40px; height: 40px; border-radius: 50%; }
.site-header .tool:hover{ background: transparent; box-shadow: inset 0 0 0 1px var(--teal); }
.site-header .tool--lang{ border-radius: 999px; padding: 0 14px; letter-spacing: .04em; }
.site-header .tool--install{ border-color: var(--mint-2); min-width: 40px; padding: 0; }
.site-header .tool--install span{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.site-header .tool--install:hover{ background: transparent; border-color: var(--teal); box-shadow: none; }
.site-header .tool__count{ top: 1px; inset-inline-end: -1px; }
@media (max-width: 980px){
  .nav a{ font-size: .8rem; padding: 15px 0; }
  .nav a::after{ display: none; }
  .nav a[aria-current="page"]{ color: var(--teal-deep); }
}`,
  deep: `/* style: deep - brand teal header with a pill menu */
.announce{ background: var(--mint); color: var(--teal-deep); font-size: .76rem; letter-spacing: .2em; text-transform: uppercase; padding: 7px 16px; border-bottom: 1px solid var(--mint-2); }
.site-header{ background: linear-gradient(180deg, #236E7B 0%, var(--teal-deep) 100%); border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; box-shadow: 0 8px 26px rgba(31,95,107,.22); transition: box-shadow .3s ease; }
.site-header.is-scrolled{ box-shadow: 0 12px 32px rgba(31,95,107,.38); }
.brand img{ filter: brightness(0) invert(1); }
.nav a{ position: relative; padding: 9px 18px; border: 0; border-radius: 999px; color: rgba(255,255,255,.84); transition: background .25s ease, color .25s ease; }
.nav a:hover{ border: 0; color: #fff; background: rgba(255,255,255,.13); }
.nav a[aria-current="page"], .nav a[aria-current="page"]:hover{ border: 0; background: #fff; color: var(--teal-deep); font-weight: 600; }
.site-header .tool{ color: #fff; border-radius: 999px; }
.site-header .tool svg{ stroke: #fff; }
.site-header .tool:hover{ background: rgba(255,255,255,.14); }
.site-header .tool--lang{ border: 1px solid rgba(255,255,255,.38); padding: 0 15px; }
.site-header .tool--install{ border-color: rgba(255,255,255,.45); }
.site-header .tool--install svg{ stroke: #fff; }
.site-header .tool--install:hover{ background: rgba(255,255,255,.14); }
.site-header #cartBtn{ width: 44px; height: 44px; padding: 0; background: #fff; }
.site-header #cartBtn svg{ stroke: var(--teal-deep); }
.site-header #cartBtn:hover{ background: var(--mint); transform: translateY(-1px); }
.site-header .tool__count{ top: -4px; inset-inline-end: -4px; background: var(--teal); color: #fff; box-shadow: 0 0 0 2px #fff; }
.site-header .tool:focus-visible, .nav a:focus-visible, .brand:focus-visible{ outline-color: #fff; }
@media (max-width: 980px){
  .nav{ background: var(--teal-deep); border-bottom: 0; box-shadow: 0 18px 30px rgba(31,95,107,.3); }
  .nav a{ border-radius: 0; padding: 14px 4px; color: #fff; background: none; border-bottom: 1px solid rgba(255,255,255,.14); }
  .nav a:hover{ background: none; }
  .nav a[aria-current="page"], .nav a[aria-current="page"]:hover{ background: none; color: var(--mint); }
}`
};
if (!STYLES[STYLE]) { console.error('Unknown style "' + STYLE + '". Use --style=glass, --style=luxe or --style=deep.'); process.exit(1); }

const START = '/* ===== AVARA header style (start) ===== */';
const END = '/* ===== AVARA header style (end) ===== */';
const BLOCK = '  ' + START + '\n' + (COMMON + '\n/* style: ' + STYLE + ' */\n' + STYLES[STYLE]).split('\n').map((l) => '  ' + l).join('\n') + '\n  ' + END;

const SCRIPT_MARK = '/* AVARA header script */';
const SCRIPT = `<script>
${SCRIPT_MARK}
(function(){
  var h = document.getElementById('siteHeader'); if(!h) return;
  var f = function(){ h.classList.toggle('is-scrolled', (window.pageYOffset || document.documentElement.scrollTop) > 10); };
  f(); window.addEventListener('scroll', f, {passive: true});
  var c = document.getElementById('cartCount'), b = document.getElementById('cartBtn');
  if(c && b && window.MutationObserver){
    var last = c.textContent;
    new MutationObserver(function(){
      var now = c.textContent;
      if(now !== last){
        if(Number(now) > Number(last)){ b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
        last = now;
      }
    }).observe(c, {childList: true, characterData: true, subtree: true});
  }
})();
</script>
`;

function templateJob(t, problems) {
  const name = 'template';
  // 1. style block: added once, replaced when you switch style
  const a = t.indexOf(START), b = t.indexOf(END);
  if (a >= 0 && b > a) {
    t = t.slice(0, t.lastIndexOf('\n', a) + 1) + BLOCK + t.slice(b + END.length);
  } else if (a >= 0 || b >= 0) {
    problems.push(name + ': the AVARA header style block looks damaged (only one of its two marker lines was found)');
  } else if (count(t, '</style>') !== 1) {
    problems.push(name + ': expected 1 </style> but found ' + count(t, '</style>'));
  } else {
    t = t.replace('</style>', () => BLOCK + '\n</style>');
  }
  // 2. the small script (scroll shadow + cart bounce): added once
  if (!t.includes(SCRIPT_MARK)) {
    if (count(t, '</body>') !== 1) problems.push(name + ': expected 1 </body> but found ' + count(t, '</body>'));
    else t = t.replace('</body>', () => SCRIPT + '</body>');
  }
  if (!t.includes('id="siteHeader"')) problems.push(name + ': the top bar (id="siteHeader") was not found');
  return { t };
}

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';( \/\/ [^\n]*)?/);
      if (!m) { p.push('sw.js: could not find the CACHE_VERSION line'); return { t }; }
      if ((m[2] || '').includes('header-' + STYLE)) return { t };
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // header-" + STYLE) };
  } },
];

const plan = [], problems = [];
for (const j of jobs) {
  if (!j.file) {
    if (j.required) problems.push('Could not find the ' + j.label + '. Run this from the project root.');
    else console.log('Skipped (not found): ' + j.label);
    continue;
  }
  const raw = fs.readFileSync(j.file, 'utf8');
  const crlf = raw.includes('\r\n');
  const before = problems.length;
  const res = j.run(raw.replace(/\r\n/g, '\n'), problems);
  if (problems.length > before) continue;
  const out = crlf ? res.t.replace(/\n/g, '\r\n') : res.t;
  if (out === raw) { console.log(j.file + ': already up to date'); continue; }
  plan.push({ file: j.file, raw, out });
}

if (problems.length) {
  console.error('Nothing was changed. Please send me the file(s) named below and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
console.log('\nStyle: ' + STYLE + '.' + (plan.length ? '  Next: node tools/build-pages.js   then commit and push.' : ''));
