// 手势识别：MediaPipe Hand Landmarker → 纯函数分类 → 时间/投票过滤 → 'gesture' 事件
// 纯函数部分（classify / makeFilter）无浏览器依赖，可 node 测试

import { GESTURE } from './config.js';

// 21 点：0 腕, 4 拇指尖, 8 食指尖, 12 中指尖, 16 无名尖, 20 小指尖, 9 中指根
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 原始比值，标定用
export function ratios(lm) {
  const palm = dist(lm[0], lm[9]) || 1e-6;
  return {
    palm,
    pinchR: dist(lm[4], lm[8]) / palm,
    fistR: [8, 12, 16, 20].reduce((s, i) => s + dist(lm[i], lm[9]), 0) / 4 / palm,
  };
}

// 返回 { pose:'pinch'|'fist'|'open', conf:0..1, palm, tip:{x,y} }
// conf 低于 CONF 门限的 pinch/fist 降级为 open
export function classify(lm, { PINCH = GESTURE.PINCH, FIST = GESTURE.FIST, CONF = GESTURE.CONF } = {}) {
  const { palm, pinchR, fistR } = ratios(lm);
  const tip = { x: lm[8].x, y: lm[8].y };
  let pose = 'open', conf;
  if (fistR < FIST)       { pose = 'fist';  conf = clamp(1 - fistR / FIST); }
  else if (pinchR < PINCH){ pose = 'pinch'; conf = clamp(1 - pinchR / PINCH); }
  else                     conf = clamp((pinchR - PINCH) / PINCH);
  if (pose !== 'open' && conf < CONF) { pose = 'open'; }
  return { pose, conf, palm, tip, pinchR, fistR };
}
const clamp = v => Math.max(0, Math.min(1, v));

// 抗抖动：连续 N 帧多数投票 + 新姿势保持 holdMs 才生效
// feed(pose, now) → 'pinch'|'fist'|'open' 当前已确认姿势
export function makeFilter({ N = GESTURE.N, holdMs = GESTURE.HOLD_MS } = {}) {
  const win = [];
  let stable = 'open', cand = null, candSince = 0;
  const api = {
    onShort: null,          // (pose, heldMs) 候选姿势保持 ≥ MIN_SHORT 但不足 holdMs 就放弃时回调
    feed(pose, now) {
      win.push(pose); if (win.length > N) win.shift();
      const cnt = {}; for (const p of win) cnt[p] = (cnt[p] || 0) + 1;
      const vote = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
      if (vote === stable) { dropCand(now); return stable; }
      if (vote !== cand) { dropCand(now); cand = vote; candSince = now; return stable; }
      if (now - candSince >= holdMs) { stable = vote; cand = null; }
      return stable;
    },
    get stable() { return stable; },
    reset() { win.length = 0; stable = 'open'; cand = null; },
  };
  const MIN_SHORT = 100;
  function dropCand(now) {
    if (cand && cand !== 'open') { const held = now - candSince; if (held >= MIN_SHORT && held < holdMs) api.onShort?.(cand, held); }
    cand = null;
  }
  return api;
}

// 归一化视频坐标 → NDC；mirror=true 时与镜像预览一致
export const toNDC = (p, mirror = true) => ({ x: (mirror ? 1 - p.x : p.x) * 2 - 1, y: -p.y * 2 + 1 });

// 加载 MediaPipe（CDN 地址只写这一处）
export async function loadLandmarker() {
  const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14');
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
  const lmk = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numHands: 2,
  });
  return { lmk, HandLandmarker };
}

// 浏览器侧：挂到 video，派发与鼠标模式同名的 gesture 事件 {type:'pinch'|'release'|'fist'|'unfist'|'move', ndc}
export async function startHand(video, { onFrame, mirror = true, filter = makeFilter() } = {}) {
  const { lmk, HandLandmarker } = await loadLandmarker();
  const emit = (type, ndc, extra) => window.dispatchEvent(new CustomEvent('gesture', { detail: { type, ndc, ...extra } }));
  let lastT = -1, prev = 'open', sm = null, running = true;
  filter.onShort = (pose, held) => emit('short', sm ? toNDC(sm, mirror) : { x: 0, y: 0 }, { pose, held });
  const loop = () => {
    if (!running) return;
    if (video.currentTime !== lastT) {
      lastT = video.currentTime;
      const now = performance.now();
      const r = lmk.detectForVideo(video, now);
      // 两只手都跟踪，取「更像在做动作」的那只（pinchR/fistR 最小）
      const lm = r.landmarks.length > 1
        ? r.landmarks.map(l => [l, Math.min(ratios(l).pinchR, ratios(l).fistR)]).sort((a, b) => a[1] - b[1])[0][0]
        : r.landmarks[0];
      if (lm) {
        const c = classify(lm);
        sm = sm ? { x: sm.x + GESTURE.ALPHA * (c.tip.x - sm.x), y: sm.y + GESTURE.ALPHA * (c.tip.y - sm.y) } : c.tip;
        const ndc = toNDC(sm, mirror);
        const cur = filter.feed(c.pose, now);
        if (cur !== prev) {
          if (prev === 'pinch') emit('release', ndc, { conf: c.conf });
          if (prev === 'fist')  emit('unfist',  ndc, { conf: c.conf });
          if (cur === 'pinch')  emit('pinch',   ndc, { conf: c.conf });
          if (cur === 'fist')   emit('fist',    ndc, { conf: c.conf });
          prev = cur;
        }
        emit('move', ndc, { conf: c.conf });
        onFrame?.({ lm, raw: c, stable: cur, ndc });
      } else onFrame?.({ lm: null });
    }
    requestAnimationFrame(loop);
  };
  loop();
  return { stop() { running = false; lmk.close(); }, HandLandmarker };
}
