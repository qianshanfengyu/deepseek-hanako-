// 佳代子桌宠 · 工具：查询状态
// 注意：不 import pet-core（Hana entry/tools 独立加载，跨文件 import 不可靠），
//       统一从 globalThis.__jiadaiziPet 取核心函数（pet-core 加载时已 expose）。
export const name = 'pet-status'
export const description = '查询佳代子桌宠当前状态：进程是否在运行、当前动画 mode、序列号（seq）。'
export const parameters = { type: 'object', properties: {}, required: [] }

export async function execute(args, ctx) {
  const P = globalThis.__jiadaiziPet || {}
  const cfg = typeof P.readConfig === 'function' ? P.readConfig(ctx) : {}
  const running = typeof P.isRunning === 'function' && P.isRunning()
  let mode = null
  let seq = null
  if (running && typeof P.queryState === 'function') {
    const s = await P.queryState(cfg)
    mode = s?.mode ?? null
    seq = s?.seq ?? null
  }
  const text = running
    ? `桌宠运行中：mode=${mode ?? 'unknown'}，seq=${seq ?? '-'}`
    : '桌宠未运行（进程未启动或已退出）。可用 pet-toggle 启动。'
  return { content: [{ type: 'text', text }], details: { pet: { running, mode, seq } } }
}
