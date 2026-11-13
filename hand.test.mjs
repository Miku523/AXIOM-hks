// node hand.test.mjs
import { classify, makeFilter, toNDC } from './hand.js';
const P = (x, y) => ({ x, y });
const base = () => Array.from({ length: 21 }, () => P(0, 0));

// 手掌长 0→9 = 1；张开：四指尖远离 9，拇指远离食指
const open = base(); open[9] = P(0, 1); for (const i of [8,12,16,20]) open[i] = P(i/10, 2); open[4] = P(-1, 1);
console.assert(classify(open).pose === 'open');

// 捏合：4 与 8 距离 0.05（conf 0.8 > CONF 0.7），其他指尖远
const pinch = base(); pinch[9] = P(0, 1); for (const i of [12,16,20]) pinch[i] = P(1, 2); pinch[8] = P(0, 2); pinch[4] = P(0.05, 2);
const c = classify(pinch); console.assert(c.pose === 'pinch' && c.conf > 0.7, JSON.stringify(c));
pinch[4] = P(0.24, 2); console.assert(classify(pinch).pose === 'open', '松捏合 conf<门限 降级为 open');

// 握拳：四指尖都贴着 9（fistR 0.1 → conf 0.78）
const fist = base(); fist[9] = P(0, 1); for (const i of [8,12,16,20]) fist[i] = P(0.1, 1); fist[4] = P(0, 1.2);
console.assert(classify(fist).pose === 'fist');

// 过滤：单帧抖动不翻，5 帧多数 + 500ms 才翻
const f = makeFilter();
let t = 0;
console.assert(f.feed('pinch', t) === 'open', '1 帧不翻');
for (let i = 0; i < 4; i++) f.feed('pinch', t += 16);
console.assert(f.stable === 'open', '多数但未满 500ms');
f.feed('pinch', t += 500);
console.assert(f.stable === 'pinch', '保持 500ms 后翻');
f.feed('open', t += 16); f.feed('open', t += 16);
console.assert(f.stable === 'pinch', '2/5 票不翻');

// 保持不足回调：候选 pinch 持续 200ms 后被 open 多数压掉
const f2 = makeFilter(); let short = null; f2.onShort = (p, h) => short = { p, h };
let t2 = 0; for (let i = 0; i < 5; i++) f2.feed('pinch', t2 += 40);        // 200ms 候选
for (let i = 0; i < 5; i++) f2.feed('open', t2 += 16);
console.assert(short?.p === 'pinch' && short.h >= 100 && short.h < 500, 'onShort ' + JSON.stringify(short));

// NDC 镜像
const n = toNDC(P(0.25, 0.25)); console.assert(n.x === 0.5 && n.y === 0.5, JSON.stringify(n));
console.log('ok');
