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
