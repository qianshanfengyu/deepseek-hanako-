const { contextBridge, ipcRenderer } = require('electron')

// 暴露给渲染进程的窗口拖动桥接 + 状态推送订阅
contextBridge.exposeInMainWorld('petDrag', {
  move: (dx, dy) => { ipcRenderer.send('pet-move', { dx, dy }) },
  // 拖动结束：主进程记住窗口落点（下次启动回到原位）
  moveEnd: () => { ipcRenderer.send('pet-move-end') },
})

contextBridge.exposeInMainWorld('petWindow', {
  // 去睡会儿：隐藏窗口，ms 毫秒后自动回来（默认 60s）
  hide: (ms) => { ipcRenderer.send('pet-hide', ms) },
  // 立即唤回
  peek: () => { ipcRenderer.send('pet-peek') },
  // 从隐藏状态被唤回（peek 计时到点 / 托盘点击）
  onWake: (cb) => {
    ipcRenderer.on('pet-wake', () => { try { cb() } catch (err) { /* ignore */ } })
  },
})

contextBridge.exposeInMainWorld('petEvents', {
  // 主进程状态一变就推过来，页面无需等轮询
  onMode: (cb) => {
    ipcRenderer.on('pet-mode', (_e, mode) => { try { cb(mode) } catch (err) { /* ignore */ } })
  },
  // 托盘/接口切换形象推送
  onSkin: (cb) => {
    ipcRenderer.on('pet-skin', (_e, skin) => { try { cb(skin) } catch (err) { /* ignore */ } })
  },
})