#!/usr/bin/env node
/*
 * AVARA — sharper doctor picture (with the "Avara MD" pocket badge) on the home page
 *
 *   Uses the new, higher-resolution doctor picture beside the "Your Health Matters" buttons. It has a clean see-through
 *   background, so it sits directly on the soft mint of the headline area, with a soft teal shadow. Works whether you
 *   applied the first or the second doctor patch before. Alt text is updated in English and Arabic.
 *
 * Needs, in the assets folder:  doctor-avara-964.webp  and  doctor-avara-600.webp
 * Needs the home page and the first doctor patch (apply-home-doctor-patch.js) already applied.
 *
 * Run from the project root:   node apply-home-doctor3-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));

for (const f of ['assets/doctor-avara-964.webp', 'assets/doctor-avara-600.webp']) {
  if (!fs.existsSync(f)) { console.error(f + ' is missing. Copy both new doctor pictures into the assets folder first.'); process.exit(1); }
}

const IMG_NEW = '<img src="/assets/doctor-avara-964.webp" srcset="/assets/doctor-avara-600.webp 600w, /assets/doctor-avara-964.webp 964w" sizes="(max-width: 860px) 70vw, 40vw" width="964" height="1081" alt="">';
const IMG_RE = /<img src="\/assets\/doctor-[^"]*\.webp" srcset="[^"]*" sizes="[^"]*" width="\d+" height="\d+" alt="">/g;
const CSS_FROM = 'max-width: 100%; mix-blend-mode: multiply; }';
const CSS_TO = 'max-width: 100%; filter: drop-shadow(0 16px 22px rgba(31,95,107,.18)); }';
const ALT_EN_NEW = 'A smiling AVARA doctor in a white coat with a stethoscope.';
const ALT_AR_NEW = 'طبيبة أفارا مبتسمة بالمعطف الأبيض وسماعة طبية.';
const ALT_EN_OLDS = ['A smiling doctor in a white coat with a stethoscope, holding a clipboard.', 'A smiling doctor in a white coat with a stethoscope.'];
const ALT_AR_OLDS = ['طبيبة مبتسمة بالمعطف الأبيض وسماعة طبية تحمل لوحة ملاحظات.', 'طبيبة مبتسمة بالمعطف الأبيض وسماعة طبية.'];

const problems = [], plan = [];
function load(label, candidates) {
  const file = first(candidates);
  if (!file) { problems.push('Could not find the ' + label + '. Run this from the project root.'); return null; }
  const raw = fs.readFileSync(file, 'utf8');
  return { file, raw, crlf: raw.includes('\r\n'), t: raw.replace(/\r\n/g, '\n') };
}
function keep(o) { plan.push({ file: o.file, raw: o.raw, out: o.crlf ? o.t.replace(/\n/g, '\r\n') : o.t }); }

const tpl = load('template', ['tools/template.html', 'template.html']);
if (tpl) {
  if (tpl.t.includes('doctor-avara-964.webp')) console.log(tpl.file + ': already up to date');
  else {
    const imgs = tpl.t.match(IMG_RE) || [];
    if (imgs.length !== 1) problems.push(tpl.file + ': could not find the doctor picture (found ' + imgs.length + '). Apply apply-home-doctor-patch.js first.');
    else {
      tpl.t = tpl.t.replace(IMG_RE, () => IMG_NEW);
      if (tpl.t.includes(CSS_FROM)) tpl.t = tpl.t.replace(CSS_FROM, () => CSS_TO);
      keep(tpl);
    }
  }
}
const bld = load('builder', ['tools/build-pages.js', 'build-pages.js']);
if (bld) {
  if (bld.t.includes(ALT_EN_NEW)) console.log(bld.file + ': already up to date');
  else {
    const en = ALT_EN_OLDS.filter((s) => bld.t.split(s).length === 2)[0], ar = ALT_AR_OLDS.filter((s) => bld.t.split(s).length === 2)[0];
    if (!en || !ar) problems.push(bld.file + ': could not find the doctor alt text. Apply apply-home-doctor-patch.js first.');
    else { bld.t = bld.t.replace(en, () => ALT_EN_NEW).replace(ar, () => ALT_AR_NEW); keep(bld); }
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
