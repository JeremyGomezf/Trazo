/* Trazo — interfaz: barra superior, herramientas, opciones, color, pinceles, capas, menús, ajustes y galería */
'use strict';
(function () {
  const T = window.T, D = T.doc, P = T.prefs, $ = T.$;

  /* ---------- Color ---------- */
  const hsv = { h: 0, s: 0, v: 0 };
  T.setColor = function (hex, keepHsv) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    P.color = hex.toLowerCase();
    if (!keepHsv) {
      const [h, s, v] = T.rgbToHsv(...T.hexToRgb(P.color));
      if (s > 0.001 && v > 0.001) hsv.h = h;
      if (v > 0.001) hsv.s = s;
      hsv.v = v;
    }
    T.savePrefs();
    T.emit('color');
  };
  T.swapColors = function () {
    const a = P.color;
    P.color = P.color2;
    P.color2 = a;
    T.setColor(P.color);
  };
  T.addRecent = function (hex) {
    P.recent = [hex].concat((P.recent || []).filter((c) => c !== hex)).slice(0, 12);
    T.savePrefs();
    T.emit('recent');
  };
  const PALETTE = ['#1d2433', '#ffffff', '#9aa3b2', '#5b6474', '#e5484d', '#f76b15', '#ffc53d', '#8bd448', '#30a46c', '#12a594', '#05a2c2', '#3e63dd', '#6e56cf', '#ab4aba', '#e93d82', '#8d5b3c', '#f2c6a8', '#d9a07a', '#a86b4c', '#5a3826'];

  function buildColorPanel() {
    const box = $('#pColor');
    box.innerHTML = '';
    const c1 = T.el('button', { type: 'button', class: 'chip1', id: 'cPrimary', title: 'Color principal', 'aria-label': 'Color principal' });
    const c2 = T.el('button', { type: 'button', class: 'chip2', id: 'cSecondary', title: 'Color secundario (toca para intercambiar)', 'aria-label': 'Color secundario' });
    const sw = T.el('button', { type: 'button', class: 'ib sm', title: 'Intercambiar colores (X)', 'aria-label': 'Intercambiar colores', html: T.icon('swap') });
    const hex = T.el('input', { type: 'text', id: 'hexIn', class: 'hex', maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Código de color' });
    const sv = T.el('div', { class: 'sv', id: 'svBox' }, [T.el('canvas', { id: 'svCv' }), T.el('div', { class: 'svdot', id: 'svDot' })]);
    const hue = T.el('div', { class: 'hue', id: 'hueBox' }, [T.el('div', { class: 'huedot', id: 'hueDot' })]);
    const mk = (id) => T.el('div', { class: 'swatches', id });
    const addBtn = T.el('button', { type: 'button', class: 'ib sm', title: 'Guardar color en mi paleta', 'aria-label': 'Guardar color en mi paleta', html: T.icon('plus') });
    box.append(
      T.el('div', { class: 'crow' }, [T.el('div', { class: 'chips' }, [c2, c1]), sw, hex]),
      sv, hue,
      T.el('div', { class: 'swl' }, [T.el('span', { text: 'Paleta' })]), mk('palDefault'),
      T.el('div', { class: 'swl' }, [T.el('span', { text: 'Mi paleta' }), addBtn]), mk('palMine'),
      T.el('div', { class: 'swl' }, [T.el('span', { text: 'Recientes' })]), mk('palRecent')
    );
    c2.addEventListener('click', T.swapColors);
    sw.addEventListener('click', T.swapColors);
    hex.addEventListener('change', () => {
      let v = hex.value.trim();
      if (v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
      if (/^#[0-9a-f]{6}$/i.test(v)) T.setColor(v); else hex.value = P.color;
    });
    addBtn.addEventListener('click', () => {
      if (P.palette.indexOf(P.color) < 0) { P.palette.push(P.color); T.savePrefs(); renderSwatches(); T.toast('Color guardado. Mantén presionado un color de tu paleta para quitarlo.'); }
    });
    const pick = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        fn(e);
        const mv = (ev) => fn(ev);
        const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); T.savePrefs(); };
        el.addEventListener('pointermove', mv);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    };
    pick(sv, (e) => {
      const r = sv.getBoundingClientRect();
      hsv.s = T.clamp((e.clientX - r.left) / r.width, 0, 1);
      hsv.v = 1 - T.clamp((e.clientY - r.top) / r.height, 0, 1);
      T.setColor(T.rgbToHex(...T.hsvToRgb(hsv.h, hsv.s, hsv.v)), true);
    });
    pick(hue, (e) => {
      const r = hue.getBoundingClientRect();
      hsv.h = T.clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360;
      T.setColor(T.rgbToHex(...T.hsvToRgb(hsv.h, hsv.s, hsv.v)), true);
    });
    const swClick = (e) => {
      const b = e.target.closest('.sw');
      if (b && b.dataset.hex) T.setColor(b.dataset.hex);
    };
    ['palDefault', 'palMine', 'palRecent'].forEach((id) => $('#' + id).addEventListener('click', swClick));
    let lpT = 0;
    const mine = $('#palMine');
    const removeMine = (b) => {
      P.palette = P.palette.filter((c) => c !== b.dataset.hex);
      T.savePrefs();
      renderSwatches();
      T.toast('Color quitado de tu paleta');
    };
    mine.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.sw');
      if (!b || !b.dataset.hex) return;
      lpT = setTimeout(() => { lpT = 0; removeMine(b); }, 600);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => mine.addEventListener(n, () => clearTimeout(lpT)));
    mine.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const b = e.target.closest('.sw');
      if (b && b.dataset.hex) removeMine(b);
    });
    renderSwatches();
    syncColorUI();
  }
  function swatch(hex) { return T.el('button', { type: 'button', class: 'sw', style: 'background:' + hex, title: hex, 'aria-label': 'Color ' + hex, dataset: { hex } }); }
  function renderSwatches() {
    const fill = (id, list, min) => {
      const b = $('#' + id);
      b.innerHTML = '';
      list.forEach((c) => b.append(swatch(c)));
      for (let i = list.length; i < min; i++) b.append(T.el('span', { class: 'sw empty' }));
    };
    fill('palDefault', PALETTE, 0);
    fill('palMine', P.palette || [], 10);
    fill('palRecent', P.recent || [], 10);
  }
  function drawSV() {
    const cv = $('#svCv'), box = $('#svBox');
    if (!cv || !box.offsetWidth) return;
    const dpr = window.devicePixelRatio || 1, w = Math.round(box.offsetWidth * dpr), h = Math.round(box.offsetHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const x = cv.getContext('2d');
    x.fillStyle = T.rgbToHex(...T.hsvToRgb(hsv.h, 1, 1));
    x.fillRect(0, 0, w, h);
    const g1 = x.createLinearGradient(0, 0, w, 0);
    g1.addColorStop(0, '#fff'); g1.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g1; x.fillRect(0, 0, w, h);
    const g2 = x.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, '#000');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
  }
  let lastHue = -1;
  function syncColorUI() {
    const c1 = $('#cPrimary');
    if (!c1) return;
    c1.style.background = P.color;
    $('#cSecondary').style.background = P.color2;
    const hex = $('#hexIn');
    if (document.activeElement !== hex) hex.value = P.color;
    if (lastHue !== hsv.h) { lastHue = hsv.h; drawSV(); }
    const dot = $('#svDot');
    dot.style.left = hsv.s * 100 + '%';
    dot.style.top = (1 - hsv.v) * 100 + '%';
    dot.style.background = P.color;
    $('#hueDot').style.left = (hsv.h / 360) * 100 + '%';
    const tc = $('#toolColor');
    if (tc) tc.style.background = P.color;
  }
  T.on('color', () => { syncColorUI(); refreshQuick(); });
  T.on('recent', renderSwatches);

  /* ---------- Herramientas ---------- */
  function buildTools() {
    const nav = $('#tools');
    nav.innerHTML = '';
    T.TOOLS.forEach((t) => {
      const b = T.el('button', { type: 'button', class: 'tb', dataset: { tool: t.id }, title: t.name + ' (' + t.key.toUpperCase() + ')', 'aria-label': t.name, 'aria-pressed': 'false', html: T.icon(t.icon) });
      nav.append(b);
    });
    nav.append(T.el('div', { class: 'tsep' }));
    const cbtn = T.el('button', { type: 'button', class: 'tb colorTb', title: 'Color', 'aria-label': 'Color' }, [T.el('span', { class: 'tcolor', id: 'toolColor' })]);
    cbtn.addEventListener('click', () => openPanel('color'));
    nav.append(cbtn);
    nav.addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) T.setTool(b.dataset.tool); });
  }
  T.setTool = function (id) {
    if (!T.TOOL_IMPL[id] && id !== 'hand') return;
    if (T.xf.active && id !== 'move') T.xfCommit();
    const prev = P.tool;
    P.tool = id;
    if (T.isBrushTool(id)) P.lastBrushTool = id;
    T.savePrefs();
    T.$$('#tools [data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === id ? 'true' : 'false'));
    T.stage.dataset.tool = id;
    if (id === 'move' && !T.xf.active && !T.xfBegin()) { T.setTool(prev === 'move' ? 'brush' : prev); return; }
    renderOptbar();
    refreshQuick();
    renderXfBar();
    if (T.isBrushTool(id)) renderBrushPanel();
    T.dirtyOv();
  };

  /* ---------- Barra de opciones ---------- */
  function mini(o) {
    const id = 'm' + Math.random().toString(36).slice(2, 7);
    const inp = T.el('input', { type: 'range', id, min: o.min, max: o.max, value: o.value, step: o.step || 1 });
    const out = T.el('output', { for: id, text: o.value + (o.unit || '') });
    inp.addEventListener('input', () => { out.textContent = inp.value + (o.unit || ''); o.onInput(+inp.value); });
    inp.addEventListener('change', () => T.savePrefs());
    return T.el('div', { class: 'mini' }, [T.el('label', { for: id, text: o.label }), inp, out]);
  }
  const hint = (t) => T.el('span', { class: 'ohint', text: t });
  function renderOptbar() {
    const bar = $('#optbar'), t = P.tool;
    bar.innerHTML = '';
    const add = (...n) => n.forEach((x) => bar.append(x));
    if (T.isBrushTool(t)) {
      const b = T.currentBrush(t);
      const nameBtn = T.el('button', { type: 'button', class: 'obtn', html: T.icon(t === 'eraser' ? 'eraser' : t === 'smudge' ? 'smudge' : 'brush') + '<span></span>' });
      nameBtn.querySelector('span').textContent = b.name;
      nameBtn.addEventListener('click', () => openPanel('brush'));
      const R = T.ruler, rl = { none: 'Sin regla', v: 'Simetría vertical', h: 'Simetría horizontal', quad: 'Simetría cuádruple', radial: (R.mirror ? 'Caleidoscopio ' : 'Radial ') + R.n }[R.mode];
      const rb = T.el('button', { type: 'button', class: 'obtn' + (R.mode !== 'none' ? ' on' : ''), html: T.icon('ruler') + '<span></span>' });
      rb.querySelector('span').textContent = rl;
      rb.addEventListener('click', () => rulerMenu(rb));
      add(nameBtn, rb);
    } else if (t === 'fill') {
      add(T.seg({ label: 'Referencia', value: P.fillRef, options: [['all', 'Todas las capas'], ['layer', 'Capa actual']], onChange: (v) => { P.fillRef = v; T.savePrefs(); } }),
        mini({ label: 'Tolerancia', min: 0, max: 150, value: P.fillTol, onInput: (v) => (P.fillTol = v) }),
        mini({ label: 'Expandir', min: 0, max: 4, value: P.fillExpand, unit: ' px', onInput: (v) => (P.fillExpand = v) }));
    } else if (t === 'gradient') {
      add(T.seg({ label: 'Tipo', value: P.gradType, options: [['linear', 'Lineal'], ['radial', 'Radial']], onChange: (v) => { P.gradType = v; T.savePrefs(); } }),
        T.seg({ label: 'Colores', value: P.gradColors, options: [['c2t', 'Color → transparente'], ['c1c2', 'Color → secundario']], onChange: (v) => { P.gradColors = v; T.savePrefs(); } }));
    } else if (t === 'select') {
      add(T.seg({ label: 'Forma', value: P.selShape, options: [['lasso', 'Lazo', 'lasso'], ['rect', 'Rectángulo', 'selrect'], ['wand', 'Varita', 'wand']], onChange: (v) => { P.selShape = v; T.savePrefs(); renderOptbar(); } }),
        T.seg({ label: 'Modo', value: P.selMode, options: [['replace', 'Nueva'], ['add', 'Añadir'], ['sub', 'Quitar']], onChange: (v) => { P.selMode = v; T.savePrefs(); } }));
      if (P.selShape === 'wand') add(mini({ label: 'Tolerancia', min: 0, max: 150, value: P.wandTol, onInput: (v) => (P.wandTol = v) }));
      const none = T.el('button', { type: 'button', class: 'obtn', html: T.icon('x') + '<span>Quitar selección</span>' });
      none.addEventListener('click', T.selNone);
      add(none);
    } else if (t === 'shape') {
      add(T.seg({ label: 'Forma', value: P.shapeKind, options: [['line', 'Línea', 'line', false], ['rect', 'Rectángulo', 'rect', false], ['ellipse', 'Elipse', 'ellipse', false]], onChange: (v) => { P.shapeKind = v; T.savePrefs(); } }),
        T.check({ label: 'Rellenar', value: P.shapeFill, onChange: (v) => { P.shapeFill = v; T.savePrefs(); } }));
    } else if (t === 'picker') add(hint('Toca el lienzo para tomar un color'));
    else if (t === 'text') add(hint('Toca donde quieras escribir'));
    else if (t === 'hand') add(hint('Arrastra para mover la vista'));
    else if (t === 'move') add(hint('Arrastra para mover · esquinas para escalar · círculo para girar'));
    bar.hidden = !bar.children.length;
  }
  T.renderOptbar = renderOptbar;

  /* ---------- Barra de transformar ---------- */
  function renderXfBar() {
    const bar = $('#xfbar');
    bar.hidden = !T.xf.active;
    $('#optbar').classList.toggle('xfhide', T.xf.active);
    if (!T.xf.active) return;
    if (bar.dataset.built) return;
    bar.dataset.built = '1';
    const b = (icon, label, fn, cls) => {
      const el = T.el('button', { type: 'button', class: 'obtn' + (cls ? ' ' + cls : ''), title: label, html: T.icon(icon) + '<span></span>' });
      el.querySelector('span').textContent = label;
      el.addEventListener('click', fn);
      return el;
    };
    const free = T.check({ label: 'Libre', value: !!P.xfFree, onChange: (v) => { P.xfFree = v; T.savePrefs(); } });
    bar.append(
      b('flipH', 'Voltear', () => T.xfFlip('h')), b('flipV', 'Voltear vertical', () => T.xfFlip('v')),
      b('rotate', 'Girar 90°', T.xfRotate90), free,
      b('x', 'Cancelar', () => { T.xfCancel(); T.setTool(P.lastBrushTool || 'brush'); }),
      b('check', 'Aplicar', () => { T.xfCommit(); T.setTool(P.lastBrushTool || 'brush'); }, 'primary')
    );
  }
  T.on('xf', () => { renderXfBar(); T.dirtyOv(); });

  /* ---------- Deslizadores rápidos (tamaño y opacidad) ---------- */
  const SIZE_MAX = 400;
  const sizeToT = (s) => Math.pow((s - 1) / (SIZE_MAX - 1), 1 / 2.4);
  const tToSize = (t) => Math.max(1, Math.round(1 + (SIZE_MAX - 1) * Math.pow(t, 2.4)));
  function quickModel() {
    const t = P.tool;
    if (T.isBrushTool(t)) {
      const b = T.currentBrush(t);
      return {
        size: b.size, op: b.opacity,
        setSize: (v) => { T.setBrushValue(b, 'size', v); },
        setOp: (v) => { T.setBrushValue(b, 'opacity', v); }
      };
    }
    if (t === 'shape') return { size: P.shapeWidth, op: P.shapeOpacity, setSize: (v) => (P.shapeWidth = v), setOp: (v) => (P.shapeOpacity = v) };
    if (t === 'fill') return { op: P.fillOpacity, setOp: (v) => (P.fillOpacity = v) };
    if (t === 'gradient') return { op: P.gradOpacity, setOp: (v) => (P.gradOpacity = v) };
    return null;
  }
  function vslider(kind) {
    const el = T.el('div', { class: 'vs', role: 'slider', tabindex: '0', 'aria-label': kind === 'size' ? 'Tamaño' : 'Opacidad' }, [
      T.el('div', { class: 'vfill' }), T.el('div', { class: 'vknob' }), T.el('div', { class: 'vval' }), T.el('div', { class: 'vcap' })
    ]);
    const set = (t, commit) => {
      const m = quickModel();
      if (!m) return;
      t = T.clamp(t, 0, 1);
      if (kind === 'size') m.setSize(tToSize(t)); else m.setOp(Math.max(1, Math.round(t * 100)));
      refreshQuick();
      if (kind === 'size') showSizePreview(!commit);
      if (commit) { T.savePrefs(); if (T.isBrushTool(P.tool)) renderBrushSettings(); }
    };
    const fromEv = (e) => { const r = el.getBoundingClientRect(); return 1 - (e.clientY - r.top) / r.height; };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      set(fromEv(e));
      const mv = (ev) => set(fromEv(ev));
      const up = (ev) => { el.classList.remove('drag'); set(fromEv(ev), true); el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', (e) => {
      const m = quickModel();
      if (!m) return;
      const d = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      if (kind === 'size') m.setSize(T.clamp(Math.round(m.size + d * Math.max(1, m.size * 0.08)), 1, SIZE_MAX)); else m.setOp(T.clamp(m.op + d * 5, 1, 100));
      refreshQuick();
      T.savePrefs();
    });
    el.kind = kind;
    return el;
  }
  function buildQuick() {
    const q = $('#quick');
    q.innerHTML = '';
    q.append(vslider('size'), vslider('op'));
    q.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  function refreshQuick() {
    const q = $('#quick');
    const m = quickModel();
    q.hidden = !m;
    if (!m) return;
    const [s, o] = q.children;
    s.hidden = m.size == null;
    if (m.size != null) {
      const t = sizeToT(m.size);
      s.querySelector('.vfill').style.height = t * 100 + '%';
      s.querySelector('.vknob').style.bottom = t * 100 + '%';
      s.querySelector('.vval').textContent = m.size + ' px';
      s.querySelector('.vcap').textContent = m.size;
      s.setAttribute('aria-valuenow', m.size);
    }
    o.querySelector('.vfill').style.height = m.op + '%';
    o.querySelector('.vknob').style.bottom = m.op + '%';
    o.querySelector('.vval').textContent = m.op + '%';
    o.querySelector('.vcap').textContent = m.op + '%';
    o.setAttribute('aria-valuenow', m.op);
    o.style.setProperty('--qc', P.color);
  }
  T.refreshQuick = refreshQuick;
  let prevT = 0;
  function showSizePreview(on) {
    const c = $('#sizePrev'), m = quickModel();
    clearTimeout(prevT);
    if (!m || m.size == null) return;
    const d = Math.max(4, m.size * T.view.s);
    c.style.width = c.style.height = d + 'px';
    c.hidden = false;
    if (!on) prevT = setTimeout(() => (c.hidden = true), 500);
  }

  /* ---------- Panel lateral ---------- */
  function openPanel(tab) {
    if (tab) setTab(tab);
    if (T.isNarrow()) $('#panel').classList.add('open');
  }
  T.openPanel = openPanel;
  T.closeSheet = () => $('#panel').classList.remove('open');
  function setTab(tab) {
    if (tab === 'color' && !T.isNarrow()) tab = P.panelTab === 'color' ? 'brush' : P.panelTab;
    P.panelTab = tab;
    T.savePrefs();
    T.$$('.ptabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    $('#panel').dataset.tab = tab;
    if (tab === 'color') requestAnimationFrame(() => { lastHue = -1; syncColorUI(); });
    if (tab === 'brush') renderBrushPanel();
    if (tab === 'layers') renderLayers();
  }

  /* ---------- Pinceles ---------- */
  function brushTool() { return T.isBrushTool(P.tool) ? P.tool : P.lastBrushTool || 'brush'; }
  function renderBrushPanel() {
    const box = $('#pBrush');
    if (!box) return;
    const tool = brushTool(), list = T.brushListFor(tool), cur = T.currentBrush(tool);
    box.innerHTML = '';
    const tabs = T.seg({
      label: 'Tipo de pincel', value: tool,
      options: [['brush', 'Pinceles', 'brush'], ['eraser', 'Borradores', 'eraser'], ['smudge', 'Difuminar', 'smudge']],
      onChange: (v) => T.setTool(v)
    });
    tabs.classList.add('full');
    const ul = T.el('div', { class: 'blist', role: 'listbox', 'aria-label': 'Pinceles' });
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222';
    list.forEach((b0) => {
      const b = T.brushCfg(b0);
      const cv = T.mkCanvas(300, 64);
      cv.className = 'bprev';
      T.drawBrushPreview(cv, b, ink, tool === 'eraser' ? 'erase' : 'paint');
      const row = T.el('button', { type: 'button', class: 'brow' + (b.id === cur.id ? ' on' : ''), role: 'option', 'aria-selected': b.id === cur.id ? 'true' : 'false' }, [cv, T.el('span', { class: 'bname', text: b.name }), T.el('span', { class: 'bsize', text: b.size + ' px' })]);
      row.addEventListener('click', () => { P[T.brushKey(tool)] = b.id; T.savePrefs(); renderBrushPanel(); renderOptbar(); refreshQuick(); });
      ul.append(row);
    });
    box.append(tabs, ul, T.el('div', { id: 'brushSettings' }));
    renderBrushSettings();
  }
  function renderBrushSettings() {
    const box = $('#brushSettings');
    if (!box) return;
    const tool = brushTool(), b = T.currentBrush(tool);
    box.innerHTML = '';
    const upd = (k) => (v) => { T.setBrushValue(b, k, v); refreshQuick(); };
    const rows = [
      T.el('h3', { text: 'Ajustes de ' + b.name }),
      T.slider({ label: 'Tamaño', min: 1, max: SIZE_MAX, value: b.size, unit: ' px', onInput: upd('size') }),
      T.slider({ label: tool === 'smudge' ? 'Fuerza' : 'Opacidad', min: 1, max: 100, value: b.opacity, unit: '%', onInput: upd('opacity') }),
      T.slider({ label: 'Estabilizador', min: 0, max: 100, value: b.stab, unit: '%', onInput: upd('stab') }),
      T.slider({ label: 'Dureza', min: 0, max: 100, value: Math.round(b.hard * 100), unit: '%', onInput: (v) => upd('hard')(v / 100) }),
      T.slider({ label: 'Espaciado', min: 2, max: 200, value: Math.round(b.spacing * 100), unit: '%', onInput: (v) => upd('spacing')(v / 100) }),
      T.slider({ label: 'Presión → tamaño', min: 0, max: 100, value: Math.round(b.sizeP * 100), unit: '%', onInput: (v) => upd('sizeP')(v / 100) }),
      T.slider({ label: 'Presión → opacidad', min: 0, max: 100, value: Math.round(b.alphaP * 100), unit: '%', onInput: (v) => upd('alphaP')(v / 100) })
    ];
    if (b.flowMode === 'build') rows.push(T.slider({ label: 'Flujo', min: 1, max: 50, value: Math.round((b.flow || 0.07) * 100), unit: '%', onInput: (v) => upd('flow')(v / 100) }));
    if (b.kind === 'mix') rows.push(T.slider({ label: 'Mezcla con lo pintado', min: 0, max: 100, value: Math.round((b.mix == null ? 0.55 : b.mix) * 100), unit: '%', onInput: (v) => upd('mix')(v / 100) }));
    if (b.roundness) {
      rows.push(T.slider({ label: 'Forma de la punta', min: 10, max: 100, value: Math.round(b.roundness * 100), unit: '%', onInput: (v) => upd('roundness')(v / 100) }));
      if (!b.follow) rows.push(T.slider({ label: 'Ángulo de la punta', min: 0, max: 180, value: b.angle || 0, unit: '°', onInput: upd('angle') }));
    }
    rows.push(T.check({ label: 'Afinar inicio y final (sin lápiz con presión)', value: !!b.taper, onChange: upd('taper') }));
    const reset = T.el('button', { type: 'button', class: 'btn ghost', text: 'Restablecer este pincel' });
    reset.addEventListener('click', () => { T.resetBrush(b); renderBrushPanel(); refreshQuick(); });
    rows.push(reset);
    rows.forEach((r) => box.append(r));
    box.querySelectorAll('input[type=range]').forEach((i) => i.addEventListener('change', () => { const l = $('.blist .brow.on .bprev'); if (l) T.drawBrushPreview(l, T.currentBrush(tool), getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), 'paint'); const sz = $('.blist .brow.on .bsize'); if (sz) sz.textContent = T.currentBrush(tool).size + ' px'; }));
  }

  /* ---------- Capas ---------- */
  const thumbs = new Map();
  function drawThumb(L) {
    const t = thumbs.get(L.id);
    if (!t) return;
    const x = t.getContext('2d'), W = t.width, H = t.height;
    x.clearRect(0, 0, W, H);
    const s = Math.min(W / D.w, H / D.h), w = D.w * s, h = D.h * s;
    x.imageSmoothingQuality = 'high';
    x.drawImage(L.canvas, (W - w) / 2, (H - h) / 2, w, h);
  }
  let thumbQ = new Set(), thumbRaf = 0;
  T.on('layerpx', (L) => {
    thumbQ.add(L);
    if (!thumbRaf) thumbRaf = requestAnimationFrame(() => { thumbRaf = 0; thumbQ.forEach(drawThumb); thumbQ.clear(); });
  });
  function renderLayers() {
    const box = $('#pLayers');
    if (!box || !D.layers.length) return;
    box.innerHTML = '';
    thumbs.clear();
    const A = T.active();
    const head = T.el('div', { class: 'lhead' });
    const mkb = (icon, label, fn, dis) => {
      const b = T.el('button', { type: 'button', class: 'ib sm', title: label, 'aria-label': label, disabled: !!dis, html: T.icon(icon) });
      b.addEventListener('click', fn);
      return b;
    };
    const ai = T.layerIndex(A);
    head.append(
      T.el('h3', { text: 'Capas · ' + D.layers.length }),
      T.el('div', { class: 'grp' }, [
        mkb('plus', 'Capa nueva', () => T.addLayer()),
        mkb('copy', 'Duplicar capa', () => T.duplicateLayer(A)),
        mkb('up', 'Subir capa', () => T.moveLayer(A, 1), ai >= D.layers.length - 1),
        mkb('down', 'Bajar capa', () => T.moveLayer(A, -1), ai <= 0),
        mkb('merge', 'Combinar con la de abajo', () => T.mergeDown(A), ai <= 0),
        mkb('more', 'Más opciones de capa', (e) => layerMenu(e.currentTarget, A))
      ])
    );
    const ul = T.el('ul', { class: 'llist' });
    for (let i = D.layers.length - 1; i >= 0; i--) {
      const L = D.layers[i];
      const eye = T.el('button', { type: 'button', class: 'ib sm leye', 'aria-label': L.visible ? 'Ocultar capa' : 'Mostrar capa', html: T.icon(L.visible ? 'eye' : 'eyeoff') });
      eye.addEventListener('click', (e) => { e.stopPropagation(); T.setLayerProps(L, { visible: !L.visible }); });
      const th = T.mkCanvas(64, 48);
      th.className = 'lthumb';
      thumbs.set(L.id, th);
      const meta = [T.blendName(L.blend), Math.round(L.opacity * 100) + '%'];
      const info = T.el('div', { class: 'linfo' }, [T.el('span', { class: 'lname', text: L.name }), T.el('span', { class: 'lmeta', text: meta.join(' · ') })]);
      const flags = T.el('span', { class: 'lflags', html: (L.text ? T.icon('text') : '') + (L.lockAlpha ? T.icon('lock') : '') });
      const li = T.el('li', { class: 'lrow' + (L.id === A.id ? ' on' : '') + (L.clip ? ' clipped' : '') + (L.visible ? '' : ' hiddenL'), tabindex: '0' }, [L.clip ? T.el('span', { class: 'lclip', html: T.icon('clip') }) : null, eye, th, info, flags]);
      li.addEventListener('click', () => { if (D.activeId !== L.id) { D.activeId = L.id; renderLayers(); T.emit('active'); } });
      li.addEventListener('dblclick', () => (L.text ? T.textDialog({ x: L.text.cx, y: L.text.cy }, L) : renameLayer(L)));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') li.click(); });
      ul.append(li);
      drawThumb(L);
    }
    const blend = T.el('select', { class: 'tin', id: 'lBlend', 'aria-label': 'Modo de fusión' }, T.BLENDS.map((b) => T.el('option', { value: b[0], text: b[1], selected: b[0] === A.blend })));
    blend.addEventListener('change', () => T.setLayerProps(A, { blend: blend.value }));
    let before = null;
    const op = T.slider({
      label: 'Opacidad', min: 0, max: 100, value: Math.round(A.opacity * 100), unit: '%',
      onInput: (v) => { if (!before) before = { opacity: A.opacity }; A.opacity = v / 100; T.dirty(); },
      onChange: (v) => { const b = before || { opacity: A.opacity }; before = null; T.setLayerProps(A, { opacity: v / 100 }, b); }
    });
    const props = T.el('div', { class: 'lprops' }, [
      T.el('div', { class: 'row' }, [T.el('label', { for: 'lBlend', text: 'Fusión' }), blend]),
      op,
      T.el('div', { class: 'two' }, [
        T.check({ label: 'Recorte (clipping)', value: A.clip, onChange: (v) => T.setLayerProps(A, { clip: v }) }),
        T.check({ label: 'Bloquear alfa', value: A.lockAlpha, onChange: (v) => T.setLayerProps(A, { lockAlpha: v }) })
      ])
    ]);
    box.append(head, ul, props);
  }
  T.renderLayers = renderLayers;
  T.on('layers', () => { if (!T.$('#app').hidden) renderLayers(); });
  T.on('active', () => T.dirtyOv());
  async function renameLayer(L) {
    const n = await T.promptText('Nombre de la capa', L.name, 'Guardar');
    if (n) T.setLayerProps(L, { name: n.slice(0, 60) });
  }
  function layerMenu(anchor, L) {
    T.menu(anchor, [
      L.text ? { label: 'Editar texto', icon: 'text', action: () => T.textDialog({ x: L.text.cx, y: L.text.cy }, L) } : null,
      { label: 'Renombrar', icon: 'text', action: () => renameLayer(L) },
      { label: 'Rellenar con el color actual', icon: 'bucket', action: () => T.fillLayer(L, P.color) },
      { label: 'Seleccionar contenido', icon: 'lasso', action: () => T.selFromLayer(L) },
      { label: 'Borrar contenido', icon: 'eraser', action: () => T.clearLayer(L) },
      { label: 'Transformar capa', icon: 'move', action: () => T.setTool('move') },
      { sep: true },
      { label: 'Eliminar capa', icon: 'trash', danger: true, disabled: D.layers.length < 2, action: () => T.deleteLayer(L) }
    ]);
  }

  /* ---------- Menús de la barra superior ---------- */
  function rulerMenu(anchor) {
    const R = T.ruler;
    const set = (mode, n, mirror) => () => { Object.assign(R, { mode, n: n || R.n, mirror: !!mirror }); renderOptbar(); T.dirtyOv(); if (mode !== 'none' && !T.isBrushTool(P.tool)) T.setTool(P.lastBrushTool || 'brush'); };
    T.menu(anchor, [
      { title: 'Regla de simetría (pinceles)' },
      { label: 'Sin regla', checked: R.mode === 'none', action: set('none') },
      { label: 'Simetría vertical', checked: R.mode === 'v', action: set('v') },
      { label: 'Simetría horizontal', checked: R.mode === 'h', action: set('h') },
      { label: 'Simetría cuádruple', checked: R.mode === 'quad', action: set('quad') },
      { label: 'Radial 4', checked: R.mode === 'radial' && R.n === 4 && !R.mirror, action: set('radial', 4) },
      { label: 'Radial 6', checked: R.mode === 'radial' && R.n === 6 && !R.mirror, action: set('radial', 6) },
      { label: 'Radial 8', checked: R.mode === 'radial' && R.n === 8 && !R.mirror, action: set('radial', 8) },
      { label: 'Radial 12', checked: R.mode === 'radial' && R.n === 12 && !R.mirror, action: set('radial', 12) },
      { label: 'Caleidoscopio 6', checked: R.mode === 'radial' && R.mirror && R.n === 6, action: set('radial', 6, true) },
      { label: 'Caleidoscopio 8', checked: R.mode === 'radial' && R.mirror && R.n === 8, action: set('radial', 8, true) },
      { sep: true },
      { label: 'Centrar la regla', icon: 'fit', disabled: R.mode === 'none', action: () => { R.cx = R.cy = null; T.dirtyOv(); } },
      { title: 'Arrastra el punto central para moverla' }
    ]);
  }
  T.rulerMenu = rulerMenu;
  function canvasMenu(anchor) {
    T.menu(anchor, [
      { label: 'Tamaño del lienzo…', icon: 'canvas', action: resizeDialog },
      { label: 'Recortar a la selección', icon: 'selrect', disabled: !T.sel.active, action: T.cropToSelection },
      { label: 'Girar 90° a la derecha', icon: 'rotate', action: () => T.transformCanvas('cw') },
      { label: 'Girar 90° a la izquierda', icon: 'undo', action: () => T.transformCanvas('ccw') },
      { label: 'Voltear horizontal', icon: 'flipH', action: () => T.transformCanvas('flipH') },
      { label: 'Voltear vertical', icon: 'flipV', action: () => T.transformCanvas('flipV') },
      { sep: true },
      { label: 'Usar color actual como papel', icon: 'palette', action: () => T.setDocProps({ bg: P.color, transparent: false }) },
      { label: 'Fondo transparente', checked: D.transparent, action: () => T.setDocProps({ transparent: !D.transparent }) },
      { sep: true },
      { label: 'Importar imagen como capa…', icon: 'image', action: () => pickFile('image/*', (f) => importLayerFile(f)) },
      { label: 'Foto como capa (cámara o galería)…', icon: 'camera', action: () => setTimeout(() => photoMenu(anchor, 'layer'), 0) },
      { label: 'Renombrar dibujo…', icon: 'text', action: renameDoc }
    ]);
  }
  function selectMenu(anchor) {
    const has = T.sel.active;
    T.menu(anchor, [
      { label: 'Herramienta de selección', icon: 'lasso', action: () => T.setTool('select') },
      { sep: true },
      { label: 'Seleccionar todo', hint: 'Ctrl+A', action: T.selAll },
      { label: 'Quitar selección', hint: 'Ctrl+D', disabled: !has, action: T.selNone },
      { label: 'Invertir selección', hint: 'Ctrl+Shift+I', action: T.selInvert },
      { label: 'Seleccionar contenido de la capa', action: () => T.selFromLayer(T.active()) },
      { sep: true },
      { label: 'Rellenar con el color actual', icon: 'bucket', disabled: !has, action: () => T.fillLayer(T.active(), P.color) },
      { label: 'Borrar lo seleccionado', icon: 'eraser', disabled: !has, action: () => T.clearLayer(T.active()) },
      { label: 'Copiar a una capa nueva', icon: 'copy', disabled: !has, action: () => selToLayer(false) },
      { label: 'Cortar a una capa nueva', icon: 'layers', disabled: !has, action: () => selToLayer(true) },
      { label: 'Mover o escalar lo seleccionado', icon: 'move', disabled: !has, action: () => T.setTool('move') }
    ]);
  }
  function selToLayer(cut) {
    const A = T.active(), c = T.cloneCanvas(A.canvas), x = c.getContext('2d');
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(T.sel.mask, 0, 0);
    if (cut) T.clearLayer(A);
    T.addLayer({ canvas: c, name: (cut ? 'Recorte de ' : 'Copia de ') + A.name });
  }
  function filterMenu(anchor) {
    T.menu(anchor, [{ title: 'Se aplica a la capa actual' }].concat(T.FILTERS.map((f) => ({ label: f.name, action: () => T.openFilter(f) }))));
  }
  function viewMenu(anchor) {
    T.menu(anchor, [
      { label: 'Ajustar a la pantalla', icon: 'fit', hint: '0', action: T.fitView },
      { label: 'Tamaño real (100%)', hint: '1', action: () => T.setZoom(1) },
      { label: 'Girar vista 15° izquierda', icon: 'undo', action: () => T.setRotation(T.view.r - Math.PI / 12) },
      { label: 'Girar vista 15° derecha', icon: 'redo', action: () => T.setRotation(T.view.r + Math.PI / 12) },
      { label: 'Quitar giro de la vista', disabled: !T.view.r, action: () => T.setRotation(0) },
      { label: 'Vista en espejo', icon: 'flipH', checked: T.view.flip, hint: 'M', action: T.toggleFlipView },
      { sep: true },
      { label: 'Pantalla completa', action: toggleFullscreen }
    ]);
  }
  function moreMenu(anchor) {
    T.menu(anchor, [
      { label: 'Lienzo', icon: 'canvas', action: () => setTimeout(() => canvasMenu(anchor), 0) },
      { label: 'Selección', icon: 'selrect', action: () => setTimeout(() => selectMenu(anchor), 0) },
      { label: 'Filtros', icon: 'sparkle', action: () => setTimeout(() => filterMenu(anchor), 0) },
      { label: 'Regla de simetría', icon: 'ruler', action: () => setTimeout(() => rulerMenu(anchor), 0) },
      { label: 'Vista', icon: 'fit', action: () => setTimeout(() => viewMenu(anchor), 0) },
      { sep: true },
      { label: 'Ajustes y lápiz', icon: 'gear', action: settingsDialog }
    ]);
  }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => T.toast('Pantalla completa no disponible aquí'));
    } catch (e) { T.toast('Pantalla completa no disponible aquí'); }
  }

  /* ---------- Diálogos ---------- */
  function resizeDialog() {
    let mode = 'scale', keep = true;
    const w = T.el('input', { type: 'number', class: 'tin num', id: 'rsW', min: '16', max: '8192', value: D.w, 'aria-label': 'Ancho' });
    const h = T.el('input', { type: 'number', class: 'tin num', id: 'rsH', min: '16', max: '8192', value: D.h, 'aria-label': 'Alto' });
    const ratio = D.w / D.h;
    w.addEventListener('input', () => { if (keep) h.value = Math.round(+w.value / ratio); });
    h.addEventListener('input', () => { if (keep) w.value = Math.round(+h.value * ratio); });
    const body = T.el('div', { class: 'stack' }, [
      T.seg({ label: 'Modo', value: mode, options: [['scale', 'Escalar la imagen'], ['canvas', 'Ampliar o recortar el lienzo']], onChange: (v) => (mode = v) }),
      T.el('div', { class: 'dims' }, [w, T.el('span', { text: '×' }), h, T.el('span', { text: 'px' })]),
      T.check({ label: 'Mantener proporción', value: true, onChange: (v) => (keep = v) }),
      T.el('p', { class: 'note', text: 'En "Ampliar o recortar" el dibujo queda centrado.' })
    ]);
    T.dialog({
      title: 'Tamaño del lienzo', body, actions: [
        { label: 'Cancelar' },
        {
          label: 'Aplicar', primary: true, action: () => {
            const nw = T.clamp(Math.round(+w.value), 16, 8192), nh = T.clamp(Math.round(+h.value), 16, 8192);
            if (nw === D.w && nh === D.h) return;
            T.resizeCanvas(nw, nh, mode);
          }
        }
      ]
    });
  }
  async function renameDoc() {
    const n = await T.promptText('Nombre del dibujo', D.name, 'Guardar');
    if (n) T.renameCurrent(n.slice(0, 60));
  }
  T.renameDoc = renameDoc;

  function exportDialog() {
    if (T.xf.active) T.xfCommit();
    let scale = 1;
    const img = T.el('img', { class: 'expimg', alt: 'Vista previa del dibujo' });
    const setPrev = () => {
      const c = T.composite(D.transparent, Math.min(1, 900 / Math.max(D.w, D.h)));
      if (P.watermark !== false) T.drawWatermark(c);
      img.src = c.toDataURL('image/png');
    };
    setPrev();
    const sizeLbl = T.el('span', { class: 'note', text: D.w + ' × ' + D.h + ' px' });
    const scaleSeg = T.seg({
      label: 'Escala', value: '1', options: [['1', '1×'], ['2', '2×'], ['0.5', '½']],
      onChange: (v) => { scale = +v; sizeLbl.textContent = Math.round(D.w * scale) + ' × ' + Math.round(D.h * scale) + ' px'; }
    });
    const doIt = async (kind, share) => {
      T.toast('Preparando archivo…');
      const blob = await T.exportBlob(kind, kind === 'project' ? 1 : scale);
      const name = T.exportName(kind);
      if (share) await T.shareFile(name, blob); else await T.saveFile(name, blob);
    };
    const btn = (label, kind, primary, share) => {
      const b = T.el('button', { type: 'button', class: 'btn' + (primary ? ' primary' : ''), text: label });
      b.addEventListener('click', () => doIt(kind, share));
      return b;
    };
    const wm = T.check({ label: 'Marca de agua (Trazo · ' + T.AUTHOR + ')', value: P.watermark !== false, onChange: (v) => { P.watermark = v; T.savePrefs(); setPrev(); } });
    const body = T.el('div', { class: 'stack' }, [
      img,
      T.el('div', { class: 'two' }, [scaleSeg, sizeLbl]),
      wm,
      T.el('div', { class: 'expgrid' }, [
        btn('Imagen PNG', 'png', true), btn('PNG transparente', 'png-t'), btn('JPG', 'jpg'), btn('Proyecto con capas (.trazo)', 'project'),
        T.canShare() ? btn('Compartir…', 'png', false, true) : null
      ]),
      T.el('p', { class: 'note', text: T.platform === 'android' ? 'Los archivos se guardan en Documentos/Trazo. Con "Compartir" puedes mandarlos a la galería, WhatsApp o Drive.' : 'El proyecto .trazo guarda todas las capas para seguir editando en otro dispositivo.' })
    ]);
    T.dialog({ title: 'Guardar y exportar', body, wide: true, actions: [{ label: 'Cerrar' }] });
  }
  T.exportDialog = exportDialog;

  function settingsDialog() {
    const pad = T.el('canvas', { class: 'pentest', id: 'penTest', width: '600', height: '160' });
    const read = T.el('p', { class: 'note', id: 'penRead', text: 'Dibuja en el recuadro para probar tu lápiz.' });
    const body = T.el('div', { class: 'stack' }, [
      T.el('h3', { text: 'Lápiz óptico' }),
      T.check({ label: 'Solo lápiz: los dedos mueven y hacen zoom, no dibujan (rechazo de palma)', value: P.penOnly, onChange: (v) => { P.penOnly = v; T.savePrefs(); } }),
      T.slider({ label: 'Curva de presión', min: 0, max: 100, value: P.pressureCurve, fmt: (v) => (v < 40 ? 'Suave' : v > 60 ? 'Firme' : 'Normal'), onInput: (v) => { P.pressureCurve = v; T.savePrefs(); } }),
      pad, read,
      T.el('h3', { text: 'Gestos' }),
      T.check({ label: 'Tocar con dos dedos deshace, con tres rehace', value: P.tapGestures, onChange: (v) => { P.tapGestures = v; T.savePrefs(); } }),
      T.check({ label: 'Mantener el dedo quieto activa el cuentagotas', value: P.longPressPick, onChange: (v) => { P.longPressPick = v; T.savePrefs(); } }),
      T.check({ label: 'Girar el lienzo con dos dedos', value: P.rotateGesture, onChange: (v) => { P.rotateGesture = v; T.savePrefs(); } }),
      T.el('h3', { text: 'Interfaz' }),
      T.check({ label: 'Mostrar el contorno del pincel', value: P.showCursor, onChange: (v) => { P.showCursor = v; T.savePrefs(); } }),
      T.check({ label: 'Modo zurdo (barras de tamaño a la derecha)', value: P.leftHand, onChange: (v) => { P.leftHand = v; T.savePrefs(); applyHand(); } }),
      T.seg({ label: 'Tema', value: P.theme, options: [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']], onChange: (v) => { P.theme = v; T.savePrefs(); applyTheme(); } }),
      T.el('h3', { text: 'Acerca de' }),
      T.el('p', { class: 'credit', text: 'Trazo, creado por ' + T.AUTHOR + '.' }),
      T.el('p', { class: 'note', text: 'Versión 1.1 · ' + ({ android: 'Android', desktop: 'Escritorio', web: 'Web' }[T.platform]) + ' · Atajos: B pincel, E borrador, S difuminar, G relleno, I cuentagotas, L selección, V transformar, T texto, [ ] tamaño, X intercambiar colores, M espejo, Espacio mover vista.' })
    ]);
    T.dialog({ title: 'Ajustes', body, wide: true, actions: [{ label: 'Listo', primary: true }] });
    setupPenTest(pad, read);
  }
  T.settingsDialog = settingsDialog;
  function setupPenTest(cv, out) {
    const x = cv.getContext('2d');
    let last = null;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); last = null; x.clearRect(0, 0, cv.width, cv.height); draw(e); });
    cv.addEventListener('pointermove', (e) => { if (e.buttons) draw(e); else show(e); });
    cv.addEventListener('pointerup', () => (last = null));
    function show(e) {
      const tipo = { pen: 'Lápiz', touch: 'Dedo', mouse: 'Mouse' }[e.pointerType] || e.pointerType;
      out.textContent = 'Tipo: ' + tipo + ' · Presión: ' + (e.pressure || 0).toFixed(2) + ' · Inclinación: ' + (e.tiltX || 0) + '° / ' + (e.tiltY || 0) + '°' + (e.pointerType === 'pen' && e.buttons & 32 ? ' · Goma del lápiz' : '');
    }
    function draw(e) {
      show(e);
      const r = cv.getBoundingClientRect(), k = cv.width / r.width;
      const p = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
      const pr = e.pointerType === 'pen' ? T.pressure({ hasPressure: true, pressure: e.pressure }) : 1;
      const w = 1 + pr * 14;
      x.strokeStyle = ink;
      x.lineCap = 'round';
      x.lineWidth = w;
      x.beginPath();
      x.moveTo((last || p).x, (last || p).y);
      x.lineTo(p.x, p.y);
      x.stroke();
      last = p;
    }
  }
  function applyTheme() {
    if (P.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = P.theme;
    const dark = P.theme === 'dark' || (P.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = dark ? '#14171d' : '#f3f4f7';
  }
  function applyHand() { $('#app').classList.toggle('lefty', !!P.leftHand); }

  /* ---------- Archivos ---------- */
  function pickFile(accept, fn) {
    const inp = $('#fileIn');
    inp.value = '';
    if (accept) inp.setAttribute('accept', accept); else inp.removeAttribute('accept');
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) fn(f); };
    inp.click();
  }
  T.pickFile = pickFile;
  async function fileToImage(f) {
    const u = URL.createObjectURL(f);
    try { return await T.loadImage(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 2000); }
  }
  async function importLayerFile(f) {
    try { T.importAsLayer(await fileToImage(f), f.name.replace(/\.[^.]+$/, '').slice(0, 30)); }
    catch (e) { T.toast('No se pudo abrir esa imagen'); }
  }
  T.importLayerFile = importLayerFile;
  T.importAnyFile = async function (f) {
    try {
      if (/\.(trazo|json)$/i.test(f.name) || f.type === 'application/json') { await T.importProject(JSON.parse(await f.text())); T.toast('Proyecto abierto'); return; }
      if (f.type.indexOf('image/') === 0 || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) {
        const im = await fileToImage(f);
        const k = Math.min(1, T.maxCanvas() / Math.max(im.naturalWidth, im.naturalHeight));
        await T.newArtwork(Math.round(im.naturalWidth * k), Math.round(im.naturalHeight * k), { image: im, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
        return;
      }
      T.toast('Ese tipo de archivo no se puede abrir. Usa una imagen o un proyecto .trazo');
    } catch (e) { console.error(e); T.toast('No se pudo abrir el archivo'); }
  };

  /* ---------- Galería ---------- */
  const thumbUrls = [];
  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    return new Date(t).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  async function renderGallery() {
    const grid = $('#gGrid');
    thumbUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    const list = await T.dbList();
    grid.innerHTML = '';
    $('#gEmpty').hidden = list.length > 0;
    $('#gCount').textContent = list.length ? list.length + (list.length === 1 ? ' dibujo' : ' dibujos') : '';
    list.forEach((m) => {
      const u = m.thumb ? URL.createObjectURL(m.thumb) : '';
      if (u) thumbUrls.push(u);
      const more = T.el('button', { type: 'button', class: 'ib sm gmore', 'aria-label': 'Opciones de ' + m.name, html: T.icon('more') });
      const card = T.el('article', { class: 'gcard' }, [
        T.el('button', { type: 'button', class: 'gopen', 'aria-label': 'Abrir ' + m.name }, [
          T.el('div', { class: 'gthumb', style: 'aspect-ratio:' + m.w + '/' + m.h }, u ? [T.el('img', { src: u, alt: '' })] : null)
        ]),
        T.el('div', { class: 'gfoot' }, [
          T.el('div', { class: 'ginfo' }, [T.el('span', { class: 'gname', text: m.name }), T.el('span', { class: 'gmeta', text: m.w + '×' + m.h + ' · ' + ago(m.updated) })]),
          more
        ])
      ]);
      card.querySelector('.gopen').addEventListener('click', () => T.openArtwork(m.id));
      more.addEventListener('click', () => T.menu(more, [
        { label: 'Abrir', icon: 'brush', action: () => T.openArtwork(m.id) },
        { label: 'Renombrar', icon: 'text', action: async () => { const n = await T.promptText('Nombre del dibujo', m.name, 'Guardar'); if (n) { await T.renameArtwork(m.id, n.slice(0, 60)); renderGallery(); } } },
        { label: 'Duplicar', icon: 'copy', action: async () => { await T.duplicateArtwork(m.id); renderGallery(); } },
        { label: 'Exportar…', icon: 'share', action: async () => { if (await T.openArtwork(m.id)) setTimeout(exportDialog, 120); } },
        { sep: true },
        { label: 'Eliminar', icon: 'trash', danger: true, action: async () => { if (await T.confirm('¿Eliminar "' + m.name + '"?', 'Se borra de este dispositivo y no se puede recuperar.', 'Eliminar', true)) { await T.dbDelete(m.id); renderGallery(); } } }
      ]));
      grid.append(card);
    });
  }
  T.renderGallery = renderGallery;

  function newDialog() {
    const max = T.maxCanvas(), dpr = window.devicePixelRatio || 1;
    let sw = Math.round(screen.width * dpr), sh = Math.round(screen.height * dpr);
    if (sw > sh) [sw, sh] = [sh, sw];
    const fitMax = (w, h) => { const k = Math.min(1, max / Math.max(w, h)); return [Math.round(w * k), Math.round(h * k)]; };
    const mmPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
    let dpi = 300;
    const CATS = {
      screen: [['Pantalla vertical', ...fitMax(sw, sh)], ['Pantalla horizontal', ...fitMax(sh, sw)], ['Cuadrado', 1500, 1500], ['Full HD', 1920, 1080], ['2K', 2560, 1440], ['4K', 3840, 2160]],
      social: [['Post de Instagram', 1080, 1080], ['Instagram vertical', 1080, 1350], ['Historia / TikTok', 1080, 1920], ['Miniatura de YouTube', 1280, 720], ['Banner de YouTube', 2560, 1440], ['Portada de X', 1500, 500], ['Foto de perfil', 800, 800], ['Fondo de celular', 1440, 3200]],
      paper: [['A4', 210, 297, 'mm'], ['A5', 148, 210, 'mm'], ['A3', 297, 420, 'mm'], ['B5', 182, 257, 'mm'], ['Carta', 216, 279, 'mm'], ['Postal', 100, 148, 'mm'], ['Tarjeta', 89, 51, 'mm'], ['Manga B4', 257, 364, 'mm']],
      pixel: [['16 × 16', 16, 16], ['32 × 32', 32, 32], ['64 × 64', 64, 64], ['128 × 128', 128, 128], ['256 × 256', 256, 256], ['Game Boy', 160, 144], ['Retro 320', 320, 180]]
    };
    const w = T.el('input', { type: 'number', class: 'tin num', id: 'nW', min: '16', max: String(max), value: CATS.screen[0][1], 'aria-label': 'Ancho en píxeles' });
    const h = T.el('input', { type: 'number', class: 'tin num', id: 'nH', min: '16', max: String(max), value: CATS.screen[0][2], 'aria-label': 'Alto en píxeles' });
    const info = T.el('p', { class: 'note', id: 'nInfo' });
    const grid = T.el('div', { class: 'presets' });
    const dpiSeg = T.seg({ label: 'Resolución', value: '300', options: [['150', '150 dpi'], ['300', '300 dpi'], ['350', '350 dpi']], onChange: (v) => { dpi = +v; renderCat(); } });
    let cat = 'screen', bg = 'white';
    const updInfo = () => {
      const W = +w.value || 0, H = +h.value || 0, mb = Math.round((W * H * 4) / 1e6);
      info.textContent = W + ' × ' + H + ' px · unos ' + mb + ' MB de memoria por capa · máximo en este equipo: ' + max + ' px';
      info.classList.toggle('warn', Math.max(W, H) > max);
    };
    const pick = (b, W, H) => {
      T.$$('.preset', grid).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      [W, H] = fitMax(W, H);
      w.value = W; h.value = H; updInfo();
    };
    function renderCat() {
      grid.innerHTML = '';
      dpiSeg.hidden = cat !== 'paper';
      (CATS[cat] || []).forEach((p, i) => {
        const W = p[3] === 'mm' ? mmPx(p[1], dpi) : p[1], H = p[3] === 'mm' ? mmPx(p[2], dpi) : p[2];
        const b = T.el('button', { type: 'button', class: 'preset', 'aria-pressed': 'false' }, [
          T.el('span', { class: 'pshape', style: 'aspect-ratio:' + W + '/' + H + (W >= H ? ';width:58px;height:auto' : '') }),
          T.el('span', { class: 'pname', text: p[0] }),
          T.el('span', { class: 'pdim', text: p[3] === 'mm' ? p[1] + '×' + p[2] + ' mm' : W + '×' + H })
        ]);
        b.addEventListener('click', () => pick(b, W, H));
        grid.append(b);
        if (i === 0) pick(b, W, H);
      });
    }
    const catSeg = T.seg({ label: 'Tipo de lienzo', value: cat, options: [['screen', 'Pantalla'], ['social', 'Redes'], ['paper', 'Papel'], ['pixel', 'Pixel art']], onChange: (v) => { cat = v; renderCat(); } });
    catSeg.classList.add('full', 'wrap');
    const rotBtn = T.el('button', { type: 'button', class: 'ib sm', title: 'Girar (vertical/horizontal)', 'aria-label': 'Girar orientación', html: T.icon('rotate') });
    rotBtn.addEventListener('click', () => { const a = w.value; w.value = h.value; h.value = a; updInfo(); });
    w.addEventListener('input', updInfo);
    h.addEventListener('input', updInfo);
    const body = T.el('div', { class: 'stack' }, [
      catSeg, dpiSeg, grid,
      T.el('h3', { text: 'Tamaño' }),
      T.el('div', { class: 'dims' }, [w, T.el('span', { text: '×' }), h, T.el('span', { text: 'px' }), rotBtn]),
      info,
      T.el('h3', { text: 'Fondo' }),
      T.seg({ label: 'Fondo', value: bg, options: [['white', 'Blanco'], ['transparent', 'Transparente'], ['color', 'Color actual']], onChange: (v) => (bg = v) })
    ]);
    renderCat();
    T.dialog({
      title: 'Nuevo dibujo', body, wide: true, actions: [
        { label: 'Cancelar' },
        {
          label: 'Crear', primary: true, action: () => {
            let W = T.clamp(Math.round(+w.value || 1500), 16, 16384), H = T.clamp(Math.round(+h.value || 1500), 16, 16384);
            if (Math.max(W, H) > max) { [W, H] = fitMax(W, H); T.toast('Se ajustó a ' + W + '×' + H + ' para que tu equipo no se quede sin memoria', 4000); }
            T.newArtwork(W, H, { transparent: bg === 'transparent', bg: bg === 'color' ? P.color : '#ffffff' });
          }
        }
      ]
    });
  }
  function photoMenu(anchor, target) {
    T.menu(anchor, [
      { label: 'Tomar foto', icon: 'camera', action: () => (target === 'layer' ? T.photoToLayer('CAMERA') : T.photoToArtwork('CAMERA')) },
      { label: 'Elegir de la galería', icon: 'image', action: () => (target === 'layer' ? T.photoToLayer('PHOTOS') : T.photoToArtwork('PHOTOS')) },
      target === 'layer' ? null : { sep: true },
      target === 'layer' ? null : { label: 'Foto de un boceto → líneas', icon: 'pen', hint: 'Extraer línea', action: () => T.photoToArtwork('PROMPT', true) }
    ]);
  }
  T.photoMenu = photoMenu;
  T.newDialog = newDialog;

  /* ---------- Cambiar entre galería y editor ---------- */
  T.showEditor = function () {
    $('#gallery').hidden = true;
    $('#app').hidden = false;
    T.emit('docname');
    if (history.state !== 'editor') { try { history.pushState('editor', ''); } catch (e) { /* file:// */ } }
    requestAnimationFrame(() => {
      T.updateStageRect();
      T.fitView();
      renderLayers();
      renderBrushPanel();
      lastHue = -1;
      syncColorUI();
      T.setTool(P.tool === 'move' ? 'brush' : P.tool);
      T.dirty();
    });
  };
  T.showGallery = async function (fromPop) {
    if (T.xf.active) T.xfCommit();
    T.closeMenu();
    if (D.id) await T.flushSave();
    $('#app').hidden = true;
    $('#gallery').hidden = false;
    if (!fromPop && history.state === 'editor') { try { history.back(); } catch (e) { /* ignorar */ } }
    renderGallery();
  };
  window.addEventListener('popstate', () => { if (!$('#app').hidden) T.showGallery(true); });

  T.on('docname', () => { $('#docName').textContent = D.name; });
  T.on('history', () => {
    $('#bUndo').disabled = !T.hist.undo.length;
    $('#bRedo').disabled = !T.hist.redo.length;
  });
  T.on('saved', () => {
    const s = $('#saveState');
    s.textContent = 'Guardado';
    s.classList.add('on');
    clearTimeout(s._t);
    s._t = setTimeout(() => s.classList.remove('on'), 1400);
  });
  T.on('view', () => {
    $('#zVal').textContent = Math.round(T.view.s * 100) + '%';
    const deg = Math.round(((T.view.r * 180) / Math.PI) % 360);
    const rb = $('#zRot');
    rb.hidden = !deg;
    rb.textContent = deg + '°';
  });

  /* ---------- Construcción inicial ---------- */
  T.buildUI = function () {
    applyTheme();
    applyHand();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    T.fillIcons(document);
    buildTools();
    buildColorPanel();
    buildQuick();
    const [h, s, v] = T.rgbToHsv(...T.hexToRgb(P.color));
    Object.assign(hsv, { h, s, v });
    $('#bGallery').addEventListener('click', () => T.showGallery());
    $('#docName').addEventListener('click', renameDoc);
    $('#bUndo').addEventListener('click', T.undo);
    $('#bRedo').addEventListener('click', T.redo);
    $('#mCanvas').addEventListener('click', (e) => canvasMenu(e.currentTarget));
    $('#mSelect').addEventListener('click', (e) => selectMenu(e.currentTarget));
    $('#mFilter').addEventListener('click', (e) => filterMenu(e.currentTarget));
    $('#mRuler').addEventListener('click', (e) => rulerMenu(e.currentTarget));
    $('#mView').addEventListener('click', (e) => viewMenu(e.currentTarget));
    $('#bMore').addEventListener('click', (e) => moreMenu(e.currentTarget));
    $('#bSettings').addEventListener('click', settingsDialog);
    $('#bExport').addEventListener('click', exportDialog);
    $('#bPanel').addEventListener('click', () => {
      const p = $('#panel');
      if (p.classList.contains('open')) p.classList.remove('open');
      else openPanel(P.panelTab === 'color' ? 'color' : 'layers');
    });
    $('#bLayersQuick').addEventListener('click', () => openPanel('layers'));
    T.$$('.ptabs [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('#sheetClose').addEventListener('click', T.closeSheet);
    $('#zIn').addEventListener('click', () => T.zoomCenter(1.25));
    $('#zOut').addEventListener('click', () => T.zoomCenter(0.8));
    $('#zVal').addEventListener('click', T.fitView);
    $('#zRot').addEventListener('click', () => T.setRotation(0));
    $('#gNew').addEventListener('click', newDialog);
    $('#gNew2').addEventListener('click', newDialog);
    $('#gImport').addEventListener('click', () => pickFile('', T.importAnyFile));
    $('#gCamera').addEventListener('click', (e) => photoMenu(e.currentTarget));
    setTab(T.isNarrow() && P.panelTab === 'color' ? 'color' : P.panelTab === 'color' ? 'brush' : P.panelTab || 'brush');
    window.addEventListener('resize', T.debounce(() => { lastHue = -1; syncColorUI(); }, 150));
  };
})();
