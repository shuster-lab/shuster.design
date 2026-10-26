/* ═══════════════════════════════════════════════════════════
   Сетка проектов на главной, рендерится из CMS.
   Источники: content/home.json (порядок) + content/cases/*.json

   Две колонки вертикальных карточек, правая колонка ниже.
   Картинка внутри карточки слегка едет на скролле (параллакс).
   На ховере картинка размывается, в центре открывается окошко
   с видео скролла сайта (preview_video), у курсора подпись.
   Под карточкой: название и год, ниже слоган. В углу ниша.

   Подключение в index.html:
     1) <div class="projects-grid"></div>   ← оставить пустым
     2) <script src="assets/projects-grid.js"></script> перед </body>
   ═══════════════════════════════════════════════════════════ */
(function () {
  var grid = document.querySelector('.projects-grid');
  if (!grid) return;

  var root = document.documentElement;
  var LANG = root.getAttribute('data-lang') || 'cs';
  try { LANG = localStorage.getItem('lang') || LANG; } catch (e) {}
  // телефон или экономия трафика: лёгкие картинки
  var LITE = matchMedia('(max-width:768px)').matches || !!(navigator.connection && navigator.connection.saveData);
  var HOVER = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var CALM = matchMedia('(prefers-reduced-motion:reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tr(d, k) { return (LANG === 'cs' && d[k + '_cs']) ? d[k + '_cs'] : (d[k] || d[k + '_cs'] || ''); }

  var items = [];

  fetch('content/home.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (home) {
      var list = (home.featured || []).filter(function (f) { return f && f.case; });
      return Promise.all(list.map(function (f) {
        return fetch('content/cases/' + f.case + '.json', { cache: 'no-cache' })   // свежие данные кейсов, без старого кэша
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { return d ? { slug: f.case, d: d } : null; })
          .catch(function () { return null; });
      }));
    })
    .then(function (res) {
      items = res.filter(Boolean);
      if (!items.length) return;
      render();

      // счётчик у заголовка секции
      var wn = document.querySelector('.wk-n');
      if (wn) wn.textContent = ('0' + items.length).slice(-2);
      if (window._syncScrollTarget) window._syncScrollTarget();

      // язык переключается сменой data-lang на <html>: перерисовываем подписи
      new MutationObserver(function () {
        var l = root.getAttribute('data-lang') || 'cs';
        if (l !== LANG) { LANG = l; render(); }
      }).observe(root, { attributes: true, attributeFilter: ['data-lang'] });
    })
    .catch(function (e) { console.warn('[projects-grid]', e); });

  function card(it) {
    var d = it.d, ext = d.external || '';
    var href = ext || ('case.html?slug=' + encodeURIComponent(it.slug));
    var big = d.thumb || d.cover, small = d.thumb_sm || d.cover_sm;
    var src = LITE && small ? small : big;
    var srcset = small && big && small !== big ? ' srcset="' + esc(small) + ' 960w, ' + esc(big) + ' 1920w" sizes="(max-width:768px) 100vw, 50vw"' : '';
    var niche = tr(d, 'niche'), claim = tr(d, 'claim');
    var label = ext ? (LANG === 'cs' ? 'Otevřít Behance' : 'Open on Behance') : (LANG === 'cs' ? 'Zobrazit' : 'View');
    return '<a class="pj' + (ext ? ' pj--ext' : '') + '" href="' + esc(href) + '"' +
      (ext ? ' target="_blank" rel="noopener"' : '') + '>' +
      '<div class="pj-img">' +
        (d.thumb_video
          // обложка-видео: мокап, на экране которого играет хиро сайта; до загрузки виден постер
          ? '<video class="pj-media pj-vid" muted loop playsinline preload="none" poster="' + esc(src) + '" data-src="' + esc(LITE && d.thumb_video_m ? d.thumb_video_m : d.thumb_video) + '" aria-label="' + esc(d.title) + '"></video>'
          : '<img class="pj-media" src="' + esc(src) + '"' + srcset + ' alt="' + esc(d.title) + '" loading="lazy" decoding="async">') +
        (HOVER && d.preview_video ? '<div class="pj-pv' + (d.preview_tall ? ' pj-pv--tall' : '') + '" aria-hidden="true"><video muted loop playsinline preload="none" data-src="' + esc(d.preview_video) + '"></video></div>' : '') +
        (niche ? '<span class="pj-tag">' + esc(niche) + '</span>' : '') +
        (HOVER ? '<span class="pj-lb" aria-hidden="true" title="' + esc(label) + '"><span class="pj-lb-t"><span class="pj-lb-b"><i></i></span></span></span>' : '') +
      '</div>' +
      '<div class="pj-cap">' +
        '<h3 class="pj-cap-name">' + esc(d.title) + '</h3>' +
        (d.year ? '<span class="pj-cap-year">' + esc(d.year) + '</span>' : '') +
        (claim ? '<p class="pj-claim">' + esc(claim) + '</p>' : '') +
      '</div>' +
    '</a>';
  }

  function render() {
    cur = null;
    grid.innerHTML = items.map(card).join('');
    initCards();
  }

  /* ── параллакс: картинка внутри карточки едет медленнее страницы ── */
  var live = [], ticking = false;
  function para() {
    ticking = false;
    var vh = innerHeight;
    for (var i = 0; i < live.length; i++) {
      var box = live[i].box, r = box.getBoundingClientRect();
      // -1 когда карточка входит снизу, +1 когда уходит наверх; картинка с запасом 6% по краям, сдвиг до 4.5%
      var p = (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2);
      p = Math.max(-1, Math.min(1, p));
      live[i].img.style.transform = 'translate3d(0,' + (p * 4.5).toFixed(2) + '%,0)';
    }
  }
  function onScroll() { if (!ticking && live.length) { ticking = true; requestAnimationFrame(para); } }
  if (!CALM) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); }

  function initCards() {
    var cards = grid.querySelectorAll('.pj');
    live = [];

    var obs = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });

    var vobs = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.src) v.src = v.getAttribute('data-src'); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    grid.querySelectorAll('video.pj-vid').forEach(function (v) { if (!CALM) vobs.observe(v); });

    cards.forEach(function (c) {
      obs.observe(c);
      var box = c.querySelector('.pj-img'), img = c.querySelector('.pj-media');
      if (!CALM) live.push({ box: box, img: img });
    });
    para();
  }

  /* ── ховер: видео и подпись у курсора ──
     Состояние ведём сами по координатам мыши, а не только по mouseenter:
     если карточка подъехала под неподвижный курсор во время скролла,
     ховер включается сразу и подпись встаёт к курсору, а не в угол. */
  var mx = -1, my = -1, cur = null, lx = 0, ly = 0, raf = 0;
  function at(x, y) {
    var el = x < 0 ? null : document.elementFromPoint(x, y);
    var box = el && el.closest ? el.closest('.pj-img') : null;
    return box && grid.contains(box) ? box : null;
  }
  function follow() {
    raf = 0; if (!cur) return;
    var lb = cur.querySelector('.pj-lb'); if (!lb) return;
    var r = cur.getBoundingClientRect(), tx = mx - r.left + 16, ty = my - r.top + 16;
    var dx = (tx - lx) * .28, dy = (ty - ly) * .28;
    lx += dx; ly += dy;                                      // мягко догоняет курсор
    lb.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
    // наклон по скорости: бокс «тянется» за курсором и выпрямляется, когда тот остановился
    var t = lb.firstElementChild; if (t) t.style.transform = 'rotate(' + Math.max(-16, Math.min(16, dx * 1.1)).toFixed(1) + 'deg)';
    if (Math.abs(tx - lx) + Math.abs(ty - ly) > .3) raf = requestAnimationFrame(follow);
    else if (t) t.style.transform = '';
  }
  function enter(box) {
    var r = box.getBoundingClientRect();
    lx = mx - r.left + 16; ly = my - r.top + 16;            // подпись сразу у курсора, без прыжка из угла
    var lb = box.querySelector('.pj-lb');
    if (lb) lb.style.transform = 'translate3d(' + lx + 'px,' + ly + 'px,0)';
    box.classList.add('is-on');
    var v = box.querySelector('.pj-pv video');
    if (v) {
      if (!v.src) v.src = v.getAttribute('data-src');
      try { v.currentTime = 0; } catch (e) {}
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
    }
  }
  function leave(box) {
    box.classList.remove('is-on');
    var v = box.querySelector('.pj-pv video'); if (v) v.pause();
  }
  function sync() {
    var box = at(mx, my);
    if (box !== cur) { if (cur) leave(cur); cur = box; if (cur) enter(cur); }
    else if (cur && !raf) raf = requestAnimationFrame(follow);
  }
  if (HOVER) {
    addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; sync(); }, { passive: true });
    addEventListener('scroll', function () { if (mx >= 0) sync(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { mx = my = -1; sync(); });
  }
})();
