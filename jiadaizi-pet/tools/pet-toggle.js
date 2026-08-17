// 佳代子桌宠 · 工具：启动/停止/切换
export const name = 'pet-toggle'
export const description = '启动 / 停止 / 切换佳代子桌宠进程。action=start 启动、stop 停止、toggle 按当前状态切换（默认）。'
export const parameters = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['start', 'stop', 'toggle'],
      description: 'start=启动 / stop=停止 / toggle=切换（默认）',
    },
  },
  required: [],
}

export async function execute(args, ctx) {
  const P = globalThis.__jiadaiziPet || {}
  const cfg = typeof P.readConfig === 'function' ? P.readConfig(ctx) : {}
  const action = args.action || 'toggle'
  const running = typeof P.isRunning === 'function' && P.isRunning()
  let text
  let r
  try {
    if (action === 'start' || (action === 'toggle' && !running)) {
      r = await P.startPet(cfg)
      text = r.alreadyRunning ? `桌宠已在运行（pid=${r.pid}）` : `桌宠已启动（pid=${r.pid}，端口 ${r.port}）`
    } else {
      r = await P.stopPet()
      text = r.alreadyStopped ? '桌宠本来就没在运行' : `桌宠已停止（pid=${r.pid}）`
    }
  } catch (e) {
    return { content: [{ type: 'text', text: '操作失败：' + (e?.message || String(e)) }] }
  }
  return { content: [{ type: 'text', text }], details: { pet: r } }
}
