// script.js — type="module" in HTML
import * as THREE from 'three';

// ── Scene ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020408);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ── Constants ──────────────────────────────────────────────────────────────
const STEM_HEIGHT_MAX = 3.5;  // geometry ceiling — per-flower height is random below this
const STEM_BASE_Y     = -1.8;
const GROW_DURATION   = 2.5;
const BLOOM_START     = 2.0;
const BLOOM_DURATION  = 1.5;

// ── Shared geometry ────────────────────────────────────────────────────────
// Stem at max possible height; shorter flowers just clamp vertices lower
const stemGeo = new THREE.CylinderGeometry(0.018, 0.032, STEM_HEIGHT_MAX, 8, 32);
stemGeo.translate(0, STEM_HEIGHT_MAX / 2, 0);

// Petal plane: UV covers ±0.75 (scale 1.5) so large petals never clip
// PlaneGeometry size = 1.4 * 1.5 = 2.1 keeps world-space petal size identical
const petalGeo = new THREE.PlaneGeometry(2.1, 2.1);

// ── Mouse world position ───────────────────────────────────────────────────
let mouseWorldX = 0, mouseWorldY = 0, mouseNdcX = 0, mouseNdcY = 0;
window.addEventListener('mousemove', (e) => {
  const ndcX =  (e.clientX / innerWidth)  * 2 - 1;
  const ndcY = -(e.clientY / innerHeight) * 2 + 1;
  mouseNdcX = ndcX;
  mouseNdcY = ndcY;
  const halfTan = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
  mouseWorldX = ndcX * halfTan * camera.aspect;
  mouseWorldY = ndcY * halfTan;
});

let currentCamX = 0, currentCamY = 0;

// ── Shared shader sources ──────────────────────────────────────────────────
const STEM_VERT = /* glsl */`
  uniform float uGrowth;
  uniform float uStemHeight;
  uniform float uTime;
  uniform float uLean;
  uniform float uYLean;
  uniform float uWindPhase;
  varying float vT;
  void main() {
    vec3 pos = position;
    pos.y = min(pos.y, uGrowth * uStemHeight);
    vT = pos.y / uStemHeight;
    float t2 = vT * vT;
    pos.x += sin(vT * 1.3) * 0.07 * t2;
    pos.x += (sin(uTime * 0.8 + uWindPhase) * 0.06 + sin(uTime * 1.9 + uWindPhase * 1.3 + 0.5) * 0.025) * t2;
    pos.x += uLean * t2;
    pos.y += uYLean * t2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const STEM_FRAG = /* glsl */`
  varying float vT;
  void main() {
    vec3 col = mix(vec3(0.04, 0.22, 0.12), vec3(0.12, 0.55, 0.32), vT);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PETAL_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PETAL_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform float uBloom;
  uniform float uTime;
  uniform int   uPetalCount;
  uniform vec3  uColorCore;
  uniform vec3  uColorTip;
  uniform float uPetalLen;
  uniform float uPetalWidth;
  uniform float uPetalOffset;

  const float TAU = 6.28318530;

  float petalDist(vec2 p, float angle, float bloom) {
    float c = cos(angle), s = sin(angle);
    vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
    vec2 e = q - vec2(uPetalOffset * bloom, 0.0);
    return length(e / vec2(uPetalLen * bloom, uPetalWidth * bloom)) - 1.0;
  }

  float elasticOut(float t) {
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    return pow(2.0, -8.0 * t) * sin((t * 8.0 - 0.75) * 1.3963) + 1.0;
  }

  void main() {
    // UV scaled to ±0.75 — large petals no longer clip at ±0.5
    vec2  uv = (vUv - 0.5) * 1.5;
    float n  = float(uPetalCount);
    float d  = 1e9;

    for (int i = 0; i < 10; i++) {
      if (i >= uPetalCount) break;
      float stagger = float(i) / max(n - 1.0, 1.0) * 0.25;
      float pb = elasticOut(clamp((uBloom - stagger) / 0.75, 0.0, 1.0));
      d = min(d, petalDist(uv, float(i) * TAU / n, pb));
    }

    d = min(d, length(uv) - 0.045 * smoothstep(0.75, 1.0, uBloom));

    float r   = length(uv);
    vec3  col = mix(uColorCore, uColorTip, smoothstep(0.0, 0.35, r));
    col = mix(vec3(1.0, 0.95, 1.0), col, smoothstep(0.0, 0.08, r));

    float fill  = smoothstep(0.008, -0.008, d);
    float glow  = exp(-max(d, 0.0) * 18.0) * 0.5;
    float alpha = fill * 0.92 + glow * (1.0 - fill);

    if (alpha < 0.005) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Colour helpers ─────────────────────────────────────────────────────────
function hslVec3(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  const i = Math.floor(h * 6) % 6;
  const t = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][i];
  return new THREE.Vector3(t[0]+m, t[1]+m, t[2]+m);
}

function randomColor() {
  // Full hue spectrum, high saturation — any colour looks vivid on a dark bg
  return hslVec3(Math.random(), 0.8 + Math.random() * 0.2, 0.5 + Math.random() * 0.2);
}

// ── Flower factory ─────────────────────────────────────────────────────────
const flowers = [];

function createFlower(worldX, worldZ, birthTime) {
  const stemHeight  = 1.0 + Math.random() * 2.0;       // 1.0–3.0
  const petalCount  = Math.floor(Math.random() * 5) + 4; // 4–8
  const petalLen    = 0.15 + Math.random() * 0.12;
  const petalWidth  = 0.04  + Math.random() * 0.05;
  const petalOffset = petalLen * (0.8 + Math.random() * 0.3);
  const windPhase   = Math.random() * Math.PI * 2;

  const su = {
    uGrowth:     { value: 0.0 },
    uStemHeight: { value: stemHeight },
    uTime:       { value: 0.0 },
    uLean:       { value: 0.0 },
    uYLean:      { value: 0.0 },
    uWindPhase:  { value: windPhase },
  };
  const sMesh = new THREE.Mesh(stemGeo, new THREE.ShaderMaterial({
    uniforms: su, vertexShader: STEM_VERT, fragmentShader: STEM_FRAG,
    side: THREE.DoubleSide,
  }));
  sMesh.position.set(worldX, STEM_BASE_Y, worldZ);
  scene.add(sMesh);

  const pu = {
    uBloom:       { value: 0.0 },
    uTime:        { value: 0.0 },
    uPetalCount:  { value: petalCount },
    uColorCore:   { value: randomColor() },
    uColorTip:    { value: randomColor() },
    uPetalLen:    { value: petalLen },
    uPetalWidth:  { value: petalWidth },
    uPetalOffset: { value: petalOffset },
  };
  const pMesh = new THREE.Mesh(petalGeo, new THREE.ShaderMaterial({
    uniforms: pu, vertexShader: PETAL_VERT, fragmentShader: PETAL_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  pMesh.position.z = worldZ + 0.1;
  scene.add(pMesh);

  flowers.push({ sMesh, pMesh, su, pu, birthTime, windPhase, x: worldX, z: worldZ, stemHeight,
    currentLean: 0, currentYLean: 0 });
}

// ── Screen x → world x at a given Z depth ─────────────────────────────────
function worldXFromClick(clientX, worldZ) {
  const ndcX = (clientX / innerWidth) * 2 - 1;
  const dist = camera.position.z - worldZ;
  return ndcX * Math.tan(camera.fov * Math.PI / 360) * dist * camera.aspect;
}

window.addEventListener('click', (e) => {
  const worldZ = Math.random() * 10 - 8;  // -8 (background) to 2 (foreground)
  createFlower(worldXFromClick(e.clientX, worldZ), worldZ, performance.now() / 1000);
});

// ── Animation loop ─────────────────────────────────────────────────────────
let initialized = false;

renderer.setAnimationLoop((ms) => {
  resizeIfNeeded();
  const t = ms / 1000;

  if (!initialized) {
    initialized = true;
    createFlower(0, 0, t);
  }

  for (const f of flowers) {
    const elapsed = t - f.birthTime;
    const growth  = Math.min(elapsed / GROW_DURATION, 1.0);

    // React to mouse — 2D distance to petal head, fluid spring on both axes
    const dx      = f.pMesh.position.x - mouseWorldX;
    const dy      = f.pMesh.position.y - mouseWorldY;
    const falloff = Math.exp(-(dx * dx + dy * dy) * 0.4);

    const zScale      = (f.z + 3) / 4;  // 0 at z=-3 (background), 1 at z=1 (foreground)
    const targetLean  = Math.tanh(dx * 2.5) * falloff * 0.45 * zScale;
    const targetYLean = Math.tanh(dy * 2.5) * falloff * 0.25 * zScale;

    f.currentLean  += (targetLean  - f.currentLean)  * 0.05;
    f.currentYLean += (targetYLean - f.currentYLean) * 0.04;

    f.su.uGrowth.value  = growth;
    f.su.uTime.value    = t;
    f.su.uLean.value    = f.currentLean;
    f.su.uYLean.value   = f.currentYLean;

    f.pu.uBloom.value = Math.min(Math.max(elapsed - BLOOM_START, 0) / BLOOM_DURATION, 1.0);
    f.pu.uTime.value  = t;

    // Mirror tip position from vertex shader (vT = growth at frontier)
    const g2   = growth * growth;
    const wind = Math.sin(t * 0.8 + f.windPhase) * 0.06
               + Math.sin(t * 1.9 + f.windPhase * 1.3 + 0.5) * 0.025;
    const arc  = Math.sin(growth * 1.3) * 0.07;
    const stemTipX = f.x + (arc + wind + f.currentLean) * g2;
    const stemTipY = STEM_BASE_Y + f.stemHeight * growth + f.currentYLean * g2;
    // Petal sits 0.1 units closer to camera than the stem tip — compensate so
    // it projects to the same screen position despite the z offset.
    const depthRatio = (camera.position.z - f.z - 0.1) / (camera.position.z - f.z);
    f.pMesh.position.x = stemTipX * depthRatio;
    f.pMesh.position.y = camera.position.y + (stemTipY - camera.position.y) * depthRatio;
  }

  currentCamX += (mouseNdcX * 1.5 - currentCamX) * 0.04;
  currentCamY += (mouseNdcY * 1.5 - currentCamY) * 0.04;
  camera.position.x = currentCamX;
  camera.position.y = currentCamY;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
});

function resizeIfNeeded() {
  const canvas = renderer.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
