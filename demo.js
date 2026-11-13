// 自动演示（备用视频兜底）：?demo=1 时按剧本派发 gesture 事件，走与真手完全相同的总线
// 用法：index.html?demo=1 ；录屏即可作为备用视频。ponytail: 剧本写死 8 步，不读 FLOW 动态生成。
const sleep = ms => new Promise(r => setTimeout(r, ms));
const emit = (type, ndc, extra = {}) => window.dispatchEvent(new CustomEvent('gesture', { detail: { type, ndc, conf: .92, ...extra } }));
const ndcOf = n => window.__ndcOf(n);

async function moveTo(from, to, ms = 700) {
  const t0 = performance.now();
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms), e = k < .5 ? 2*k*k : 1 - (-2*k+2)**2/2;
    emit('move', { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
    if (k >= 1) return to;
    await sleep(16);
  }
}
async function circle(c, r = .06, turns = 3, ms = 2400) {
  const t0 = performance.now();
  for (;;) {
    const k = Math.min(1, (performance.now() - t0) / ms), a = k * turns * 2 * Math.PI;
    emit('move', { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    if (k >= 1) return;
    await sleep(16);
  }
}

export async function runDemo({ setHandMode, tip }) {
  setHandMode(true);                                   // 显示 3D 光标/高亮，禁鼠标
  let p = { x: -.6, y: -.4 };
  const act = async (name, gesture, hold = 600) => {
    p = await moveTo(p, ndcOf(name)); await sleep(200);
    emit(gesture, p); await sleep(hold);
    emit(gesture === 'fist' ? 'unfist' : 'release', p); await sleep(500);
  };
  tip('自动演示开始');
  await act('bottle', 'pinch', 1300);                  // 1 倒入
  p = await moveTo(p, ndcOf('spoon')); emit('pinch', p); await sleep(400);   // 2 取盐
  p = await moveTo(p, ndcOf('beaker'), 900); emit('release', p); await sleep(1200);   // 3 加盐
  p = await moveTo(p, ndcOf('beaker')); emit('pinch', p); await sleep(200);  // 4 搅拌
  await circle(p); emit('release', p); await sleep(900);
  await act('lamp', 'pinch');                          // 5 点燃
  tip('加热蒸发中…');
  await sleep(10500);                                  // 6 蒸发等待
  await act('beaker', 'pinch');
  await act('lamp', 'fist');                           // 7 盖灭
  await sleep(1500);
  await act('beaker', 'pinch');                        // 8 观察结晶 → 证书
  tip('演示结束');
}
