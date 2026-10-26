/* ═══════════════════════════════════════════════════════════
   Аналитика Umami Cloud (без cookies, баннер согласия не нужен).
   Чтобы включить: вставить Website ID из Umami в UMAMI_ID ниже.
   Пока строка пустая, файл ничего не делает и никуда не ходит.
   Считается только на shuster.design: локальный запуск не портит статистику.

   События (Umami → Events):
     contact      клик по почте, Telegram, WhatsApp, копирование почты   { via }
     cv           открыли CV
     form-send    отправили форму в футере (via: web3forms или mail-app)
     case-open    открыли кейс                                           { slug }
     case-read    дочитали кейс до вывода                               { slug }
     case-next    перешли к следующему кейсу из конца кейса             { slug }
     lang         переключили язык                                       { to }
     not-found    попали на 404                                          { path }
   ═══════════════════════════════════════════════════════════ */
(function () {
  var UMAMI_ID = '';
  var HOST = 'shuster.design';
  if (!UMAMI_ID) return;

  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', UMAMI_ID);
  s.setAttribute('data-domains', HOST);
  document.head.appendChild(s);

  // события до загрузки трекера складываем в очередь
  var queue = [];
  function track(name, data) {
    if (window.umami && umami.track) umami.track(name, data);
    else queue.push([name, data]);
  }
  s.onload = function () { queue.splice(0).forEach(function (e) { track(e[0], e[1]); }); };
  window.track = track;

  var slug = (location.search.match(/[?&]slug=([^&]+)/) || [])[1];
  var page = /case\.html/.test(location.pathname) ? 'case' : document.querySelector('main.nf') ? '404' : 'home';

  // клики: контакты, CV, следующий кейс
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a,button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^mailto:/.test(href)) track('contact', { via: 'email' });
    else if (/t\.me\//.test(href)) track('contact', { via: 'telegram' });
    else if (/wa\.me\//.test(href)) track('contact', { via: 'whatsapp' });
    else if (a.querySelector && a.querySelector('[data-tip="mail"]')) track('contact', { via: 'copy-email' });
    else if (a.querySelector && a.querySelector('[data-nav="opencv"]') && href) track('cv');
    else if (a.classList.contains('c-next')) track('case-next', { slug: slug || '' });
  }, true);

  // язык: html[data-lang] меняется при переключении
  var lang = document.documentElement.getAttribute('data-lang');
  new MutationObserver(function () {
    var l = document.documentElement.getAttribute('data-lang');
    if (l && l !== lang) { lang = l; track('lang', { to: l }); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

  if (page === '404') track('not-found', { path: location.pathname });

  // кейс: открыли и дочитали (виден блок «Závěr», он последний)
  if (page === 'case' && slug) {
    track('case-open', { slug: slug });
    var done = false;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting && !done) { done = true; track('case-read', { slug: slug }); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    (function wait(n) {
      var el = document.querySelector('.c-sec--take') || document.querySelector('.c-snap');
      if (el) io.observe(el); else if (n < 40) setTimeout(function () { wait(n + 1); }, 250);
    })(0);
  }
})();
