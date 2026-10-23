#!/usr/bin/env node
/*
 * AVARA — delivery fee by region
 *
 *   Store:  a "Delivery region" list in the cart. The customer picks a region, the cart shows that region's
 *           delivery fee, and the order is placed with it. A region without a fee uses the general delivery fee.
 *   Admin:  Settings > "Delivery regions": set the fee for each region, add or remove regions, turn them on or off.
 *
 * Run the SQL first:  phase6-delivery-regions.sql  (Supabase > SQL Editor > Run). Until you do, the store keeps
 * working exactly as today: the region list simply does not appear.
 *
 * Changes these files:
 *   tools/template.html   region list in the cart, fee by region, text in English and Arabic
 *   admin.html            "Delivery regions" box in Settings
 *   sw.js                 new cache version (optional)
 *
 * Run from the project root:   node apply-delivery-regions-patch.js
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

/* ---------- Store: styles, markup, text, script ---------- */
const STORE_CSS = `  .form-error{ color: #8A2E20; font-size: .9rem; }
  .order-form label[hidden]{ display: none; }
  .order-form select{ width: 100%; padding: 10px 12px; font-size: 1rem; color: var(--ink); background: var(--ivory); border: 1px solid var(--teal); border-radius: 2px; }`;

const STORE_LABEL = `      <label id="regionBox" hidden><span data-i18n="region_label">Delivery region</span>
        <select name="region" id="regionSel"></select></label>
      <label><span data-i18n="address_label">Delivery address (optional)</span>`;

const TXT_EN = `show_more:'Show more', show_less:'Show less',
      region_label:'Delivery region', region_choose:'Choose your region', region_required:'Please choose your delivery region.',`;
const TXT_AR = `show_more:'عرض المزيد', show_less:'عرض أقل',
      region_label:'منطقة التوصيل', region_choose:'اختر منطقتك', region_required:'يرجى اختيار منطقة التوصيل.',`;

const STORE_STATE = `  var store = {delivery_fee:0, free_delivery_over:null, min_order:0};

  /* ---------- Delivery regions (fee by region; set in admin > Settings) ---------- */
  var REGIONS = [], regionId = '';
  try{ regionId = localStorage.getItem('avara-region') || ''; }catch(e){}
  function regionById(id){
    for(var i = 0; i < REGIONS.length; i++){ if(String(REGIONS[i].id) === String(id)) return REGIONS[i]; }
    return null;
  }
  // Fee of the chosen region, or null when none is chosen or the region has no fee of its own (then the general fee applies).
  function regionFee(){
    var r = regionById(regionId);
    return (r && r.fee != null && r.fee !== '') ? Number(r.fee) : null;
  }
  function renderRegions(){
    var box = document.getElementById('regionBox'), sel = document.getElementById('regionSel');
    if(!box || !sel) return;
    if(!REGIONS.length){ box.hidden = true; return; }
    sel.innerHTML = '<option value="">' + esc(t('region_choose')) + '</option>' + REGIONS.map(function(r){
      var nm = lang === 'ar' ? (r.name_ar || r.name_en) : (r.name_en || r.name_ar);
      return '<option value="' + esc(r.id) + '">' + esc(nm) + (r.fee != null && r.fee !== '' ? ' — ' + money(Number(r.fee)) : '') + '</option>';
    }).join('');
    sel.value = regionById(regionId) ? String(regionId) : '';
    box.hidden = false;
  }
  function loadRegions(){
    if(!sb) return;
    sb.from('delivery_regions').select('id,name_en,name_ar,fee').eq('is_active', true)
      .order('sort_order', {ascending:true}).order('id', {ascending:true}).then(function(res){
        if(res.error || !res.data) return;   // table not created yet: no region list, the general fee applies
        REGIONS = res.data;
        if(!regionById(regionId)) regionId = '';
        renderRegions(); renderCart();
      }).catch(function(){});
  }`;

/* ---------- Admin ---------- */
const ADMIN_CSS = `  .ar{ direction:rtl; text-align:right; }
  #regionRows input:not([type="checkbox"]){ width:100%; padding:7px 9px; border:1px solid var(--sage-deep); border-radius:2px; background:var(--white); }
  #regionRows input[type="checkbox"]{ width:18px; height:18px; accent-color:var(--moss); }`;

const ADMIN_HTML = `      <div class="settings" id="regionsBox" style="margin-top:20px">
        <h3>Delivery regions</h3>
        <p class="hint" style="margin-bottom:12px">Customers choose one of these regions in the cart, and the delivery fee below is added to their order. Leave a fee blank to use the general delivery fee above. A fee of 0 means free delivery to that region. "Free delivery over" in the box above still applies to every region.</p>
        <p class="msg msg--err" id="regionsErr" role="alert" hidden></p>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Region (English)</th><th>Region (Arabic)</th><th>Fee (USD)</th><th>Order</th><th>On</th><th></th></tr></thead>
            <tbody id="regionRows"></tbody>
          </table>
        </div>
        <div class="settings__foot" style="padding-top:14px">
          <button class="btn btn--solid" type="button" id="regionsSave">Save regions</button>
          <button class="btn" type="button" id="regionAdd">Add a region</button>
          <span class="msg msg--ok" id="regionsOk" hidden style="margin:0">Saved.</span>
        </div>
      </div>

      <div class="settings" id="mfaBox" style="margin-top:20px">`;

const ADMIN_JS = `  /* ---------- Delivery regions ---------- */
  var regions = [];
  function regionRow(r){
    r = r || {};
    return '<tr data-rid="' + esc(r.id || '') + '">' +
      '<td><input data-f="name_en" maxlength="80" value="' + esc(r.name_en || '') + '"></td>' +
      '<td><input class="ar" data-f="name_ar" maxlength="80" value="' + esc(r.name_ar || '') + '"></td>' +
      '<td><input data-f="fee" type="number" min="0" step="0.01" placeholder="General fee" value="' + (r.fee != null ? esc(r.fee) : '') + '" style="min-width:110px"></td>' +
      '<td><input data-f="sort_order" type="number" step="1" value="' + esc(r.sort_order != null ? r.sort_order : regions.length + 1) + '" style="min-width:64px"></td>' +
      '<td><input data-f="is_active" type="checkbox"' + (r.is_active === false ? '' : ' checked') + '></td>' +
      '<td><button class="btn btn--sm btn--danger" type="button" data-region-del>Delete</button></td></tr>';
  }
  function renderRegionRows(){ $('#regionRows').innerHTML = regions.map(regionRow).join(''); }
  function loadRegions(){
    return sb.from('delivery_regions').select('*').order('sort_order').order('id').then(function(r){
      var err = $('#regionsErr');
      if(r.error){ err.textContent = 'Delivery regions are not available yet. Run phase6-delivery-regions.sql in the Supabase SQL Editor. (' + r.error.message + ')'; err.hidden = false; $('#regionRows').innerHTML = ''; return; }
      err.hidden = true; regions = r.data || []; renderRegionRows();
    });
  }
  $('#regionAdd').addEventListener('click', function(){
    $('#regionRows').insertAdjacentHTML('beforeend', regionRow(null));
    var rows = $('#regionRows').querySelectorAll('tr'); rows[rows.length - 1].querySelector('input').focus();
  });
  $('#regionRows').addEventListener('click', function(e){
    var b = e.target.closest('[data-region-del]'); if(!b) return;
    var tr = b.closest('tr'), id = tr.getAttribute('data-rid');
    if(!id){ tr.remove(); return; }
    if(!confirm('Delete this region? Past orders keep their region.')) return;
    sb.from('delivery_regions').delete().eq('id', id).then(function(r){
      if(r.error) alert('Could not delete: ' + r.error.message); else loadRegions();
    });
  });
  $('#regionsSave').addEventListener('click', function(){
    var err = $('#regionsErr'), ok = $('#regionsOk'), btn = $('#regionsSave');
    err.hidden = true; ok.hidden = true;
    var fail = function(m){ err.textContent = m; err.hidden = false; };
    var upd = [], ins = [], bad = false;
    $('#regionRows').querySelectorAll('tr').forEach(function(tr){
      var g = function(f){ return tr.querySelector('[data-f="' + f + '"]'); };
      var en = g('name_en').value.trim(), ar = g('name_ar').value.trim(), feeRaw = g('fee').value.trim();
      var fee = feeRaw === '' ? null : parseFloat(feeRaw), so = parseInt(g('sort_order').value, 10) || 0;
      if(!en || !ar || (fee != null && (isNaN(fee) || fee < 0))){ bad = true; return; }
      var row = {name_en: en, name_ar: ar, fee: fee, sort_order: so, is_active: g('is_active').checked}, id = tr.getAttribute('data-rid');
      if(id) upd.push({id: id, row: row}); else ins.push(row);
    });
    if(bad){ fail('Each region needs a name in English and Arabic, and a fee of 0 or more (or leave the fee blank).'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    var jobs = upd.map(function(u){ return sb.from('delivery_regions').update(u.row).eq('id', u.id); });
    if(ins.length) jobs.push(sb.from('delivery_regions').insert(ins));
    Promise.all(jobs).then(function(rs){
      btn.disabled = false; btn.textContent = 'Save regions';
      var e1 = rs.filter(function(r){ return r.error; })[0];
      if(e1){ fail('Could not save: ' + e1.error.message); return; }
      ok.hidden = false; setTimeout(function(){ ok.hidden = true; }, 2500); loadRegions();
    }).catch(function(){ btn.disabled = false; btn.textContent = 'Save regions'; fail('Could not reach Supabase. Try again.'); });
  });

  /* ---------- Discount codes ---------- */`;

/* ---------- Jobs ---------- */
function templateJob(t, problems) {
  const name = 'template';
  if (t.includes('id="regionBox"')) return { t, done: true };
  t = applyEdits(t, [
    ['  .form-error{ color: #8A2E20; font-size: .9rem; }', STORE_CSS],
    ['      <label><span data-i18n="address_label">Delivery address (optional)</span>', STORE_LABEL],
    ["show_more:'Show more', show_less:'Show less',", TXT_EN],
    ["show_more:'عرض المزيد', show_less:'عرض أقل',", TXT_AR],
    ['  var store = {delivery_fee:0, free_delivery_over:null, min_order:0};', STORE_STATE],
    ['    var f = Number(store.delivery_fee) || 0; if(f <= 0) return 0;',
     '    var rf = regionFee(), f = rf != null ? rf : (Number(store.delivery_fee) || 0); if(f <= 0) return 0;'],
    ['var fee = deliveryFor(tot.sum), baseFee = Number(store.delivery_fee) || 0;',
     'var rf = regionFee(), fee = deliveryFor(tot.sum), baseFee = rf != null ? rf : (Number(store.delivery_fee) || 0);'],
    ["    if(!sb){ showOrderError('order_err'); return; }",
     "    if(!sb){ showOrderError('order_err'); return; }\n    if(REGIONS.length && !regionById(regionId)){ showOrderError('region_required'); return; }"],
    ['    if(codeUsed) args.p_code = codeUsed;',
     "    if(REGIONS.length && regionById(regionId)){ args.p_code = codeUsed || null; args.p_region = Number(regionId); }\n    else if(codeUsed) args.p_code = codeUsed;"],
    ["          else if(tooMany){ showOrderError('order_rate'); }",
     "          else if(/delivery region/i.test(msg)){ showOrderError('region_required'); loadRegions(); }\n          else if(tooMany){ showOrderError('order_rate'); }"],
    ['lastOrder = res.data; cart = {}; saveCart(); e.target.reset();', 'lastOrder = res.data; cart = {}; saveCart(); e.target.reset(); renderRegions();'],
    ["  $('#orderForm').addEventListener('submit', submitOrder);",
     "  $('#orderForm').addEventListener('submit', submitOrder);\n  $('#regionSel').addEventListener('change', function(){\n    regionId = this.value; try{ localStorage.setItem('avara-region', regionId); }catch(e){}\n    renderCart();\n  });"],
    ['    applyStore();\n    renderCart();', '    applyStore();\n    renderRegions();\n    renderCart();'],
    ['  loadStore();\n  loadReviews();', '  loadStore();\n  loadRegions();\n  loadReviews();'],
  ], name, problems);
  return { t, done: false };
}

function adminJob(t, problems) {
  const name = 'admin';
  if (t.includes('id="regionsBox"')) return { t, done: true };
  t = applyEdits(t, [
    ['  .ar{ direction:rtl; text-align:right; }', ADMIN_CSS],
    ['      <div class="settings" id="mfaBox" style="margin-top:20px">', ADMIN_HTML],
    ['  /* ---------- Discount codes ---------- */', ADMIN_JS],
    ['loadSettings(); refreshMfaStatus(); loadReviews();', 'loadSettings(); loadRegions(); refreshMfaStatus(); loadReviews();'],
  ], name, problems);
  return { t, done: false };
}

const jobs = [
  { label: 'template', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'admin page', required: true, file: first(['admin.html']), run: adminJob },
  { label: 'service worker', file: first(['sw.js']), run: (t, p) => {
      if (t.includes('// regions')) return { t, done: true };
      const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';/);
      if (!m) { p.push('sw.js: could not find the CACHE_VERSION line'); return { t, done: false }; }
      return { t: t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // regions"), done: false };
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
if (plan.length) console.log('\nNext: run phase6-delivery-regions.sql in Supabase, then node tools/build-pages.js, then commit and push.');
