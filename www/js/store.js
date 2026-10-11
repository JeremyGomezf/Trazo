/* Trazo — galería en IndexedDB, autoguardado, proyectos .trazo y guardar/compartir según la plataforma */
'use strict';
(function () {
  const T = window.T, D = T.doc;

  /* ---------- Base de datos ---------- */
  let db = null;
  const mem = { meta: new Map(), data: new Map() };
  T.dbReady = new Promise((res) => {
    try {
      const r = indexedDB.open('trazo', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id' });
        r.result.createObjectStore('data', { keyPath: 'id' });
      };
      r.onsuccess = () => { db = r.result; res(true); };
      r.onerror = () => res(false);
      r.onblocked = () => res(false);
    } catch (e) { res(false); }
  });
  T.dbReady.then((ok) => {
    if (!ok) T.toast('Este navegador no permite guardar dibujos. Exporta tu trabajo antes de cerrar.', 5000);
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignorar */ }
  });
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function store(name, mode) { await T.dbReady; return db ? db.transaction(name, mode).objectStore(name) : null; }

  T.dbList = async function () {
    const s = await store('meta', 'readonly');
    const all = s ? await req(s.getAll()) : Array.from(mem.meta.values());
    return all.sort((a, b) => b.updated - a.updated);
  };
  T.dbGet = async function (name, id) {
    const s = await store(name, 'readonly');
    return s ? req(s.get(id)) : mem[name].get(id);
  };
  T.dbPut = async function (name, val) {
    const s = await store(name, 'readwrite');
    if (s) return req(s.put(val));
    mem[name].set(val.id, val);
  };
  T.dbDelete = async function (id) {
    for (const n of ['meta', 'data']) {
      const s = await store(n, 'readwrite');
      if (s) await req(s.delete(id)); else mem[n].delete(id);
    }
  };

  /* Se usa toDataURL (síncrono) porque en el WebView de Android canvas.toBlob tarda ~4 s fijos por llamada */
  const toBlob = (c, type, q) => {
    type = type || 'image/png';
    const u = c.toDataURL(type, q), bin = atob(u.slice(u.indexOf(',') + 1));
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return Promise.resolve(new Blob([arr], { type }));
  };
  T.toBlob = toBlob;
  async function blobToCanvasImage(blob) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob); } catch (e) { /* usar Image */ }
    }
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(blob), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = (e) => { URL.revokeObjectURL(u); rej(e); };
      im.src = u;
    });
  }
  T.loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  T.newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- Guardado del dibujo abierto ---------- */
  const blobCache = new Map();
  let saving = false, again = false;
  T.saveCurrent = async function () {
    if (!D.id) return;
    if (saving) { again = true; return; }
    saving = true;
    try {
      const layers = [];
      for (const L of D.layers) {
        let e = blobCache.get(L.id);
        if (!e || e.rev !== L.rev) { e = { rev: L.rev, blob: await toBlob(L.canvas) }; blobCache.set(L.id, e); }
        layers.push({ name: L.name, visible: L.visible, opacity: L.opacity, blend: L.blend, clip: L.clip, lockAlpha: L.lockAlpha, png: e.blob });
      }
      const k = Math.min(1, 420 / Math.max(D.w, D.h));
      const thumb = await toBlob(T.composite(false, k), 'image/jpeg', 0.86);
      await T.dbPut('data', { id: D.id, bg: D.bg, transparent: D.transparent, active: Math.max(0, T.layerIndex(T.active())), layers });
      await T.dbPut('meta', { id: D.id, name: D.name, w: D.w, h: D.h, created: D.created, updated: Date.now(), thumb, layerCount: layers.length });
      T.emit('saved');
    } catch (e) {
      console.error(e);
      T.toast('No se pudo guardar el dibujo. Revisa el espacio libre del dispositivo.');
    } finally {
      saving = false;
      if (again) { again = false; T.saveCurrent(); }
    }
  };
  const autosave = T.debounce(() => T.saveCurrent(), 1800);
  T.on('changed', () => { if (D.id) autosave(); });
  T.flushSave = async function () {
    autosave.cancel();
    for (let i = 0; saving && i < 300; i++) await new Promise((r) => setTimeout(r, 30));
    await T.saveCurrent();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && D.id) T.flushSave(); });
  window.addEventListener('pagehide', () => { if (D.id) T.flushSave(); });

  /* ---------- Abrir y crear ---------- */
  function resetEditorState() {
    blobCache.clear();
    T.ruler.cx = T.ruler.cy = null;
    if (T.xf.active) { T.xf.active = false; }
    T.toolOv = null;
  }
  T.openArtwork = async function (id) {
    const meta = await T.dbGet('meta', id), data = await T.dbGet('data', id);
    if (!meta || !data) { T.toast('No se encontró ese dibujo'); return false; }
    resetEditorState();
    T.setupDoc(meta.w, meta.h, { id, name: meta.name, bg: data.bg, transparent: data.transparent, created: meta.created });
    for (const l of data.layers) {
      const L = T.newLayer(l.name);
      Object.assign(L, { visible: l.visible !== false, opacity: l.opacity == null ? 1 : l.opacity, blend: l.blend || 'normal', clip: !!l.clip, lockAlpha: !!l.lockAlpha });
      if (l.png) { const im = await blobToCanvasImage(l.png); L.ctx.drawImage(im, 0, 0); blobCache.set(L.id, { rev: L.rev, blob: l.png }); }
      D.layers.push(L);
    }
    D.seq = D.layers.length;
    if (!D.layers.length) D.layers.push(T.newLayer());
    D.activeId = (D.layers[data.active] || D.layers[D.layers.length - 1]).id;
    T.emit('layers');
    T.showEditor();
    return true;
  };
  T.newArtwork = async function (w, h, o) {
    o = o || {};
    resetEditorState();
    T.setupDoc(w, h, { id: T.newId(), name: o.name || 'Dibujo ' + new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }), bg: o.bg || '#ffffff', transparent: !!o.transparent });
    if (o.image) {
      const base = T.newLayer('Imagen');
      base.ctx.imageSmoothingQuality = 'high';
      base.ctx.drawImage(o.image, 0, 0, w, h);
      D.layers.push(base);
    }
    const L = T.newLayer();
    D.layers.push(L);
    D.activeId = L.id;
    T.emit('layers');
    T.showEditor();
    await T.saveCurrent();
  };
  T.renameCurrent = async function (name) {
    D.name = name;
    T.emit('docname');
    await T.saveCurrent();
  };
  T.renameArtwork = async function (id, name) {
    const m = await T.dbGet('meta', id);
    if (!m) return;
    m.name = name;
    await T.dbPut('meta', m);
    if (D.id === id) { D.name = name; T.emit('docname'); }
  };
  T.duplicateArtwork = async function (id) {
    if (D.id === id) await T.flushSave();
    const m = await T.dbGet('meta', id), d = await T.dbGet('data', id);
    if (!m || !d) return;
    const nid = T.newId();
    await T.dbPut('data', Object.assign({}, d, { id: nid }));
    await T.dbPut('meta', Object.assign({}, m, { id: nid, name: m.name + ' (copia)', created: Date.now(), updated: Date.now() }));
  };

  /* ---------- Proyecto .trazo (JSON con capas PNG) ---------- */
  T.projectJSON = function () {
    return JSON.stringify({
      format: 'trazo', v: 2, name: D.name, w: D.w, h: D.h, bg: D.bg, transparent: D.transparent, active: T.layerIndex(T.active()),
      layers: D.layers.map((L) => ({ name: L.name, visible: L.visible, opacity: L.opacity, blend: L.blend, clip: L.clip, lockAlpha: L.lockAlpha, data: L.canvas.toDataURL('image/png') }))
    });
  };
  T.importProject = async function (obj) {
    const w = Math.round(obj.w), h = Math.round(obj.h);
    if (!(w >= 16 && h >= 16 && w <= 8192 && h <= 8192) || !Array.isArray(obj.layers) || !obj.layers.length) throw new Error('formato');
    resetEditorState();
    T.setupDoc(w, h, { id: T.newId(), name: String(obj.name || 'Proyecto importado').slice(0, 60), bg: obj.bg || '#ffffff', transparent: !!obj.transparent });
    for (const l of obj.layers.slice(0, 100)) {
      const L = T.newLayer(String(l.name || '').slice(0, 60) || undefined);
      Object.assign(L, { visible: l.visible !== false, opacity: typeof l.opacity === 'number' ? T.clamp(l.opacity, 0, 1) : 1, blend: l.blend || 'normal', clip: !!l.clip, lockAlpha: !!l.lockAlpha });
      if (typeof l.data === 'string' && l.data.indexOf('data:image/') === 0) L.ctx.drawImage(await T.loadImage(l.data), 0, 0);
      D.layers.push(L);
    }
    D.seq = D.layers.length;
    const ai = typeof obj.active === 'number' && D.layers[obj.active] ? obj.active : D.layers.length - 1;
    D.activeId = D.layers[ai].id;
    T.emit('layers');
    T.showEditor();
    await T.saveCurrent();
  };

  /* ---------- Guardar y compartir archivos ---------- */
  const blobToBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const capPlugin = (n) => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n];
  let artifactDownloads;
  async function artifactCap() {
    if (artifactDownloads !== undefined) return artifactDownloads;
    artifactDownloads = null;
    try { if (window.claude && window.claude.use) artifactDownloads = await window.claude.use('downloads'); } catch (e) { artifactDownloads = null; }
    return artifactDownloads;
  }

  T.saveFile = async function (filename, blob) {
    if (T.platform === 'android') {
      const FS = capPlugin('Filesystem');
      if (FS) {
        try {
          await FS.writeFile({ path: 'Trazo/' + filename, data: await blobToBase64(blob), directory: 'DOCUMENTS', recursive: true });
          T.toast('Guardado en Documentos/Trazo');
          return true;
        } catch (e) {
          return T.shareFile(filename, blob);
        }
      }
    }
    const cap = await artifactCap();
    if (cap) {
      try { await cap.save({ filename, data: blob }); T.toast('Guardado'); return true; }
      catch (e) { if (e && e.code === 'declined') return false; }
    }
    const u = URL.createObjectURL(blob), a = T.el('a', { href: u, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    T.toast('Descargado: ' + filename);
    return true;
  };
  T.canShare = function () {
    if (T.platform === 'android') return !!capPlugin('Share');
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })); } catch (e) { return false; }
  };
  T.shareFile = async function (filename, blob) {
    try {
      if (T.platform === 'android') {
        const FS = capPlugin('Filesystem'), SH = capPlugin('Share');
        const r = await FS.writeFile({ path: filename, data: await blobToBase64(blob), directory: 'CACHE' });
        await SH.share({ title: filename, files: [r.uri], dialogTitle: 'Compartir o guardar' });
        return true;
      }
      const f = new File([blob], filename, { type: blob.type });
      await navigator.share({ files: [f], title: filename });
      return true;
    } catch (e) {
      if (e && (e.name === 'AbortError' || /cancel/i.test(String(e.message)))) return false;
      return T.saveFile(filename, blob);
    }
  };
  T.fileStamp = function () {
    const d = new Date(), p = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  };
  T.safeName = (s) => (s || 'trazo').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) || 'trazo';

  T.exportBlob = async function (kind, scale) {
    if (kind === 'project') return new Blob([T.projectJSON()], { type: 'application/json' });
    const c = T.composite(kind === 'png-t', scale || 1);
    return kind === 'jpg' ? toBlob(c, 'image/jpeg', 0.92) : toBlob(c, 'image/png');
  };
  T.exportName = (kind) => T.safeName(D.name) + '-' + T.fileStamp() + (kind === 'project' ? '.trazo' : kind === 'jpg' ? '.jpg' : '.png');
})();
