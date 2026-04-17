// Preload script - executa em contexto isolado antes do renderer
// Como o app é majoritariamente web (Supabase + fetch via HTTPS),
// não há canais IPC customizados necessários no momento.
// Este arquivo expõe apenas metadados seguros via contextBridge.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});
