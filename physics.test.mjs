// node physics.test.mjs
import { createWorld, G, DT } from './physics.js';
const w = createWorld();
// 自由落体 1s：y = y0 - g t²/2 ≈ 4.925（固定步长半隐式欧拉略偏多，容差 2%）
const b = w.add({ p: { x: 0, y: 10, z: 0 } });
for (let i = 0; i < 120; i++) w.step(DT);
console.assert(Math.abs((10 - b.p.y) - G / 2) < G / 2 * .02, 'fall ' + b.p.y);
// 地板停止 + 回调
const run = s => { for (let i = 0; i < s * 60; i++) w.advance(1 / 60); };
let landed = 0;
const f = w.add({ p: { x: 0, y: 1, z: 0 }, floor: 0, onFloor: () => landed++ });
run(2);
console.assert(f.settled && f.p.y === 0 && landed === 1, 'floor');
// 寿命到期移除
let died = 0; w.add({ p: { x: 0, y: 0, z: 0 }, g: 0, life: .5, onDie: () => died++ });
run(1);
console.assert(died === 1 && w.bodies.size === 2, 'life');
// advance 上限：单次大 dt 不爆发
const before = w.time; w.advance(5); console.assert(w.time - before <= .1 + DT, 'cap');
console.log('ok');
