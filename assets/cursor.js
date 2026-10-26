/* ═══════════════════════════════════════════════════════════
   След курсора: короткое пиксельное облачко (растр 4×4, как в
   старых играх и печати). У курсора плотнее, к хвосту редеет и гаснет.
   Сетка пикселей неподвижна, двигается только облако.

   Лежит под всем контентом: холст вставляется первым слоем в каждый
   «пол» страницы (z-index:-1 внутри его слоя), поэтому текст,
   картинки и кнопки просто лежат поверх, без белых подложек.
   Только для устройств с мышью, при «уменьшить движение» выключено.

   Подключение: <script src="assets/cursor.js"></script>, общий для всех страниц
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  var PX = 4;          // размер «пикселя», px
  var R = 26;          // радиус облака у курсора, px
  var LIFE = 420;      // сколько живёт след, мс
  var GAP = 5;         // точки следа не чаще, px
  var MAXP = 16;       // длина следа, точек
  var COLOR = 'rgba(12,12,12,.11)';
  // упорядоченный дизеринг Байера 4×4: пороги заполнения
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // «полы»: слои со своим фоном. Холст ложится в каждый, под контент
  var FLOORS = ['.pn'];   // светлые и тёмные панели; на видео и фото следа нет
  var layers = [];
  function mount() {
    var hosts = [];
    FLOORS.forEach(function (s) { [].push.apply(hosts, document.querySelectorAll(s)); });
    if (!hosts.length) hosts = [document.body];
    layers = hosts.map(function (h) {
      var cv = document.createElement('canvas');
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;image-rendering:pixelated';
      h.insertBefore(cv, h.firstChild);
      // цвет пикселей от фона: тёмный на светлом, светлый на тёмном
      var m = getComputedStyle(h).backgroundColor.match(/\d+/g) || [255, 255, 255];
      var dark = (+m[0] * .299 + +m[1] * .587 + +m[2] * .114) < 128;
      return { host: h, cv: cv, cx: cv.getContext('2d'), color: dark ? 'rgba(255,255,255,.09)' : COLOR };
    });
    size();
  }
  var dpr = 1, W = 0, H = 0;
  function size() {
    dpr = 1;   // пиксели целые, холст в разрешении CSS + pixelated: так же чётко, а памяти вчетверо меньше
    W = window.innerWidth; H = window.innerHeight;
    layers.forEach(function (l) { l.cv.width = W * dpr; l.cv.height = H * dpr; });
  }
  window.addEventListener('resize', size);

  var pts = [], raf = 0, last = null;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' || !layers.length) return;
    var x = e.clientX, y = e.clientY;
    if (last && Math.hypot(x - last.x, y - last.y) < GAP) return;
    last = { x: x, y: y, t: performance.now() };
    pts.push(last);
    if (pts.length > MAXP) pts.shift();
    if (!raf) raf = requestAnimationFrame(draw);
  }, { passive: true });

  function draw() {
    var now = performance.now();
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    var cells = [];
    if (pts.length) {
      var src = pts.map(function (p) {
        var k = 1 - (now - p.t) / LIFE;
        return { x: p.x, y: p.y, w: k * k, r: R * (.5 + .5 * k) };
      });
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      src.forEach(function (s) {
        x0 = Math.min(x0, s.x - s.r * 1.7); y0 = Math.min(y0, s.y - s.r * 1.7);
        x1 = Math.max(x1, s.x + s.r * 1.7); y1 = Math.max(y1, s.y + s.r * 1.7);
      });
      x0 = Math.max(0, Math.floor(x0 / PX) * PX); y0 = Math.max(0, Math.floor(y0 / PX) * PX);
      for (var y = y0; y < Math.min(H, y1); y += PX) {
        for (var x = x0; x < Math.min(W, x1); x += PX) {
          var cxp = x + PX / 2, cyp = y + PX / 2, f = 0;
          for (var i = 0; i < src.length; i++) {
            var s = src[i], dx = cxp - s.x, dy = cyp - s.y, d2 = dx * dx + dy * dy, r2 = s.r * s.r;
            if (d2 < r2 * 3) f += s.w * Math.exp(-d2 / r2);
          }
          if (f < .05) continue;
          var b = BAYER[((y / PX) & 3) * 4 + ((x / PX) & 3)];
          if (Math.min(f, 1) * .85 > (b + .5) / 16) cells.push(x, y);
        }
      }
    }
    layers.forEach(function (l) {
      if (!cells.length && !l.drawn) return;
      var o = l.cv.getBoundingClientRect();   // обычно 0,0; если слой сдвинут трансформом, учитываем
      l.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      l.cx.clearRect(0, 0, W, H); l.drawn = false;
      if (!cells.length) return;
      var hr = l.host.getBoundingClientRect();
      if (hr.bottom < 0 || hr.top > H) return;
      l.cx.fillStyle = l.color;
      l.cx.beginPath();
      for (var j = 0; j < cells.length; j += 2) l.cx.rect(cells[j] - o.left, cells[j + 1] - o.top, PX - 1, PX - 1);
      l.cx.fill(); l.drawn = true;
    });
    raf = pts.length ? requestAnimationFrame(draw) : 0;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
