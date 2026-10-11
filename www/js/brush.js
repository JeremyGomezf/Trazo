/* Trazo — pinceles: puntas, presión, estabilizador, afinado de extremos, simetría y difuminar */
'use strict';
(function () {
  const T = window.T;

  /* tip: round | grain | charcoal | wet
     hard: dureza 0–1 · spacing: espaciado relativo al tamaño
     sizeP / alphaP: cuánto influye la presión en tamaño y opacidad
     flowMode: 'target' (no se acumula dentro del trazo) | 'build' (se acumula, aerógrafo)
     stab: estabilizador 0–100 · taper: afinar inicio y final cuando no hay presión */
  T.BRUSHES = [
    { id: 'pencil', name: 'Lápiz', tip: 'grain', size: 5, opacity: 100, hard: 0.65, spacing: 0.2, sizeP: 0.35, alphaP: 0.75, stab: 15, taper: false },
    { id: 'pen', name: 'Pluma', tip: 'round', size: 6, opacity: 100, hard: 1, spacing: 0.06, sizeP: 0.6, alphaP: 0, stab: 30, taper: true },
    { id: 'gpen', name: 'Pluma G', tip: 'round', size: 12, opacity: 100, hard: 1, spacing: 0.05, sizeP: 1, alphaP: 0, stab: 40, taper: true },
    { id: 'mono', name: 'Rotulador', tip: 'round', size: 8, opacity: 100, hard: 1, spacing: 0.06, sizeP: 0, alphaP: 0, stab: 25, taper: false },
    { id: 'marker', name: 'Marcador', tip: 'round', size: 28, opacity: 55, hard: 0.92, spacing: 0.06, sizeP: 0.1, alphaP: 0, stab: 20, taper: false },
    { id: 'soft', name: 'Pincel suave', tip: 'round', size: 40, opacity: 100, hard: 0.35, spacing: 0.08, sizeP: 0.5, alphaP: 0.6, stab: 20, taper: false },
    { id: 'air', name: 'Aerógrafo', tip: 'round', size: 90, opacity: 100, hard: 0, spacing: 0.06, flowMode: 'build', flow: 0.07, sizeP: 0.2, alphaP: 0.6, stab: 10, taper: false },
    { id: 'water', name: 'Acuarela', tip: 'wet', size: 50, opacity: 65, hard: 0.55, spacing: 0.1, sizeP: 0.4, alphaP: 0.5, stab: 20, taper: false },
    { id: 'charcoal', name: 'Carboncillo', tip: 'charcoal', size: 22, opacity: 90, hard: 0.5, spacing: 0.22, sizeP: 0.3, alphaP: 0.8, stab: 10, taper: false },
    { id: 'dots', name: 'Puntos', tip: 'round', size: 14, opacity: 100, hard: 1, spacing: 1.7, scatter: 1.1, sizeJitter: 0.6, sizeP: 0.4, alphaP: 0, stab: 0, taper: false },
    { id: 'pixel', name: 'Pixel', tip: 'square', size: 1, opacity: 100, hard: 1, spacing: 0.25, sizeP: 0, alphaP: 0, stab: 0, taper: false }
  ];
  T.ERASERS = [
    { id: 'e-hard', name: 'Borrador duro', tip: 'round', size: 30, opacity: 100, hard: 1, spacing: 0.06, sizeP: 0.3, alphaP: 0, stab: 10, taper: false },
    { id: 'e-soft', name: 'Borrador suave', tip: 'round', size: 70, opacity: 100, hard: 0.15, spacing: 0.07, sizeP: 0.3, alphaP: 0.6, stab: 10, taper: false },
    { id: 'e-pencil', name: 'Borrador de lápiz', tip: 'grain', size: 10, opacity: 100, hard: 0.65, spacing: 0.2, sizeP: 0.3, alphaP: 0.7, stab: 10, taper: false },
    { id: 'e-pixel', name: 'Borrador pixel', tip: 'square', size: 1, opacity: 100, hard: 1, spacing: 0.25, sizeP: 0, alphaP: 0, stab: 0, taper: false }
  ];
  T.SMUDGES = [
    { id: 's-soft', name: 'Difuminar', tip: 'round', size: 40, opacity: 55, hard: 0.3, spacing: 0.12, sizeP: 0.4, alphaP: 0.5, stab: 10, taper: false },
    { id: 's-hard', name: 'Arrastrar color', tip: 'round', size: 24, opacity: 85, hard: 0.8, spacing: 0.1, sizeP: 0.3, alphaP: 0.4, stab: 10, taper: false }
  ];
  T.EDITABLE = ['size', 'opacity', 'hard', 'spacing', 'sizeP', 'alphaP', 'stab', 'taper', 'flow'];

  T.brushListFor = (tool) => (tool === 'eraser' ? T.ERASERS : tool === 'smudge' ? T.SMUDGES : T.BRUSHES);
  T.brushKey = (tool) => (tool === 'eraser' ? 'eraserId' : tool === 'smudge' ? 'smudgeId' : 'brushId');
  T.brushCfg = function (b) { return Object.assign({}, b, T.prefs.brushes[b.id] || {}); };
  T.currentBrush = function (tool) {
    const list = T.brushListFor(tool), id = T.prefs[T.brushKey(tool)];
    return T.brushCfg(list.find((b) => b.id === id) || list[0]);
  };
  T.setBrushValue = function (b, k, v) {
    const o = (T.prefs.brushes[b.id] = T.prefs.brushes[b.id] || {});
    o[k] = v;
    T.savePrefs();
  };
  T.resetBrush = function (b) { delete T.prefs.brushes[b.id]; T.savePrefs(); };

  /* ---------- Puntas (máscaras en blanco con alfa) ---------- */
  const maskCache = {};
  function rand(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function makeMask(tip, hard, variant) {
    const N = tip === 'grain' || tip === 'charcoal' ? 96 : 192;
    const c = T.mkCanvas(N, N), x = c.getContext('2d');
    const img = x.createImageData(N, N), d = img.data, R = N / 2;
    const rnd = rand(1234 + variant * 977 + Math.round(hard * 100));
    const h = Math.min(hard, 0.995);
    // ruido grueso para carboncillo
    const G = 12, coarse = [];
    for (let i = 0; i < G * G; i++) coarse.push(rnd());
    for (let y = 0; y < N; y++) {
      for (let x2 = 0; x2 < N; x2++) {
        const dx = (x2 + 0.5 - R) / R, dy = (y + 0.5 - R) / R, r = Math.sqrt(dx * dx + dy * dy);
        if (r >= 1) continue;
        let a = r <= h ? 1 : 1 - (r - h) / (1 - h);
        a = a * a * (3 - 2 * a);
        if (tip === 'wet') a *= 0.45 + 0.55 * Math.pow(r, 3.5);
        else if (tip === 'grain') a *= rnd() < 0.62 ? 1 : 0.15 + rnd() * 0.35;
        else if (tip === 'charcoal') {
          const cg = coarse[((y * G / N) | 0) * G + ((x2 * G / N) | 0)];
          a *= T.clamp(cg * 1.4 - 0.15 + (rnd() - 0.5) * 0.5, 0, 1);
        }
        const i = (y * N + x2) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(a * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function getMasks(tip, hard) {
    const k = tip + '|' + Math.round(hard * 20);
    if (!maskCache[k]) {
      const n = tip === 'grain' || tip === 'charcoal' ? 4 : 1;
      maskCache[k] = [];
      for (let i = 0; i < n; i++) maskCache[k].push(makeMask(tip, hard, i));
    }
    return maskCache[k];
  }
  T.getMasks = getMasks;
  function tinted(masks, color) {
    return masks.map((m) => {
      const c = T.mkCanvas(m.width, m.height), x = c.getContext('2d');
      x.drawImage(m, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }

  /* ---------- Simetría ---------- */
  T.ruler = { mode: 'none', n: 6, mirror: false, cx: null, cy: null };
  T.rulerCenter = () => ({ x: T.ruler.cx == null ? T.doc.w / 2 : T.ruler.cx, y: T.ruler.cy == null ? T.doc.h / 2 : T.ruler.cy });
  T.symFns = function () {
    const R = T.ruler;
    if (R.mode === 'none') return null;
    const c = T.rulerCenter(), cx = c.x, cy = c.y;
    const id = (x, y) => [x, y];
    if (R.mode === 'v') return [id, (x, y) => [2 * cx - x, y]];
    if (R.mode === 'h') return [id, (x, y) => [x, 2 * cy - y]];
    if (R.mode === 'quad') return [id, (x, y) => [2 * cx - x, y], (x, y) => [x, 2 * cy - y], (x, y) => [2 * cx - x, 2 * cy - y]];
    const fns = [], n = Math.max(2, R.n | 0);
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n, ca = Math.cos(a), sa = Math.sin(a);
      fns.push((x, y) => { const dx = x - cx, dy = y - cy; return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; });
      if (R.mirror) fns.push((x, y) => { const dx = -(x - cx), dy = y - cy; return [cx + dx * ca - dy * sa, cy + dx * sa + dy * ca]; });
    }
    return fns;
  };

  /* ---------- Estampador ---------- */
  function Stroker(ctx, cfg, color, mode, syms) {
    this.x = ctx;
    this.cfg = cfg;
    this.syms = syms;
    this.arc = cfg.tip === 'round' && cfg.hard >= 0.99;
    this.square = cfg.tip === 'square';
    if (!this.arc && !this.square) this.stamps = tinted(getMasks(cfg.tip, cfg.hard), mode === 'erase' ? '#000' : color);
    ctx.fillStyle = mode === 'erase' ? '#000' : color;
    this.left = 0;
    this.resetBox();
  }
  Stroker.prototype.resetBox = function () { this.box = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; };
  Stroker.prototype.stampAlpha = function (a) {
    const c = this.cfg;
    if (c.flowMode === 'build') return T.clamp((c.flow || 0.08) * a, 0, 1);
    if (c.spacing >= 1 || (!c.alphaP && a >= 0.995)) return T.clamp(a, 0, 1);
    return 1 - Math.pow(1 - T.clamp(a, 0, 0.985), Math.min(1, c.spacing));
  };
  Stroker.prototype.one = function (x, y, size, alpha, img) {
    const c = this.x, r = size / 2;
    c.globalAlpha = alpha;
    if (this.square) {
      const s = Math.max(1, Math.round(size)), px = Math.floor(x - s / 2 + 0.5), py = Math.floor(y - s / 2 + 0.5);
      c.fillRect(px, py, s, s);
    } else if (this.arc) {
      c.beginPath();
      c.arc(x, y, Math.max(0.35, r), 0, 6.2832);
      c.fill();
    } else c.drawImage(img, x - r, y - r, size, size);
    const b = this.box, m = r + 2;
    if (x - m < b.x0) b.x0 = x - m;
    if (y - m < b.y0) b.y0 = y - m;
    if (x + m > b.x1) b.x1 = x + m;
    if (y + m > b.y1) b.y1 = y + m;
  };
  Stroker.prototype.stamp = function (x, y, size, a) {
    const cfg = this.cfg;
    if (size < 0.25) return;
    if (cfg.sizeJitter) size *= 1 - cfg.sizeJitter * Math.random();
    if (cfg.scatter) {
      const ang = Math.random() * 6.2832, dist = Math.random() * cfg.scatter * size;
      x += Math.cos(ang) * dist;
      y += Math.sin(ang) * dist;
    }
    const alpha = this.stampAlpha(a);
    const img = this.stamps ? this.stamps[(Math.random() * this.stamps.length) | 0] : null;
    if (!this.syms) this.one(x, y, size, alpha, img);
    else for (const f of this.syms) { const p = f(x, y); this.one(p[0], p[1], size, alpha, img); }
  };
  Stroker.prototype.seg = function (x0, y0, s0, a0, x1, y1, s1, a1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist < 0.001) return;
    let d = this.left;
    while (d <= dist) {
      const t = d / dist, s = s0 + (s1 - s0) * t;
      this.stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, s, a0 + (a1 - a0) * t);
      d += Math.max(this.square ? 0.5 : 0.4, s * this.cfg.spacing);
    }
    this.left = d - dist;
  };
  T.Stroker = Stroker;

  /* ---------- Presión ---------- */
  T.pressure = function (info) {
    if (!info.hasPressure) return 1;
    const g = Math.pow(2, (T.prefs.pressureCurve - 50) / 30);
    return Math.pow(T.clamp(info.pressure, 0.02, 1), g);
  };

  /* ---------- Trazo en vivo ---------- */
  let st = null;
  T.strokeActive = () => !!st;

  function fadeLen(cfg) { return Math.max(6, cfg.size * 2.5); }

  T.brushDown = function (tool, p, info) {
    const L = T.active();
    if (!L) return false;
    if (!L.visible) { T.toast('La capa está oculta. Actívala para dibujar.'); return false; }
    const cfg = T.currentBrush(tool);
    const pr = T.pressure(info);
    if (tool === 'smudge') return smudgeDown(L, cfg, p, pr, info);
    const mode = tool === 'eraser' ? 'erase' : 'paint';
    const sx = T.scratch.strokex;
    T.resetCtx(sx);
    sx.clearRect(0, 0, T.doc.w, T.doc.h);
    const stroker = new Stroker(sx, cfg, T.prefs.color, mode, T.symFns());
    T.setLive({ layerId: L.id, stroke: T.scratch.stroke, strokeAlpha: cfg.opacity / 100, strokeMode: mode === 'erase' ? 'erase' : 'over' });
    const size = cfg.size * (1 - cfg.sizeP + cfg.sizeP * pr);
    const a = 1 - cfg.alphaP + cfg.alphaP * pr;
    st = { L, cfg, mode, stroker, sx: p.x, sy: p.y, ss: size, sa: a, rx: p.x, ry: p.y, rs: size, ra: a, hasP: info.hasPressure, dist: 0, samples: [[p.x, p.y, size, a]], tool };
    const f0 = cfg.taper && !info.hasPressure ? 0.15 : 1;
    stroker.stamp(p.x, p.y, size * f0, a);
    stroker.left = Math.max(0.4, size * f0 * cfg.spacing);
    T.dirty();
    return true;
  };

  function advance(rx, ry, rs, ra) {
    const c = st.cfg, sm = (c.stab / 100) * 0.9;
    const nx = st.sx + (rx - st.sx) * (1 - sm), ny = st.sy + (ry - st.sy) * (1 - sm);
    const ns = st.ss + (rs - st.ss) * 0.35, na = st.sa + (ra - st.sa) * 0.35;
    const len = Math.hypot(nx - st.sx, ny - st.sy);
    if (len < 0.05) return;
    const taper = c.taper && !st.hasP, fl = fadeLen(c);
    const f0 = taper ? Math.max(0.15, Math.pow(Math.min(1, st.dist / fl), 0.8)) : 1;
    const f1 = taper ? Math.max(0.15, Math.pow(Math.min(1, (st.dist + len) / fl), 0.8)) : 1;
    st.stroker.seg(st.sx, st.sy, st.ss * f0, st.sa, nx, ny, ns * f1, na);
    st.dist += len;
    st.sx = nx; st.sy = ny; st.ss = ns; st.sa = na;
    st.samples.push([nx, ny, ns, na]);
  }

  T.brushMove = function (p, info) {
    if (!st) return;
    if (st.smudge) return smudgeMove(p, info);
    const c = st.cfg, pr = T.pressure(info);
    st.rx = p.x; st.ry = p.y;
    st.rs = c.size * (1 - c.sizeP + c.sizeP * pr);
    st.ra = 1 - c.alphaP + c.alphaP * pr;
    advance(st.rx, st.ry, st.rs, st.ra);
    T.dirty();
  };

  function replayTapered() {
    const c = st.cfg, S = st.samples, k = st.stroker;
    let total = 0;
    for (let i = 1; i < S.length; i++) total += Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]);
    if (total < c.size * 1.5 || S.length < 3) return;
    const fin = fadeLen(c), fout = Math.min(total * 0.45, Math.max(8, c.size * 4));
    const fac = (d) => Math.max(0.12, Math.pow(Math.min(1, d / fin), 0.8) * Math.pow(Math.min(1, (total - d) / fout), 0.9));
    const x = k.x;
    T.resetCtx(x);
    x.clearRect(0, 0, T.doc.w, T.doc.h);
    x.fillStyle = st.mode === 'erase' ? '#000' : T.prefs.color;
    k.resetBox();
    k.left = 0;
    let d = 0;
    k.stamp(S[0][0], S[0][1], S[0][2] * fac(0), S[0][3]);
    for (let i = 1; i < S.length; i++) {
      const a = S[i - 1], b = S[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      k.seg(a[0], a[1], a[2] * fac(d), a[3], b[0], b[1], b[2] * fac(d + len), b[3]);
      d += len;
    }
  }

  T.brushUp = function () {
    if (!st) return;
    if (st.smudge) return smudgeUp();
    for (let i = 0; i < 80 && Math.hypot(st.rx - st.sx, st.ry - st.sy) > 0.3; i++) advance(st.rx, st.ry, st.rs, st.ra);
    if (st.cfg.taper && !st.hasP) replayTapered();
    const b = st.stroker.box, L = st.L;
    const box = T.clampBox(b.x0, b.y0, b.x1, b.y1);
    T.beginEdit(L);
    T.commitStroke(L, T.scratch.stroke, st.cfg.opacity / 100, st.mode === 'erase' ? 'erase' : 'over', box);
    if (st.mode === 'paint') T.addRecent(T.prefs.color);
    st = null;
  };

  T.brushCancel = function () {
    if (!st) return;
    if (st.smudge) { T.restoreSnap(st.L); T.clearLive(); st = null; return; }
    const sx = T.scratch.strokex;
    T.resetCtx(sx);
    sx.clearRect(0, 0, T.doc.w, T.doc.h);
    T.clearLive();
    st = null;
  };

  /* ---------- Difuminar: arrastra el color de la capa ---------- */
  let buf = null, bufx = null;
  function smudgeDown(L, cfg, p, pr, info) {
    T.beginEdit(L);
    T.setLive({ layerId: L.id });
    const size = cfg.size * (1 - cfg.sizeP + cfg.sizeP * pr);
    st = { smudge: true, L, cfg, px: p.x, py: p.y, sx: p.x, sy: p.y, ss: size, left: 0, box: { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, mask: getMasks('round', cfg.hard)[0] };
    return true;
  }
  function smudgeStep(x, y, size, strength) {
    const d = Math.max(2, Math.ceil(size)), r = d / 2, L = st.L;
    if (!buf || buf.width < d) { buf = T.mkCanvas(d, d); bufx = buf.getContext('2d'); }
    bufx.globalCompositeOperation = 'source-over';
    bufx.clearRect(0, 0, buf.width, buf.height);
    bufx.drawImage(L.canvas, st.px - r, st.py - r, d, d, 0, 0, d, d);
    bufx.globalCompositeOperation = 'destination-in';
    bufx.drawImage(st.mask, 0, 0, d, d);
    L.ctx.globalAlpha = strength;
    L.ctx.drawImage(buf, 0, 0, d, d, x - r, y - r, d, d);
    L.ctx.globalAlpha = 1;
    st.px = x; st.py = y;
    const b = st.box, m = r + 2;
    b.x0 = Math.min(b.x0, x - m); b.y0 = Math.min(b.y0, y - m); b.x1 = Math.max(b.x1, x + m); b.y1 = Math.max(b.y1, y + m);
  }
  function smudgeMove(p, info) {
    const c = st.cfg, pr = T.pressure(info), sm = (c.stab / 100) * 0.9;
    const nx = st.sx + (p.x - st.sx) * (1 - sm), ny = st.sy + (p.y - st.sy) * (1 - sm);
    const size = c.size * (1 - c.sizeP + c.sizeP * pr);
    const strength = (c.opacity / 100) * (1 - c.alphaP + c.alphaP * pr);
    const dist = Math.hypot(nx - st.sx, ny - st.sy);
    let d = st.left;
    while (d <= dist) {
      const t = dist ? d / dist : 0;
      smudgeStep(st.sx + (nx - st.sx) * t, st.sy + (ny - st.sy) * t, size, strength);
      d += Math.max(1, size * c.spacing);
    }
    st.left = d - dist;
    st.sx = nx; st.sy = ny;
    T.dirty();
  }
  function smudgeUp() {
    const L = st.L, b = st.box;
    const box = T.clampBox(b.x0, b.y0, b.x1, b.y1);
    T.constrainDirect(L, box);
    T.clearLive();
    if (box) T.endEdit(L, box);
    st = null;
  }

  /* ---------- Vista previa para la lista de pinceles ---------- */
  T.drawBrushPreview = function (canvas, cfg, color, mode) {
    const x = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    x.clearRect(0, 0, w, h);
    const tmp = T.mkCanvas(w, h), tx = tmp.getContext('2d');
    const c = Object.assign({}, cfg);
    c.size = Math.min(cfg.size, h * 0.42);
    if (cfg.tip === 'square' || cfg.size < 3) c.size = Math.max(cfg.size, 3);
    const k = new Stroker(tx, c, color, mode === 'erase' ? 'paint' : 'paint', null);
    let prev = null;
    const N = 60, taper = c.taper || c.sizeP > 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, px = 10 + t * (w - 20), py = h / 2 + Math.sin(t * Math.PI * 2) * h * 0.18;
      const pr = taper ? Math.max(0.12, Math.sin(t * Math.PI)) : 1;
      const s = c.size * (1 - c.sizeP + c.sizeP * pr) * (c.taper ? Math.max(0.15, Math.min(1, t * 5, (1 - t) * 4)) : 1);
      const a = 1 - c.alphaP + c.alphaP * pr;
      if (prev) k.seg(prev[0], prev[1], prev[2], prev[3], px, py, s, a);
      else k.stamp(px, py, s, a);
      prev = [px, py, s, a];
    }
    x.globalAlpha = (cfg.opacity || 100) / 100;
    x.drawImage(tmp, 0, 0);
    x.globalAlpha = 1;
  };
})();
