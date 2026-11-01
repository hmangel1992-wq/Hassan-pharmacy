#!/usr/bin/env node
/*
 * AVARA — simpler cart panel (two steps)
 *   Step 1 "Your cart":   the items, a small summary, a free-delivery progress bar, a collapsed
 *                         "Have a discount code?" row, and one big Checkout button.
 *   Step 2 "Your details": a back arrow, name and phone, the WhatsApp tick, and "Add address or notes"
 *                         folded away. The Place order button stays pinned at the bottom with the total above it.
 *   Also: bigger product thumbnails, a round x to remove an item, store info folded into one
 *   "Delivery and payment info" row, and a cleaner "order received" screen (Track order first).
 *   Nothing changes in how orders, codes or stock work: every id the script uses is kept.
 *
 * Run from the project root:   node apply-cart-redesign-patch.js
 * Then:                        node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing and tells you which one.
 */
const fs = require('fs');
const file = ['tools/template.html', 'template.html'].find((f) => fs.existsSync(f));
if (!file) { console.error('tools/template.html not found: run this from the project root'); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes('id="cartBack"')) { console.log(file + ': already up to date'); process.exit(0); }

// Matching ignores differences in spaces and line breaks. A find can be text or a regular expression;
// a replacement can be text or a function that receives the matched text.
const loose = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));
const edits = [];
const edit = (find, replace) => edits.push([typeof find === 'string' ? loose(find) : find, replace, typeof find === 'string' ? find : String(find)]);

/* ---------- CSS ---------- */
edit('  .toast{\n    position: fixed; z-index: 100;',
`  /* ---------- Cart panel: two steps (items, then your details) ---------- */
  .drawer__head{ gap: 8px; padding: 14px 16px 14px 24px; }
  .drawer__title{ margin-inline-end: auto; font-size: 1.2rem; }
  .drawer__back{ margin-inline-start: -10px; }
  .drawer__back[hidden]{ display: none; }
  [dir="rtl"] .drawer__back svg{ transform: scaleX(-1); }
  .drawer__body{ padding: 0 24px; }

  /* cart lines */
  .line{ grid-template-columns: 72px 1fr auto; gap: 14px; padding: 16px 0; align-items: start; }
  .line__img{ width: 72px; }
  .line__name{ font-size: .98rem; }
  .line__price{ font-size: .86rem; margin-top: 2px; }
  .qty{ margin-top: 10px; border-color: var(--mint-2); }
  .qty button{ width: 30px; height: 30px; }
  .line > div:last-child{ display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
  .line__rm{ display: inline-grid; place-items: center; width: 28px; height: 28px; margin: 0; padding: 0; border: 1px solid var(--mint-2); border-radius: 50%;
    font-size: 1.15rem; line-height: 1; text-decoration: none; color: var(--ink-soft); }
  .line__rm:hover{ background: var(--mint); color: var(--ink); }

  /* folded rows: store info, discount code, address and notes */
  .cart-store{ margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--mint-2); }
  .cart-store[open] > summary{ margin-bottom: 10px; }
  details.code-box{ display: block; margin: 0; }
  .code-box .code-box__row{ margin-top: 10px; }
  .code-box .code-box__msg{ margin-top: 6px; }
  .more > label{ margin-top: 12px; }
  .cart-store > summary, .code-box > summary, .more > summary{ cursor: pointer; list-style: none; font-size: .9rem; font-weight: 500; color: var(--teal-deep); padding: 2px 0; }
  .cart-store > summary::-webkit-details-marker, .code-box > summary::-webkit-details-marker, .more > summary::-webkit-details-marker{ display: none; }
  .cart-store > summary::before, .code-box > summary::before, .more > summary::before{ content: "+"; display: inline-block; width: 1.1em; }
  .cart-store[open] > summary::before, .code-box[open] > summary::before, .more[open] > summary::before{ content: "\\2212"; }

  /* step 1 footer */
  .drawer__foot{ padding: 16px 24px calc(20px + env(safe-area-inset-bottom, 0px)); gap: 12px; max-height: 62vh; box-shadow: 0 -10px 24px rgba(44,44,44,.05); }
  .cart-sum{ gap: 4px; }
  .cart-sum__row{ font-size: .88rem; }
  .subtotal{ font-size: 1.25rem; margin: 6px 0 0; padding-top: 10px; border-top: 1px solid var(--mint-2); }
  .ship-bar{ display: block; height: 4px; margin-top: 8px; border-radius: 2px; background: var(--mint-2); overflow: hidden; }
  .ship-bar i{ display: block; height: 100%; background: var(--teal); }
  #checkoutBtn{ padding: 1rem 1.4rem; font-size: 1rem; }
  #checkoutBtn[disabled]{ cursor: not-allowed; }

  /* step 2 */
  .drawer #orderForm{ display: none; }
  .drawer.is-step2 #orderForm{ display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 0; }
  .drawer.is-step2 #cartBody, .drawer.is-step2 #cartFoot{ display: none; }
  .order-form__fields{ flex: 1; overflow-y: auto; padding: 20px 24px; display: grid; gap: 14px; align-content: start; }
  .order-form__bar{ padding: 14px 24px calc(18px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--mint-2); display: grid; gap: 10px; box-shadow: 0 -10px 24px rgba(44,44,44,.05); }
  .order-form__total{ display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 500; }
  .order-form__bar .consent{ text-align: center; font-size: .8rem; }
  #placeBtn{ padding: 1rem 1.4rem; font-size: 1rem; }

  /* order received */
  .done{ text-align: center; padding: 40px 0 24px; }
  .done h3, .done p{ text-align: center; }
  .done__tick{ width: 56px; height: 56px; margin: 0 auto 4px; border-radius: 50%; background: var(--mint); color: var(--teal-deep); display: grid; place-items: center; font-size: 1.6rem; }
  .done a[href^="/track"]{ order: -1; }

  .toast{
    position: fixed; z-index: 100;`);

/* ---------- HTML ---------- */
edit('    <h2 class="drawer__title" id="drawerTitle" data-i18n="cart_title">Your cart</h2>',
`    <button class="tool drawer__back" id="cartBack" type="button" data-i18n-aria="back" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
    </button>
    <h2 class="drawer__title" id="drawerTitle" data-i18n="cart_title">Your cart</h2>`);

edit('  <div class="drawer__foot" id="cartFoot" hidden>\n    <div class="cart-sum">',
`  <div class="drawer__foot" id="cartFoot" hidden>
    <p class="drawer__note" id="cartInfo" hidden></p>
    <div class="cart-sum">`);

edit('    <div class="code-box" id="codeBox">\n      <div class="code-box__row">',
`    <details class="code-box" id="codeBox">
      <summary data-i18n="code_have">Have a discount code?</summary>
      <div class="code-box__row">`);

edit(`      <p class="code-box__msg" id="codeMsg" role="status" hidden></p>
    </div>
    <p class="drawer__note" id="cartInfo" hidden></p>
    <form class="order-form" id="orderForm" novalidate>`,
`      <p class="code-box__msg" id="codeMsg" role="status" hidden></p>
    </details>
    <button class="btn btn--solid btn--block" id="checkoutBtn" type="button" data-i18n="checkout">Checkout</button>
  </div>
  <form class="order-form" id="orderForm" novalidate>
    <div class="order-form__fields">`);

edit(/<label[^>]*>\s*<span[^>]*data-i18n="address_label"[^>]*>/,
  (m) => '<details class="more"><summary data-i18n="more_details">Add address or notes</summary>\n      ' + m);

edit(/<textarea[^>]*name="notes"[^>]*>\s*<\/textarea>\s*<\/label>/,
  (m) => m + '\n      </details>');

edit(`      <p class="form-error" id="orderError" role="alert" hidden></p>
      <button class="btn btn--solid btn--block" id="placeBtn" type="submit" data-i18n="place_order">Place order</button>`,
`      <p class="form-error" id="orderError" role="alert" hidden></p>
    </div>
    <div class="order-form__bar">
      <div class="order-form__total"><span data-i18n="total">Total</span><span id="placeTotal" dir="ltr"></span></div>
      <button class="btn btn--solid btn--block" id="placeBtn" type="submit" data-i18n="place_order">Place order</button>`);

edit(`      <p class="drawer__note" data-i18n="cart_note">We'll contact you to confirm your order, delivery and payment.</p>
    </form>
  </div>
</aside>`,
`    </div>
  </form>
</aside>`);

/* ---------- Text (English / Arabic) ---------- */
edit("langBtn:'العربية'",
`back:'Back', checkout:'Checkout', cart_details:'Your details', code_have:'Have a discount code?',
      more_details:'Add address or notes', cart_info:'Delivery and payment info',
      langBtn:'العربية'`);
edit("langBtn:'English'",
`back:'رجوع', checkout:'متابعة الطلب', cart_details:'بياناتك', code_have:'لديك رمز خصم؟',
      more_details:'إضافة عنوان أو ملاحظات', cart_info:'معلومات التوصيل والدفع',
      langBtn:'English'`);

/* ---------- JS ---------- */
// store info folds into one row
edit("    return h ? '<div class=\"cart-store\">' + h + '</div>' : '';",
     "    return h ? '<details class=\"cart-store\"><summary>' + t('cart_info') + '</summary>' + h + '</details>' : '';");

// the two steps
edit("  function showOrderError(key){ var el = $('#orderError'); el.textContent = t(key); el.hidden = false; }",
`  function showOrderError(key){ var el = $('#orderError'); el.textContent = t(key); el.hidden = false; }

  /* ---------- Cart steps: 1 = items, 2 = your details ---------- */
  function setStep(n){
    var d = $('#drawer'); if(!d) return;
    var two = n === 2;
    d.classList.toggle('is-step2', two);
    $('#cartBack').hidden = !two;
    $('#drawerTitle').textContent = t(two ? 'cart_details' : 'cart_title');
    if(two){ var nm = $('#orderForm').elements.customer; if(nm && !nm.value) setTimeout(function(){ nm.focus(); }, 60); }
  }
  // the total above Place order always mirrors the cart total
  (function(){
    var ct = $('#cartTotal'), pt = $('#placeTotal');
    function syncTotal(){ pt.textContent = ct.textContent; }
    if(window.MutationObserver) new MutationObserver(syncTotal).observe(ct, {childList:true, characterData:true, subtree:true});
    syncTotal();
  })();
  $('#checkoutBtn').addEventListener('click', function(){ setStep(2); });
  $('#cartBack').addEventListener('click', function(){ setStep(1); });`);

edit("    var ids = cartIds(), tot = cartTotals();\n    var badge = $('#cartCount');",
     "    var ids = cartIds(), tot = cartTotals();\n    if(!ids.length || lastOrder) setStep(1);   // empty cart or order received: back to the first screen\n    var badge = $('#cartCount');");

// order received screen
edit("'<div class=\"done\"><h3>'", "'<div class=\"done\"><span class=\"done__tick\" aria-hidden=\"true\">\\u2713</span><h3>'");
edit("<a class=\"btn btn--solid btn--block\" href=\"' + wa + '\"", "<a class=\"btn btn--line btn--block\" href=\"' + wa + '\"");
edit("<a class=\"btn btn--line btn--block\" href=\"/track?no=", "<a class=\"btn btn--solid btn--block\" href=\"/track?no=");

// round x to remove a line
edit("data-rm=\"' + esc(id) + '\">' + t('remove') + '</button></div>'",
     "data-rm=\"' + esc(id) + '\" aria-label=\"' + esc(t('remove')) + '\" title=\"' + esc(t('remove')) + '\">\\u00d7</button></div>'");

// free-delivery progress bar, and no checkout below the minimum order
edit("    var info = $('#cartInfo'); info.innerHTML = notes.map(esc).join('<br>'); info.hidden = !notes.length;",
`    var bar = (baseFee > 0 && th > 0 && tot.sum < th) ? '<span class="ship-bar" aria-hidden="true"><i style="width:' + Math.max(4, Math.min(100, Math.round(tot.sum / th * 100))) + '%"></i></span>' : '';
    var info = $('#cartInfo'); info.innerHTML = notes.map(esc).join('<br>') + bar; info.hidden = !notes.length;
    $('#checkoutBtn').disabled = minO > 0 && tot.sum < minO;`);

// the discount row opens by itself once a code is applied
edit("    $('#codeInput').readOnly = on;",
     "    $('#codeInput').readOnly = on;\n    if(on) $('#codeBox').open = true;");

/* ---------- apply (all or nothing) ---------- */
const problems = [];
edits.forEach(([rx, , label], i) => {
  const n = (t.match(new RegExp(rx.source, 'g')) || []).length;
  if (n !== 1) problems.push('  #' + (i + 1) + ': found ' + n + ' (expected 1) for: ' + label.split('\n')[0].trim().slice(0, 110));
});
if (problems.length) {
  console.error(file + ': ' + problems.length + ' line(s) not found exactly once:\n' + problems.join('\n') +
    '\nNothing changed. Copy this whole message and send it to me.');
  process.exit(1);
}
for (const [rx, replace] of edits) t = t.replace(rx, (...a) => typeof replace === 'function' ? replace(a[0]) : replace);
fs.writeFileSync(file + '.bak', raw);
fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log(file + ': cart panel is now two steps (backup saved as ' + file + '.bak)');
console.log('\nNext: node tools/build-pages.js   then commit and push.');
