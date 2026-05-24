
'use strict'

const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, shell, session, screen, dialog } = require('electron')

Menu.setApplicationMenu(null)
const path = require('path')

let autoUpdater = null
try {
  autoUpdater = require('electron-updater').autoUpdater
  autoUpdater.logger = null
  autoUpdater.autoDownload = false
} catch (e) {
  console.warn('[updater] electron-updater niedostępny:', e.message)
}

let uIOhook, UiohookKey
try {
  const uio = require('uiohook-napi')
  uIOhook    = uio.uIOhook
  UiohookKey = uio.UiohookKey
} catch (e) {
  console.warn('[uiohook] Nie udało się załadować uiohook-napi:', e.message)
}

const fs = require('fs')

const APP_URL      = 'https://project-z.cloud'
const APP_NAME     = 'Project-Z'

app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-media-suspend')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream', 'false')

let mainWindow      = null
let overlayWindow   = null
let tray            = null
let pttActive       = false
let pttShortcut     = ''
let lastParticipants = []

const WEB_BTN_TO_UIO = { 0: 1, 1: 3, 2: 2, 3: 4, 4: 5 }

function buildKeyMap() {
  if (!UiohookKey) return {}
  const map = {

    'RAlt': UiohookKey.AltRight, 'AltRight': UiohookKey.AltRight,
    'Alt':  UiohookKey.Alt,      'AltLeft':  UiohookKey.Alt,
    'Ctrl': UiohookKey.Ctrl,     'CtrlRight': UiohookKey.CtrlRight,
    'Shift': UiohookKey.Shift,   'ShiftRight': UiohookKey.ShiftRight,
    'Meta': UiohookKey.Meta,     'Space': UiohookKey.Space,
    'Enter': UiohookKey.Enter,   'Tab': UiohookKey.Tab,
    'Backspace': UiohookKey.Backspace,

    'AltLeft': UiohookKey.Alt, 'ShiftLeft': UiohookKey.Shift,
    'ControlLeft': UiohookKey.Ctrl, 'ControlRight': UiohookKey.CtrlRight,
    'MetaLeft': UiohookKey.Meta, 'MetaRight': UiohookKey.MetaRight,
  }

  for (let i = 1; i <= 24; i++) {
    if (UiohookKey[`F${i}`] != null) map[`F${i}`] = UiohookKey[`F${i}`]
  }

  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (UiohookKey[c] != null) {
      map[c]        = UiohookKey[c]
      map[`Key${c}`] = UiohookKey[c]
    }
  }
  return map
}

function parseBinding(str) {
  if (!str) return null
  if (str.startsWith('Mouse')) {
    const webBtn = Number(str.slice(5))
    const button = WEB_BTN_TO_UIO[webBtn] ?? (webBtn + 1)
    return { type: 'mouse', button }
  }
  const keyMap = buildKeyMap()
  const keys = str.split('+').map(p => p.trim())
    .map(p => keyMap[p] ?? keyMap[p.toUpperCase()])
    .filter(v => v != null)
  return keys.length > 0 ? { type: 'keyboard', keys } : null
}

let pttBinding   = null
const pressedKeys = new Set()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1300,
    height:    820,
    minWidth:  900,
    minHeight: 600,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,

      webSecurity:        true,
      allowRunningInsecureContent: false,
    },
    backgroundColor: '#0f0a0a',
    title:           APP_NAME,
    icon:            getIcon(),

    roundedCorners:  true,
  })

  mainWindow.loadURL(APP_URL)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.setBackgroundThrottling(false)

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.__PZ_ELECTRON__ = true;
      window.dispatchEvent(new CustomEvent('pz-ext-ready', { detail: { source: 'electron' } }));
    `).catch(() => {})

    pageReady = true
    flushUpdateEvent()
  })

  mainWindow.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' || cmd === 'browser-forward') {
      e.preventDefault()
    }
  })

  mainWindow.on('close', (e) => {

    if (tray && !app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

const OVERLAY_SHORTCUT = 'Alt+Shift+O'

function registerPTT(shortcut) {
  pttShortcut = shortcut
  pttBinding  = parseBinding(shortcut)
  console.log(`[PTT] binding: ${shortcut}`, pttBinding)
}

function setupUiohook() {
  if (!uIOhook) {
    console.warn('[PTT] uiohook niedostępny — PTT nie będzie działać w grach')
    return
  }

  uIOhook.on('keydown', (e) => {
    pressedKeys.add(e.keycode)
    if (pttBinding?.type !== 'keyboard') return
    const allHeld = pttBinding.keys.every(k => pressedKeys.has(k))
    if (allHeld && !pttActive) {
      pttActive = true
      firePTT(true)
      updateTray()
    }
  })

  uIOhook.on('keyup', (e) => {
    pressedKeys.delete(e.keycode)
    if (pttBinding?.type !== 'keyboard' || !pttActive) return
    const allHeld = pttBinding.keys.every(k => pressedKeys.has(k))
    if (!allHeld) {
      pttActive = false
      firePTT(false)
      updateTray()
    }
  })

  uIOhook.on('mousedown', (e) => {
    if (pttBinding?.type === 'mouse' && e.button === pttBinding.button && !pttActive) {
      pttActive = true
      firePTT(true)
      updateTray()
    }
  })

  uIOhook.on('mouseup', (e) => {
    if (pttBinding?.type === 'mouse' && e.button === pttBinding.button && pttActive) {
      pttActive = false
      firePTT(false)
      updateTray()
    }
  })

  uIOhook.start()
  console.log('[PTT] uiohook uruchomiony')
}

function registerOverlayShortcut() {
  try { globalShortcut.unregister(OVERLAY_SHORTCUT) } catch {}
  globalShortcut.register(OVERLAY_SHORTCUT, () => {
    toggleOverlay()
  })
}

function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow()
    overlayWindow?.showInactive()
    mainWindow?.webContents.send('overlay-state', { visible: true })
  } else if (overlayWindow.isVisible()) {
    overlayWindow.hide()
    mainWindow?.webContents.send('overlay-state', { visible: false })
  } else {
    overlayWindow.showInactive()
    mainWindow?.webContents.send('overlay-state', { visible: true })
  }
}

function firePTT(active) {
  if (!mainWindow) return

  mainWindow.webContents.send('ptt-toggle', { active })
}

function createTray() {
  const icon = getIcon(16)
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  updateTray()

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function updateTray() {
  if (!tray) return

  const label = pttActive ? '🔴 PTT: AKTYWNY' : '🎙 PTT: wyłączony'
  tray.setToolTip(`${APP_NAME} — ${label}`)

  const menu = Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: pttActive ? '🔴 PTT AKTYWNY — kliknij aby wyłączyć' : '🎙 Włącz mikrofon (PTT)',
      click: () => {
        pttActive = !pttActive
        firePTT(pttActive)
        updateTray()
      }
    },
    { label: `PTT: ${pttShortcut || '(nie ustawiono)'}`, enabled: false },
    { type: 'separator' },
    {
      label: overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()
        ? '🖥 Ukryj nakładkę głosową'
        : '🖥 Pokaż nakładkę głosową',
      click: () => toggleOverlay()
    },
    { label: `Nakładka: ${OVERLAY_SHORTCUT}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Pokaż Project-Z',
      click: () => { mainWindow?.show(); mainWindow?.focus() }
    },
    {
      label: 'Otwórz w przeglądarce',
      click: () => shell.openExternal(APP_URL)
    },
    { type: 'separator' },
    {
      label: 'Zamknij',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    },
  ])
  tray.setContextMenu(menu)
}

function getIcon(size = 256) {

  try {
    const iconPath = path.join(__dirname, 'icons', `icon${size <= 32 ? 16 : size <= 64 ? 48 : 128}.png`)
    const fs = require('fs')
    if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath)
  } catch {}

  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAA' +
    'AklEQVQ4jWNgGAUkAgABBAABnMtZ9QAAAABJRU5ErkJggg=='
  )
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return

  const { width: sw } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width:       260,
    height:      420,
    x:           sw - 278,
    y:           16,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'))

  overlayWindow.webContents.setBackgroundThrottling(false)

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('overlay-participants', lastParticipants)
  })

  overlayWindow.on('show', () => {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-participants', lastParticipants)
      }
    }, 80)

    mainWindow?.webContents.send('overlay-request-sync', null)
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null

    mainWindow?.webContents.send('overlay-state', { visible: false })
  })
}

ipcMain.handle('get-ptt-state',   () => ({ active: pttActive, shortcut: pttShortcut }))
ipcMain.handle('set-ptt-active',  (_, active) => {
  pttActive = !!active
  firePTT(pttActive)
  updateTray()
  return pttActive
})
ipcMain.handle('set-ptt-shortcut', (_, shortcut) => {
  registerPTT(shortcut)
  updateTray()
  return pttShortcut
})

ipcMain.handle('overlay-show', () => {
  createOverlayWindow()
  overlayWindow?.showInactive()
  mainWindow?.webContents.send('overlay-state', { visible: true })
})
ipcMain.handle('overlay-hide', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
  mainWindow?.webContents.send('overlay-state', { visible: false })
})
ipcMain.handle('overlay-toggle', () => { toggleOverlay() })

ipcMain.handle('overlay-update-participants', (_, participants) => {
  lastParticipants = participants || []

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-participants', lastParticipants)
  }
})

ipcMain.handle('overlay-set-interactive', (_, interactive) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  if (interactive) {
    overlayWindow.setIgnoreMouseEvents(false)
  } else {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  }
})

let updatePendingEvent = null
let pageReady = false

function flushUpdateEvent() {
  if (!updatePendingEvent || !pageReady || !mainWindow) return
  mainWindow.webContents.send(updatePendingEvent.type, updatePendingEvent.payload)
  updatePendingEvent = null
}

function sendUpdate(type, payload) {
  if (!mainWindow) return
  if (pageReady) {
    mainWindow.webContents.send(type, payload)
  } else {
    updatePendingEvent = { type, payload }
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return

  setTimeout(() => {
    console.log('[updater] sprawdzam aktualizacje...')
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[updater] checkForUpdates error:', err?.message)
    })
  }, 10000)

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] dostępna aktualizacja:', info.version)
    sendUpdate('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] brak aktualizacji, aktualna wersja:', info?.version)
    mainWindow?.webContents.send('update-not-available', { version: info?.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    if (!mainWindow) return
    mainWindow.webContents.send('update-progress', {
      percent:  Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('[updater] aktualizacja pobrana — gotowa do instalacji')
    if (!mainWindow) return
    mainWindow.webContents.send('update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.warn('[updater] błąd:', err?.message ?? err)
    mainWindow?.webContents.send('update-error', { message: err?.message ?? String(err) })
  })
}

ipcMain.handle('update-start-download', () => {
  autoUpdater?.downloadUpdate().catch(() => {})
})
ipcMain.handle('update-install-now', () => {
  autoUpdater?.quitAndInstall(false, true)
})
ipcMain.handle('update-check', () => {
  autoUpdater?.checkForUpdates().catch(() => {})
})
ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.handle('get-desktop-sources', async (_, opts = {}) => {
  try {
    const { desktopCapturer } = require('electron')
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: opts.thumbnailSize ?? { width: 320, height: 180 },
      fetchWindowIcons: true,
    })
    return sources.map(s => ({
      id:        s.id,
      name:      s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon:   s.appIcon ? s.appIcon.toDataURL() : null,
    }))
  } catch (e) {
    console.warn('[desktopCapturer]', e.message)
    return []
  }
})

let pendingScreenShareSourceId = null
ipcMain.handle('select-desktop-source', (_, sourceId) => {
  pendingScreenShareSourceId = sourceId
})

async function checkUiohookConsent() {
  const consentFile = path.join(app.getPath('userData'), 'ptt_consent.json')
  try {
    const data = JSON.parse(fs.readFileSync(consentFile, 'utf8'))
    if (data.accepted === true) return true
  } catch {}

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'Push-to-Talk — uprawnienia',
    message: 'Nexus używa globalnych hooków klawiatury i myszy',
    detail: 'Funkcja Push-to-Talk wymaga nasłuchiwania naciśnięć klawiszy i przycisków myszy w tle, nawet gdy aplikacja nie jest aktywna.\n\nTe zdarzenia są używane wyłącznie do aktywacji mikrofonu PTT i nie są nigdzie rejestrowane ani przesyłane.\n\nCzy chcesz włączyć Push-to-Talk?',
    buttons: ['Włącz PTT', 'Nie, rezygnuję'],
    defaultId: 0,
    cancelId: 1,
  })

  const accepted = response === 0
  try {
    fs.writeFileSync(consentFile, JSON.stringify({ accepted, date: new Date().toISOString() }))
  } catch {}
  return accepted
}

app.whenReady().then(async () => {

  await session.defaultSession.clearCache()

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.startsWith(APP_URL)) {
      details.requestHeaders['Cache-Control'] = 'no-cache'
      details.requestHeaders['Pragma'] = 'no-cache'
    }
    callback({ requestHeaders: details.requestHeaders })
  })

  const MEDIA_PERMS = ['media', 'microphone', 'audioCapture', 'camera', 'videoCapture', 'display-capture']
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(MEDIA_PERMS.includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return MEDIA_PERMS.includes(permission)
  })

  createWindow()

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const { desktopCapturer } = require('electron')
      if (pendingScreenShareSourceId) {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
        const source = sources.find(s => s.id === pendingScreenShareSourceId)
        pendingScreenShareSourceId = null
        if (source) {
          callback({ video: source, audio: 'loopback' })
          return
        }
      }

      const sources = await desktopCapturer.getSources({ types: ['screen'] })
      callback({ video: sources[0] ?? null })
    } catch (e) {
      console.warn('[displayMedia]', e.message)
      callback({})
    }
  })

  createTray()
  setupUiohook()

  registerOverlayShortcut()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  try { uIOhook?.stop() } catch {}
})
