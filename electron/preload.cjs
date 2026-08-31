// Preload runs in an isolated context with access to a limited Node API.
// Expose only the explicit allowlist the renderer is permitted to call.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appRuntime', {
  isPackaged: process.versions.electron !== undefined,
  platform: process.platform,

  // --- Dictionary -------------------------------------------------------
  preloadDictionary: () => ipcRenderer.invoke('dictionary:preload'),
  checkDictionary: (input) => ipcRenderer.invoke('dictionary:check', input),

  // --- Bitwarden CLI ----------------------------------------------------
  bitwardenStatus: () => ipcRenderer.invoke('bitwarden:status'),
  bitwardenConfig: (serverUrl) => ipcRenderer.invoke('bitwarden:config', serverUrl),
  bitwardenLogin: (creds) => ipcRenderer.invoke('bitwarden:login', creds),
  bitwardenMfa: (data) => ipcRenderer.invoke('bitwarden:mfa', data),
  bitwardenSave: (item) => ipcRenderer.invoke('bitwarden:save', item),

  // --- Bitwarden installation -------------------------------------------
  installBitwardenWindows: () => ipcRenderer.invoke('bitwarden:installWindows'),
  installBitwardenCli: () => ipcRenderer.invoke('bitwarden:installCli'),
  checkCliInstalled: () => ipcRenderer.invoke('bitwarden:checkCliInstalled'),
  checkDesktopInstalled: () => ipcRenderer.invoke('bitwarden:checkDesktopInstalled'),
  detectBrowser: () => ipcRenderer.invoke('system:detectBrowser'),
  cleanupCli: () => ipcRenderer.invoke('bitwarden:cleanupCli'),

  // --- File -------------------------------------------------------------
  saveFile: (data) => ipcRenderer.invoke('file:save', data),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),

  // --- App --------------------------------------------------------------
  quit: () => ipcRenderer.invoke('app:quit'),

  // --- Shell ------------------------------------------------------------
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
