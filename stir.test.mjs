import { createStirTracker } from './stir.js';
const circle = (tr, turns, r, dir = 1, steps = 40) => { for (let i = 0; i <= steps * turns; i++) { const a = dir * i / steps * 2 * Math.PI; tr.feed({ x: Math.cos(a) * r, z: Math.sin(a) * r }); } };

let t = createStirTracker(); t.start({ x: 0, z: 0 }); circle(t, 3, .2);
let r = t.stop(); console.assert(r.ok && r.turns >= 2.9 && r.reversals === 0, JSON.stringify(r));

t = createStirTracker(); t.start({ x: 0, z: 0 }); circle(t, .8, .2);
r = t.stop(); console.assert(r.code === 'stir_short', r.code);

t = createStirTracker(); t.start({ x: 0, z: 0 }); // 反向：连续画反方向整圈（每段 1.5 圈 > 180° 门限）
for (let k = 0; k < 4; k++) circle(t, 1.5, .2, k % 2 ? 1 : -1);
r = t.stop(); console.assert(r.reversals >= 2, JSON.stringify(r));

// 手抖：正转时夹少量小幅反向噪声，不应判为方向反复
const t3 = createStirTracker({ minStep: .02 }); t3.start();
for (let i = 0; i <= 200; i++) { const a = i / 50 * 2 * Math.PI + (i % 3 ? .03 : -.03); t3.feed({ x: Math.cos(a) * .2, z: Math.sin(a) * .2 }); }
r = t3.stop(); console.assert(r.ok, '抖动不算反向 ' + JSON.stringify(r));

t = createStirTracker(); t.start({ x: 0, z: 0 }); circle(t, 3, .01);
r = t.stop(); console.assert(r.code === 'stir_radius', r.code);

t = createStirTracker(); t.start({ x: 0, z: 0 }); circle(t, 1, .2); console.assert(Math.abs(t.progress() - 1/1.5) < .1, t.progress());
console.assert(!t.active || t.stop(), 'stop clears');
console.log('ok');
