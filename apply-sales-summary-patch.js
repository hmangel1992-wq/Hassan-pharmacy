#!/usr/bin/env node
/*
 * AVARA — Sales summary in the admin dashboard
 *
 *   Adds a "Sales" tab: pick Today / Last 7 days / Last 30 days / This month / All time, and see
 *     - orders, revenue, items sold, average order, discounts given, delivery fees
 *     - every item sold, with units and revenue (best sellers first), and a CSV download
 *     - sales by day, orders by status, and (when available) by delivery region and by payment method
 *   Everything is calculated from your real orders. Cancelled orders are left out (or choose "Delivered only").
 *   Revenue is the order total: products + delivery - discount. Item prices are the prices at the time of each order.
 *
 * Changes only:  admin.html   (no database change)
 * Run from the project root:   node apply-sales-summary-patch.js
 * Then push (admin.html is not part of the page build).
 * Safe to run twice. If a line it expects is missing, it changes nothing at all and tells you which one.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

const CSS = `  [dir="rtl-field"]{ direction:rtl; }
  .kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; margin-bottom:22px; }
  .kpi{ background:var(--white); border:1px solid var(--mist-2); padding:16px 18px; }
  .kpi small{ display:block; color:var(--ink-soft); font-size:.8rem; }
  .kpi strong{ display:block; font-size:1.55rem; font-weight:500; line-height:1.25; margin-top:2px; }
  .sales-grid{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:22px; align-items:start; }
  .sales-grid h3, #panelSales h3{ font-size:1.05rem; font-weight:500; margin:0 0 8px; }
  .tbl td.num, .tbl th.num{ text-align:end; white-space:nowrap; }
  .tbl tfoot td{ font-weight:600; background:#F3FAF9; }
  @media (max-width:860px){ .sales-grid{ grid-template-columns:1fr; } }`;

const TAB_ANCHOR = '        <button class="tab" role="tab" id="tabSettings" aria-selected="false">Settings</button>';
const TAB_NEW = '        <button class="tab" role="tab" id="tabSales" aria-selected="false">Sales</button>\n' + TAB_ANCHOR;

const PANEL_ANCHOR = '    <!-- Settings -->\n    <section id="panelSettings" hidden>';
const PANEL_NEW = `    <!-- Sales summary -->
    <section id="panelSales" hidden>
      <div class="bar">
        <h2>Sales summary</h2>
        <select id="salesPeriod" aria-label="Period">
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30" selected>Last 30 days</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
        <select id="salesBasis" aria-label="Which orders to count">
          <option value="active">All except cancelled</option>
          <option value="delivered">Delivered only</option>
        </select>
        <button class="btn" id="salesCsv" type="button">Download items CSV</button>
        <button class="btn" id="refreshSales" type="button">Refresh</button>
      </div>
      <p class="hint" style="margin:0 0 14px">Calculated from your real orders. Revenue is the order total (products + delivery − discount). Item prices are the prices at the time of each order. All amounts are in USD.</p>
      <p class="msg msg--err" id="salesErr" role="alert" hidden></p>
      <div class="kpis" id="salesKpis"></div>
      <h3>Items sold</h3>
      <div class="table-wrap"><table class="tbl" id="salesItems"></table></div>
      <div class="sales-grid">
        <div><h3>Sales by day</h3><div class="table-wrap"><table class="tbl" id="salesDays"></table></div></div>
        <div id="salesExtra"></div>
      </div>
    </section>

    <!-- Settings -->
    <section id="panelSettings" hidden>`;

const TAB_FN_ANCHOR = "    $('#panelSettings').hidden = name !== 'settings';";
const TAB_FN_NEW = TAB_FN_ANCHOR + "\n    $('#tabSales').setAttribute('aria-selected', name === 'sales');\n    $('#panelSales').hidden = name !== 'sales';";

const CLICK_ANCHOR = "  $('#tabOrders').addEventListener('click', function(){ tab('orders'); loadOrders(); });";
const CLICK_NEW = CLICK_ANCHOR + "\n  $('#tabSales').addEventListener('click', function(){ tab('sales'); loadSales(); });";

const JS_ANCHOR = "  /* ---------- Orders ---------- */\n  var STATUSES = [";
const JS_NEW = `  /* ---------- Sales summary ---------- */
  var salesRows = [];
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function dayKey(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function salesStart(){
    var v = $('#salesPeriod').value, d = new Date(); d.setHours(0, 0, 0, 0);
    if(v === 'today') return d;
    if(v === '7'){ d.setDate(d.getDate() - 6); return d; }
    if(v === '30'){ d.setDate(d.getDate() - 29); return d; }
    if(v === 'month'){ d.setDate(1); return d; }
    return null;
  }
  // Orders are fetched 1000 at a time, so a long period is complete. If the delivery_region column does not exist yet, it is skipped.
  function fetchSalesRows(start){
    var cols = ['created_at,status,total,discount,delivery_fee,items,notes,delivery_region', 'created_at,status,total,discount,delivery_fee,items,notes'];
    function run(ci){
      var all = [], size = 1000;
      function next(from){
        var q = sb.from('orders').select(cols[ci]).order('created_at', {ascending:false}).order('id');
        if(start) q = q.gte('created_at', start.toISOString());
        return q.range(from, from + size - 1).then(function(r){
          if(r.error) return {error: r.error};
          var rows = r.data || []; all = all.concat(rows);
          return rows.length === size ? next(from + size) : {data: all};
        });
      }
      return next(0).then(function(res){
        if(res.error && ci === 0 && /delivery_region/i.test(res.error.message || '')) return run(1);
        return res;
      });
    }
    return run(0).catch(function(e){ return {error: e || {message: 'network error'}}; });
  }
  function loadSales(){
    var err = $('#salesErr'); err.hidden = true;
    return fetchSalesRows(salesStart()).then(function(r){
      if(r.error){ err.textContent = 'Could not load orders: ' + (r.error.message || 'unknown error'); err.hidden = false; return; }
      salesRows = r.data || []; renderSales();
    });
  }
  function salesTable(head, body, foot){
    return '<thead><tr>' + head.map(function(h, i){ return '<th' + (i ? ' class="num"' : '') + '>' + h + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + body + '</tbody>' + (foot ? '<tfoot>' + foot + '</tfoot>' : '');
  }
  function srow(cells){ return '<tr>' + cells.map(function(c, i){ return '<td' + (i ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }
  var salesItemsList = [];
  function renderSales(){
    var basis = $('#salesBasis').value, rows = salesRows;
    var cancelled = rows.filter(function(o){ return o.status === 'cancelled'; }).length;
    var list = rows.filter(function(o){ return basis === 'delivered' ? o.status === 'delivered' : o.status !== 'cancelled'; });
    var rev = 0, units = 0, sub = 0, disc = 0, fee = 0, prod = {}, days = {}, reg = {}, pay = {}, st = {};
    rows.forEach(function(o){ st[o.status] = (st[o.status] || 0) + 1; });
    list.forEach(function(o){
      var total = Number(o.total) || 0, oUnits = 0;
      rev += total; disc += Number(o.discount) || 0; fee += Number(o.delivery_fee) || 0;
      (o.items || []).forEach(function(i){
        var q = Number(i.qty) || 0, p = Number(i.price) || 0, k = String(i.id != null ? i.id : i.name_en);
        oUnits += q; units += q; sub += q * p;
        var x = prod[k] || (prod[k] = {name: i.name_en || k, qty: 0, rev: 0, orders: 0});
        x.qty += q; x.rev += q * p; x.orders++;
      });
      var dk = dayKey(new Date(o.created_at)), d = days[dk] || (days[dk] = {n: 0, units: 0, rev: 0});
      d.n++; d.units += oUnits; d.rev += total;
      if(o.delivery_region){ var g = reg[o.delivery_region] || (reg[o.delivery_region] = {n: 0, rev: 0}); g.n++; g.rev += total; }
      var m = /^\\[Payment: (Whish|Cash on delivery)\\]/.exec(o.notes || ''), pk = m ? m[1] : 'Not recorded';
      var pp = pay[pk] || (pay[pk] = {n: 0, rev: 0}); pp.n++; pp.rev += total;
    });
    var n = list.length;
    $('#salesKpis').innerHTML = [
      ['Orders', String(n) + (cancelled && basis === 'active' ? ' <span class="hint">(+' + cancelled + ' cancelled, not counted)</span>' : '')],
      ['Revenue', money(rev)], ['Items sold', String(units)], ['Average order', n ? money(rev / n) : money(0)],
      ['Products total', money(sub)], ['Discounts given', money(disc)], ['Delivery charged', money(fee)]
    ].map(function(k){ return '<div class="kpi"><small>' + k[0] + '</small><strong>' + k[1] + '</strong></div>'; }).join('');

    salesItemsList = Object.keys(prod).map(function(k){ return prod[k]; }).sort(function(a, b){ return b.qty - a.qty || b.rev - a.rev || String(a.name).localeCompare(String(b.name)); });
    $('#salesItems').innerHTML = salesItemsList.length
      ? salesTable(['Item', 'Units sold', 'In orders', 'Revenue', 'Share'], salesItemsList.map(function(x){
          return srow([esc(x.name), String(x.qty), String(x.orders), money(x.rev), sub > 0 ? (x.rev / sub * 100).toFixed(1) + '%' : '-']);
        }).join(''), srow(['Total', String(units), '', money(sub), sub > 0 ? '100%' : '']))
      : '<tbody><tr><td class="empty">No orders in this period.</td></tr></tbody>';

    var dkeys = Object.keys(days).sort().reverse();
    $('#salesDays').innerHTML = dkeys.length
      ? salesTable(['Day', 'Orders', 'Items', 'Revenue'], dkeys.map(function(k){ var d = days[k]; return srow([esc(k), String(d.n), String(d.units), money(d.rev)]); }).join(''))
      : '<tbody><tr><td class="empty">No orders in this period.</td></tr></tbody>';

    var extra = '';
    function block(title, obj, labels){
      var ks = Object.keys(obj).sort(function(a, b){ return obj[b].rev - obj[a].rev; });
      if(!ks.length) return '';
      return '<h3' + (extra ? ' style="margin-top:22px"' : '') + '>' + title + '</h3><div class="table-wrap"><table class="tbl">' +
        salesTable([labels, 'Orders', 'Revenue'], ks.map(function(k){ return srow([esc(k), String(obj[k].n), money(obj[k].rev)]); }).join('')) + '</table></div>';
    }
    extra += block('By delivery region', reg, 'Region');
    extra += block('By payment method', pay, 'Method');
    var sk = Object.keys(st);
    if(sk.length) extra += '<h3 style="margin-top:22px">Orders by status</h3><div class="table-wrap"><table class="tbl">' +
      salesTable(['Status', 'Orders'], sk.map(function(k){ return srow([esc(String(k).replace(/_/g, ' ')), String(st[k])]); }).join('')) + '</table></div>';
    $('#salesExtra').innerHTML = extra;
  }
  $('#salesPeriod').addEventListener('change', loadSales);
  $('#salesBasis').addEventListener('change', renderSales);
  $('#refreshSales').addEventListener('click', loadSales);
  $('#salesCsv').addEventListener('click', function(){
    var q = function(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Item', 'Units sold', 'In orders', 'Revenue (USD)']].concat(salesItemsList.map(function(x){ return [x.name, x.qty, x.orders, x.rev.toFixed(2)]; }));
    var csv = '\\ufeff' + rows.map(function(r){ return r.map(q).join(','); }).join('\\r\\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
    a.download = 'avara-items-sold.csv'; document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---------- Orders ---------- */
  var STATUSES = [`;

const EDITS = [
  ['  [dir="rtl-field"]{ direction:rtl; }', CSS],
  [TAB_ANCHOR, TAB_NEW],
  [PANEL_ANCHOR, PANEL_NEW],
  [TAB_FN_ANCHOR, TAB_FN_NEW],
  [CLICK_ANCHOR, CLICK_NEW],
  [JS_ANCHOR, JS_NEW],
];

const file = first(['admin.html']);
if (!file) { console.error('Could not find admin.html. Run this from the project root.'); process.exit(1); }
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes('id="panelSales"')) { console.log(file + ': already up to date'); process.exit(0); }
const problems = [];
for (const [find, rep] of EDITS) {
  const n = count(t, find);
  if (n !== 1) { problems.push(file + ': expected 1 match but found ' + n + ' for: ' + find.split('\n')[0].trim().slice(0, 90)); continue; }
  t = t.replace(find, () => rep);
}
if (problems.length) {
  console.error('Nothing was changed. Please send me admin.html and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
fs.writeFileSync(file + '.bak', raw);
fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log(file + ': updated (backup saved as ' + file + '.bak)');
console.log('\nNext: commit and push, then open Admin > Sales.');
