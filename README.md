# 🐋 佳代子桌宠（鲸鱼娘 · 溟月）· Hana 插件版

> 一只常驻 Windows 桌面右下角的 deepseek 娘桌宠，本体名「佳代子」。
> 现在已经完整插件化：一个 `jiadaizi-pet` 插件内嵌 Electron 桌宠本体、事件联动桥接、4 个工具和配置页。装一个插件，Hana 启动自动拉起桌宠，退出自动回收，桌宠动画自动跟随佳代子的真实工作状态。

## ✨ 特性

- **一键插件化**：插件内嵌桌宠本体与全部素材，放入 Hana 插件目录即可，无需单独启动脚本
- **随 Hana 启停**：启动自动拉起（`autoStart`）、退出自动回收（可 `keepAlive` 保留常驻）
- **状态联动**：订阅 Hana 事件总线，把「思考 / 干活 / 等待 / 出错 / 完工」实时映射为桌宠动画
- **完工庆祝**：对话彻底结束后（agent_end + 静默窗口判定），仅当本轮真正干过活且无错时才撒花并随机播放 5 句日文完工语音
- **透明置顶无边框窗口**：Electron 实现，常驻屏幕右下角，不占任务栏
- **6 种状态动画**：待机 / 干活 / 思考 / 等待 / 出错 / 庆祝，全由 CSS + Web Animations API 实时驱动
- **9 个单帧动作素材**：精灵图排成一列，动态全靠程序 transform 变换，没有逐帧序列图，轻量不卡顿
- **可互动**：拖动到处跑（跑步动画方向跟随），点击挥手打招呼
- **待机小动作**：每 14~30 秒自己挥挥手、歪歪头，不呆板
- **4 个工具 + 配置页**：`pet-status` / `pet-toggle` / `pet-restart` / `pet-set-mode`，配置项全在 Hana 设置页

## 🎮 状态 → 动作映射

| 状态 | 桌宠动作 | 气泡文案 |
| --- | --- | --- |
| 待机 idle | 漂浮呼吸，偶尔小动作 | 休息中~ 有事叫我 |
| 干活 working | 打字顿挫，前倾小顿 | 努力工作中… |
| 思考 review | 大幅缓慢左右歪头 + 点点 | 唔…让我想想 |
| 等待 waiting | 期待小跳 | 在等你回复哦~ |
| 出错 failed | 泄气下沉 | 呜…出错了 (._.) |
| 庆祝 celebrating | 弹性跳 + 摇摆 + 撒花 + 完工语音 | 完成啦！ |

## 🚀 安装

### 需要准备

- Windows 10 / 11
- Hana 平台 0.159.0 及以上
- Node.js（LTS 版，带 npm；用于解析 electron 依赖）

### 步骤

1. 把 `jiadaizi-pet` 目录（本仓库根目录下）放入 Hana 插件目录：`<Hana 数据目录>\plugins\jiadaizi-pet`
2. 重启 Hana

重启后桌宠自动出现在屏幕右下角，无需任何手动启动。

### electron 依赖（关键）

插件内嵌桌宠源码与素材，但不含 electron 依赖（node_modules）。electron.exe 解析顺序：

1. 配置 `electronDir` 指向已装好依赖的桌宠目录
2. 插件内嵌 `pet/electron/node_modules/electron/dist/electron.exe`
3. 本机旧目录兜底（如 `E:/AI/dsh-jiadaizi-like-pet/electron/node_modules/electron/dist/electron.exe`）

三处都找不到时，在插件 `pet/electron` 下执行 `npm install electron`（国内可加 `--registry=https://registry.npmmirror.com`），或在设置页填 `electronDir`。

## ⚙️ 配置

设置 → 插件 → 佳代子桌宠，可调：

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| autoStart | true | 随 Hana 启动自动拉起桌宠 |
| port | 8999 | 桌宠本体状态驱动端口（127.0.0.1），改动后重启桌宠生效 |
| keepAlive | false | Hana 退出时是否保留桌宠继续常驻 |
| electronDir | （空） | 指定已装好 electron 依赖的目录，可跳过内嵌依赖解析 |

## 🛠 工具

| 工具 | 作用 |
| --- | --- |
| `pet-status` | 查询桌宠运行状态、当前动画 mode、序列号 |
| `pet-toggle` | 启动 / 停止 / 切换桌宠 |
| `pet-restart` | 重启桌宠进程（改端口等配置后生效，或卡死时恢复） |
| `pet-set-mode` | 手动设置动画状态：idle / working / review / waiting / failed / celebrating |

联动日志：`<Hana 数据目录>\logs\jiadaizi-pet.log`

## 📁 项目结构

```
deepseek-hanako-/
├── jiadaizi-pet/             插件本体
│   ├── manifest.json         插件清单（id / 版本 / 配置项）
│   ├── index.js              插件入口（拉起 / 回收 / 订阅事件）
│   ├── pet-core.js           事件桥接核心（agent_end 完工判定、状态机）
│   ├── pet/
│   │   ├── electron/         桌宠程序本体（main.js / pet.html / preload.js）
│   │   └── assets/           素材（精灵图 + 5 句日文完工语音）
│   ├── skills/               佳代子桌宠 skill（使用说明）
│   └── tools/                4 个工具（status / toggle / restart / set-mode）
├── docs/
│   ├── SPRITESHEET-CONTRACT.md  精灵图契约（素材约束文档）
│   └── legacy-20260817/      旧版桌面直启/桥接方案归档（2026-08-17 插件化时移入，仅作历史参考，勿再使用）
├── README.md
├── CHANGELOG.md
├── LICENSE
└── package.json
```

## ⚠️ 素材版权声明

- `pet/assets/voice-1.mp3` ~ `voice-5.mp3` 为《碧蓝档案》角色「佳代子」的 TTS 生成语音片段，版权归原作方所有，**仅供个人学习交流使用**，请勿用于商业用途；如需商用请自行替换为无版权素材。
- 若您是权利人且不希望相关内容被展示，请联系删除。
- 精灵图 `pet/assets/whale-spritesheet.png` 为自绘素材，约束见 `docs/SPRITESHEET-CONTRACT.md`。

## 📄 License

代码以 [MIT License](LICENSE) 开源。素材文件（`pet/assets/`）仅限个人学习交流，遵循上文声明。