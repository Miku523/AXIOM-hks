// 搅拌轨迹判定：以轨迹质心为圆心、解卷绕累计转角，纯函数，可 node 自测
// 为什么不用捏合点当圆心：起点就落在轨迹上，绕它算角度会在起点跳变。
// 为什么要质心：整段轨迹的质心天然接近画的圈中心，与从哪儿起手无关。
// 为什么只在 result() 算：质心需要全部采样点；逐帧算会随质心漂移产生假转向。
const REV_ANGLE = Math.PI;   // 反向需累计转过 180° 才算一次反向（手抖/回摆不计）
export function createStirTracker({ minTurns = 1.5, minR = .03, minStep = .004 } = {}) {
  let on = false, pts = [];
  const analyze = list => {
    if (list.length < 8) return { turns: 0, reversals: 0, r: 0, n: list.length };
    const cx = list.reduce((s, p) => s + p.x, 0) / list.length;
    const cz = list.reduce((s, p) => s + p.z, 0) / list.length;
    const r = Math.max(...list.map(p => Math.hypot(p.x - cx, p.z - cz)));
    if (r < minStep) return { turns: 0, reversals: 0, r: +r.toFixed(3), n: list.length };
    let prevA = null, sum = 0, sumAbs = 0, rev = 0, dir = 0, back = 0;
    for (const p of list) {
      const a = Math.atan2(p.z - cz, p.x - cx);
      if (prevA !== null) {
        let d = a - prevA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        sum += d; sumAbs += Math.abs(d);
        const s = Math.sign(d);
        if (s !== 0) {
          if (dir && s !== dir) { back += Math.abs(d); if (back >= REV_ANGLE) { rev++; dir = s; back = 0; } }
          else { dir = s; back = 0; }
        }
      }
      prevA = a;
    }
    return { turns: Math.abs(sum) / (2 * Math.PI), sum, sumAbs, reversals: rev, r, n: list.length };
  };
  return {
    start() { on = true; pts = []; },
    feed(p) { if (!on) return; pts.push({ x: p.x, z: p.z }); if (pts.length > 3000) pts.shift(); },
    get active() { return on; },
    result() {
      const a = analyze(pts);
      const turns = a.turns || 0, r = a.r || 0;
      let code = null, msg = '';
      if (turns < minTurns)      { code = 'stir_short'; msg = r < minR ? '请捏合后在空中画圈' : `搅拌圈数不足：${turns.toFixed(1)} / ${minTurns} 圈`; }
      else if (r < minR)       { code = 'stir_radius';  msg = '搅拌幅度太小，画大一点的圈'; }
      else if (a.reversals > 1) { code = 'stir_reverse'; msg = '搅拌方向反复，请沿同一方向'; }
      return { ok: !code, code, msg, turns: +turns.toFixed(2), reversals: a.reversals || 0, r: +r.toFixed(3), samples: a.n };
    },
    stop() { const res = this.result(); on = false; return res; },
    progress() { const a = analyze(pts); return Math.min(1, (a.turns || 0) / minTurns); },
  };
}
