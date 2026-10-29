#!/usr/bin/env node
/*
 * AVARA — "latest news" ticker in the top bar, managed from admin
 *
 * The thin bar above the menu (now: "Inspired by Nature. Perfected by Science") becomes a news-style ticker:
 *   - a small white "Latest" label with a softly pulsing dot, then your messages scrolling past
 *   - pauses when someone points at it, fades at the edges, tap a message to open its link (optional)
 *   - English and Arabic (Arabic scrolls the other way, as it should), fits phones, respects "reduce motion"
 *   - no messages switched on  =  it simply shows your tagline as before
 *
 * You manage the messages in admin.html > Announcements (new tab): text in English and Arabic, optional link,
 * order, start and end dates, on/off. Changes show on the website straight away, no rebuild needed.
 *
 * ORDER:  1) run phase8-announcements.sql once in the Supabase SQL Editor
 *         2) node apply-announcement-ticker-patch.js        (from the project root)
 *         3) node tools/build-pages.js    then commit and push
 *
 * Changes: tools/template.html, admin.html, sw.js.  Safe to run twice. If a line it expects is missing it changes
 * nothing at all and tells you which one. Backups are saved next to each file as .bak.
 * Note: the Track, Review, Policies and Articles pages keep their own copy of the bar and are not changed.
 */
const fs = require('fs');
const first = (list) => list.find((f) => fs.existsSync(f));
const count = (t, s) => t.split(s).length - 1;

/* ------------------------------------------------------------------ CSS (website) */
const CSS_START = '/* ===== AVARA announcement ticker (start) ===== */';
const CSS_END = '/* ===== AVARA announcement ticker (end) ===== */';
const CSS = String.raw`.announce{ display: flex; align-items: stretch; height: 38px; padding: 0; overflow: hidden; text-align: start; text-transform: none; letter-spacing: .03em; font-size: .84rem; font-weight: 500; }
.announce__tag{ display: none; align-items: center; gap: 9px; flex: none; padding: 0 18px; background: var(--white); color: var(--teal-deep); font-size: .68rem; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; }
.announce.is-live .announce__tag{ display: inline-flex; }
.announce__dot{ width: 8px; height: 8px; border-radius: 50%; background: var(--teal); animation: annPulse 1.8s ease-out infinite; }
@keyframes annPulse{ 0%{ box-shadow: 0 0 0 0 rgba(47,143,157,.55); } 70%{ box-shadow: 0 0 0 8px rgba(47,143,157,0); } 100%{ box-shadow: 0 0 0 0 rgba(47,143,157,0); } }
.announce__view{ flex: 1; min-width: 0; overflow: hidden; display: flex; align-items: center; }
.announce:not(.is-live) .announce__view{ justify-content: center; }
.announce__static{ padding: 0 16px; font-size: .76rem; letter-spacing: .2em; text-transform: uppercase; font-weight: 400; }
.announce.is-live .announce__view{ -webkit-mask-image: linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent); mask-image: linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent); }
.announce__track{ display: flex; flex: none; width: max-content; will-change: transform; animation: annLtr var(--ann-dur, 30s) linear infinite; }
[dir="rtl"] .announce__track{ animation-name: annRtl; }
.announce:hover .announce__track, .announce:focus-within .announce__track{ animation-play-state: paused; }
@keyframes annLtr{ from{ transform: translateX(0); } to{ transform: translateX(-50%); } }
@keyframes annRtl{ from{ transform: translateX(0); } to{ transform: translateX(50%); } }
.announce__seq{ display: flex; flex: none; align-items: center; }
.announce__item{ flex: none; white-space: nowrap; line-height: 38px; color: inherit; text-decoration: none; }
a.announce__item:hover{ text-decoration: underline; text-underline-offset: 4px; }
.announce__sep{ flex: none; width: 34px; text-align: center; font-size: .55rem; opacity: .7; }
.announce__track.is-still{ animation: none; margin-inline: auto; }
@media (max-width: 640px){
  .announce{ height: 36px; font-size: .8rem; }
  .announce__tag{ padding: 0 12px; gap: 7px; font-size: .62rem; letter-spacing: .12em; }
  .announce__item{ line-height: 36px; }
}`;
const CSS_BLOCK = '  ' + CSS_START + '\n' + CSS.split('\n').map((l) => '  ' + l).join('\n') + '\n  ' + CSS_END;

/* ------------------------------------------------------------------ website script */
const FN_MARK = '/* ---------- Announcement ticker';
const FUNCS = String.raw`  /* ---------- Announcement ticker (messages come from admin > Announcements) ---------- */
  var ANN = [], annSeq = '', annCount = 0, annRot = null, annTimer = null;
  function annUrl(u){ u = String(u == null ? '' : u).trim(); return /^(https?:\/\/|\/|#)/i.test(u) ? u : ''; }
  function annText(a){ return String((lang === 'ar' ? (a.text_ar || a.text_en) : (a.text_en || a.text_ar)) || '').trim(); }
  function annItem(a){
    var txt = annText(a); if(!txt) return '';
    var u = annUrl(a.link_url), ext = /^https?:/i.test(u);
    return u ? '<a class="announce__item" href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(txt) + '</a>'
             : '<span class="announce__item">' + esc(txt) + '</span>';
  }
  function loadAnnouncements(){
    if(!sb) return Promise.resolve();
    return sb.from('announcements').select('*').eq('is_active', true)
      .order('sort_order', {ascending:true}).order('created_at', {ascending:true})
      .then(function(res){
        var now = Date.now();
        ANN = res.error ? [] : (res.data || []).filter(function(a){
          return (!a.starts_at || new Date(a.starts_at) <= now) && (!a.ends_at || new Date(a.ends_at) > now);
        });
        renderAnnounce();
      })
      .catch(function(){ ANN = []; renderAnnounce(); });
  }
  function renderAnnounce(){
    var box = $('#announce'), view = $('#announceView'); if(!box || !view) return;
    clearInterval(annRot);
    var items = ANN.map(annItem).filter(Boolean);
    annCount = items.length;
    if(!annCount){
      box.classList.remove('is-live');
      view.innerHTML = '<div class="announce__static" data-i18n="announce"></div>';
      view.firstChild.textContent = t('announce');
      return;
    }
    box.classList.add('is-live');
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      // No movement: show one message at a time.
      var i = 0, showOne = function(){ view.innerHTML = '<div class="announce__track is-still">' + items[i % annCount] + '</div>'; i++; };
      showOne(); if(annCount > 1) annRot = setInterval(showOne, 6000);
      return;
    }
    annSeq = items.map(function(h){ return h + '<span class="announce__sep" aria-hidden="true">&#9670;</span>'; }).join('');
    view.innerHTML = '<div class="announce__track" id="annTrack"></div>';
    fitTicker();
  }
  // Repeats the messages until one half is wider than the bar, then doubles it so the loop has no gap.
  function fitTicker(){
    var view = $('#announceView'), track = $('#annTrack'); if(!view || !track || !annSeq) return;
    track.innerHTML = '<div class="announce__seq">' + annSeq + '</div>';
    var one = track.firstChild.offsetWidth; if(!one) return;
    var reps = Math.max(1, Math.ceil(view.clientWidth / one)), half = '';
    for(var r = 0; r < reps; r++) half += annSeq;
    track.innerHTML = '<div class="announce__seq">' + half + '</div><div class="announce__seq" aria-hidden="true">' + half + '</div>';
    Array.prototype.forEach.call(track.querySelectorAll('.announce__item'), function(el, idx){
      if(idx >= annCount){ el.setAttribute('aria-hidden', 'true'); if(el.tagName === 'A') el.setAttribute('tabindex', '-1'); }
    });
    track.style.setProperty('--ann-dur', Math.max(16, Math.round(track.firstChild.offsetWidth / 55)) + 's');
  }
  window.addEventListener('resize', function(){ clearTimeout(annTimer); annTimer = setTimeout(fitTicker, 200); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitTicker);

`;

/* ------------------------------------------------------------------ admin (new tab) */
const ADMIN_TAB = '\n        <button class="tab" role="tab" id="tabAnnouncements" aria-selected="false">Announcements</button>';
const ADMIN_PANEL = String.raw`    <!-- Announcements (ticker in the top bar) -->
    <section id="panelAnnouncements" hidden>
      <div class="bar">
        <h2>Announcements</h2>
        <button class="btn btn--solid" id="newAnn" type="button">New announcement</button>
      </div>
      <p class="hint" style="margin:0 0 12px">Short messages that scroll across the very top of the website, like a news ticker: offers, new arrivals, holiday opening hours. Write each one in English and Arabic (keep it short, up to 200 characters). Several messages scroll one after another. When none is switched on, the bar shows your tagline.</p>
      <p class="msg msg--err" id="annListErr" role="alert" hidden></p>
      <form class="settings" id="annForm" novalidate hidden>
        <h3 id="annFormTitle">New announcement</h3>
        <label class="field">Message (English)<input name="text_en" maxlength="200" placeholder="Free delivery this weekend on orders over $40"></label>
        <label class="field">الرسالة (العربية)<input class="ar" name="text_ar" maxlength="200" dir="rtl"></label>
        <div class="row3">
          <label class="field">Link when tapped (optional)<input name="link_url" maxlength="500" placeholder="/beauty  or  https://…" autocomplete="off"></label>
          <label class="field">Order (1 = first)<input name="sort_order" type="number" step="1" value="1"></label>
          <span></span>
        </div>
        <div class="row3">
          <label class="field">Starts on (optional)<input name="starts" type="date"></label>
          <label class="field">Ends on (optional)<input name="ends" type="date"></label>
          <span></span>
        </div>
        <label class="check"><input type="checkbox" name="is_active" checked> Turned on</label>
        <p class="hint" style="margin:-4px 0 12px">A link can be a page of your site (for example /beauty, /athlete, /articles or #chat) or a full address starting with https://. Leave it blank for a plain message.</p>
        <p class="msg msg--err" id="annErr" role="alert" hidden></p>
        <div class="settings__foot">
          <button class="btn btn--solid" type="submit" id="annSave">Save announcement</button>
          <button class="btn" type="button" id="annCancel">Cancel</button>
          <span class="msg msg--ok" id="annOk" hidden style="margin:0">Saved.</span>
        </div>
      </form>
      <div class="table-wrap" style="margin-top:20px">
        <table class="tbl">
          <thead><tr><th>Message</th><th>Link</th><th>Dates</th><th>Status</th><th></th></tr></thead>
          <tbody id="annRows"></tbody>
        </table>
      </div>
      <p class="empty" id="annEmpty" hidden>No announcements yet. Tap New announcement to add your first one.</p>
    </section>

`;
const ADMIN_TAB_SWITCH = "\n    $('#tabAnnouncements').setAttribute('aria-selected', name === 'announcements');\n    $('#panelAnnouncements').hidden = name !== 'announcements';";
const ADMIN_TAB_CLICK = "\n  $('#tabAnnouncements').addEventListener('click', function(){ tab('announcements'); loadAnns(); });";
const ADMIN_JS = String.raw`  /* ---------- Announcements (ticker in the top bar) ---------- */
  var anns = [], editingAnn = null;
  function annShortDate(v){ return new Date(v).toLocaleDateString('en', {dateStyle:'medium'}); }
  function annStatus(a){
    var now = Date.now();
    if(!a.is_active) return 'Off';
    if(a.starts_at && new Date(a.starts_at) > now) return 'Scheduled';
    if(a.ends_at && new Date(a.ends_at) <= now) return 'Ended';
    return '<strong style="color:#1F5F6B">Showing</strong>';
  }
  function renderAnns(){
    $('#annEmpty').hidden = anns.length > 0;
    $('#annRows').innerHTML = anns.map(function(a){
      var dates = (a.starts_at ? annShortDate(a.starts_at) : 'now') + ' to ' + (a.ends_at ? annShortDate(a.ends_at) : 'no end');
      return '<tr><td><strong>' + esc(a.text_en || '') + '</strong>' + (a.text_ar ? '<small dir="rtl">' + esc(a.text_ar) + '</small>' : '') + '<small>Order ' + esc(a.sort_order) + '</small></td>' +
        '<td dir="ltr">' + esc(a.link_url || '-') + '</td><td>' + esc(dates) + '</td><td>' + annStatus(a) + '</td>' +
        '<td><div class="actions"><button class="btn btn--sm" data-ann-edit="' + esc(a.id) + '">Edit</button>' +
        '<button class="btn btn--sm" data-ann-toggle="' + esc(a.id) + '">' + (a.is_active ? 'Turn off' : 'Turn on') + '</button>' +
        '<button class="btn btn--sm btn--danger" data-ann-del="' + esc(a.id) + '">Delete</button></div></td></tr>';
    }).join('');
  }
  function loadAnns(){
    return sb.from('announcements').select('*').order('sort_order').order('created_at').then(function(r){
      var err = $('#annListErr');
      if(r.error){ err.textContent = 'Announcements are not available yet. Run phase8-announcements.sql in the Supabase SQL Editor. (' + r.error.message + ')'; err.hidden = false; return; }
      err.hidden = true; anns = r.data || []; renderAnns();
    });
  }
  function openAnnForm(a){
    var el = $('#annForm').elements; editingAnn = a || null;
    $('#annFormTitle').textContent = a ? 'Edit announcement' : 'New announcement';
    ['text_en','text_ar','link_url'].forEach(function(k){ el[k].value = a && a[k] ? a[k] : ''; });
    el.sort_order.value = a ? a.sort_order : (anns.length + 1);
    el.starts.value = a && a.starts_at ? a.starts_at.slice(0, 10) : ''; el.ends.value = a && a.ends_at ? a.ends_at.slice(0, 10) : '';
    el.is_active.checked = a ? !!a.is_active : true;
    $('#annErr').hidden = true; $('#annForm').hidden = false; $('#annForm').scrollIntoView({behavior:'smooth', block:'start'});
  }
  $('#newAnn').addEventListener('click', function(){ openAnnForm(null); });
  $('#annCancel').addEventListener('click', function(){ $('#annForm').hidden = true; editingAnn = null; });
  $('#annForm').addEventListener('submit', function(e){
    e.preventDefault();
    var el = e.target.elements, err = $('#annErr'), btn = $('#annSave');
    var fail = function(m){ err.textContent = m; err.hidden = false; };
    err.hidden = true;
    var en = el.text_en.value.trim(), ar = el.text_ar.value.trim(), link = el.link_url.value.trim();
    if(!en && !ar){ fail('Write the message in English or Arabic (ideally both).'); return; }
    if(link && !/^(https?:\/\/|\/|#)/i.test(link)){ fail('The link must start with https://, http://, / (a page of your site) or # (a section).'); return; }
    var starts = el.starts.value ? new Date(el.starts.value + 'T00:00:00') : null, ends = el.ends.value ? new Date(el.ends.value + 'T23:59:59') : null;
    if(starts && ends && ends < starts){ fail('The end date is before the start date.'); return; }
    var row = {text_en: en || null, text_ar: ar || null, link_url: link || null, sort_order: parseInt(el.sort_order.value, 10) || 0,
      is_active: el.is_active.checked, starts_at: starts ? starts.toISOString() : null, ends_at: ends ? ends.toISOString() : null};
    btn.disabled = true; btn.textContent = 'Saving…';
    var q = editingAnn ? sb.from('announcements').update(row).eq('id', editingAnn.id) : sb.from('announcements').insert(row);
    q.then(function(r){
      btn.disabled = false; btn.textContent = 'Save announcement';
      if(r.error){ fail('Could not save: ' + r.error.message); return; }
      $('#annForm').hidden = true; editingAnn = null;
      var ok = $('#annOk'); ok.hidden = false; setTimeout(function(){ ok.hidden = true; }, 2500); loadAnns();
    });
  });
  $('#annRows').addEventListener('click', function(e){
    var b, a;
    function byId(id){ return anns.filter(function(x){ return String(x.id) === String(id); })[0]; }
    if((b = e.target.closest('[data-ann-edit]'))){ openAnnForm(byId(b.getAttribute('data-ann-edit'))); }
    else if((b = e.target.closest('[data-ann-toggle]'))){
      a = byId(b.getAttribute('data-ann-toggle'));
      sb.from('announcements').update({is_active: !a.is_active}).eq('id', a.id).then(function(r){ if(r.error) alert('Could not update: ' + r.error.message); else loadAnns(); });
    } else if((b = e.target.closest('[data-ann-del]'))){
      if(!confirm('Delete this announcement?')) return;
      sb.from('announcements').delete().eq('id', b.getAttribute('data-ann-del')).then(function(r){ if(r.error) alert('Could not delete: ' + r.error.message); else loadAnns(); });
    }
  });

`;

/* ------------------------------------------------------------------ helpers */
// Insert `add` next to `anchor` (which must occur exactly once). `done` = text that proves it is already there.
function put(t, problems, name, anchor, add, where, done) {
  if (t.includes(done)) return t;
  if (count(t, anchor) !== 1) { problems.push(name + ': expected 1 match but found ' + count(t, anchor) + ' for: ' + anchor.trim().slice(0, 70)); return t; }
  if (where === 'replace') return t.replace(anchor, () => add);
  if (where === 'before') return t.replace(anchor, () => add + anchor);
  return t.replace(anchor, () => anchor + add);
}

function templateJob(t, problems) {
  const n = 'template';
  // markup
  t = put(t, problems, n, '<div class="announce" data-i18n="announce">Inspired by Nature. Perfected by Science</div>',
    '<div class="announce" id="announce" role="region" data-i18n-aria="ann_tag" aria-label="Latest">\n  <span class="announce__tag"><i class="announce__dot" aria-hidden="true"></i><span data-i18n="ann_tag">Latest</span></span>\n  <div class="announce__view" id="announceView"><div class="announce__static" data-i18n="announce">Inspired by Nature. Perfected by Science</div></div>\n</div>',
    'replace', 'id="announceView"');
  // label text, both languages
  t = put(t, problems, n, "announce:'Inspired by Nature. Perfected by Science',", " ann_tag:'Latest',", 'after', "ann_tag:'Latest'");
  t = put(t, problems, n, "announce:'مستوحاة من الطبيعة، مصقولة بالعلم',", " ann_tag:'الجديد',", 'after', "ann_tag:'الجديد'");
  // style block: added once, replaced on re-run
  const a = t.indexOf(CSS_START), b = t.indexOf(CSS_END);
  if (a >= 0 && b > a) t = t.slice(0, t.lastIndexOf('\n', a) + 1) + CSS_BLOCK + t.slice(b + CSS_END.length);
  else if (a >= 0 || b >= 0) problems.push(n + ': the ticker style block looks damaged (only one of its two marker lines was found)');
  else if (count(t, '</style>') !== 1) problems.push(n + ': expected 1 </style> but found ' + count(t, '</style>'));
  else t = t.replace('</style>', () => CSS_BLOCK + '\n</style>');
  // functions, re-render on language change, first load
  t = put(t, problems, n, '  function t(k){ return I18N[lang][k]; }', '\n' + FUNCS.replace(/\n$/, ''), 'after', FN_MARK);
  t = put(t, problems, n, 'runSearch(); renderPromos(); renderTrust(); renderReviews();', ' renderAnnounce();', 'after', 'renderReviews(); renderAnnounce();');
  t = put(t, problems, n, '  loadReviews();\n  resetChat();', '  loadAnnouncements();\n', 'before', 'loadAnnouncements();\n  loadReviews();');
  return t;
}

function adminJob(t, problems) {
  const n = 'admin';
  t = put(t, problems, n, '<button class="tab" role="tab" id="tabPromos" aria-selected="false">Promotions</button>', ADMIN_TAB, 'after', 'id="tabAnnouncements"');
  t = put(t, problems, n, '    <!-- WhatsApp opt-in list -->', ADMIN_PANEL, 'before', 'id="panelAnnouncements"');
  t = put(t, problems, n, "    $('#panelPromos').hidden = name !== 'promos';", ADMIN_TAB_SWITCH, 'after', "$('#tabAnnouncements').setAttribute");
  t = put(t, problems, n, "  $('#tabPromos').addEventListener('click', function(){ tab('promos'); loadPromos(); });", ADMIN_TAB_CLICK, 'after', "$('#tabAnnouncements').addEventListener");
  t = put(t, problems, n, '  /* ---------- WhatsApp opt-in list ---------- */', ADMIN_JS, 'before', '/* ---------- Announcements (ticker in the top bar) ---------- */');
  return t;
}

function swJob(t, problems) {
  const m = t.match(/const CACHE_VERSION = 'avara-v(\d+)';( \/\/ [^\n]*)?/);
  if (!m) { problems.push('sw.js: could not find the CACHE_VERSION line'); return t; }
  if ((m[2] || '').includes('announce')) return t;
  return t.replace(m[0], () => "const CACHE_VERSION = 'avara-v" + (Number(m[1]) + 1) + "'; // announce");
}

const jobs = [
  { label: 'template (tools/template.html)', required: true, file: first(['tools/template.html', 'template.html']), run: templateJob },
  { label: 'admin (admin.html)', required: true, file: first(['admin.html']), run: adminJob },
  { label: 'service worker (sw.js)', file: first(['sw.js']), run: swJob },
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
  const out = j.run(raw.replace(/\r\n/g, '\n'), problems);
  if (problems.length > before) continue;
  const text = crlf ? out.replace(/\n/g, '\r\n') : out;
  if (text === raw) { console.log(j.file + ': already up to date'); continue; }
  plan.push({ file: j.file, raw, text });
}

if (problems.length) {
  console.error('Nothing was changed. Please send me the file(s) named below and I will adjust the patch:\n');
  problems.forEach((x) => console.error(' - ' + x));
  process.exit(1);
}
for (const p of plan) {
  fs.writeFileSync(p.file + '.bak', p.raw);
  fs.writeFileSync(p.file, p.text);
  console.log(p.file + ': updated (backup saved as ' + p.file + '.bak)');
}
console.log(plan.length
  ? '\nDone. Next: run phase8-announcements.sql in Supabase (once), then  node tools/build-pages.js  and push.'
  : '\nNothing to do.');
