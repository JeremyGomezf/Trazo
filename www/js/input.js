/* Trazo — entrada: lápiz, dedos, mouse, gestos, teclado, pegar y arrastrar archivos */
'use strict';
(function () {
  const T = window.T, P = T.prefs;

  let act = null;            // acción en curso con un puntero
  const touches = new Map(); // dedos sobre el lienzo
  let gest = null;           // gesto de varios dedos
  let lpTimer = 0;           // mantener presionado → cuentagotas
  let spaceDown = false;

  const stagePt = (e) => { const r = T.stageRect || T.updateStageRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function info(e, sp) {
    const pen = e.pointerType === 'pen';
    let pr = e.pressure;
    if (pen && !(pr > 0)) pr = 0.3;
    return { pressure: pr, hasPressure: pen, pointerType: e.pointerType, sx: sp.x, sy: sp.y, shift: e.shiftKey, alt: e.altKey };
  }
  const isUI = (t) => !!(t.closest && t.closest('.optbar,.xfbar,.quick,.zoomPill,.float'));

  /* ---------- Contorno del pincel ---------- */
  const cursor = () => T.$('#cursor');
  function updateCursor(e, sp) {
    const c = cursor();
    const show = P.showCursor && e.pointerType !== 'touch' && T.isBrushTool(P.tool) && !spaceDown && !(act && act.kind === 'pan');
    if (!show) { c.hidden = true; return; }
    const b = T.currentBrush(P.tool), d = Math.max(4, b.size * T.view.s);
    c.hidden = false;
    c.style.width = c.style.height = d + 'px';
    c.style.transform = 'translate(' + (sp.x - d / 2) + 'px,' + (sp.y - d / 2) + 'px)';
  }

  /* ---------- Inicio de una acción ---------- */
  function startTool(tool, e, sp) {
    const impl = T.TOOL_IMPL[tool];
    if (!impl) return;
    const p = T.toDoc(sp.x, sp.y);
    const inf = info(e, sp);
    const ok = impl.down(p, inf);
    if (ok === false) return;
    act = { kind: 'tool', tool, impl, pid: e.pointerId, ptype: e.pointerType, sp0: sp, last: sp };
    if (e.pointerType === 'touch' && P.longPressPick && T.isBrushTool(tool)) {
      lpTimer = setTimeout(() => {
        lpTimer = 0;
        if (!act || act.kind !== 'tool') return;
        impl.cancel && impl.cancel();
        act = { kind: 'pick', pid: act.pid, ptype: 'touch', last: act.last };
        T.pickColor(T.toDoc(act.last.x, act.last.y));
        T.showLoupe(act.last.x, act.last.y);
      }, 480);
    }
  }
  function clearLp() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = 0; } }
  function cancelAct() {
    clearLp();
    if (!act) return;
    if (act.kind === 'tool' && act.impl.cancel) act.impl.cancel();
    if (act.kind === 'pick') T.hideLoupe();
    act = null;
  }

  function onDown(e) {
    if (isUI(e.target)) return;
    if (T.$('#panel').classList.contains('open') && T.isNarrow()) { T.closeSheet(); return; }
    T.closeMenu();
    T.updateStageRect();
    const sp = stagePt(e);
    if (e.pointerType === 'pen' && !P.penSeen) {
      P.penSeen = true;
      P.penOnly = true;
      T.savePrefs();
      T.toast('Lápiz detectado: ahora los dedos solo mueven y hacen zoom. Puedes cambiarlo en Ajustes.', 4500);
    }
    try { T.stage.setPointerCapture(e.pointerId); } catch (err) { /* puntero sintético */ }

    if (e.pointerType === 'touch') {
      if (act && act.ptype === 'pen') return; // palma mientras dibuja con lápiz
      touches.set(e.pointerId, { x: sp.x, y: sp.y });
      if (touches.size === 1) gest = { t0: performance.now(), maxN: 1, moved: 0, pinch: null };
      else if (gest) gest.maxN = Math.max(gest.maxN, touches.size);
      if (touches.size >= 2) {
        if (act && act.kind !== 'gesture') cancelAct();
        act = { kind: 'gesture' };
        startPinch();
        return;
      }
      if (P.penOnly && P.tool !== 'move') { act = { kind: 'pan', pid: e.pointerId, ptype: 'touch', last: sp }; return; }
    }
    if (act) return;

    const tool = T.dialogOpen ? 'hand' : P.tool;
    const panBtn = (e.pointerType === 'mouse' && e.button === 1) || spaceDown || tool === 'hand';
    if (panBtn) { act = { kind: 'pan', pid: e.pointerId, ptype: e.pointerType, last: sp }; T.stage.classList.add('panning'); return; }
    if ((e.pointerType === 'mouse' && e.button === 2) || (e.pointerType === 'pen' && (e.button === 2 || e.buttons & 2)) || (e.altKey && tool !== 'select')) {
      act = { kind: 'pick', pid: e.pointerId, ptype: e.pointerType, last: sp };
      T.pickColor(T.toDoc(sp.x, sp.y));
      T.showLoupe(sp.x, sp.y);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (T.ruler.mode !== 'none' && T.isBrushTool(tool)) {
      const c = T.rulerCenter(), sc = T.toStage(c.x, c.y);
      if (Math.hypot(sc.x - sp.x, sc.y - sp.y) < (e.pointerType === 'touch' ? 24 : 12)) { act = { kind: 'ruler', pid: e.pointerId, ptype: e.pointerType }; return; }
    }
    if (e.pointerType === 'pen' && e.buttons & 32) { startTool('eraser', e, sp); return; }
    startTool(tool, e, sp);
  }

  function startPinch() {
    const pts = Array.from(touches.values()).slice(0, 2);
    const a = pts[0], b = pts[1];
    gest.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, rot: 0 };
  }
  function movePinch() {
    const pts = Array.from(touches.values());
    if (pts.length < 2 || !gest.pinch) return;
    const a = pts[0], b = pts[1], g = gest.pinch;
    const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    gest.moved += Math.hypot(mx - g.mx, my - g.my) + Math.abs(d - g.d);
    T.view.x += mx - g.mx;
    T.view.y += my - g.my;
    if (g.d > 0) {
      const p = T.toDoc(mx, my);
      T.view.s = T.clamp(T.view.s * (d / g.d), 0.03, 32);
      let dr = ang - g.ang;
      if (dr > Math.PI) dr -= 2 * Math.PI;
      if (dr < -Math.PI) dr += 2 * Math.PI;
      if (P.rotateGesture) { g.rot += dr; if (Math.abs(g.rot) > 0.12 || Math.abs(T.view.r) > 0.001) T.view.r += dr; }
      const m = T.viewMatrix();
      T.view.x = mx - (m[0] * p.x + m[2] * p.y);
      T.view.y = my - (m[1] * p.x + m[3] * p.y);
    }
    Object.assign(g, { d, ang, mx, my });
    T.applyView();
  }

  function onMove(e) {
    const sp = stagePt(e);
    updateCursor(e, sp);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      const t = touches.get(e.pointerId);
      if (gest) gest.moved += Math.hypot(sp.x - t.x, sp.y - t.y) * (touches.size > 1 ? 0 : 1);
      t.x = sp.x; t.y = sp.y;
      if (act && act.kind === 'gesture') { movePinch(); return; }
    }
    if (!act || act.pid !== e.pointerId) return;
    if (lpTimer && Math.hypot(sp.x - act.sp0.x, sp.y - act.sp0.y) > 8) clearLp();
    act.last = sp;
    if (act.kind === 'pan') {
      T.panBy(sp.x - act.lastPan.x, sp.y - act.lastPan.y);
      act.lastPan = sp;
    } else if (act.kind === 'pick') {
      T.pickColor(T.toDoc(sp.x, sp.y));
      T.showLoupe(sp.x, sp.y);
    } else if (act.kind === 'ruler') {
      const p = T.toDoc(sp.x, sp.y);
      T.ruler.cx = T.clamp(p.x, 0, T.doc.w);
      T.ruler.cy = T.clamp(p.y, 0, T.doc.h);
      T.dirtyOv();
    } else if (act.kind === 'tool' && act.impl.move) {
      const evs = T.isBrushTool(act.tool) && e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      const list = evs && evs.length ? evs : [e];
      for (const ev of list) {
        const s2 = stagePt(ev);
        act.impl.move(T.toDoc(s2.x, s2.y), info(ev, s2));
      }
    }
  }

  function onUp(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.delete(e.pointerId);
      if (act && act.kind === 'gesture') {
        if (touches.size === 0) {
          const dur = performance.now() - gest.t0;
          if (P.tapGestures && dur < 400 && gest.moved < 24) {
            if (gest.maxN === 2) { T.undo(); T.toast('Deshacer', 900); }
            else if (gest.maxN === 3) { T.redo(); T.toast('Rehacer', 900); }
          }
          if (Math.abs(T.view.r) < 0.07 && T.view.r !== 0) T.setRotation(0);
          act = null;
          gest = null;
        } else if (touches.size >= 2) startPinch();
        return;
      }
    }
    if (!act || act.pid !== e.pointerId) return;
    clearLp();
    const a = act;
    act = null;
    T.stage.classList.remove('panning');
    if (a.kind === 'tool') {
      const sp = stagePt(e);
      if (e.type === 'pointercancel') a.impl.cancel && a.impl.cancel();
      else a.impl.up && a.impl.up(T.toDoc(sp.x, sp.y), info(e, sp));
    } else if (a.kind === 'pick') { T.hideLoupe(); T.addRecent(P.color); }
  }

  /* ---------- Teclado ---------- */
  function onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (T.$('#app').hidden || T.dialogOpen) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? T.redo() : T.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); T.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); T.exportDialog(); return; }
    if (mod && k === 'a') { e.preventDefault(); T.selAll(); return; }
    if (mod && k === 'd') { e.preventDefault(); T.selNone(); return; }
    if (mod && e.shiftKey && k === 'i') { e.preventDefault(); T.selInvert(); return; }
    if (mod && k === 'j') { e.preventDefault(); T.duplicateLayer(T.active()); return; }
    if (mod && k === 'e') { e.preventDefault(); T.mergeDown(T.active()); return; }
    if (mod && e.shiftKey && k === 'n') { e.preventDefault(); T.addLayer(); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Enter' && T.xf.active) { T.xfCommit(); T.setTool(P.lastBrushTool || 'brush'); return; }
    if (e.key === 'Escape') { if (T.xf.active) { T.xfCancel(); T.setTool(P.lastBrushTool || 'brush'); } else T.selNone(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); T.clearLayer(T.active()); return; }
    if (e.key === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; T.stage.classList.add('spacepan'); cursor().hidden = true; } return; }
    if (k === '[' || k === ']') {
      if (!T.isBrushTool(P.tool)) return;
      const b = T.currentBrush(P.tool);
      const n = k === ']' ? Math.max(b.size + 1, Math.round(b.size * 1.15)) : Math.min(b.size - 1, Math.round(b.size / 1.15));
      T.setBrushValue(b, 'size', T.clamp(n, 1, 400));
      T.refreshQuick();
      return;
    }
    if (k === '0') { T.fitView(); return; }
    if (k === '1') { T.setZoom(1); return; }
    if (k === '+' || k === '=') { T.zoomCenter(1.25); return; }
    if (k === '-') { T.zoomCenter(0.8); return; }
    if (k === 'x') { T.swapColors(); return; }
    if (k === 'm') { T.toggleFlipView(); return; }
    if (k === 'r') { T.setRotation(e.shiftKey ? 0 : T.view.r + Math.PI / 12); return; }
    const t = T.TOOLS.find((x) => x.key === k);
    if (t) T.setTool(t.id);
  }
  function onKeyUp(e) {
    if (e.key === ' ' && spaceDown) { spaceDown = false; T.stage.classList.remove('spacepan'); }
  }

  T.bindInput = function () {
    const s = T.stage;
    s.addEventListener('pointerdown', (e) => { onDown(e); if (act && act.kind === 'pan') act.lastPan = stagePt(e); });
    s.addEventListener('pointermove', onMove);
    s.addEventListener('pointerup', onUp);
    s.addEventListener('pointercancel', onUp);
    s.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') cursor().hidden = true; });
    s.addEventListener('contextmenu', (e) => e.preventDefault());
    s.addEventListener('wheel', (e) => {
      e.preventDefault();
      const sp = stagePt(e);
      if (e.shiftKey && !e.ctrlKey) { T.panBy(-e.deltaY, 0); return; }
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) { T.panBy(-e.deltaX, 0); return; }
      T.zoomAt(sp.x, sp.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
    }, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { spaceDown = false; T.stage.classList.remove('spacepan'); });
    window.addEventListener('resize', T.debounce(() => { T.updateStageRect(); T.dirtyOv(); }, 100));

    // Pegar una imagen
    window.addEventListener('paste', (e) => {
      if (T.$('#app').hidden || T.dialogOpen) return;
      const it = Array.from((e.clipboardData && e.clipboardData.items) || []).find((i) => i.type.indexOf('image/') === 0);
      if (it) { e.preventDefault(); T.importLayerFile(it.getAsFile()); }
    });
    // Arrastrar archivos
    document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (!T.$('#app').hidden && f.type.indexOf('image/') === 0) T.importLayerFile(f);
      else T.importAnyFile(f);
    });
  };
})();
