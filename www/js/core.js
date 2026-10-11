/* Trazo — núcleo: utilidades, iconos, preferencias, eventos, avisos, menús y diálogos */
'use strict';
(function () {
  const T = (window.T = {});

  T.$ = (s, r) => (r || document).querySelector(s);
  T.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  T.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  T.lerp = (a, b, t) => a + (b - a) * t;

  /* Crea elementos: T.el('button', {class:'x', text:'Hola', onclick: fn}, [hijos]) */
  T.el = function (tag, props, kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      }
    }
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach((k) => k != null && e.append(k));
    return e;
  };

  T.mkCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  T.cloneCanvas = function (src) {
    const c = T.mkCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };
  T.resetCtx = function (x) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.imageSmoothingEnabled = true;
    x.filter = 'none';
  };

  T.debounce = function (fn, ms) {
    let t = 0;
    const d = function () {
      const a = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, a), ms);
    };
    d.flush = function () {
      clearTimeout(t);
      fn();
    };
    d.cancel = () => clearTimeout(t);
    return d;
  };

  /* ---------- Color ---------- */
  T.hexToRgb = function (h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  T.rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => ('0' + T.clamp(Math.round(v), 0, 255).toString(16)).slice(-2)).join('');
  T.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  };
  T.hsvToRgb = function (h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };

  /* ---------- Plataforma ---------- */
  const cap = window.Capacitor;
  T.platform = cap && cap.isNativePlatform && cap.isNativePlatform() ? 'android' : /Electron\//.test(navigator.userAgent) ? 'desktop' : 'web';
  T.isTouchDevice = matchMedia('(pointer: coarse)').matches;
  T.NARROW_MQ = '(max-width: 820px), (max-height: 520px)';
  T.isNarrow = () => matchMedia(T.NARROW_MQ).matches;

  /* ---------- Eventos ---------- */
  const listeners = {};
  T.on = (n, f) => (listeners[n] = listeners[n] || []).push(f);
  T.emit = (n, d) => (listeners[n] || []).slice().forEach((f) => f(d));

  /* ---------- Preferencias (por dispositivo) ---------- */
  const PREF_KEY = 'trazo:prefs:v2';
  const DEFAULTS = {
    penOnly: false, penSeen: false, pressureCurve: 50, longPressPick: true, tapGestures: true,
    rotateGesture: true, showCursor: true, leftHand: false, theme: 'system',
    color: '#1d2433', color2: '#ffffff', recent: [], palette: [],
    tool: 'brush', brushId: 'pen', eraserId: 'e-hard', smudgeId: 's-soft', brushes: {},
    fillTol: 32, fillRef: 'all', fillExpand: 1, gradType: 'linear', gradColors: 'c2t',
    selShape: 'lasso', selMode: 'replace', wandTol: 32, shapeKind: 'line', shapeFill: false, shapeWidth: 4,
    shapeOpacity: 100, gradOpacity: 100, fillOpacity: 100, panelTab: 'brush',
    textFont: 'sans-serif', textSize: 64, textBold: false, textItalic: false, textStroke: 0, textAlign: 'left'
  };
  T.prefs = Object.assign({}, DEFAULTS);
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) Object.assign(T.prefs, JSON.parse(raw));
  } catch (e) { /* sin almacenamiento */ }
  T.savePrefs = T.debounce(function () {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(T.prefs)); } catch (e) { /* ignorar */ }
  }, 400);

  /* ---------- Iconos (trazos de 24×24) ---------- */
  const I = {
    brush: '<path d="M14.5 4.5l5 5L10 19c-1.5 1.5-4 1.8-6 1 .8-2 .3-3.5 1.5-5z"/><path d="M12.5 6.5l5 5"/>',
    pen: '<path d="M12 3l5.5 8L12 21 6.5 11z"/><circle cx="12" cy="11.5" r="1.4"/><path d="M12 13v8"/>',
    eraser: '<path d="M4.5 15.5l9-9 5 5-6.5 6.5H8z"/><path d="M9 11l5 5"/><path d="M12 20h8"/>',
    smudge: '<path d="M9 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M15 11.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.5L5 15.5a1.5 1.5 0 0 1 2.6-1.5L9 15.5"/><path d="M3 5c1.5-1 3-1 4.5 0"/>',
    bucket: '<path d="M5 12l7-7 7 7-6 6a2 2 0 0 1-2.8 0z"/><path d="M5 12h14"/><path d="M20 16c1.2 1.8 1.2 3 0 4-1.2-1-1.2-2.2 0-4z"/>',
    gradient: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 14h16" stroke-dasharray="2 2"/><path d="M8 4v16"/>',
    picker: '<path d="M20 5.5l-2-2a1.8 1.8 0 0 0-2.5 0L12.5 6.5 11 5 9.5 6.5 11 8l-7 7v4h4l7-7 1.5 1.5L18 12l-1.5-1.5 3-3a1.8 1.8 0 0 0 0-2.5z"/>',
    lasso: '<path d="M7 17c-2.5-1.3-4-3.4-4-5.7C3 7.3 7 4 12 4s9 3.3 9 7.3-4 7.2-9 7.2c-1 0-2-.1-2.9-.4"/><circle cx="7.5" cy="18" r="2"/><path d="M7 20c0 1.5-1 2-2 2"/>',
    selrect: '<rect x="4" y="5" width="16" height="14" rx="1" stroke-dasharray="3 2.5"/>',
    wand: '<path d="M4 20L15 9"/><path d="M13 7l2 2"/><path d="M18 3v3M16.5 4.5h3M20 9v2M19 10h2M10 3v2M9 4h2"/>',
    move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    text: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>',
    shapes: '<circle cx="8" cy="8" r="4"/><rect x="11" y="11" width="9" height="9" rx="1"/>',
    line: '<path d="M5 19L19 5"/>',
    rect: '<rect x="5" y="6" width="14" height="12" rx="1"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
    hand: '<path d="M7 13V7.5a1.5 1.5 0 0 1 3 0V12"/><path d="M10 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M13 11V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M16 12.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-3a1.5 1.5 0 0 1 2.5-1.5L7 14"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 7.6C4 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-2 0-3.5 1-1 3-.5 4.5-1A3.5 3.5 0 0 0 21 11c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    clip: '<path d="M6 4v8a4 4 0 0 0 4 4h8"/><path d="M14 12l4 4-4 4"/>',
    merge: '<path d="M7 4v5a5 5 0 0 0 5 5 5 5 0 0 1 5 5v1M17 4v5a5 5 0 0 1-3 4.6"/><path d="M4 17l3 3 3-3"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    flipH: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L3 18h6zM15 6l6 12h-6z"/>',
    flipV: '<path d="M3 12h18" stroke-dasharray="2 2"/><path d="M6 9L18 3v6zM6 15l12 6v-6z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    canvas: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    ruler: '<path d="M12 2v20" stroke-dasharray="2.5 2"/><path d="M9 7c-3 1-4 4-3 7M15 7c3 1 4 4 3 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h13"/><path d="M17 20l4-4-4-4"/><path d="M21 16H8"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    stylus: '<path d="M17 3l4 4-11 11-5 1 1-5z"/><path d="M14 6l4 4"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  T.ICONS = I;
  T.icon = (n, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || '') + '</svg>';
  T.fillIcons = (root) => T.$$('[data-i]', root).forEach((el) => {
    if (!el.querySelector('svg.ic')) el.insertAdjacentHTML('afterbegin', T.icon(el.dataset.i));
  });

  /* ---------- Aviso breve ---------- */
  let toastT = 0;
  T.toast = function (msg, ms) {
    const t = T.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), ms || 2400);
  };

  /* ---------- Menú emergente ---------- */
  let openMenu = null;
  T.closeMenu = function () {
    if (openMenu) { openMenu.remove(); openMenu = null; }
  };
  T.menu = function (anchor, items) {
    T.closeMenu();
    const m = T.el('div', { class: 'menu', role: 'menu' });
    items.forEach((it) => {
      if (!it) return;
      if (it.sep) { m.append(T.el('div', { class: 'msep' })); return; }
      if (it.title) { m.append(T.el('div', { class: 'mtitle', text: it.title })); return; }
      const b = T.el('button', {
        type: 'button', class: 'mitem' + (it.checked ? ' checked' : '') + (it.danger ? ' danger' : ''), role: 'menuitem', disabled: !!it.disabled,
        html: (it.icon ? T.icon(it.icon) : '<span class="ic"></span>') + '<span class="mlabel"></span>' + (it.checked ? T.icon('check', 'mcheck') : '') + (it.hint ? '<span class="mhint"></span>' : '')
      });
      b.querySelector('.mlabel').textContent = it.label;
      if (it.hint) b.querySelector('.mhint').textContent = it.hint;
      b.addEventListener('click', () => { T.closeMenu(); it.action && it.action(); });
      m.append(b);
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    let x = r.left, y = r.bottom + 6;
    if (x + mw > innerWidth - 8) x = innerWidth - 8 - mw;
    if (y + mh > innerHeight - 8) y = Math.max(8, r.top - 6 - mh);
    m.style.left = Math.max(8, x) + 'px';
    m.style.top = y + 'px';
    openMenu = m;
    const f = m.querySelector('.mitem:not([disabled])');
    if (f && !T.isTouchDevice) f.focus({ preventScroll: true });
    return m;
  };
  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !openMenu.contains(e.target)) T.closeMenu();
  }, true);

  /* ---------- Diálogos ---------- */
  T.dialogOpen = 0;
  T.dialog = function (o) {
    const ov = T.el('div', { class: 'overlay' + (o.sheet ? ' sheet' : '') });
    const box = T.el('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' });
    if (o.title) box.append(T.el('h2', { text: o.title }));
    if (o.text) box.append(T.el('p', { class: 'mtext', text: o.text }));
    if (o.body) box.append(o.body);
    const acts = T.el('div', { class: 'actions' });
    let closed = false;
    const api = {
      el: box,
      close(v) {
        if (closed) return;
        closed = true;
        ov.remove();
        T.dialogOpen--;
        o.onClose && o.onClose(v);
      }
    };
    (o.actions || []).forEach((a) => {
      const b = T.el('button', { type: 'button', class: 'btn' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : ''), text: a.label });
      b.addEventListener('click', async () => {
        const r = a.action ? await a.action(api) : undefined;
        if (r !== false) api.close(a.value);
      });
      acts.append(b);
    });
    if (o.actions && o.actions.length) box.append(acts);
    ov.append(box);
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov && o.dismiss !== false) api.close(); });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && o.dismiss !== false) { e.stopPropagation(); api.close(); }
    });
    document.body.append(ov);
    T.dialogOpen++;
    setTimeout(() => {
      const f = box.querySelector('[autofocus]') || box.querySelector('.btn.primary');
      if (f && !T.isTouchDevice) f.focus({ preventScroll: true });
    }, 30);
    return api;
  };
  T.confirm = (title, text, ok, danger) => new Promise((res) => {
    T.dialog({
      title, text, onClose: (v) => res(v === true),
      actions: [{ label: 'Cancelar', value: false }, { label: ok || 'Aceptar', primary: !danger, danger: !!danger, value: true }]
    });
  });
  T.promptText = (title, value, ok) => new Promise((res) => {
    const inp = T.el('input', { type: 'text', class: 'tin', value: value || '', maxlength: '60', autofocus: true, id: 'promptIn' });
    let v = null;
    const d = T.dialog({
      title, body: inp, onClose: () => res(v),
      actions: [{ label: 'Cancelar' }, { label: ok || 'Aceptar', primary: true, action: () => { v = inp.value.trim(); } }]
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { v = inp.value.trim(); d.close(); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  });

  /* ---------- Fila con deslizador ---------- */
  T.slider = function (o) {
    const id = 's' + Math.random().toString(36).slice(2, 8);
    const inp = T.el('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
    const out = T.el('output', { for: id });
    const fmt = o.fmt || ((v) => v + (o.unit || ''));
    const row = T.el('div', { class: 'row' }, [T.el('label', { for: id, text: o.label }), inp, out]);
    out.textContent = fmt(+o.value);
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); o.onInput && o.onInput(+inp.value); });
    inp.addEventListener('change', () => o.onChange && o.onChange(+inp.value));
    row.set = (v) => { inp.value = v; out.textContent = fmt(+v); };
    row.input = inp;
    return row;
  };
  T.check = function (o) {
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    const inp = T.el('input', { type: 'checkbox', id, checked: !!o.value });
    inp.addEventListener('change', () => o.onChange && o.onChange(inp.checked));
    const lab = T.el('label', { class: 'chk', for: id }, [inp, T.el('span', { text: o.label })]);
    lab.input = inp;
    return lab;
  };
  T.seg = function (o) {
    const box = T.el('div', { class: 'seg', role: 'group', 'aria-label': o.label || '' });
    const set = (v) => T.$$('button', box).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === String(v) ? 'true' : 'false'));
    o.options.forEach((op) => {
      const b = T.el('button', { type: 'button', class: 'segb', dataset: { v: op[0] }, title: op[1] });
      b.innerHTML = (op[2] ? T.icon(op[2]) : '') + (op[3] === false ? '' : '<span></span>');
      if (op[3] !== false) b.querySelector('span').textContent = op[1];
      b.addEventListener('click', () => { set(op[0]); o.onChange(op[0]); });
      box.append(b);
    });
    set(o.value);
    box.set = set;
    return box;
  };
})();
