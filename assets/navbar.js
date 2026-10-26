/* ═══════════════════════════════════════════════════════════
   Плавающий док-навбар — общий для index.html и case.html.
   Контакты берутся из content/contacts.json (правится в админке).
   Ничего не рендерится, пока не загрузится страница.
   Открывается вверх: перед этим док на мгновение сжимается.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var HOME = /case\.html/i.test(location.pathname) ? 'index.html' : '';

  var LANG = document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'cs';
  try { LANG = localStorage.getItem('lang') || LANG; } catch (e) {}

  var L = {
    en: { home:'Home', works:'Works', about:'About', experience:'Experience', playground:'Playground', opencv:'Open CV', soon:'Soon',
          cv:'CV', tg:'Telegram', wa:'WhatsApp', mail:'Copy email',
          copied:'Copied', more:'Menu', lang:'Language' },
    cs: { home:'Domů', works:'Projekty', about:'O mně', experience:'Zkušenosti', playground:'Playground', opencv:'Otevřít CV', soon:'Brzy',
          cv:'CV', tg:'Telegram', wa:'WhatsApp', mail:'Kopírovat e-mail',
          copied:'Zkopírováno', more:'Menu', lang:'Jazyk' }
  };

  var ICON = {
    cv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
    tg:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-2.1 2.04c-.23.23-.42.42-.72.31z"/></svg>',
    wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8c2.17 0 4.2.85 5.74 2.38a8.06 8.06 0 0 1 2.38 5.73c0 4.47-3.64 8.11-8.12 8.11a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.12.82.83-3.04-.19-.31a8.05 8.05 0 0 1-1.24-4.31c0-4.47 3.64-8.11 8.15-8.11zm4.52 10.13c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.15-1.18-.06-.11-.23-.17-.48-.29z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build(contacts) {
    var t = L[LANG] || L.en;
    document.body.classList.add('has-dock');

    var wrap   = el('div', 'dock-wrap');
    var dock   = el('nav', 'dock');
    var menu   = el('div', 'dock-menu');
    var menuIn = el('div', 'dock-menu-in');
    var bar    = el('div', 'dock-bar');
    dock.setAttribute('aria-label', 'Main');

    // ── меню: разделы, контакты, язык. Открывается вверх от полоски с логотипом ──
    var rows = [];
    [['works', t.works], ['about', t.about], ['experience', t.experience], ['playground', t.playground]].forEach(function (p) {
      var a = el('a', 'dock-row dock-nav', '<span data-nav="' + p[0] + '">' + p[1] + '</span>');
      a.href = HOME + '#' + p[0];
      a.addEventListener('click', function () { setOpen(false); });
      rows.push(a);
    });
    // Open CV: файл берётся из админки (Контакты в навбаре → CV) и открывается
    // в новой вкладке. Пока файла нет, строка серая с пометкой «Soon».
    // чешская версия сайта открывает чешское CV, если оно загружено
    function cvHref() { return (LANG === 'cs' && contacts.cv_cs) || contacts.cv; }
    var cv = el('a', 'dock-row dock-nav' + (contacts.cv ? '' : ' is-off'),
      '<span data-nav="opencv">' + t.opencv + '</span>' +
      (contacts.cv ? '<span class="row-note">' + ICON.ext + '</span>'
                   : '<span class="row-note" data-tip="soon">' + t.soon + '</span>'));
    if (contacts.cv) {
      cv.href = cvHref(); cv.target = '_blank'; cv.rel = 'noopener';
      cv.addEventListener('click', function () { setOpen(false); });
    } else {
      cv.setAttribute('aria-disabled', 'true');
    }
    rows.push(cv);
    var contactRows = makeContacts(contacts, t);
    if (contactRows.length) rows.push(el('div', 'dock-div'));
    contactRows.forEach(function (r) { rows.push(r); });

    var langRow = el('div', 'dock-row dock-langrow',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg><span data-tip="lang">' + t.lang + '</span>');
    var lang = el('span', 'dock-lang');
    ['en', 'cs'].forEach(function (code) {
      var b = el('button', code === LANG ? 'active' : '', code === 'cs' ? 'CZ' : 'EN');
      b.id = code === 'cs' ? 'btnCS' : 'btnEN';
      b.type = 'button';
      b.addEventListener('click', function () {
        LANG = code;
        if (typeof window.setLang === 'function') window.setLang(code);
        relabel();
      });
      lang.appendChild(b);
    });
    langRow.appendChild(lang);
    rows.push(langRow);

    // строки проявляются лесенкой снизу вверх, от полоски
    rows.forEach(function (r, i) { r.style.setProperty('--i', rows.length - 1 - i); menuIn.appendChild(r); });
    menu.appendChild(menuIn);

    // ── полоска: логотип и бургер ──
    var logo = el('a', 'dock-logo', 'SHUSTER');
    logo.href = HOME || '#';
    logo.setAttribute('aria-label', 'Stepan Shuster — home');
    // буквы разными шрифтами, меняются по скроллу (assets/logo.js)
    if (window.ShusterLogo) window.ShusterLogo.mount(logo);
    bar.appendChild(logo);

    var more = el('button', 'dock-more', '<span class="sp" aria-hidden="true"></span>');
    more.type = 'button';
    more.setAttribute('aria-label', t.more);
    more.setAttribute('aria-expanded', 'false');
    bar.appendChild(more);

    dock.appendChild(menu);
    dock.appendChild(bar);
    wrap.appendChild(dock);
    document.body.appendChild(wrap);

    // ── размеры ──
    // Ширину и высоту считаем заранее и запоминаем: во время открытия браузер
    // уже ничего не пересчитывает, поэтому анимация идёт ровно.
    var closedW = 0, openW = 0, openH = 0, isOpen = false, squishT = null, openedAt = 0, scrollAt = 0;
    var SQUISH = 150;   // сколько длится сжатие перед открытием, мс

    function apply() {
      dock.style.width  = (isOpen ? openW : closedW) + 'px';
      menu.style.height = (isOpen ? openH : 0) + 'px';
    }
    function measure() {
      dock.classList.add('no-anim');
      menu.style.display = 'none';
      dock.style.width = 'max-content';
      closedW = Math.ceil(dock.offsetWidth);
      menu.style.display = '';
      menuIn.style.width = 'max-content';
      menuIn.style.maxHeight = 'none';
      var side = window.innerWidth <= 600 ? 20 : 24;
      // +1: естественная ширина дробная, без запаса адрес почты обрезается многоточием
      openW = Math.min(Math.max(closedW, Math.ceil(menuIn.getBoundingClientRect().width) + 3, 248), window.innerWidth - side);
      menuIn.style.width = (openW - 2) + 'px';
      // на низком экране меню не выше окна, внутри появляется прокрутка
      var room = window.innerHeight - bar.offsetHeight - (window.innerHeight <= 460 ? 10 : window.innerWidth <= 600 ? 16 : 28) - 14;
      menuIn.style.maxHeight = Math.max(120, room) + 'px';
      openH = Math.ceil(menuIn.offsetHeight);
      apply();
      void dock.offsetWidth;
      dock.classList.remove('no-anim');
    }

    // ── открытие: док сначала чуть сжимается, потом раскрывается вверх ──
    function setOpen(v) {
      if (v === isOpen) return;
      // пока меню раскрывается, тяжёлые фоны (градиент, символы) ставят кадры на паузу и не спорят с ним за видеокарту
      window.UIBUSY = performance.now() + 800;
      // перед открытием пересчитываем размеры: шрифт мог догрузиться позже первой отрисовки
      if (v) measure();
      isOpen = v;
      clearTimeout(squishT);
      more.classList.toggle('open', v);
      more.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) {
        scrollAt = window.pageYOffset || 0; openedAt = Date.now();
        dock.classList.add('squish');
        squishT = setTimeout(function () {
          dock.classList.remove('squish');
          dock.classList.add('open');
          apply();
        }, SQUISH);
      } else {
        dock.classList.remove('squish');
        dock.classList.remove('open');
        apply();
      }
    }

    // Наведение на бургер раскрывает. Уход курсора ничего не закрывает.
    var noHover = function () { return window.matchMedia('(hover:none)').matches; };
    if (!noHover()) more.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setOpen(true); });
    // Клик по бургеру — переключатель. Но если док только что открылся
    // от наведения, клик его не захлопывает: указатель заходит на кнопку
    // и сразу жмёт, это одно действие, а не два.
    more.addEventListener('click', function (e) {
      e.preventDefault();
      if (isOpen && Date.now() - openedAt < 600) return;
      setOpen(!isOpen);
    });

    // Закрываем: скролл страницы, клик мимо дока, Esc
    window.addEventListener('scroll', function () {
      if (isOpen && Math.abs((window.pageYOffset || 0) - scrollAt) > 24) setOpen(false);
    }, { passive: true });
    document.addEventListener('click', function (e) {
      if (isOpen && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (isOpen && e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', measure);

    measure();
    window._dockMeasure = measure;
    // свои шрифты приходят позже первой отрисовки, ширина строк после этого другая
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // перерисовка подписей при смене языка
    function relabel() {
      var t = L[LANG] || L.en;
      wrap.querySelectorAll('[data-nav]').forEach(function (n) { n.textContent = t[n.dataset.nav]; });
      wrap.querySelectorAll('[data-tip]').forEach(function (n) { n.textContent = t[n.dataset.tip] || n.textContent; });
      wrap.querySelectorAll('.dock-lang button').forEach(function (b) {
        b.classList.toggle('active', (b.id === 'btnCS' ? 'cs' : 'en') === LANG);
      });
      more.setAttribute('aria-label', t.more);
      if (contacts.cv) cv.href = cvHref();
      measure();
    }
    window._dockRelabel = relabel;

    // появление
    var loader = document.getElementById('loaderBg');
    if (loader) {
      var iv = setInterval(function () {
        if (loader.style.display === 'none' || document.body.classList.contains('loaded')) {
          clearInterval(iv);
          document.body.classList.add('nav-ready');
        }
      }, 200);
      setTimeout(function () { clearInterval(iv); document.body.classList.add('nav-ready'); }, 7000);
    } else {
      setTimeout(function () { document.body.classList.add('nav-ready'); }, 250);
    }
  }

  /* Строки контактов: иконка, подпись, у почты справа сам адрес */
  function makeContacts(c, t) {
    var out = [];

    function row(key, href, iconKey, label, isCopy) {
      var r = el(isCopy ? 'button' : 'a', 'dock-row',
        ICON[iconKey] + '<span data-tip="' + key + '">' + label + '</span>' +
        (isCopy ? '<span class="row-note">' + c.email + '</span>' : ''));
      if (isCopy) {
        r.type = 'button';
        r.addEventListener('click', function (e) { e.preventDefault(); copy(c.email, r); });
      } else {
        r.href = href;
        if (/^https?:/.test(href)) { r.target = '_blank'; r.rel = 'noopener'; }
      }
      out.push(r);
    }

    if (c.telegram) row('tg',   c.telegram, 'tg',   t.tg);
    if (c.whatsapp) row('wa',   c.whatsapp, 'wa',   t.wa);
    if (c.email)    row('mail', '',         'mail', t.mail, true);
    return out;
  }

  function copy(text, rowNode) {
    function done() {
      var t = L[LANG] || L.en;
      rowNode.classList.add('copied');
      var note = rowNode.querySelector('.row-note');
      var prev = note ? note.textContent : '';
      if (note) note.textContent = t.copied;
      setTimeout(function () {
        rowNode.classList.remove('copied');
        if (note) note.textContent = prev;
      }, 1800);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  // ── старт ──
  function boot() {
    fetch('content/contacts.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (c) { build(c || {}); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
