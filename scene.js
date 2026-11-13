import * as THREE from 'three';

// 所有可交互对象挂 userData.name，供射线拾取返回目标名
const mat = (c, o={}) => new THREE.MeshStandardMaterial({color:c, ...o});
const glass = mat(0xbfe3ff, {transparent:true, opacity:.28, roughness:.05, metalness:.1});

export function buildScene(scene){
  const O = {};

  // 实验桌
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(6,.15,3), mat(0x5a3d22, {roughness:.55, metalness:.05}));
  top.position.y = 1;
  table.add(top);
  for (const [x,z] of [[-2.8,-1.3],[2.8,-1.3],[-2.8,1.3],[2.8,1.3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.15,1,.15), mat(0x4a331d));
    leg.position.set(x,.5,z); table.add(leg);
  }
  top.userData.name = 'table';
  scene.add(table); O.table = top;
  const Y = 1.075;                       // 桌面高度

  // 烧杯：玻璃筒 + 液体柱（高度随倒入变化）
  const beaker = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.35,.33,.8,32,1,true), glass.clone());
  cup.material.side = THREE.DoubleSide;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(.33,32), glass.clone());
  bottom.rotation.x = -Math.PI/2; bottom.position.y = -.4;
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,1,32), mat(0x3ea0ff, {transparent:true, opacity:.75, roughness:.15}));
  liquid.scale.y = 0.01; liquid.position.y = -.4;
  beaker.add(cup, bottom, liquid);
  beaker.position.set(0, Y+.4, 0);
  cup.userData.name = 'beaker';
  scene.add(beaker); O.beaker = beaker; O.liquid = liquid;

  // 药瓶：棕色瓶身 + 瓶颈 + 盖
  const bottle = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.5,24), mat(0x7a4a1a, {transparent:true, opacity:.9}));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.15,24), mat(0x7a4a1a));
  neck.position.y = .32;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.08,24), mat(0x222222));
  cap.position.y = .43;
  bottle.add(body, neck, cap);
  bottle.position.set(-1.5, Y+.25, .3);
  body.userData.name = 'bottle'; neck.userData.name = 'bottle'; cap.userData.name = 'bottle';
  scene.add(bottle); O.bottle = bottle;

  // 酒精灯：底座 + 灯芯 + 火焰（默认隐藏）
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,.25,32), glass.clone());
  const fuel = new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,.15,32), mat(0xffa0ff, {transparent:true, opacity:.5}));
  fuel.position.y = -.04;
  const wickHolder = new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.12,16), mat(0x888888));
  wickHolder.position.y = .18;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.1,8), mat(0xeeeeee));
  wick.position.y = .28;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.07,.3,16), new THREE.MeshBasicMaterial({color:0xffaa33, transparent:true, opacity:.75}));
  const flameCore = new THREE.Mesh(new THREE.ConeGeometry(.035,.18,12), new THREE.MeshBasicMaterial({color:0xfff2c0, transparent:true, opacity:.95}));
  flameCore.position.y = -.04; flame.add(flameCore);
  const flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({color:0xff8830, transparent:true, opacity:.35, depthWrite:false}));
  flameGlow.scale.set(.6,.9,1); flameGlow.position.y = .05; flame.add(flameGlow);
  flame.position.y = .45; flame.visible = false;
  const flameLight = new THREE.PointLight(0xffaa33, 0, 4, 1.5); flameLight.position.y = .5;
  lamp.add(base, fuel, wickHolder, wick, flame, flameLight);
  lamp.position.set(1.5, Y+.125, 0);
  for (const m of [base, fuel, wickHolder, wick, flame]) m.userData.name = 'lamp';
  scene.add(lamp); O.lamp = lamp; O.flame = flame; O.flameLight = flameLight;

  // 气泡（加热时显示）
  const bubbles = new THREE.Group();
  for (let i=0;i<12;i++){
    const b = new THREE.Mesh(new THREE.SphereGeometry(.02,8,8), mat(0xffffff, {transparent:true, opacity:.6}));
    b.position.set((Math.random()-.5)*.5, Math.random()*.6-.4, (Math.random()-.5)*.5);
    b.userData.v = .3 + Math.random()*.4;
    bubbles.add(b);
  }
  bubbles.visible = false; beaker.add(bubbles); O.bubbles = bubbles;

  // 药匙：柄 + 勺头，勺头上一小堆盐
  const spoon = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.5,.02,.05), mat(0xcccccc, {metalness:.6, roughness:.3}));
  const head = new THREE.Mesh(new THREE.SphereGeometry(.09,16,8,0,Math.PI*2,0,Math.PI/2), mat(0xcccccc, {metalness:.6, roughness:.3, side:THREE.DoubleSide}));
  head.rotation.x = Math.PI; head.position.set(.3,.04,0);
  const salt = new THREE.Mesh(new THREE.SphereGeometry(.06,12,8,0,Math.PI*2,0,Math.PI/2), mat(0xf4f4f4));
  salt.position.set(.3,.02,0);
  spoon.add(handle, head, salt);
  spoon.position.set(-.9, Y+.03, .8);
  for (const m of [handle, head, salt]) m.userData.name = 'spoon';
  scene.add(spoon); O.spoon = spoon; O.salt = salt;

  // 搅拌：玻璃棒（跟随手）+ 液面涡旋盘（透明度随进度）
  const stirDisc = new THREE.Mesh(new THREE.CircleGeometry(.3,32), new THREE.MeshBasicMaterial({color:0xdff3ff, transparent:true, opacity:.25, side:THREE.DoubleSide}));
  stirDisc.rotation.x = -Math.PI/2; stirDisc.visible = false;
  const spoke = new THREE.Mesh(new THREE.PlaneGeometry(.55,.03), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.5, side:THREE.DoubleSide}));
  stirDisc.add(spoke);
  beaker.add(stirDisc); O.stirDisc = stirDisc;
  const stirRod = new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.9,12), mat(0xe8f4ff, {transparent:true, opacity:.8, roughness:.1}));
  stirRod.visible = false; stirRod.position.y = Y + .55; stirRod.rotation.z = .15;
  scene.add(stirRod); O.stirRod = stirRod;
  // 搅拌进度环：烧杯上方细环，弧长随进度
  const ringMat = new THREE.MeshBasicMaterial({color:0x3ec98a, transparent:true, opacity:.9, side:THREE.DoubleSide});
  let ring = new THREE.Mesh(new THREE.RingGeometry(.4,.44,48,1,0,0.001), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = .45; ring.visible = false; beaker.add(ring);
  O.setStirProgress = k => { ring.geometry.dispose(); ring.geometry = new THREE.RingGeometry(.4,.44,48,1,0,Math.max(.001,k)*Math.PI*2); ring.visible = k > 0; ringMat.color.setHex(k >= 1 ? 0x3ec98a : 0x4f8cff); };

  // 倒液：药瓶倾斜 + 一条细液柱
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(.02,.03,1,8), mat(0x3ea0ff, {transparent:true, opacity:.75, roughness:.15}));
  stream.visible = false; scene.add(stream); O.stream = stream;
  O.pour = on => {
    stream.visible = on;
    if (on) { bottle.rotation.z = -1.1; bottle.position.set(beaker.position.x - .45, Y + .95, beaker.position.z);
      stream.position.set(beaker.position.x - .1, Y + .6, beaker.position.z); stream.scale.y = .7; }
    else { bottle.rotation.z = 0; bottle.position.copy(O.home.bottle); }
  };
  // 溶解：液体颜色略变浑→清，用于搅拌完成的反馈
  O.dissolve = () => { liquid.material.color.setHex(0x5bb8ff); setTimeout(() => liquid.material.color.setHex(0x3ea0ff), 1500); };

  // 结晶层：烧杯底白色薄层，scale.y 从 0 渐显
  const crystal = new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.08,32), mat(0xffffff, {roughness:.4, metalness:.1, emissive:0xcfe6ff, emissiveIntensity:.15}));
  crystal.position.y = -.36; crystal.scale.y = 0.001; crystal.visible = false;
  beaker.add(crystal); O.crystal = crystal;

  // ---------- 物理粒子池（盐粒 + 白烟）：由 physics.js 驱动位置 ----------
  const grainGeo = new THREE.SphereGeometry(.025,8,8), grainMat = mat(0xffffff);
  const smokeGeo = new THREE.SphereGeometry(.05,8,8);
  const particles = new THREE.Group(); scene.add(particles);
  O.particles = particles;
  // 生成盐粒：在世界坐标 from 处，落到烧杯内液面高度
  O.spawnGrains = (world, from, n = 4) => {
    const floorY = beaker.position.y - .4 + Math.max(.02, liquid.scale.y) ;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(grainGeo, grainMat); particles.add(m);
      const b = world.add({ p: { x: from.x + (Math.random()-.5)*.1, y: from.y, z: from.z + (Math.random()-.5)*.1 },
        v: { x: (beaker.position.x - from.x) * 1.2 + (Math.random()-.5)*.2, y: .5 + Math.random()*.3, z: (beaker.position.z - from.z) * 1.2 },
        floor: floorY, life: 6, mesh: m,
        onFloor: b => { b.life = 1.2; },   // 落液面后 1.2s 溶解
        onDie: b => particles.remove(b.mesh) });
      m.position.set(b.p.x, b.p.y, b.p.z);
    }
  };
  // 白烟：从酒精灯上方升起，上升 + 阻尼 + 寿命
  O.spawnSmoke = (world, n = 10) => {
    const o = lamp.position;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(smokeGeo, mat(0xdddddd, {transparent:true, opacity:.5})); particles.add(m);
      const b = world.add({ p: { x: o.x + (Math.random()-.5)*.05, y: o.y + .45, z: o.z + (Math.random()-.5)*.05 },
        v: { x: (Math.random()-.5)*.15, y: .6 + Math.random()*.4 + i*.05, z: (Math.random()-.5)*.15 },
        g: -.3, drag: .4, life: 2.5 + i*.1, mesh: m,
        onDie: b => particles.remove(b.mesh) });
      m.position.set(b.p.x, b.p.y, b.p.z);
    }
  };
  // 粒子 → 网格同步；烟随寿命变大变淡
  O.syncParticles = (world) => {
    for (const b of world.bodies) if (b.mesh) {
      b.mesh.position.set(b.p.x, b.p.y, b.p.z);
      if (b.g !== undefined && b.g < 0) { const k = 1 + (2.5 - b.life) * .5; b.mesh.scale.setScalar(k); b.mesh.material.opacity = Math.max(0, b.life / 2.5) * .5; }
      else if (b.settled) b.mesh.scale.setScalar(Math.max(0, b.life / 1.2));
    }
  };

  // ---------- 阶段效果 ----------
  O.fx = { stirring: false, heating: false, crystalT: 0 };
  O.setStir = on => { O.fx.stirring = on; stirDisc.visible = on; stirRod.visible = on; stirDisc.position.y = -.4 + liquid.scale.y + .005; if (!on) O.setStirProgress(0); else stirRod.position.set(beaker.position.x, Y + .55, beaker.position.z); };
  O.setHeat = on => { O.fx.heating = on; flame.visible = on; flameLight.intensity = on ? 2 : 0; bubbles.visible = on; };
  O.setCrystal = k => { crystal.visible = k > 0; crystal.scale.y = Math.max(.001, k); crystal.material.opacity = 1; };

  // 每帧动画：火焰抖动 + 气泡上浮 + 搅拌旋转
  O.tick = (dt, t) => {
    if (flame.visible) { flame.scale.y = 1 + Math.sin(t*20)*.15 + Math.sin(t*33)*.05; flame.rotation.z = Math.sin(t*13)*.1; flameLight.intensity = 2.2 + Math.sin(t*27)*.5; }
    if (bubbles.visible) for (const b of bubbles.children) {
      b.position.y += b.userData.v*dt; b.position.x += Math.sin(t*5 + b.userData.v*10)*.002;
      if (b.position.y > -.4 + liquid.scale.y) b.position.y = -.4;
    }
    if (O.fx.stirring) { stirDisc.rotation.z += dt * 4; liquid.position.y = -.4 + Math.sin(t*8)*.004; }
    if (crystal.visible) crystal.material.emissiveIntensity = .15 + Math.sin(t*3)*.1;
    if (stream.visible) stream.scale.x = stream.scale.z = 1 + Math.sin(t*40)*.15;
  };

  // 手势光标：跟随食指尖在拖拽平面上的投影，姿势变色，捏合时缩小
  const cursor = new THREE.Group();
  const cRing = new THREE.Mesh(new THREE.RingGeometry(.12,.16,32), new THREE.MeshBasicMaterial({color:0x4f8cff, side:THREE.DoubleSide, transparent:true, opacity:.9}));
  cRing.rotation.x = -Math.PI/2;
  const cDot = new THREE.Mesh(new THREE.SphereGeometry(.04,12,12), new THREE.MeshBasicMaterial({color:0xffffff}));
  cursor.add(cRing, cDot); cursor.visible = false;
  scene.add(cursor); O.cursor = cursor;
  const CUR_COLOR = { open:0x4f8cff, pinch:0x3ec98a, fist:0xffb84f };
  O.setCursor = (pos, pose) => {
    cursor.visible = !!pos; if (!pos) return;
    cursor.position.copy(pos); cRing.material.color.setHex(CUR_COLOR[pose] ?? CUR_COLOR.open);
    const s = pose === 'pinch' ? .6 : 1; cRing.scale.setScalar(s);
  };

  // 悬停高亮：目标器材所有 Standard 材质加 emissive
  const GROUPS = { bottle, beaker, lamp, spoon };
  let lit = null;
  O.highlight = (name) => {
    const set = (g, v) => g?.traverse(m => { if (m.material?.emissive) m.material.emissive.setHex(v); });
    if (lit) set(GROUPS[lit], 0x000000);
    lit = name in GROUPS ? name : null;
    if (lit) set(GROUPS[lit], 0x334466);
  };

  // 初始位置，用于重置
  O.home = { bottle: bottle.position.clone(), beaker: beaker.position.clone(), spoon: spoon.position.clone() };
  O.reset = () => {
    bottle.position.copy(O.home.bottle); beaker.position.copy(O.home.beaker); spoon.position.copy(O.home.spoon);
    spoon.rotation.set(0,0,0); bottle.rotation.set(0,0,0); stream.visible = false; salt.visible = true;
    liquid.scale.y = .01; liquid.material.color.setHex(0x3ea0ff); O.setHeat(false); O.setStir(false); O.setCrystal(0);
    particles.clear();
  };
  return O;
}

// 射线拾取：返回命中对象的 userData.name，没有则 null
const ray = new THREE.Raycaster();
export function pick(ndc, camera, scene, skip = null){
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(scene.children, true).find(h => h.object.userData.name && h.object.userData.name !== skip);
  return hit?.object.userData.name ?? null;
}

// 包围盒命中（手势用，容错比网格拾取大）：器材 Box3 按 pad 外扩，射线相交即命中；多命中取最近
const _box = new THREE.Box3(), _hit = new THREE.Vector3();
export function pickBox(ndc, camera, O, pad = .15, skip = null){
  ray.setFromCamera(ndc, camera);
  let best = null, bestD = Infinity;
  for (const [name, obj] of [['spoon', O.spoon], ['bottle', O.bottle], ['beaker', O.beaker], ['lamp', O.lamp], ['table', O.table]]) {
    if (name === skip) continue;
    _box.setFromObject(obj).expandByScalar(name === 'table' ? 0 : pad);
    if (ray.ray.intersectBox(_box, _hit)) { const d = _hit.distanceTo(ray.ray.origin); if (d < bestD) { bestD = d; best = name; } }
  }
  return best;
}
