# 鲸鱼娘桌宠 · 精灵图说明

本项目的桌宠素材是一张 **9 个单帧动作** 的精灵图，动态全靠程序 CSS transform 实时变换，不是逐帧序列图。

> 插件化后素材位于 `jiadaizi-pet/pet/assets/`，本契约中的文件路径均已按该位置更新。

## 图集规格

| 项目 | 值 |
| --- | --- |
| 文件 | `jiadaizi-pet/pet/assets/whale-spritesheet.png` |
| 格式 | PNG |
| 单格 | `192 × 208` px |
| 排布 | 9 个单帧动作，画布左侧一列 |
| 背景 | 全透明 |
| 缩放 | 0.85（显示尺寸 163.2 × 176.8） |

## 动作行

| 行 | 动作 | 说明 |
| --- | --- | --- |
| 0 | idle | 待机（漂浮呼吸） |
| 1 | runRight | 向右跑 |
| 2 | runLeft | 向左跑 |
| 3 | wave | 挥手 |
| 4 | jump | 跳跃 |
| 5 | failed | 出错低落 |
| 6 | waiting | 等待 |
| 7 | working | 专注干活 |
| 8 | review | 思考 |

## 状态机 → 动作映射

| mode | 动作 | 气泡文案 |
| --- | --- | --- |
| idle | idle | 休息中~ 有事叫我 |
| working | working | 努力工作中… |
| review | review | 唔…让我想想 |
| waiting | waiting | 在等你回复哦~ |
| failed | failed | 呜…出错了 (._.) |
| celebrating | jump / wave 交替 | 完成啦！ |
| 拖动 | runRight / runLeft（方向跟随） | 呜哇~ 别拽我！ |
| 点击 | wave | 诶嘿~ |

## 动态实现

- 单帧动作靠 CSS `background-position` 取帧。
- 动效（漂浮、打字顿挫、歪头、跳跃、撒花）全由 CSS keyframes 与 Web Animations API 实时变换。
- 庆祝撒花是程序生成的粒子动画，不依赖额外素材。
- 阴影随浮动反向缩放，营造悬浮感。
