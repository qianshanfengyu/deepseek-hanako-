// 佳代子桌宠 · 工具：重启
export const name = 'pet-restart'
export const description = '重启佳代子桌宠进程（改端口等配置后生效，或桌宠卡死时恢复）。'
export const parameters = { type: 'object', properties: {}, required: [] }

export async function execute(args, ctx) {
  const P = globalThis.__jiadaiziPet || {}
  const cfg = typeof P.readConfig === 'function' ? P.readConfig(ctx) : {}
  let r
  try {
    r = await P.restartPet(cfg)
  } catch (e) {
    return { content: [{ type: 'text', text: '重启失败：' + (e?.message || String(e)) }] }
  }
  const text = r.alreadyRunning
    ? `桌宠已在运行（pid=${r.pid}）`
    : `桌宠已重启（pid=${r.pid}，端口 ${r.port}）`
  return { content: [{ type: 'text', text }], details: { pet: r } }
}
