const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');

// Auto-update via electron-updater (carregado de forma segura)
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (err) {
  console.warn('[updater] electron-updater não disponível:', err.message);
}

// Mantém referência global para evitar GC fechar a janela
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: path.join(__dirname, 'icon.ico'),
    title: 'Monitor de Rádios',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false, // mostra só após carregar para evitar flash branco
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Remove menu padrão (File/Edit/View...)
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abre links externos no navegador padrão, não dentro do Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============= AUTO-UPDATE =============
function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[updater] erro:', err == null ? 'unknown' : (err.stack || err).toString());
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] atualização disponível:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] já está na última versão');
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualização disponível',
      message: `Versão ${info.version} foi baixada.`,
      detail: 'Reinicie o aplicativo para aplicar a atualização.',
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Verifica ao iniciar e a cada 4h
  autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e));
  }, 4 * 60 * 60 * 1000);
}

// Garante apenas uma instância do app
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
