// Folio desktop: the deployed web suite in an Electron window, so it looks and works exactly like the web.
// `pnpm start` opens production; `pnpm dev` opens the local `pnpm dev` servers.
import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'

const START = process.env.FOLIO_URL ?? 'https://folio.aminethewiz18.workers.dev/'
const preload = fileURLToPath(new URL('preload.cjs', import.meta.url))

// Folio's origins, as in packages/ui/src/urls.ts (production Workers and the local dev ports).
const ORIGINS = new Set([
  ...['folio', 'folio-write', 'folio-grid', 'folio-stage'].map((w) => `https://${w}.aminethewiz18.workers.dev`),
  ...[3000, 3001, 3002, 3003].map((p) => `http://localhost:${p}`),
])
const isFolio = (url) => URL.canParse(url) && ORIGINS.has(new URL(url).origin)
const openOutside = (url) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url) }

function openWindow(url) {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 720, minHeight: 480, title: 'Folio', backgroundColor: '#ffffff',
    webPreferences: { preload }, // contextIsolation and sandbox stay on (Electron's defaults)
  })
  // Folio pages stay in the app; anything else opens in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isFolio(url)) openWindow(url)
    else openOutside(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!isFolio(url)) { e.preventDefault(); openOutside(url) }
  })
  // First launch while offline, before the service worker has anything cached.
  win.webContents.on('did-fail-load', (_e, code, _desc, failed, isMain) => {
    if (isMain && code !== -3) win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlinePage(failed))}`) // -3: aborted
  })
  // A page with unsaved changes blocks closing; Electron would do that silently, so ask like a browser does.
  win.webContents.on('will-prevent-unload', (e) => {
    const leave = dialog.showMessageBoxSync(win, {
      type: 'warning', buttons: ['Leave', 'Stay'], defaultId: 1, cancelId: 1,
      message: 'Leave without saving?', detail: 'Some changes haven’t been saved yet.',
    }) === 0
    if (leave) e.preventDefault()
  })
  win.loadURL(url)
}

const offlinePage = (url) => `<!doctype html><meta charset="utf-8"><title>Folio</title>
<body style="font:15px system-ui,sans-serif;display:grid;place-items:center;height:90vh;text-align:center;color-scheme:light dark">
<div><h1 style="font-size:20px">You’re offline</h1><p>Connect once to set up Folio. After that it opens without a connection.</p>
<p><a href="${escape(url)}">Try again</a></p></div>`

// Electron has no window.prompt(); preload.cjs routes it here and blocks the page until this answers.
const escape = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const promptPage = (message, value) => `<!doctype html><meta charset="utf-8"><title>Folio</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;color-scheme:light dark}input{width:100%;box-sizing:border-box;margin:8px 0 12px;padding:6px 8px;font:inherit}
div{display:flex;gap:8px;justify-content:flex-end}</style>
<form><label>${escape(message)}<input autofocus value="${escape(value)}"></label>
<div><button type="button" id="cancel">Cancel</button><button>OK</button></div></form>
<script>const i=document.querySelector('input');i.select();
document.forms[0].onsubmit=(e)=>{e.preventDefault();folioDesktop.answer(i.value)};
document.getElementById('cancel').onclick=()=>folioDesktop.answer(null);
onkeydown=(e)=>{if(e.key==='Escape')folioDesktop.answer(null)}</script>`

ipcMain.on('prompt', (event, message, value) => {
  const box = new BrowserWindow({
    parent: BrowserWindow.fromWebContents(event.sender), modal: true, show: false,
    width: 380, height: 150, resizable: false, minimizable: false, maximizable: false, title: 'Folio',
    webPreferences: { preload },
  })
  let answered = false
  const answer = (v) => {
    if (answered) return
    answered = true
    event.returnValue = typeof v === 'string' ? v : null
    if (!box.isDestroyed()) box.close()
  }
  box.webContents.ipc.on('prompt-answer', (_e, v) => answer(v))
  box.on('closed', () => answer(null))
  box.once('ready-to-show', () => box.show())
  box.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(promptPage(message, value))}`)
})

app.whenReady().then(() => {
  openWindow(START)
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) openWindow(START) })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
