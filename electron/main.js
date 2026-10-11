/* Trazo para escritorio (Windows, Linux, macOS) */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 520,
    title: 'Trazo',
    backgroundColor: '#14171d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // Los enlaces externos se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Permite pantalla completa; niega cámara, micrófono y demás
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
