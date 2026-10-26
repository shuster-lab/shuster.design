/* ═══════════════════════════════════════════════════════════
   Появление текста на скролле: слова проявляются из размытия.
   Работает в обе стороны: ушёл текст за край экрана, снова
   прячется; вернулся сверху, проявляется сверху вниз, снизу —
   снизу вверх. Мелкие подписи и блоки проявляются целиком.
   Новый контент (подгруженный скриптами) подхватывается сам.
   Один файл на главную и на кейсы.

   Подключение: <script src="assets/reveal.js"></script>
   После динамического рендера: window.TextReveal.scan()
   Внутри текста можно держать элементы (ссылки, <b>, якоря картинок):
   они сохраняются, слова внутри них тоже проявляются.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  // по словам
  var WORDS = [
    '.section-title', '.contact-left h2', '.contact-left p', '.ab-p',
    '.xp-co', '.xp-text', '.faq-q', '.faq-a', '.pg-name', '.pg-desc',
    '.c-title', '.c-h2', '.c-text p', '.c-over', '.c-ins-t', '.c-next-title > span', '.c-snap-t'
  ];
  // целиком
  var SOFT = [
    '.section-eyebrow', '.projects-count', '.pj-head', '.pj-cap',
    '.xp-num', '.xp-role', '.xp-when', '.sk-title', '.sk-chips',
    '.pg-icon', '.pg-sub', '.pg-foot', '.meta-cell', '.contact-email', '.contact-form',
    '.ab-group', '.ab-plus', '.ab-cta', '.ab-status', '.footer-inner > *',
    '.c-tags', '.c-facts dt', '.c-facts dd:not(.c-over)', '.c-eyebrow', '.c-ins-k', '.c-ins-ico',
    '.c-stat', '.c-quote', '.cm', '.c-cover', '.c-link', '.c-snap img', '.c-snap-a', '.c-next-label'
  ];
  var SKIP_IN = '.hero, .dock-wrap, .loader-text-wrap, .showcase, .pg-sheet, .lb, .c-nav';
  var KEEP = 'img,svg,video,.rv-keep';

  var obs = null;
  function observer() {
    if (obs) return obs;
    obs = new IntersectionObserver(function (entries) {
      var vh = window.innerHeight;
      entries.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting && (e.intersectionRatio >= .15 || e.intersectionRect.height >= vh * .15)) {
          el.classList.add('rv-on');
        } else if (!e.isIntersecting) {
          // ушёл за край: прячем сразу и запоминаем, с какой стороны вернётся
          el.classList.remove('rv-on');
          el.classList.toggle('rv-up', e.boundingClientRect.top < 0);
        }
      });
    }, { threshold: [0, .05, .1, .15, .3, .5] });
    return obs;
  }

  /* Текстовые узлы режем на слова, элементы сохраняем */
  function words(src, out) {
    [].slice.call(src.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { out.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'rv-w'; w.textContent = tok;
          out.appendChild(w);
        });
      } else if (n.nodeType === 1) {
        if (n.matches(KEEP) || n.tagName === 'BR') { out.appendChild(n.cloneNode(true)); return; }
        var c = n.cloneNode(false); out.appendChild(c); words(n, c);
      }
    });
  }

  function split(el) {
    var src = el.getAttribute('data-rv-src');
    if (src === null) { src = el.innerHTML; el.setAttribute('data-rv-src', src); }
    var tmp = document.createElement('div'); tmp.innerHTML = src;
    var frag = document.createDocumentFragment(); words(tmp, frag);
    el.innerHTML = ''; el.appendChild(frag);
  }

  /* Слова одной строки идут почти вместе, строки лесенкой.
     --d: сверху вниз (скролл вниз), --dr: снизу вверх (скролл вверх) */
  function stagger(el) {
    var ws = el.querySelectorAll('.rv-w'), top = null, line = -1, k = 0, ln = [];
    for (var i = 0; i < ws.length; i++) {
      var t = ws[i].offsetTop;
      if (top === null || Math.abs(t - top) > 3) { top = t; line++; k = 0; }
      ln.push([line, k++]);
    }
    for (var j = 0; j < ws.length; j++) {
      var l = ln[j][0], q = ln[j][1];
      ws[j].style.setProperty('--d', Math.min(l * .09 + q * .035, 1.4).toFixed(3) + 's');
      ws[j].style.setProperty('--dr', Math.min((line - l) * .09 + q * .035, 1.4).toFixed(3) + 's');
    }
  }

  function prep(el, instant, byWord) {
    if (el.closest(SKIP_IN)) return;
    if (!el.textContent.trim() && !el.querySelector('img,video')) return;
    if (byWord) { split(el); stagger(el); el.classList.add('rv-words'); }
    else el.classList.add('rv-soft');
    release(el);
    if (instant || REDUCED) el.classList.add('rv-on');
    else observer().observe(el);
  }

  /* Родительский .reveal больше не нужен: текст анимируется сам */
  function release(el) {
    var p = el.closest('.reveal');
    if (p) { p.classList.add('visible'); p.classList.remove('reveal'); }
  }

  function scan(opts) {
    opts = opts || {};
    [[WORDS, true], [SOFT, false]].forEach(function (g) {
      g[0].forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (el) {
          if (el.dataset.rvDone && !opts.force) return;
          if (el.parentNode && el.parentNode.closest('.rv-words,.rv-soft')) return;
          el.dataset.rvDone = '1';
          prep(el, opts.instant, g[1]);
        });
      });
    });
    // блоки со старым .reveal, внутри которых нечего анимировать по отдельности
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.closest(SKIP_IN) || el.closest('.rv-words,.rv-soft')) return;
      el.classList.remove('reveal'); el.classList.add('visible');
      el.dataset.rvDone = '1'; el.classList.add('rv-soft');
      if (opts.instant || REDUCED) el.classList.add('rv-on'); else observer().observe(el);
    });
  }

  /* Контент, который дорисовали скрипты (проекты, опыт, playground), подхватываем сами */
  var mt;
  function watch() {
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) if (list[i].addedNodes.length) { clearTimeout(mt); mt = setTimeout(scan, 60); return; }
    }).observe(document.body, { childList: true, subtree: true });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { document.querySelectorAll('.rv-words').forEach(stagger); }, 180);
  });

  /* Смена языка переписывает текст: пересобираем и показываем сразу */
  function hookLang() {
    if (typeof window.setLang !== 'function' || window.setLang._rv) return;
    var orig = window.setLang;
    var wrapped = function (lang) {
      orig(lang);
      document.querySelectorAll('.rv-words[data-en]').forEach(function (el) {
        el.removeAttribute('data-rv-src');
        split(el); stagger(el); el.classList.add('rv-now', 'rv-on');
        requestAnimationFrame(function () { el.classList.remove('rv-now'); });
      });
    };
    wrapped._rv = true;
    window.setLang = wrapped;
  }

  function refresh(el) {
    if (!el) return;
    el.removeAttribute('data-rv-src');
    el.classList.remove('rv-on');
    el.dataset.rvDone = '1';
    prep(el, false, true);
  }

  window.TextReveal = { scan: scan, split: split, stagger: stagger, refresh: refresh };

  function boot() { scan(); hookLang(); watch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { scan(); hookLang(); });
})();
