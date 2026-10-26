/* ═══════════════════════════════════════════════════════════
   Ховер кнопок: подпись прокручивается вверх (снизу приезжает такая же),
   уголки в двух углах переезжают по краю в два других и поворачиваются,
   кнопка чуть меняет оттенок. Общий для index.html и case.html.
   Кнопки, которые появляются позже (Playground, кейсы), подхватываются сами.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var SEL = '.ab-btn, .ph-btn, .ct-send, .pg-more, .c-btn';
  var css = [
    '.hx{position:relative;overflow:hidden;isolation:isolate;-webkit-tap-highlight-color:transparent}',
    // оттенок: полупрозрачный слой поверх фона кнопки, под текстом
    '.hx::after{content:"";position:absolute;inset:0;z-index:-1;background:var(--hx-tint,rgba(255,255,255,.14));opacity:0;transition:opacity .4s cubic-bezier(.16,1,.3,1);pointer-events:none}',
    // окно подписи: внутри строка, под ней её копия тенью
    '.hx-l{display:inline-block;overflow:hidden;height:1.25em;line-height:1.25;vertical-align:top}',
    '.hx-l>span{display:block;text-shadow:0 1.25em 0 currentColor;transition:transform .55s cubic-bezier(.65,0,.25,1)}',
    // уголки
    // уголок повторяет скругление кнопки: его радиус = радиус кнопки минус отступ от края (концентрично)
    '.hx-c{position:absolute;z-index:1;width:var(--hx-s,8px);height:var(--hx-s,8px);border:1.5px solid currentColor;opacity:.9;pointer-events:none;',
    '  transition:left .6s cubic-bezier(.65,0,.25,1),right .6s cubic-bezier(.65,0,.25,1),transform .6s cubic-bezier(.65,0,.25,1)}',
    '.hx-c1{top:5px;left:5px;border-right:0;border-bottom:0;border-top-left-radius:var(--hx-r,3px)}',
    '.hx-c2{bottom:5px;right:5px;border-left:0;border-top:0;border-bottom-right-radius:var(--hx-r,3px)}',
    '@media(hover:hover){',
    '  .hx:hover::after{opacity:1}',
    '  .hx:hover .hx-l>span{transform:translateY(-1.25em)}',
    '  .hx:hover .hx-c1{left:calc(100% - 5px - var(--hx-s,8px));transform:rotate(90deg)}',
    '  .hx:hover .hx-c2{right:calc(100% - 5px - var(--hx-s,8px));transform:rotate(90deg)}',
    '}',
    '@media(prefers-reduced-motion:reduce){.hx-l>span,.hx-c{transition:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function wrap(btn) {
    if (btn.classList.contains('hx')) return;
    // подпись: первый span с текстом без значков; иначе собираем текстовые узлы в span
    var label = null;
    [].some.call(btn.querySelectorAll('span'), function (s) {
      if (!s.querySelector('svg,img,i') && s.textContent.trim() && !s.closest('.hx-l')) { label = s; return true; }
    });
    if (!label) {
      var nodes = [].filter.call(btn.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (!nodes.length) return;
      label = document.createElement('span');
      btn.insertBefore(label, nodes[0]);
      nodes.forEach(function (n) { label.appendChild(n); });
    }
    var box = document.createElement('span'); box.className = 'hx-l';
    label.parentNode.insertBefore(box, label); box.appendChild(label);
    var c1 = document.createElement('span'), c2 = document.createElement('span');
    c1.className = 'hx-c hx-c1'; c2.className = 'hx-c hx-c2';
    c1.setAttribute('aria-hidden', 'true'); c2.setAttribute('aria-hidden', 'true');
    btn.appendChild(c1); btn.appendChild(c2);
    var r = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 8, cr = Math.max(2, r - 5);
    btn.style.setProperty('--hx-r', cr + 'px'); btn.style.setProperty('--hx-s', Math.round(cr + 4) + 'px');
    btn.classList.add('hx');
  }
  function scan(root) { [].forEach.call((root || document).querySelectorAll(SEL), wrap); }
  window.HX = { scan: scan };

  function boot() {
    scan();
    var t = 0;
    new MutationObserver(function () { if (!t) t = setTimeout(function () { t = 0; scan(); }, 60); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
