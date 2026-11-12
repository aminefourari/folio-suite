// Gives pages a working window.prompt() (Electron has none), answered by a native dialog in main.js,
// and turns on offline support (the apps' /sw.js) for Folio pages.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('folioDesktop', {
  prompt: (message, value) => ipcRenderer.sendSync('prompt', String(message ?? ''), String(value ?? '')),
  answer: (value) => ipcRenderer.send('prompt-answer', value),
})
contextBridge.executeInMainWorld({
  func: () => {
    window.prompt = (message, value) => window.folioDesktop.prompt(message, value)
    if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {}) // an older deploy without sw.js just stays online-only
    }
  },
})
