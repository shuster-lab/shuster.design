/* ═══════════════════════════════════════════════════════════
   Переход между страницами пикселями. Клик по внутренней ссылке:
   экран снизу вверх по квадратам заливается чёрным, уходим на новый
   адрес. Там экран сначала чёрный; как только страница загрузилась,
   квадраты так же снизу вверх исчезают.

   В <head> обеих страниц стоит короткий скрипт:
     try{if(sessionStorage.getItem('pt')){sessionStorage.removeItem('pt');
     document.documentElement.className+=' pt-in';}}catch(e){}
   Он закрывает страницу чёрным до первой отрисовки, без вспышки.
   Страница, которая дорисовывается скриптом (кейс), ставит на <html>
   атрибут data-pt-wait и по готовности шлёт document событие 'pt:ready'.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var D = document, root = D.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var COVER = 560, REVEAL = 680, INK = '#0a0a0a';

  /* цвет строки браузера (theme-color): на время перехода чёрный, чтобы не мигала белым */
  function tint(dark) {
    var m = D.querySelector('meta[name=theme-color]'); if (!m) return;
    if (dark) { if (!m.hasAttribute('data-c')) m.setAttribute('data-c', m.content); m.content = INK; }
    else if (m.hasAttribute('data-c')) { m.content = m.getAttribute('data-c'); m.removeAttribute('data-c'); }
  }

  /* сетка квадратов: у каждого свой порог появления.
     Нижние ряды раньше верхних, плюс случайность, чтобы край был рваным */
  function Pix() {
    var c = D.createElement('canvas'), x = c.getContext('2d');
    var W = innerWidth, H = innerHeight;
    var cell = Math.max(32, Math.min(80, Math.round(Math.max(W, H) / 24)));
    var cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), t = [];
    c.className = 'pt-pix'; c.width = W; c.height = H;
    for (var r = 0; r < rows; r++) for (var k = 0; k < cols; k++)
      t.push((1 - (r + .5) / rows) * .62 + Math.random() * .38);
    root.appendChild(c);
    x.fillStyle = INK;
    // p от 0 до 1; cover: квадрат чёрный, когда p прошло его порог; reveal: наоборот
    function draw(p, cover) {
      x.clearRect(0, 0, W, H);
      for (var i = 0; i < t.length; i++) {
        if ((t[i] < p) === cover) x.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
      }
    }
    function run(ms, cover, done) {
      var t0 = 0;
      (function tick(now) {
        if (!t0) t0 = now;
        var q = Math.min(1, (now - t0) / ms);
        q = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;   // плавно в начале и в конце
        draw(q * 1.001, cover);
        if (q < 1) requestAnimationFrame(tick); else if (done) done();
      })(performance.now());
    }
    return { el: c, draw: draw, run: run };
  }

  /* ── вход ── */
  if (root.classList.contains('pt-in')) {
    if (REDUCED) {
      root.classList.remove('pt-in');
    } else {
      var started = false;
      var reveal = function () {
        if (started) return; started = true;
        var px = Pix();
        px.draw(1.001, true);                       // полностью чёрный, как и подложка
        root.classList.add('pt-open');               // подложку убираем, дальше работает canvas
        requestAnimationFrame(function () {
          px.run(REVEAL, false, function () {
            px.el.parentNode && px.el.parentNode.removeChild(px.el);
            root.classList.remove('pt-in'); root.classList.remove('pt-open');
            tint(false);
          });
        });
      };
      // ждём загрузку страницы (и отрисовку кейса, если она нужна), но не дольше 3 секунд
      var need = root.hasAttribute('data-pt-wait') && !window.__ptReady ? 2 : 1;
      var one = function () { if (--need <= 0) setTimeout(reveal, 60); };
      if (D.readyState === 'complete') one(); else addEventListener('load', one);
      if (need === 2) D.addEventListener('pt:ready', one, { once: true });
      setTimeout(reveal, 3000);
    }
  }

  if (REDUCED) return;

  /* ── выход ── */
  var leaving = false, cur = null;

  function go(url) {
    if (leaving) return;
    leaving = true;
    try { sessionStorage.setItem('pt', '1'); } catch (e) {}
    cur = Pix();
    cur.run(COVER, true, function () {
      // под квадратами уже весь экран чёрный: держим его чёрным и на время смены страницы
      root.style.background = INK; D.body.style.background = INK; tint(true);
      location.href = url;
    });
  }

  D.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;

    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;              // наружу — обычным способом
    if (u.href === location.href) return;
    // тот же документ, меняется только якорь
    if (u.pathname === location.pathname && u.search === location.search && u.hash) return;
    // файлы (CV и прочее) скачиваются, а не открываются
    if (/\.(pdf|zip|docx?|xlsx?|pptx?|jpe?g|png|webp|mp4)$/i.test(u.pathname)) return;

    e.preventDefault();
    go(u.href);
  });

  /* Назад из кэша браузера: снимаем всё, что осталось от ухода */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    leaving = false;
    var old = D.querySelectorAll('.pt-pix');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    root.classList.remove('pt-in'); root.classList.remove('pt-open');
    root.style.background = ''; D.body.style.background = ''; tint(false);
  });
})();
