/* ═══ PLAYGROUND ═══
   Свои приложения карточками, как в App Store. Данные в content/playground.json
   (правятся в админке: Главная страница → Playground).
   Кнопка системы посетителя подсвечена. Пока ссылки на сборку нет, кнопка серая с пометкой Soon.
   Клик по карточке (или «Read more») открывает лист снизу с подробностями.
   Закрывается крестиком, кликом по подложке, Esc или свайпом вниз. */
(function () {
  var sec = document.getElementById('playground'), box = document.getElementById('pgGrid');
  if (!sec || !box) return;

  var L = {
    en: { more:'Read more', soon:'Soon', close:'Close', version:'Version', size:'Size', platforms:'Platforms', stack:'Built with',
          features:'What it does', get:'Download for', next:'More coming soon', nextText:'Small tools I build for myself, shared once they are good enough.' },
    cs: { more:'Více', soon:'Brzy', close:'Zavřít', version:'Verze', size:'Velikost', platforms:'Platformy', stack:'Postaveno na',
          features:'Co umí', get:'Stáhnout pro', next:'Další brzy', nextText:'Malé nástroje, které si dělám pro sebe. Sdílím je, až jsou dost dobré.' }
  };
  var OS = {
    mac: { name:'macOS', ext:'.dmg', svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 12.8c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.06 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.27-.87-2.29-3.51zM14.2 6.33c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z"/></svg>' },
    win: { name:'Windows', ext:'.exe', svg:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5 10.5 4.4v7.1H3zM11.5 4.3 21 3v8.5h-9.5zM3 12.5h7.5v7.1L3 18.5zM11.5 12.5H21V21l-9.5-1.3z"/></svg>' }
  };
  // система посетителя: её кнопка становится главной
  var ua = navigator.userAgent || '', mobile = /iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var MINE = mobile ? '' : /Mac/i.test(navigator.platform || ua) ? 'mac' : /Win/i.test(navigator.platform || ua) ? 'win' : '';

  function lang(){ return document.documentElement.getAttribute('data-lang') === 'cs' ? 'cs' : 'en'; }
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function tr(o, k){ var v = lang() === 'cs' ? o[k + '_cs'] : ''; return (v && String(v).trim()) ? v : (o[k] || ''); }
  // текст на двух языках для карточек: язык меняется общим переключателем сайта
  function two(tag, cls, en, cs){ en = esc(en); cs = esc(cs) || en; return en ? '<' + tag + ' class="' + cls + '" data-en="' + en + '" data-cs="' + cs + '">' + (lang() === 'cs' ? cs : en) + '</' + tag + '>' : ''; }
  function word(k){ return '<span data-en="' + esc(L.en[k]) + '" data-cs="' + esc(L.cs[k]) + '">' + esc(L[lang()][k]) + '</span>'; }

  // кнопки скачивания: только те системы, под которые приложение есть
  function getButtons(app, big){
    return ['mac', 'win'].filter(function(k){ return k in app && (k === 'mac' ? /mac/i.test(app.platforms) : /win/i.test(app.platforms)); }).map(function(k){
      var url = app[k], o = OS[k], main = k === MINE;
      // на карточке коротко: значок системы и формат, в окне полностью «Download for macOS .dmg»
      var inner = o.svg + (big ? '<span class="pg-get-os">' + word('get') + ' ' + o.name + '</span>' : '')
        + (url ? '<em>' + o.ext + '</em>' : '<em class="pg-soon">' + word('soon') + '</em>');
      return url
        ? '<a class="pg-get' + (main ? ' is-main' : '') + '" href="' + esc(url) + '" download title="' + o.name + '" aria-label="' + o.name + ' ' + o.ext + '">' + inner + '</a>'
        : '<span class="pg-get is-off' + (main ? ' is-main' : '') + '" aria-disabled="true" title="' + o.name + '">' + inner + '</span>';
    }).join('');
  }

  var APPS = [];
  fetch('content/playground.json').then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    APPS = d && d.apps ? d.apps.filter(function(a){ return a && a.name; }) : [];
    if (!APPS.length) { sec.style.display = 'none'; return; }
    box.innerHTML = APPS.map(function(a, i){
      return '<div class="pg-row reveal" style="transition-delay:' + (i * .07).toFixed(2) + 's"><article class="pg-card" data-i="' + i + '">'
        + '<div class="pg-top"><img class="pg-icon" src="' + esc(a.icon) + '" alt="" width="72" height="72" loading="lazy">'
        +   '<div class="pg-id"><h3 class="pg-name">' + esc(a.name) + '</h3>' + two('div', 'pg-sub', a.subtitle, a.subtitle_cs) + '</div></div>'
        + two('p', 'pg-desc', a.desc, a.desc_cs)
        + '<div class="pg-foot"><button class="pg-more" type="button" data-i="' + i + '">' + word('more') + '</button>'
        +   '<div class="pg-gets">' + getButtons(a) + '</div></div>'
        + '</article></div>';
    }).join('')
      + '<div class="pg-row reveal" style="transition-delay:' + (APPS.length * .07).toFixed(2) + 's"><article class="pg-card pg-card--next">'
      + '<div class="pg-top"><span class="pg-icon pg-icon--next" aria-hidden="true"><i></i><i></i><i></i></span>'
      + '<div class="pg-id"><h3 class="pg-name">' + word('next') + '</h3></div></div>'
      + '<p class="pg-desc">' + word('nextText') + '</p></article></div>';
    if (window.obs) box.querySelectorAll('.reveal').forEach(function(el){ obs.observe(el); });
    else box.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); });
    if (window._syncScrollTarget) window._syncScrollTarget();
    shrink();
  }).catch(function(){ sec.style.display = 'none'; });

  // ── десктоп: карточка въезжает по центру и по скроллу сужается и уезжает вправо (наклон только на ховере).
  //    Каждая по своему положению, поэтому по очереди. Значение догоняет скролл плавно ──
  var wide = matchMedia('(min-width:1025px)'), still = matchMedia('(prefers-reduced-motion:reduce)').matches, sraf = 0;
  function shrink() {
    var rows = [].slice.call(box.querySelectorAll('.pg-row'));
    if (!rows.length) return;
    var cur = rows.map(function () { return -1; }), cards = rows.map(function (r) { return r.firstElementChild; });
    function reset() { rows.forEach(function (r, i) { cards[i].style.width = ''; cards[i].style.marginLeft = ''; cur[i] = -1; }); }
    function upd() {
      sraf = 0;
      if (!wide.matches) { reset(); return; }
      var vh = innerHeight, sr = sec.getBoundingClientRect();
      if (sr.bottom < -200 || sr.top > vh + 200) return;           // секция далеко: ничего не считаем
      var W = rows[0].clientWidth, pgw = Math.min(620, innerWidth * .44), w0 = Math.min(1000, W * .68), more = false;
      var tops = rows.map(function (r) { return r.getBoundingClientRect().top; });   // сначала читаем, потом пишем
      rows.forEach(function (r, i) {
        var t = still ? 1 : Math.max(0, Math.min(1, (vh * .74 - tops[i]) / (vh * .48)));
        t = t * t * (3 - 2 * t);
        var k = cur[i] < 0 || still ? t : cur[i] + (t - cur[i]) * .14;      // мягко догоняет скролл
        if (Math.abs(t - k) < .0008) k = t; else more = true;
        if (k === cur[i]) return;
        cur[i] = k;
        var w = w0 + (pgw - w0) * k, l = (W - w0) / 2 + ((W - pgw) - (W - w0) / 2) * k;
        cards[i].style.width = w.toFixed(1) + 'px';
        cards[i].style.marginLeft = l.toFixed(1) + 'px';
      });
      if (more) go();
    }
    function go() { if (!sraf) sraf = requestAnimationFrame(upd); }
    addEventListener('scroll', go, { passive: true });
    addEventListener('resize', go);
    upd();
  }

  // ── окно «Read more» ──
  var modal = document.createElement('div'), back = null;
  modal.className = 'pg-modal';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'pgTitle');
  modal.innerHTML = '<div class="pg-sheet"><div class="pg-grab" aria-hidden="true"></div><button class="pg-x" type="button"></button><div class="pg-sheet-in"></div></div>';
  document.body.appendChild(modal);
  var sheet = modal.querySelector('.pg-sheet'), body = modal.querySelector('.pg-sheet-in'), x = modal.querySelector('.pg-x');

  function cell(k, v){ return v ? '<div class="pg-fact"><div class="pg-fact-k">' + esc(L[lang()][k]) + '</div><div class="pg-fact-v">' + esc(v) + '</div></div>' : ''; }
  function open(i){
    var a = APPS[i]; if (!a) return;
    var feats = (a.features || []).map(function(f){ return tr(f, 'text'); }).filter(Boolean);
    x.setAttribute('aria-label', L[lang()].close);
    body.innerHTML = '<div class="pg-head"><img class="pg-icon pg-icon--big" src="' + esc(a.icon) + '" alt="">'
      +   '<div class="pg-id"><h3 class="pg-name" id="pgTitle">' + esc(a.name) + '</h3><div class="pg-sub">' + esc(tr(a, 'subtitle')) + '</div></div></div>'
      + '<div class="pg-gets pg-gets--big">' + getButtons(a, true) + '</div>'
      + '<div class="pg-facts">' + cell('version', a.version) + cell('size', a.size) + cell('platforms', a.platforms) + cell('stack', a.stack) + '</div>'
      + (tr(a, 'about') ? '<p class="pg-about">' + esc(tr(a, 'about')) + '</p>' : '')
      + (feats.length ? '<div class="pg-feat-k">' + esc(L[lang()].features) + '</div><ul class="pg-feats">' + feats.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '')
      + (tr(a, 'note') ? '<p class="pg-note">' + esc(tr(a, 'note')) + '</p>' : '');
    back = document.activeElement;
    sheet.scrollTop = 0;
    document.documentElement.classList.add('pg-lock');
    modal.classList.add('on');
    setTimeout(function(){ x.focus({ preventScroll:true }); }, 30);
  }
  function close(){
    if (!modal.classList.contains('on')) return;
    modal.classList.remove('on'); sheet.classList.remove('drag'); sheet.style.transform = '';
    document.documentElement.classList.remove('pg-lock');
    if (back && back.focus) back.focus({ preventScroll:true });
  }
  // кликается вся карточка; ссылки на скачивание работают сами по себе
  box.addEventListener('click', function(e){
    if (e.target.closest('a.pg-get')) return;
    var c = e.target.closest('.pg-card[data-i]'); if (c) open(+c.dataset.i);
  });
  // свайп вниз закрывает лист (за ручку или когда лист прокручен к началу)
  var sy = null, dy = 0, st = 0;
  sheet.addEventListener('touchstart', function(e){
    if (sheet.scrollTop > 0 && !e.target.closest('.pg-grab')) { sy = null; return; }
    sy = e.touches[0].clientY; dy = 0; st = performance.now();
  }, { passive: true });
  sheet.addEventListener('touchmove', function(e){
    if (sy == null) return;
    dy = Math.max(0, e.touches[0].clientY - sy);
    if (dy > 4) { sheet.classList.add('drag'); sheet.style.transform = 'translateY(' + dy + 'px)'; if (e.cancelable) e.preventDefault(); }
  }, { passive: false });
  sheet.addEventListener('touchend', function(){
    if (sy == null) return; sy = null;
    sheet.classList.remove('drag');
    var v = dy / Math.max(1, performance.now() - st);
    if (dy > 110 || (dy > 30 && v > .6)) close(); else sheet.style.transform = '';
  });
  // пока лист открыт, страница под ним не прокручивается (без overflow:hidden, чтобы не дёргать раскладку)
  modal.addEventListener('touchmove', function(e){
    if ((!sheet.contains(e.target) || sheet.scrollHeight <= sheet.clientHeight + 1) && e.cancelable) e.preventDefault();
  }, { passive: false });
  x.addEventListener('click', close);
  modal.addEventListener('click', function(e){ if (e.target === modal) close(); });
  document.addEventListener('keydown', function(e){
    if (!modal.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    // фокус не уходит из окна
    if (e.key === 'Tab') {
      var f = modal.querySelectorAll('button,a[href]'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
