/* Trazo — motor: documento, capas, composición, historial, selección y vista */
'use strict';
(function () {
  const T = window.T;

  /* ---------- Modos de fusión ---------- */
  T.BLENDS = [
    ['normal', 'Normal', 'source-over'], ['multiply', 'Multiplicar', 'multiply'], ['screen', 'Trama', 'screen'],
    ['overlay', 'Superponer', 'overlay'], ['darken', 'Oscurecer', 'darken'], ['lighten', 'Aclarar', 'lighten'],
    ['color-dodge', 'Sobreexponer color', 'color-dodge'], ['color-burn', 'Subexponer color', 'color-burn'],
    ['add', 'Añadir (brillo)', 'lighter'], ['hard-light', 'Luz fuerte', 'hard-light'], ['soft-light', 'Luz suave', 'soft-light'],
    ['difference', 'Diferencia', 'difference'], ['exclusion', 'Exclusión', 'exclusion'], ['hue', 'Tono', 'hue'],
    ['saturation', 'Saturación', 'saturation'], ['color', 'Color', 'color'], ['luminosity', 'Luminosidad', 'luminosity']
  ];
  const blendOp = (id) => { const b = T.BLENDS.find((x) => x[0] === id); return b ? b[2] : 'source-over'; };
  T.blendName = (id) => { const b = T.BLENDS.find((x) => x[0] === id); return b ? b[1] : 'Normal'; };

  /* ---------- Documento ---------- */
  const D = (T.doc = { w: 1200, h: 800, layers: [], activeId: null, bg: '#ffffff', transparent: false, id: null, name: 'Sin título', created: 0, seq: 0 });
  const S = (T.scratch = {});
  let lid = 0;

  T.newLayer = function (name) {
    const c = T.mkCanvas(D.w, D.h);
    return { id: ++lid, name: name || 'Capa ' + ++D.seq, canvas: c, ctx: c.getContext('2d'), visible: true, opacity: 1, blend: 'normal', clip: false, lockAlpha: false, rev: 1 };
  };
  T.active = () => D.layers.find((l) => l.id === D.activeId) || D.layers[D.layers.length - 1];
  T.layerById = (id) => D.layers.find((l) => l.id === id);
  T.layerIndex = (L) => D.layers.indexOf(L);

  function setupScratch() {
    ['a', 'b', 'c', 'd', 'cache', 'stroke', 'snap'].forEach((k) => {
      const c = T.mkCanvas(D.w, D.h);
      S[k] = c;
      S[k + 'x'] = c.getContext('2d');
    });
    const v = T.viewCv;
    v.width = D.w; v.height = D.h;
    T.vctx = v.getContext('2d');
    setupSel();
  }

  T.setupDoc = function (w, h, o) {
    o = o || {};
    D.w = Math.round(w); D.h = Math.round(h);
    D.layers = []; D.activeId = null; D.seq = 0;
    D.bg = o.bg || '#ffffff'; D.transparent = !!o.transparent;
    D.id = o.id || null; D.name = o.name || 'Sin título'; D.created = o.created || Date.now();
    setupScratch();
    T.clearHistory();
    T.clearLive();
    T.emit('doc');
  };

  /* ---------- Estado temporal (trazo en curso, vista previa de filtro, transformación) ---------- */
  const live = (T.live = { layerId: null, stroke: null, strokeAlpha: 1, strokeMode: 'over', preview: null, float: null, floatM: null, token: 0 });
  T.setLive = function (o) {
    Object.assign(live, { layerId: null, stroke: null, strokeAlpha: 1, strokeMode: 'over', preview: null, float: null, floatM: null }, o);
    live.token++;
    T.dirty();
  };
  T.clearLive = function () {
    Object.assign(live, { layerId: null, stroke: null, preview: null, float: null, floatM: null });
    live.token++;
    T.dirty && T.dirty();
  };

  /* ---------- Composición ---------- */
  function layerSource(L, useLive) {
    if (!useLive || live.layerId !== L.id || (!live.stroke && !live.preview && !live.float)) return L.canvas;
    const x = S.cx;
    T.resetCtx(x);
    x.clearRect(0, 0, D.w, D.h);
    x.drawImage(live.preview || L.canvas, 0, 0);
    if (live.stroke) {
      let s = live.stroke;
      if (SEL.active) {
        const d = S.dx;
        T.resetCtx(d);
        d.clearRect(0, 0, D.w, D.h);
        d.drawImage(s, 0, 0);
        d.globalCompositeOperation = 'destination-in';
        d.drawImage(SEL.mask, 0, 0);
        d.globalCompositeOperation = 'source-over';
        s = S.d;
      }
      x.globalAlpha = live.strokeAlpha;
      x.globalCompositeOperation = live.strokeMode === 'erase' ? 'destination-out' : L.lockAlpha ? 'source-atop' : 'source-over';
      x.drawImage(s, 0, 0);
    }
    if (live.float) {
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      const m = live.floatM;
      x.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      x.imageSmoothingQuality = 'high';
      x.drawImage(live.float, 0, 0);
    }
    T.resetCtx(x);
    return S.c;
  }

  function groupEnd(i) {
    let j = i + 1;
    while (j < D.layers.length && D.layers[j].clip) j++;
    return j;
  }

  function composeRange(x, from, to, useLive) {
    const Ls = D.layers;
    for (let i = from; i < to;) {
      const base = Ls[i], j = groupEnd(i);
      if (base.visible && base.opacity > 0) {
        let src = layerSource(base, useLive);
        const clipped = [];
        for (let k = i + 1; k < j; k++) if (Ls[k].visible && Ls[k].opacity > 0) clipped.push(Ls[k]);
        if (clipped.length) {
          const g = S.ax;
          T.resetCtx(g);
          g.clearRect(0, 0, D.w, D.h);
          g.drawImage(src, 0, 0);
          for (const cl of clipped) {
            const b = S.bx;
            T.resetCtx(b);
            b.clearRect(0, 0, D.w, D.h);
            b.drawImage(layerSource(cl, useLive), 0, 0);
            b.globalCompositeOperation = 'destination-in';
            b.drawImage(src, 0, 0);
            g.globalCompositeOperation = blendOp(cl.blend);
            g.globalAlpha = cl.opacity;
            g.drawImage(S.b, 0, 0);
          }
          T.resetCtx(g);
          src = S.a;
        }
        x.globalCompositeOperation = blendOp(base.blend);
        x.globalAlpha = base.opacity;
        x.drawImage(src, 0, 0);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'source-over';
      }
      i = j;
    }
  }

  function paintBg(x, transparent) {
    if (!transparent) { x.fillStyle = D.bg; x.fillRect(0, 0, D.w, D.h); }
  }

  let cacheToken = -1;
  function renderDoc() {
    const x = T.vctx;
    T.resetCtx(x);
    x.clearRect(0, 0, D.w, D.h);
    const Ls = D.layers;
    if (live.layerId != null && Ls.length > 2) {
      let gi = Ls.findIndex((l) => l.id === live.layerId);
      while (gi > 0 && Ls[gi].clip) gi--;
      if (gi > 0) {
        if (cacheToken !== live.token) {
          const c = S.cachex;
          T.resetCtx(c);
          c.clearRect(0, 0, D.w, D.h);
          paintBg(c, D.transparent);
          composeRange(c, 0, gi, false);
          cacheToken = live.token;
        }
        x.drawImage(S.cache, 0, 0);
        composeRange(x, gi, Ls.length, true);
        return;
      }
    }
    paintBg(x, D.transparent);
    composeRange(x, 0, Ls.length, true);
  }

  /* Imagen final para exportar o miniaturas */
  T.composite = function (transparent, scale) {
    const c = T.mkCanvas(D.w, D.h), x = c.getContext('2d');
    paintBg(x, transparent);
    composeRange(x, 0, D.layers.length, false);
    if (!scale || scale === 1) return c;
    const s = T.mkCanvas(D.w * scale, D.h * scale), sx = s.getContext('2d');
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(c, 0, 0, s.width, s.height);
    return s;
  };

  let docDirty = true, ovDirty = true, raf = 0;
  function frame() {
    raf = 0;
    if (docDirty) { docDirty = false; renderDoc(); }
    if (ovDirty) { ovDirty = false; T.drawOverlay && T.drawOverlay(); }
  }
  T.dirty = function () { docDirty = true; ovDirty = true; if (!raf) raf = requestAnimationFrame(frame); };
  T.dirtyOv = function () { ovDirty = true; if (!raf) raf = requestAnimationFrame(frame); };

  /* ---------- Historial ---------- */
  const H = (T.hist = { undo: [], redo: [], bytes: 0 });
  const MEM = navigator.deviceMemory || (/Android|iPhone|iPad|Mobile/.test(navigator.userAgent) ? 4 : 8);
  const LIMIT = MEM <= 2 ? 120e6 : MEM <= 4 ? 260e6 : 600e6;

  function opBytes(op) {
    switch (op.t) {
      case 'px': return op.w * op.h * 8;
      case 'multi': return op.ops.reduce((s, o) => s + opBytes(o), 0);
      case 'doc': return (op.before.bytes || 0) + (op.after.bytes || 0);
      case 'sel': return D.w * D.h * 8;
      case 'add': case 'del': return D.w * D.h * 4;
      default: return 64;
    }
  }
  T.clearHistory = function () { H.undo.length = 0; H.redo.length = 0; H.bytes = 0; T.emit('history'); };
  T.pushOp = function (op) {
    op.bytes = opBytes(op);
    H.undo.push(op);
    H.bytes += op.bytes;
    H.redo.forEach((o) => (H.bytes -= o.bytes));
    H.redo.length = 0;
    while (H.undo.length > 100 || (H.bytes > LIMIT && H.undo.length > 1)) H.bytes -= H.undo.shift().bytes;
    T.emit('history');
    T.emit('changed');
  };

  function crop(src, b) {
    const c = T.mkCanvas(b.w, b.h);
    c.getContext('2d').drawImage(src, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    return c;
  }
  T.crop = crop;
  T.clampBox = function (x0, y0, x1, y1) {
    const x = Math.max(0, Math.floor(x0)), y = Math.max(0, Math.floor(y0));
    const xe = Math.min(D.w, Math.ceil(x1)), ye = Math.min(D.h, Math.ceil(y1));
    if (xe <= x || ye <= y) return null;
    return { x, y, w: xe - x, h: ye - y };
  };
  T.fullBox = () => ({ x: 0, y: 0, w: D.w, h: D.h });

  /* Edición de píxeles: guarda copia antes, registra solo el área cambiada */
  T.beginEdit = function (L) {
    T.resetCtx(S.snapx);
    S.snapx.clearRect(0, 0, D.w, D.h);
    S.snapx.drawImage(L.canvas, 0, 0);
  };
  T.endEdit = function (L, b, extra) {
    if (!b) return;
    const op = { t: 'px', id: L.id, x: b.x, y: b.y, w: b.w, h: b.h, before: crop(S.snap, b), after: crop(L.canvas, b) };
    L.rev++;
    T.pushOp(extra ? { t: 'multi', ops: [op].concat(extra) } : op);
    T.emit('layerpx', L);
    T.dirty();
  };
  T.restoreSnap = function (L) {
    T.resetCtx(L.ctx);
    L.ctx.clearRect(0, 0, D.w, D.h);
    L.ctx.drawImage(S.snap, 0, 0);
    T.dirty();
  };

  T.snapshotDoc = function () {
    let bytes = 0;
    const layers = D.layers.map((L) => {
      bytes += D.w * D.h * 4;
      return { id: L.id, name: L.name, visible: L.visible, opacity: L.opacity, blend: L.blend, clip: L.clip, lockAlpha: L.lockAlpha, canvas: T.cloneCanvas(L.canvas) };
    });
    return { w: D.w, h: D.h, activeId: D.activeId, layers, bytes };
  };
  function restoreDoc(s) {
    const resized = s.w !== D.w || s.h !== D.h;
    D.w = s.w; D.h = s.h;
    D.layers = s.layers.map((o) => {
      const c = T.cloneCanvas(o.canvas);
      return { id: o.id, name: o.name, visible: o.visible, opacity: o.opacity, blend: o.blend, clip: o.clip, lockAlpha: o.lockAlpha, canvas: c, ctx: c.getContext('2d'), rev: Date.now() };
    });
    D.activeId = s.activeId;
    if (resized) { setupScratch(); T.emit('resized'); }
  }

  function applyOp(op, undo) {
    switch (op.t) {
      case 'px': {
        const L = T.layerById(op.id);
        if (!L) return;
        T.resetCtx(L.ctx);
        L.ctx.clearRect(op.x, op.y, op.w, op.h);
        L.ctx.drawImage(undo ? op.before : op.after, op.x, op.y);
        L.rev++;
        T.emit('layerpx', L);
        break;
      }
      case 'add': undo ? removeLayerRaw(op.layer) : insertLayerRaw(op.layer, op.index); break;
      case 'del': undo ? insertLayerRaw(op.layer, op.index) : removeLayerRaw(op.layer); break;
      case 'move': undo ? moveRaw(op.to, op.from) : moveRaw(op.from, op.to); break;
      case 'props': { const L = T.layerById(op.id); if (L) Object.assign(L, undo ? op.before : op.after); break; }
      case 'docprops': Object.assign(D, undo ? op.before : op.after); break;
      case 'sel': setSelRaw(undo ? op.before : op.after); break;
      case 'doc': restoreDoc(undo ? op.before : op.after); break;
      case 'multi': (undo ? op.ops.slice().reverse() : op.ops).forEach((o) => applyOp(o, undo)); break;
    }
  }
  T.undo = function () {
    if (T.busy()) return;
    const op = H.undo.pop();
    if (!op) return;
    applyOp(op, true);
    H.redo.push(op);
    T.emit('history'); T.emit('layers'); T.emit('changed'); T.dirty();
  };
  T.redo = function () {
    if (T.busy()) return;
    const op = H.redo.pop();
    if (!op) return;
    applyOp(op, false);
    H.undo.push(op);
    T.emit('history'); T.emit('layers'); T.emit('changed'); T.dirty();
  };
  T.busy = () => !!(T.xf && T.xf.active) || T.dialogOpen > 0;

  /* ---------- Operaciones de capa ---------- */
  function insertLayerRaw(L, index) {
    D.layers.splice(T.clamp(index, 0, D.layers.length), 0, L);
    D.activeId = L.id;
    T.emit('layers'); T.dirty();
  }
  function removeLayerRaw(L) {
    const i = D.layers.indexOf(L);
    if (i < 0) return;
    D.layers.splice(i, 1);
    if (D.activeId === L.id && D.layers.length) D.activeId = D.layers[Math.min(i, D.layers.length - 1)].id;
    T.emit('layers'); T.dirty();
  }
  function moveRaw(from, to) {
    const L = D.layers.splice(from, 1)[0];
    D.layers.splice(to, 0, L);
    T.emit('layers'); T.dirty();
  }
  T.insertLayerRaw = insertLayerRaw;
  T.removeLayerRaw = removeLayerRaw;

  T.addLayer = function (o) {
    o = o || {};
    const L = T.newLayer(o.name);
    if (o.canvas) L.ctx.drawImage(o.canvas, 0, 0);
    const idx = o.index != null ? o.index : T.layerIndex(T.active()) + 1;
    insertLayerRaw(L, idx);
    T.pushOp({ t: 'add', layer: L, index: idx });
    return L;
  };
  T.deleteLayer = function (L) {
    if (D.layers.length < 2) { T.toast('El dibujo necesita al menos una capa'); return; }
    const idx = T.layerIndex(L);
    removeLayerRaw(L);
    T.pushOp({ t: 'del', layer: L, index: idx });
  };
  T.duplicateLayer = function (L) {
    const N = T.newLayer(L.name + ' (copia)');
    N.ctx.drawImage(L.canvas, 0, 0);
    Object.assign(N, { opacity: L.opacity, blend: L.blend, clip: L.clip, lockAlpha: L.lockAlpha, visible: L.visible });
    const idx = T.layerIndex(L) + 1;
    insertLayerRaw(N, idx);
    T.pushOp({ t: 'add', layer: N, index: idx });
  };
  T.moveLayer = function (L, delta) {
    const i = T.layerIndex(L), j = i + delta;
    if (j < 0 || j >= D.layers.length) return;
    moveRaw(i, j);
    T.pushOp({ t: 'move', from: i, to: j });
  };
  T.setLayerProps = function (L, props, before) {
    const b = before || {};
    if (!before) for (const k in props) b[k] = L[k];
    Object.assign(L, props);
    T.pushOp({ t: 'props', id: L.id, before: b, after: Object.assign({}, props) });
    T.emit('layers'); T.dirty();
  };
  T.mergeDown = function (L) {
    const i = T.layerIndex(L);
    if (i <= 0) { T.toast('No hay una capa debajo para combinar'); return; }
    const B = D.layers[i - 1];
    T.beginEdit(B);
    const t = S.ax;
    T.resetCtx(t);
    t.clearRect(0, 0, D.w, D.h);
    if (L.visible) t.drawImage(L.canvas, 0, 0);
    if (L.clip) { t.globalCompositeOperation = 'destination-in'; t.drawImage(B.canvas, 0, 0); }
    T.resetCtx(t);
    B.ctx.globalCompositeOperation = blendOp(L.blend);
    B.ctx.globalAlpha = L.opacity;
    B.ctx.drawImage(S.a, 0, 0);
    T.resetCtx(B.ctx);
    removeLayerRaw(L);
    D.activeId = B.id;
    T.endEdit(B, T.fullBox(), [{ t: 'del', layer: L, index: i }]);
    T.emit('layers');
  };
  T.clearLayer = function (L) {
    T.beginEdit(L);
    if (SEL.active) {
      L.ctx.globalCompositeOperation = 'destination-out';
      L.ctx.drawImage(SEL.mask, 0, 0);
      T.resetCtx(L.ctx);
    } else L.ctx.clearRect(0, 0, D.w, D.h);
    T.endEdit(L, SEL.active && SEL.bbox ? SEL.bbox : T.fullBox());
  };
  T.fillLayer = function (L, color) {
    T.beginEdit(L);
    const x = L.ctx;
    x.fillStyle = color;
    if (L.lockAlpha) x.globalCompositeOperation = 'source-atop';
    if (SEL.active) {
      const t = S.ax;
      T.resetCtx(t);
      t.clearRect(0, 0, D.w, D.h);
      t.drawImage(SEL.mask, 0, 0);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = color;
      t.fillRect(0, 0, D.w, D.h);
      T.resetCtx(t);
      x.drawImage(S.a, 0, 0);
    } else x.fillRect(0, 0, D.w, D.h);
    T.resetCtx(x);
    T.endEdit(L, SEL.active && SEL.bbox ? SEL.bbox : T.fullBox());
  };

  /* Operaciones de documento completo (girar, voltear, tamaño) */
  T.docOp = function (fn) {
    const before = T.snapshotDoc();
    fn();
    const after = T.snapshotDoc();
    T.pushOp({ t: 'doc', before, after });
    T.emit('layers'); T.dirty();
  };
  T.transformCanvas = function (kind) {
    T.selSet(null, false);
    T.docOp(() => {
      const w = D.w, h = D.h, rot = kind === 'cw' || kind === 'ccw';
      const nw = rot ? h : w, nh = rot ? w : h;
      D.layers.forEach((L) => {
        const c = T.mkCanvas(nw, nh), x = c.getContext('2d');
        if (kind === 'flipH') { x.translate(w, 0); x.scale(-1, 1); }
        else if (kind === 'flipV') { x.translate(0, h); x.scale(1, -1); }
        else if (kind === 'cw') { x.translate(nw, 0); x.rotate(Math.PI / 2); }
        else if (kind === 'ccw') { x.translate(0, nh); x.rotate(-Math.PI / 2); }
        x.drawImage(L.canvas, 0, 0);
        L.canvas = c; L.ctx = x; T.resetCtx(x); L.rev++;
      });
      if (rot) { D.w = nw; D.h = nh; setupScratch(); T.emit('resized'); }
    });
    if (kind === 'cw' || kind === 'ccw') T.fitView();
  };
  T.resizeCanvas = function (nw, nh, mode, anchor) {
    T.selSet(null, false);
    T.docOp(() => {
      const w = D.w, h = D.h;
      const ax = anchor ? anchor[0] : 0.5, ay = anchor ? anchor[1] : 0.5;
      D.layers.forEach((L) => {
        const c = T.mkCanvas(nw, nh), x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        if (mode === 'scale') x.drawImage(L.canvas, 0, 0, nw, nh);
        else x.drawImage(L.canvas, Math.round((nw - w) * ax), Math.round((nh - h) * ay));
        L.canvas = c; L.ctx = x; L.rev++;
      });
      D.w = Math.round(nw); D.h = Math.round(nh);
      setupScratch();
      T.emit('resized');
    });
    T.fitView();
  };
  T.cropToSelection = function () {
    if (!SEL.active || !SEL.bbox) { T.toast('Primero selecciona un área'); return; }
    const b = SEL.bbox;
    T.selSet(null, false);
    T.docOp(() => {
      D.layers.forEach((L) => {
        const c = crop(L.canvas, b);
        L.canvas = c; L.ctx = c.getContext('2d'); L.rev++;
      });
      D.w = b.w; D.h = b.h;
      setupScratch();
      T.emit('resized');
    });
    T.fitView();
  };
  T.setDocProps = function (props) {
    const before = {};
    for (const k in props) before[k] = D[k];
    Object.assign(D, props);
    T.pushOp({ t: 'docprops', before, after: Object.assign({}, props) });
    T.dirty();
  };

  /* Caja de contenido (píxeles con alfa > 0) */
  T.alphaBox = function (canvas) {
    const w = canvas.width, h = canvas.height;
    const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      let row = y * w * 4 + 3;
      for (let x = 0; x < w; x++, row += 4) {
        if (d[row]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  /* ---------- Selección ---------- */
  const SEL = (T.sel = { active: false, mask: null, mx: null, edge: null, bbox: null });
  function setupSel() {
    SEL.mask = T.mkCanvas(D.w, D.h);
    SEL.mx = SEL.mask.getContext('2d');
    SEL.edge = T.mkCanvas(D.w, D.h);
    SEL.active = false;
    SEL.bbox = null;
  }
  function computeEdge() {
    const w = D.w, h = D.h;
    const src = SEL.mx.getImageData(0, 0, w, h).data;
    const ex = SEL.edge.getContext('2d');
    const out = ex.createImageData(w, h), o = out.data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    const inside = (x, y) => src[(y * w + x) * 4 + 3] >= 128;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
          const i = (y * w + x) * 4, v = ((x + y) >> 2) & 1 ? 0 : 255;
          o[i] = o[i + 1] = o[i + 2] = v;
          o[i + 3] = 255;
        }
      }
    }
    ex.putImageData(out, 0, 0);
    if (x1 < 0) { SEL.active = false; SEL.bbox = null; return; }
    SEL.bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function setSelRaw(canvas) {
    SEL.mx.clearRect(0, 0, D.w, D.h);
    if (canvas) {
      SEL.mx.drawImage(canvas, 0, 0);
      SEL.active = true;
      computeEdge();
    } else { SEL.active = false; SEL.bbox = null; }
    T.emit('selection');
    T.dirty();
  }
  /* Cambia la selección y lo registra en el historial */
  T.selSet = function (canvas, record) {
    const before = SEL.active ? T.cloneCanvas(SEL.mask) : null;
    if (!before && !canvas) return;
    setSelRaw(canvas);
    const after = SEL.active ? T.cloneCanvas(SEL.mask) : null;
    if (record !== false) T.pushOp({ t: 'sel', before, after });
  };
  /* Combina una forma nueva: draw(ctx) pinta en blanco lo seleccionado */
  T.selCombine = function (draw, mode) {
    const t = T.mkCanvas(D.w, D.h), x = t.getContext('2d');
    if (mode === 'add' && SEL.active) x.drawImage(SEL.mask, 0, 0);
    if (mode === 'sub') {
      if (!SEL.active) return;
      x.drawImage(SEL.mask, 0, 0);
      x.globalCompositeOperation = 'destination-out';
    }
    x.fillStyle = '#fff';
    draw(x);
    T.selSet(t);
    if (!SEL.active) T.toast('La selección quedó vacía');
  };
  T.selAll = () => T.selCombine((x) => x.fillRect(0, 0, D.w, D.h), 'replace');
  T.selNone = () => T.selSet(null);
  T.selInvert = function () {
    const t = T.mkCanvas(D.w, D.h), x = t.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, D.w, D.h);
    if (SEL.active) { x.globalCompositeOperation = 'destination-out'; x.drawImage(SEL.mask, 0, 0); }
    T.selSet(t);
  };
  T.selFromLayer = function (L) {
    const t = T.cloneCanvas(L.canvas), x = t.getContext('2d');
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, D.w, D.h);
    T.selSet(t);
  };

  /* Restringe una edición directa a la selección y al bloqueo de alfa */
  T.constrainDirect = function (L, b) {
    if (!b || (!SEL.active && !L.lockAlpha)) return;
    const t = S.ax;
    T.resetCtx(t);
    t.clearRect(0, 0, D.w, D.h);
    t.drawImage(L.canvas, 0, 0);
    if (L.lockAlpha) { t.globalCompositeOperation = 'destination-in'; t.drawImage(S.snap, 0, 0); }
    if (SEL.active) { t.globalCompositeOperation = 'destination-in'; t.drawImage(SEL.mask, 0, 0); }
    T.resetCtx(t);
    const x = L.ctx;
    T.resetCtx(x);
    x.clearRect(b.x, b.y, b.w, b.h);
    x.drawImage(S.snap, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    x.save();
    x.beginPath();
    x.rect(b.x, b.y, b.w, b.h);
    x.clip();
    if (SEL.active) { x.globalCompositeOperation = 'destination-out'; x.drawImage(SEL.mask, 0, 0); }
    else x.clearRect(b.x, b.y, b.w, b.h);
    x.globalCompositeOperation = 'source-over';
    x.drawImage(S.a, 0, 0);
    x.restore();
  };

  /* Aplica un lienzo de trazo a la capa (pintar o borrar) y registra */
  T.commitStroke = function (L, stroke, alpha, mode, b) {
    if (!b) { T.clearLive(); return; }
    const sx = stroke.getContext('2d');
    if (SEL.active) {
      sx.globalCompositeOperation = 'destination-in';
      sx.drawImage(SEL.mask, 0, 0);
      sx.globalCompositeOperation = 'source-over';
    }
    const x = L.ctx;
    T.resetCtx(x);
    x.globalAlpha = alpha;
    x.globalCompositeOperation = mode === 'erase' ? 'destination-out' : L.lockAlpha ? 'source-atop' : 'source-over';
    x.drawImage(stroke, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
    T.resetCtx(x);
    T.resetCtx(sx);
    sx.clearRect(0, 0, D.w, D.h);
    T.clearLive();
    T.endEdit(L, b);
  };

  /* ---------- Vista: zoom, desplazamiento, giro, espejo ---------- */
  const V = (T.view = { x: 0, y: 0, s: 1, r: 0, flip: false });
  T.viewMatrix = function () {
    const c = Math.cos(V.r), s = Math.sin(V.r), f = V.flip ? -1 : 1;
    return [c * V.s * f, s * V.s * f, -s * V.s, c * V.s, V.x, V.y];
  };
  T.applyView = function () {
    const m = T.viewMatrix();
    T.viewCv.style.transform = 'matrix(' + m.join(',') + ')';
    T.viewCv.classList.toggle('px', V.s >= 2.5);
    T.emit('view');
    T.dirtyOv();
  };
  T.stageRect = null;
  T.updateStageRect = () => (T.stageRect = T.stage.getBoundingClientRect());
  T.toDoc = function (sx, sy) {
    const m = T.viewMatrix(), det = m[0] * m[3] - m[1] * m[2];
    const px = sx - m[4], py = sy - m[5];
    return { x: (m[3] * px - m[2] * py) / det, y: (-m[1] * px + m[0] * py) / det };
  };
  T.toStage = function (x, y) {
    const m = T.viewMatrix();
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
  };
  T.clientToDoc = function (cx, cy) {
    const r = T.stageRect || T.updateStageRect();
    return T.toDoc(cx - r.left, cy - r.top);
  };
  function anchor(p, sx, sy) {
    const m = T.viewMatrix();
    V.x = sx - (m[0] * p.x + m[2] * p.y);
    V.y = sy - (m[1] * p.x + m[3] * p.y);
  }
  T.zoomAt = function (sx, sy, f) {
    const p = T.toDoc(sx, sy);
    V.s = T.clamp(V.s * f, 0.03, 32);
    anchor(p, sx, sy);
    T.applyView();
  };
  T.zoomCenter = function (f) {
    const r = T.updateStageRect();
    T.zoomAt(r.width / 2, r.height / 2, f);
  };
  T.setZoom = function (s) {
    const r = T.updateStageRect();
    T.zoomAt(r.width / 2, r.height / 2, s / V.s);
  };
  T.rotateAt = function (sx, sy, dr) {
    const p = T.toDoc(sx, sy);
    V.r += dr;
    anchor(p, sx, sy);
    T.applyView();
  };
  T.setRotation = function (r) {
    const rc = T.updateStageRect();
    const p = T.toDoc(rc.width / 2, rc.height / 2);
    V.r = r;
    anchor(p, rc.width / 2, rc.height / 2);
    T.applyView();
  };
  T.panBy = function (dx, dy) { V.x += dx; V.y += dy; T.applyView(); };
  T.toggleFlipView = function () {
    const rc = T.updateStageRect();
    const p = T.toDoc(rc.width / 2, rc.height / 2);
    V.flip = !V.flip;
    anchor(p, rc.width / 2, rc.height / 2);
    T.applyView();
  };
  T.fitView = function () {
    const r = T.updateStageRect();
    if (!r.width || !r.height) return;
    const pad = T.isNarrow() ? 14 : 36;
    V.r = 0;
    V.s = Math.min((r.width - pad * 2) / D.w, (r.height - pad * 2) / D.h, 4);
    if (!(V.s > 0)) V.s = 1;
    anchor({ x: D.w / 2, y: D.h / 2 }, r.width / 2, r.height / 2);
    T.applyView();
  };
})();
