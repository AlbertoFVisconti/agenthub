const { contextBridge, ipcRenderer } = require('electron')

// Narrow contextBridge exposing specific IPC channels.
// No generic execute-passthrough, only specific methods for UI interaction with the OS if needed.
// For the most part, the Next.js UI communicates with the Fastify API via standard HTTP/SSE on port 8080.
contextBridge.exposeInMainWorld('electronAPI', {
  pickProjectFolder: () => ipcRenderer.invoke('dialog:pickProjectFolder'),
  login: () => ipcRenderer.invoke('auth:login')
})

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, ...args) => {
      const validChannels = ['auth:login']
      if (validChannels.includes(channel)) {
        ipcRenderer.invoke(channel, ...args)
      }
    }
  }
})
