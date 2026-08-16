# 🐋 deepseek 娘桌宠（鲸鱼娘 · 溟月）

> 一只常驻 Windows 桌面右下角的 deepseek 娘桌宠，本体名「佳代子」。
> 她会盯着 AI 助手干活：你搓代码时她努力搬砖，你思考时她歪头想事情，等你回复时她眼巴巴看着，任务完成时她跳起来撒花，还会随机喊一句日文完工语音 🎉

## ✨ 特性

- **透明置顶无边框窗口**：Electron 实现，常驻屏幕右下角，不占任务栏
- **6 种状态动画**：待机 / 干活 / 思考 / 等待 / 出错 / 庆祝，全由 CSS + Web Animations API 实时驱动
- **9 个单帧动作素材**：精灵图排成一列，动态全靠程序 transform 变换，没有逐帧序列图，轻量不卡顿
- **完工语音**：庆祝时随机播放 5 句「碧蓝档案 · 佳代子」日文 TTS 完工语音
- **可互动**：拖动到处跑（跑步动画方向跟随），点击挥手打招呼
- **待机小动作**：每 14~30 秒自己挥挥手、歪歪头，不呆板
- **状态联动**：通过本地 HTTP 服务 `127.0.0.1:8999` 暴露状态机，任何程序都能驱动桌宠切换状态

## 🎮 状态 → 动作映射

| 状态 | 桌宠动作 | 气泡文案 |
| --- | --- | --- |
| 待机 idle | 漂浮呼吸，偶尔小动作 | 休息中~ 有事叫我 |
| 干活 working | 打字顿挫，前倾小顿 | 努力工作中… |
| 思考 review | 大幅缓慢左右歪头 + 点点 | 唔…让我想想 |
| 等待 waiting | 期待小跳 | 在等你回复哦~ |
| 出错 failed | 泄气下沉 | 呜…出错了 (._.) |
| 庆祝 celebrating | 弹性跳 + 摇摆 + 撒花 + 完工语音 | 完成啦！ |

## 🚀 快速开始

### 需要准备

- Windows 10 / 11
- Node.js（LTS 版，自带 npm）

### 安装

```bash
cd electron
npm install
# 国内网络慢可换镜像：
npm install --registry=https://registry.npmmirror.com
```

### 启动

| 方式 | 操作 | 说明 |
| --- | --- | --- |
| ① 推荐 | 双击 `start-pet.vbs` | 无黑窗口，静默启动 |
| ② | 双击 `start-pet.bat` | 有命令行窗口 |
| ③ | 进 `electron` 文件夹执行 `npm start` | 调试用 |

桌宠会出现在屏幕右下角，托盘图标右键可退出。

## 🔌 状态联动（进阶，可选）

桌宠本体是独立程序，默认只有待机动画和点击互动。要让 AI 助手自动驱动它切换状态，通过本地 HTTP 服务：

- `GET /jiadaizi-pet/state` 查当前状态
- `POST /jiadaizi-pet/set-mode` 驱动状态，body 如 `{"mode":"celebrating"}`
- `POST /jiadaizi-pet/reload` 热重载页面（改 pet.html 后无需重启进程）

可选模式：`idle` / `working` / `review` / `waiting` / `failed` / `celebrating`。

仓库自带 `hana-bridge/`，是配合 Hana 平台的事件桥接插件，把「思考 / 干活 / 失败 / 完成」映射成桌宠动画。不用 Hana 的话桌宠就是纯装饰，不影响使用。

## 📁 项目结构

```
deepseek-hanako-/
├── start-pet.bat / start-pet.vbs   启动脚本
├── set-pet-mode.ps1                手动驱动状态（调试用）
├── electron/                       桌宠程序本体（main.js / pet.html / preload.js）
├── assets/                         素材
│   ├── whale-spritesheet.png       精灵图（9 个单帧动作）
│   ├── voice-1.mp3 ~ voice-5.mp3   完工语音（佳代子日文 TTS）
│   └── voice-complete.wav  备用音效
├── hana-bridge/                    可选：Hana 平台联动插件
├── docs/                           文档
└── release/                        交付包（鲸鱼娘桌宠-溟月）
```

## ⚠️ 素材版权声明

- `assets/voice-1.mp3` ~ `voice-5.mp3` 为《碧蓝档案》角色「佳代子」的 TTS 生成语音片段，版权归原作方所有，**仅供个人学习交流使用**，请勿用于商业用途；如需商用请自行替换为无版权素材。
- 若您是权利人且不希望相关内容被展示，请联系删除。

## 📄 License

代码以 [MIT License](LICENSE) 开源。素材文件（`assets/`）仅限个人学习交流，遵循上文声明。
