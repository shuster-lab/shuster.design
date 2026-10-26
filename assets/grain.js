/* ═══════════════════════════════════════════════════════════
   Зернистый градиент (по мотивам Grain Gradient с componentry.dev):
   светлое поле, изогнутая граница тени, плёночное зерно, медленное
   «дыхание». Сверху добавлена реакция на мышь: граница тени
   выгибается к курсору, светлое пятно тянется за ним.

   Разметка: <div class="grain" data-grain='{"light":"#f1ebe4","mid":"#d79b78","dark":"#0e0e0e","angle":90}'></div>
   Параметры (все необязательные, как у оригинала):
     light, mid, dark — цвета (hex)
     angle    — поворот композиции, градусы
     position — сдвиг границы, -1…1
     curve    — изгиб границы, -1…1
     softness — ширина размытия, 0.01…1
     scale    — масштаб, 0.25…3
     grain, grainSize, seed, speed — зерно и скорость дыхания
     mouse    — сила реакции на мышь, 0…1
   Без WebGL ставится CSS-градиент. Вне экрана, во фоновой вкладке
   и при «уменьшить движение» не анимируется.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var motion = matchMedia('(prefers-reduced-motion:reduce)');
  var FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

  var VS = 'attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 u_resolution;',
    'uniform float u_ratio,u_angle,u_position,u_curve,u_softness,u_scale;',
    'uniform float u_grain,u_grainSize,u_seed,u_time;',
    'uniform vec3 u_light,u_mid,u_dark;',
    'uniform vec2 u_mouse;uniform float u_mouseAmt,u_mouseOn,u_blur;',
    'float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'vec2 place(vec2 uv,float aspect){',
    ' vec2 p=uv-.5;p.x*=aspect;float c=cos(u_angle),s=sin(u_angle);',
    ' p=mat2(c,-s,s,c)*p;p.x/=aspect;return p/u_scale+.5;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/u_resolution;uv.y=1.-uv.y;',
    ' float aspect=u_resolution.x/u_resolution.y;',
    ' vec2 p=place(uv,aspect);',
    ' vec2 m=place(u_mouse,aspect);',                                   // курсор в тех же координатах
    ' float on=u_mouseOn*u_mouseAmt;',
    ' float breath=sin(u_time*.52);',
    ' float undertow=sin(u_time*.31);',
    ' float bend=u_curve+sin(u_time*.52-.7)*.12;',
    ' float edge=.32+bend*pow(1.-p.y,2.)+u_position+breath*.115+undertow*.035;',
    // мышь: рядом с курсором по высоте граница тянется к нему
    ' float near=exp(-pow((p.y-m.y)*2.6,2.));',
    ' edge+=(m.x-edge)*.38*on*near;',
    ' float distanceToEdge=p.x-edge+sin(p.y*4.+u_time*.38)*.035;',
    ' float diffusion=u_softness*(1.+breath*.28)*(1.+u_blur*.5);',                // размытие на скролле считается тут, без CSS-фильтра
    ' float shadow=smoothstep(-diffusion,diffusion*.45,distanceToEdge);',
    ' vec2 lightCenter=vec2(.04+breath*.13,.04+undertow*.16);',
    ' lightCenter=mix(lightCenter,m,.45*on);',                          // свет тянется за курсором
    ' vec2 lightUV=(p-lightCenter)*vec2(1.9,1.7);',
    ' float mint=exp(-dot(lightUV,lightUV));',
    ' vec3 light=mix(u_light,u_mid,mint*(.66+breath*.1));',
    ' vec3 color=mix(light,u_mid*(.68+breath*.035),smoothstep(-diffusion*1.8,.02,distanceToEdge));',
    ' color=mix(color,u_dark,shadow);',
    ' vec2 grainUV=floor(gl_FragCoord.xy/(u_ratio*u_grainSize));',
    ' float noise=hash(grainUV+mod(u_seed,1000.)*13.7)-.5;',
    ' color+=noise*u_grain*mix(.48,.32,shadow)*(1.-smoothstep(0.,.3,u_blur)*.85);',   // мелкое зерно размытие гасит первым
    ' gl_FragColor=vec4(clamp(color,0.,1.),1.);',
    '}'
  ].join('\n');

  function hex(v, fb) {
    var c = /^#([\da-f]{3}|[\da-f]{6})$/i.test(v || '') ? v.slice(1) : fb.slice(1);
    if (c.length === 3) c = c.replace(/./g, '$&$&');
    return [0, 2, 4].map(function (o) { return parseInt(c.slice(o, o + 2), 16) / 255; });
  }
  function clamp(v, a, b, fb) { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : fb; }

  function mount(el) {
    var o = {}; try { o = JSON.parse(el.getAttribute('data-grain') || '{}'); } catch (e) {}
    if (o.m && innerWidth < 768) for (var k0 in o.m) o[k0] = o.m[k0];   // своя композиция для телефона
    var P = {
      light: o.light || '#dce5df', mid: o.mid || '#83b9ad', dark: o.dark || '#031419',
      angle: clamp(o.angle, -360, 360, 0), position: clamp(o.position, -1, 1, 0), curve: clamp(o.curve, -1, 1, .48),
      softness: clamp(o.softness, .01, 1, .13), scale: clamp(o.scale, .25, 3, 1), grain: clamp(o.grain, 0, 1, .32),
      grainSize: clamp(o.grainSize, .5, 4, 1), seed: clamp(o.seed, 0, 100000, 1), speed: clamp(o.speed, 0, 2, 1),
      mouse: clamp(o.mouse, 0, 1, .6)
    };
    el.style.background = 'linear-gradient(' + (120 + P.angle) + 'deg,' + P.mid + ' 0%,' + P.light + ' 35%,' + P.dark + ' 75%)';

    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .6s';
    el.insertBefore(cv, el.firstChild);
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false });
    if (!gl) return;
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var ap = gl.getAttribLocation(pr, 'a_position'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['resolution', 'ratio', 'angle', 'position', 'curve', 'softness', 'scale', 'grain', 'grainSize', 'seed', 'time', 'light', 'mid', 'dark', 'mouse', 'mouseAmt', 'mouseOn', 'blur']
      .forEach(function (k) { U[k] = gl.getUniformLocation(pr, 'u_' + k); });
    gl.uniform1f(U.angle, P.angle * Math.PI / 180); gl.uniform1f(U.position, P.position); gl.uniform1f(U.curve, P.curve);
    gl.uniform1f(U.softness, P.softness); gl.uniform1f(U.scale, P.scale); gl.uniform1f(U.grain, P.grain);
    gl.uniform1f(U.grainSize, P.grainSize); gl.uniform1f(U.seed, P.seed); gl.uniform1f(U.mouseAmt, P.mouse);
    gl.uniform3fv(U.light, hex(P.light, '#dce5df')); gl.uniform3fv(U.mid, hex(P.mid, '#83b9ad')); gl.uniform3fv(U.dark, hex(P.dark, '#031419'));

    var ratio = 1;
    function resize() {
      ratio = Math.min(window.devicePixelRatio || 1, 1.5) * (window.PERF ? PERF.scale() : 1);   // слабое железо: градиент в меньшем разрешении
      cv.width = Math.max(1, Math.round(cv.clientWidth * ratio));
      cv.height = Math.max(1, Math.round(cv.clientHeight * ratio));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U.resolution, cv.width, cv.height); gl.uniform1f(U.ratio, ratio);
      wake();
    }

    // мышь: цель и сглаженное значение; «присутствие» гаснет, когда курсор ушёл с блока
    var tx = .5, ty = .5, mx = .5, my = .5, ta = 0, ma = 0;
    if (FINE && P.mouse > 0) {
      addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var b = el.getBoundingClientRect();
        tx = (e.clientX - b.left) / b.width; ty = (e.clientY - b.top) / b.height;
        ta = (tx > -.1 && tx < 1.1 && ty > -.1 && ty < 1.1) ? 1 : 0;
        wake();
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', function () { ta = 0; wake(); });
    }

    var visible = true, paused = false, frame = 0, prev = 0, elapsed = 0, odd = false;
    function draw(now) {
      frame = 0;
      if (window.UIBUSY && now < window.UIBUSY) { prev = now; frame = requestAnimationFrame(draw); return; }   // открывается меню: фон замирает
      if (window.PERF) PERF.tick(now);
      // без мыши градиент только медленно дышит: 30 кадров в секунду глазу не отличить от 60
      if (ta === 0 && ma < .01) { odd = !odd; if (odd) { frame = requestAnimationFrame(draw); return; } }
      var dt = prev ? Math.min((now - prev) / 1000, .05) : 0; prev = now;
      if (!motion.matches) elapsed += dt * P.speed;
      var k = 1 - Math.pow(.02, dt);                         // сглаживание мыши, не зависит от fps
      mx += (tx - mx) * k; my += (ty - my) * k; ma += (ta - ma) * k * .7;
      gl.uniform1f(U.time, elapsed);
      gl.uniform2f(U.mouse, mx, my); gl.uniform1f(U.mouseOn, ma);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cv.style.opacity = '1';
      var moving = Math.abs(tx - mx) + Math.abs(ty - my) + Math.abs(ta - ma) > .001;
      if (visible && !paused && !document.hidden && ((P.speed > 0 && !motion.matches) || moving)) frame = requestAnimationFrame(draw);
    }
    function wake() { if (visible && !paused && !document.hidden && !frame) { prev = 0; frame = requestAnimationFrame(draw); } }
    var blurV = 0;
    el._grain = { pause: function (v) { paused = !!v; if (!paused) wake(); },
      setBlur: function (v) { v = Math.max(0, Math.min(1, v)); if (Math.abs(v - blurV) > .002) { blurV = v; gl.uniform1f(U.blur, v); wake(); } } };
    if (window.PERF) PERF.on(resize);
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; wake(); }, { rootMargin: '60px' }).observe(cv);
    document.addEventListener('visibilitychange', wake);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(cv); else addEventListener('resize', resize);
    resize();
  }

  function boot() { [].forEach.call(document.querySelectorAll('[data-grain]'), mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
