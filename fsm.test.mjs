// node fsm.test.mjs — 走通 8 步 + 错配提示 + 守卫
import { FLOW, createFSM, mismatch } from './fsm.js';
const log = [];
let evap = false;
const ctx = Object.fromEntries(FLOW.map(s=>[s.action,()=>log.push(s.action)]));
ctx.reset = () => log.push('reset');
ctx.evapDone = () => evap; ctx.evapLeft = () => 7;
let stirOk = false; ctx.stirStart = () => log.push('stirStart'); ctx.stirCheck = () => stirOk ? null : { code:'stir_short', msg:'搅拌圈数不足' };
const fsm = createFSM(ctx);

console.assert(fsm.feed('pinch','lamp').ok === false, '错目标应拒绝');
console.assert(fsm.feed('fist','bottle').ok === false, '错手势应拒绝');
console.assert(fsm.feed('unfist','bottle').ok === true && fsm.index === 0, '无关边沿忽略');
console.assert(fsm.index === 0, '错配不前进');

for (const s of FLOW) {
  if (s.pre) {
    const p = fsm.feed(s.pre.gesture, s.target); console.assert(p.ok && p.pre && fsm.index === FLOW.indexOf(s), '预备动作不推进');
    const r = fsm.feed(s.gesture, s.target); console.assert(!r.ok && r.code === 'stir_short', '搅拌守卫 ' + JSON.stringify(r));
    stirOk = true;
  } else if (s.ready) {
    const r = fsm.feed(s.gesture, s.target);
    console.assert(!r.ok && r.msg.includes('7s'), '守卫应拦截: '+r.msg);
    evap = true;
  }
  console.assert(fsm.feed(s.gesture, s.target).ok, '步 '+s.title);
}
console.assert(fsm.index === 0, '走完回到 0');
console.assert(log.join() === FLOW.map(s=>s.pre ? 'stirStart,' + s.action : s.action).join()+',reset', log.join());
console.assert(mismatch(FLOW[0],'pinch',null).code === 'no_target');
console.assert(mismatch(FLOW[6],'pinch','lamp').code === 'wrong_gesture');
console.assert(FLOW.every(s => s.rubric?.points.length && s.rubric.errors.length), 'rubric 完整');

// 评分
import { score, evaluate, STEP_MAX, grade } from './fsm.js';
const okAll = FLOW.map((s,k)=>({step:k+1, ok:true}));
let R = score(okAll);
console.assert(R.score === 100 && R.perfect && R.bonus === 5 && R.grade === '实验小能手', JSON.stringify(R));
R = score([...okAll, {step:2, ok:false, code:'hold_short'}, {step:4, ok:false, code:'wrong_target'}]);
console.assert(R.score === Math.round(100 - 5 - 8) && !R.perfect && R.bonus === 0, R.score);
console.assert(R.steps[1].got === +(STEP_MAX-5).toFixed(1) && R.steps[3].got === +(STEP_MAX-8).toFixed(1));
R = score(Array.from({length:10},()=>({step:1, ok:false, code:'wrong_target'})));
console.assert(R.steps[0].got === 0 && R.score === Math.round(100 - STEP_MAX), '单步扣到 0 封底 ' + R.score);
console.assert(grade(89) === '操作良好' && grade(69) === '再接再厉');
console.assert(evaluate(score(okAll)).includes('无一次误触发'));
console.assert(evaluate(R).includes('倒入溶液时顺序错误重做'), evaluate(R));
{ const f = createFSM({}, null); f.feed('pinch','bottle'); const r = f.feed('release','bottle'); console.assert(r.ok && r.ignored && f.index === 1, '捏后松开不计误操作'); }
console.log('ok');
