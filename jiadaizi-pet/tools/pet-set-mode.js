// 佳代子桌宠 · 工具：手动切动画状态
export const name = 'pet-set-mode'
export const description = '手动设置佳代子桌宠动画状态：idle（待机）/ working（干活）/ review（长思考）/ waiting（等用户）/ failed（出错）/ celebrating（完工庆祝）。'
export const parameters = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
      enum: ['idle', 'working', 'review', 'waiting', 'failed', 'celebrating'],
      description: '要切换到的动画状态',
    },
  },
  required: ['mode'],
}

export async function execute(args, ctx) {
  const P = globalThis.__jiadaiziPet || {}
  const cfg = typeof P.readConfig === 'function' ? P.readConfig(ctx) : {}
  const mode = String(args.mode || '')
  const ok = await P.drivePet(cfg, mode)
  const text = ok
    ? `已驱动桌宠到 ${mode}`
    : '驱动失败（桌宠未运行或端口不通）。可用 pet-status 查状态、pet-toggle 启动。'
  return { content: [{ type: 'text', text }], details: { pet: { ok, mode } } }
}
