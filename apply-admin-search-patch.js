#!/usr/bin/env node
/*
 * AVARA — admin Products search patch
 *   Adds to admin.html > Products:
 *     - a search box (name in English/Arabic, brand, size, section, category; several words = all must match;
 *       accents ignored, so "kerastase" finds "Kérastase")
 *     - a status filter (All / Visible / Hidden / Out of stock)
 *     - 50 products per page with Previous / Next
 *     - loads the whole catalogue (Supabase returns only 1000 rows per request, so a big import was cut off)
 *     - the Promotions product picker shows 100 matches at a time so it stays fast
 * Run from the project root:   node apply-admin-search-patch.js
 * Safe to run twice. If a line it expects is missing it changes nothing.
 */
const fs = require('fs');

const file = ['admin.html', 'public/admin.html'].find((f) => fs.existsSync(f));
if (!file) { console.error('admin.html not found: run this from the project root'); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');

if (t.includes('id="productSearch"')) { console.log(file + ': already up to date'); process.exit(0); }

// Each edit: [what to find (must occur exactly once), what to put instead]
const edits = [];
const edit = (find, replace) => edits.push([find, replace]);

/* ---------- CSS ---------- */
edit(
  '  .table-wrap{ overflow-x:auto; }',
  `  .table-wrap{ overflow-x:auto; }
  .bar input[type="search"]{ padding:8px 12px; border:1px solid var(--sage-deep); border-radius:2px; background:var(--white); flex:0 1 320px; min-width:200px; }
  .bar h2 .hint{ font-size:.9rem; font-weight:400; }
  .pager{ display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; margin-top:16px; }
  .pager .hint{ margin:0 8px; }`
);

/* ---------- HTML: title count, search box, status filter, pager ---------- */
edit(
  '<h2>Products</h2>',
  '<h2>Products <span class="hint" id="productCount"></span></h2>\n        <input id="productSearch" type="search" placeholder="Search name, brand, size, category…" autocomplete="off" aria-label="Search products">'
);
edit(
  '<button class="btn btn--solid" id="addProduct" type="button">Add product</button>',
  `<select id="productStatusFilter" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
          <option value="out">Out of stock</option>
        </select>
        <button class="btn btn--solid" id="addProduct" type="button">Add product</button>`
);
edit(
  '<p class="empty" id="productsEmpty" hidden>No products yet. Add your first product.</p>',
  '<p class="empty" id="productsEmpty" hidden>No products yet. Add your first product.</p>\n      <div class="pager" id="productPager" hidden></div>'
);

/* ---------- JS: load every page of products ---------- */
edit(
  'function loadProducts(){',
  `// Supabase returns at most 1000 rows per request, so a big catalogue is fetched page by page.
  function fetchAllProducts(){
    var all = [], size = 1000;
    function next(from){
      return sb.from('products').select('*').order('dept').order('sort_order').order('created_at').order('id').range(from, from + size - 1).then(function(r){
        if(r.error) return {error: r.error, data: null};
        var rows = r.data || [];
        all = all.concat(rows);
        return rows.length ? next(from + rows.length) : {error: null, data: all};
      });
    }
    return next(0).catch(function(e){ return {error: e || {message: 'network error'}, data: null}; });
  }
  function loadProducts(){`
);
edit(
  "return sb.from('products').select('*').order('dept').order('sort_order').order('created_at').then(function(r){",
  'return fetchAllProducts().then(function(r){'
);

/* ---------- JS: filter + paging in the list ---------- */
edit(
  "var list = products.filter(function(p){ return f === 'all' || p.dept === f; });",
  `var all = filteredProducts(), pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if(page > pages) page = pages;
    var list = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    updateProductMeta(all.length, list.length, pages);`
);

edit(
  "$('#deptFilter').addEventListener('change', renderProducts);",
  `/* ---------- Product search + paging ---------- */
  var PAGE_SIZE = 50, page = 1, searchTimer = null;
  // Lower-case and drop accents / Arabic diacritics so "kerastase" finds "Kérastase".
  function fold(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f\\u064b-\\u065f]/g, ''); }
  function hayOf(p){
    if(!p._hay){
      var coll = p.dept === 'beauty' ? beautyColl(p.collection).label : '';
      p._hay = fold([p.name_en, p.name_ar, p.brand, p.size_en, p.size_ar, DEPT[p.dept], coll, catHint(p), p.cat].join(' '));
    }
    return p._hay;
  }
  function filteredProducts(){
    var dept = $('#deptFilter').value, st = $('#productStatusFilter').value;
    var terms = fold($('#productSearch').value).split(/\\s+/).filter(Boolean);
    var list = products.filter(function(p){
      if(dept !== 'all' && p.dept !== dept) return false;
      if(st === 'visible' && !p.is_active) return false;
      if(st === 'hidden' && p.is_active) return false;
      if(st === 'out' && Number(p.stock) > 0) return false;
      if(!terms.length) return true;
      var h = hayOf(p);
      return terms.every(function(w){ return h.indexOf(w) >= 0; });
    });
    if(terms.length){
      // Products whose NAME contains every word come before those that only match on brand, size or category.
      var inName = function(p){ var n = fold(p.name_en + ' ' + p.name_ar); return terms.every(function(w){ return n.indexOf(w) >= 0; }) ? 0 : 1; };
      list = list.map(function(p, i){ return {p: p, k: inName(p), i: i}; })
        .sort(function(a, b){ return (a.k - b.k) || (a.i - b.i); })
        .map(function(x){ return x.p; });
    }
    return list;
  }
  function updateProductMeta(total, shown, pages){
    var narrowed = $('#productSearch').value.trim() !== '' || $('#deptFilter').value !== 'all' || $('#productStatusFilter').value !== 'all';
    $('#productCount').textContent = products.length ? '(' + (narrowed ? total + ' of ' + products.length : products.length) + ')' : '';
    $('#productsEmpty').textContent = products.length ? 'No products match your search.' : 'No products yet. Add your first product.';
    var pg = $('#productPager'), from = total ? (page - 1) * PAGE_SIZE + 1 : 0, to = total ? from + shown - 1 : 0;
    pg.hidden = pages <= 1;
    pg.innerHTML =
      '<button class="btn btn--sm" type="button" data-pg="first"' + (page <= 1 ? ' disabled' : '') + '>« First</button>' +
      '<button class="btn btn--sm" type="button" data-pg="prev"' + (page <= 1 ? ' disabled' : '') + '>‹ Previous</button>' +
      '<span class="hint">' + from + '–' + to + ' of ' + total + ' · page ' + page + ' of ' + pages + '</span>' +
      '<button class="btn btn--sm" type="button" data-pg="next"' + (page >= pages ? ' disabled' : '') + '>Next ›</button>' +
      '<button class="btn btn--sm" type="button" data-pg="last"' + (page >= pages ? ' disabled' : '') + '>Last »</button>';
  }
  function resetPageAndRender(){ page = 1; renderProducts(); }
  $('#deptFilter').addEventListener('change', resetPageAndRender);
  $('#productStatusFilter').addEventListener('change', resetPageAndRender);
  $('#productSearch').addEventListener('input', function(){ clearTimeout(searchTimer); searchTimer = setTimeout(resetPageAndRender, 150); });
  $('#productPager').addEventListener('click', function(e){
    var b = e.target.closest('[data-pg]'); if(!b || b.disabled) return;
    var v = b.getAttribute('data-pg'), pages = Math.max(1, Math.ceil(filteredProducts().length / PAGE_SIZE));
    page = v === 'first' ? 1 : v === 'prev' ? page - 1 : v === 'next' ? page + 1 : pages;
    renderProducts(); window.scrollTo({top: 0});
  });`
);

/* ---------- JS: keep the Promotions picker fast with thousands of products ---------- */
edit(
  "$('#promoPick').innerHTML = list.map(function(p){",
  `var pickTotal = list.length;
    list = list.filter(function(p){ return promoSel.indexOf(String(p.id)) >= 0; })
      .concat(list.filter(function(p){ return promoSel.indexOf(String(p.id)) < 0; })).slice(0, 100);
    $('#promoPick').innerHTML = list.map(function(p){`
);
edit(
  "}).join('') || '<p class=\"empty\" style=\"margin:12px\">No products match.</p>';",
  "}).join('') + (pickTotal > 100 ? '<p class=\"hint\" style=\"margin:10px 12px\">Showing 100 of ' + pickTotal + '. Type in the box above to narrow the list.</p>' : '') || '<p class=\"empty\" style=\"margin:12px\">No products match.</p>';"
);

/* ---------- apply (all or nothing) ---------- */
for (const [find] of edits) {
  const n = t.split(find).length - 1;
  if (n !== 1) {
    console.error(file + ': expected one match but found ' + n + ' for:\n  ' + find.split('\n')[0].slice(0, 110) +
      '\nNothing changed. Send me this file and I will adjust the patch.');
    process.exit(1);
  }
}
for (const [find, replace] of edits) t = t.replace(find, () => replace);

fs.writeFileSync(file + '.bak', raw);
fs.writeFileSync(file, crlf ? t.replace(/\n/g, '\r\n') : t);
console.log(file + ': search, status filter and paging added (backup saved as ' + file + '.bak)');
console.log('\nDone. Commit and push to deploy.');
