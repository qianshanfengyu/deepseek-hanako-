# 佳代子桌宠（jiadaizi-pet）· 使用说明

完整插件化的佳代子桌宠：插件内嵌 Electron 桌宠本体，随 Hana 启动自动拉起、退出自动回收，事件总线自动联动动画。

## 一、能力

- **自动生命周期**：Hana 启动 → 自动拉起桌宠；Hana 退出 → 自动回收（`keepAlive=true` 时保留）。
- **事件联动**：订阅 Hana 事件总线，自动映射 思考 / 干活 / 等待 / 出错 / 完工庆祝 五种状态。
- **手动工具**：`pet_status` 查状态、`pet_toggle` 开关、`pet_restart` 重启、`pet_set_mode` 手动切动画。

## 二、工具

| 工具 | 作用 |
|---|---|
| `pet_status` | 查桌宠进程是否运行 + 当前 mode/seq |
| `pet_toggle` | 启动 / 停止 / 切换（action=start/stop/toggle） |
| `pet_restart` | 重启桌宠进程（改端口后生效） |
| `pet_set_mode` | 手动切动画（idle/working/review/waiting/failed/celebrating） |

## 三、配置（设置页「佳代子桌宠」）

| 配置 | 默认 | 说明 |
|---|---|---|
| autoStart | true | Hana 启动时自动拉起桌宠 |
| port | 8999 | 桌宠 HTTP 端口（改后重启桌宠生效） |
| keepAlive | false | Hana 退出时是否保留桌宠 |
| electronDir | 空 | 可选，指定已装好 electron 依赖的桌宠目录（复用本机已装 electron） |

## 四、electron 依赖解析顺序

1. 配置 `electronDir` 指定目录的 `node_modules/electron/dist/electron.exe`
2. 插件内嵌 `pet/electron/node_modules/electron/dist/electron.exe`
3. 本机旧目录兜底 `E:/AI/dsh-jiadaizi-like-pet/electron/node_modules/electron/dist/electron.exe`

若都找不到，需在插件 `pet/electron` 下 `npm install electron`（electron 二进制走 npmmirror 镜像），或配置 `electronDir` 指向已装目录。

## 五、排障

- **完工不播报/不庆祝**：事件桥接里 `turn_end` 后几乎总是紧跟 `turn_start`（间隔 1~2ms），它只是例行回合边界。庆祝静默窗口（2000ms）不能被 `turn_start` 取消，否则 celebrating 永远触发不了。取消集合只应含真正的新活动（session_user_message / agent_start / tool_execution_start / message_start）；`turn_start` 只续期窗口（pet-core.js 的 HARD_CANCEL / SOFT_RESET 已处理）。验证：`E:\AI\nodejs\node.exe` 跑脚本模拟事件流喂 `createBridge().handle()`，看最终状态是否为 celebrating。

- **联动日志**：`C:\Users\Administrator\.hanako\logs\jiadaizi-pet.log`（EVENT 事件观测 / SET 状态切换 / startPet/stopPet 进程记录）。
- **桌宠没出现**：查 `pet_status`；若未运行，`pet_toggle` 手动启动，看日志报错（多半是 electron.exe 找不到）。
- **端口冲突**：若 8999 被占，桌宠新实例会自动退出（EADDRINUSE），改配置 port 后 `pet_restart`。
- **改代码/配置后**：正式插件 onStartup 加载，无热重载，改 `index.js` / `pet-core.js` 需重启 Hana；改 `pet.html` 用 `POST /jiadaizi-pet/reload` 热重载。

## 六、铁律

- 桌宠身体是独立 Electron 进程，由本插件 spawn 管理，**不要**再用旧的 `start-pet.vbs` 手动启动（会与本插件管理的实例端口冲突）。
- 桌宠不挂 Harness（耦合一荣俱损）。

## 七、交互与行为（2026-08-20 富化）

改 `pet.html` 后热重载（`POST /jiadaizi-pet/reload`）即可生效；改 `main.js` / `preload.js` 需重启桌宠（它俩改了窗口、IPC 功能）。

### 交互
- **摸摸头**：按住桌宠 500ms 不移动触发（眯眼轻晃 + 心情气泡），松开心情 +6。
- **双击**：惊喜小跳 + 气泡，心情 +2。
- **右键菜单**（3.5s 自动收）：摸摸头 / 戳一戳 / 打个盹(30s) / 去睡会儿(隐藏 60s 自动回) / 切换形象 / 音量(0.3↔1.0 循环)。
- **悬停盯看**：鼠标在窗口内停留 1.5s（15s 限频一次）她会看着你。
- **打盹（sleeping 视觉层）**：idle 12 分钟无互动自动入睡；任何互动或事件唤醒。
- **拖放位置记忆**：拖到哪下次启动原样回来（主进程存 userData）。

### 时段感知（凌晨0-6/早晨/白天/夜晚 18-24）
- 每天每时段首次 idle 问候（防刷屏）；深夜待机小动作放缓 ×1.7、语音音量减半、撒花减量。

### 心情系统（-100~100，localStorage 持久化）
- 加分：摸头 +6、双击 +2、完工 +4；减分：出错 -8；每天 4 点后向 0 回归 20%。
- 心情 ≥40：角色金色光晕、爱打招呼/摇摆；≤-40：灰调、爱发呆沉思；跨档记得心情气泡。
- 存储键：`jiadaizi-mood` / `jiadaizi-mood-date` / `jiadaizi-skin` / `jiadaizi-vol` / `jiadaizi-greet`。

### 待机行为链（8 种）
挥手 / 歪头 / 眼巴巴 / 左看右看 / 伸懒腰 / 打哈欠 / 望天 / 轻轻摇摆；12% 概率直接吐心事。深夜不连招。

### 维护
- 改动记录见项目 `E:\AI\dsh-jiadaizi-like-pet\CHANGELOG.md`；本次富化的完整行为/素材清单同见该文件「2026-08-20」。
