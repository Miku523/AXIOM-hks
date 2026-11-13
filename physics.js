// 微型物理：固定步长、重力 g=9.85、点粒子（无碰撞，只有地板）。渲染无关，可 node 测试
export const G = 9.85, DT = 1 / 120;

// body: { p:{x,y,z}, v:{x,y,z}, g?, drag?, floor?, life?, onFloor?, onDie?, settled, dead }
export function createWorld() {
  const bodies = new Set();
  let acc = 0, time = 0;
  const step = h => {
    for (const b of bodies) {
      if (b.dead) { bodies.delete(b); continue; }
      if (b.life !== undefined && (b.life -= h) <= 0) { b.dead = true; b.onDie?.(b); bodies.delete(b); continue; }
      if (b.settled) continue;
      b.v.y -= (b.g ?? G) * h;
      if (b.drag) { const k = Math.max(0, 1 - b.drag * h); b.v.x *= k; b.v.y *= k; b.v.z *= k; }
      b.p.x += b.v.x * h; b.p.y += b.v.y * h; b.p.z += b.v.z * h;
      if (b.floor !== undefined && b.p.y <= b.floor) { b.p.y = b.floor; b.v.x = b.v.y = b.v.z = 0; b.settled = true; b.onFloor?.(b); }
    }
    time += h;
  };
  return {
    bodies, get time() { return time; },
    add(b) { b.v ??= { x: 0, y: 0, z: 0 }; bodies.add(b); return b; },
    clear() { bodies.clear(); },
    // 帧时间 → 固定步长累积；上限 .1s 防止切 tab 后爆发
    advance(dt) { acc += Math.min(dt, .1); while (acc >= DT) { step(DT); acc -= DT; } },
    step,
  };
}
