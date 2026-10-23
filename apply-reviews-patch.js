#!/usr/bin/env node
/*
 * AVARA — customer reviews + trust facts
 *
 * What it changes (run from the project root):
 *   tools/template.html : a "Shopping with AVARA" facts block (true facts only) and a "What customers say"
 *                         section that stays hidden until at least one review has been approved
 *   admin.html          : a Reviews tab (approve / hide / delete) and, on delivered orders, a WhatsApp
 *                         "Request review" link that opens a ready message with the /review link
 *   vercel.json         : /review -> /review.html
 *   sw.js               : cache version bumped
 * You also need (not changed by this script): review.html in the project root, and phase5-reviews.sql run once in Supabase.
 *
 *   node apply-reviews-patch.js
 * Then:  node tools/build-pages.js   (rebuilds the six storefront pages from the template)
 *
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');

const first = (list) => list.find((f) => fs.existsSync(f));
const FILES = {
  template: first(['tools/template.html', 'template.html']),
  admin: first(['admin.html', 'public/admin.html']),
  vercel: first(['vercel.json']),
  sw: first(['sw.js', 'public/sw.js']),
};
for (const [k, v] of Object.entries(FILES)) {
  if (!v) { console.error('Could not find the ' + k + ' file. Run this from the project root.'); process.exit(1); }
}
if (!fs.existsSync('review.html') && !fs.existsSync('public/review.html')) {
  console.error('review.html is not in the project root. Copy it next to this script first.'); process.exit(1);
}

/* ====================================================================== template.html */
const tpl = [];
const T = (find, replace) => tpl.push([find, replace]);

T('  /* About */',
`  /* Facts + customer reviews */
  .facts{ padding-block: 64px; }
  .facts__grid{ margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 20px; list-style: none; }
  .fact{ padding: 24px 24px 22px; background: var(--white); border: 1px solid var(--mint-2); display: flex; flex-direction: column; gap: 8px; }
  .fact h3{ font-size: 1.05rem; font-weight: 500; line-height: 1.3; color: var(--teal-deep); }
  .fact p{ color: var(--ink-soft); font-size: .95rem; line-height: 1.55; flex: 1; }
  .fact a{ font-size: .92rem; font-weight: 500; color: var(--teal-deep); text-decoration: none; border-bottom: 1px solid var(--teal); align-self: flex-start; }
  .fact a:hover{ border-color: var(--teal-deep); }
  .rv__head{ display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 32px; margin-bottom: 36px; }
  .rv__sum{ display: flex; align-items: center; gap: 14px; }
  .rv__avg{ font-size: 2.6rem; font-weight: 300; line-height: 1; }
  .rv__count{ color: var(--ink-soft); font-size: .92rem; }
  .rv__stars{ display: inline-flex; gap: 2px; font-size: 1.1rem; line-height: 1; }
  .rv__star{ color: var(--mint-2); }
  .rv__star.on{ color: #C9962B; }
  .rv__list{ list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
  .rv__item{ background: var(--white); border: 1px solid var(--mint-2); padding: 24px 24px 20px; display: flex; flex-direction: column; gap: 12px; }
  .rv__text{ line-height: 1.6; flex: 1; }
  .rv__who{ display: flex; justify-content: space-between; gap: 12px; font-size: .88rem; color: var(--ink-soft); }
  .rv__who strong{ color: var(--ink); font-weight: 500; }
  .rv__foot{ margin-top: 24px; font-size: .88rem; color: var(--ink-soft); display: flex; flex-wrap: wrap; gap: 8px 24px; }
  .rv__foot a{ color: var(--teal-deep); }

  /* About */`);

T('  <section class="section about" id="about" aria-labelledby="aboutTitle">',
`  <section class="section facts" id="facts" aria-labelledby="factsTitle">
    <div class="wrap">
      <h2 class="h2" id="factsTitle" data-i18n="trust_title">Shopping with AVARA</h2>
      <ul class="facts__grid" id="factsGrid"></ul>
    </div>
  </section>

  <section class="section section--mist" id="reviews" aria-labelledby="reviewsTitle" hidden>
    <div class="wrap">
      <div class="rv__head">
        <h2 class="h2" id="reviewsTitle" data-i18n="rv_title">What customers say</h2>
        <div class="rv__sum" id="rvSum"></div>
      </div>
      <ul class="rv__list" id="rvList"></ul>
      <p class="rv__foot"><span data-i18n="rv_note">Reviews come from customers whose order was delivered, and are published after we approve them.</span> <a href="/review" data-i18n="rv_cta">Bought from us? Leave a review</a></p>
    </div>
  </section>

  <section class="section about" id="about" aria-labelledby="aboutTitle">`);

T("langBtn:'العربية'",
`trust_title:'Shopping with AVARA',
      fx_support_h:'Support', fx_support_p:'Chat with us on the website or on WhatsApp at 76 681 395 about products, orders or delivery.',
      fx_track_h:'Track your order', fx_track_p:'Follow your order from confirmation to delivery with your order number and phone number.',
      fx_rx_h:'Prescriptions',
      fx_order_h:'Delivery and payment', fx_order_p:'We contact you to confirm your order, delivery and payment.',
      fx_brands_h:'{n} brands', fx_brands_p:'In our catalogue today.',
      rv_title:'What customers say', rv_one:'1 review', rv_many:'{n} reviews', rv_stars:'{n} out of 5 stars',
      rv_note:'Reviews come from customers whose order was delivered, and are published after we approve them.', rv_cta:'Bought from us? Leave a review',
      langBtn:'العربية'`);

T("langBtn:'English'",
`trust_title:'التسوّق مع AVARA',
      fx_support_h:'الدعم', fx_support_p:'تحدّث معنا على الموقع أو عبر واتساب على 76 681 395 عن المنتجات أو الطلبات أو التوصيل.',
      fx_track_h:'تتبّع طلبك', fx_track_p:'تابع طلبك من التأكيد حتى التسليم باستخدام رقم الطلب ورقم الهاتف.',
      fx_rx_h:'الوصفات الطبية',
      fx_order_h:'التوصيل والدفع', fx_order_p:'نتواصل معك لتأكيد الطلب والتوصيل والدفع.',
      fx_brands_h:'{n} علامة تجارية', fx_brands_p:'في كتالوجنا اليوم.',
      rv_title:'آراء العملاء', rv_one:'تقييم واحد', rv_many:'{n} تقييمات', rv_stars:'{n} من 5 نجوم',
      rv_note:'التقييمات من عملاء تم تسليم طلباتهم، وتُنشر بعد موافقتنا عليها.', rv_cta:'اشتريت منا؟ اترك تقييمك',
      langBtn:'English'`);

T('  function renderDept(d){ renderTools(d); renderGrid(d); }',
`  /* ---------- Facts block (only things that are true and come from the store itself) ---------- */
  function renderTrust(){
    var grid = $('#factsGrid'); if(!grid) return;
    var seen = {}, nb = 0;
    PRODUCTS.forEach(function(p){ if(p.brand && !seen[p.brand]){ seen[p.brand] = 1; nb++; } });
    var dp = [storeText('delivery'), storeText('payment')].filter(Boolean).join(' · ');
    var items = [
      {h:t('fx_support_h'), p:t('fx_support_p'), href:'https://wa.me/' + WA_NUMBER, label:t('c_wa'), ext:true},
      {h:t('fx_track_h'), p:t('fx_track_p'), href:'/track', label:t('track_order')},
      {h:t('fx_rx_h'), p:t('rx_note')},
      {h:t('fx_order_h'), p:dp || t('fx_order_p')}
    ];
    if(nb >= 3) items.push({h:t('fx_brands_h').replace('{n}', nb), p:t('fx_brands_p')});
    grid.innerHTML = items.map(function(i){
      return '<li class="fact"><h3>' + esc(i.h) + '</h3><p>' + esc(i.p) + '</p>' +
        (i.href ? '<a href="' + esc(i.href) + '"' + (i.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(i.label) + '</a>' : '') + '</li>';
    }).join('');
  }

  /* ---------- Customer reviews (approved in admin; the section stays hidden until there is one) ---------- */
  var REVIEWS = null;
  function starsHtml(n){
    var s = '';
    for(var i = 1; i <= 5; i++) s += '<span class="rv__star' + (i <= n ? ' on' : '') + '" aria-hidden="true">★</span>';
    return '<span class="rv__stars" role="img" aria-label="' + esc(t('rv_stars').replace('{n}', n)) + '">' + s + '</span>';
  }
  function loadReviews(){
    if(!sb) return Promise.resolve();
    return sb.rpc('public_reviews').then(function(r){
      if(r.error || !r.data) return;   // table not created yet: the section just stays hidden
      REVIEWS = r.data; renderReviews();
    }).catch(function(){});
  }
  function renderReviews(){
    var sec = $('#reviews'); if(!sec) return;
    var d = REVIEWS, count = d ? Number(d.count) : 0;
    if(!d || !(count > 0)){ sec.hidden = true; return; }
    var avg = Number(d.avg) || 0;
    $('#rvSum').innerHTML = '<span class="rv__avg" dir="ltr">' + esc(avg.toFixed(1)) + '</span><div>' + starsHtml(Math.round(avg)) +
      '<div class="rv__count">' + esc(count === 1 ? t('rv_one') : t('rv_many').replace('{n}', count)) + '</div></div>';
    $('#rvList').innerHTML = (d.items || []).filter(function(r){ return r.comment; }).map(function(r){
      var date = new Date(r.created_at).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', {dateStyle:'medium'});
      return '<li class="rv__item">' + starsHtml(Number(r.rating)) +
        '<p class="rv__text" dir="auto">' + esc(r.comment) + '</p>' +
        '<div class="rv__who"><strong>' + esc(r.name) + '</strong><span>' + esc(date) + '</span></div></li>';
    }).join('');
    sec.hidden = false;
  }

  function renderDept(d){ renderTools(d); renderGrid(d); }`);

T('runSearch(); renderPromos();', 'runSearch(); renderPromos(); renderTrust(); renderReviews();');
T('updateItemList(); loadPromos();', 'updateItemList(); loadPromos(); renderTrust();');
T('    updateBusinessLd();', '    updateBusinessLd(); renderTrust();');
T('  loadProducts();\n  loadStore();\n  resetChat();', '  loadProducts();\n  loadStore();\n  loadReviews();\n  resetChat();');

/* ====================================================================== admin.html */
const adm = [];
const A = (find, replace) => adm.push([find, replace]);

A('<button class="tab" role="tab" id="tabSettings" aria-selected="false">Settings</button>',
  '<button class="tab" role="tab" id="tabReviews" aria-selected="false">Reviews <span class="pill" id="revPill" hidden>0</span></button>\n        <button class="tab" role="tab" id="tabSettings" aria-selected="false">Settings</button>');

A('    <!-- Settings -->\n    <section id="panelSettings" hidden>',
`    <!-- Reviews -->
    <section id="panelReviews" hidden>
      <div class="bar">
        <h2>Customer reviews</h2>
        <select id="revFilter" aria-label="Filter">
          <option value="waiting">Waiting for approval</option>
          <option value="approved">Published</option>
          <option value="all">All</option>
        </select>
        <button class="btn" id="refreshReviews" type="button">Refresh</button>
      </div>
      <p class="hint" style="margin:0 0 12px">Customers can only review an order that is marked Delivered, using the order number and their phone. Nothing appears on the website until you tap Publish. To ask for a review, open Orders and tap Request review on a delivered order.</p>
      <p class="msg msg--err" id="revErr" role="alert" hidden></p>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Customer</th><th>Rating</th><th>Review</th><th>Order</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody id="revRows"></tbody>
        </table>
      </div>
      <p class="empty" id="revEmpty" hidden>No reviews here yet.</p>
    </section>

    <!-- Settings -->
    <section id="panelSettings" hidden>`);

A("    $('#panelSettings').hidden = name !== 'settings';",
  "    $('#panelSettings').hidden = name !== 'settings';\n    $('#tabReviews').setAttribute('aria-selected', name === 'reviews');\n    $('#panelReviews').hidden = name !== 'reviews';");

A("  $('#tabOrders').addEventListener('click', function(){ tab('orders'); loadOrders(); });",
  "  $('#tabOrders').addEventListener('click', function(){ tab('orders'); loadOrders(); });\n  $('#tabReviews').addEventListener('click', function(){ tab('reviews'); loadReviews(); });");

A('loadProducts().then(loadWaiting); loadOrders(); loadSettings(); refreshMfaStatus();',
  'loadProducts().then(loadWaiting); loadOrders(); loadSettings(); refreshMfaStatus(); loadReviews();');

A('  /* ---------- Orders ---------- */\n  var STATUSES',
`  /* ---------- Reviews ---------- */
  var reviews = [];
  function reviewStars(n){ var s = ''; for(var i = 1; i <= 5; i++) s += (i <= n ? '★' : '☆'); return s; }
  function renderReviews(){
    var f = $('#revFilter').value;
    var waiting = reviews.filter(function(r){ return !r.is_approved; }).length;
    var pill = $('#revPill'); pill.textContent = waiting; pill.hidden = waiting === 0;
    var list = reviews.filter(function(r){ return f === 'all' ? true : f === 'approved' ? r.is_approved : !r.is_approved; });
    $('#revEmpty').hidden = list.length > 0;
    $('#revRows').innerHTML = list.map(function(r){
      var date = new Date(r.created_at).toLocaleDateString('en', {dateStyle:'medium'});
      return '<tr><td>' + esc(r.name) + (r.lang === 'ar' ? ' <small>(Arabic)</small>' : '') + '</td>' +
        '<td style="white-space:nowrap;color:#C9962B" title="' + esc(r.rating) + ' / 5">' + reviewStars(Number(r.rating)) + '</td>' +
        '<td dir="auto" style="max-width:380px">' + (r.comment ? esc(r.comment) : '<span class="hint">(rating only)</span>') + '</td>' +
        '<td>#' + esc(r.order_no) + '</td><td>' + esc(date) + '</td>' +
        '<td>' + (r.is_approved ? '<strong style="color:#1F5F6B">Published</strong>' : 'Waiting') + '</td>' +
        '<td><div class="actions">' +
          '<button class="btn btn--sm" data-rev-toggle="' + esc(r.id) + '">' + (r.is_approved ? 'Hide' : 'Publish') + '</button>' +
          '<button class="btn btn--sm btn--danger" data-rev-del="' + esc(r.id) + '">Delete</button></div></td></tr>';
    }).join('');
  }
  function loadReviews(){
    return sb.from('reviews').select('*').order('created_at', {ascending:false}).limit(1000).then(function(r){
      var err = $('#revErr');
      if(r.error){ err.textContent = 'Reviews are not available yet. Run phase5-reviews.sql in the Supabase SQL Editor. (' + r.error.message + ')'; err.hidden = false; return; }
      err.hidden = true; reviews = r.data || []; renderReviews();
      if(orders.length) renderOrders();   // so delivered orders show "Reviewed"
    });
  }
  // WhatsApp message (English + Arabic) that asks a customer of a delivered order for a review.
  function reviewReqLink(o){
    if(o.status !== 'delivered') return '';
    if(reviews.some(function(r){ return String(r.order_no) === String(o.order_no); })) return ' · <span class="hint">Reviewed</span>';
    var first = String(o.customer_name || '').trim().split(/\\s+/)[0] || '';
    var url = location.origin + '/review?no=' + o.order_no;
    var txt = 'Hello' + (first ? ' ' + first : '') + ', thank you for ordering from AVARA. We would love to hear how it went: ' + url +
      '\\n\\nمرحباً' + (first ? ' ' + first : '') + '، شكراً لطلبك من AVARA. يسعدنا سماع رأيك: ' + url;
    return ' · <a href="https://wa.me/' + esc(waNumber(o.phone)) + '?text=' + encodeURIComponent(txt) + '" target="_blank" rel="noopener">Request review</a>';
  }
  $('#revFilter').addEventListener('change', renderReviews);
  $('#refreshReviews').addEventListener('click', loadReviews);
  $('#revRows').addEventListener('click', function(e){
    var b;
    function byId(id){ return reviews.filter(function(x){ return String(x.id) === String(id); })[0]; }
    if((b = e.target.closest('[data-rev-toggle]'))){
      var r = byId(b.getAttribute('data-rev-toggle'));
      sb.from('reviews').update({is_approved: !r.is_approved}).eq('id', r.id).then(function(x){
        if(x.error) alert('Could not update: ' + x.error.message); else loadReviews();
      });
    } else if((b = e.target.closest('[data-rev-del]'))){
      if(!confirm('Delete this review? This cannot be undone.')) return;
      sb.from('reviews').delete().eq('id', b.getAttribute('data-rev-del')).then(function(x){
        if(x.error) alert('Could not delete: ' + x.error.message); else loadReviews();
      });
    }
  });

  /* ---------- Orders ---------- */
  var STATUSES`);

A('esc(waNumber(o.phone)) + \'" target="_blank" rel="noopener">WhatsApp</a></div>\' +',
  'esc(waNumber(o.phone)) + \'" target="_blank" rel="noopener">WhatsApp</a>\' + reviewReqLink(o) + \'</div>\' +');

/* ====================================================================== vercel.json + sw.js */
const vj = [], V = (f, r) => vj.push([f, r]);
V('"destination": "/track.html"\n    }',
  '"destination": "/track.html"\n    },\n    {\n      "source": "/review",\n      "destination": "/review.html"\n    }');
const swe = [], S = (f, r) => swe.push([f, r]);
S("const CACHE_VERSION = 'avara-v7';", "const CACHE_VERSION = 'avara-v8';");

/* ====================================================================== run (all or nothing) */
const jobs = [
  { file: FILES.template, edits: tpl, done: 'id="factsGrid"' },
  { file: FILES.admin, edits: adm, done: 'id="panelReviews"' },
  { file: FILES.vercel, edits: vj, done: '"/review"' },
  { file: FILES.sw, edits: swe, done: "'avara-v8'" },
];
const plan = [];
let problems = 0;
for (const j of jobs) {
  const raw = fs.readFileSync(j.file, 'utf8');
  const crlf = raw.includes('\r\n');
  let t = raw.replace(/\r\n/g, '\n');
  if (t.includes(j.done)) { console.log(j.file + ': already up to date'); continue; }
  for (const [find] of j.edits) {
    const n = t.split(find).length - 1;
    if (n !== 1) {
      problems++;
      console.error(j.file + ': expected one match but found ' + n + ' for:\n  ' + find.split('\n')[0].slice(0, 110));
    }
  }
  if (problems) continue;
  for (const [find, replace] of j.edits) t = t.replace(find, () => replace);
  plan.push({ file: j.file, raw, out: crlf ? t.replace(/\n/g, '\r\n') : t });
}
if (problems) { console.error('\nNothing was changed. Send me the file(s) named above and I will adjust the patch.'); process.exit(1); }
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.out);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
if (plan.length) console.log('\nNext: node tools/build-pages.js   then commit and push to deploy.');
