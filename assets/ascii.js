/* ═══════════════════════════════════════════════════════════
   Фото из символов (по мотивам ASCII Effect с componentry.dev,
   вариант flow): картинка раскладывается на знаки по яркости,
   с дизерингом Флойда–Стейнберга, знаки слегка «текут», а вокруг
   курсора расходится волна. Фон прозрачный: под ним виден градиент.

   Как устроено, чтобы не грузить процессор:
   • поле яркости (с дизерингом) считается один раз на размер блока;
   • знаки рисует видеокарта (WebGL): поле и атлас знаков лежат в текстурах,
     «течение» и волна считаются в шейдере по тем же формулам;
   • зум на скролле делает сам холст через transform, без перерисовки;
   • без WebGL работает прежний вариант на 2D-холсте;
   • объём: по карте глубины картинка натянута на рельеф (сетка в видеокарте),
     поворот рельефа рисуется в маленькую текстуру размером с сетку знаков,
     а знаки читают уже её. Без поворота этот шаг пропускается.

   Разметка: <div class="ascii" data-ascii='{"src":"media/hero/stepan-cut.webp","focus":[.48,.15]}'></div>
   Параметры: src, chars, fontSize, brightnessBoost, contrast, threshold,
     posterize, ditherStrength, flowSpeed, flowStrength, flowFrequency,
     mouseRadius, mouseStrength, mouseWaveSpeed, colors[2], floor,
     focus [x,y]  — точка картинки (0…1), которая держится на месте при зуме (лицо),
     at [x,y]     — где на экране стоит низ-центр картинки при масштабе 1 (0…1),
     height       — высота картинки при масштабе 1, доля высоты блока,
     depth        — карта глубины (светлее = ближе), того же кадра, что src,
     turn         — поворот в профиль на setTurn(1), градусы (минус — лицом влево),
     relief       — глубина рельефа, доля высоты картинки,
     m {…}        — свои значения для телефона.
   Снаружи: el._ascii.setScale(s) — зум (1 = исходный), el._ascii.setTurn(0…1) — поворот,
   el._ascii.pause(bool) — пауза.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
  function clamp(v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); }
  function rgb(h) { var m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255]; }

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D uField,uAtlas;',
    'uniform vec2 uRes,uCell,uGrid,uMouse;uniform vec4 uBounds;',
    'uniform float uDpr,uTime,uOn,uN,uFF,uFS,uFStr,uMR,uMS,uMW;uniform vec2 uFade;',
    'uniform vec3 uC0,uC1;',
    'void main(){',
    ' vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;',
    ' float i=floor(p.x/uCell.x)+1.,j=floor(p.y/uCell.y)+1.;',            // знак ячейки i стоит на (i-1)*cw
    ' if(i<uBounds.x||i>=uBounds.z||j<uBounds.y||j>=uBounds.w)discard;',
    ' vec2 loc=(p-vec2((i-1.)*uCell.x,(j-1.)*uCell.y))/uCell;',
    ' float X=i*uCell.x,Y=j*uCell.y,sc=i,sr=j,inf=0.;',
    ' float ph=X*uFF+uTime*uFS*3.14159265*.002;',
    ' float drift=(sin(ph)+sin(ph*.61+Y*uFF*.65)*.45)*uFStr;',
    ' if(uOn>.5){',
    '  vec2 m=vec2(X,Y)-uMouse;float d=length(m);',
    '  inf=clamp(1.-d/uMR,0.,1.);',
    '  if(d>0.&&inf>0.){float disp=inf*inf*uMS*sin(d*.055-uTime*uMW*3.14159265*.002);',
    '   sc-=m.x/d*disp/uCell.x;sr-=m.y/d*disp/uCell.y;}',
    ' }',
    ' sc-=drift/uCell.x;',
    ' vec2 ix=floor(clamp(vec2(sc,sr),vec2(0.),uGrid-1.)+.5);',
    ' float f=texture2D(uField,(ix+.5)/uGrid).r;',
    ' float lum=clamp(f+inf*.08,0.,1.);',
    ' float g=min(uN-1.,floor(lum*(uN-1.)));',
    ' if(g<.5)discard;',                                                    // первый знак — пробел
    ' float a=texture2D(uAtlas,vec2((g+loc.x)/uN,loc.y)).a;',
    ' if(a<.004)discard;',
    ' a*=1.-smoothstep(uFade.x,uFade.y,Y);',                               // низ силуэта плавно растворяется, без обреза
    ' vec3 c=mix(uC0,uC1,lum)/255.;',
    ' gl_FragColor=vec4(c*a,a);',
    '}'
  ].join('\n');

  // рельеф: вершина = точка картинки (u, v, глубина, непрозрачность)
  var MVS = [
    'attribute vec4 a;uniform vec4 uRect;uniform vec2 uGrid,uCell,uPiv;uniform float uYaw,uK,uZp;',
    'varying vec2 vG;varying float vA;',
    'void main(){',
    ' vec2 g=uRect.xy+a.xy*uRect.zw;vG=g;vA=a.w;',
    ' vec2 P=(g-uPiv)*uCell;float Z=(a.z-uZp)*uK,c=cos(uYaw),s=sin(uYaw);',
    ' float x=P.x*c+Z*s,z=-P.x*s+Z*c;',
    ' vec2 q=(uPiv+vec2(x,P.y)/uCell)/uGrid*2.-1.;',
    ' gl_Position=vec4(q,-z/(uK*2.+uCell.x*uGrid.x),1.);',
    '}'
  ].join('\n');
  var MFS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D uField;uniform vec2 uGrid;varying vec2 vG;varying float vA;',
    'void main(){if(vA<.5)discard;gl_FragColor=vec4(texture2D(uField,vG/uGrid).r,0.,0.,1.);}'
  ].join('\n');

  function mount(el) {
    var o = {}; try { o = JSON.parse(el.getAttribute('data-ascii') || '{}'); } catch (e) {}
    if (o.m && innerWidth < 768) for (var k0 in o.m) o[k0] = o.m[k0];
    var P = {
      src: o.src, chars: o.chars || ' .:-=+*#%@', fontSize: o.fontSize || 9, family: o.fontFamily || 'Arial, Helvetica, sans-serif',
      boost: o.brightnessBoost == null ? 2.2 : o.brightnessBoost, contrast: o.contrast == null ? 1.1 : o.contrast,
      threshold: o.threshold == null ? .06 : o.threshold, posterize: o.posterize || 32, dither: o.ditherStrength == null ? .8 : o.ditherStrength,
      flowSpeed: o.flowSpeed == null ? .22 : o.flowSpeed, flowStrength: o.flowStrength == null ? 6 : o.flowStrength, flowFrequency: o.flowFrequency || .018,
      mouseRadius: o.mouseRadius || 150, mouseStrength: o.mouseStrength == null ? 22 : o.mouseStrength, mouseWaveSpeed: o.mouseWaveSpeed || 1.2,
      colors: (o.colors || ['#f4f4f5', '#a1a1aa']).map(rgb), floor: o.floor || 0,
      focus: o.focus || [.5, .15], at: o.at || [.5, 1], height: o.height || .9,
      fade: o.fade == null ? .32 : o.fade,   // доля высоты картинки, на которой низ растворяется
      depth: o.depth, turn: (o.turn || 0) * Math.PI / 180, relief: o.relief == null ? .3 : o.relief
    };
    if (!P.src) return;
    var cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform';
    el.appendChild(cv);

    var img = new Image(), loaded = false, W = 0, H = 0, dpr = 1, raf = 0, vis = true, paused = false, t0 = performance.now();
    var zt = 1, zs = 1, yt = 0, ys = 0, ox = 0, oy = 0, G = null, cache = {}, depth = null;
    var pt = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    var mcx = document.createElement('canvas').getContext('2d');

    // ── поле яркости: один раз на размер ──
    function field() {
      var fs = P.fontSize, ch = Math.max(4, fs);
      mcx.font = '400 ' + fs + 'px ' + P.family;
      var cw = Math.max(2, mcx.measureText('M').width);
      var cols = Math.ceil(W / cw) + 2, rows = Math.ceil(H / ch) + 2, key = cols + 'x' + rows + ':' + W + 'x' + H;
      if (cache.key === key) return cache;
      var sc = document.createElement('canvas'), sx = sc.getContext('2d', { willReadFrequently: true });
      sc.width = cols; sc.height = rows;
      var h1 = H * P.height, w1 = h1 * img.naturalWidth / img.naturalHeight;
      var fx = W * P.at[0] - w1 / 2 + P.focus[0] * w1, fy = H * P.at[1] - h1 + P.focus[1] * h1;
      var dx = fx - P.focus[0] * w1, dy = fy - P.focus[1] * h1;
      ox = fx; oy = fy;
      sx.imageSmoothingQuality = 'high';
      sx.drawImage(img, dx / cw + 1, dy / ch + 1, w1 / cw, h1 / ch);
      var px = sx.getImageData(0, 0, cols, rows).data, steps = Math.max(2, Math.round(P.posterize)), F = new Float32Array(cols * rows), i, j, k;
      for (i = 0; i < F.length; i++) {
        k = i * 4; var a = px[k + 3] / 255, l = (px[k] * .2126 + px[k + 1] * .7152 + px[k + 2] * .0722) / 255;
        l = clamp((l - .5) * P.contrast + .5); l = clamp(l * P.boost * a);
        F[i] = l <= P.threshold ? 0 : (l - P.threshold) / (1 - P.threshold);
        if (a > .5 && F[i] < P.floor) F[i] = P.floor;      // тёмная одежда не пропадает: силуэт хотя бы точками
      }
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {   // Флойд–Стейнберг
        k = j * cols + i; var ov = clamp(F[k]), q = Math.round(ov * (steps - 1)) / (steps - 1), v = ov + (q - ov) * P.dither, e = ov - v;
        F[k] = v;
        if (i + 1 < cols) F[k + 1] += e * 7 / 16;
        if (j + 1 < rows) { if (i > 0) F[k + cols - 1] += e * 3 / 16; F[k + cols] += e * 5 / 16; if (i + 1 < cols) F[k + cols + 1] += e / 16; }
      }
      var mg = 3 + Math.ceil((P.flowStrength + P.mouseStrength) / cw);   // рисуем только вокруг картинки
      cache = { key: key, F: F, cw: cw, ch: ch, cols: cols, rows: rows, rect: [dx / cw + 1, dy / ch + 1, w1 / cw, h1 / ch], h1: h1,
        piv: [fx / cw + 1, fy / ch + 1], fade: [Math.min(dy + h1, H) - h1 * P.fade, Math.min(dy + h1, H)],
        c0: Math.max(0, Math.floor(dx / cw) - mg), c1: Math.min(cols, Math.ceil((dx + w1) / cw) + mg + 2),
        r0: Math.max(0, Math.floor(dy / ch) - mg), r1: Math.min(rows, Math.ceil((dy + h1) / ch) + mg + 2) };
      if (G) G.upload(cache);
      return cache;
    }

    // ── WebGL ──
    function makeGL() {
      var gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
      if (!gl) return null;
      function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; }
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
      var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      gl.useProgram(pr);
      var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var ap = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      var M = depth && P.turn ? makeMesh(gl, sh) : null, B = null;
      var U = {}; ['uField', 'uAtlas', 'uRes', 'uCell', 'uGrid', 'uMouse', 'uBounds', 'uDpr', 'uTime', 'uOn', 'uN', 'uFF', 'uFS', 'uFStr', 'uMR', 'uMS', 'uMW', 'uC0', 'uC1', 'uFade']
        .forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
      function tex(unit) {
        var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return t;
      }
      var tF = tex(0), tA = tex(1);
      gl.uniform1i(U.uField, 0); gl.uniform1i(U.uAtlas, 1);
      gl.uniform1f(U.uN, P.chars.length); gl.uniform1f(U.uFF, P.flowFrequency); gl.uniform1f(U.uFS, REDUCED ? 0 : P.flowSpeed);
      gl.uniform1f(U.uFStr, REDUCED ? 0 : P.flowStrength); gl.uniform1f(U.uMR, P.mouseRadius); gl.uniform1f(U.uMS, P.mouseStrength); gl.uniform1f(U.uMW, P.mouseWaveSpeed);
      gl.uniform3fv(U.uC0, P.colors[0]); gl.uniform3fv(U.uC1, P.colors[P.colors.length - 1]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
      return {
        upload: function (c) {
          // поле: байты яркости
          var b = new Uint8Array(c.cols * c.rows);
          for (var i = 0; i < b.length; i++) b[i] = Math.round(clamp(c.F[i]) * 255);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tF);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, c.cols, c.rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, b);
          // атлас знаков в разрешении экрана
          var n = P.chars.length, ac = document.createElement('canvas'), ax = ac.getContext('2d');
          ac.width = Math.ceil(n * c.cw * dpr); ac.height = Math.ceil(c.ch * dpr);
          ax.scale(ac.width / (n * c.cw), ac.height / c.ch);
          ax.font = '400 ' + P.fontSize + 'px ' + P.family; ax.textBaseline = 'top'; ax.fillStyle = '#fff';
          for (var k = 1; k < n; k++) ax.fillText(P.chars[k], k * c.cw, 0);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tA);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
          gl.uniform2f(U.uCell, c.cw, c.ch); gl.uniform2f(U.uGrid, c.cols, c.rows); gl.uniform4f(U.uBounds, c.c0, c.r0, c.c1, c.r1); gl.uniform2f(U.uFade, c.fade[0], c.fade[1]);
          if (M) M.size(c);
          B = c;
        },
        draw: function (t) {
          gl.activeTexture(gl.TEXTURE0);
          if (M && Math.abs(ys) > .0005) {       // повёрнутый рельеф → текстура размером с сетку
            gl.disable(gl.BLEND); M.draw(ys, tF);
            gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(ap);
            gl.enable(gl.BLEND); gl.bindTexture(gl.TEXTURE_2D, M.tex);
          } else gl.bindTexture(gl.TEXTURE_2D, tF);
          gl.useProgram(pr);
          gl.viewport(0, 0, cv.width, cv.height);
          gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uTime, t);
          gl.uniform2f(U.uMouse, pt.x, pt.y); gl.uniform1f(U.uOn, pt.on ? 1 : 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          // считаем только прямоугольник с картинкой, остальной холст видеокарта не трогает
          if (B) {
            var x0 = Math.max(0, Math.floor((B.c0 - 2) * B.cw * dpr)), x1 = Math.min(cv.width, Math.ceil(B.c1 * B.cw * dpr));
            var y0 = Math.max(0, Math.floor((B.r0 - 2) * B.ch * dpr)), y1 = Math.min(cv.height, Math.ceil(B.r1 * B.ch * dpr));
            gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, cv.height - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
          }
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.disable(gl.SCISSOR_TEST);
        }
      };
    }

    // ── рельеф по карте глубины ──
    function makeMesh(gl, sh) {
      var vs = sh(gl.VERTEX_SHADER, MVS), fs = sh(gl.FRAGMENT_SHADER, MFS); if (!vs || !fs) return null;
      var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      var U = {}; ['uRect', 'uGrid', 'uCell', 'uPiv', 'uYaw', 'uK', 'uZp', 'uField'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
      var al = gl.getAttribLocation(pr, 'a');
      // сетка вершин: глубина из карты, непрозрачность из альфы фото
      var NX = 90, NY = Math.round(NX * img.naturalHeight / img.naturalWidth);
      function px(src) { var c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true }); c.width = NX; c.height = NY; x.drawImage(src, 0, 0, NX, NY); return x.getImageData(0, 0, NX, NY).data; }
      var D = px(depth), A = px(img), V = new Float32Array(NX * NY * 4), I = new Uint16Array((NX - 1) * (NY - 1) * 6), i, j, k = 0;
      for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
        var n = j * NX + i; V[n * 4] = i / (NX - 1); V[n * 4 + 1] = j / (NY - 1); V[n * 4 + 2] = D[n * 4] / 255; V[n * 4 + 3] = A[n * 4 + 3] / 255;
      }
      for (j = 0; j < NY - 1; j++) for (i = 0; i < NX - 1; i++) { var q = j * NX + i; I.set([q, q + 1, q + NX, q + 1, q + NX + 1, q + NX], k); k += 6; }
      var zp = D[(Math.round(P.focus[1] * (NY - 1)) * NX + Math.round(P.focus[0] * (NX - 1))) * 4] / 255;
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
      var tex = gl.createTexture(), fb = gl.createFramebuffer(), rb = gl.createRenderbuffer(), C = null;
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (w) { gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE); });
      [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (f) { gl.texParameteri(gl.TEXTURE_2D, f, gl.NEAREST); });
      return {
        tex: tex,
        size: function (c) {
          C = c;
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, c.cols, c.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, c.cols, c.rows);
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.useProgram(pr);
          gl.uniform4fv(U.uRect, c.rect); gl.uniform2f(U.uGrid, c.cols, c.rows); gl.uniform2f(U.uCell, c.cw, c.ch);
          gl.uniform2fv(U.uPiv, c.piv); gl.uniform1f(U.uK, P.relief * c.h1); gl.uniform1f(U.uZp, zp); gl.uniform1i(U.uField, 0);
        },
        draw: function (yaw, field) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, C.cols, C.rows);
          gl.useProgram(pr); gl.uniform1f(U.uYaw, yaw);
          gl.bindTexture(gl.TEXTURE_2D, field);
          gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.vertexAttribPointer(al, 4, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(al);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
          gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.drawElements(gl.TRIANGLES, I.length, gl.UNSIGNED_SHORT, 0);
          gl.disable(gl.DEPTH_TEST); gl.disableVertexAttribArray(al);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
      };
    }

    // ── запасной 2D-вариант ──
    var cx2 = null;
    function color(l) {
      var c = P.colors, p = clamp(l) * (c.length - 1), i = Math.min(Math.floor(p), c.length - 2), m = p - i, a = c[i], b = c[i + 1];
      return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * m) + ',' + Math.round(a[1] + (b[1] - a[1]) * m) + ',' + Math.round(a[2] + (b[2] - a[2]) * m) + ')';
    }
    function draw2D(t, c) {
      if (!cx2) cx2 = cv.getContext('2d');
      cx2.setTransform(dpr, 0, 0, dpr, 0, 0); cx2.clearRect(0, 0, W, H);
      cx2.font = '400 ' + P.fontSize + 'px ' + P.family; cx2.textBaseline = 'top';
      var cw = c.cw, ch = c.ch, last = '';
      for (var j = c.r0; j < c.r1; j++) for (var i = c.c0; i < c.c1; i++) {
        var X = i * cw, Y = j * ch, sc = i, sr = j, inf = 0;
        if (!REDUCED) {
          var ph = X * P.flowFrequency + t * P.flowSpeed * Math.PI * .002;
          var drift = (Math.sin(ph) + Math.sin(ph * .61 + Y * P.flowFrequency * .65) * .45) * P.flowStrength;
          if (pt.on) {
            var mx = X - pt.x, my = Y - pt.y, d = Math.sqrt(mx * mx + my * my);
            inf = clamp(1 - d / P.mouseRadius);
            if (d > 0 && inf > 0) { var disp = inf * inf * P.mouseStrength * Math.sin(d * .055 - t * P.mouseWaveSpeed * Math.PI * .002); sc -= mx / d * disp / cw; sr -= my / d * disp / ch; }
          }
          sc -= drift / cw;
        }
        var lum = clamp(c.F[Math.round(clamp(sr, 0, c.rows - 1)) * c.cols + Math.round(clamp(sc, 0, c.cols - 1))] + inf * .08);
        var g = P.chars[Math.min(P.chars.length - 1, Math.floor(lum * (P.chars.length - 1)))];
        if (!g || g === ' ') continue;
        var fa = clamp((Y - c.fade[0]) / Math.max(1, c.fade[1] - c.fade[0])); cx2.globalAlpha = 1 - fa * fa * (3 - 2 * fa);
        var fc = color(lum); if (fc !== last) { cx2.fillStyle = fc; last = fc; }
        cx2.fillText(g, X - cw, Y - ch);
      }
    }

    function resize() {
      var r = el.getBoundingClientRect(), lv = window.PERF ? PERF.level : 0;
      dpr = Math.min(window.devicePixelRatio || 1, [2, 1.5, 1][lv]);   // на слабом железе знаки рисуем в меньшем разрешении
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (loaded) { cache = {}; field(); var q = waiting; waiting = []; q.forEach(function (f) { f(); }); }
      wake(true);
    }
    var waiting = [];

    // зум делает сам холст (GPU): плавно, без перерисовки знаков; центр на лице, с инерцией
    function zoom() {
      zs += (zt - zs) * .14; if (Math.abs(zt - zs) < .0005) zs = zt;
      cv.style.transformOrigin = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
      cv.style.transform = zs === 1 ? '' : 'scale(' + zs.toFixed(4) + ')';
      ys += (yt - ys) * .045; if (Math.abs(yt - ys) < .0003) ys = yt;   // поворот догоняет скролл медленно
    }

    var dirty = true;
    var skip = false;
    function frame(now) {
      raf = 0; zoom();
      if (window.UIBUSY && now < window.UIBUSY && loaded) { if (vis && !paused && !document.hidden) raf = requestAnimationFrame(frame); return; }   // открывается меню: символы замирают
      if (window.PERF) PERF.tick(now);
      if (!loaded) return;
      // слабое железо: пока ничего не зумится и не крутится, медленное «течение» знаков рисуем через кадр
      skip = !skip;
      if (skip && window.PERF && PERF.level && zs === zt && ys === yt && !pt.on) { if (vis && !paused && !document.hidden) raf = requestAnimationFrame(frame); return; }
      pt.x += (pt.tx - pt.x) * .08; pt.y += (pt.ty - pt.y) * .08;
      var c = field(), t = REDUCED ? 0 : now - t0;
      if (G) G.draw(t); else draw2D(t, c);
      dirty = false;
      var live = !REDUCED || Math.abs(zt - zs) > .0005 || ys !== yt;
      if (vis && !paused && !document.hidden && live) raf = requestAnimationFrame(frame);
    }
    function wake(force) { if (force) dirty = true; if (!raf && loaded && vis && !paused) raf = requestAnimationFrame(frame); }

    if (FINE) {
      addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || paused) return;
        var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        var inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
        // курсор переводим в координаты холста до зума, чтобы волна шла ровно под ним
        x = ox + (x - ox) / zs; y = oy + (y - oy) / zs;
        if (inside && !pt.on) { pt.x = x; pt.y = y; }
        pt.on = inside; pt.tx = x; pt.ty = y;
      }, { passive: true });
    }
    new IntersectionObserver(function (en) { vis = en[0].isIntersecting; wake(); }).observe(el);
    if (window.PERF) PERF.on(function () { resize(); });
    document.addEventListener('visibilitychange', function () { wake(); });
    el._ascii = {
      setScale: function (s) { zt = s; wake(); },
      setTurn: function (v) { yt = clamp(v) * P.turn; wake(); },
      pause: function (v) { paused = !!v; if (!paused) wake(); },
      // поле готово: вызвать cb (сразу, если уже)
      ready: function (cb) { if (loaded && cache.F) cb(); else waiting.push(cb); },
      // знаки картинки как частицы для прелоадера: [x, y, знак, яркость] в координатах окна
      cells: function () {
        var c = cache; if (!c.F) return null;
        var r = el.getBoundingClientRect(), n = P.chars.length, out = [];
        for (var j = Math.max(1, c.r0); j < c.r1; j++) for (var i = Math.max(1, c.c0); i < c.c1; i++) {
          var l = clamp(c.F[j * c.cols + i]), g = Math.min(n - 1, Math.floor(l * (n - 1)));
          if (g < 1) continue;
          out.push(r.left + (i - 1) * c.cw, r.top + (j - 1) * c.ch, g, l);
        }
        return { list: out, cw: c.cw, ch: c.ch, P: P, dpr: dpr, focus: [ox + r.left, oy + r.top], fade: [c.fade[0] + r.top, c.fade[1] + r.top] };
      }
    };
    var started = false;
    function start() {
      if (started || !img.complete || (depth && !depth.complete)) return;
      started = true;
      G = makeGL();
      if (!G && cv.getContext('webgl')) { var n = cv.cloneNode(); el.replaceChild(n, cv); cv = n; }   // WebGL не поднялся: чистый холст под 2D
      loaded = true;
      if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else { addEventListener('resize', resize); resize(); }
    }
    if (P.depth && P.turn) { depth = new Image(); depth.onload = start; depth.onerror = function () { depth = null; start(); }; depth.src = P.depth; }
    img.onload = start;
    img.src = P.src;
  }

  /* Прелоадер: знаки слетаются со всего экрана и собирают картинку ровно там,
     где её потом рисует блок (одна точка = один знак, всё считает видеокарта). */
  var AVS = [
    'attribute vec4 aEnd;attribute vec4 aSt;',
    'uniform vec2 uRes,uCell,uFade;uniform float uT,uDur,uDpr,uN,uS;',
    'varying float vG,vL,vA;',
    'float h(float n){return fract(sin(n)*43758.5453);}',
    'void main(){',
    ' float p=clamp((uT-aSt.z)/uDur,0.,1.),e=1.-pow(1.-p,4.);',
    ' vec2 off=aSt.xy*(1.-e);float tw=(1.-e)*2.4;',                        // лёгкий завиток по дороге
    ' off=mat2(cos(tw),-sin(tw),sin(tw),cos(tw))*off;',
    ' vec2 pos=aEnd.xy+vec2(uS*.5)+off;',
    ' vec2 c=pos/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);',
    ' gl_PointSize=uS*uDpr;',
    ' float gs=floor(h(aSt.w*91.7+floor(uT*16.))*(uN-1.))+1.;',
    ' vG=p<.86?gs:aEnd.z;vL=aEnd.w;vA=smoothstep(0.,.25,uT)*(.35+.65*smoothstep(0.,.5,p))*(1.-smoothstep(uFade.x,uFade.y,aEnd.y+uCell.y));',
    '}'
  ].join('\n');
  var AFS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D uAtlas;uniform vec2 uCell;uniform float uN,uS;uniform vec3 uC0,uC1;',
    'varying float vG,vL,vA;',
    'void main(){vec2 l=gl_PointCoord*uS;if(l.x>=uCell.x||l.y>=uCell.y)discard;',
    ' float a=texture2D(uAtlas,vec2((vG+l.x/uCell.x)/uN,l.y/uCell.y)).a*vA;if(a<.004)discard;',
    ' gl_FragColor=vec4(mix(uC0,uC1,vL)/255.*a,a);}'
  ].join('\n');
  window.AsciiAssemble = function (cv, d, opt) {
    opt = opt || {};
    var W = innerWidth, H = innerHeight, dpr = d.dpr, P = d.P, n = P.chars.length;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return false;
    function sh(t, src) { var x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; }
    var vs = sh(gl.VERTEX_SHADER, AVS), fs = sh(gl.FRAGMENT_SHADER, AFS); if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    var L = d.list, cnt = L.length / 4, S = Math.ceil(Math.max(d.cw, d.ch));
    var st = new Float32Array(cnt * 4), R = Math.max(W, H), fx = d.focus[0], fy = d.focus[1], far = Math.hypot(W, H);
    for (var k = 0; k < cnt; k++) {
      var a = Math.random() * Math.PI * 2, r = R * (.12 + Math.random() * .6);
      var dist = Math.hypot(L[k * 4] - fx, L[k * 4 + 1] - fy) / far;            // от лица к краям
      st[k * 4] = Math.cos(a) * r; st[k * 4 + 1] = Math.sin(a) * r;
      st[k * 4 + 2] = .1 + Math.random() * .35 + dist * .6; st[k * 4 + 3] = k;
    }
    function attr(name, data) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 0, 0);
    }
    attr('aEnd', new Float32Array(L)); attr('aSt', st);
    // атлас знаков, как у блока
    var ac = document.createElement('canvas'), ax = ac.getContext('2d');
    ac.width = Math.ceil(n * d.cw * dpr); ac.height = Math.ceil(d.ch * dpr);
    ax.scale(ac.width / (n * d.cw), ac.height / d.ch);
    ax.font = '400 ' + P.fontSize + 'px ' + P.family; ax.textBaseline = 'top'; ax.fillStyle = '#fff';
    for (var g = 1; g < n; g++) ax.fillText(P.chars[g], g * d.cw, 0);
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (w) { gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE); });
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(function (f) { gl.texParameteri(gl.TEXTURE_2D, f, gl.NEAREST); });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
    var U = {}; ['uRes', 'uCell', 'uT', 'uDur', 'uDpr', 'uN', 'uS', 'uAtlas', 'uC0', 'uC1', 'uFade'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
    gl.uniform2f(U.uFade, d.fade[0], d.fade[1]);
    var DUR = opt.dur || 1.25, TOTAL = DUR + 1.3;
    gl.uniform2f(U.uRes, W, H); gl.uniform2f(U.uCell, d.cw, d.ch); gl.uniform1f(U.uDur, DUR); gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uN, n); gl.uniform1f(U.uS, S); gl.uniform1i(U.uAtlas, 0);
    gl.uniform3fv(U.uC0, P.colors[0]); gl.uniform3fv(U.uC1, P.colors[P.colors.length - 1]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0);
    var t0 = 0, fired = false;
    (function frame(now) {
      if (!t0) t0 = now;
      var s = (now - t0) / 1000;
      gl.uniform1f(U.uT, s); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, cnt);
      if (!fired && opt.at && s >= opt.at[0]) { fired = true; opt.at[1](); }
      if (s < TOTAL) requestAnimationFrame(frame); else if (opt.done) opt.done();
    })(performance.now());
    return { stop: function () { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } };
  };

  window.AsciiMount = mount;   // для страниц, которые собирают картинку сами (404)
  function boot() { [].forEach.call(document.querySelectorAll('[data-ascii]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
