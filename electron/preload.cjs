// Preload script - executa em contexto isolado antes do renderer.
// Expõe uma API mínima e segura via contextBridge.
// O app é majoritariamente web (Supabase + fetch HTTPS), então não há
// canais IPC bidirecionais sensíveis. Mantemos a superfície de ataque mínima.

const { contextBridge, ipcRenderer, shell } = require('electron');

// Lista de canais IPC permitidos (whitelist) caso futuramente precisemos
// de comunicação main <-> renderer. Atualmente vazia por design.
const ALLOWED_SEND_CHANNELS = [];
const ALLOWED_INVOKE_CHANNELS = [];
const ALLOWED_RECEIVE_CHANNELS = [];

contextBridge.exposeInMainWorld('electronAPI', {
  // Metadados do ambiente
  isElectron: true,
  platform: process.platform,
  arch: process.arch,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Abrir links externos no navegador padrão do sistema
  openExternal: (url) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return shell.openExternal(url);
    }
    return Promise.reject(new Error('URL inválida'));
  },

  // IPC com whitelist (preparado para uso futuro)
  send: (channel, data) => {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: (channel, data) => {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Canal não permitido: ${channel}`));
  },
  on: (channel, listener) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      const subscription = (_event, ...args) => listener(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },
});
