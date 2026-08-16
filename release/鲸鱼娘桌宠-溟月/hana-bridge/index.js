// 溟月桥接 · Hana 侧插件
// 职责：订阅 Hana 事件总线（ctx.bus.subscribe），把佳代子的真实工作状态
//       （思考 / 工具执行 / 失败 / 完成 / 空闲）自动映射为桌宠 mode，
//       经 HTTP POST http://127.0.0.1:8999/jiadaizi-pet/set-mode 驱动鲸鱼娘「溟月」。
// 庆祝（撒花 + 语音）时机：只在整轮彻底结束（agent_end）且静默确认无后续动作、
//       本轮做过实质工具工作且无错时触发——绝不在单个小思考/小工具完成后播报。
// 观测：状态日志写 .hanako/logs/whale-pet-bridge.log，校准映射表用。
// 铁律：桌宠本体独立进程（用户会话启动），本插件绝不 spawn / 管理桌宠进程。

import fs from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import http from 'node:http'

const PET_URL = 'http://127.0.0.1:8999/jiadaizi-pet/set-mode'
const LOG_FILE = join(os.homedir(), '.hanako', 'logs', 'whale-pet-bridge.log')

function logLine(s) {
  try { fs.appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + s + '\n') } catch (e) { /* noop */ }
}

const STATES = {
  IDLE: 'idle',
  WORKING: 'working',
  REVIEW: 'review',
  WAITING: 'waiting',
  FAILED: 'failed',
  CELEBRATING: 'celebrating',
}

// 事件类型 → 桌宠状态（依据观测日志校准：agent_end = 整轮结束）
const EVENT_MAP = {
  tool_execution_start: STATES.WORKING,
  tool_execution_update: STATES.WORKING,
  tool_execution_end: STATES.REVIEW, // 工具结束 → 回到思考（干完活开始总结）
  turn_start: STATES.REVIEW,
  llm_usage: STATES.REVIEW,
  message_start: STATES.REVIEW,
  message_update: STATES.REVIEW,
  message_end: STATES.REVIEW,
  turn_end: STATES.IDLE,
}

// 关键词兜底（尚未观测到的事件名，先按语义猜）
function inferState(event) {
  const type = String((event && event.type) || '')
  if (EVENT_MAP[type]) return EVENT_MAP[type]
  const t = type.toLowerCase()
  if (!t) return null
  if (t.includes('error') || t.includes('fail') || t.includes('abort')) return STATES.FAILED
  if (t.includes('wait') || t.includes('approval') || t.includes('permission') || t.includes('confirm')) return STATES.WAITING
  if (t.includes('think') || t.includes('review') || t.includes('plan')) return STATES.REVIEW
  if (t.includes('run') || t.includes('start') || t.includes('send') || t.includes('tool') || t.includes('work')) return STATES.WORKING
  return null
}

// 幂等驱动桌宠：桌宠侧同 mode 会忽略；这里只负责发，短请求不阻塞
function drivePet(mode) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ mode })
    const req = http.request(PET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { res.resume(); res.on('end', () => resolve(true)) })
    req.on('error', () => resolve(false)) // 桌宠没开：静默跳过，不中断
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
    req.end(body)
  })
}

// 时间参数
const CELEBRATE_COOLDOWN_MS = 10000 // 两次庆祝最小间隔
const SILENCE_CONFIRM_MS = 2000     // agent_end 后静默确认窗口：期间无新动作才算真正收工
const IDLE_WATCHDOG_MS = 15000      // working/review 持续无事件 → 自动回 idle
const FAILED_HOLD_MS = 3000         // 翻车保持时长（桌宠侧动画 2.6s）
const CELEBRATE_FALLBACK_MS = 5200  // 庆祝后回 idle（略长于桌宠侧 4.8s 动画）

// 会开启「新活动」的事件：一旦出现，取消 agent_end 的静默确认
const NEW_ACTIVITY = [
  'session_user_message',
  'agent_start',
  'turn_start',
  'message_start',
  'tool_execution_start',
]

export default class Plugin {
  async onload() {
    const ctx = this.ctx
    this.state = { current: 'idle', lastCelebrationAt: 0 }
    // 本轮工作记录：一次用户消息 → 完整回复 的范围内，是否做过工具 / 是否出错
    this.round = { hasWork: false, hasError: false }
    this._watchdog = null
    this._failedTimer = null
    this._silenceTimer = null
    this._celebrateTimer = null
    this._evtLogAt = {}

    const apply = async (next, reason) => {
      if (next === this.state.current) return
      this.state.current = next
      logLine('SET ' + next + ' (' + reason + ')')
      await drivePet(next)
    }

    const armWatchdog = () => {
      clearTimeout(this._watchdog)
      this._watchdog = setTimeout(() => {
        if (['working', 'review'].includes(this.state.current)) {
          logLine('WATCHDOG -> idle (no events)')
          this.state.current = 'idle'
          drivePet('idle')
        }
      }, IDLE_WATCHDOG_MS)
    }

    const scheduleFailedFallback = () => {
      clearTimeout(this._failedTimer)
      this._failedTimer = setTimeout(() => {
        if (this.state.current === 'failed') {
          this.state.current = 'idle'
          drivePet('idle')
        }
      }, FAILED_HOLD_MS)
    }

    const scheduleCelebrateFallback = () => {
      clearTimeout(this._celebrateTimer)
      this._celebrateTimer = setTimeout(() => {
        if (this.state.current === 'celebrating') {
          this.state.current = 'idle'
          drivePet('idle')
        }
      }, CELEBRATE_FALLBACK_MS)
    }

    // 取消 agent_end 的静默确认（有新的活动插进来）
    const cancelPending = () => clearTimeout(this._silenceTimer)

    // 整轮结束判定：agent_end 后静默 SILENCE_CONFIRM_MS，期间无新动作才庆祝
    const tryCelebrate = () => {
      clearTimeout(this._silenceTimer)
      this._silenceTimer = setTimeout(() => {
        const t = Date.now()
        if (this.round.hasError) {
          logLine('agent_end: round had error, no celebrate')
          apply('idle', 'agent_end had error')
          return
        }
        if (!this.round.hasWork) {
          logLine('agent_end: no tool work this round, no celebrate')
          apply('idle', 'agent_end no work')
          return
        }
        if (t - this.state.lastCelebrationAt < CELEBRATE_COOLDOWN_MS) {
          logLine('agent_end: celebrate cooldown, skip')
          apply('idle', 'agent_end cooldown')
          return
        }
        this.state.lastCelebrationAt = t
        apply('celebrating', 'agent_end round complete')
        scheduleCelebrateFallback()
      }, SILENCE_CONFIRM_MS)
    }

    if (ctx.bus && typeof ctx.bus.subscribe === 'function') {
      try {
        this.unsubscribe = ctx.bus.subscribe((event) => {
          const type = String((event && event.type) || '(unknown)')
          const now = Date.now()

          // 观测日志：同类事件 30 秒内最多记一条，避免刷屏
          if (!this._evtLogAt[type] || now - this._evtLogAt[type] >= 30000) {
            this._evtLogAt[type] = now
            logLine('EVENT type=' + type +
              ' agent=' + (event && event.agentId) +
              ' isError=' + (!!(event && event.isError)) +
              ' tool=' + (event && event.toolName) +
              ' infer=' + inferState(event))
          }

          // 新活动出现 → 取消待定庆祝；新一轮（用户消息 / agent 启动）→ 重置本轮记录
          if (NEW_ACTIVITY.includes(type)) cancelPending()
          if (type === 'session_user_message' || type === 'agent_start') {
            this.round = { hasWork: false, hasError: false }
          }

          // 出错：翻车优先，取消一切待定
          if (event && event.isError) {
            cancelPending()
            this.round.hasError = true
            apply('failed', 'isError')
            scheduleFailedFallback()
            return
          }

          // 工具开始 → 标记本轮做过实质工作
          if (type === 'tool_execution_start') {
            this.round.hasWork = true
          }

          // 整轮结束判定：新版 Hana 不再广播 agent_end，改用 turn_end + 静默窗口判定整轮结束。
          // turn_end 先回待机，同时启动静默确认（期间无 turn_start / tool_execution_start 等新活动才算真正收工）
          if (type === 'turn_end') {
            apply('idle', 'turn_end')
            tryCelebrate()
            return
          }

          // 其余事件按映射驱动状态
          const st = inferState(event)
          if (st) {
            apply(st, 'event ' + type)
            if (st === 'working' || st === 'review') armWatchdog()
          }
        })
        logLine('bridge loaded, bus subscribed')
        if (ctx.log && ctx.log.info) ctx.log.info('whale-pet-bridge loaded, bus subscribed')
      } catch (e) {
        logLine('bus subscribe failed: ' + String(e))
        if (ctx.log && ctx.log.warn) ctx.log.warn('whale-pet-bridge: bus subscribe failed ' + String(e))
      }
    } else {
      logLine('bus not available (ctx.bus.subscribe missing)')
    }
  }

  async onunload() {
    if (this.unsubscribe && typeof this.unsubscribe === 'function') {
      try { this.unsubscribe() } catch (e) { /* noop */ }
    }
    logLine('bridge unloaded')
  }
}
