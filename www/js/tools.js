/* Trazo — herramientas: relleno, degradado, cuentagotas, selección, formas, transformar, texto y capa de guías */
'use strict';
(function () {
  const T = window.T, D = T.doc, SEL = T.sel;

  T.TOOLS = [
    { id: 'brush', name: 'Pincel', icon: 'brush', key: 'b' },
    { id: 'eraser', name: 'Borrador', icon: 'eraser', key: 'e' },
    { id: 'smudge', name: 'Difuminar', icon: 'smudge', key: 's' },
    { id: 'fill', name: 'Relleno', icon: 'bucket', key: 'g' },
    { id: 'gradient', name: 'Degradado', icon: 'gradient', key: 'd' },
    { id: 'picker', name: 'Cuentagotas', icon: 'picker', key: 'i' },
    { id: 'select', name: 'Selección', icon: 'lasso', key: 'l' },
    { id: 'move', name: 'Transformar', icon: 'move', key: 'v' },
    { id: 'text', name: 'Texto', icon: 'text', key: 't' },
    { id: 'shape', name: 'Formas', icon: 'shapes', key: 'u' },
    { id: 'hand', name: 'Mover vista', icon: 'hand', key: 'h' }
  ];
  T.isBrushTool = (t) => t === 'brush' || t === 'eraser' || t === 'smudge';
  T.toolOv = null; // vista previa de la herramienta en la capa de guías

  /* ---------- Relleno por inundación ---------- */
  function flood(data, w, h, sx, sy, tol) {
    const mask = new Uint8Array(w * h);
    const o0 = (sy * w + sx) * 4, tr = data[o0], tg = data[o0 + 1], tb = data[o0 + 2], ta = data[o0 + 3];
    const match = (i) => {
      const o = i * 4;
      if (ta === 0 && data[o + 3] === 0) return true;
      return Math.abs(data[o] - tr) <= tol && Math.abs(data[o + 1] - tg) <= tol && Math.abs(data[o + 2] - tb) <= tol && Math.abs(data[o + 3] - ta) <= tol;
    };
    const stack = [sx, sy];
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop(), row = cy * w;
      if (mask[row + cx] || !match(row + cx)) continue;
      let l = cx, r = cx;
      while (l > 0 && !mask[row + l - 1] && match(row + l - 1)) l--;
      while (r < w - 1 && !mask[row + r + 1] && match(row + r + 1)) r++;
      for (let i = l; i <= r; i++) mask[row + i] = 1;
      for (let k = -1; k <= 1; k += 2) {
        const ny = cy + k;
        if (ny < 0 || ny >= h) continue;
        const nrow = ny * w;
        let span = false;
        for (let j = l; j <= r; j++) {
          const ok = !mask[nrow + j] && match(nrow + j);
          if (ok && !span) { stack.push(j, ny); span = true; } else if (!ok) span = false;
        }
      }
    }
    return mask;
  }
  function dilate(mask, w, h, n) {
    for (let k = 0; k < n; k++) {
      const m2 = new Uint8Array(mask);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (mask[i]) continue;
          if ((x > 0 && mask[i - 1]) || (x < w - 1 && mask[i + 1]) || (y > 0 && mask[i - w]) || (y < h - 1 && mask[i + w])) m2[i] = 1;
        }
      }
      mask = m2;
    }
    return mask;
  }
  function refData(L) {
    const src = T.prefs.fillRef === 'all' ? T.composite(true) : L.canvas;
    return src.getContext('2d').getImageData(0, 0, D.w, D.h).data;
  }
  function maskToCanvas(mask, rgb) {
    const c = T.mkCanvas(D.w, D.h), x = c.getContext('2d'), img = x.createImageData(D.w, D.h), d = img.data;
    let x0 = D.w, y0 = D.h, x1 = -1, y1 = -1;
    for (let y = 0; y < D.h; y++) {
      for (let xx = 0; xx < D.w; xx++) {
        const i = y * D.w + xx;
        if (!mask[i]) continue;
        const o = i * 4;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; y1 = y;
      }
    }
    x.putImageData(img, 0, 0);
    return { canvas: c, box: x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  }

  T.doFill = function (p) {
    const L = T.active();
    if (!L.visible) { T.toast('La capa está oculta'); return; }
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= D.w || y >= D.h) return;
    if (SEL.active && SEL.mx.getImageData(x, y, 1, 1).data[3] < 128) { T.toast('Toca dentro de la selección'); return; }
    let mask = flood(refData(L), D.w, D.h, x, y, T.prefs.fillTol);
    if (T.prefs.fillExpand > 0) mask = dilate(mask, D.w, D.h, T.prefs.fillExpand);
    const r = maskToCanvas(mask, T.hexToRgb(T.prefs.color));
    if (!r.box) return;
    const sx = T.scratch.strokex;
    T.resetCtx(sx);
    sx.clearRect(0, 0, D.w, D.h);
    sx.drawImage(r.canvas, 0, 0);
    T.beginEdit(L);
    T.commitStroke(L, T.scratch.stroke, T.prefs.fillOpacity / 100, 'over', r.box);
    T.addRecent(T.prefs.color);
  };

  T.wandSelect = function (p) {
    const L = T.active();
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= D.w || y >= D.h) return;
    const mask = flood(refData(L), D.w, D.h, x, y, T.prefs.wandTol);
    const r = maskToCanvas(mask, [255, 255, 255]);
    T.selCombine((c) => c.drawImage(r.canvas, 0, 0), T.prefs.selMode);
  };

  /* ---------- Cuentagotas ---------- */
  T.pickColor = function (p) {
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= D.w || y >= D.h) return null;
    const d = T.vctx.getImageData(x, y, 1, 1).data, a = d[3] / 255;
    const hex = T.rgbToHex(d[0] * a + 255 * (1 - a), d[1] * a + 255 * (1 - a), d[2] * a + 255 * (1 - a));
    T.setColor(hex);
    return hex;
  };

  /* ---------- Degradado ---------- */
  function drawGradient(g) {
    const sx = T.scratch.strokex, c = T.prefs.color;
    T.resetCtx(sx);
    sx.clearRect(0, 0, D.w, D.h);
    const len = Math.hypot(g.x1 - g.x0, g.y1 - g.y0);
    const gr = T.prefs.gradType === 'radial'
      ? sx.createRadialGradient(g.x0, g.y0, 0, g.x0, g.y0, Math.max(1, len))
      : sx.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
    const rgb = T.hexToRgb(c);
    gr.addColorStop(0, c);
    gr.addColorStop(1, T.prefs.gradColors === 'c1c2' ? T.prefs.color2 : 'rgba(' + rgb.join(',') + ',0)');
    sx.fillStyle = gr;
    sx.fillRect(0, 0, D.w, D.h);
  }

  /* ---------- Formas ---------- */
  function constrain(g, shift) {
    let x1 = g.x1, y1 = g.y1;
    if (!shift) return [x1, y1];
    if (g.kind === 'line') {
      const st = Math.PI / 12, a = Math.round(Math.atan2(y1 - g.y0, x1 - g.x0) / st) * st, l = Math.hypot(x1 - g.x0, y1 - g.y0);
      return [g.x0 + Math.cos(a) * l, g.y0 + Math.sin(a) * l];
    }
    const m = Math.max(Math.abs(x1 - g.x0), Math.abs(y1 - g.y0));
    return [g.x0 + Math.sign(x1 - g.x0 || 1) * m, g.y0 + Math.sign(y1 - g.y0 || 1) * m];
  }
  function drawShape(g, shift) {
    const sx = T.scratch.strokex, [x1, y1] = constrain(g, shift), x0 = g.x0, y0 = g.y0, lw = T.prefs.shapeWidth;
    T.resetCtx(sx);
    sx.clearRect(0, 0, D.w, D.h);
    sx.lineWidth = lw; sx.lineCap = 'round'; sx.lineJoin = 'round';
    sx.strokeStyle = sx.fillStyle = T.prefs.color;
    sx.beginPath();
    if (g.kind === 'line') { sx.moveTo(x0, y0); sx.lineTo(x1, y1); sx.stroke(); }
    else {
      if (g.kind === 'rect') sx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      else sx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(0.5, Math.abs(x1 - x0) / 2), Math.max(0.5, Math.abs(y1 - y0) / 2), 0, 0, 6.2832);
      if (T.prefs.shapeFill) sx.fill();
      sx.stroke();
    }
    const pad = lw / 2 + 3;
    g.box = T.clampBox(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad);
  }

  /* ---------- Implementación de cada herramienta ---------- */
  let g = null;
  const brushImpl = (tool) => ({
    down: (p, info) => T.brushDown(tool, p, info),
    move: (p, info) => T.brushMove(p, info),
    up: () => T.brushUp(),
    cancel: () => T.brushCancel()
  });
  T.TOOL_IMPL = {
    brush: brushImpl('brush'),
    eraser: brushImpl('eraser'),
    smudge: brushImpl('smudge'),
    fill: { down: (p) => { T.doFill(p); return false; } },
    picker: {
      down: (p, info) => { T.pickColor(p); T.showLoupe(info.sx, info.sy); return true; },
      move: (p, info) => { T.pickColor(p); T.showLoupe(info.sx, info.sy); },
      up: () => { T.hideLoupe(); T.addRecent(T.prefs.color); },
      cancel: () => T.hideLoupe()
    },
    gradient: {
      down: (p) => {
        const L = T.active();
        if (!L.visible) { T.toast('La capa está oculta'); return false; }
        g = { L, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        T.setLive({ layerId: L.id, stroke: T.scratch.stroke, strokeAlpha: T.prefs.gradOpacity / 100 });
        T.toolOv = { type: 'line', a: p, b: p };
        return true;
      },
      move: (p) => { g.x1 = p.x; g.y1 = p.y; drawGradient(g); T.toolOv = { type: 'line', a: { x: g.x0, y: g.y0 }, b: p }; T.dirty(); },
      up: () => {
        T.toolOv = null;
        if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < 2) { T.clearLive(); g = null; return; }
        T.beginEdit(g.L);
        T.commitStroke(g.L, T.scratch.stroke, T.prefs.gradOpacity / 100, 'over', SEL.active && SEL.bbox ? SEL.bbox : T.fullBox());
        g = null;
      },
      cancel: () => { T.toolOv = null; T.clearLive(); g = null; }
    },
    shape: {
      down: (p) => {
        const L = T.active();
        if (!L.visible) { T.toast('La capa está oculta'); return false; }
        g = { L, kind: T.prefs.shapeKind, x0: p.x, y0: p.y, x1: p.x, y1: p.y, box: null };
        T.setLive({ layerId: L.id, stroke: T.scratch.stroke, strokeAlpha: T.prefs.shapeOpacity / 100 });
        return true;
      },
      move: (p, info) => { g.x1 = p.x; g.y1 = p.y; drawShape(g, info.shift); T.dirty(); },
      up: (p, info) => {
        if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < 1.5) { T.clearLive(); g = null; return; }
        drawShape(g, info.shift);
        T.beginEdit(g.L);
        T.commitStroke(g.L, T.scratch.stroke, T.prefs.shapeOpacity / 100, 'over', g.box);
        T.addRecent(T.prefs.color);
        g = null;
      },
      cancel: () => { T.clearLive(); g = null; }
    },
    select: {
      down: (p) => {
        const k = T.prefs.selShape;
        if (k === 'wand') { T.wandSelect(p); return false; }
        g = { kind: k, x0: p.x, y0: p.y, x1: p.x, y1: p.y, pts: [p] };
        T.toolOv = k === 'rect' ? { type: 'rect', a: p, b: p } : { type: 'lasso', pts: g.pts };
        T.dirtyOv();
        return true;
      },
      move: (p, info) => {
        if (g.kind === 'rect') {
          let x1 = p.x, y1 = p.y;
          if (info.shift) { const m = Math.max(Math.abs(x1 - g.x0), Math.abs(y1 - g.y0)); x1 = g.x0 + Math.sign(x1 - g.x0 || 1) * m; y1 = g.y0 + Math.sign(y1 - g.y0 || 1) * m; }
          g.x1 = x1; g.y1 = y1;
          T.toolOv = { type: 'rect', a: { x: g.x0, y: g.y0 }, b: { x: x1, y: y1 } };
        } else {
          const last = g.pts[g.pts.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) * T.view.s > 2) g.pts.push(p);
        }
        T.dirtyOv();
      },
      up: () => {
        const mode = T.prefs.selMode;
        T.toolOv = null;
        if (g.kind === 'rect') {
          const x = Math.min(g.x0, g.x1), y = Math.min(g.y0, g.y1), w = Math.abs(g.x1 - g.x0), h = Math.abs(g.y1 - g.y0);
          if (w * T.view.s < 3 && h * T.view.s < 3) { if (mode === 'replace') T.selNone(); }
          else T.selCombine((c) => c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)), mode);
        } else {
          if (g.pts.length < 3) { if (mode === 'replace') T.selNone(); }
          else T.selCombine((c) => { c.beginPath(); g.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); }, mode);
        }
        g = null;
        T.dirtyOv();
      },
      cancel: () => { T.toolOv = null; g = null; T.dirtyOv(); }
    },
    text: {
      down: () => true,
      up: (p) => { setTimeout(() => T.textTap(p), 60); },
      cancel: () => {}
    },
    move: {
      down: (p, info) => T.xfDown(p, info),
      move: (p, info) => T.xfMove(p, info),
      up: () => T.xfUp(),
      cancel: () => T.xfUp()
    }
  };

  /* ---------- Transformar (mover, escalar, girar, voltear) ---------- */
  const XF = (T.xf = { active: false });
  function xfMatrix() {
    const c = Math.cos(XF.rot), s = Math.sin(XF.rot);
    const a = c * XF.sx, b = s * XF.sx, cc = -s * XF.sy, d = c * XF.sy;
    return [a, b, cc, d, XF.cx + a * (-XF.w / 2) + cc * (-XF.h / 2), XF.cy + b * (-XF.w / 2) + d * (-XF.h / 2)];
  }
  function xfApplyLive() { T.live.floatM = xfMatrix(); T.dirty(); }
  function xfStart(L, float, cx, cy, extra) {
    Object.assign(XF, { active: true, L, float, w: float.width, h: float.height, cx, cy, sx: 1, sy: 1, rot: 0, orig: null, fromSel: false, newLayer: false, textData: null, drag: null }, extra);
    T.setLive({ layerId: L.id, float, floatM: xfMatrix() });
    T.emit('xf');
  }
  T.xfBegin = function () {
    if (XF.active) return true;
    const L = T.active();
    if (!L.visible) { T.toast('La capa está oculta'); return false; }
    if (L.text) {
      // las capas de texto se mueven sin perder la edición del texto
      const t = L.text, c = T.renderText(t);
      T.beginEdit(L);
      const box = T.alphaBox(L.canvas);
      L.ctx.clearRect(0, 0, D.w, D.h);
      xfStart(L, c, t.cx, t.cy, { orig: box, textData: t });
      Object.assign(XF, { sx: t.sx || 1, sy: t.sy || 1, rot: t.rot || 0 });
      xfApplyLive();
      return true;
    }
    let b, float;
    if (SEL.active && SEL.bbox) {
      b = SEL.bbox;
      float = T.crop(L.canvas, b);
      const fx = float.getContext('2d');
      fx.globalCompositeOperation = 'destination-in';
      fx.drawImage(SEL.mask, -b.x, -b.y);
      if (!T.alphaBox(float)) { T.toast('No hay nada dibujado dentro de la selección'); return false; }
      T.beginEdit(L);
      L.ctx.globalCompositeOperation = 'destination-out';
      L.ctx.drawImage(SEL.mask, 0, 0);
      T.resetCtx(L.ctx);
    } else {
      b = T.alphaBox(L.canvas);
      if (!b) { T.toast('La capa está vacía'); return false; }
      float = T.crop(L.canvas, b);
      T.beginEdit(L);
      L.ctx.clearRect(b.x, b.y, b.w, b.h);
    }
    xfStart(L, float, b.x + b.w / 2, b.y + b.h / 2, { orig: b, fromSel: SEL.active });
    return true;
  };
  T.xfStartFloat = function (L, float, cx, cy, extra) {
    T.beginEdit(L);
    if (extra && extra.clear) L.ctx.clearRect(0, 0, D.w, D.h);
    xfStart(L, float, cx, cy, Object.assign({ newLayer: true }, extra || {}));
    if (extra && extra.geom) Object.assign(XF, extra.geom), xfApplyLive();
    T.setTool('move');
  };
  function corners() {
    const m = xfMatrix(), pts = [[0, 0], [XF.w, 0], [XF.w, XF.h], [0, XF.h]];
    return pts.map(([x, y]) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }));
  }
  function stageHandles() {
    const c = corners().map((p) => T.toStage(p.x, p.y));
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const edges = [mid(c[0], c[1]), mid(c[1], c[2]), mid(c[2], c[3]), mid(c[3], c[0])];
    const ctr = mid(c[0], c[2]);
    const top = edges[0], vx = top.x - ctr.x, vy = top.y - ctr.y, vl = Math.hypot(vx, vy) || 1;
    const rot = { x: top.x + (vx / vl) * 34, y: top.y + (vy / vl) * 34 };
    return { c, edges, rot, top };
  }
  T.xfHandles = () => (XF.active ? stageHandles() : null);
  function hit(info) {
    const h = stageHandles(), r = info.pointerType === 'touch' ? 26 : 14;
    const near = (q) => Math.hypot(q.x - info.sx, q.y - info.sy) < r;
    if (near(h.rot)) return { k: 'rot' };
    for (let i = 0; i < 4; i++) if (near(h.c[i])) return { k: 'corner', i };
    for (let i = 0; i < 4; i++) if (near(h.edges[i])) return { k: 'edge', i };
    return { k: 'move' };
  }
  function local(p) {
    const c = Math.cos(-XF.rot), s = Math.sin(-XF.rot), dx = p.x - XF.cx, dy = p.y - XF.cy;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  T.xfDown = function (p, info) {
    if (!XF.active && !T.xfBegin()) return false;
    const h = hit(info);
    XF.drag = Object.assign(h, { p0: p, l0: local(p), cx: XF.cx, cy: XF.cy, sx: XF.sx, sy: XF.sy, rot: XF.rot, a0: Math.atan2(p.y - XF.cy, p.x - XF.cx) });
    return true;
  };
  T.xfMove = function (p, info) {
    const g2 = XF.drag;
    if (!g2) return;
    if (g2.k === 'move') { XF.cx = g2.cx + p.x - g2.p0.x; XF.cy = g2.cy + p.y - g2.p0.y; }
    else if (g2.k === 'rot') {
      let r = g2.rot + Math.atan2(p.y - XF.cy, p.x - XF.cx) - g2.a0;
      if (info.shift) r = Math.round(r / (Math.PI / 12)) * (Math.PI / 12);
      XF.rot = r;
    } else {
      const l = local(p), l0 = g2.l0;
      const fx = Math.abs(l0.x) > 1 ? l.x / l0.x : 1, fy = Math.abs(l0.y) > 1 ? l.y / l0.y : 1;
      if (g2.k === 'corner') {
        if (T.prefs.xfFree || info.shift) { XF.sx = g2.sx * fx; XF.sy = g2.sy * fy; }
        else {
          const f = Math.hypot(l.x, l.y) / Math.max(1, Math.hypot(l0.x, l0.y));
          XF.sx = g2.sx * f; XF.sy = g2.sy * f;
        }
      } else if (g2.i === 1 || g2.i === 3) XF.sx = g2.sx * fx;
      else XF.sy = g2.sy * fy;
      const minS = 2 / Math.max(XF.w, XF.h);
      if (Math.abs(XF.sx) < minS) XF.sx = minS * Math.sign(XF.sx || 1);
      if (Math.abs(XF.sy) < minS) XF.sy = minS * Math.sign(XF.sy || 1);
    }
    xfApplyLive();
  };
  T.xfUp = function () { if (XF.drag) XF.drag = null; T.dirtyOv(); };
  T.xfFlip = function (axis) { if (!XF.active) return; if (axis === 'h') XF.sx = -XF.sx; else XF.sy = -XF.sy; xfApplyLive(); };
  T.xfRotate90 = function () { if (!XF.active) return; XF.rot += Math.PI / 2; xfApplyLive(); };
  T.xfReset = function () { if (!XF.active) return; XF.sx = Math.sign(XF.sx); XF.sy = Math.sign(XF.sy); XF.rot = 0; xfApplyLive(); };
  T.xfCommit = function () {
    if (!XF.active) return;
    const L = XF.L, m = xfMatrix(), x = L.ctx;
    T.resetCtx(x);
    x.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    x.imageSmoothingQuality = 'high';
    x.drawImage(XF.float, 0, 0);
    T.resetCtx(x);
    const cs = corners();
    let x0 = Math.min(...cs.map((q) => q.x)), y0 = Math.min(...cs.map((q) => q.y));
    let x1 = Math.max(...cs.map((q) => q.x)), y1 = Math.max(...cs.map((q) => q.y));
    if (XF.orig) { x0 = Math.min(x0, XF.orig.x); y0 = Math.min(y0, XF.orig.y); x1 = Math.max(x1, XF.orig.x + XF.orig.w); y1 = Math.max(y1, XF.orig.y + XF.orig.h); }
    const box = T.clampBox(x0 - 2, y0 - 2, x1 + 2, y1 + 2);
    const fromSel = XF.fromSel;
    let extra = null;
    if (XF.textData) {
      const before = L.text, after = Object.assign({}, XF.textData, { cx: XF.cx, cy: XF.cy, sx: XF.sx, sy: XF.sy, rot: XF.rot });
      L.text = after;
      extra = [{ t: 'props', id: L.id, before: { text: before }, after: { text: after } }];
    }
    XF.active = false;
    XF.drag = null;
    XF.textData = null;
    T.clearLive();
    if (box) T.endEdit(L, box, extra, !!extra);
    T.emit('layers');
    if (fromSel) T.selSet(null, false);
    T.emit('xf');
  };
  T.xfCancel = function () {
    if (!XF.active) return;
    const L = XF.L;
    T.restoreSnap(L);
    XF.active = false;
    XF.drag = null;
    XF.textData = null;
    T.clearLive();
    if (XF.newLayer) {
      const last = T.hist.undo[T.hist.undo.length - 1];
      if (last && last.t === 'add' && last.layer === L) { T.hist.undo.pop(); T.hist.bytes -= last.bytes; }
      T.removeLayerRaw(L);
      T.emit('history');
    }
    T.emit('xf');
  };

  /* Importar imagen como capa nueva y dejarla lista para colocar */
  T.importAsLayer = function (img, name) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.min(1, (D.w * 0.9) / iw, (D.h * 0.9) / ih);
    const c = T.mkCanvas(iw * k, ih * k), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    if (XF.active) T.xfCommit();
    const L = T.addLayer({ name: name || 'Imagen' });
    T.xfStartFloat(L, c, D.w / 2, D.h / 2);
  };

  /* ---------- Texto (capas de texto editables) ---------- */
  T.FONTS = [
    ['sans-serif', 'Sans'], ['serif', 'Serif'], ['monospace', 'Mono'],
    ['"Bangers"', 'Bangers'], ['"Luckiest Guy"', 'Luckiest Guy'], ['"Comic Neue"', 'Comic Neue'],
    ['"Permanent Marker"', 'Marcador'], ['"Pacifico"', 'Pacifico'], ['"Lobster"', 'Lobster'],
    ['"Dancing Script"', 'Dancing Script'], ['"Caveat"', 'Caveat'], ['"Kalam"', 'Kalam'],
    ['"Indie Flower"', 'Indie Flower'], ['"Patrick Hand"', 'Patrick Hand'], ['"Amatic SC"', 'Amatic SC'],
    ['"Bebas Neue"', 'Bebas Neue'], ['"Anton"', 'Anton'], ['"Righteous"', 'Righteous'],
    ['"Fredoka"', 'Fredoka'], ['"Playfair Display"', 'Playfair'], ['"Cinzel"', 'Cinzel'],
    ['"Special Elite"', 'Máquina de escribir'], ['"Orbitron"', 'Orbitron'], ['"Press Start 2P"', 'Pixel'],
    ['"Creepster"', 'Terror']
  ];
  T.loadFont = async function (font, size) {
    try { await document.fonts.load((size || 40) + 'px ' + font + ', sans-serif', 'AaÑñáé'); } catch (e) { /* fuente del sistema */ }
  };
  T.TEXT_DEFAULTS = {
    text: '', font: 'sans-serif', size: 72, color: '#1d2433', gradient: false, color2: '#3b5bdb', bold: false, italic: false,
    align: 'left', vertical: false, letter: 0, line: 1.25, stroke: 0, strokeColor: '#ffffff',
    shadow: false, shadowColor: '#000000', shadowBlur: 10, shadowX: 4, shadowY: 6, bg: 'none', bgColor: '#ffffff', bgPad: 24, curve: 0
  };

  T.renderText = function (o0) {
    const o = Object.assign({}, T.TEXT_DEFAULTS, o0);
    const size = Math.max(4, o.size), font = (o.italic ? 'italic ' : '') + (o.bold ? 'bold ' : '') + size + 'px ' + o.font + (/serif|monospace/.test(o.font) ? '' : ', sans-serif');
    const lines = (o.text || ' ').split('\n');
    const m = T.mkCanvas(4, 4).getContext('2d');
    m.font = font;
    const lh = size * o.line, ls = o.letter;
    const G = [];
    if (o.vertical) {
      lines.forEach((line, li) => {
        const chars = Array.from(line || ' '), Hc = chars.length * (size + ls) - ls;
        const y0 = o.align === 'center' ? -Hc / 2 : o.align === 'right' ? -Hc : 0;
        chars.forEach((ch, ci) => G.push({ ch, x: -li * lh, y: y0 + ci * (size + ls) + size / 2, rot: 0 }));
      });
    } else {
      const widths = lines.map((line) => Array.from(line).map((ch) => m.measureText(ch).width));
      const W = widths.map((w) => w.reduce((a, b) => a + b, 0) + ls * Math.max(0, w.length - 1));
      const maxW = Math.max(1, ...W);
      lines.forEach((line, li) => {
        const chars = Array.from(line), ws = widths[li];
        const curve = o.curve && chars.length > 1;
        let x = curve || o.align === 'center' ? -W[li] / 2 : o.align === 'right' ? -W[li] : 0;
        const y = li * lh;
        chars.forEach((ch, ci) => {
          const cx = x + ws[ci] / 2;
          if (curve) {
            const sgn = o.curve > 0 ? 1 : -1, ang = (Math.abs(o.curve) / 100) * Math.PI * 1.15, R = maxW / ang, a = cx / R;
            G.push({ ch, x: R * Math.sin(a), y: y + sgn * R * (1 - Math.cos(a)), rot: sgn * a });
          } else G.push({ ch, x: cx, y, rot: 0 });
          x += ws[ci] + ls;
        });
      });
    }
    if (!G.length) G.push({ ch: ' ', x: 0, y: 0, rot: 0 });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    G.forEach((g) => { x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x); y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y); });
    const ext = size * 0.75;
    x0 -= ext; x1 += ext; y0 -= ext; y1 += ext;
    const pad = Math.ceil(o.stroke + (o.shadow ? o.shadowBlur * 2 + Math.abs(o.shadowX) + Math.abs(o.shadowY) : 0) + (o.bg !== 'none' ? o.bgPad + size * 0.5 : 0) + 8);
    const W = Math.ceil(x1 - x0 + pad * 2), H = Math.ceil(y1 - y0 + pad * 2), ox = pad - x0, oy = pad - y0;
    // letras (contorno primero, relleno después para que el contorno no tape letras vecinas)
    const tl = T.mkCanvas(W, H), tx = tl.getContext('2d');
    tx.font = font;
    tx.textAlign = 'center';
    tx.textBaseline = 'middle';
    tx.lineJoin = 'round';
    const each = (fn) => G.forEach((g) => { tx.save(); tx.translate(ox + g.x, oy + g.y); if (g.rot) tx.rotate(g.rot); fn(g.ch); tx.restore(); });
    if (o.stroke > 0) { tx.lineWidth = o.stroke * 2; tx.strokeStyle = o.strokeColor; each((ch) => tx.strokeText(ch, 0, 0)); }
    // relleno en su propia capa para que el degradado use coordenadas del lienzo, no de cada letra
    const fl = T.mkCanvas(W, H), fx = fl.getContext('2d'), keep = tx;
    fx.font = font; fx.textAlign = 'center'; fx.textBaseline = 'middle';
    fx.fillStyle = o.color;
    G.forEach((g) => { fx.save(); fx.translate(ox + g.x, oy + g.y); if (g.rot) fx.rotate(g.rot); fx.fillText(g.ch, 0, 0); fx.restore(); });
    if (o.gradient) {
      const gr = fx.createLinearGradient(0, oy + y0 + ext * 0.5, 0, oy + y1 - ext * 0.5);
      gr.addColorStop(0, o.color);
      gr.addColorStop(1, o.color2);
      fx.globalCompositeOperation = 'source-in';
      fx.fillStyle = gr;
      fx.fillRect(0, 0, W, H);
    }
    keep.drawImage(fl, 0, 0);
    // fondo
    const out = T.mkCanvas(W, H), x = out.getContext('2d');
    if (o.bg !== 'none') {
      const bx = ox + x0 + ext * 0.35 - o.bgPad, by = oy + y0 + ext * 0.45 - o.bgPad;
      const bw = x1 - x0 - ext * 0.7 + o.bgPad * 2, bh = y1 - y0 - ext * 0.9 + o.bgPad * 2;
      x.fillStyle = o.bgColor;
      x.strokeStyle = o.stroke > 0 ? o.strokeColor : 'rgba(0,0,0,0.85)';
      x.lineWidth = Math.max(2, size / 22);
      if (o.bg === 'box') { x.beginPath(); x.rect(bx, by, bw, bh); x.fill(); }
      else if (o.bg === 'round') { x.beginPath(); x.roundRect(bx, by, bw, bh, Math.min(bw, bh) * 0.3); x.fill(); }
      else {
        // bocadillo: primero el borde de óvalo y colita, luego el relleno tapa las líneas interiores
        const oval = () => { x.beginPath(); x.ellipse(bx + bw / 2, by + bh / 2, bw * 0.62, bh * 0.72, 0, 0, 6.2832); };
        const tail = () => { x.beginPath(); x.moveTo(bx + bw * 0.24, by + bh * 1.0); x.lineTo(bx + bw * 0.1, by + bh * 1.34); x.lineTo(bx + bw * 0.46, by + bh * 1.1); x.closePath(); };
        x.lineWidth *= 2;
        oval(); x.stroke(); tail(); x.stroke();
        oval(); x.fill(); tail(); x.fill();
      }
    }
    if (o.shadow) { x.shadowColor = o.shadowColor; x.shadowBlur = o.shadowBlur; x.shadowOffsetX = o.shadowX; x.shadowOffsetY = o.shadowY; }
    x.drawImage(tl, 0, 0);
    x.shadowColor = 'transparent';
    const b = T.alphaBox(out);
    return b ? T.crop(out, { x: Math.max(0, b.x - 2), y: Math.max(0, b.y - 2), w: Math.min(W - Math.max(0, b.x - 2), b.w + 4), h: Math.min(H - Math.max(0, b.y - 2), b.h + 4) }) : out;
  };

  /* Selector de color pequeño: muestra, selector del sistema y "usar el color actual" */
  T.colorField = function (label, value, onChange) {
    const inp = T.el('input', { type: 'color', value, class: 'cfin', 'aria-label': label });
    const sw = T.el('span', { class: 'cfsw', style: 'background:' + value });
    const cur = T.el('button', { type: 'button', class: 'cfcur', title: 'Usar el color actual', 'aria-label': 'Usar el color actual' });
    cur.style.background = T.prefs.color;
    const set = (v) => { inp.value = v; sw.style.background = v; onChange(v); };
    inp.addEventListener('input', () => set(inp.value));
    cur.addEventListener('click', () => set(T.prefs.color));
    return T.el('div', { class: 'cf' }, [T.el('span', { class: 'cflabel', text: label }), T.el('label', { class: 'cfpick' }, [sw, inp]), cur]);
  };

  T.textDialog = function (p, L0) {
    const P = T.prefs, editing = !!(L0 && L0.text);
    const o = Object.assign({}, T.TEXT_DEFAULTS, P.textStyle || {}, editing ? L0.text : { color: P.color });
    if (!editing) o.text = '';
    const prev = T.mkCanvas(560, 180);
    prev.className = 'tprev';
    const ta = T.el('textarea', { class: 'tin', rows: '2', id: 'textIn', placeholder: 'Escribe aquí', autofocus: true });
    ta.value = o.text;
    let pending = false;
    const redraw = async () => {
      if (pending) return;
      pending = true;
      await T.loadFont(o.font, 48);
      pending = false;
      const c = T.renderText(Object.assign({}, o, { text: ta.value || 'Texto' }));
      const x = prev.getContext('2d');
      x.clearRect(0, 0, prev.width, prev.height);
      const k = Math.min(1, (prev.width - 16) / c.width, (prev.height - 16) / c.height);
      x.drawImage(c, (prev.width - c.width * k) / 2, (prev.height - c.height * k) / 2, c.width * k, c.height * k);
    };
    const upd = (k) => (v) => { o[k] = v; redraw(); };

    // Pestaña Letra
    const fonts = T.el('div', { class: 'fontgrid', role: 'listbox', 'aria-label': 'Tipo de letra' });
    T.FONTS.forEach((f) => {
      const b = T.el('button', { type: 'button', class: 'fontb', role: 'option', 'aria-selected': f[0] === o.font ? 'true' : 'false', style: 'font-family:' + f[0].replace(/"/g, "'") + ', sans-serif' }, [T.el('span', { class: 'fa', text: 'Aa' }), T.el('span', { class: 'fn', text: f[1] })]);
      b.addEventListener('click', () => { o.font = f[0]; T.$$('.fontb', fonts).forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); redraw(); });
      fonts.append(b);
      T.loadFont(f[0], 20);
    });
    const tabLetra = T.el('div', { class: 'stack' }, [
      fonts,
      T.slider({ label: 'Tamaño', min: 8, max: 600, value: o.size, unit: ' px', onInput: upd('size') }),
      T.el('div', { class: 'two' }, [
        T.seg({ label: 'Alineación', value: o.align, options: [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']], onChange: upd('align') })
      ]),
      T.el('div', { class: 'two' }, [
        T.check({ label: 'Vertical', value: o.vertical, onChange: upd('vertical') }),
        T.check({ label: 'Negrita', value: o.bold, onChange: upd('bold') }),
        T.check({ label: 'Cursiva', value: o.italic, onChange: upd('italic') })
      ])
    ]);
    // Pestaña Color
    const tabColor = T.el('div', { class: 'stack' }, [
      T.el('div', { class: 'two' }, [
        T.colorField('Relleno', o.color, upd('color')),
        T.check({ label: 'Degradado', value: o.gradient, onChange: upd('gradient') }),
        T.colorField('Hacia', o.color2, upd('color2'))
      ]),
      T.el('h3', { text: 'Contorno' }),
      T.el('div', { class: 'two' }, [T.colorField('Color', o.strokeColor, upd('strokeColor'))]),
      T.slider({ label: 'Grosor', min: 0, max: 40, value: o.stroke, unit: ' px', onInput: upd('stroke') }),
      T.el('h3', { text: 'Fondo' }),
      T.seg({ label: 'Fondo', value: o.bg, options: [['none', 'Ninguno'], ['box', 'Caja'], ['round', 'Redondeado'], ['bubble', 'Bocadillo']], onChange: upd('bg') }),
      T.el('div', { class: 'two' }, [T.colorField('Color', o.bgColor, upd('bgColor'))]),
      T.slider({ label: 'Margen', min: 0, max: 120, value: o.bgPad, unit: ' px', onInput: upd('bgPad') })
    ]);
    // Pestaña Efectos
    const tabFx = T.el('div', { class: 'stack' }, [
      T.slider({ label: 'Curvar', min: -100, max: 100, value: o.curve, onInput: upd('curve') }),
      T.slider({ label: 'Espacio letras', min: -30, max: 120, value: o.letter, unit: ' px', onInput: upd('letter') }),
      T.slider({ label: 'Interlineado', min: 60, max: 300, value: Math.round(o.line * 100), unit: '%', onInput: (v) => upd('line')(v / 100) }),
      T.el('h3', { text: 'Sombra' }),
      T.el('div', { class: 'two' }, [T.check({ label: 'Sombra', value: o.shadow, onChange: upd('shadow') }), T.colorField('Color', o.shadowColor, upd('shadowColor'))]),
      T.slider({ label: 'Difuminado', min: 0, max: 60, value: o.shadowBlur, unit: ' px', onInput: upd('shadowBlur') }),
      T.slider({ label: 'Desplazar X', min: -60, max: 60, value: o.shadowX, unit: ' px', onInput: upd('shadowX') }),
      T.slider({ label: 'Desplazar Y', min: -60, max: 60, value: o.shadowY, unit: ' px', onInput: upd('shadowY') })
    ]);
    const tabs = { letra: tabLetra, color: tabColor, fx: tabFx };
    const show = (k) => Object.keys(tabs).forEach((n) => (tabs[n].hidden = n !== k));
    const tabSeg = T.seg({ label: 'Opciones de texto', value: 'letra', options: [['letra', 'Letra'], ['color', 'Color y fondo'], ['fx', 'Efectos']], onChange: show });
    tabSeg.classList.add('full');
    show('letra');
    const body = T.el('div', { class: 'stack textdlg' }, [prev, ta, tabSeg, tabLetra, tabColor, tabFx]);
    ta.addEventListener('input', redraw);
    T.dialog({
      title: editing ? 'Editar texto' : 'Agregar texto', body, wide: true,
      actions: [
        { label: 'Cancelar' },
        {
          label: editing ? 'Guardar' : 'Colocar', primary: true, action: async () => {
            if (!ta.value.trim()) { T.toast('Escribe algo primero'); return false; }
            o.text = ta.value;
            const style = Object.assign({}, o);
            delete style.text; delete style.cx; delete style.cy; delete style.sx; delete style.sy; delete style.rot;
            P.textStyle = style;
            T.savePrefs();
            await T.loadFont(o.font, o.size);
            const c = T.renderText(o);
            if (editing) {
              const t = L0.text;
              const data = Object.assign({}, o, { cx: t.cx, cy: t.cy, sx: t.sx || 1, sy: t.sy || 1, rot: t.rot || 0 });
              if (T.xf.active) T.xfCommit();
              D.activeId = L0.id;
              T.xfStartFloat(L0, c, t.cx, t.cy, { newLayer: false, clear: true, textData: data, orig: T.alphaBox(L0.canvas), geom: { sx: data.sx, sy: data.sy, rot: data.rot } });
              L0.name = 'Texto: ' + o.text.trim().slice(0, 18);
              T.emit('layers');
            } else {
              const L = T.addLayer({ name: 'Texto: ' + o.text.trim().slice(0, 18) });
              const cx = T.clamp(p.x + c.width / 2, c.width / 2, Math.max(c.width / 2, D.w - c.width / 2));
              const cy = T.clamp(p.y, c.height / 2, Math.max(c.height / 2, D.h - c.height / 2));
              const data = Object.assign({}, o, { cx, cy, sx: 1, sy: 1, rot: 0 });
              setTimeout(() => T.xfStartFloat(L, c, cx, cy, { textData: data }), 0);
            }
          }
        }
      ]
    });
    redraw();
    if (!T.isTouchDevice) setTimeout(() => ta.focus(), 50);
  };
  /* Toque con la herramienta de texto: edita la capa de texto si tocas encima, o crea una nueva */
  T.textTap = function (p) {
    const A = T.active();
    if (A && A.text) {
      const b = T.alphaBox(A.canvas);
      if (b && p.x >= b.x - 20 && p.x <= b.x + b.w + 20 && p.y >= b.y - 20 && p.y <= b.y + b.h + 20) { T.textDialog(p, A); return; }
    }
    for (let i = D.layers.length - 1; i >= 0; i--) {
      const L = D.layers[i];
      if (!L.text || !L.visible) continue;
      const b = T.alphaBox(L.canvas);
      if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { D.activeId = L.id; T.emit('layers'); T.textDialog(p, L); return; }
    }
    T.textDialog(p);
  };

  /* ---------- Capa de guías (selección, simetría, transformar, previsualizaciones) ---------- */
  T.drawOverlay = function () {
    const cv = T.overlayCv, dpr = window.devicePixelRatio || 1, r = T.stageRect || T.updateStageRect();
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
    const m = T.viewMatrix(), s = T.view.s;
    const docT = () => x.setTransform(dpr * m[0], dpr * m[1], dpr * m[2], dpr * m[3], dpr * m[4], dpr * m[5]);
    const scrT = () => x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3d6bff';

    if (SEL.active) {
      docT();
      x.fillStyle = 'rgba(16, 24, 48, 0.28)';
      x.fillRect(0, 0, D.w, D.h);
      x.globalCompositeOperation = 'destination-out';
      x.drawImage(SEL.mask, 0, 0);
      x.globalCompositeOperation = 'source-over';
      x.imageSmoothingEnabled = s < 1;
      x.drawImage(SEL.edge, 0, 0);
      x.imageSmoothingEnabled = true;
    }

    if (T.ruler.mode !== 'none' && T.isBrushTool(T.prefs.tool)) {
      const c = T.rulerCenter(), R = T.ruler, L = Math.hypot(D.w, D.h);
      docT();
      x.strokeStyle = accent;
      x.lineWidth = 1.5 / s;
      x.setLineDash([8 / s, 6 / s]);
      x.beginPath();
      if (R.mode === 'v' || R.mode === 'quad') { x.moveTo(c.x, 0); x.lineTo(c.x, D.h); }
      if (R.mode === 'h' || R.mode === 'quad') { x.moveTo(0, c.y); x.lineTo(D.w, c.y); }
      if (R.mode === 'radial') {
        const n = Math.max(2, R.n | 0);
        for (let i = 0; i < n; i++) {
          const a = (i * 2 * Math.PI) / n - Math.PI / 2;
          x.moveTo(c.x, c.y);
          x.lineTo(c.x + Math.cos(a) * L, c.y + Math.sin(a) * L);
        }
      }
      x.stroke();
      x.setLineDash([]);
      scrT();
      const sc = T.toStage(c.x, c.y);
      x.fillStyle = accent;
      x.strokeStyle = '#fff';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(sc.x, sc.y, 8, 0, 6.2832);
      x.fill();
      x.stroke();
    }

    const ov = T.toolOv;
    if (ov) {
      scrT();
      x.lineWidth = 1.5;
      if (ov.type === 'rect' || ov.type === 'lasso') {
        const pts = ov.type === 'rect'
          ? [ov.a, { x: ov.b.x, y: ov.a.y }, ov.b, { x: ov.a.x, y: ov.b.y }]
          : ov.pts;
        x.beginPath();
        pts.forEach((p, i) => { const q = T.toStage(p.x, p.y); i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y); });
        if (ov.type === 'rect') x.closePath();
        x.strokeStyle = '#fff'; x.setLineDash([]); x.stroke();
        x.strokeStyle = '#111'; x.setLineDash([5, 4]); x.stroke();
        x.setLineDash([]);
      } else if (ov.type === 'line') {
        const a = T.toStage(ov.a.x, ov.a.y), b = T.toStage(ov.b.x, ov.b.y);
        x.strokeStyle = accent; x.lineWidth = 2;
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
        [a, b].forEach((q) => { x.beginPath(); x.arc(q.x, q.y, 5, 0, 6.2832); x.fillStyle = '#fff'; x.fill(); x.stroke(); });
      }
    }

    if (XF.active) {
      scrT();
      const h = stageHandles();
      x.strokeStyle = accent;
      x.lineWidth = 1.5;
      x.beginPath();
      h.c.forEach((q, i) => (i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y)));
      x.closePath();
      x.stroke();
      x.beginPath(); x.moveTo(h.top.x, h.top.y); x.lineTo(h.rot.x, h.rot.y); x.stroke();
      const dot = (q, rr, round) => {
        x.beginPath();
        if (round) x.arc(q.x, q.y, rr, 0, 6.2832); else x.rect(q.x - rr, q.y - rr, rr * 2, rr * 2);
        x.fillStyle = '#fff'; x.fill(); x.stroke();
      };
      h.c.forEach((q) => dot(q, 6));
      h.edges.forEach((q) => dot(q, 4.5));
      dot(h.rot, 7, true);
    }
  };

  /* ---------- Lupa del cuentagotas ---------- */
  T.showLoupe = function (sx, sy) {
    const l = T.$('#loupe');
    l.hidden = false;
    l.style.background = T.prefs.color;
    l.style.transform = 'translate(' + (sx - 32) + 'px,' + (sy - 96) + 'px)';
  };
  T.hideLoupe = () => { T.$('#loupe').hidden = true; };
})();
