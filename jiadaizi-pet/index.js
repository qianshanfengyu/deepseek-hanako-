// 佳代子桌宠 · Hana 插件入口
// 职责：
//   1. onStartup 时按配置自动拉起桌宠 Electron 进程（autoStart）
//   2. 订阅 Hana 事件总线，把佳代子真实工作状态映射为桌宠动画
//   3. 卸载时回收桌宠进程（keepAlive=false）并退订事件

import { startPet, stopPet, createBridge, readConfig, logLine } from './pet-core.js'

export default class Plugin {
  async onload() {
    const ctx = this.ctx
    const cfg = readConfig(ctx)
    this._bridge = null
    this._unsubscribe = null

    // 1) 自动启动桌宠
    if (cfg.autoStart !== false) {
      try {
        const r = await startPet(cfg)
        logLine('onload autoStart: ' + JSON.stringify(r))
        if (ctx.log && ctx.log.info) {
          ctx.log.info(r.alreadyRunning
            ? `[jiadaizi-pet] 桌宠已在运行（pid=${r.pid}）`
            : `[jiadaizi-pet] 桌宠已随 Hana 启动（pid=${r.pid}，端口 ${r.port}）`)
        }
      } catch (e) {
        logLine('onload autoStart failed: ' + (e && e.message))
        if (ctx.log && ctx.log.warn) ctx.log.warn('[jiadaizi-pet] 自动启动桌宠失败：' + (e && e.message))
      }
    } else {
      logLine('onload autoStart disabled')
    }

    // 2) 订阅事件总线，联动桌宠动画
    if (ctx.bus && typeof ctx.bus.subscribe === 'function') {
      try {
        this._bridge = createBridge(cfg)
        this._unsubscribe = ctx.bus.subscribe((event) => this._bridge.handle(event))
        logLine('bridge subscribed')
        if (ctx.log && ctx.log.info) ctx.log.info('[jiadaizi-pet] 已订阅事件总线，桌宠联动就绪')
      } catch (e) {
        logLine('bus subscribe failed: ' + String(e))
        if (ctx.log && ctx.log.warn) ctx.log.warn('[jiadaizi-pet] 事件总线订阅失败：' + String(e))
      }
    } else {
      logLine('bus not available (ctx.bus.subscribe missing)')
    }

    // 3) 卸载回收
    this.register(() => {
      try { if (this._unsubscribe) this._unsubscribe() } catch { /* noop */ }
      try { if (this._bridge) this._bridge.dispose() } catch { /* noop */ }
      if (cfg.keepAlive !== true) {
        stopPet().then(() => logLine('onunload stopped pet (keepAlive=false)'))
      } else {
        logLine('onunload keepAlive=true, pet left running')
      }
    })
  }
}
