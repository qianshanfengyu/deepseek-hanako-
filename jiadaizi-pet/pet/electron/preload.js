const { contextBridge, ipcRenderer } = require('electron')

// 暴露给渲染进程的窗口拖动桥接 + 状态推送订阅
contextBridge.exposeInMainWorld('petDrag', {
  move: (dx, dy) => { ipcRenderer.send('pet-move', { dx, dy }) },
})

contextBridge.exposeInMainWorld('petEvents', {
  // 主进程状态一变就推过来，页面无需等轮询
  onMode: (cb) => {
    ipcRenderer.on('pet-mode', (_e, mode) => { try { cb(mode) } catch (err) { /* ignore */ } })
  },
})
