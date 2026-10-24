#!/usr/bin/env node
/*
 * AVARA — "Buy one, get one free" promotions
 *
 *   Admin > Promotions: choose the offer type "Buy and get one free" and how many units the customer buys
 *   (1 = buy 1 get 1 free, 2 = buy 2 get 1 free, ...). Pick the products as usual.
 *   Store: the promotions banner says "Buy 1, get 1 free", and its button puts the right quantity in the cart.
 *          The cart shows a "Free items" line, a hint like "Add 1 more to get 1 free", and the lower total.
 *   Server: the price is enforced when the order is placed (see phase7-buy-one-get-one.sql), so it cannot be changed
 *           from the browser. Admin > Orders shows what was free.
 *
 * Run phase7-buy-one-get-one.sql in Supabase FIRST (SQL Editor > Run). Until then, normal promotions keep working,
 * but do not create a "buy and get free" promotion (it cannot be saved without the SQL).
 *
 * Changes:  tools/template.html, admin.html, sw.js (new cache version)
 * Run from the project root:   node apply-bogo-patch.js
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

/* ---------------- Store ---------------- */
const CSS_ANCHOR = '  .cart-sum__row--disc{ color: var(--teal-deep); font-weight: 500; }';
const CSS_NEW = CSS_ANCHOR + `
  .line__bogo{ margin-top: 6px; font-size: .82rem; line-height: 1.35; color: var(--teal-deep); }
  .line__bogo--hint{ color: var(--ink-soft); }`;

const ROW_ANCHOR = '      <div class="cart-sum__row cart-sum__row--disc" id="discRow" hidden><span id="discLabel"></span><span id="cartDisc" dir="ltr"></span></div>';
const ROW_NEW = ROW_ANCHOR + '\n      <div class="cart-sum__row cart-sum__row--disc" id="bogoRow" hidden><span data-i18n="bogo_row">Free items</span><span id="cartBogo" dir="ltr"></span></div>';

const TXT_EN = `show_more:'Show more', show_less:'Show less',
      promo_bogo:'Buy {n}, get 1 free', promo_add_offer:'Add offer to cart', bogo_row:'Free items',
      bogo_free:'{n} free', bogo_more:'Add {n} more to get 1 free',`;
const TXT_AR = `show_more:'عرض المزيد', show_less:'عرض أقل',
      promo_bogo:'اشترِ {n} واحصل على واحد مجاناً', promo_add_offer:'أضف العرض إلى السلة', bogo_row:'منتجات مجانية',
      bogo_free:'{n} مجاناً', bogo_more:'أضف {n} للحصول على واحد مجاناً',`;

const CART_IDS = "  function cartIds(){ return Object.keys(cart).filter(function(id){ return byId[id]; }); }";
const CART_IDS_NEW = CART_IDS + `

  /* ---------- Buy N, get 1 free (promotions of type "bogo"; the server applies the same rule when the order is placed) ---------- */
  // For each product in a live buy-and-get-free promotion, every (N + 1) units include 1 free unit.
  // A product in several offers gets the best one (smallest N), once.
  function bogoFor(ids){
    var best = {};
    PROMOS.forEach(function(pr){
      if(pr.kind !== 'bogo') return;
      var b = Math.max(1, Number(pr.buy_qty) || 1);
      (pr.product_ids || []).forEach(function(id){ id = String(id); if(!(id in best) || b < best[id]) best[id] = b; });
    });
    var total = 0, free = {};
    ids.forEach(function(id){
      if(!(id in best) || !byId[id]) return;
      var n = Math.floor(cart[id] / (best[id] + 1));
      if(n > 0){ free[id] = n; total += n * effPrice(byId[id]); }
    });
    return {total: total, free: free, best: best};
  }
  function bogoNote(id){
    var bg = bogoFor(cartIds()), h = '';
    if(bg.free[id]) h += '<div class="line__bogo">' + esc(t('bogo_free').replace('{n}', bg.free[id])) + '</div>';
    if(id in bg.best){
      var per = bg.best[id] + 1, rest = cart[id] % per;
      if(rest !== 0) h += '<div class="line__bogo line__bogo--hint">' + esc(t('bogo_more').replace('{n}', per - rest)) + '</div>';
    }
    return h;
  }`;

const STORE_EDITS = [
  [CSS_ANCHOR, CSS_NEW],
  [ROW_ANCHOR, ROW_NEW],
  ["show_more:'Show more', show_less:'Show less',", TXT_EN],
  ["show_more:'عرض المزيد', show_less:'عرض أقل',", TXT_AR],
  [CART_IDS, CART_IDS_NEW],
  ["esc(name(p)) + '</div><div class=\"line__price'", "esc(name(p)) + '</div>' + bogoNote(id) + '<div class=\"line__price'"],
  ["    $('#cartTotal').textContent = money(tot.sum - disc + fee);",
   "    var bogo = Math.min(bogoFor(ids).total, Math.max(tot.sum - disc, 0));\n    $('#bogoRow').hidden = !(bogo > 0); if(bogo > 0) $('#cartBogo').textContent = '−' + money(bogo);\n    $('#cartTotal').textContent = money(tot.sum - disc - bogo + fee);"],
  ["      var now = 0, was = 0;\n      items.forEach(function(p){ now += effPrice(p); was += p.price; });",
   "      var bogo = pr.kind === 'bogo', buy = Math.max(1, Number(pr.buy_qty) || 1), now = 0, was = 0;\n      items.forEach(function(p){ if(bogo){ now += effPrice(p) * buy; was += effPrice(p) * (buy + 1); } else { now += effPrice(p); was += p.price; } });"],
  ["(multi ? t('promo_bundle') + ' · ' + t('promo_total').replace('{n}', items.length) : t('promo_offer'))",
   "(bogo ? t('promo_bogo').replace('{n}', buy) : multi ? t('promo_bundle') + ' · ' + t('promo_total').replace('{n}', items.length) : t('promo_offer'))"],
  ["(multi ? t('promo_add_all') : t('add'))", "(bogo ? t('promo_add_offer') : multi ? t('promo_add_all') : t('add'))"],
  ["    sl.items.forEach(function(p){\n      if((cart[p.id] || 0) + 1 <= avail(p)){ cart[p.id] = (cart[p.id] || 0) + 1; added++; }\n    });",
   "    var k = sl.pr.kind === 'bogo' ? Math.max(1, Number(sl.pr.buy_qty) || 1) + 1 : 1;   // a buy-and-get-free offer adds N + 1 units\n    sl.items.forEach(function(p){\n      var n = Math.min(k, avail(p) - (cart[p.id] || 0));\n      if(n > 0){ cart[p.id] = (cart[p.id] || 0) + n; added++; }\n    });"],
  [".then(function(res){ PROMOS = res.error ? [] : (res.data || []); renderPromos(); })",
   ".then(function(res){ PROMOS = res.error ? [] : (res.data || []); renderPromos(); renderCart(); })"],
  [".catch(function(){ PROMOS = []; renderPromos(); });", ".catch(function(){ PROMOS = []; renderPromos(); renderCart(); });"],
  ["var sumNow = cartTotals().sum - (appliedCode ? Math.min(appliedCode.discount || 0, cartTotals().sum) : 0), countNow = items.length;",
   "var sumNow = Math.max(cartTotals().sum - (appliedCode ? Math.min(appliedCode.discount || 0, cartTotals().sum) : 0) - bogoFor(cartIds()).total, 0), countNow = items.length;"],
];

/* ---------------- Admin ---------------- */
const A_HTML_ANCHOR = '        <datalist id="promoCodes"></datalist>';
const A_HTML_NEW = `        <div class="row3">
          <label class="field">Offer type
            <select name="kind"><option value="normal">Normal (one product or a bundle)</option><option value="bogo">Buy and get one free</option></select></label>
          <label class="field" id="buyQtyField" hidden>Customer buys (units)<input name="buy_qty" type="number" min="1" max="5" step="1" value="1"></label>
          <span></span>
        </div>
        <p class="hint" id="bogoHint" hidden style="margin:-6px 0 14px">For every product picked below, every (buy + 1) units in an order include 1 free unit. Example: with 1, two units cost one; three cost two. The banner button adds the right quantity to the cart, and the discount is applied by the server when the order is placed. It can be combined with a discount code, but never takes more than the products cost.</p>
` + A_HTML_ANCHOR;

const A_OPEN_ANCHOR = '    el.is_active.checked = p ? !!p.is_active : true;';
const A_OPEN_NEW = A_OPEN_ANCHOR + "\n    el.kind.value = p && p.kind === 'bogo' ? 'bogo' : 'normal'; el.buy_qty.value = p && p.buy_qty ? p.buy_qty : 1; toggleBogoFields();";

const A_LISTEN_ANCHOR = "  $('#promoSearch').addEventListener('input', renderPick);";
const A_LISTEN_NEW = `  function toggleBogoFields(){
    var on = $('#promoForm').elements.kind.value === 'bogo';
    $('#buyQtyField').hidden = !on; $('#bogoHint').hidden = !on;
  }
  $('#promoForm').elements.kind.addEventListener('change', toggleBogoFields);
` + A_LISTEN_ANCHOR;

const A_SAVE_ANCHOR = "    var q = editingPromo ? sb.from('promotions').update(row).eq('id', editingPromo.id) : sb.from('promotions').insert(row);";
const A_SAVE_NEW = `    // The offer type is only sent when it is used, so normal promotions still save if the SQL has not been run yet.
    if(el.kind.value === 'bogo'){ row.kind = 'bogo'; row.buy_qty = Math.max(1, Math.min(5, parseInt(el.buy_qty.value, 10) || 1)); }
    else if(editingPromo && editingPromo.kind && editingPromo.kind !== 'normal'){ row.kind = 'normal'; row.buy_qty = 1; }
` + A_SAVE_ANCHOR;

const A_LIST_OLD = "<br><small>Order ' + esc(p.sort_order) + '</small></td>' +";
const A_LIST_NEW = "<br><small>Order ' + esc(p.sort_order) + (p.kind === 'bogo' ? ' \u00b7 Buy ' + esc(p.buy_qty || 1) + ', get 1 free' : '') + '</small></td>' +";

const A_ORD_OLD = "(Number(o.discount) > 0 ? '<li><span>Discount (' + esc(o.discount_code || '') + ')</span><span>−' + money(o.discount) + '</span></li>' : '') +";
const A_ORD_NEW = "(Number(o.promo_discount) > 0 ? '<li><span>' + esc(o.promo_note || 'Free items') + '</span><span>−' + money(o.promo_discount) + '</span></li>' : '') +\n        (Number(o.discount) - (Number(o.promo_discount) || 0) > 0.004 ? '<li><span>Discount (' + esc(o.discount_code || '') + ')</span><span>−' + money(Number(o.discount) - (Number(o.promo_discount) || 0)) + '</span></li>' : '') +";

const ADMIN_EDITS = [
  [A_HTML_ANCHOR, A_HTML_NEW], [A_OPEN_ANCHOR, A_OPEN_NEW], [A_LISTEN_ANCHOR, A_LISTEN_NEW],
  [A_SAVE_ANCHOR, A_SAVE_NEW], [A_LIST_OLD, A_LIST_NEW], [A_ORD_OLD, A_ORD_NEW],
];

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']),
    run: (t, p) => t.includes('id="bogoRow"') ? { t, done: true } : { t: applyEdits(t, STORE_EDITS, 'template', p), done: false } },
  { label: 'admin page', required: true, file: first(['admin.html']),
    run: (t, p) => t.includes('id="buyQtyField"') ? { t, done: true } : { t: applyEdits(t, ADMIN_EDITS, 'admin', p), done: false } },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      if (t.includes('// bogo')) return { t, done: true };
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';/);
      if (!m) { p.push('sw.js: could not find the CACHE_VERSION line'); return { t, done: false }; }
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // bogo"), done: false };
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
if (plan.length) console.log('\nNext: run phase7-buy-one-get-one.sql in Supabase, then node tools/build-pages.js, then commit and push.');
