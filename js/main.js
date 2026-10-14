// MANGO RAID: a first-person catapult game in a Lagos lane.
import * as THREE from '../vendor/three.module.js';
import * as CANNON from '../vendor/cannon-es.js';
import * as AU from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------ world constants (metres)
const WALL_H = 1.25, CAP_TOP = 1.34, WALL_Z = -0.25;     // wall front face at z=0, back at z=-0.5
const TIN_R = 0.125, TIN_H = 0.3, TIN_Z = -0.14;
const CAM = new THREE.Vector3(0, 1.58, 3.9);
const LOOK = new THREE.Vector3(0, 2.25, -4);
const STONE_SPEED = 18;
const TREE = { x: -1.15, z: -2.8, h: 6.6 };
const MX = 0.75;   // mango x offset so level data follows the tree
const HOUSE = { x: 2.4, z: -7, w: 9 };
HOUSE.h = HOUSE.w * 815 / 1600;
const hx = u => HOUSE.x + (u - 0.5) * HOUSE.w, hy = v => HOUSE.h * (1 - v);
const WINDOW = { x0: hx(0.247), x1: hx(0.419), y0: hy(0.675), y1: hy(0.35) };
const DOOR = { x0: hx(0.565), x1: hx(0.715), y0: hy(0.893), y1: hy(0.33) };
const CANOPY = { x: TREE.x, y: 4.55, z: TREE.z + 0.15, rx: 2.6, ry: 1.75, rz: 1.1 };

// ------------------------------------------------------------ renderer + scene
const gl = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3d7a6');
scene.fog = new THREE.Fog('#f0cf98', 16, 48);
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
camera.position.copy(CAM); camera.lookAt(LOOK);
const baseQuat = camera.quaternion.clone();

const hemi = new THREE.HemisphereLight('#ffe7bf', '#9a6a45', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd49a', 2.3);
sun.position.set(6, 9, 7); sun.target.position.set(0, 1.5, -2); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -4, near: 1, far: 30 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;

const loader = new THREE.TextureLoader();
const TEX = {};
function loadTex(k, url) { return new Promise(res => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[k] = t; res(t); }, undefined, () => res(null))); }

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, cols, size = [1, 3]) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = rnd(size[0], size[1]); g.fillRect(Math.random() * w, Math.random() * h, s, s); } }

// ------------------------------------------------------------ physics
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 14;
const M = { tin: new CANNON.Material('tin'), stone: new CANNON.Material('stone'), wall: new CANNON.Material('wall'), mango: new CANNON.Material('mango') };
world.addContactMaterial(new CANNON.ContactMaterial(M.tin, M.wall, { friction: 0.45, restitution: 0.12 }));
world.addContactMaterial(new CANNON.ContactMaterial(M.tin, M.tin, { friction: 0.35, restitution: 0.2 }));
world.addContactMaterial(new CANNON.ContactMaterial(M.stone, M.tin, { friction: 0.2, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(M.stone, M.wall, { friction: 0.5, restitution: 0.3 }));
world.addContactMaterial(new CANNON.ContactMaterial(M.mango, M.wall, { friction: 0.8, restitution: 0.15 }));
world.defaultContactMaterial.friction = 0.4;

function staticBox(w, h, d, x, y, z, mat = M.wall) {
  const b = new CANNON.Body({ mass: 0, material: mat, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), position: new CANNON.Vec3(x, y, z) });
  world.addBody(b); return b;
}

// ------------------------------------------------------------ static set
let backdrop, treeMesh, houseMesh, doorDark, crackMesh, babaWalk, babaPeek;
function buildSet() {
  // backdrop panorama far behind
  const bw = 130, bh = bw * 1018 / 2400;
  backdrop = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: TEX.backdrop, fog: false, depthWrite: false }));
  backdrop.position.set(0, bh * 0.3, -40); scene.add(backdrop);
  // ground: dusty lane in front, yard behind
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6a66a'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ['#c7935a', '#e3b87d', '#b9834c', '#ecc792'], [1, 4]);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,80,40,0.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rnd(2, 6), rnd(1, 4), Math.random() * 3, 0, 7); g.fill(); }
  }, [14, 14]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -10); ground.receiveShadow = true; scene.add(ground);
  const gb = new CANNON.Body({ mass: 0, material: M.wall, shape: new CANNON.Plane() }); gb.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(gb); gb.userData = { kind: 'ground' };
  // compound wall with cement cap and broken bottles
  const plaster = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0dcb4'); gr.addColorStop(1, '#e2c592'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, ['rgba(160,120,70,0.25)', 'rgba(255,250,235,0.4)', 'rgba(120,85,50,0.2)'], [1, 3]);
    for (let i = 0; i < 9; i++) { const x = Math.random() * w; const gg = g.createLinearGradient(0, h * 0.7, 0, h); gg.addColorStop(0, 'rgba(140,90,50,0)'); gg.addColorStop(1, 'rgba(140,90,50,0.35)'); g.fillStyle = gg; g.fillRect(x, h * 0.6, rnd(20, 80), h * 0.4); }
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(110,80,50,0.35)'; g.lineWidth = 1.2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rnd(-12, 12); y += rnd(4, 14); g.lineTo(x, y); } g.stroke(); }
  }, [6, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(26, WALL_H, 0.5), wallMat);
  wall.position.set(0, WALL_H / 2, WALL_Z); wall.receiveShadow = true; wall.castShadow = true; scene.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(26.2, CAP_TOP - WALL_H, 0.58), new THREE.MeshStandardMaterial({ color: '#cdbb9c', roughness: 0.9 }));
  cap.position.set(0, (CAP_TOP + WALL_H) / 2, WALL_Z); cap.receiveShadow = true; cap.castShadow = true; scene.add(cap);
  const wb = staticBox(26.2, CAP_TOP, 0.58, 0, CAP_TOP / 2, WALL_Z); wb.userData = { kind: 'wall' };
  const glassCols = ['#2f8a3f', '#3fa152', '#7a4a1c', '#5b3410', '#9ccf8a'];
  const shardGeo = new THREE.ConeGeometry(0.035, 0.14, 4);
  for (let x = -12; x < 12; x += rnd(0.09, 0.2)) {
    const m = new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color: glassCols[Math.floor(Math.random() * glassCols.length)], roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    m.position.set(x, CAP_TOP + 0.04, WALL_Z - 0.2 + rnd(-0.04, 0.04)); m.rotation.set(rnd(-0.4, 0.4), rnd(0, 3), rnd(-0.4, 0.4)); m.scale.setScalar(rnd(0.6, 1.4));
    scene.add(m);
  }
  // Baba's bungalow
  const hm = new THREE.MeshBasicMaterial({ map: TEX.house, transparent: true, alphaTest: 0.4 });
  houseMesh = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE.w, HOUSE.h), hm);
  houseMesh.position.set(HOUSE.x, HOUSE.h / 2, HOUSE.z); scene.add(houseMesh);
  const hb = staticBox(HOUSE.w * 0.8, HOUSE.h * 0.85, 0.2, HOUSE.x, HOUSE.h * 0.42, HOUSE.z - 0.15); hb.userData = { kind: 'house' };
  // the glass: a breakable target in front of the painted window
  const glass = staticBox(WINDOW.x1 - WINDOW.x0, WINDOW.y1 - WINDOW.y0, 0.1, (WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, HOUSE.z + 0.03);
  glass.userData = { kind: 'glass' };
  glass.addEventListener('collide', e => { if (e.body.userData && e.body.userData.kind === 'stone') { if (S.L && S.L.window) breakWindow(); else { AU.fx.tok(0.5); addNoise(0.05); } } });
  // dark doorway shown when Baba opens the door
  doorDark = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0), new THREE.MeshBasicMaterial({ color: '#2a170c' }));
  doorDark.position.set((DOOR.x0 + DOOR.x1) / 2, (DOOR.y0 + DOOR.y1) / 2, HOUSE.z + 0.02); doorDark.visible = false; scene.add(doorDark);
  crackMesh = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.x1 - WINDOW.x0, WINDOW.y1 - WINDOW.y0), new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true }));
  crackMesh.position.set((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, HOUSE.z + 0.05); crackMesh.visible = false; scene.add(crackMesh);
  // Baba sprites
  babaWalk = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25 * 1210 / 662), new THREE.MeshBasicMaterial({ map: TEX.babaWalk, transparent: true, alphaTest: 0.4 }));
  babaWalk.visible = false; scene.add(babaWalk);
  const pw = (WINDOW.x1 - WINDOW.x0) * 1.05;
  babaPeek = new THREE.Mesh(new THREE.PlaneGeometry(pw, pw * 724 / 516), new THREE.MeshBasicMaterial({ map: TEX.babaSus, transparent: true, alphaTest: 0.4 }));
  babaPeek.position.set((WINDOW.x0 + WINDOW.x1) / 2, WINDOW.y0 + pw * 0.5, HOUSE.z + 0.06); babaPeek.visible = false; scene.add(babaPeek);
  // mango tree billboard + trunk collider
  const tw = TREE.h * 1100 / 1252;
  treeMesh = new THREE.Mesh(new THREE.PlaneGeometry(tw, TREE.h), new THREE.MeshBasicMaterial({ map: TEX.tree, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide }));
  treeMesh.position.set(TREE.x, TREE.h / 2, TREE.z); scene.add(treeMesh);
  treeMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: TEX.tree, alphaTest: 0.45 });
  treeMesh.castShadow = true;
  const trunk = new CANNON.Body({ mass: 0, material: M.wall, shape: new CANNON.Cylinder(0.32, 0.4, 3, 10), position: new CANNON.Vec3(TREE.x + 0.05, 1.5, TREE.z) });
  trunk.userData = { kind: 'trunk' }; world.addBody(trunk);
}
function crackTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2.5;
    const cx = w * 0.45, cy = h * 0.4;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + rnd(-0.2, 0.2); let x = cx, y = cy; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += Math.cos(a + rnd(-0.4, 0.4)) * rnd(15, 40); y += Math.sin(a + rnd(-0.4, 0.4)) * rnd(15, 40); g.lineTo(x, y); } g.stroke(); }
    for (let r = 20; r < 120; r += 30) { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.28; g.lineTo(cx + Math.cos(a) * r * rnd(0.8, 1.2), cy + Math.sin(a) * r * rnd(0.8, 1.2)); } g.stroke(); }
    g.fillStyle = 'rgba(20,10,5,0.85)'; g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; g.lineTo(cx + Math.cos(a) * rnd(14, 26), cy + Math.sin(a) * rnd(14, 26)); } g.fill();
  });
}

// ------------------------------------------------------------ props: tins, mangoes, stools
const LABELS = [
  { bg: '#d9342b', band: '#f6e7c8', txt: 'NANA', sub: 'TOMATO PASTE', ink: '#2a5e2a', icon: 'tomato' },
  { bg: '#1f5fb8', band: '#ffffff', txt: 'OKON', sub: 'FULL CREAM MILK', ink: '#1f5fb8', icon: 'cow' },
  { bg: '#f2c230', band: '#c62f2a', txt: 'SUNNY', sub: 'SARDINES', ink: '#f6e7c8', icon: 'fish' },
  { bg: '#2f8f4e', band: '#f2c230', txt: 'IYA', sub: 'BAKED BEANS', ink: '#7a2f12', icon: 'bean' },
  { bg: '#f08a2b', band: '#3a1d0e', txt: 'MAMA', sub: 'PALM OIL', ink: '#f2c230', icon: 'drop' },
];
let labelTex = null;
function buildLabels() {
  labelTex = LABELS.map(L => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = L.bg; g.fillRect(0, 0, w, h);
    g.fillStyle = L.band; g.fillRect(0, h * 0.28, w, h * 0.44);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, h * 0.06, w, 8); g.fillRect(0, h * 0.88, w, 8);
    for (const ox of [0, w / 2]) {
      g.fillStyle = L.ink; g.font = '900 54px Nunito, Arial'; g.textAlign = 'center'; g.fillText(L.txt, ox + w / 4, h * 0.53);
      g.font = '800 19px Nunito, Arial'; g.fillText(L.sub, ox + w / 4, h * 0.66);
      const ix = ox + w / 4, iy = h * 0.17;
      if (L.icon === 'tomato') { g.fillStyle = '#e8483c'; g.beginPath(); g.arc(ix, iy, 16, 0, 7); g.fill(); g.fillStyle = '#2f8f4e'; g.fillRect(ix - 6, iy - 20, 12, 6); }
      if (L.icon === 'fish') { g.fillStyle = '#c0c8d0'; g.beginPath(); g.ellipse(ix, iy, 26, 11, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(ix + 22, iy); g.lineTo(ix + 36, iy - 10); g.lineTo(ix + 36, iy + 10); g.fill(); }
      if (L.icon === 'cow') { g.fillStyle = '#fff'; g.beginPath(); g.arc(ix, iy, 16, 0, 7); g.fill(); g.fillStyle = '#1f2a44'; g.beginPath(); g.arc(ix - 5, iy - 3, 5, 0, 7); g.fill(); }
      if (L.icon === 'bean') { g.fillStyle = '#b9542a'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(ix + k * 14, iy, 7, 10, 0.4, 0, 7); g.fill(); } }
      if (L.icon === 'drop') { g.fillStyle = '#e04b1d'; g.beginPath(); g.moveTo(ix, iy - 20); g.quadraticCurveTo(ix + 18, iy + 4, ix, iy + 14); g.quadraticCurveTo(ix - 18, iy + 4, ix, iy - 20); g.fill(); }
    }
    speckle(g, w, h, 400, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.08)'], [1, 3]);
  }));
}
const tinGeo = new THREE.CylinderGeometry(TIN_R, TIN_R, TIN_H, 28, 1);
const tinLidMat = new THREE.MeshStandardMaterial({ color: '#d7d9db', metalness: 0.75, roughness: 0.32 });
const stoneGeo = new THREE.IcosahedronGeometry(0.05, 1);
const stoneMat = new THREE.MeshStandardMaterial({ color: '#8f877b', roughness: 0.9, flatShading: true });
const mangoGeo = (() => {
  const g = new THREE.SphereGeometry(1, 18, 14); const pos = g.attributes.position; const col = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); const x = pos.getX(i);
    pos.setXYZ(i, x * 0.13 * (1 + 0.12 * Math.max(0, -y)), y * 0.175, pos.getZ(i) * 0.12);
  }
  g.computeVertexNormals(); return g;
})();
function mangoColors(geo, ripe) {
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const top = new THREE.Color(ripe ? '#7db542' : '#4f9a3a'), mid = new THREE.Color(ripe ? '#f2b42a' : '#6fb04a'), bot = new THREE.Color(ripe ? '#e8552c' : '#9cc85a');
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 0.175 + 1) / 2; const c = t > 0.6 ? mid.clone().lerp(top, (t - 0.6) / 0.4) : bot.clone().lerp(mid, t / 0.6);
    const sx = pos.getX(i); if (ripe && sx > 0.045) c.lerp(new THREE.Color('#ff6a3a'), 0.25);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  const g2 = geo.clone(); g2.setAttribute('color', new THREE.BufferAttribute(cols, 3)); return g2;
}
const MANGO_RIPE = mangoColors(mangoGeo, true), MANGO_GREEN = mangoColors(mangoGeo, false);
const mangoMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
const stemMat = new THREE.MeshStandardMaterial({ color: '#4a3a1c', roughness: 1 });
const woodTex = () => canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(60,35,15,${rnd(0.1, 0.35)})`; g.beginPath(); g.moveTo(0, rnd(0, h)); g.bezierCurveTo(w / 3, rnd(0, h), w * 2 / 3, rnd(0, h), w, rnd(0, h)); g.stroke(); } });

// ------------------------------------------------------------ level data
// x positions are metres across the wall; mangoes sit in the canopy at TREE depth.
function stack(cx, rows, base = CAP_TOP, z = TIN_Z) { // rows like [3,2,1]
  const out = []; rows.forEach((n, r) => { for (let i = 0; i < n; i++) out.push({ x: cx + (i - (n - 1) / 2) * (TIN_R * 2 + 0.012), y: base + TIN_H / 2 + r * (TIN_H + 0.004), z }); }); return out;
}
const LEVELS = [
  { name: 'Three Tins', tip: 'Drag back anywhere, aim, let go.', stones: 5, spare: 2, tins: [...stack(-0.45, [1]), ...stack(0, [1]), ...stack(0.45, [1])] },
  { name: 'Small Pyramid', tip: 'Hit the bottom row to bring them all down.', stones: 5, spare: 2, tins: stack(0, [3, 2, 1]) },
  { name: 'First Mangoes', tip: 'Only the ripe (yellow-red) ones count. Aim a bit high, stones drop.', stones: 5, spare: 1, mangoes: [{ x: -1.25, y: 3.5, ripe: 1 }, { x: -0.55, y: 4.05, ripe: 1 }, { x: 0.15, y: 3.45, ripe: 1 }], goalMango: 3 },
  { name: 'Mind The Window', tip: 'Break the window and Baba will finish you.', stones: 6, spare: 2, window: 1, tins: [...stack(-0.35, [2, 1]), ...stack(0.75, [1, 1])], mangoes: [{ x: -1.0, y: 3.6, ripe: 1 }, { x: 0.2, y: 4.2, ripe: 1 }], goalMango: 2 },
  { name: 'The Veranda', tip: 'Two tins sit on the stool by the house.', stones: 6, spare: 2, window: 1, tins: [...stack(-0.3, [2, 1])], stool: { x: 0.55, z: -4.4, h: 1.2, tins: [1, 1] } },
  { name: 'Harmattan', tip: 'The wind pushes your stone. Aim into it.', stones: 6, spare: 2, wind: -2.6, window: 1, tins: stack(0.1, [3, 2]), mangoes: [{ x: -0.9, y: 3.7, ripe: 1 }, { x: -1.6, y: 4.4, ripe: 1 }], goalMango: 2 },
  { name: 'Swinging Tin', tip: 'Cut it down: hit the swinging tin.', stones: 6, spare: 2, window: 1, tins: stack(0.5, [2, 1]), swing: { x: -0.5, y: 4.0, len: 1.05 } },
  { name: 'High Mangoes', tip: 'Green ones are wasted. Ripe only!', stones: 7, spare: 2, wind: 2.0, window: 1, mangoes: [{ x: -1.5, y: 4.6, ripe: 1 }, { x: -0.7, y: 5.1, ripe: 1 }, { x: 0.3, y: 4.5, ripe: 1 }, { x: -2.1, y: 3.9, ripe: 1 }, { x: -1.0, y: 4.0, ripe: 0 }, { x: -0.1, y: 5.0, ripe: 0 }], goalMango: 4 },
  { name: 'Light Sleeper', tip: 'Baba sleeps light today. Few, clean shots.', stones: 6, spare: 1, sens: 1.7, window: 1, tins: stack(0, [4, 3, 2, 1]) },
  { name: 'Tight Gaps', tip: 'The stool is right in front of the window. Careful!', stones: 6, spare: 2, window: 1, tins: stack(-0.6, [2, 1]), stool: { x: 0.85, z: -5.6, h: 1.3, tins: [2, 1] } },
  { name: 'Evening Raid', tip: 'Getting dark. One more raid before dinner.', stones: 8, spare: 2, evening: 1, wind: -1.6, window: 1, tins: [...stack(-0.4, [2, 1]), ...stack(0.6, [1])], mangoes: [{ x: -1.8, y: 4.3, ripe: 1 }, { x: -0.6, y: 3.6, ripe: 1 }, { x: 0.1, y: 4.6, ripe: 1 }, { x: -1.1, y: 5.0, ripe: 0 }], goalMango: 3 },
  { name: 'Baba Dey Look', tip: 'When Baba is at the window, DON\'T SHOOT.', stones: 9, spare: 2, window: 1, peek: 1, tins: [...stack(-0.75, [2, 1]), ...stack(1.25, [2, 1])], mangoes: [{ x: -1.3, y: 3.7, ripe: 1 }, { x: -0.4, y: 4.4, ripe: 1 }, { x: -1.9, y: 4.6, ripe: 1 }], goalMango: 3 },
];

// ------------------------------------------------------------ save
const SAVE_KEY = 'mr:v1';
let save = { stars: {}, best: {}, seenHow: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ------------------------------------------------------------ level state
const S = {
  lv: 0, L: null, playing: false, paused: false, over: false,
  tins: [], mangoes: [], stones: [], extras: [], swing: null,
  stonesLeft: 0, noise: 0, noiseMax: 0, babaState: 'sleep', babaT: 0, comeT: 0, peekT: 0, peeking: false,
  score: 0, tinsDown: 0, ripeDown: 0, greenDown: 0, shotId: 0, combo: {}, timeScale: 1, slowT: 0, settleT: 0,
  wind: 0, endPending: 0, shakeT: 0,
};
function clearLevel() {
  for (const o of [...S.tins, ...S.mangoes, ...S.stones, ...S.extras]) { if (o.mesh) scene.remove(o.mesh); if (o.stem) scene.remove(o.stem); if (o.body) world.removeBody(o.body); if (o.rope) scene.remove(o.rope); }
  if (S.swing && S.swing.c) world.removeConstraint(S.swing.c);
  S.tins = []; S.mangoes = []; S.stones = []; S.extras = []; S.swing = null;
  for (const p of parts) scene.remove(p.mesh); parts.length = 0;
}
function addTin(x, y, z, sleep = true) {
  const L = labelTex[Math.floor(Math.random() * labelTex.length)];
  const side = new THREE.MeshStandardMaterial({ map: L, metalness: 0.25, roughness: 0.45 });
  const mesh = new THREE.Mesh(tinGeo, [side, tinLidMat, tinLidMat]);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set(x, y, z); mesh.rotation.y = Math.random() * 6.28; scene.add(mesh);
  const body = new CANNON.Body({ mass: 0.11, material: M.tin, shape: new CANNON.Cylinder(TIN_R, TIN_R, TIN_H, 14), position: new CANNON.Vec3(x, y, z), linearDamping: 0.05, angularDamping: 0.1 });
  body.quaternion.setFromEuler(0, mesh.rotation.y, 0);
  body.sleepSpeedLimit = 0.15; body.sleepTimeLimit = 0.4; world.addBody(body); if (sleep) body.sleep();
  const tin = { mesh, body, baseY: y - TIN_H / 2, down: false, cd: 0, lastShot: -1 };
  body.userData = { kind: 'tin', ref: tin };
  body.addEventListener('collide', e => onTinHit(tin, e));
  S.tins.push(tin); return tin;
}
function addMango(m) {
  const mesh = new THREE.Mesh(m.ripe ? MANGO_RIPE : MANGO_GREEN, mangoMat); mesh.castShadow = true;
  m = { ...m, x: m.x + MX };
  const z = TREE.z + 0.45 + rnd(0, 0.2);
  mesh.position.set(m.x, m.y, z); mesh.rotation.z = rnd(-0.3, 0.3); scene.add(mesh);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.36, 5), stemMat); stem.position.set(m.x, m.y + 0.34, z); scene.add(stem);
  const body = new CANNON.Body({ mass: 0, material: M.mango, shape: new CANNON.Sphere(0.15), position: new CANNON.Vec3(m.x, m.y, z) });
  world.addBody(body);
  const mg = { mesh, stem, body, ripe: !!m.ripe, attached: true, down: false, phase: Math.random() * 6, x: m.x, y: m.y, z };
  body.userData = { kind: 'mango', ref: mg };
  body.addEventListener('collide', e => onMangoHit(mg, e));
  S.mangoes.push(mg);
}
function addStool(st) {
  const tex = woodTex();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  top.position.set(st.x, st.h, st.z); top.castShadow = top.receiveShadow = true; scene.add(top);
  const legs = [];
  for (const [dx, dz] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, st.h, 0.06), new THREE.MeshStandardMaterial({ color: '#7a4f28' })); l.position.set(st.x + dx, st.h / 2, st.z + dz); l.castShadow = true; scene.add(l); legs.push(l); }
  const body = staticBox(0.9, 0.07, 0.5, st.x, st.h, st.z); body.userData = { kind: 'stool' };
  S.extras.push({ mesh: top, body }, ...legs.map(l => ({ mesh: l })));
  for (const t of stack(st.x, st.tins, st.h + 0.035, st.z)) addTin(t.x, t.y, t.z).baseY = st.h;
}
function addSwing(sw) {
  const ax = sw.x + MX;
  const anchor = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(ax, sw.y, TREE.z + 0.6) }); world.addBody(anchor);
  const tin = addTin(ax + 0.35, sw.y - sw.len, TREE.z + 0.6, false);
  tin.baseY = 2.4; tin.swing = true;
  tin.body.velocity.set(-1.2, 0, 0);
  const c = new CANNON.PointToPointConstraint(anchor, new CANNON.Vec3(0, 0, 0), tin.body, new CANNON.Vec3(0, TIN_H / 2, 0));
  c.collideConnected = false; world.addConstraint(c);
  const ropeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: '#d9c49a' })); scene.add(rope);
  S.swing = { c, anchor, tin, rope, cut: false };
  S.extras.push({ body: anchor, rope });
}

function startLevel(i) {
  clearLevel();
  const L = LEVELS[i]; S.lv = i; S.L = L;
  Object.assign(S, { playing: true, paused: false, over: false, stonesLeft: L.stones, noise: 0, noiseMax: 0, babaState: 'sleep', babaT: 0, comeT: 0, peekT: rnd(3, 5), peeking: false,
    score: 0, tinsDown: 0, ripeDown: 0, greenDown: 0, shotId: 0, lastFire: -1e9, combo: {}, timeScale: 1, slowT: 0, settleT: 0, wind: L.wind || 0, endPending: 0 });
  for (const t of L.tins || []) addTin(t.x, t.y, t.z);
  for (const m of L.mangoes || []) addMango(m);
  if (L.stool) addStool(L.stool);
  if (L.swing) addSwing(L.swing);
  crackMesh.visible = false; doorDark.visible = false; babaWalk.visible = false; babaPeek.visible = false;
  setLighting(!!L.evening);
  S.goalTins = S.tins.length; S.goalMango = L.goalMango || 0;
  buildHud(); setBabaFace('sleep');
  showScreen(null); $('hud').classList.add('on'); $('stones').classList.add('on'); $('hudPause').style.display = 'flex';
  banner('LEVEL ' + (i + 1), L.name, 1300);
  if (L.tip) setTimeout(() => { if (S.playing && S.lv === i && S.shotId === 0) hint(L.tip); }, 1300);
  AU.music(true);
}
function setLighting(evening) {
  if (evening) { sun.color.set('#ff9a5a'); sun.intensity = 1.7; sun.position.set(9, 4, 4); hemi.color.set('#e7a6a0'); hemi.groundColor.set('#5a3a4a'); hemi.intensity = 0.85; scene.fog.color.set('#c98a7a'); scene.background.set('#c98a7a'); backdrop.material.color.set('#e0a090'); treeMesh.material.color.set('#c9a2a0'); houseMesh.material.color.set('#d9a69a'); }
  else { sun.color.set('#ffd49a'); sun.intensity = 2.3; sun.position.set(6, 9, 7); hemi.color.set('#ffe7bf'); hemi.groundColor.set('#9a6a45'); hemi.intensity = 1.15; scene.fog.color.set('#f0cf98'); scene.background.set('#f3d7a6'); backdrop.material.color.set('#ffffff'); treeMesh.material.color.set('#ffffff'); houseMesh.material.color.set('#ffffff'); }
}

// ------------------------------------------------------------ collisions -> score, noise, sound
function addNoise(v) {
  if (!S.playing) return;
  S.noise = clamp(S.noise + v * (S.L.sens || 1), 0, 1);
  S.noiseMax = Math.max(S.noiseMax, S.noise);
}
function onTinHit(tin, e) {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const other = e.body.userData && e.body.userData.kind;
  if (other === 'stone') { tin.lastShot = e.body.userData.shot; if (S.swing && S.swing.tin === tin && !S.swing.cut) cutSwing(); }
  if (tin.cd > 0 || v < 0.6) return;
  tin.cd = 0.07;
  const i = clamp(v / 6, 0.12, 1);
  AU.fx.clang(i, other === 'ground' ? 420 + Math.random() * 120 : undefined);
  addNoise((other === 'ground' ? 0.055 : 0.03) * i + 0.006);
  if (other === 'stone' || v > 2.5) dust(tin.body.position, 3);
}
function onMangoHit(mg, e) {
  const other = e.body.userData && e.body.userData.kind;
  if (mg.attached && other === 'stone') {
    mg.attached = false; mg.lastShot = e.body.userData.shot;
    mg.body.type = CANNON.Body.DYNAMIC; mg.body.mass = 0.22; mg.body.updateMassProperties();
    const sv = e.body.velocity; mg.body.velocity.set(sv.x * 0.15, 0.6, sv.z * 0.1); mg.body.angularVelocity.set(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)); mg.body.wakeUp();
    scene.remove(mg.stem);
    AU.fx.leaves(0.8); AU.fx.squish(0.4); leaves(mg.mesh.position, 6); addNoise(0.015);
    return;
  }
  if (!mg.attached && other === 'ground') {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 1) { AU.fx.thud(clamp(v / 7, 0.2, 1)); addNoise(0.012); }
  }
}
function cutSwing() {
  S.swing.cut = true; world.removeConstraint(S.swing.c); S.swing.rope.visible = false;
  AU.fx.leaves(0.5); popAt(S.swing.tin.body.position, 'SNAP!', 'm');
}
function breakWindow() {
  if (!S.playing || crackMesh.visible) return;
  crackMesh.visible = true; AU.fx.smash(); addNoise(1);
  const c = new THREE.Vector3((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, HOUSE.z + 0.1);
  for (let i = 0; i < 26; i++) spawnPart('glass', c.clone().add(new THREE.Vector3(rnd(-0.5, 0.5), rnd(-0.5, 0.5), 0)), new THREE.Vector3(rnd(-2, 2), rnd(0, 3), rnd(0, 3)));
  flash(0.5); shake(0.35);
  setTimeout(() => endLevel('window'), 900);
}

// ------------------------------------------------------------ particles
const parts = [];
const partGeo = { dust: new THREE.SphereGeometry(0.06, 6, 5), leaf: new THREE.PlaneGeometry(0.09, 0.05), glass: new THREE.PlaneGeometry(0.06, 0.08) };
const partMat = { dust: new THREE.MeshBasicMaterial({ color: '#e9cfa2', transparent: true, opacity: 0.6, depthWrite: false }), leaf: new THREE.MeshStandardMaterial({ color: '#3f8a3a', side: THREE.DoubleSide }), glass: new THREE.MeshBasicMaterial({ color: '#d9f0ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide }) };
function spawnPart(kind, pos, vel, life = 1.2) {
  const mesh = new THREE.Mesh(partGeo[kind], kind === 'dust' ? partMat.dust.clone() : partMat[kind]);
  mesh.position.copy(pos); mesh.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); scene.add(mesh);
  parts.push({ kind, mesh, vel, life, max: life, spin: new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)) });
}
function dust(p, n) { for (let i = 0; i < n; i++) spawnPart('dust', new THREE.Vector3(p.x, p.y, p.z), new THREE.Vector3(rnd(-0.6, 0.6), rnd(0.2, 1), rnd(-0.6, 0.6)), 0.6); }
function leaves(p, n) { for (let i = 0; i < n; i++) spawnPart('leaf', new THREE.Vector3(p.x + rnd(-0.2, 0.2), p.y + rnd(-0.1, 0.3), p.z), new THREE.Vector3(rnd(-0.6, 0.6), rnd(-0.2, 0.6), rnd(-0.3, 0.3)), 2.2); }
function stepParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    if (p.kind === 'leaf') { p.vel.y -= 1.2 * dt; p.vel.multiplyScalar(Math.exp(-1.5 * dt)); p.vel.x += Math.sin(p.life * 5) * 0.8 * dt + S.wind * 0.15 * dt; }
    else if (p.kind === 'glass') p.vel.y -= 9.8 * dt;
    else { p.vel.multiplyScalar(Math.exp(-2 * dt)); p.mesh.scale.multiplyScalar(1 + dt * 1.5); p.mesh.material.opacity = 0.6 * Math.max(0, p.life / p.max); }
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.kind !== 'dust') { p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; }
    if (p.mesh.position.y < 0.01) { p.mesh.position.y = 0.01; p.vel.set(0, 0, 0); }
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) { scene.remove(parts[i].mesh); parts.splice(i, 1); }
}

// ------------------------------------------------------------ firing
function fire(nx, ny) {
  if (!S.playing || S.stonesLeft <= 0) return;
  if (S.peeking && S.L.peek) { caughtPeek(); return; }
  S.stonesLeft--; S.shotId++; S.lastFire = performance.now(); updateStones();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const rd = ray.ray.direction.clone().normalize();
  const start = camera.position.clone().add(new THREE.Vector3(0, -0.12, 0)).addScaledVector(rd, 0.4);
  // the sight is zeroed at the wall: lift the launch so the stone crosses the wall exactly under the crosshair
  const dz = (TIN_Z - camera.position.z) / rd.z;
  const T = camera.position.clone().addScaledVector(rd, dz > 0 ? dz : 4);
  const tFlight = T.distanceTo(start) / STONE_SPEED;
  T.y += 0.5 * 9.8 * tFlight * tFlight;
  const dir = T.sub(start).normalize();
  const body = new CANNON.Body({ mass: 0.11, material: M.stone, shape: new CANNON.Sphere(0.055), position: new CANNON.Vec3(start.x, start.y, start.z), linearDamping: 0.01 });
  body.velocity.set(dir.x * STONE_SPEED, dir.y * STONE_SPEED, dir.z * STONE_SPEED);
  body.angularVelocity.set(rnd(-20, 20), rnd(-20, 20), rnd(-20, 20));
  const shot = S.shotId;
  body.userData = { kind: 'stone', shot };
  let hits = 0;
  body.addEventListener('collide', e => {
    const k = e.body.userData && e.body.userData.kind; const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (k === 'wall' || k === 'house' || k === 'trunk' || k === 'stool') { if (v > 2) { AU.fx.tok(clamp(v / 15, 0.2, 0.9)); addNoise(0.008); dust(body.position, 2); } }
    else if (k === 'ground' && v > 2) { AU.fx.tok(0.25); }
    hits++;
  });
  world.addBody(body);
  const mesh = new THREE.Mesh(stoneGeo, stoneMat); mesh.castShadow = true; scene.add(mesh);
  S.stones.push({ body, mesh, t: 0, shot, inLeaves: false });
  S.combo[shot] = 0;
  AU.fx.twang(1); AU.fx.whiz(); shake(0.08);
  hideHint();
}

// ------------------------------------------------------------ Baba
function setBabaFace(st) {
  const src = { sleep: 'assets/baba-sleep.webp', sus: 'assets/baba-sus.webp', mad: 'assets/baba-mad.webp' }[st];
  const f = $('babaFace'); if (!f.src.endsWith(src)) { f.src = src; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
}
function babaComes() {
  S.babaState = 'coming'; S.comeT = 0;
  setBabaFace('mad'); AU.fx.hey(); AU.setTension(1, true);
  doorDark.visible = true; babaWalk.visible = true;
  banner('BABA DEY COME!', 'Finish am quick!', 1400, true);
  shake(0.25);
}
function caughtPeek() {
  if (!S.playing) return;
  AU.fx.hey(); setBabaFace('mad'); babaPeek.material.map = TEX.babaMad; babaPeek.material.needsUpdate = true;
  banner('BABA SEE YOU!', '', 1200, true);
  setTimeout(() => endLevel('seen'), 1000);
}

// ------------------------------------------------------------ main step
const FIXED = 1 / 240;
let acc = 0;
function step(dt) {
  if (!S.playing || S.paused) return;
  const sdt = dt * S.timeScale;
  // wind on stones
  for (const s of S.stones) { s.body.force.x += S.wind * s.body.mass; }
  acc += sdt; let n = 0;
  while (acc >= FIXED && n < 10) { world.step(FIXED); acc -= FIXED; n++; }
  if (n >= 10) acc = 0;
  // tins
  for (const t of S.tins) {
    t.mesh.position.copy(t.body.position); t.mesh.quaternion.copy(t.body.quaternion);
    if (t.cd > 0) t.cd -= dt;
    if (!t.down && (t.body.position.y < t.baseY - 0.35 || (t.swing && S.swing && S.swing.cut && t.body.position.y < 1.0))) {
      t.down = true; S.tinsDown++; award(100, t.mesh.position, t.lastShot);
    }
  }
  // mangoes
  const time = performance.now() / 1000;
  for (const m of S.mangoes) {
    if (m.attached) { m.mesh.rotation.z = Math.sin(time * 1.3 + m.phase) * 0.12 + (S.wind ? S.wind * 0.03 : 0); m.mesh.position.x = m.x + Math.sin(time * 1.3 + m.phase) * 0.012; }
    else { m.mesh.position.copy(m.body.position); m.mesh.quaternion.copy(m.body.quaternion); }
    if (!m.attached && !m.down && m.body.position.y < 1.6) {
      m.down = true;
      if (m.ripe) { S.ripeDown++; award(150, m.mesh.position, m.lastShot, 'm'); }
      else { S.greenDown++; award(25, m.mesh.position, m.lastShot, 'r', 'GREEN!'); }
    }
  }
  if (S.swing && !S.swing.cut) {
    const a = S.swing.anchor.position, b = S.swing.tin.body.position; const q = S.swing.tin.body.quaternion;
    const top = new CANNON.Vec3(0, TIN_H / 2, 0); const w = q.vmult(top).vadd(b);
    S.swing.rope.geometry.setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(w.x, w.y, w.z)]);
  }
  // stones
  for (const s of S.stones) {
    s.t += sdt; s.mesh.position.copy(s.body.position); s.mesh.quaternion.copy(s.body.quaternion);
    const p = s.body.position;
    const inC = ((p.x - CANOPY.x) / CANOPY.rx) ** 2 + ((p.y - CANOPY.y) / CANOPY.ry) ** 2 + ((p.z - CANOPY.z) / CANOPY.rz) ** 2 < 1;
    if (inC && !s.inLeaves) { s.inLeaves = true; AU.fx.leaves(0.7); leaves(p, 4); s.body.velocity.scale(0.7, s.body.velocity); }
    if (!inC) s.inLeaves = false;
  }
  for (let i = S.stones.length - 1; i >= 0; i--) { const s = S.stones[i]; if (s.t > 5 || s.body.position.y < -2 || s.body.position.z < -20) { scene.remove(s.mesh); world.removeBody(s.body); S.stones.splice(i, 1); } }
  // noise + Baba
  if (S.babaState !== 'coming') {
    if (S.noise >= 0.999) babaComes();
    S.noise = Math.max(0, S.noise - dt * 0.035);
    if (S.babaState === 'coming') {}
    else if (S.noise > 0.45 && S.babaState === 'sleep') { S.babaState = 'sus'; setBabaFace('sus'); AU.fx.hmm(); }
    else if (S.noise < 0.3 && S.babaState === 'sus') { S.babaState = 'sleep'; setBabaFace('sleep'); }
    AU.setTension(S.noise, false);
    AU.setSnore(S.babaState === 'sleep' ? 1 - S.noise : 0.2);
  } else {
    S.comeT += dt;
    const k = clamp(S.comeT / 4, 0, 1);
    const ke = 1 - Math.pow(1 - k, 1.6);
    const bx = lerp((DOOR.x0 + DOOR.x1) / 2, 0.45, ke), bz = lerp(HOUSE.z + 0.4, -0.85, ke);
    babaWalk.position.set(bx, 1.14 + Math.abs(Math.sin(S.comeT * 8)) * 0.06, bz); babaWalk.rotation.z = Math.sin(S.comeT * 8) * 0.04;
    const left = Math.ceil(4 - S.comeT); const c = $('count');
    if (left > 0) { if (c.textContent !== String(left)) { c.textContent = left; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); AU.fx.click(); } }
    if (S.comeT >= 4 && !S.over) endLevel('caught');
    AU.setSnore(0);
  }
  // Baba peeks at the window (level 12)
  if (S.L.peek && S.babaState !== 'coming') {
    S.peekT -= dt;
    if (S.peekT <= 0) { S.peeking = !S.peeking; S.peekT = S.peeking ? rnd(1.6, 2.4) : rnd(2.5, 4.5); babaPeek.visible = S.peeking; babaPeek.material.map = TEX.babaSus; babaPeek.material.needsUpdate = true; if (S.peeking) { AU.fx.hmm(); setBabaFace('sus'); hint('👀 Baba dey look! Hold your fire.'); } else { hideHint(); if (S.babaState === 'sleep') setBabaFace('sleep'); } }
  }
  // goals
  const tinsOk = S.tinsDown >= S.goalTins, mangoOk = S.ripeDown >= S.goalMango;
  updateGoals();
  if (tinsOk && mangoOk && !S.endPending) {
    S.endPending = 1; S.timeScale = 0.3; S.slowT = 0.9; AU.fx.win();
    setTimeout(() => endLevel('win'), 1300);
  }
  if (S.slowT > 0) { S.slowT -= dt; if (S.slowT <= 0) S.timeScale = 1; }
  // out of stones
  if (S.stonesLeft <= 0 && !S.endPending && S.stones.length === 0) {
    const moving = S.tins.some(t => t.body.sleepState !== CANNON.Body.SLEEPING && t.body.velocity.length() > 0.08 && !t.down) || S.mangoes.some(m => !m.attached && !m.down);
    S.settleT = moving ? 0 : S.settleT + dt;
    if (S.settleT > 1.2) { S.endPending = 1; setTimeout(() => { if (!S.over) endLevel('stones'); }, 300); }
  }
  // meter UI
  const mi = $('meter'); mi.style.transform = `scaleX(${S.babaState === 'coming' ? 1 : S.noise})`; mi.className = S.noise > 0.7 || S.babaState === 'coming' ? 'hi' : S.noise > 0.4 ? 'mid' : '';
}
function award(pts, pos, shot, cls = '', label) {
  let mult = 1;
  if ((shot === undefined || shot < 0) && performance.now() - S.lastFire < 3500) shot = S.shotId;
  if (shot >= 0 && S.combo[shot] !== undefined) { S.combo[shot]++; mult = Math.min(4, S.combo[shot]); }
  S.score += pts * mult;
  popAt(pos, (label ? label + ' ' : '') + '+' + pts * mult + (mult > 1 ? ' ×' + mult : ''), cls, mult > 1);
  AU.fx.pop(Math.min(6, S.combo[shot] || 0));
}

// ------------------------------------------------------------ end of level
function starsFor(win) {
  if (!win) return { n: 0, quiet: false, spare: false };
  const quiet = S.babaState === 'sleep' || S.noiseMax < 0.45;
  const spare = S.stonesLeft >= S.L.spare;
  return { n: 1 + (quiet ? 1 : 0) + (spare ? 1 : 0), quiet, spare };
}
function endLevel(why) {
  if (S.over) return;
  S.over = true; S.playing = false; S.timeScale = 1;
  $('count').classList.remove('on'); hideHint(); AU.setSnore(0);
  const win = why === 'win';
  const st = starsFor(win);
  if (win) S.score += S.stonesLeft * 50;
  const body = $('resBody');
  if (win) {
    const prev = save.stars[S.lv] || 0; save.stars[S.lv] = Math.max(prev, st.n); save.best[S.lv] = Math.max(save.best[S.lv] || 0, S.score); persist();
    const last = S.lv === LEVELS.length - 1;
    body.innerHTML = `<div class="big">${last ? 'MANGO KING!' : 'LEVEL CLEAR!'}</div>
      <div class="stars"><i></i><i></i><i></i></div>
      <div class="score">${S.score}</div>
      <div class="criteria"><span class="ok">Goals done</span><span class="${st.quiet ? 'ok' : 'no'}">Baba stayed asleep</span><span class="${st.spare ? 'ok' : 'no'}">${S.L.spare}+ stones to spare</span></div>
      <div class="row">${last ? '<button class="btn" id="rShare">POST MY RAID</button>' : '<button class="btn" id="rNext">NEXT RAID</button>'}<button class="btn white" id="rRetry">RETRY</button><button class="btn white small" id="rLevels">LEVELS</button></div>`;
    [...body.querySelectorAll('.stars i')].forEach((s, k) => { if (k < st.n) setTimeout(() => { s.classList.add('on'); AU.fx.star(k); }, 350 + k * 320); });
    if (!last) $('rNext').onclick = () => { AU.fx.click(); startLevel(S.lv + 1); };
    else $('rShare').onclick = share;
  } else {
    const msg = { caught: ['BABA DON CATCH YOU!', 'Too much noise. Baba and his cane no dey play.'], window: ['YOU DON BREAK BABA WINDOW!', 'Ehn! Run!'], seen: ['BABA SEE YOU!', 'Never shoot when Baba is at the window.'], stones: ['OUT OF STONES', 'Go find more stones and try again.'] }[why];
    body.innerHTML = `<img class="face" src="assets/${why === 'stones' ? 'baba-sleep' : 'baba-mad'}.webp" alt=""><div class="big">${msg[0]}</div><div class="msg">${msg[1]}</div>
      <div class="row"><button class="btn" id="rRetry">TRY AGAIN</button><button class="btn white" id="rLevels">LEVELS</button></div>`;
    AU.fx.fail();
  }
  $('rRetry').onclick = () => { AU.fx.click(); startLevel(S.lv); };
  $('rLevels').onclick = () => { AU.fx.click(); goLevels(); };
  setTimeout(() => { if (S.over) { $('hud').classList.remove('on'); $('stones').classList.remove('on'); $('hudPause').style.display = 'none'; showScreen('s-result'); } }, win ? 200 : 600);
}
function share() {
  AU.fx.click();
  const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const text = `I raided Baba's mango tree in MANGO RAID and he never caught me. ${stars}/36 stars 🥭\nmangoraid.nerom.site\n@twigpine #ProjectTreetop`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ text }).catch(() => {});
  else open('https://x.com/intent/post?text=' + encodeURIComponent(text), '_blank');
}

// ------------------------------------------------------------ HUD + screens
const ICON = {
  tin: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="#d9342b" stroke="#3a1d0e" stroke-width="2"/><rect x="5" y="8" width="14" height="8" fill="#f6e7c8" stroke="#3a1d0e" stroke-width="1.5"/></svg>',
  mango: '<svg viewBox="0 0 24 24"><path d="M12 5c5 0 8 4 7 9-1 5-6 7-9 6-4-1-6-5-5-9 1-4 3-6 7-6z" fill="#f2a524" stroke="#3a1d0e" stroke-width="2"/><path d="M12 5c0-2 1-3 3-3" stroke="#3a1d0e" stroke-width="2" fill="none"/></svg>',
};
function buildHud() {
  $('lvName').innerHTML = `LEVEL ${S.lv + 1}<small>${S.L.name}</small>`;
  updateGoals(); updateStones();
  const w = $('wind'); w.classList.toggle('on', !!S.wind);
  if (S.wind) { $('windArrow').style.transform = S.wind < 0 ? 'scaleX(-1)' : ''; $('windTxt').textContent = 'HARMATTAN ' + Math.abs(S.wind).toFixed(1); }
}
function updateGoals() {
  const g = $('goals'); let h = '';
  if (S.goalTins) h += `<span class="chip ${S.tinsDown >= S.goalTins ? 'done' : ''}">${ICON.tin}${Math.min(S.tinsDown, S.goalTins)}/${S.goalTins}</span>`;
  if (S.goalMango) h += `<span class="chip ${S.ripeDown >= S.goalMango ? 'done' : ''}">${ICON.mango}${Math.min(S.ripeDown, S.goalMango)}/${S.goalMango}</span>`;
  if (g.innerHTML !== h) g.innerHTML = h;
}
function updateStones() { const s = $('stones'); s.innerHTML = ''; for (let i = 0; i < S.L.stones; i++) { const e = document.createElement('i'); if (i >= S.stonesLeft) e.className = 'used'; s.appendChild(e); } }
const SCREENS = ['s-title', 's-levels', 's-how', 's-result', 's-pause'];
function showScreen(id) { for (const s of SCREENS) $(s).classList.toggle('on', s === id); $('soundBtn').style.display = (id === 's-title' || id === 's-levels' || id === 's-pause') ? 'flex' : 'none'; }
let bTimer = 0;
function banner(t, s, ms, red) { const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s || ''; b.classList.toggle('red', !!red); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(bTimer); bTimer = setTimeout(() => b.classList.remove('on'), ms); }
function hint(t) { const h = $('hint'); h.textContent = t; h.classList.add('on'); }
function hideHint() { $('hint').classList.remove('on'); }
function popAt(pos, txt, cls = '', big = false) {
  const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(camera);
  const el = document.createElement('div'); el.className = 'pp ' + cls + (big ? ' big' : ''); el.textContent = txt;
  el.style.left = ((v.x + 1) / 2 * innerWidth + rnd(-30, 30)) + 'px'; el.style.top = ((1 - v.y) / 2 * innerHeight - (popStack++ % 3) * 26) + 'px';
  $('pops').appendChild(el); setTimeout(() => el.remove(), 1000);
}
let popStack = 0;
function flash(a) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
function shake(a) { S.shakeT = Math.max(S.shakeT, a); }

function goLevels() {
  S.playing = false; clearLevel(); attractScene();
  const g = $('lvGrid'); g.innerHTML = '';
  const unlocked = Math.min(LEVELS.length - 1, Object.keys(save.stars).length ? Math.max(...Object.keys(save.stars).map(Number)) + 1 : 0);
  LEVELS.forEach((L, i) => {
    const st = save.stars[i] || 0, lock = i > unlocked;
    const b = document.createElement('button'); b.className = 'lv' + (lock ? ' lock' : '') + (i === unlocked && !st ? ' next' : '');
    b.innerHTML = `<b>${lock ? '🔒' : i + 1}</b><span class="st">${lock ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)}</span>`;
    if (!lock) b.onclick = () => { AU.unlock(); AU.fx.click(); startLevel(i); };
    g.appendChild(b);
  });
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $('lvTotal').textContent = '★ ' + total + ' / 36';
  $('hud').classList.remove('on'); $('stones').classList.remove('on'); $('hudPause').style.display = 'none';
  showScreen('s-levels'); AU.setTension(0, false);
}
function attractScene() {
  // a few tins on the wall and mangoes so menus have something behind them
  setLighting(false);
  for (const t of stack(0, [3, 2, 1])) addTin(t.x, t.y, t.z);
  for (const m of [{ x: -1.2, y: 3.6, ripe: 1 }, { x: -0.4, y: 4.3, ripe: 1 }, { x: 0.3, y: 3.5, ripe: 0 }]) addMango(m);
  S.L = { stones: 0 };
}
$('bPlay').onclick = () => { AU.unlock(); AU.music(true); AU.fx.click(); if (!save.seenHow) { save.seenHow = true; persist(); howNext = 'levels'; showScreen('s-how'); } else goLevels(); };
$('bHow').onclick = () => { AU.unlock(); AU.fx.click(); howNext = 'title'; showScreen('s-how'); };
let howNext = 'title';
$('bHowOk').onclick = () => { AU.fx.click(); if (howNext === 'levels') goLevels(); else showScreen('s-title'); };
$('bLvBack').onclick = () => { AU.fx.click(); showScreen('s-title'); };
$('hudPause').onclick = () => pause();
function pause() { if (!S.playing) return; S.paused = true; showScreen('s-pause'); }
$('bResume').onclick = () => { AU.fx.click(); S.paused = false; showScreen(null); };
$('bRestart').onclick = () => { AU.fx.click(); startLevel(S.lv); };
$('bQuit').onclick = () => { AU.fx.click(); goLevels(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function paintSound() {
  $('soundBtn').innerHTML = AU.isMuted()
    ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a1d0e"/><path d="M16 9l5 6M21 9l-5 6" stroke="#3a1d0e" stroke-width="2.4" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a1d0e"/><path d="M16 8.5c1.6 1.8 1.6 5.2 0 7M18.6 6c3 3.2 3 8.8 0 12" stroke="#3a1d0e" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';
}
$('soundBtn').onclick = () => { AU.unlock(); AU.setMuted(!AU.isMuted()); paintSound(); AU.music(true); };

// ------------------------------------------------------------ catapult overlay + aiming
const ov = $('ov'), oc = ov.getContext('2d');
let W = 0, H = 0, DPR = 1;
const IMG = {};
const loadImg = (k, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = r; i.src = src; });
const aim = { active: false, id: null, sx: 0, sy: 0, x: 0, y: 0, t: 0, snap: 0, vib: 0, lastCreak: 0 };
function catGeom() {
  // left hand + fork placed so the fork crotch sits at the bottom centre
  const ih = Math.min(H * 0.42, W * 0.95), iw = ih * 900 / 968;
  const crotchX = W / 2, imgX = crotchX - iw * 0.7, imgY = H - ih * 0.7;
  const tipL = { x: imgX + iw * 0.5, y: imgY + ih * 0.088 }, tipR = { x: imgX + iw * 0.9, y: imgY + ih * 0.083 };
  const rest = { x: (tipL.x + tipR.x) / 2, y: tipL.y + ih * 0.05 };
  const maxPull = Math.min(H * 0.3, ih * 0.75);
  return { ih, iw, imgX, imgY, tipL, tipR, rest, maxPull };
}
function reticle() {
  const g = catGeom();
  let dx = aim.x - aim.sx, dy = aim.y - aim.sy; const l = Math.hypot(dx, dy); if (l > g.maxPull) { dx *= g.maxPull / l; dy *= g.maxPull / l; }
  // aim uses each axis on its own, so a diagonal pull doesn't cost height
  const ax = clamp(aim.x - aim.sx, -g.maxPull, g.maxPull), ay = clamp(aim.y - aim.sy, -g.maxPull * 0.5, g.maxPull);
  const home = aimHome(), p0 = 0.35, p = ay / g.maxPull;
  let ry;
  if (p <= p0) ry = home.y + (p0 - p) * g.maxPull * 1.2;      // a medium straight pull lands on the tins
  else {                                                     // past that it speeds up so a full pull reaches the treetop
    const q = (p - p0) / (1 - p0), span = home.y - H * 0.09;
    ry = home.y - span * (0.45 * q + 0.55 * q * q);
  }
  let rx = home.x - ax * 1.25;
  // arm shake if held too long
  const sh = clamp((aim.t - 1.2) / 2, 0, 1) * Math.min(W, H) * 0.06;
  const tt = performance.now() / 1000;
  rx += Math.sin(tt * 7.1) * sh + Math.sin(tt * 3.3) * sh * 0.5; ry += Math.cos(tt * 6.3) * sh * 0.8;
  return { rx: clamp(rx, 10, W - 10), ry: clamp(ry, 10, H - 10), dx, dy, pull: Math.hypot(dx, dy) / g.maxPull };
}
function aimHome() {
  const v = new THREE.Vector3(0, CAP_TOP + 0.2, TIN_Z).project(camera);
  return { x: W / 2, y: (1 - v.y) / 2 * H };
}
function drawOverlay(dt) {
  oc.setTransform(DPR, 0, 0, DPR, 0, 0); oc.clearRect(0, 0, W, H);
  if (!S.playing || !IMG.lhand) return;
  const g = catGeom();
  let px = g.rest.x, py = g.rest.y, pull = 0, ret = null;
  if (aim.active) { ret = reticle(); pull = ret.pull; px = g.rest.x + ret.dx; py = Math.min(g.rest.y + ret.dy, H - g.ih * 0.2); }
  if (aim.snap > 0) { aim.snap -= dt; }
  aim.vib = Math.max(0, aim.vib - dt * 3);
  const vib = Math.sin(performance.now() / 18) * aim.vib * 14;
  // left hand with fork
  oc.drawImage(IMG.lhand, g.imgX, g.imgY, g.iw, g.ih);
  // bands
  const rs = lerp(0.8, 1.0, pull) * g.ih * 0.95;     // right hand gets bigger as it comes back toward you
  const pouchL = { x: px - rs * 0.13, y: py + rs * 0.03 }, pouchR = { x: px + rs * 0.1, y: py - rs * 0.02 };
  const showHand = aim.active;
  const band = (tip, end, w) => { oc.strokeStyle = '#7a1f17'; oc.lineWidth = w + 3; oc.lineCap = 'round'; oc.beginPath(); oc.moveTo(tip.x, tip.y); oc.quadraticCurveTo((tip.x + end.x) / 2 + vib, (tip.y + end.y) / 2 + vib, end.x, end.y); oc.stroke(); oc.strokeStyle = '#d9473a'; oc.lineWidth = w; oc.stroke(); };
  const bw = lerp(9, 4.5, pull) * g.ih / 380;
  if (showHand && (aim.active || aim.snap <= 0)) {
    band(g.tipL, pouchL, bw); band(g.tipR, pouchR, bw);
    // pouch + stone sit in the right hand image
    const hw = rs, hh = rs * 685 / 700;
    oc.drawImage(IMG.rhand, px - hw * 0.186, py - hh * 0.233, hw, hh);
  } else if (aim.snap > 0) {
    // just fired: bands snap forward through the fork
    band(g.tipL, { x: g.rest.x, y: g.tipL.y - g.ih * 0.03 }, bw); band(g.tipR, { x: g.rest.x, y: g.tipR.y - g.ih * 0.03 }, bw);
  } else {
    // at rest the empty pouch hangs between the prongs
    const sag = { x: g.rest.x + vib * 0.3, y: g.rest.y + g.ih * 0.1 };
    band(g.tipL, { x: sag.x - 10, y: sag.y }, bw); band(g.tipR, { x: sag.x + 10, y: sag.y }, bw);
    oc.fillStyle = '#7a4a2a'; oc.strokeStyle = '#3a1d0e'; oc.lineWidth = 2; oc.beginPath(); oc.ellipse(sag.x, sag.y, 16 * g.ih / 380, 9 * g.ih / 380, 0, 0, 7); oc.fill(); oc.stroke();
  }
  if (ret) {
    const r = Math.min(W, H) * 0.035;
    oc.lineWidth = 3; oc.strokeStyle = 'rgba(58,29,14,0.85)'; oc.beginPath(); oc.arc(ret.rx, ret.ry, r + 1.5, 0, 7); oc.stroke();
    oc.strokeStyle = '#fff'; oc.lineWidth = 2.5; oc.beginPath(); oc.arc(ret.rx, ret.ry, r, 0, 7); oc.stroke();
    oc.beginPath(); oc.moveTo(ret.rx - r * 1.6, ret.ry); oc.lineTo(ret.rx - r * 0.5, ret.ry); oc.moveTo(ret.rx + r * 0.5, ret.ry); oc.lineTo(ret.rx + r * 1.6, ret.ry);
    oc.moveTo(ret.rx, ret.ry - r * 1.6); oc.lineTo(ret.rx, ret.ry - r * 0.5); oc.moveTo(ret.rx, ret.ry + r * 0.5); oc.lineTo(ret.rx, ret.ry + r * 1.6); oc.stroke();
    oc.fillStyle = '#ff5a3c'; oc.beginPath(); oc.arc(ret.rx, ret.ry, 3, 0, 7); oc.fill();
  }
}
ov.style.pointerEvents = 'none';
gl.addEventListener('pointerdown', e => {
  AU.unlock();
  if (!S.playing || S.paused || S.stonesLeft <= 0 || aim.active) return;
  aim.active = true; aim.id = e.pointerId; aim.sx = aim.x = e.clientX; aim.sy = aim.y = e.clientY; aim.t = 0;
  try { gl.setPointerCapture(e.pointerId); } catch (_) {}
  AU.fx.creak(0.2);
});
gl.addEventListener('pointermove', e => {
  if (!aim.active || e.pointerId !== aim.id) return;
  aim.x = e.clientX; aim.y = e.clientY;
  const r = reticle(); if (Math.abs(r.pull - aim.lastCreak) > 0.08) { aim.lastCreak = r.pull; AU.fx.creak(r.pull); }
});
function release(e) {
  if (!aim.active || e.pointerId !== aim.id) return;
  aim.active = false;
  const r = reticle();
  if (r.pull < 0.08) return;     // a tap: no shot
  aim.snap = 0.25; aim.vib = 1;
  fire(r.rx / W * 2 - 1, -(r.ry / H * 2 - 1));
}
gl.addEventListener('pointerup', release); gl.addEventListener('pointercancel', release);

// ------------------------------------------------------------ resize + loop
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  ov.width = Math.round(W * DPR); ov.height = Math.round(H * DPR);
  camera.aspect = W / H; camera.fov = W / H < 0.8 ? 68 : W / H < 1.3 ? 60 : 50; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (aim.active) aim.t += dt;
  step(dt);
  stepParts(dt * (S.timeScale || 1));
  AU.frame(dt);
  // camera shake
  camera.quaternion.copy(baseQuat);
  if (S.shakeT > 0) { S.shakeT = Math.max(0, S.shakeT - dt); const a = S.shakeT * 0.05; camera.rotateX(rnd(-a, a)); camera.rotateY(rnd(-a, a)); }
  renderer.render(scene, camera);
  drawOverlay(dt);
  requestAnimationFrame(loop);
}

(async function boot() {
  resize(); paintSound(); buildLabels();
  await Promise.all([
    loadTex('backdrop', 'assets/backdrop.jpg'), loadTex('house', 'assets/house.webp'), loadTex('tree', 'assets/tree.webp'),
    loadTex('babaWalk', 'assets/baba-walk.webp'), loadTex('babaSus', 'assets/baba-sus.webp'), loadTex('babaMad', 'assets/baba-mad.webp'),
    loadImg('lhand', 'assets/lhand.webp'), loadImg('rhand', 'assets/rhand.webp'),
    document.fonts ? document.fonts.load('30px "Lilita One"') : 0,
  ]);
  buildSet(); attractScene();
  requestAnimationFrame(t => { last = t; loop(t); });
})();

window.__m = { ndc: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [v.x, v.y]; }, S, LEVELS, startLevel, fire, world, camera, endLevel, save };
