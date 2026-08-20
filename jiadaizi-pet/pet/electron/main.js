// =============================================================================
// deepseek娘（鲸鱼娘）全局桌宠 · Electron 主进程
//
// 职责：
//   1. 创建一个透明、置顶、无边框的常驻窗口，加载 pet.html
//   2. 内置 HTTP 状态机：佳代子（Hana）通过 POST /jiadaizi-pet/set-mode 驱动桌宠状态
//   3. 通过 HTTP 提供素材（精灵图 + 完成音）与状态查询（GET /jiadaizi-pet/state）
//
// 端口：8999（仅本机 127.0.0.1）
// 启动：npm start 或 electron .
// =============================================================================

const { app, BrowserWindow, screen, Tray, Menu, ipcMain } = require('electron')
const http = require('http')
const fs = require('fs')
const path = require('path')

// 项目根：相对 electron 目录的上一级（交付包 / 开发目录结构一致，可移植）
const ROOT = path.join(__dirname, '..')
const SPRITE_PATH = path.join(ROOT, 'assets', 'whale-spritesheet.png')
const VOICE_COMPLETE_PATH = path.join(ROOT, 'assets', 'voice-complete.wav')
const PET_HTML = path.join(__dirname, 'pet.html')
const PORT = Number(process.env.PET_PORT) || 8999
// 托盘图标：开发机有专用 ico 就用它；交付环境没有则退回 assets 素材（兜底，不崩）
const TRAY_ICON_ABS = 'E:/AI/deepseek-whale-girl-icon/DeepSeekHarness-WhaleGirl.ico'
const TRAY_ICON = fs.existsSync(TRAY_ICON_ABS) ? TRAY_ICON_ABS : path.join(ROOT, 'assets', 'whale-girl-ref.png')

// 窗口位置记忆：拖放到哪就在哪，下次启动原样回来
const POSITION_FILE = path.join(app.getPath('userData'), 'jiadaizi-position.json')
const PEEK_BACK_MS = 60 * 1000  // 右键「去睡会儿」隐藏后自动回来的时长
let peekTimer = null

function loadPosition() {
  try {
    const p = JSON.parse(fs.readFileSync(POSITION_FILE, 'utf8'))
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: Math.round(p.x), y: Math.round(p.y) }
  } catch { /* noop */ }
  return null
}
function savePosition(x, y) {
  try { fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y, t: Date.now() })) } catch { /* noop */ }
}

// 双形象：classic（女仆装单帧，默认）+ v2（蓝白裙多帧动画，8×9 Codex 契约）
const SPRITE_V2_PATH = path.join(ROOT, 'assets', 'whale-v2.webp')
const VALID_SKINS = ['classic', 'v2']
let skin = 'classic'

// ---------- 状态机 ----------
const VALID_MODES = ['idle', 'working', 'review', 'waiting', 'failed', 'celebrating']
const CELEBRATE_MS = 4800
const FAILED_MS = 2600

let mode = 'idle'
let seq = 0
let celebrating = false
let celebrateTimer = null
let failTimer = null

const setMode = (next) => {
  if (next === mode) return
  if (celebrating && next !== 'celebrating') return
  mode = next
  seq++
  console.log('[pet] mode ->', mode, '(seq', seq + ')')
  if (win) { try { win.webContents.send('pet-mode', mode) } catch (e) { /* ignore */ } }
}

const celebrate = () => {
  if (celebrating) {
    if (celebrateTimer) clearTimeout(celebrateTimer)
    celebrateTimer = setTimeout(() => { celebrating = false; setMode('idle') }, CELEBRATE_MS)
    return
  }
  celebrating = true
  setMode('celebrating')
  celebrateTimer = setTimeout(() => { celebrating = false; setMode('idle') }, CELEBRATE_MS)
}

const showFailed = () => {
  if (celebrating) return
  setMode('failed')
  if (failTimer) clearTimeout(failTimer)
  failTimer = setTimeout(() => setMode('idle'), FAILED_MS)
}

// ---------- HTTP 服务器（佳代子驱动入口 + 素材） ----------
const sendFile = (res, filePath, contentType) => {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return }
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length })
    res.end(data)
  })
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0]

  if (req.method === 'GET' && url === '/jiadaizi-pet/state') {
    const body = JSON.stringify({ mode, seq })
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
    res.end(body)
    return
  }

  if (req.method === 'POST' && url === '/jiadaizi-pet/set-mode') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const m = String(JSON.parse(body || '{}').mode || '')
        if (VALID_MODES.includes(m)) {
          if (m === 'celebrating') celebrate()
          else if (m === 'failed') showFailed()
          else setMode(m)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, mode, seq }))
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'invalid mode' }))
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'bad json' }))
      }
    })
    return
  }

  // 热重载页面：改 pet.html 后 POST 一下即可，无需重启进程
  if (req.method === 'POST' && url === '/jiadaizi-pet/reload') {
    if (win) win.reload()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, reloaded: !!win }))
    return
  }

  if (req.method === 'GET' && url === '/spritesheet.png') {
    sendFile(res, SPRITE_PATH, 'image/png')
    return
  }

  // v2 多帧动画素材（蓝白裙鲸鱼娘，webp）
  if (req.method === 'GET' && url === '/spritesheet-v2.webp') {
    sendFile(res, SPRITE_V2_PATH, 'image/webp')
    return
  }

  // 切换形象：classic（女仆装单帧）↔ v2（蓝白裙多帧）
  if (req.method === 'POST' && url === '/jiadaizi-pet/set-skin') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const s = String(JSON.parse(body || '{}').skin || '')
        if (VALID_SKINS.includes(s)) {
          skin = s
          if (win) { try { win.webContents.send('pet-skin', skin) } catch (e) { /* ignore */ } }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, skin }))
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'invalid skin' }))
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'bad json' }))
      }
    })
    return
  }

  if (req.method === 'GET' && url === '/voice-complete.wav') {
    sendFile(res, VOICE_COMPLETE_PATH, 'audio/wav')
    return
  }

  // TTS 轮换语音：/voice-N.mp3|wav → assets/voice-N.*（仅允许白名单文件名，防穿越）
  if (req.method === 'GET' && /^\/voice-\d+\.(wav|mp3)$/.test(url)) {
    const ct = url.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    sendFile(res, path.join(ROOT, 'assets', url.slice(1)), ct)
    return
  }

  // 默认返回桌宠页面
  sendFile(res, PET_HTML, 'text/html; charset=utf-8')
})

// ---------- 窗口 ----------
let win = null
let tray = null

function createWindow() {
  win = new BrowserWindow({
    width: 200,
    height: 300,   // 上方留白给气泡与庆祝撒花
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // 定位：优先记忆位置（跨屏/出屏时回退右下角）
  const { workArea } = screen.getPrimaryDisplay()
  const saved = loadPosition()
  const defX = workArea.x + workArea.width - 200 - 20
  const defY = workArea.y + workArea.height - 300 - 20
  const px = saved ? saved.x : defX
  const py = saved ? saved.y : defY
  // 简单出屏保护：位置须落在任一显示器 workArea 内
  const onScreen = screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return px >= wa.x - 40 && px <= wa.x + wa.width - 40 && py >= wa.y - 40 && py <= wa.y + wa.height - 40
  })
  win.setPosition(px, py, false)
  if (!onScreen) win.setPosition(defX, defY, false)
  win.loadURL(`http://127.0.0.1:${PORT}/`)
}

function createTray() {
  try {
    tray = new Tray(TRAY_ICON)
    const menu = Menu.buildFromTemplate([
      { label: '显示 / 隐藏桌宠', click: () => { if (win) { if (win.isVisible()) win.hide(); else win.show() } } },
      { type: 'separator' },
      {
        label: '切换形象：' + (skin === 'v2' ? '蓝白裙鲸鱼娘（多帧）' : '女仆装（单帧）'),
        click: () => {
          skin = skin === 'v2' ? 'classic' : 'v2'
          if (win) { try { win.webContents.send('pet-skin', skin) } catch (e) { /* ignore */ } }
          createTray()  // 刷新菜单文字
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => { app.quit() } },
    ])
    tray.setToolTip('deepseek娘 · 鲸鱼娘桌宠')
    tray.setContextMenu(menu)
    tray.on('click', () => { if (win) { if (win.isVisible()) win.hide(); else win.show() } })
  } catch (err) {
    console.error('[pet] tray create failed:', err.message)
  }
}

// 窗口拖动：渲染进程通过 IPC 发来增量位移，主进程移动窗口
ipcMain.on('pet-move', (_event, { dx, dy }) => {
  if (!win) return
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
  const [x, y] = win.getPosition()
  win.setPosition(Math.round(x + dx), Math.round(y + dy))
})

// 拖动结束：记住落点（下次启动同样位置出现）
ipcMain.on('pet-move-end', (_event, pos) => {
  if (!win || !pos) return
  const [x, y] = win.getPosition()
  savePosition(x, y)
})

// 隐藏（「去睡会儿」）：先记住位置，隐藏一段时间后自动回到桌面
ipcMain.on('pet-hide', (_event, ms) => {
  if (!win) return
  const [x, y] = win.getPosition()
  savePosition(x, y)
  win.hide()
  clearTimeout(peekTimer)
  peekTimer = setTimeout(() => {
    if (win && !win.isVisible()) {
      win.show()
      try { win.webContents.send('pet-wake') } catch (e) { /* ignore */ }
    }
  }, Number.isFinite(ms) && ms > 0 ? ms : PEEK_BACK_MS)
})

// 立即唤回（右键菜单「醒醒啦」/ 托盘）
ipcMain.on('pet-peek', () => {
  if (!win) return
  clearTimeout(peekTimer)
  if (!win.isVisible()) {
    win.show()
    try { win.webContents.send('pet-wake') } catch (e) { /* ignore */ }
  }
})

// 退出时顺手存好位置（兜底）
app.on('before-quit', () => {
  if (win) { const [x, y] = win.getPosition(); savePosition(x, y) }
})

app.whenReady().then(() => {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[pet] port ' + PORT + ' already in use, another instance is running — exiting')
      app.quit()
      return
    }
    throw err
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log('[pet] http server on http://127.0.0.1:' + PORT)
  })
  createWindow()
  createTray()
})

// 桌宠常驻：所有窗口关闭时不自动退出（由托盘/进程管理器控制生命周期）
app.on('window-all-closed', () => {
  // 保持运行
})
