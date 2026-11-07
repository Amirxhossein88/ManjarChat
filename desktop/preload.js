const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('manjarConnect', {
  save: (url) => ipcRenderer.invoke('set-server-url', url),
})
