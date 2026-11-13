# AXIOM · 虚手实验室

手势驱动的 3D 化学实验沙盒。摄像头识别捏合/握拳，在浏览器里完成「粗盐提纯」8 步实验，全程打分并生成证书。

## 在线体验

- 主实验：`index.html`
- 自动演示（无需摄像头）：`index.html?demo=1`
- 操作回放：`replay.html`
- 操作记录：`log.html`

本地：`npx -y serve -l 5173 .` 后打开 http://localhost:5173

## 实验流程

倒入溶液 → 取盐 → 加盐 → 搅拌（画圈）→ 点燃 → 蒸发 → 盖灭 → 观察结晶

手势：张开=移动光标，捏合=抓取，握拳=盖灭。无摄像头时左键=捏合、右键=握拳。

## 结构

| 文件 | 作用 |
| --- | --- |
| `main.js` | 渲染、手势总线、动作实现、一轮实验收尾 |
| `fsm.js` | 8 步流程表 + 评分规则 + 证书评价句 |
| `hand.js` | MediaPipe 手部关键点 → 姿势分类 → 时间/投票过滤 |
| `stir.js` | 搅拌轨迹判定（质心 + 解卷绕转角） |
| `scene.js` | 3D 场景、拾取、动画 |
| `physics.js` | 固定步长粒子物理 |
| `demo.js` | 自动演示剧本，走与真手相同的 gesture 事件总线 |

## 自检

```
node fsm.test.mjs && node hand.test.mjs && node physics.test.mjs && node stir.test.mjs
```

零构建，three.js 由 importmap 从 unpkg 加载，MediaPipe 从 jsDelivr 加载。
