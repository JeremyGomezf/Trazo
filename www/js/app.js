/* Trazo — arranque */
'use strict';
(function () {
  const T = window.T;

  window.addEventListener('error', (e) => {
    console.error(e.error || e.message);
    T.toast && T.toast('Algo falló: ' + (e.message || 'error desconocido'), 4000);
  });
  window.addEventListener('unhandledrejection', (e) => console.error(e.reason));

  function boot() {
    T.stage = T.$('#stage');
    T.viewCv = T.$('#view');
    T.overlayCv = T.$('#overlay');
    T.setupDoc(1200, 800);
    T.buildUI();
    T.bindInput();
    T.emit('history');
    document.documentElement.dataset.platform = T.platform;
    T.renderGallery();

    if (T.platform === 'web' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.claude) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
