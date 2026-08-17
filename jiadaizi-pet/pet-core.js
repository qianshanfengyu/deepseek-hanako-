// 佳代子桌宠 · 核心逻辑（进程管理 + 状态驱动 + 事件桥接状态机）
// 设计要点：
//   - 进程引用（child）挂在 globalThis.__jiadaiziPet 上，而不是模块级变量。
//     原因：Hana 插件系统的 entry 与 tools 各自独立加载（dsh-hanako 已验证），
//     模块级状态不共享，必须走 globalThis 单例。
//   - 桌宠本体内嵌在 pet/ 目录（electron 源码 + assets），electron 可执行文件
//     解析顺序：配置 electronDir → 插件内嵌 node_modules → 本机旧目录兜底。

import { spawn } from 'node:child_process'
import { existsSync, appendFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import http from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 本文件位于插件根目录（与 manifest.json 同级）
const PLUGIN_ROOT = __dirname

const DEFAULT_PORT = 8999
const LOG_FILE = join(os.homedir(), '.hanako', 'logs', 'jiadaizi-pet.log')
// 本机旧目录兜底（完整插件化前的桌宠安装位置，node_modules 已就绪）
const FALLBACK_ELECTRON = 'E:/AI/dsh-jiadaizi-like-pet/electron/node_modules/electron/dist/electron.exe'

// ---------- 全局单例 ----------
function g() {
  if (!globalThis.__jiadaiziPet || typeof globalThis.__jiadaiziPet !== 'object') {
    globalThis.__jiadaiziPet = { child: null }
  }
  return globalThis.__jiadaiziPet
}

// ---------- 日志 ----------
export function logLine(s) {
  try { appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + s + '\n') } catch { /* noop */ }
}

// ---------- 配置 ----------
export function readDefaults() {
  try {
    const m = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'manifest.json'), 'utf8'))
    const props = m?.contributes?.configuration?.properties || {}
    const out = {}
    for (const [k, v] of Object.entries(props)) if (v && 'default' in v) out[k] = v.default
    return out
  } catch { return {} }
}

export function readConfig(ctx) {
  const cfg = readDefaults()
  const merge = (src) => {
    if (!src || typeof src !== 'object') return
    for (const [k, v] of Object.entries(src)) {
      if (v !== undefined && v !== null && v !== '') cfg[k] = v
    }
  }
  merge(ctx?.config)
  if (ctx?.dataDir) {
    try {
      const p = join(ctx.dataDir, 'config.json')
      if (existsSync(p)) merge(JSON.parse(readFileSync(p, 'utf8'))?.global)
    } catch { /* noop */ }
  }
  return cfg
}

export function getPort(cfg) {
  const n = Number(cfg?.port)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT
}

// ---------- electron 解析 ----------
function resolveElectronExe(cfg) {
  const cands = []
  if (cfg?.electronDir) {
    cands.push(join(cfg.electronDir, 'node_modules', 'electron', 'dist', 'electron.exe'))
    cands.push(join(cfg.electronDir, 'dist', 'electron.exe'))
  }
  cands.push(join(PLUGIN_ROOT, 'pet', 'electron', 'node_modules', 'electron', 'dist', 'electron.exe'))
  cands.push(FALLBACK_ELECTRON)
  for (const p of cands) {
    if (p && existsSync(p)) return p
  }
  return null
}

function resolveAppDir(cfg) {
  if (cfg?.electronDir && existsSync(join(cfg.electronDir, 'main.js'))) return cfg.electronDir
  return join(PLUGIN_ROOT, 'pet', 'electron')
}

// ---------- 进程管理 ----------
export function isRunning() {
  const inst = g()
  return !!(inst.child && inst.child.exitCode === null)
}

export async function startPet(cfg) {
  const inst = g()
  if (inst.child && inst.child.exitCode === null) {
    logLine('startPet: already running pid=' + inst.child.pid)
    return { ok: true, alreadyRunning: true, pid: inst.child.pid, port: getPort(cfg) }
  }
  const exe = resolveElectronExe(cfg)
  const appDir = resolveAppDir(cfg)
  if (!exe) {
    throw new Error('未找到 electron 可执行文件。请在插件设置里指定 electronDir（指向已装好依赖的桌宠 electron 目录），或在插件 pet/electron 下执行 npm install electron。')
  }
  if (!existsSync(join(appDir, 'main.js'))) {
    throw new Error('桌宠 electron 目录不完整（缺 main.js）：' + appDir)
  }
  const port = getPort(cfg)
  const c = spawn(exe, [appDir], {
    cwd: join(PLUGIN_ROOT, 'pet'),
    stdio: 'ignore',
    env: { ...process.env, PET_PORT: String(port) },
    windowsHide: true,
  })
  inst.child = c
  c.once('exit', (code, signal) => {
    logLine('pet exited code=' + code + ' signal=' + signal)
    if (inst.child === c) inst.child = null
  })
  logLine('startPet: spawned pid=' + c.pid + ' exe=' + exe + ' port=' + port)
  return { ok: true, pid: c.pid, port, exe }
}

export async function stopPet() {
  const inst = g()
  const c = inst.child
  if (!c || c.exitCode !== null) {
    inst.child = null
    return { ok: true, alreadyStopped: true }
  }
  const pid = c.pid
  // 先优雅 kill，再用 taskkill /T /F 兜底杀整棵树（electron 带 GPU 子进程）
  try { c.kill() } catch { /* noop */ }
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } catch { /* noop */ }
  inst.child = null
  logLine('stopPet: killed pid=' + pid)
  return { ok: true, stopped: true, pid }
}

export async function restartPet(cfg) {
  await stopPet()
  // 等端口释放再拉起，避免 EADDRINUSE
  await new Promise((r) => setTimeout(r, 800))
  return startPet(cfg)
}

// ---------- HTTP 驱动 + 查询 ----------
export function drivePet(cfg, mode) {
  const url = `http://127.0.0.1:${getPort(cfg)}/jiadaizi-pet/set-mode`
  return new Promise((resolve) => {
    const body = JSON.stringify({ mode })
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { res.resume(); res.on('end', () => resolve(true)) })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
    req.end(body)
  })
}

export function queryState(cfg) {
  const url = `http://127.0.0.1:${getPort(cfg)}/jiadaizi-pet/state`
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { resolve(null) } })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(1500, () => { req.destroy(); resolve(null) })
  })
}

// ---------- 事件桥接状态机（自 whale-pet-bridge 合并） ----------
const EVENT_MAP = {
  tool_execution_start: 'working',
  tool_execution_update: 'working',
  tool_execution_end: 'review',
  turn_start: 'review',
  llm_usage: 'review',
  message_start: 'review',
  message_update: 'review',
  message_end: 'review',
  turn_end: 'idle',
}

function inferState(event) {
  const type = String((event && event.type) || '')
  if (EVENT_MAP[type]) return EVENT_MAP[type]
  const t = type.toLowerCase()
  if (!t) return null
  if (t.includes('error') || t.includes('fail') || t.includes('abort')) return 'failed'
  if (t.includes('wait') || t.includes('approval') || t.includes('permission') || t.includes('confirm')) return 'waiting'
  if (t.includes('think') || t.includes('review') || t.includes('plan')) return 'review'
  if (t.includes('run') || t.includes('start') || t.includes('send') || t.includes('tool') || t.includes('work')) return 'working'
  return null
}

const CELEBRATE_COOLDOWN_MS = 10000
const SILENCE_CONFIRM_MS = 2000
const IDLE_WATCHDOG_MS = 15000
const FAILED_HOLD_MS = 3000
const CELEBRATE_FALLBACK_MS = 5200
// 硬取消：真正的「新一轮活动」出现，放弃本次完工庆祝（新用户输入 / 新一轮干活 / 新一轮生成）
const HARD_CANCEL = ['session_user_message', 'agent_start', 'tool_execution_start', 'message_start']
// 软重置：Hana 的例行回合边界。实测 turn_end 后几乎总是紧跟 turn_start（间隔 1~2ms），
// 它不代表新活动，若按硬取消处理会把「任务彻底做完」的庆祝窗口掐掉 → 完工不播报。
// 处理：正在等待庆祝时，turn_start 只续期静默窗口，不取消。
const SOFT_RESET = ['turn_start']

// 创建桥接实例（闭包持有状态，生命周期跟随插件 onload/onunload）
export function createBridge(cfg) {
  const st = { current: 'idle', lastCelebrationAt: 0 }
  const round = { hasWork: false, hasError: false }
  let watchdog = null
  let failedTimer = null
  let silenceTimer = null
  let celebrateTimer = null
  const evtLogAt = {}

  const apply = async (next, reason) => {
    if (next === st.current) return
    st.current = next
    logLine('SET ' + next + ' (' + reason + ')')
    await drivePet(cfg, next)
  }

  const armWatchdog = () => {
    clearTimeout(watchdog)
    watchdog = setTimeout(() => {
      if (['working', 'review'].includes(st.current)) {
        logLine('WATCHDOG -> idle (no events)')
        st.current = 'idle'
        drivePet(cfg, 'idle')
      }
    }, IDLE_WATCHDOG_MS)
  }

  const scheduleFailedFallback = () => {
    clearTimeout(failedTimer)
    failedTimer = setTimeout(() => {
      if (st.current === 'failed') {
        st.current = 'idle'
        drivePet(cfg, 'idle')
      }
    }, FAILED_HOLD_MS)
  }

  const scheduleCelebrateFallback = () => {
    clearTimeout(celebrateTimer)
    celebrateTimer = setTimeout(() => {
      if (st.current === 'celebrating') {
        st.current = 'idle'
        drivePet(cfg, 'idle')
      }
    }, CELEBRATE_FALLBACK_MS)
  }

  const cancelPending = () => clearTimeout(silenceTimer)

  const tryCelebrate = () => {
    clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      const t = Date.now()
      if (round.hasError) { logLine('turn_end: round had error, no celebrate'); apply('idle', 'round had error'); return }
      if (!round.hasWork) { logLine('turn_end: no tool work, no celebrate'); apply('idle', 'no work'); return }
      if (t - st.lastCelebrationAt < CELEBRATE_COOLDOWN_MS) { logLine('turn_end: cooldown, skip'); apply('idle', 'cooldown'); return }
      st.lastCelebrationAt = t
      apply('celebrating', 'round complete')
      scheduleCelebrateFallback()
    }, SILENCE_CONFIRM_MS)
  }

  const handle = (event) => {
    const type = String((event && event.type) || '(unknown)')
    const now = Date.now()
    if (!evtLogAt[type] || now - evtLogAt[type] >= 30000) {
      evtLogAt[type] = now
      logLine('EVENT type=' + type + ' isError=' + (!!(event && event.isError)) + ' infer=' + inferState(event))
    }
    if (HARD_CANCEL.includes(type)) cancelPending()
    if (SOFT_RESET.includes(type)) {
      // 例行 turn 边界：正在等待完工庆祝时只续期窗口，不取消
      if (silenceTimer) tryCelebrate()
    }
    if (type === 'session_user_message' || type === 'agent_start') {
      round.hasWork = false
      round.hasError = false
    }
    if (event && event.isError) {
      cancelPending()
      round.hasError = true
      apply('failed', 'isError')
      scheduleFailedFallback()
      return
    }
    if (type === 'tool_execution_start') round.hasWork = true
    if (type === 'turn_end') {
      apply('idle', 'turn_end')
      return
    }
    // 对话彻底结束才启动完工庆祝：agent_end 是「回合真正结束」的信号。
    // 工具间隙的 turn_end/turn_start 不代表结束，不触发庆祝判定（否则每轮工具间隙都乱响）。
    if (type === 'agent_end') {
      tryCelebrate()
      return
    }
    const s = inferState(event)
    if (s) {
      apply(s, 'event ' + type)
      if (s === 'working' || s === 'review') armWatchdog()
    }
  }

  const dispose = () => {
    clearTimeout(watchdog)
    clearTimeout(failedTimer)
    clearTimeout(silenceTimer)
    clearTimeout(celebrateTimer)
  }

  return { handle, dispose, getState: () => st.current }
}

// ---------- 挂到 globalThis，供 tools 跨加载边界访问 ----------
// Hana 的 entry 与 tools 独立加载（dsh-hanako 已验证），模块级状态不可靠；
// 进程引用已走 g() 的 globalThis 单例，这里再把函数也挂上，tools 不 import 本文件、
// 直接从 globalThis.__jiadaiziPet 取函数，彻底避开相对 import 的加载风险。
function expose() {
  const inst = g()
  inst.startPet = startPet
  inst.stopPet = stopPet
  inst.restartPet = restartPet
  inst.isRunning = isRunning
  inst.drivePet = drivePet
  inst.queryState = queryState
  inst.readConfig = readConfig
  inst.getPort = getPort
  inst.logLine = logLine
  inst.createBridge = createBridge
}
expose()
