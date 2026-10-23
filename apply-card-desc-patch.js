#!/usr/bin/env node
/*
 * AVARA — product card descriptions with "Show more"
 *   Each product card shows its description on 2 lines. When the text is longer, a "Show more" link
 *   (Arabic: "عرض المزيد") appears under it; tapping it opens the full text, and "Show less" closes it.
 *   Short descriptions show in full with no link. Cards line up evenly in the grid.
 *   The product window (tap a product) still shows the full description.
 *
 * Run from the project root:   node apply-card-desc-patch.js
 * Then:                        node tools/build-pages.js    and push.
 * Safe to run twice. If a line it expects is missing, it changes nothing and tells you which one.
 */
const fs = require('fs');
const file = ['tools/template.html', 'template.html'].find((f) => fs.existsSync(f));
if (!file) { console.error('tools/template.html not found: run this from the project root'); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let t = raw.replace(/\r\n/g, '\n');
if (t.includes('data-more')) { console.log(file + ': already up to date'); process.exit(0); }

const edits = [];
const edit = (find, replace) => edits.push([find, replace]);

edit('  .card__desc{ font-size: .92rem; color: var(--ink-soft); line-height: 1.5; flex: 1; margin-bottom: 8px; }',
`  .card__desc{ font-size: .92rem; color: var(--ink-soft); line-height: 1.5; flex: 1; margin-bottom: 8px;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
  .card__desc.has-more{ flex: none; margin-bottom: 2px; }
  .card__desc.is-open{ display: block; -webkit-line-clamp: unset; line-clamp: unset; overflow: visible; }
  .card__more{ align-self: flex-start; margin-bottom: auto; padding: 2px 0 10px; font-size: .86rem; font-weight: 500; color: var(--teal-deep);
    border-bottom: 1px solid transparent; }
  .card__more:hover{ text-decoration: underline; text-underline-offset: 3px; }`);

edit("langBtn:'العربية'", "show_more:'Show more', show_less:'Show less',\n      langBtn:'العربية'");
edit("langBtn:'English'", "show_more:'عرض المزيد', show_less:'عرض أقل',\n      langBtn:'English'");

edit('  function wireGalleries(container){',
`  // Descriptions are clamped to 2 lines by CSS; a "Show more" link is added only where the text is really cut off.
  function wireDescs(root){
    (root || document).querySelectorAll('.card__desc').forEach(function(d){
      var nx = d.nextElementSibling, more = (nx && nx.hasAttribute('data-more')) ? nx : null;
      var over = d.classList.contains('is-open') || d.scrollHeight > d.clientHeight + 1;
      if(over && !more){
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'card__more'; b.setAttribute('data-more', '');
        b.setAttribute('aria-expanded', 'false'); b.textContent = t('show_more');
        d.parentNode.insertBefore(b, d.nextSibling); d.classList.add('has-more');
      } else if(!over && more){
        more.parentNode.removeChild(more); d.classList.remove('has-more');
      }
    });
  }
  var descTimer;
  window.addEventListener('resize', function(){ clearTimeout(descTimer); descTimer = setTimeout(function(){ wireDescs(document); }, 150); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ wireDescs(document); });
  function wireGalleries(container){`);

edit('    wireGalleries(grid);', '    wireGalleries(grid); wireDescs(grid);');

edit("    if((el = e.target.closest('[data-promo-add]'))){",
`    if((el = e.target.closest('[data-more]'))){
      var dd = el.previousElementSibling, isOpen = dd.classList.toggle('is-open');
      el.textContent = t(isOpen ? 'show_less' : 'show_more'); el.setAttribute('aria-expanded', String(isOpen));
      return;
    }
    if((el = e.target.closest('[data-promo-add]'))){`);

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
console.log(file + ': product descriptions now collapse with Show more (backup saved as ' + file + '.bak)');
console.log('\nNext: node tools/build-pages.js   then commit and push.');
