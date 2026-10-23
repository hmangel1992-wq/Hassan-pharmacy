#!/usr/bin/env node
/*
 * AVARA — doctor picture in the home page headline area
 *   Replaces the three AVARA bottles beside the "Your Health Matters" buttons with your doctor photo.
 *
 * Needs, in the assets folder:  doctor-844.webp  and  doctor-600.webp
 * Needs the home page patch (apply-home-page-patch.js) to have been run first.
 * Run from the project root:   node apply-home-doctor-patch.js
 * Then:                        node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

for (const f of ['assets/doctor-844.webp', 'assets/doctor-600.webp']) {
  if (!fs.existsSync(f)) { console.error(f + ' is missing. Copy both doctor pictures into the assets folder first.'); process.exit(1); }
}

const OLD_ART = `    <div class="home-hero__art" aria-hidden="true">
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-tube"/></svg>
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-dropper"/></svg>
      <svg class="pack" viewBox="0 0 120 140"><use href="#pk-pump"/></svg>
    </div>`;
const NEW_ART = `    <div class="home-hero__art home-hero__doctor">
      <img src="/assets/doctor-844.webp" srcset="/assets/doctor-600.webp 600w, /assets/doctor-844.webp 844w" sizes="(max-width: 860px) 70vw, 40vw" width="844" height="879" alt="">
    </div>`;
const CSS_ANCHOR = '  #featured .grid{ margin-top: 36px; }';
const CSS = `  /* The doctor photo has a white background, so it is blended into the soft green of the headline area. */
  .home-hero__doctor{ align-self: end; padding: 0; margin-bottom: calc(-1 * clamp(40px, 6vw, 84px)); }
  .home-hero__doctor img{ position: relative; height: clamp(340px, 40vw, 540px); width: auto; max-width: 100%; mix-blend-mode: multiply; }
  @media (max-width: 860px){
    .home-hero__doctor{ margin-bottom: -28px; }
    .home-hero__doctor img{ height: auto; width: min(72vw, 340px); }
  }
`;
const ALT_EN = "{ h1: 'AVARA — Health care and cosmetics', hero: null }";
const ALT_AR = "{ h1: 'AVARA — رعاية صحية ومستحضرات تجميل', hero: null }";

const problems = [];
const plan = [];
function load(label, candidates) {
  const file = first(candidates);
  if (!file) { problems.push('Could not find the ' + label + '. Run this from the project root.'); return null; }
  const raw = fs.readFileSync(file, 'utf8');
  return { file, raw, crlf: raw.includes('\r\n'), t: raw.replace(/\r\n/g, '\n') };
}
function swap(o, find, rep, what) {
  const n = count(o.t, find);
  if (n !== 1) { problems.push(o.file + ': expected 1 match but found ' + n + ' for ' + what); return; }
  o.t = o.t.replace(find, () => rep);
}
function keep(o) { plan.push({ file: o.file, raw: o.raw, out: o.crlf ? o.t.replace(/\n/g, '\r\n') : o.t }); }

const tpl = load('template', ['tools/template.html', 'template.html']);
if (tpl) {
  if (tpl.t.includes('home-hero__doctor')) console.log(tpl.file + ': already up to date');
  else if (!tpl.t.includes('home-hero__art')) problems.push(tpl.file + ': the home page is not there yet. Run apply-home-page-patch.js first.');
  else { swap(tpl, OLD_ART, NEW_ART, 'the three bottles'); swap(tpl, CSS_ANCHOR, CSS + CSS_ANCHOR, 'the featured styles'); keep(tpl); }
}
const bld = load('builder', ['tools/build-pages.js', 'build-pages.js']);
if (bld) {
  if (bld.t.includes("hero: null, alt:")) console.log(bld.file + ': already up to date');
  else if (!bld.t.includes('META.en.home')) problems.push(bld.file + ': the home page is not there yet. Run apply-home-page-patch.js first.');
  else {
    swap(bld, ALT_EN, "{ h1: 'AVARA — Health care and cosmetics', hero: null, alt: 'A smiling doctor in a white coat with a stethoscope, holding a clipboard.' }", 'the English home alt text');
    swap(bld, ALT_AR, "{ h1: 'AVARA — رعاية صحية ومستحضرات تجميل', hero: null, alt: 'طبيبة مبتسمة بالمعطف الأبيض وسماعة طبية تحمل لوحة ملاحظات.' }", 'the Arabic home alt text');
    keep(bld);
  }
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
if (plan.length) console.log('\nNext: node tools/build-pages.js   then commit and push.');
