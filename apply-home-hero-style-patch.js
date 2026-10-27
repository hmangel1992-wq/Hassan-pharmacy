#!/usr/bin/env node
/*
 * AVARA — landing page hero: lively buttons + a doctor picture that blends into the page
 *
 *   Buttons ("Shop by department" and "Chat with us"): same lively feel as the buttons on the other pages. The main button
 *     has the gentle pulse and the bobbing arrow, both lift on hover, and "Chat with us" gets a chat icon that wiggles and
 *     fills teal on hover. The headline, text, buttons and doctor also slide in softly when the page opens.
 *   Doctor picture: three ways to make her feel part of the website. Pick one with --style:
 *       node apply-home-hero-style-patch.js --style=dissolve    (default) soft teal light behind her, the bottom of the
 *                                                                picture melts into the page, no hard edges
 *       node apply-home-hero-style-patch.js --style=arch        she stands in a pale arched "window" with a thin outline
 *       node apply-home-hero-style-patch.js --style=botanical   a soft glowing circle behind her and two gently swaying
 *                                                                leaves ("inspired by nature")
 *     Run it again with another style any time to switch. It only replaces its own block, so nothing else is touched.
 *
 * Changes:  tools/template.html (and sw.js, new cache version). Needs the home page already applied.
 * Run from the project root, then:  node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

const arg = process.argv.find((a) => a.startsWith('--style='));
const STYLE = arg ? arg.slice(8).toLowerCase() : 'dissolve';

const COMMON = `.hero--home .home-hero__copy, .hero--home .home-hero__doctor{ position: relative; z-index: 1; }
.home-hero__copy > *{ animation: avHeroRise .8s cubic-bezier(.2,.7,.2,1) both; }
.home-hero__copy > :nth-child(2){ animation-delay: .08s; }
.home-hero__copy > :nth-child(3){ animation-delay: .16s; }
.home-hero__copy > :nth-child(4){ animation-delay: .26s; }
.home-hero__doctor img{ animation: avHeroRise 1s cubic-bezier(.2,.7,.2,1) .12s both; }
.home-hero__cta{ gap: 14px; }
.home-hero__cta .btn{
  gap: .7em; padding: .95em 2.1em; border-radius: 999px; font-weight: 600; letter-spacing: .03em; font-size: 1rem;
  transition: transform .25s ease, background .25s ease, color .25s ease, border-color .25s ease, box-shadow .25s ease;
}
.home-hero__cta .btn svg{ width: 1.2em; height: 1.2em; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.home-hero__cta .btn:hover{ transform: translateY(-3px); }
.home-hero__cta .btn:active{ transform: translateY(0) scale(.98); }
.home-hero__cta .btn--solid{ box-shadow: 0 8px 22px rgba(31,95,107,.35); animation: avHeroPulse 2.4s ease-out infinite; }
.home-hero__cta .btn--solid:hover{ animation-play-state: paused; box-shadow: 0 12px 28px rgba(31,95,107,.42); }
.home-hero__cta .btn--solid::after{
  content: ""; width: .5em; height: .5em; flex: none;
  border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(45deg) translate(-2px, -2px); animation: avHeroBob 1.6s ease-in-out infinite;
}
.home-hero__cta .btn--line{ background: rgba(255,255,255,.72); border-color: var(--teal-deep); color: var(--teal-deep); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.home-hero__cta .btn--line:hover{ background: var(--teal-deep); color: var(--white); box-shadow: 0 10px 24px rgba(31,95,107,.28); }
.home-hero__cta .btn--line:hover svg{ animation: avHeroWiggle .6s ease; }
@keyframes avHeroRise{ from{ opacity: 0; transform: translateY(18px); } to{ opacity: 1; transform: none; } }
@keyframes avHeroPulse{
  0%   { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 0 rgba(47,143,157,.55); }
  70%  { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 18px rgba(47,143,157,0); }
  100% { box-shadow: 0 8px 22px rgba(31,95,107,.35), 0 0 0 0 rgba(47,143,157,0); }
}
@keyframes avHeroBob{ 0%, 100%{ transform: rotate(45deg) translate(-2px, -2px); } 50%{ transform: rotate(45deg) translate(2px, 2px); } }
@keyframes avHeroWiggle{ 0%, 100%{ transform: rotate(0); } 30%{ transform: rotate(-14deg); } 65%{ transform: rotate(10deg); } }`;
const STYLES = {
  dissolve: `/* style A: dissolve */
.hero.hero--home{
  background:
    radial-gradient(50% 78% at 76% 58%, rgba(47,143,157,.22) 0%, rgba(47,143,157,0) 70%),
    radial-gradient(42% 52% at 10% 0%, rgba(255,255,255,.75) 0%, rgba(255,255,255,0) 70%),
    linear-gradient(135deg, var(--mint) 0%, #F3FBF9 58%, var(--ivory) 100%);
}
.home-hero__art::before{ inset: 0 -12% 6% -12%; background: radial-gradient(closest-side, rgba(255,255,255,.95) 0%, rgba(255,255,255,.55) 55%, rgba(255,255,255,0) 100%); }
.home-hero__doctor img{ filter: none; -webkit-mask-image: linear-gradient(to top, transparent 0, #000 28%); mask-image: linear-gradient(to top, transparent 0, #000 28%); }
.hero.hero--home::after{ content: ""; position: absolute; inset: auto 0 0; height: 96px; background: linear-gradient(to top, var(--ivory), rgba(250,249,246,0)); pointer-events: none; z-index: 2; }`,
  arch: `/* style B: arch */
.home-hero__doctor{ justify-self: center; }
.home-hero__art::before{ inset: 18% 3% 0 3%; border-radius: 999px 999px 0 0; background: linear-gradient(180deg, #F1FAF8 0%, #D3ECE8 50%, #A9D8D3 120%); }
.home-hero__art::after{ content: ""; position: absolute; inset: calc(18% - 16px) calc(3% - 16px) 0; border: 1.5px solid rgba(31,95,107,.32); border-bottom: 0; border-radius: 999px 999px 0 0; pointer-events: none; }
.home-hero__doctor img{ filter: drop-shadow(0 10px 18px rgba(31,95,107,.22)); }`,
  botanical: `/* style C: botanical glow */
.hero.hero--home::before, .hero.hero--home::after{
  content: ""; position: absolute; z-index: 0; pointer-events: none; border-radius: 0 100% 0 100%;
  background: linear-gradient(45deg, transparent 49.4%, rgba(31,95,107,.16) 50%, transparent 50.6%), linear-gradient(135deg, rgba(47,143,157,.18), rgba(47,143,157,.03));
}
.hero.hero--home::before{ width: clamp(220px, 30vw, 440px); aspect-ratio: 1; left: -9%; bottom: -30%; transform: rotate(-14deg); animation: avHeroSway 9s ease-in-out infinite; }
.hero.hero--home::after{ width: clamp(140px, 18vw, 260px); aspect-ratio: 1; right: 3%; top: -6%; transform: rotate(160deg); animation: avHeroSway 11s ease-in-out -4s infinite; }
.home-hero__doctor{ justify-self: center; }
.home-hero__art::before{ inset: 4% -10% 2%; border-radius: 50%; background: radial-gradient(circle at 50% 44%, #FFFFFF 0%, rgba(255,255,255,.8) 36%, rgba(198,229,224,.5) 56%, rgba(198,229,224,0) 70%); }
.home-hero__doctor img{ filter: drop-shadow(0 14px 20px rgba(31,95,107,.2)); }
@keyframes avHeroSway{ 0%, 100%{ translate: 0 0; } 50%{ translate: 8px -10px; } }`
};
if (!STYLES[STYLE]) { console.error('Unknown style "' + STYLE + '". Use --style=dissolve, --style=arch or --style=botanical.'); process.exit(1); }

const START = '/* ===== AVARA home hero style (start) ===== */';
const END = '/* ===== AVARA home hero style (end) ===== */';
const BLOCK = '  ' + START + '\n' + (COMMON + '\n/* style: ' + STYLE + ' */\n' + STYLES[STYLE]).split('\n').map((l) => '  ' + l).join('\n') + '\n  ' + END;

const BTN_SHOP_OLD = '<a class="btn btn--solid" href="#departments" data-i18n="cta_depts"></a>';
const BTN_SHOP_NEW = '<a class="btn btn--solid" href="#departments"><span data-i18n="cta_depts"></span></a>';
const BTN_CHAT_OLD = '<a class="btn btn--line" href="#chat" data-i18n="chat_cta"></a>';
const BTN_CHAT_NEW = '<a class="btn btn--line" href="#chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg><span data-i18n="chat_cta"></span></a>';

function templateJob(t, problems) {
  const name = 'template';
  // 1. buttons: wrap the text in a span (the chat button also gets its icon), so the language switch cannot remove the icon
  if (!t.includes(BTN_SHOP_NEW)) {
    if (count(t, BTN_SHOP_OLD) !== 1) problems.push(name + ': could not find the "Shop by department" button on the home page (found ' + count(t, BTN_SHOP_OLD) + ')');
    else t = t.replace(BTN_SHOP_OLD, () => BTN_SHOP_NEW);
  }
  if (!t.includes(BTN_CHAT_NEW)) {
    if (count(t, BTN_CHAT_OLD) !== 1) problems.push(name + ': could not find the "Chat with us" button on the home page (found ' + count(t, BTN_CHAT_OLD) + ')');
    else t = t.replace(BTN_CHAT_OLD, () => BTN_CHAT_NEW);
  }
  // 2. the style block: added once, replaced when you switch style
  const a = t.indexOf(START), b = t.indexOf(END);
  if (a >= 0 && b > a) {
    t = t.slice(0, t.lastIndexOf('\n', a) + 1) + BLOCK + t.slice(b + END.length);
  } else if (a >= 0 || b >= 0) {
    problems.push(name + ': the AVARA hero style block looks damaged (only one of its two marker lines was found)');
  } else if (count(t, '</style>') !== 1) {
    problems.push(name + ': expected 1 </style> but found ' + count(t, '</style>'));
  } else {
    t = t.replace('</style>', () => BLOCK + '\n</style>');
  }
  if (!t.includes('class="hero hero--home"')) problems.push(name + ': the home page hero was not found. Apply the home page patch first.');
  return { t };
}

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';( \/\/ [^\n]*)?/);
      if (!m) { p.push('sw.js: could not find the CACHE_VERSION line'); return { t }; }
      if ((m[2] || '').includes('hero-' + STYLE)) return { t };
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // hero-" + STYLE) };
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
