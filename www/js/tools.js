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
      up: (p) => { setTimeout(() => T.textDialog(p), 60); },
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
    Object.assign(XF, { active: true, L, float, w: float.width, h: float.height, cx, cy, sx: 1, sy: 1, rot: 0, orig: null, fromSel: false, newLayer: false, drag: null }, extra);
    T.setLive({ layerId: L.id, float, floatM: xfMatrix() });
    T.emit('xf');
  }
  T.xfBegin = function () {
    if (XF.active) return true;
    const L = T.active();
    if (!L.visible) { T.toast('La capa está oculta'); return false; }
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
  T.xfStartFloat = function (L, float, cx, cy) {
    T.beginEdit(L);
    xfStart(L, float, cx, cy, { newLayer: true });
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
    XF.active = false;
    XF.drag = null;
    T.clearLive();
    if (box) T.endEdit(L, box);
    if (fromSel) T.selSet(null, false);
    T.emit('xf');
  };
  T.xfCancel = function () {
    if (!XF.active) return;
    const L = XF.L;
    T.restoreSnap(L);
    XF.active = false;
    XF.drag = null;
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

  /* ---------- Texto ---------- */
  T.FONTS = [
    ['sans-serif', 'Sans'], ['serif', 'Serif'], ['Georgia, serif', 'Georgia'], ['monospace', 'Mono'],
    ['"Comic Sans MS", "Comic Neue", cursive', 'Cómic'], ['Impact, "Arial Black", sans-serif', 'Impacto'],
    ['"Brush Script MT", "Segoe Script", cursive', 'Manuscrita'], ['"Trebuchet MS", sans-serif', 'Trebuchet']
  ];
  T.renderText = function (o) {
    const lines = o.text.split('\n');
    const font = (o.italic ? 'italic ' : '') + (o.bold ? 'bold ' : '') + o.size + 'px ' + o.font;
    const m = T.mkCanvas(4, 4).getContext('2d');
    m.font = font;
    const widths = lines.map((l) => m.measureText(l || ' ').width);
    const lh = o.size * 1.25, pad = Math.ceil(o.stroke + o.size * 0.25);
    const W = Math.ceil(Math.max(...widths) + pad * 2), Hh = Math.ceil(lines.length * lh + pad * 2);
    const c = T.mkCanvas(W, Hh), x = c.getContext('2d');
    x.font = font;
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    lines.forEach((l, i) => {
      const lx = o.align === 'center' ? (W - widths[i]) / 2 : o.align === 'right' ? W - pad - widths[i] : pad;
      const ly = pad + lh * i + lh / 2;
      if (o.stroke > 0) { x.lineWidth = o.stroke * 2; x.strokeStyle = o.strokeColor; x.strokeText(l, lx, ly); }
      x.fillStyle = o.color;
      x.fillText(l, lx, ly);
    });
    return c;
  };
  T.textDialog = function (p) {
    const P = T.prefs;
    const ta = T.el('textarea', { class: 'tin', rows: '3', id: 'textIn', placeholder: 'Escribe aquí', autofocus: true });
    const font = T.el('select', { class: 'tin', id: 'textFont', 'aria-label': 'Tipo de letra' }, T.FONTS.map((f) => T.el('option', { value: f[0], text: f[1], selected: f[0] === P.textFont })));
    const prev = T.mkCanvas(380, 120);
    prev.className = 'tprev';
    const opts = () => ({ text: ta.value || 'Texto', font: font.value, size: P.textSize, bold: P.textBold, italic: P.textItalic, stroke: P.textStroke, strokeColor: P.color2, color: P.color, align: P.textAlign });
    const redraw = () => {
      const c = T.renderText(Object.assign(opts(), { size: Math.min(P.textSize, 56) }));
      const x = prev.getContext('2d');
      x.clearRect(0, 0, prev.width, prev.height);
      const k = Math.min(1, (prev.width - 8) / c.width, (prev.height - 8) / c.height);
      x.drawImage(c, (prev.width - c.width * k) / 2, (prev.height - c.height * k) / 2, c.width * k, c.height * k);
    };
    const body = T.el('div', { class: 'stack' }, [
      ta,
      T.el('div', { class: 'two' }, [font, T.seg({ label: 'Alineación', value: P.textAlign, options: [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']], onChange: (v) => { P.textAlign = v; redraw(); } })]),
      T.slider({ label: 'Tamaño', min: 8, max: 400, value: P.textSize, unit: ' px', onInput: (v) => { P.textSize = v; redraw(); } }),
      T.slider({ label: 'Contorno', min: 0, max: 30, value: P.textStroke, unit: ' px', onInput: (v) => { P.textStroke = v; redraw(); } }),
      T.el('div', { class: 'two' }, [
        T.check({ label: 'Negrita', value: P.textBold, onChange: (v) => { P.textBold = v; redraw(); } }),
        T.check({ label: 'Cursiva', value: P.textItalic, onChange: (v) => { P.textItalic = v; redraw(); } })
      ]),
      prev,
      T.el('p', { class: 'note', text: 'El texto usa el color actual. El contorno usa el color secundario.' })
    ]);
    ta.addEventListener('input', redraw);
    font.addEventListener('change', () => { P.textFont = font.value; redraw(); });
    T.dialog({
      title: 'Agregar texto', body,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Colocar', primary: true, action: () => {
            if (!ta.value.trim()) { T.toast('Escribe algo primero'); return false; }
            T.savePrefs();
            const c = T.renderText(opts());
            const L = T.addLayer({ name: 'Texto: ' + ta.value.trim().slice(0, 18) });
            const cx = T.clamp(p.x + c.width / 2, c.width / 2, Math.max(c.width / 2, D.w - c.width / 2));
            const cy = T.clamp(p.y, c.height / 2, Math.max(c.height / 2, D.h - c.height / 2));
            setTimeout(() => T.xfStartFloat(L, c, cx, cy), 0);
          }
        }
      ]
    });
    redraw();
    setTimeout(() => ta.focus(), 50);
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
