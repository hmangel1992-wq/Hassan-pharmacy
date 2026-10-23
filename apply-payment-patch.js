#!/usr/bin/env node
/*
 * AVARA — clear payment choice: Cash on delivery or Whish
 *
 *   Cart:        a "Payment" choice (Cash on delivery / Whish) with one clear line under it.
 *   Your order:  the choice is written at the start of the order notes, for example "[Payment: Whish] ...",
 *                so you see it in the admin Orders list and in your order alert. No database change is needed.
 *   After order: the confirmation says what happens next. For Whish it says you will send the Whish details
 *                when you confirm the order (no number is shown on the website).
 *
 * Changes:  tools/template.html (and sw.js, new cache version)
 * Run from the project root:   node apply-payment-patch.js
 * Then:                        node tools/build-pages.js     and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

function applyEdits(t, edits, name, problems) {
  for (const [find, rep] of edits) {
    const n = count(t, find);
    if (n !== 1) { problems.push(name + ': expected 1 match but found ' + n + ' for: ' + find.split('\n')[0].trim().slice(0, 90)); continue; }
    t = t.replace(find, () => rep);
  }
  return t;
}

const CSS = `  .form-error[hidden]{ display: none; }
  .paybox{ border: 0; display: grid; gap: 8px; }
  .paybox legend{ font-size: .88rem; color: var(--ink-soft); padding: 0; margin-bottom: 2px; }
  .paybox label.payopt{ display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--teal); border-radius: 2px; background: var(--ivory); color: var(--ink); font-size: .95rem; cursor: pointer; }
  .paybox label.payopt input{ width: 18px; height: 18px; min-width: 18px; padding: 0; accent-color: var(--teal-deep); }
  .paybox .pay-hint{ font-size: .86rem; color: var(--ink-soft); line-height: 1.45; }
  .done .pay-next{ padding: 12px 14px; background: var(--mint); border-inline-start: 3px solid var(--teal-deep); font-size: .94rem; color: var(--ink); }`;

const HTML = `      <fieldset class="paybox" id="payBox">
        <legend data-i18n="pay_label">Payment</legend>
        <label class="payopt"><input type="radio" name="pay" value="cod" checked><span data-i18n="pay_cod">Cash on delivery</span></label>
        <label class="payopt"><input type="radio" name="pay" value="whish"><span data-i18n="pay_whish">Whish</span></label>
        <p class="pay-hint" id="payHint" role="status"></p>
      </fieldset>
      <label><span data-i18n="notes_label">Notes (optional)</span>`;

const TXT_EN = `show_more:'Show more', show_less:'Show less',
      pay_label:'Payment', pay_cod:'Cash on delivery', pay_whish:'Whish',
      pay_hint_cod:'Pay in cash when your order arrives.',
      pay_hint_whish:'We will send you the Whish payment details when we confirm your order.',
      pay_next_cod:'You pay in cash when your order arrives. We will contact you to confirm delivery.',
      pay_next_whish:'You chose Whish. We will contact you shortly to confirm your order and send the Whish payment details.',`;
const TXT_AR = `show_more:'عرض المزيد', show_less:'عرض أقل',
      pay_label:'طريقة الدفع', pay_cod:'الدفع عند الاستلام', pay_whish:'ويش (Whish)',
      pay_hint_cod:'تدفع نقداً عند وصول طلبك.',
      pay_hint_whish:'سنرسل لك تفاصيل الدفع عبر ويش عند تأكيد طلبك.',
      pay_next_cod:'تدفع نقداً عند وصول طلبك. سنتواصل معك لتأكيد التوصيل.',
      pay_next_whish:'اخترت الدفع عبر ويش. سنتواصل معك قريباً لتأكيد طلبك وإرسال تفاصيل الدفع.',`;

const JS = `  /* ---------- Payment choice (cash on delivery or Whish) ---------- */
  var lastPay = 'cod';
  function payChoice(f){ return (f && f.pay && f.pay.value === 'whish') ? 'whish' : 'cod'; }
  function renderPayHint(){
    var el = document.getElementById('payHint'), f = document.getElementById('orderForm');
    if(el && f) el.textContent = t('pay_hint_' + payChoice(f.elements));
  }
  function payNote(f){
    var tag = payChoice(f) === 'whish' ? 'Payment: Whish' : 'Payment: Cash on delivery';
    return ('[' + tag + '] ' + f.notes.value.trim()).trim();
  }

  function showOrderError(key){`;

function templateJob(t, problems) {
  const name = 'template';
  if (t.includes('id="payBox"')) return { t, done: true };
  t = applyEdits(t, [
    ['  .form-error[hidden]{ display: none; }', CSS],
    ['      <label><span data-i18n="notes_label">Notes (optional)</span>', HTML],
    ['<textarea name="notes" rows="2" maxlength="500">', '<textarea name="notes" rows="2" maxlength="450">'],
    ["show_more:'Show more', show_less:'Show less',", TXT_EN],
    ["show_more:'عرض المزيد', show_less:'عرض أقل',", TXT_AR],
    ['  function showOrderError(key){', JS],
    ['p_notes:f.notes.value.trim(),', 'p_notes:payNote(f),'],
    ['lastOrder = res.data; cart = {};', 'lastOrder = res.data; lastPay = payChoice(f); cart = {};'],
    ["t('order_ok_text').replace('{no}', '<strong dir=\"ltr\">#' + esc(lastOrder) + '</strong>') + '</p>' +",
     "t('order_ok_text').replace('{no}', '<strong dir=\"ltr\">#' + esc(lastOrder) + '</strong>') + '</p>' +\n        '<p class=\"pay-next\">' + esc(t('pay_next_' + lastPay)) + '</p>' +"],
    ["  $('#orderForm').addEventListener('submit', submitOrder);",
     "  $('#orderForm').addEventListener('submit', submitOrder);\n  $('#orderForm').addEventListener('change', function(e){ if(e.target && e.target.name === 'pay') renderPayHint(); });"],
    ['    runSearch(); renderPromos(); renderTrust(); renderReviews();', '    runSearch(); renderPromos(); renderTrust(); renderReviews(); renderPayHint();'],
  ], name, problems);
  return { t, done: false };
}

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      if (t.includes('// payment')) return { t, done: true };
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';/);
      if (!m) { p.push('sw.js: could not find the CACHE_VERSION line'); return { t, done: false }; }
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // payment"), done: false };
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
  if (res.done) { console.log(j.file + ': already up to date'); continue; }
  plan.push({ file: j.file, raw, out: crlf ? res.t.replace(/\n/g, '\r\n') : res.t });
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
