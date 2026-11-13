// 流程表：每步声明 期望手势+期望目标，匹配即前进；错配只提示不惩罚（扣分只记账，见 rubric）
// gesture: 'pinch' 捏合 | 'release' 松开 | 'fist' 握拳 | 'move' 移动（只做拖拽，不触发状态切换）
// ready: 可选守卫 (ctx) => string|null，返回文案表示"还没到时候"
// rubric: { points:[规范要点], errors:[{code, desc, deduct}] }  code 对应 mismatch 返回的错误码
export const FLOW = [
  { title:'倒入溶液', hint:'对准药瓶，捏合，把溶液倒进烧杯', gesture:'pinch', target:'bottle', action:'pourIn',
    rubric:{ points:['标签朝向手心，防止液体腐蚀标签','瓶口紧挨烧杯内壁，缓慢倾倒','倒完立即盖好瓶塞'],
      errors:[{code:'wrong_target',desc:'先拿了其他器材（顺序错误）'},{code:'no_target',desc:'手未对准药瓶就做捏合'},{code:'wrong_gesture',desc:'用握拳/松开代替捏合'}] } },
  { title:'取盐', hint:'对准药匙，捏合，舀起一勺盐', gesture:'pinch', target:'spoon', action:'grab',
    rubric:{ points:['用干净干燥的药匙取药','取量按实验要求，一次取够'],
      errors:[{code:'wrong_target',desc:'直接用手或用瓶口取药'},{code:'no_target',desc:'未对准药匙'},{code:'wrong_gesture',desc:'手势错误'}] } },
  { title:'加盐', hint:'把手移到烧杯上方，松开手指，盐落入杯中', gesture:'release', target:'beaker', action:'addSalt',
    rubric:{ points:['药匙伸入烧杯口内再倾倒，避免洒落','药品不得倒回原瓶'],
      errors:[{code:'wrong_target',desc:'药品洒在桌面/倒回药瓶'},{code:'no_target',desc:'在烧杯外松手，药品洒落'},{code:'wrong_gesture',desc:'未松开即视为未加入'}] } },
  { title:'搅拌', hint:'捏合后在空中画 2 圈，松开结束', gesture:'release', target:'beaker', action:'stir',
    pre:{ gesture:'pinch', action:'stirStart', anyTarget:true },   // 任何位置捏合都开始记录轨迹，松开=判定
    ready: ctx => ctx.stirCheck?.(),                         // 返回 {code,msg} 或 null
    rubric:{ points:['玻璃棒沿同一方向搅拌','不碰撞杯壁、杯底','搅拌至固体完全溶解'],
      errors:[{code:'stir_short',desc:'搅拌圈数不足'},{code:'stir_reverse',desc:'搅拌方向反复'},{code:'stir_radius',desc:'幅度过大碰壁或过小'},{code:'wrong_target',desc:'搅拌了错误容器'}] } },
  { title:'点燃', hint:'对准酒精灯，捏合，点燃火焰', gesture:'pinch', target:'lamp', action:'ignite',
    rubric:{ points:['用火柴点燃，禁止用燃着的酒精灯引燃','用外焰加热','酒精量不超过 2/3、不少于 1/4'],
      errors:[{code:'wrong_target',desc:'溶解未完成即加热其他器材'},{code:'no_target',desc:'未对准酒精灯'},{code:'wrong_gesture',desc:'手势错误'}] } },
  { title:'蒸发', hint:'加热中，等倒计时结束后捏合烧杯', gesture:'pinch', target:'beaker', action:'crystal',
    ready: ctx => ctx.evapDone?.() ? null : `蒸发中，还需 ${ctx.evapLeft?.()}s`,
    rubric:{ points:['加热过程持续搅拌，防止局部过热飞溅','出现较多晶体时停止加热，余热蒸干','不得蒸干后再停火'],
      errors:[{code:'not_ready',desc:'蒸发未完成就进入下一步（过早停火）'},{code:'wrong_target',desc:'蒸发中移动其他器材'},{code:'wrong_gesture',desc:'手势错误'}] } },
  { title:'盖灭', hint:'对准酒精灯，握拳，用灯帽盖灭', gesture:'fist', target:'lamp', action:'extinguish',
    rubric:{ points:['用灯帽盖灭，禁止吹灭','盖灭后再提起灯帽一次，防止粘连'],
      errors:[{code:'wrong_gesture',desc:'用捏合（模拟吹灭/手捏）代替盖灭'},{code:'wrong_target',desc:'先动了烧杯未先熄灯'},{code:'no_target',desc:'未对准酒精灯'}] } },
  { title:'观察结晶', hint:'对准烧杯，捏合，观察结晶并生成证书', gesture:'pinch', target:'beaker', action:'finish',
    rubric:{ points:['待烧杯冷却后再移动','用坩埚钳/隔热手套，不用手直接拿热烧杯','记录晶体颜色、形状'],
      errors:[{code:'wrong_target',desc:'结束前又操作了其他器材'},{code:'no_target',desc:'未对准烧杯'},{code:'wrong_gesture',desc:'手势错误'}] } },
];

const G_NAME = { pinch:'捏合', release:'松开', fist:'握拳' };
const NAMES = { bottle:'药瓶', beaker:'烧杯', lamp:'酒精灯', table:'桌面', spoon:'药匙' };
const name = k => NAMES[k] ?? k;

// 错误组合；返回 {code, msg} 或 null（匹配成功）
export function mismatch(step, gesture, target){
  if (gesture === 'move') return null;
  const want = step.pre && gesture === step.pre.gesture ? gesture : step.gesture;   // 预备手势只查目标
  if (gesture !== want) return { code:'wrong_gesture', msg:`这一步要「${G_NAME[step.pre?.gesture ?? step.gesture]}」，而不是${G_NAME[gesture] ?? gesture}` };
  if (!target)                 return { code:'no_target',     msg:`没有对准目标，试试对准${name(step.target)}` };
  if (target !== step.target)  return { code:'wrong_target',  msg:`你对准的是${name(target)}，这一步需要${name(step.target)}` };
  return null;
}

// 评分规则：单步满分 STEP_MAX（100/步数），扣分项统一三类；全程零误触 +5；封顶 100
export const RULES = {
  hold_short:    { label:'动作保持不足', deduct:5 },
  no_target:     { label:'目标命中错误', deduct:5 },
  wrong_gesture: { label:'目标命中错误', deduct:5 },
  wrong_target:  { label:'顺序错误重做', deduct:8 },
  not_ready:     { label:'顺序错误重做', deduct:8 },
  stir_short:    { label:'动作保持不足', deduct:5 },
  stir_reverse:  { label:'顺序错误重做', deduct:8 },
  stir_radius:   { label:'目标命中错误', deduct:5 },
};
export const STEP_MAX = 100 / FLOW.length;
export const BONUS = 5;
export const grade = s => s >= 90 ? '实验小能手' : s >= 70 ? '操作良好' : '再接再厉';

// ops: oplog 记录（含 step, ok, code）。返回 {score, grade, steps:[{step,title,max,deducted,got,errors}], bonus, perfect}
export function score(ops){
  const steps = FLOW.map((s, k) => ({ step:k+1, title:s.title, max:STEP_MAX, deducted:0, errors:[] }));
  let anyErr = false;
  for (const o of ops) {
    if (o.ok) continue; anyErr = true;
    const st = steps[o.step - 1], r = RULES[o.code]; if (!st || !r) continue;
    st.errors.push({ code:o.code, label:r.label, deduct:r.deduct });
    st.deducted = Math.min(st.max, st.deducted + r.deduct);     // 单步扣到 0 为止
  }
  for (const st of steps) st.got = +(st.max - st.deducted).toFixed(1);
  const raw = steps.reduce((a, s) => a + s.got, 0);
  const bonus = anyErr ? 0 : BONUS;
  const total = Math.min(100, Math.round(raw + bonus));
  return { score: total, grade: grade(total), steps, bonus, perfect: !anyErr };
}

// 评价句：按扣分项自动生成，规范的步骤取 rubric.points[0]
export function evaluate(result){
  const good = result.steps.filter(s => !s.errors.length).map(s => s.title + '规范');
  const bad = result.steps.filter(s => s.errors.length).map(s => `${s.title}时${[...new Set(s.errors.map(e => e.label))].join('、')}`);
  if (!bad.length) return '全程操作规范，无一次误触发，动作与时机把握准确。';
  const g = good.length ? good.slice(0, 2).join('，') + '；' : '';
  return `${g}${bad.slice(0, 3).join('，')}，建议加强练习。`;
}

// 状态机：ctx 提供各 action + drag + reset + 守卫用的查询函数
export function createFSM(ctx, onChange){
  let i = 0;
  const api = {
    get step(){ return FLOW[i]; },
    get index(){ return i; },
    // 返回 {ok, msg?, code?}
    feed(gesture, target, data){
      const step = FLOW[i];
      if (gesture === 'move') { ctx.drag?.(data); return {ok:true}; }
      if (!G_NAME[gesture]) return {ok:true};          // unfist 等无关边沿忽略
      if (gesture === 'release' && step.gesture !== 'release') return {ok:true, ignored:true}; // 捏合后的松开是自然收尾，不算误操作
      if (step.pre && gesture === step.pre.gesture && (step.pre.anyTarget || target === step.target)) { ctx[step.pre.action]?.(data); return {ok:true, pre:true}; } // 预备动作：不推进
      let err = mismatch(step, gesture, target);
      if (!err) { const g = step.ready?.(ctx); if (g) err = typeof g === 'string' ? { code:'not_ready', msg:g } : g; }
      if (err) { onChange?.(i, err.msg); return {ok:false, ...err}; }
      ctx[step.action]?.(data);
      i = (i + 1) % FLOW.length;
      if (i === 0) ctx.reset?.();
      onChange?.(i, null);
      return {ok:true};
    },
    reset(){ i = 0; ctx.reset?.(); onChange?.(0, null); },
  };
  return api;
}
