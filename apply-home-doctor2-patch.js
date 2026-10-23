#!/usr/bin/env node
/*
 * AVARA — new doctor picture on the home page
 *
 *   Swaps the doctor picture beside the "Your Health Matters" buttons for the new one. The new picture has a clean
 *   see-through background, so it sits directly on the soft mint of the headline area (no blending needed), with a
 *   soft teal shadow. Alt text (for screen readers and Google) is updated in English and Arabic.
 *
 * Needs, in the assets folder:  doctor-748.webp  and  doctor-560.webp
 * Needs the home page and the first doctor patch to be applied already.
 *
 * Run from the project root:   node apply-home-doctor2-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

for (const f of ['assets/doctor-748.webp', 'assets/doctor-560.webp']) {
  if (!fs.existsSync(f)) { console.error(f + ' is missing. Copy both new doctor pictures into the assets folder first.'); process.exit(1); }
}

const IMG_OLD = '<img src="/assets/doctor-844.webp" srcset="/assets/doctor-600.webp 600w, /assets/doctor-844.webp 844w" sizes="(max-width: 860px) 70vw, 40vw" width="844" height="879" alt="">';
const IMG_NEW = '<img src="/assets/doctor-748.webp" srcset="/assets/doctor-560.webp 560w, /assets/doctor-748.webp 748w" sizes="(max-width: 860px) 70vw, 40vw" width="748" height="832" alt="">';
const CSS_OLD = 'max-width: 100%; mix-blend-mode: multiply; }';
const CSS_NEW = 'max-width: 100%; filter: drop-shadow(0 16px 22px rgba(31,95,107,.18)); }';
const ALT_EN_OLD = 'A smiling doctor in a white coat with a stethoscope, holding a clipboard.';
const ALT_EN_NEW = 'A smiling doctor in a white coat with a stethoscope.';
const ALT_AR_OLD = 'طبيبة مبتسمة بالمعطف الأبيض وسماعة طبية تحمل لوحة ملاحظات.';
const ALT_AR_NEW = 'طبيبة مبتسمة بالمعطف الأبيض وسماعة طبية.';

const problems = [], plan = [];
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
  if (tpl.t.includes('doctor-748.webp')) console.log(tpl.file + ': already up to date');
  else { swap(tpl, IMG_OLD, IMG_NEW, 'the doctor picture'); swap(tpl, CSS_OLD, CSS_NEW, 'the doctor picture style'); keep(tpl); }
}
const bld = load('builder', ['tools/build-pages.js', 'build-pages.js']);
if (bld) {
  if (bld.t.includes(ALT_EN_NEW)) console.log(bld.file + ': already up to date');
  else { swap(bld, ALT_EN_OLD, ALT_EN_NEW, 'the English alt text'); swap(bld, ALT_AR_OLD, ALT_AR_NEW, 'the Arabic alt text'); keep(bld); }
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
