

'use strict'

const { contextBridge, ipcRenderer } = require('electron')

ipcRenderer.on('ptt-toggle', (_, data) => {
  window.dispatchEvent(new CustomEvent('pz-ext-ptt', { detail: data }))
})

ipcRenderer.on('overlay-state', (_, data) => {
  window.dispatchEvent(new CustomEvent('pz-overlay-state', { detail: data }))
})

ipcRenderer.on('overlay-request-sync', () => {
  window.dispatchEvent(new CustomEvent('pz-overlay-sync'))
})

ipcRenderer.on('update-available',     (_, data) => window.dispatchEvent(new CustomEvent('pz-update-available',     { detail: data })))
ipcRenderer.on('update-not-available', (_, data) => window.dispatchEvent(new CustomEvent('pz-update-not-available', { detail: data })))
ipcRenderer.on('update-progress',      (_, data) => window.dispatchEvent(new CustomEvent('pz-update-progress',      { detail: data })))
ipcRenderer.on('update-downloaded',    ()        => window.dispatchEvent(new CustomEvent('pz-update-downloaded')))
ipcRenderer.on('update-error',         (_, data) => { window.dispatchEvent(new CustomEvent('pz-update-error', { detail: data })) })

contextBridge.exposeInMainWorld('electronPZ', {

  getPTTState:    () => ipcRenderer.invoke('get-ptt-state'),
  setPTTActive:   (active)   => ipcRenderer.invoke('set-ptt-active',   active),
  setPTTShortcut: (shortcut) => ipcRenderer.invoke('set-ptt-shortcut', shortcut),
  onPTT: (callback) => {
    ipcRenderer.on('ptt-toggle', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('ptt-toggle')
  },

  showOverlay:              () => ipcRenderer.invoke('overlay-show'),
  hideOverlay:              () => ipcRenderer.invoke('overlay-hide'),
  toggleOverlay:            () => ipcRenderer.invoke('overlay-toggle'),
  setOverlayInteractive:    (interactive)   => ipcRenderer.invoke('overlay-set-interactive', interactive),

  updateOverlayParticipants:(participants)  => ipcRenderer.invoke('overlay-update-participants', participants),

  onOverlayParticipants: (cb) => {
    const listener = (_, parts) => cb(parts)
    ipcRenderer.on('overlay-participants', listener)
    return () => ipcRenderer.removeListener('overlay-participants', listener)
  },

  updateStartDownload: () => ipcRenderer.invoke('update-start-download'),
  updateInstallNow:    () => ipcRenderer.invoke('update-install-now'),
  updateCheck:         () => ipcRenderer.invoke('update-check'),

  getDesktopSources:    (opts)     => ipcRenderer.invoke('get-desktop-sources', opts),

  selectDesktopSource:  (sourceId) => ipcRenderer.invoke('select-desktop-source', sourceId),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  version:  process.versions.electron,
  platform: process.platform,
})
