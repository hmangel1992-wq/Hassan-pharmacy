/* AVARA floating help button: chat + WhatsApp on every public page.
   Loaded with <script src="/assets/float-contact.js" defer></script>. No dependencies. */
(function(){
  'use strict';
  if(window.__avaraFloat) return;
  window.__avaraFloat = true;

  var d = document, de = d.documentElement, WA = '96176681395';
  var T = {
    en:{ help:'Help', open:'Open help menu', close:'Close help menu', chat:'Chat with our assistant', wa:'Message us on WhatsApp',
         msg:'Hello AVARA, I have a question.' },
    ar:{ help:'مساعدة', open:'افتح قائمة المساعدة', close:'أغلق قائمة المساعدة', chat:'تحدّث مع المساعد', wa:'راسلنا عبر واتساب',
         msg:'مرحباً AVARA، لدي سؤال.' }
  };
  function isAr(){ return String(de.getAttribute('lang') || '').toLowerCase().indexOf('ar') === 0; }
  function L(){ return T[isAr() ? 'ar' : 'en']; }

  var css =
    '.avfab{position:fixed;inset-inline-end:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:70;font-family:inherit}' +
    '.avfab *{box-sizing:border-box}' +
    '.avfab__main{display:flex;align-items:center;justify-content:center;gap:8px;height:54px;min-width:54px;padding:0 18px;border:0;border-radius:999px;cursor:pointer;' +
      'background:#1F5F6B;color:#fff;font:inherit;font-size:.95rem;font-weight:500;box-shadow:0 8px 22px rgba(31,95,107,.35);transition:background .25s ease,transform .25s ease}' +
    '.avfab__main:hover{background:#2C2C2C}' +
    '.avfab__main:focus-visible,.avfab__item:focus-visible{outline:2px solid #fff;outline-offset:-4px;box-shadow:0 0 0 3px #1F5F6B}' +
    '.avfab__main svg{width:22px;height:22px;flex:none;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
    '.avfab__menu{position:absolute;bottom:66px;inset-inline-end:0;display:grid;gap:8px;min-width:250px;opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease,visibility .2s}' +
    '.avfab.is-open .avfab__menu{opacity:1;visibility:visible;transform:none}' +
    '.avfab__item{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;border:1px solid #C6E5E0;border-radius:2px;background:#fff;color:#2C2C2C;' +
      'font:inherit;font-size:.95rem;text-align:start;text-decoration:none;cursor:pointer;box-shadow:0 8px 22px rgba(44,44,44,.14);transition:background .2s ease,border-color .2s ease}' +
    '.avfab__item:hover{background:#DFF4F1;border-color:#1F5F6B}' +
    '.avfab__item svg{width:20px;height:20px;flex:none;stroke:#1F5F6B;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}' +
    'body.cart-open .avfab{display:none}' +
    '@media (max-width:640px){.avfab__label{display:none}.avfab__main{padding:0;width:54px}}' +
    '@media (prefers-reduced-motion:reduce){.avfab__menu,.avfab__main{transition:none}}';

  var ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/></svg>';
  var ICON_PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var style = d.createElement('style'); style.textContent = css; d.head.appendChild(style);

  var root = d.createElement('div'); root.className = 'avfab';
  root.innerHTML =
    '<div class="avfab__menu" id="avfabMenu">' +
      '<button class="avfab__item" type="button" data-avfab="chat">' + ICON_CHAT + '<span data-t="chat"></span></button>' +
      '<a class="avfab__item" data-avfab="wa" target="_blank" rel="noopener">' + ICON_PHONE + '<span data-t="wa"></span></a>' +
    '</div>' +
    '<button class="avfab__main" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="avfabMenu">' +
      '<span class="avfab__ico">' + ICON_CHAT + '</span><span class="avfab__label" data-t="help"></span>' +
    '</button>';

  var main = root.querySelector('.avfab__main');
  var wa = root.querySelector('a[data-avfab="wa"]');

  function paint(){
    var s = L(), open = root.classList.contains('is-open');
    root.querySelectorAll('[data-t]').forEach(function(el){ el.textContent = s[el.getAttribute('data-t')]; });
    main.setAttribute('aria-label', open ? s.close : s.open);
    root.querySelector('.avfab__ico').innerHTML = open ? ICON_CLOSE : ICON_CHAT;
    wa.setAttribute('href', 'https://wa.me/' + WA + '?text=' + encodeURIComponent(s.msg));
  }
  function setOpen(v){
    root.classList.toggle('is-open', v);
    main.setAttribute('aria-expanded', String(v));
    paint();
  }
  function track(action){
    try{ if(window.plausible) window.plausible('Float Click', {props: {action: action}}); }catch(e){}
  }

  main.addEventListener('click', function(){ setOpen(!root.classList.contains('is-open')); });
  root.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-avfab]') : null; if(!b) return;
    var action = b.getAttribute('data-avfab');
    track(action);
    if(action === 'chat'){
      setOpen(false);
      // The chat box lives on the home page. If it is visible here, scroll to it; otherwise go to the home page chat.
      var c = d.getElementById('chat');
      if(c && c.offsetParent !== null){
        c.scrollIntoView({behavior: 'smooth', block: 'start'});
        setTimeout(function(){ var ta = d.getElementById('chatInput'); if(ta && ta.focus) ta.focus({preventScroll: true}); }, 600);
      } else {
        location.href = (isAr() ? '/ar/' : '/') + '#chat';
      }
    } else {
      setOpen(false);   // the link itself opens WhatsApp
    }
  });
  d.addEventListener('click', function(e){ if(root.classList.contains('is-open') && !root.contains(e.target)) setOpen(false); });
  d.addEventListener('keydown', function(e){ if(e.key === 'Escape' && root.classList.contains('is-open')){ setOpen(false); main.focus(); } });

  // Some pages (policies, tracking, review) switch language without reloading.
  try{ new MutationObserver(paint).observe(de, {attributes: true, attributeFilter: ['lang']}); }catch(e){}

  function start(){ d.body.appendChild(root); paint(); }
  if(d.body) start(); else d.addEventListener('DOMContentLoaded', start);
})();
