/* Trazo — filtros con vista previa en vivo sobre la capa actual (respetan la selección) */
'use strict';
(function () {
  const T = window.T, D = T.doc;

  /* ¿El navegador soporta ctx.filter? (Safari antiguo no) */
  let nativeBlur = null;
  function hasNativeBlur() {
    if (nativeBlur != null) return nativeBlur;
    try {
      const c = T.mkCanvas(9, 1), x = c.getContext('2d');
      x.filter = 'blur(2px)';
      x.fillStyle = '#000';
      x.fillRect(4, 0, 1, 1);
      nativeBlur = x.getImageData(1, 0, 1, 1).data[3] > 0;
    } catch (e) { nativeBlur = false; }
    return nativeBlur;
  }

  function boxes(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
    const out = [];
    for (let i = 0; i < n; i++) out.push(i < m ? wl : wu);
    return out;
  }
  function boxPass(src, dst, w, h, r, horiz) {
    const len = horiz ? w : h, lines = horiz ? h : w, iarr = 1 / (r + r + 1);
    for (let line = 0; line < lines; line++) {
      for (let ch = 0; ch < 4; ch++) {
        const idx = (k) => (horiz ? (line * w + k) * 4 + ch : (k * w + line) * 4 + ch);
        const fv = src[idx(0)], lv = src[idx(len - 1)];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += src[idx(Math.min(j, len - 1))];
        for (let k = 0; k < len; k++) {
          val += src[idx(Math.min(k + r, len - 1))] - (k - r - 1 >= 0 ? src[idx(k - r - 1)] : fv);
          dst[idx(k)] = val * iarr;
        }
        void lv;
      }
    }
  }
  function jsBlur(canvas, radius) {
    const w = canvas.width, h = canvas.height, x = canvas.getContext('2d');
    const img = x.getImageData(0, 0, w, h), d = img.data, n = w * h * 4;
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i += 4) {
      const al = d[i + 3] / 255;
      a[i] = d[i] * al; a[i + 1] = d[i + 1] * al; a[i + 2] = d[i + 2] * al; a[i + 3] = d[i + 3];
    }
    boxes(radius / 2, 3).forEach((bs) => {
      const r = (bs - 1) / 2;
      boxPass(a, b, w, h, r, true);
      boxPass(b, a, w, h, r, false);
    });
    for (let i = 0; i < n; i += 4) {
      const al = a[i + 3];
      d[i + 3] = al;
      if (al > 0.5) { const k = 255 / al; d[i] = a[i] * k; d[i + 1] = a[i + 1] * k; d[i + 2] = a[i + 2] * k; }
    }
    x.putImageData(img, 0, 0);
    return canvas;
  }
  T.blurCanvas = function (src, r) {
    const out = T.mkCanvas(src.width, src.height), x = out.getContext('2d');
    if (r <= 0) { x.drawImage(src, 0, 0); return out; }
    if (hasNativeBlur()) { x.filter = 'blur(' + r + 'px)'; x.drawImage(src, 0, 0); x.filter = 'none'; return out; }
    x.drawImage(src, 0, 0);
    return jsBlur(out, r);
  };

  /* Filtros por píxel: f(r,g,b,a,p) → modifica arreglo */
  function pixelFilter(fn) {
    return function (src, p, cache) {
      if (!cache.data) cache.data = src.getContext('2d').getImageData(0, 0, src.width, src.height);
      const out = T.mkCanvas(src.width, src.height), x = out.getContext('2d');
      const img = new ImageData(new Uint8ClampedArray(cache.data.data), src.width, src.height);
      fn(img.data, p, src.width, src.height);
      x.putImageData(img, 0, 0);
      return out;
    };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hslToRgb(h, s, l) {
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }

  T.FILTERS = [
    { id: 'blur', name: 'Desenfoque gaussiano', params: [{ k: 'r', label: 'Radio', min: 0, max: 80, v: 6, unit: ' px' }], run: (src, p) => T.blurCanvas(src, p.r) },
    {
      id: 'hsl', name: 'Tono, saturación y luminosidad',
      params: [{ k: 'h', label: 'Tono', min: -180, max: 180, v: 0, unit: '°' }, { k: 's', label: 'Saturación', min: -100, max: 100, v: 0 }, { k: 'l', label: 'Luminosidad', min: -100, max: 100, v: 0 }],
      run: pixelFilter((d, p) => {
        const dh = p.h / 360, ds = p.s / 100, dl = p.l / 100;
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
          h = (h + dh + 1) % 1;
          s = T.clamp(ds >= 0 ? s + (1 - s) * ds : s * (1 + ds), 0, 1);
          l = T.clamp(dl >= 0 ? l + (1 - l) * dl : l * (1 + dl), 0, 1);
          const c = hslToRgb(h, s, l);
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
      })
    },
    {
      id: 'bc', name: 'Brillo y contraste',
      params: [{ k: 'b', label: 'Brillo', min: -100, max: 100, v: 0 }, { k: 'c', label: 'Contraste', min: -100, max: 100, v: 0 }],
      run: pixelFilter((d, p) => {
        const b = p.b * 2.55, c = p.c * 2.55, f = (259 * (c + 255)) / (255 * (259 - c));
        for (let i = 0; i < d.length; i += 4) {
          d[i] = f * (d[i] + b - 128) + 128; d[i + 1] = f * (d[i + 1] + b - 128) + 128; d[i + 2] = f * (d[i + 2] + b - 128) + 128;
        }
      })
    },
    {
      id: 'curves', name: 'Niveles',
      params: [{ k: 'lo', label: 'Sombras', min: 0, max: 200, v: 0 }, { k: 'hi', label: 'Luces', min: 55, max: 255, v: 255 }, { k: 'g', label: 'Medios', min: 20, max: 300, v: 100, unit: '%' }],
      run: pixelFilter((d, p) => {
        const lut = new Uint8ClampedArray(256), range = Math.max(1, p.hi - p.lo), gm = 100 / p.g;
        for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(T.clamp((v - p.lo) / range, 0, 1), gm);
        for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
      })
    },
    { id: 'invert', name: 'Invertir colores', params: [], run: pixelFilter((d) => { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }) },
    {
      id: 'gray', name: 'Escala de grises', params: [{ k: 'a', label: 'Intensidad', min: 0, max: 100, v: 100, unit: '%' }],
      run: pixelFilter((d, p) => {
        const k = p.a / 100;
        for (let i = 0; i < d.length; i += 4) {
          const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] += (y - d[i]) * k; d[i + 1] += (y - d[i + 1]) * k; d[i + 2] += (y - d[i + 2]) * k;
        }
      })
    },
    {
      id: 'sepia', name: 'Sepia', params: [{ k: 'a', label: 'Intensidad', min: 0, max: 100, v: 80, unit: '%' }],
      run: pixelFilter((d, p) => {
        const k = p.a / 100;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          d[i] = r + (0.393 * r + 0.769 * g + 0.189 * b - r) * k;
          d[i + 1] = g + (0.349 * r + 0.686 * g + 0.168 * b - g) * k;
          d[i + 2] = b + (0.272 * r + 0.534 * g + 0.131 * b - b) * k;
        }
      })
    },
    {
      id: 'posterize', name: 'Posterizar', params: [{ k: 'n', label: 'Niveles', min: 2, max: 16, v: 5 }],
      run: pixelFilter((d, p) => {
        const s = 255 / (p.n - 1);
        for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / s) * s; d[i + 1] = Math.round(d[i + 1] / s) * s; d[i + 2] = Math.round(d[i + 2] / s) * s; }
      })
    },
    {
      id: 'threshold', name: 'Binarizar (blanco y negro)', params: [{ k: 't', label: 'Umbral', min: 1, max: 254, v: 128 }],
      run: pixelFilter((d, p) => {
        for (let i = 0; i < d.length; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] >= p.t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
      })
    },
    {
      id: 'lineart', name: 'Extraer línea', note: 'Convierte un boceto o una foto de papel en líneas sobre fondo transparente.',
      params: [{ k: 's', label: 'Fuerza', min: 0, max: 100, v: 50 }, { k: 'keep', label: 'Mantener colores originales', type: 'check', v: false }],
      run: pixelFilter((d, p) => {
        const gain = 1 + p.s / 22;
        for (let i = 0; i < d.length; i += 4) {
          const oa = d[i + 3] / 255;
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const a = T.clamp((1 - lum / 255 - 0.03) * gain, 0, 1) * oa;
          if (p.keep && a > 0.01) {
            d[i] = T.clamp((d[i] - (1 - a) * 255) / a, 0, 255);
            d[i + 1] = T.clamp((d[i + 1] - (1 - a) * 255) / a, 0, 255);
            d[i + 2] = T.clamp((d[i + 2] - (1 - a) * 255) / a, 0, 255);
          } else { d[i] = d[i + 1] = d[i + 2] = 0; }
          d[i + 3] = a * 255;
        }
      })
    },
    {
      id: 'mosaic', name: 'Mosaico (pixelar)', params: [{ k: 'n', label: 'Tamaño', min: 2, max: 80, v: 10, unit: ' px' }],
      run: (src, p) => {
        const w = Math.max(1, Math.round(src.width / p.n)), h = Math.max(1, Math.round(src.height / p.n));
        const s = T.mkCanvas(w, h), sx = s.getContext('2d');
        sx.imageSmoothingQuality = 'high';
        sx.drawImage(src, 0, 0, w, h);
        const out = T.mkCanvas(src.width, src.height), x = out.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(s, 0, 0, src.width, src.height);
        return out;
      }
    },
    {
      id: 'sharpen', name: 'Enfocar', params: [{ k: 'a', label: 'Cantidad', min: 0, max: 300, v: 80, unit: '%' }],
      run: (src, p, cache) => {
        if (!cache.data) cache.data = src.getContext('2d').getImageData(0, 0, src.width, src.height);
        if (!cache.blur) cache.blur = T.blurCanvas(src, 2).getContext('2d').getImageData(0, 0, src.width, src.height).data;
        const o = cache.data.data, bl = cache.blur, k = p.a / 100;
        const img = new ImageData(new Uint8ClampedArray(o), src.width, src.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = o[i] + (o[i] - bl[i]) * k; d[i + 1] = o[i + 1] + (o[i + 1] - bl[i + 1]) * k; d[i + 2] = o[i + 2] + (o[i + 2] - bl[i + 2]) * k;
        }
        const out = T.mkCanvas(src.width, src.height);
        out.getContext('2d').putImageData(img, 0, 0);
        return out;
      }
    },
    {
      id: 'noise', name: 'Ruido', params: [{ k: 'a', label: 'Cantidad', min: 0, max: 100, v: 20, unit: '%' }, { k: 'mono', label: 'Monocromático', type: 'check', v: true }],
      run: pixelFilter((d, p) => {
        const k = p.a * 1.6;
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          if (p.mono) { const n = (Math.random() - 0.5) * k; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
          else { d[i] += (Math.random() - 0.5) * k; d[i + 1] += (Math.random() - 0.5) * k; d[i + 2] += (Math.random() - 0.5) * k; }
        }
      })
    },
    {
      id: 'outline', name: 'Contorno exterior', note: 'Usa el color actual. Ideal para stickers y texto.',
      params: [{ k: 'w', label: 'Grosor', min: 1, max: 40, v: 6, unit: ' px' }],
      run: (src, p) => {
        const out = T.mkCanvas(src.width, src.height), x = out.getContext('2d');
        const rings = p.w > 4 ? [p.w, p.w * 0.66, p.w * 0.33] : [p.w];
        rings.forEach((r) => {
          const n = Math.max(12, Math.ceil(r * 2.2));
          for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; x.drawImage(src, Math.cos(a) * r, Math.sin(a) * r); }
        });
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = T.prefs.color;
        x.fillRect(0, 0, out.width, out.height);
        x.globalCompositeOperation = 'source-over';
        x.drawImage(src, 0, 0);
        return out;
      }
    },
    {
      id: 'glow', name: 'Resplandor', note: 'Usa el color actual.',
      params: [{ k: 'r', label: 'Radio', min: 1, max: 80, v: 16, unit: ' px' }, { k: 'a', label: 'Intensidad', min: 10, max: 300, v: 140, unit: '%' }],
      run: (src, p) => {
        const b = T.blurCanvas(src, p.r), bx = b.getContext('2d');
        bx.globalCompositeOperation = 'source-in';
        bx.fillStyle = T.prefs.color;
        bx.fillRect(0, 0, b.width, b.height);
        const out = T.mkCanvas(src.width, src.height), x = out.getContext('2d');
        let k = p.a / 100;
        while (k > 0) { x.globalAlpha = Math.min(1, k); x.drawImage(b, 0, 0); k -= 1; }
        x.globalAlpha = 1;
        x.drawImage(src, 0, 0);
        return out;
      }
    }
  ];

  T.openFilter = function (def) {
    if (T.xf.active) T.xfCommit();
    const L = T.active();
    if (!L.visible) { T.toast('La capa está oculta'); return; }
    if (!T.alphaBox(L.canvas)) { T.toast('La capa está vacía. Elige la capa que quieres editar.'); return; }
    const src = T.cloneCanvas(L.canvas), cache = {};
    const vals = {};
    def.params.forEach((p) => (vals[p.k] = p.v));
    const preview = T.mkCanvas(D.w, D.h), px = preview.getContext('2d');
    let pending = false;
    const compute = () => {
      pending = false;
      const r = def.run(src, vals, cache);
      T.resetCtx(px);
      px.clearRect(0, 0, D.w, D.h);
      if (T.sel.active) {
        px.drawImage(src, 0, 0);
        px.globalCompositeOperation = 'destination-out';
        px.drawImage(T.sel.mask, 0, 0);
        const t = T.cloneCanvas(r), tx = t.getContext('2d');
        tx.globalCompositeOperation = 'destination-in';
        tx.drawImage(T.sel.mask, 0, 0);
        px.globalCompositeOperation = 'source-over';
        px.drawImage(t, 0, 0);
      } else px.drawImage(r, 0, 0);
      T.dirty();
    };
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(compute); } };
    T.setLive({ layerId: L.id, preview });
    const body = T.el('div', { class: 'stack' });
    if (def.note) body.append(T.el('p', { class: 'note', text: def.note }));
    def.params.forEach((p) => {
      if (p.type === 'check') body.append(T.check({ label: p.label, value: p.v, onChange: (v) => { vals[p.k] = v; schedule(); } }));
      else body.append(T.slider({ label: p.label, min: p.min, max: p.max, value: p.v, unit: p.unit, onInput: (v) => { vals[p.k] = v; schedule(); } }));
    });
    if (!def.params.length) body.append(T.el('p', { class: 'note', text: 'Así se verá la capa. Aplica para confirmar.' }));
    let applied = false;
    T.dialog({
      title: def.name, body, sheet: true,
      onClose: () => { if (!applied) T.clearLive(); },
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Aplicar', primary: true, action: () => {
            if (pending) compute();
            applied = true;
            T.beginEdit(L);
            T.resetCtx(L.ctx);
            L.ctx.clearRect(0, 0, D.w, D.h);
            L.ctx.drawImage(preview, 0, 0);
            const a = T.alphaBox(S0(src)), b = T.alphaBox(preview);
            let box = T.fullBox();
            if (a && b) box = T.clampBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x + a.w, b.x + b.w), Math.max(a.y + a.h, b.y + b.h));
            else if (a || b) box = a || b;
            T.clearLive();
            T.endEdit(L, box || T.fullBox());
          }
        }
      ]
    });
    compute();
  };
  const S0 = (c) => c;
})();
