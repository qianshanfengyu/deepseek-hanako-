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
  // 定位到主屏右下角（留 20px 边距）
  const { workArea } = screen.getPrimaryDisplay()
  win.setPosition(
    workArea.x + workArea.width - 200 - 20,
    workArea.y + workArea.height - 300 - 20,
  )
  win.loadURL(`http://127.0.0.1:${PORT}/`)
}

function createTray() {
  try {
    tray = new Tray(TRAY_ICON)
    const menu = Menu.buildFromTemplate([
      { label: '显示 / 隐藏桌宠', click: () => { if (win) { if (win.isVisible()) win.hide(); else win.show() } } },
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
