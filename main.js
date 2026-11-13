import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildScene, pick, pickBox } from './scene.js';
import { FLOW, createFSM } from './fsm.js';
import { startHand } from './hand.js';
import { drawHand } from './handviz.js';
import { createWorld } from './physics.js';
import { logOp } from './oplog.js';
import { createStirTracker } from './stir.js';
import { runDemo } from './demo.js';
import { GESTURE } from './config.js';
const world = createWorld();
const stir = createStirTracker({ minTurns: 1.5, minR: .03 }); window.__stir = stir;

// ---------- DOM ----------
const view = document.getElementById('view');
const hud = document.getElementById('hud');
const tip = document.getElementById('tip');
const stepsEl = document.getElementById('steps');

// ---------- 渲染 ----------
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0f1115); scene.fog = new THREE.Fog(0x0f1115, 9, 16);
const camera = new THREE.PerspectiveCamera(50, 1, .1, 100); camera.position.set(3,3.5,5);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0,1.3,0); controls.enablePan = false;
controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * .48;
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x1a1410, .55));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.6); sun.position.set(3,6,2); sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -4; sun.shadow.camera.right = sun.shadow.camera.top = 4; scene.add(sun);
const fill = new THREE.PointLight(0x4f8cff, .6, 8); fill.position.set(-3, 3, -2); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({color:0x151922, roughness:.95}));
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);
scene.add(new THREE.GridHelper(12,24,0x2a3342,0x1c2230));
const O = buildScene(scene);
scene.traverse(m => { if (m.isMesh && m.material?.opacity === undefined) return; if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
window.__ndcOf = n => { const p = new THREE.Vector3(); new THREE.Box3().setFromObject(O[n]).getCenter(p); p.project(camera); return { x: p.x, y: p.y }; }; // 自动化测试用

function resize(){
  const {clientWidth:w, clientHeight:h} = view;
  renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view); resize();

// ---------- 手势事件总线（开发模式：鼠标） ----------
// pinch=按下，release=松开，move=移动；后期动捕派发同样的 CustomEvent 即可
const norm = e => new THREE.Vector2((e.offsetX/view.clientWidth)*2-1, -(e.offsetY/view.clientHeight)*2+1);
const emit = (type, ndc) => window.dispatchEvent(new CustomEvent('gesture', {detail:{type, ndc}}));
let down = false, moved = false;
view.addEventListener('pointerdown', e => { if (handMode) return; if (e.button === 2) { emit('fist', norm(e)); return; } down = true; moved = false; emit('pinch', norm(e)); });
view.addEventListener('pointermove', e => { if (handMode) return; if (down) moved = true; emit('move', norm(e)); });
view.addEventListener('pointerup',   e => { if (handMode) return; if (e.button === 2) { emit('unfist', norm(e)); return; } down = false; emit('release', norm(e)); });
view.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 状态机动作 ----------
// 蒸发：真实 10s 模拟 60s（EVAP_SIM/EVAP_REAL 比例显示在 HUD）
const EVAP_REAL = 10, EVAP_SIM = 60;
let held = null;                                       // 当前抓着的物体
let evapStart = null, crystalK = 0;
const plane = new THREE.Plane(new THREE.Vector3(0,1,0), -1.6);   // 拖拽平面
const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
const evapElapsed = () => evapStart === null ? 0 : Math.min(EVAP_REAL, (performance.now() - evapStart) / 1000);
const ctx = {
  pourIn()  { O.liquid.scale.y = .5; O.pour(true); setTimeout(() => O.pour(false), 1200); },
  grab()    { held = O.spoon; controls.enabled = false; },
  drag(ndc) {
    ray.setFromCamera(ndc, camera); const on = ray.ray.intersectPlane(plane, hit);
    if (held && on) held.position.copy(hit).add(new THREE.Vector3(-.3,0,0));
    if (stir.active && on) { stir.feed(hit); O.setStirProgress(stir.progress()); O.stirRod.position.set(hit.x, O.stirRod.position.y, hit.z); }
  },
  addSalt() { held.rotation.z = -1; O.salt.visible = false; O.spawnGrains(world, held.position.clone().add(new THREE.Vector3(.3,.1,0)), 4 + (Math.random()*2|0));
              setTimeout(() => { held.rotation.z = 0; held.position.copy(O.home.spoon); held = null; controls.enabled = !handMode; }, 800); },
  stirStart() { stir.start(); O.setStir(true); controls.enabled = false; },
  stirCheck() { if (!stir.active) return { code:'wrong_gesture', msg:'先捏合再画圈' }; const r = stir.result(); return r.ok ? null : { code:r.code, msg:r.msg }; },
  stir()    { stir.stop(); O.setStir(false); O.dissolve(); controls.enabled = !handMode; },
  ignite()  { O.setHeat(true); evapStart = performance.now(); },
  evapDone(){ return evapElapsed() >= EVAP_REAL; },
  evapLeft(){ return Math.ceil((EVAP_REAL - evapElapsed()) * EVAP_SIM / EVAP_REAL); },
  crystal() { crystalK = 1; },
  extinguish() { O.setHeat(false); O.spawnSmoke(world, 12); },
  finish()  {},
  reset()   { held = null; evapStart = null; crystalK = 0; if (stir.active) stir.stop(); controls.enabled = !handMode; O.reset(); world.clear(); },
};

// ---------- 步骤条 + 进度 + 提示（文案全部来自 FLOW） ----------
const progressEl = document.getElementById('progress');
const hintEl = document.getElementById('hint');
function renderSteps(i){
  stepsEl.innerHTML = FLOW.map((s,k)=>
    `<div class="step ${k===i?'active':k<i?'done':''}">${k+1}. ${s.title}<small>${s.hint}</small></div>`).join('');
  progressEl.style.width = `${i / FLOW.length * 100}%`;
  progressEl.classList.toggle('done', i === 0 && lastStep > 0);
  hintEl.textContent = `第 ${i+1} 步 · ${FLOW[i].title}：${FLOW[i].hint}`;
  if (i !== lastStep) { const hb = document.getElementById('hintbar'); hb.classList.remove('bump'); void hb.offsetWidth; hb.classList.add('bump'); }
  lastStep = i;
}
let lastStep = 0;
let tipTimer;
function showTip(msg){
  tip.textContent = msg; tip.classList.add('show');
  clearTimeout(tipTimer); tipTimer = setTimeout(()=>tip.classList.remove('show'), 2000);
}
const fsm = createFSM(ctx, (i, err) => { renderSteps(i); if (err) showTip(err); });
renderSteps(0);

// 手势 → 拾取目标 → 喂状态机。鼠标用网格拾取；手势用包围盒（容错大）
let handMode = false, curPose = 'open', hover = null;
const hoverPt = new THREE.Vector3();
window.addEventListener('gesture', ({detail:{type, ndc, conf, pose, held: heldMs}}) => {
  if (type === 'short') {   // 动作保持不足：只记账+提示，不进状态机
    showTip(`${pose === 'fist' ? '握拳' : '捏合'}保持不足（${heldMs|0}ms），请保持 500ms`);
    logOp({ step: fsm.index + 1, title: FLOW[fsm.index].title, gesture: pose, target: null, conf: null, mode: 'hand', ok: false, code: 'hold_short', msg: '动作保持不足', run: runId });
    return;
  }
  const skip = held === O.spoon ? 'spoon' : null;   // 手里拿着的东西不参与拾取
  let target = type === 'move' ? null : (handMode ? pickBox(ndc, camera, O, .15, skip) : pick(ndc, camera, scene, skip));
  if (stir.active && type === 'release') target = 'beaker';   // 画圈时松手位置可能在烧杯外，仍算对烧杯操作
  if (handMode && type === 'move') {
    // 3D 光标 + 悬停目标高亮
    ray.setFromCamera(ndc, camera);
    O.setCursor(ray.ray.intersectPlane(plane, hoverPt) ? hoverPt : null, curPose);
    const h = pickBox(ndc, camera, O); if (h !== hover) { hover = h; O.highlight(h); }
  }
  if (type === 'pinch' || type === 'fist') curPose = type;
  if (type === 'release' || type === 'unfist') curPose = 'open';
  const stepBefore = fsm.index;
  const r = fsm.feed(type, target, ndc);
  if (type !== 'move' && type !== 'unfist' && !r.ignored && !r.pre)
    logOp({ step: stepBefore + 1, title: FLOW[stepBefore].title, gesture: type, target, conf: conf ?? null, mode: handMode ? 'hand' : 'mouse', ok: r.ok, code: r.code ?? null, msg: r.msg ?? '', run: runId });
  if (r.ok && stepBefore === 0) runStart = Date.now();
  if (r.ok && !r.ignored && stepBefore === FLOW.length - 1 && fsm.index === 0) finishRun();
});

// ---------- 一轮实验：计时 + 结束跳证书 ----------
let runId = Date.now(), runStart = null;
function finishRun(){
  const elapsed = runStart ? Math.round((Date.now() - runStart) / 1000) : 0;
  localStorage.lastRun = JSON.stringify({ run: runId, elapsed, finishedAt: Date.now() });
  window.open(`./cert.html?run=${runId}`, '_blank');
  runId = Date.now(); runStart = null;
}

// ---------- 摄像头模式：预览 + 虚拟手叠加，手势事件接管 ----------
const camVideo = document.querySelector('#cam video');
const camCanvas = document.getElementById('camOverlay');
const camInfo = document.getElementById('camInfo');
// ---------- 首屏引导 ----------
const intro = document.getElementById('intro');
document.getElementById('introMouse').onclick = () => { intro.classList.add('hide'); showTip('鼠标模式：左键 = 捏合，右键 = 握拳'); };
document.getElementById('introCam').onclick = () => { intro.classList.add('hide'); document.getElementById('camBtn').click(); };
// ---------- 自动演示（备用视频兜底）：?demo=1 或引导页按钮 ----------
const startDemo = () => { intro.classList.add('hide'); document.getElementById('camBtn')?.remove();
  runDemo({ setHandMode: v => { handMode = v; controls.enabled = !v; }, tip: showTip }); };
document.getElementById('introDemo').onclick = startDemo;
if (new URLSearchParams(location.search).get('demo')) setTimeout(startDemo, 800);

document.getElementById('camBtn').onclick = async (e) => {
  e.target.disabled = true; e.target.textContent = '加载模型…';
  try {
    camVideo.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    await new Promise(r => camVideo.onloadeddata = r);
    const cx = camCanvas.getContext('2d');
    await startHand(camVideo, {
      onFrame: ({ lm, raw, stable }) => {
        drawHand(cx, { lm, pose: stable, conf: raw?.conf, w: camCanvas.width, h: camCanvas.height });
        camInfo.textContent = lm ? `${stable} 捏${raw.pinchR.toFixed(2)}/${GESTURE.PINCH} 拳${raw.fistR.toFixed(2)}/${GESTURE.FIST}${hover ? ' → ' + hover : ''}` : '未检测到手';
        if (!lm) { O.setCursor(null); if (hover) { hover = null; O.highlight(null); } }
      },
    });
    handMode = true; controls.enabled = false; e.target.remove();
  } catch (err) { e.target.textContent = '失败: ' + err.name; e.target.disabled = false; }
};

// ---------- 主循环 ----------
let last = performance.now(), t = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.min((now-last)/1000, .1); last = now; t += dt;
  world.advance(dt); O.syncParticles(world);
  O.tick(dt, t);
  // 蒸发：液面随时间下降；结晶：crystal() 后 2s 渐显
  if (evapStart !== null) O.liquid.scale.y = Math.max(.05, .5 - .45 * evapElapsed() / EVAP_REAL);
  if (crystalK > 0 && O.crystal.scale.y < 1) O.setCrystal(Math.min(1, O.crystal.scale.y + dt / 2));
  const evapInfo = evapStart !== null && !ctx.evapDone() ? `  蒸发 ${Math.round(evapElapsed()*EVAP_SIM/EVAP_REAL)}/${EVAP_SIM}s(模拟)` : '';
  hud.textContent = `步骤 ${fsm.index+1}/${FLOW.length} · ${fsm.step.title}${evapInfo}   ${handMode ? '' : '(按下=捏合 松开=释放 右键=握拳)'}`;
  controls.update(); renderer.render(scene, camera);
});
