// NEXORA — the living organism (Three.js).
// Instanced billboard neurons + two cross-fading synapse layers, all lit by
// custom shaders (no post-processing): glow, travelling signals, birth flashes,
// stimulus waves and pointer attention are computed on the GPU.
import * as THREE from 'three';
import { CAPS, activeEdges, hops } from './topology.js';

const GLSL_COLORS = /* glsl */ `
const vec3 NX_CYAN = vec3(0.161, 0.890, 0.949);
const vec3 NX_UV = vec3(0.478, 0.302, 1.0);
const vec3 NX_BONE = vec3(0.906, 0.914, 0.933);
`;

const NODE_VERT = /* glsl */ `
${GLSL_COLORS}
attribute vec3 aOffset;
attribute float aScale;
attribute float aHue;
attribute float aBirth;
attribute float aHop;
attribute float aSeed;
uniform float uTime;
uniform float uClock;
uniform float uStim;
uniform float uSize;
uniform float uFocus;
uniform vec3 uPointer;
uniform float uPointerOn;
uniform vec3 uAccent;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vHot;
void main() {
  vec4 world = modelMatrix * vec4(aOffset, 1.0);
  float age = uClock - aBirth;
  float grown = smoothstep(0.0, 1.0, age / 0.9);
  float flash = step(0.0, age) * exp(-max(age, 0.0) * 2.4);
  float stim = 0.0;
  if (aHop < 900.0) {
    float since = uClock - uStim;
    float dt = since - aHop * 0.07;
    stim = exp(-dt * dt * 70.0) + 0.3 * step(0.0, dt) * exp(-max(dt, 0.0) * 1.4) * exp(-max(since, 0.0) * 0.5);
  }
  float att = uPointerOn * (1.0 - smoothstep(0.0, 1.5, distance(world.xyz, uPointer)));
  float tw = 0.82 + 0.18 * sin(uTime * (1.3 + aSeed) + aSeed * 50.0);
  float s = aScale * uSize * grown * tw * (1.0 + stim * 1.4 + att * 0.9 + flash * 1.6);
  vec4 mv = viewMatrix * world;
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0;
  vec3 c = mix(NX_CYAN, NX_UV, aHue);
  c = mix(c, uAccent, 0.28);
  float hot = clamp(stim + att * 0.55 + flash, 0.0, 1.0);
  vColor = mix(c, NX_BONE, hot * 0.7);
  vHot = hot;
  float depth = -mv.z;
  vAlpha = (0.22 + 0.78 * (1.0 - smoothstep(uFocus - 3.0, uFocus + 6.5, depth))) * grown;
}
`;

const NODE_FRAG = /* glsl */ `
${GLSL_COLORS}
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vHot;
void main() {
  float d = length(vUv);
  if (d > 1.0) discard;
  float core = (1.0 - smoothstep(0.0, 0.24, d));
  float halo = pow(1.0 - d, 2.6) * 0.5;
  float ring = (1.0 - smoothstep(0.0, 0.035, abs(d - 0.46))) * 0.35 * vHot;
  vec3 col = vColor * (halo + core * 0.9 + ring) + NX_BONE * core * 0.55;
  gl_FragColor = vec4(col * vAlpha, 1.0);
}
`;

const LINE_VERT = /* glsl */ `
${GLSL_COLORS}
attribute float aT;
attribute float aPhase;
attribute float aBirth;
attribute float aHop;
uniform float uClock;
uniform float uFocus;
uniform vec3 uPointer;
uniform float uPointerOn;
varying float vT;
varying float vPhase;
varying float vHop;
varying float vFade;
varying float vAtt;
varying vec3 vCol;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vT = aT;
  vPhase = aPhase;
  vHop = aHop;
  float grown = smoothstep(0.0, 1.0, (uClock - aBirth) / 1.0);
  float depth = -mv.z;
  vFade = grown * (0.18 + 0.82 * (1.0 - smoothstep(uFocus - 3.0, uFocus + 6.5, depth)));
  vCol = mix(NX_CYAN, NX_UV, smoothstep(-3.5, 3.5, world.x * 0.8 + world.y * 0.6));
  vAtt = uPointerOn * (1.0 - smoothstep(0.0, 1.4, distance(world.xyz, uPointer)));
}
`;

const LINE_FRAG = /* glsl */ `
${GLSL_COLORS}
uniform float uTime;
uniform float uClock;
uniform float uStim;
uniform float uOpacity;
uniform float uBoost;
uniform vec3 uAccent;
varying float vT;
varying float vPhase;
varying float vHop;
varying float vFade;
varying float vAtt;
varying vec3 vCol;
void main() {
  float carrier = step(0.7, fract(vPhase * 13.7));
  float travel = fract(uTime * (0.16 + 0.22 * fract(vPhase * 7.3)) + vPhase);
  float pulse = carrier * (1.0 - smoothstep(0.0, 0.09, abs(vT - travel)));
  float stim = 0.0;
  if (vHop < 900.0) {
    float dt = (uClock - uStim) - vHop * 0.07;
    stim = exp(-dt * dt * 90.0);
  }
  vec3 col = mix(vCol, uAccent, 0.25);
  col = mix(col, NX_BONE, clamp(stim * 0.6 + pulse * 0.3, 0.0, 1.0));
  float a = (0.085 * uBoost) + pulse * 0.55 + stim * 0.85 + vAtt * 0.22;
  gl_FragColor = vec4(col * a * vFade * uOpacity, 1.0);
}
`;

const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uPx;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.05 + aSeed * 20.0) * 0.35;
  p.y += cos(uTime * 0.04 + aSeed * 13.0) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (0.6 + aSeed) * 7.0 / max(1.0, -mv.z);
  vA = 0.32 * (1.0 - smoothstep(4.0, 34.0, -mv.z));
}
`;

const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float f = (1.0 - d) * (1.0 - d);
  gl_FragColor = vec4(vec3(0.55, 0.72, 0.95) * f * vA, 1.0);
}
`;

const ACCENTS = {
  organism: '#5fb4f6',
  agents: '#29e3f2',
  automation: '#4f8dff',
  perception: '#bff3ff',
  reasoning: '#9a7bff',
};

// Where the organism sits for each page stage, as fractions of the visible half-width/height.
const STAGES = {
  hero: { dx: 0.22, dy: 0.0, mdx: 0, mdy: -0.08, s: 1 },
  capabilities: { dx: 0.4, dy: 0.0, mdx: 0, mdy: 0.22, s: 1.06 },
  access: { dx: 0.44, dy: -0.02, mdx: 0, mdy: 0.2, s: 0.92 },
};

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createOrganism(canvas, opts) {
  const { topologies, N, reduced, mobile, onChange } = opts;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  let dprCap = mobile ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x0b0d10, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  const group = new THREE.Group();
  scene.add(group);

  const shared = {
    uTime: { value: 0 },
    uClock: { value: 0 },
    uStim: { value: -100 },
    uSize: { value: 1 },
    uFocus: { value: 9 },
    uPointer: { value: new THREE.Vector3(0, 0, 0) },
    uPointerOn: { value: 0 },
    uAccent: { value: new THREE.Color(ACCENTS.organism) },
    uBoost: { value: 1 },
  };

  /* ---------- state ---------- */
  let topo = topologies.organism;
  let topoKey = 'organism';
  let active = 0;
  const births = new Float32Array(N).fill(1e6);
  const basePos = new Float32Array(N * 3);
  const fromPos = new Float32Array(N * 3);
  const fromScale = new Float32Array(N);
  const fromHue = new Float32Array(N);
  const delay = new Float32Array(N);
  const swirl = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  const hopArr = new Float32Array(N).fill(999);
  const renderPos = new Float32Array(N * 3);
  const scaleArr = new Float32Array(N);
  const hueArr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    seeds[i] = Math.random();
    const a = Math.random() * Math.PI * 2, b = Math.random() * 2 - 1, s = Math.sqrt(1 - b * b);
    swirl[i * 3] = Math.cos(a) * s;
    swirl[i * 3 + 1] = b;
    swirl[i * 3 + 2] = Math.sin(a) * s;
  }
  basePos.set(topo.pos);
  scaleArr.set(topo.scale);
  hueArr.set(topo.hue);

  /* ---------- neurons: instanced billboards ---------- */
  const quad = new THREE.PlaneGeometry(1, 1);
  const nodeGeo = new THREE.InstancedBufferGeometry();
  nodeGeo.index = quad.index;
  nodeGeo.setAttribute('position', quad.getAttribute('position'));
  const aOffset = new THREE.InstancedBufferAttribute(renderPos, 3).setUsage(THREE.DynamicDrawUsage);
  const aScale = new THREE.InstancedBufferAttribute(scaleArr, 1).setUsage(THREE.DynamicDrawUsage);
  const aHue = new THREE.InstancedBufferAttribute(hueArr, 1).setUsage(THREE.DynamicDrawUsage);
  const aBirth = new THREE.InstancedBufferAttribute(births, 1).setUsage(THREE.DynamicDrawUsage);
  const aHop = new THREE.InstancedBufferAttribute(hopArr, 1).setUsage(THREE.DynamicDrawUsage);
  const aSeed = new THREE.InstancedBufferAttribute(seeds, 1);
  nodeGeo.setAttribute('aOffset', aOffset);
  nodeGeo.setAttribute('aScale', aScale);
  nodeGeo.setAttribute('aHue', aHue);
  nodeGeo.setAttribute('aBirth', aBirth);
  nodeGeo.setAttribute('aHop', aHop);
  nodeGeo.setAttribute('aSeed', aSeed);
  nodeGeo.instanceCount = 0;
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const nodes = new THREE.Mesh(nodeGeo, nodeMat);
  nodes.frustumCulled = false;
  nodes.renderOrder = 2;
  group.add(nodes);

  /* ---------- synapses: two layers that cross-fade on re-wire ---------- */
  let maxE = 0;
  for (const k of CAPS) maxE = Math.max(maxE, topologies[k].edgeCount);
  function makeLayer() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(maxE * 6);
    const t = new Float32Array(maxE * 2);
    const ph = new Float32Array(maxE * 2);
    const bi = new Float32Array(maxE * 2);
    const hp = new Float32Array(maxE * 2).fill(999);
    for (let e = 0; e < maxE; e++) {
      t[e * 2] = 0;
      t[e * 2 + 1] = 1;
    }
    const attrs = {
      position: new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage),
      aT: new THREE.BufferAttribute(t, 1),
      aPhase: new THREE.BufferAttribute(ph, 1),
      aBirth: new THREE.BufferAttribute(bi, 1).setUsage(THREE.DynamicDrawUsage),
      aHop: new THREE.BufferAttribute(hp, 1).setUsage(THREE.DynamicDrawUsage),
    };
    for (const [name, a] of Object.entries(attrs)) g.setAttribute(name, a);
    g.setDrawRange(0, 0);
    const uOpacity = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...shared, uOpacity },
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const obj = new THREE.LineSegments(g, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 1;
    group.add(obj);
    return { obj, g, attrs, uOpacity, opacity: 0, target: 0, topo: null, count: 0 };
  }
  const layers = [makeLayer(), makeLayer()];
  let curLayer = 0;

  function fillLayerStatic(L, t) {
    L.topo = t;
    const ph = L.attrs.aPhase.array;
    const hp = L.attrs.aHop.array;
    for (let e = 0; e < t.edgeCount; e++) {
      const v = Math.random();
      ph[e * 2] = v;
      ph[e * 2 + 1] = v;
    }
    hp.fill(999);
    L.attrs.aPhase.needsUpdate = true;
    L.attrs.aHop.needsUpdate = true;
    fillLayerBirth(L);
  }
  function fillLayerBirth(L) {
    const t = L.topo;
    if (!t) return;
    const bi = L.attrs.aBirth.array;
    for (let e = 0; e < t.edgeCount; e++) {
      const v = Math.max(births[t.edges[e * 2]], births[t.edges[e * 2 + 1]]);
      bi[e * 2] = v;
      bi[e * 2 + 1] = v;
    }
    L.attrs.aBirth.needsUpdate = true;
    L.count = activeEdges(t, active);
    L.g.setDrawRange(0, L.count * 2);
  }
  function fillLayerHops(L) {
    const t = L.topo;
    if (!t) return;
    const hp = L.attrs.aHop.array;
    for (let e = 0; e < t.edgeCount; e++) {
      hp[e * 2] = hopArr[t.edges[e * 2]];
      hp[e * 2 + 1] = hopArr[t.edges[e * 2 + 1]];
    }
    L.attrs.aHop.needsUpdate = true;
  }

  /* ---------- dust ---------- */
  const dustCount = mobile ? 220 : 520;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const r = 3.5 + Math.random() * 11;
    const a = Math.random() * Math.PI * 2, b = Math.random() * 2 - 1, s = Math.sqrt(1 - b * b);
    dustPos[i * 3] = Math.cos(a) * s * r * 1.4;
    dustPos[i * 3 + 1] = b * r * 0.8;
    dustPos[i * 3 + 2] = Math.sin(a) * s * r - 3;
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustUniforms = { uTime: shared.uTime, uPx: { value: dpr * 6 } };
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      uniforms: dustUniforms,
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- clocks & motion state ---------- */
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  let ambient = !reduced;
  let ambientTime = 0;
  let migrating = false;
  let migStart = 0;
  let migDur = 1.5;
  let growingUntil = 0;
  let wakeUntil = 0;
  let nextAutoStim = 4;
  let pendingStim = -1;
  let running = true;
  let rafId = 0;
  let lastFrame = 0;

  const stageTarget = new THREE.Vector3();
  let stageScale = 1;
  let stageName = 'hero';
  let rotAuto = 0;
  let rotOffset = 0;
  let rotOffsetTarget = 0;
  let tilt = 0, tiltTarget = 0, yaw = 0, yawTarget = 0;
  let pointerOnTarget = 0;
  let dragging = false;
  let halfW = 5, halfH = 3, focus = 9;

  /* ---------- layout ---------- */
  const TAN = Math.tan(THREE.MathUtils.degToRad(20));
  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    focus = Math.max(9, 3.0 / (TAN * aspect * 1.1));
    camera.aspect = aspect;
    camera.position.set(0, 0, focus);
    camera.updateProjectionMatrix();
    halfH = focus * TAN;
    halfW = halfH * aspect;
    shared.uFocus.value = focus;
    shared.uSize.value = 1.35 * (1 + (focus / 9 - 1) * 0.45);
    shared.uBoost.value = dpr > 1.4 ? 1.45 : 1;
    applyStage(true);
    kick(0.1);
  }
  function applyStage(snap) {
    const st = STAGES[stageName] || STAGES.hero;
    const wide = camera.aspect > 1.05;
    stageTarget.set((wide ? st.dx : st.mdx) * halfW, (wide ? st.dy : st.mdy) * halfH, 0);
    stageScale = st.s;
    if (snap || reduced) {
      group.position.copy(stageTarget);
      group.scale.setScalar(stageScale);
    }
  }

  /* ---------- growth ---------- */
  function setActive(target, span) {
    target = Math.max(1, Math.min(N, target));
    const t = now();
    if (target > active) {
      const n = target - active;
      for (let i = active; i < target; i++) {
        births[i] = reduced ? t - 10 : t + 0.15 + ((i - active) / n) * span;
      }
      growingUntil = t + span + 1.6;
    } else {
      for (let i = target; i < N; i++) births[i] = 1e6;
    }
    active = target;
    nodeGeo.instanceCount = active;
    aBirth.needsUpdate = true;
    for (const L of layers) fillLayerBirth(L);
    kick(reduced ? 0.2 : span + 2);
    emit();
  }

  /* ---------- re-wiring ---------- */
  function setTopology(key, { instant = false } = {}) {
    if (!topologies[key]) return;
    if (key === topoKey && layers[curLayer].topo) return;
    const next = topologies[key];
    const t = now();
    fromPos.set(basePos);
    fromScale.set(scaleArr);
    fromHue.set(hueArr);
    topo = next;
    topoKey = key;
    const fast = instant || reduced;
    migDur = fast ? (instant ? 0.001 : 0.7) : 1.5;
    migStart = t;
    for (let i = 0; i < N; i++) delay[i] = fast ? 0 : next.rad[i] * 0.7 + seeds[i] * 0.25;
    migrating = true;
    // choose the dimmer synapse layer for the new wiring
    const ni = layers[0].opacity <= layers[1].opacity ? 0 : 1;
    const L = layers[ni];
    fillLayerStatic(L, next);
    L.target = 1;
    layers[1 - ni].target = 0;
    if (instant) {
      L.opacity = 1;
      layers[1 - ni].opacity = 0;
    }
    curLayer = ni;
    shared.uAccent.value.set(ACCENTS[key]);
    hopArr.fill(999);
    aHop.needsUpdate = true;
    if (!reduced && !instant) pendingStim = t + migDur + 0.95;
    kick(migDur + 1.4);
    emit();
  }

  /* ---------- stimulus ---------- */
  function stimulateNode(i) {
    if (i < 0 || i >= active) return;
    hops(topo, i, active, hopArr);
    aHop.needsUpdate = true;
    fillLayerHops(layers[curLayer]);
    shared.uStim.value = now();
    kick(3.2);
  }
  const tmp = new THREE.Vector3();
  function pickNode(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    group.updateMatrixWorld();
    let best = 0, bd = Infinity;
    for (let i = 0; i < active; i++) {
      tmp.set(renderPos[i * 3], renderPos[i * 3 + 1], renderPos[i * 3 + 2]).applyMatrix4(group.matrixWorld).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * rect.width, sy = (-tmp.y * 0.5 + 0.5) * rect.height;
      const d = (sx - px) * (sx - px) + (sy - py) * (sy - py);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  /* ---------- pointer ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function pointer(clientX, clientY, on) {
    if (!on) {
      pointerOnTarget = 0;
      tiltTarget = 0;
      yawTarget = 0;
      kick(1.2);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.constant = -group.position.z;
    ray.ray.intersectPlane(plane, shared.uPointer.value);
    pointerOnTarget = 1;
    if (!reduced) {
      tiltTarget = -ndc.y * 0.12;
      yawTarget = ndc.x * 0.14;
    }
    kick(1.2);
  }

  /* ---------- loop ---------- */
  function kick(sec) {
    wakeUntil = Math.max(wakeUntil, now() + sec);
    if (running && !rafId) {
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
  }
  let slowFrames = 0, sampled = 0;
  function frame(ts) {
    rafId = 0;
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastFrame) / 1000));
    lastFrame = ts;
    const t = now();
    if (ambient) {
      ambientTime += dt;
      rotAuto += dt * 0.055;
      if (t > nextAutoStim && !migrating) {
        nextAutoStim = t + 6.5 + Math.random() * 3;
        stimulateNode(Math.floor(Math.random() * active));
      }
    }
    if (pendingStim > 0 && t > pendingStim) {
      pendingStim = -1;
      stimulateNode(0);
      nextAutoStim = t + 7;
    }
    shared.uTime.value = ambientTime;
    shared.uClock.value = t;

    // --- migrate base positions toward the active topology
    const tp = topo.pos, ts2 = topo.scale, th = topo.hue;
    if (migrating) {
      let done = true;
      const sw = reduced ? 0 : 0.55;
      for (let i = 0; i < N; i++) {
        let p = (t - migStart - delay[i]) / migDur;
        if (p < 1) done = false;
        p = clamp01(p);
        const e = easeInOut(p);
        const arc = Math.sin(Math.PI * e) * sw;
        const i3 = i * 3;
        basePos[i3] = fromPos[i3] + (tp[i3] - fromPos[i3]) * e + swirl[i3] * arc;
        basePos[i3 + 1] = fromPos[i3 + 1] + (tp[i3 + 1] - fromPos[i3 + 1]) * e + swirl[i3 + 1] * arc;
        basePos[i3 + 2] = fromPos[i3 + 2] + (tp[i3 + 2] - fromPos[i3 + 2]) * e + swirl[i3 + 2] * arc;
        scaleArr[i] = fromScale[i] + (ts2[i] - fromScale[i]) * e;
        hueArr[i] = fromHue[i] + (th[i] - fromHue[i]) * e;
      }
      aScale.needsUpdate = true;
      aHue.needsUpdate = true;
      if (done) {
        migrating = false;
        basePos.set(tp);
      }
    }

    // --- render positions: growth from parent + breathing drift
    const par = topo.parent;
    const amp = ambient ? 0.035 : 0;
    const ta = ambientTime;
    for (let i = 0; i < active; i++) {
      const i3 = i * 3;
      let x = basePos[i3], y = basePos[i3 + 1], z = basePos[i3 + 2];
      const age = t - births[i];
      if (age < 1.1) {
        const p = par[i];
        const g = age <= 0 ? 0 : easeOut(age / 1.1);
        if (p >= 0) {
          const p3 = p * 3;
          x = renderPos[p3] + (x - renderPos[p3]) * g;
          y = renderPos[p3 + 1] + (y - renderPos[p3 + 1]) * g;
          z = renderPos[p3 + 2] + (z - renderPos[p3 + 2]) * g;
        }
      }
      if (amp) {
        const s = seeds[i] * 40;
        x += Math.sin(ta * 0.6 + s) * amp;
        y += Math.sin(ta * 0.75 + s * 1.3) * amp;
        z += Math.sin(ta * 0.5 + s * 0.7) * amp;
      }
      renderPos[i3] = x;
      renderPos[i3 + 1] = y;
      renderPos[i3 + 2] = z;
    }
    aOffset.clearUpdateRanges();
    aOffset.addUpdateRange(0, active * 3);
    aOffset.needsUpdate = true;

    // --- synapse layers
    const k = 1 - Math.exp(-dt * (reduced ? 7 : 2.6));
    for (const L of layers) {
      L.opacity += (L.target - L.opacity) * k;
      if (Math.abs(L.target - L.opacity) < 0.002) L.opacity = L.target;
      L.uOpacity.value = L.opacity;
      L.obj.visible = L.opacity > 0.003 && !!L.topo;
      if (!L.obj.visible) continue;
      const edges = L.topo.edges;
      const n = Math.min(L.count, activeEdges(L.topo, active));
      const arr = L.attrs.position.array;
      for (let e = 0; e < n; e++) {
        const a3 = edges[e * 2] * 3, b3 = edges[e * 2 + 1] * 3, o = e * 6;
        arr[o] = renderPos[a3];
        arr[o + 1] = renderPos[a3 + 1];
        arr[o + 2] = renderPos[a3 + 2];
        arr[o + 3] = renderPos[b3];
        arr[o + 4] = renderPos[b3 + 1];
        arr[o + 5] = renderPos[b3 + 2];
      }
      L.attrs.position.clearUpdateRanges();
      L.attrs.position.addUpdateRange(0, n * 6);
      L.attrs.position.needsUpdate = true;
    }

    // --- group transform
    const kp = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
    group.position.lerp(stageTarget, kp);
    const sc = group.scale.x + (stageScale * (1 + (ambient ? Math.sin(ta * 0.8) * 0.012 : 0)) - group.scale.x) * kp;
    group.scale.setScalar(sc);
    if (!dragging) rotOffset += (rotOffsetTarget - rotOffset) * (1 - Math.exp(-dt * 3));
    tilt += (tiltTarget - tilt) * (1 - Math.exp(-dt * 2));
    yaw += (yawTarget - yaw) * (1 - Math.exp(-dt * 2));
    group.rotation.set(0.16 + tilt, rotAuto + rotOffset + yaw, 0);
    shared.uPointerOn.value += (pointerOnTarget - shared.uPointerOn.value) * (1 - Math.exp(-dt * 4));
    dust.rotation.y = rotAuto * 0.25;

    renderer.render(scene, camera);

    // adaptive resolution: drop to 1x if the device is struggling
    if (ambient && dpr > 1 && sampled < 240) {
      sampled++;
      if (dt > 0.034) slowFrames++;
      if (sampled === 240 && slowFrames > 120) {
        dpr = 1;
        renderer.setPixelRatio(1);
        dustUniforms.uPx.value = 6;
        layout();
      }
    }

    const busy = ambient || migrating || t < wakeUntil || t < growingUntil || dragging || pendingStim > 0;
    if (running && busy) rafId = requestAnimationFrame(frame);
  }

  function emit() {
    if (onChange) onChange({ neurons: active, synapses: activeEdges(topo, active), topology: topoKey });
  }

  /* ---------- init ---------- */
  fillLayerStatic(layers[0], topo);
  layers[0].opacity = layers[0].target = 1;
  curLayer = 0;
  layout();
  window.addEventListener('resize', () => {
    clearTimeout(layout._t);
    layout._t = setTimeout(layout, 120);
  });

  return {
    kind: 'webgl',
    setTopology,
    grow(target) {
      setActive(target, reduced ? 0 : active === 0 ? 2.6 : 1.8);
    },
    stimulate(clientX, clientY) {
      if (clientX == null) stimulateNode(Math.floor(Math.random() * Math.max(1, active)));
      else stimulateNode(pickNode(clientX, clientY));
    },
    stimulateRoot() {
      stimulateNode(0);
    },
    pointer,
    drag(dx, phase) {
      if (phase === 'start') dragging = true;
      if (phase === 'end') {
        dragging = false;
        rotOffsetTarget = rotOffset;
      }
      if (dx) {
        rotOffset += dx * 0.006;
        rotOffsetTarget = rotOffset;
      }
      kick(1.5);
    },
    nudge(dir) {
      rotOffsetTarget += dir * 0.6;
      if (reduced) rotOffset = rotOffsetTarget;
      kick(2);
    },
    setStage(name) {
      if (!STAGES[name] || name === stageName) return;
      stageName = name;
      applyStage(false);
      kick(2.5);
    },
    setAmbient(on) {
      ambient = !!on;
      kick(0.5);
    },
    isAmbient: () => ambient,
    setRunning(on) {
      running = !!on;
      if (running) kick(0.5);
      else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    stats: () => ({ neurons: active, synapses: activeEdges(topo, active), topology: topoKey }),
  };
}
