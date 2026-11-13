// 虚拟手叠加：在摄像头预览上画一只"卡通手"，姿势随识别结果变形，附带捏合/握拳脉冲
// draw(ctx, {lm, pose, conf, w, h})  lm 为 MediaPipe 21 点（归一化），pose 为滤波后稳定姿势
const COLOR = { open: '#4f8cff', pinch: '#3ec98a', fist: '#ffb84f' };
const FINGERS = [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
const PALM = [0,1,5,9,13,17];
let pulse = 0, lastPose = 'open';

export function drawHand(ctx, { lm, pose, conf = 0, w, h, t = performance.now() }) {
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  const P = i => [lm[i].x * w, lm[i].y * h];
  const c = COLOR[pose] || COLOR.open;
  if (pose !== lastPose) { pulse = 1; lastPose = pose; }
  pulse *= 0.9;

  // 手掌填充
  ctx.save();
  ctx.globalAlpha = 0.25; ctx.fillStyle = c;
  ctx.beginPath(); PALM.forEach((i, k) => { const [x, y] = P(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
  ctx.restore();

  // 手指：粗描边 + 关节圆
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const f of FINGERS) {
    ctx.beginPath(); ctx.moveTo(...P(0));
    f.forEach(i => ctx.lineTo(...P(i)));
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.stroke();
  }
  for (let i = 0; i < 21; i++) { const [x, y] = P(i); ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 && i ? 5 : 3.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); }

  // 捏合：拇指-食指之间画连线 + 扩散圆；握拳：掌心扩散圆
  if (pose === 'pinch') {
    const [ax, ay] = P(4), [bx, by] = P(8), mx = (ax + bx) / 2, my = (ay + by) / 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ring(ctx, mx, my, 12 + pulse * 30, c, 0.3 + pulse * 0.7);
    ring(ctx, mx, my, 8 + Math.sin(t / 120) * 2, c, 0.9);
  } else if (pose === 'fist') {
    const [x, y] = P(9);
    ring(ctx, x, y, 20 + pulse * 40, c, 0.3 + pulse * 0.7);
  }

  // 标签
  const [lx, ly] = P(0);
  const label = { open: '张开', pinch: '捏合', fist: '握拳' }[pose] + (conf ? ` ${(conf * 100) | 0}%` : '');
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = '#000a'; ctx.fillRect(lx - 36, ly + 8, 72, 20);
  ctx.fillStyle = c; ctx.fillText(label, lx, ly + 22);
}
function ring(ctx, x, y, r, color, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
}
