// NEXORA — topology generators.
// Pure, deterministic and dependency-free. Shared by the WebGL organism,
// the SVG fallback and the build-time diagram generator.
//
// Every topology is produced as a growth process: node i always has a parent
// with a lower index, so any prefix [0, active) is a connected organism. That
// is what lets the network "grow" simply by raising the active count, and
// "re-wire" by moving the same nodes into a different topology.

export const CAPS = ['organism', 'agents', 'automation', 'perception', 'reasoning'];

export const CAP_META = {
  organism: {
    idx: '00', name: 'Organism', topo: 'Dendritic whole',
    desc: 'The whole nervous system at rest. Every capability grows from it.',
  },
  agents: {
    idx: '01', name: 'Agents', topo: 'Colony',
    desc: 'Autonomous colonies that delegate, negotiate and report back.',
  },
  automation: {
    idx: '02', name: 'Automation', topo: 'Circulation loop',
    desc: 'Work that moves like circulation: continuous and self-correcting.',
  },
  perception: {
    idx: '03', name: 'Perception', topo: 'Receptive shells',
    desc: 'Layered senses that refine raw signal into meaning.',
  },
  reasoning: {
    idx: '04', name: 'Reasoning', topo: 'Deliberation tree',
    desc: 'Plans that branch, get compared, and keep the path they chose.',
  },
};

// Share of the node capacity that is alive at each generation (6 in total).
export const GENERATIONS = [0.34, 0.47, 0.6, 0.73, 0.87, 1];

const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function norm(v) {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function unit(r) {
  const u = r() * 2 - 1;
  const th = r() * TAU;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(th), u, s * Math.sin(th)];
}
function fib(i, n) {
  const y = 1 - ((i + 0.5) / n) * 2;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * 2.399963229728653;
  return [Math.cos(th) * rad, y, Math.sin(th) * rad];
}

class Builder {
  constructor(N) {
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.scale = new Float32Array(N);
    this.hue = new Float32Array(N);
    this.parent = new Int32Array(N).fill(-1);
    this.extra = [];
  }
  set(i, p) {
    this.pos[i * 3] = p[0];
    this.pos[i * 3 + 1] = p[1];
    this.pos[i * 3 + 2] = p[2];
  }
  get(i) {
    return [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
  }
  link(a, b) {
    if (a !== b && a >= 0 && b >= 0 && a < this.N && b < this.N) this.extra.push(a, b);
  }
}

// Short cross-links between spatial neighbours (grid hash, O(N)).
function nearLinks(b, maxDist, chance, r, group) {
  const { N, pos, parent } = b;
  const cell = maxDist;
  const map = new Map();
  const key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
  const md2 = maxDist * maxDist;
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    if (r() < chance) {
      let best = -1, bd = md2;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const arr = map.get(key(cx + dx, cy + dy, cz + dz));
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const j = arr[k];
          if (j === parent[i] || parent[j] === i) continue;
          if (group && group[j] !== group[i]) continue;
          const ex = pos[j * 3] - x, ey = pos[j * 3 + 1] - y, ez = pos[j * 3 + 2] - z;
          const d2 = ex * ex + ey * ey + ez * ez;
          if (d2 < bd && d2 > 1e-6) { bd = d2; best = j; }
        }
      }
      if (best >= 0) b.link(best, i);
    }
    const k = key(cx, cy, cz);
    let arr = map.get(k);
    if (!arr) map.set(k, (arr = []));
    arr.push(i);
  }
}

function finalize(b, kind) {
  const N = b.N;
  // Centre the bounding box on the origin so every topology frames identically.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < N; i++) for (let a = 0; a < 3; a++) {
    const v = b.pos[i * 3 + a];
    if (v < lo[a]) lo[a] = v;
    if (v > hi[a]) hi[a] = v;
  }
  for (let i = 0; i < N; i++) for (let a = 0; a < 3; a++) b.pos[i * 3 + a] -= (lo[a] + hi[a]) / 2;
  const seen = new Set();
  const list = [];
  const push = (a, c) => {
    const lo = Math.min(a, c), hi = Math.max(a, c);
    const k = lo * N + hi;
    if (seen.has(k)) return;
    seen.add(k);
    list.push([a, c, hi]);
  };
  for (let i = 1; i < N; i++) if (b.parent[i] >= 0) push(b.parent[i], i);
  for (let k = 0; k < b.extra.length; k += 2) push(b.extra[k], b.extra[k + 1]);
  list.sort((x, y) => x[2] - y[2]);
  const E = list.length;
  const edges = new Uint32Array(E * 2);
  const edgeMax = new Uint32Array(E);
  for (let k = 0; k < E; k++) {
    edges[k * 2] = list[k][0];
    edges[k * 2 + 1] = list[k][1];
    edgeMax[k] = list[k][2];
  }
  const rad = new Float32Array(N);
  let maxR = 1e-6;
  for (let i = 0; i < N; i++) {
    rad[i] = Math.hypot(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]);
    if (rad[i] > maxR) maxR = rad[i];
  }
  for (let i = 0; i < N; i++) rad[i] /= maxR;
  return { kind, N, pos: b.pos, scale: b.scale, hue: b.hue, parent: b.parent, edges, edgeMax, edgeCount: E, rad };
}

/* ---------- 00 Organism: dendritic whole ---------- */
function buildOrganism(N, r) {
  const b = new Builder(N);
  const dir = new Float32Array(N * 3);
  const kids = new Uint8Array(N);
  const depth = new Uint16Array(N);
  const T = Math.min(9, N - 1);
  b.set(0, [0, 0, 0]);
  for (let i = 1; i <= T; i++) {
    const d = norm(add(fib(i - 1, T), mul(unit(r), 0.25)));
    b.set(i, mul(d, 0.42));
    dir.set(d, i * 3);
    b.parent[i] = 0;
    depth[i] = 1;
    kids[0]++;
  }
  const E = [3.3, 2.2, 2.25];
  for (let i = T + 1; i < N; i++) {
    let p = 1;
    for (let tries = 0; tries < 5; tries++) {
      p = Math.floor(i * Math.pow(r(), 0.3));
      if (p < 1) p = 1 + Math.floor(r() * T);
      if (p >= i) p = i - 1;
      if (kids[p] < 3) break;
    }
    kids[p]++;
    const pp = b.get(p);
    let d = norm(add([dir[p * 3], dir[p * 3 + 1], dir[p * 3 + 2]], mul(unit(r), 0.62)));
    const q = [pp[0] / E[0], pp[1] / E[1], pp[2] / E[2]];
    const ql = len(q);
    if (ql > 0.76) {
      const pull = (ql - 0.76) * 3.2;
      d = norm(sub(d, mul(q, pull / ql)));
    }
    const step = 0.27 * (0.7 + 0.6 * r()) * (1 - Math.min(depth[p], 30) / 80);
    b.set(i, add(pp, mul(d, step)));
    dir.set(d, i * 3);
    b.parent[i] = p;
    depth[i] = depth[p] + 1;
  }
  let maxD = 1;
  for (let i = 0; i < N; i++) if (depth[i] > maxD) maxD = depth[i];
  for (let i = 0; i < N; i++) {
    b.hue[i] = clamp01((depth[i] / maxD) * 1.15 + (r() - 0.5) * 0.3);
    b.scale[i] = 0.06 + 0.028 * Math.min(kids[i], 4) + r() * 0.025;
  }
  for (let i = 1; i <= T; i++) b.scale[i] = 0.2;
  b.scale[0] = 0.5;
  b.hue[0] = 0.1;
  nearLinks(b, 0.36, 0.45, r);
  return finalize(b, 'organism');
}

/* ---------- 01 Agents: colony ---------- */
function buildAgents(N, r) {
  const b = new Builder(N);
  const K = 7;
  const group = new Int16Array(N).fill(-1);
  const members = [];
  const hubs = [];
  b.set(0, [0, 0, 0]);
  b.scale[0] = 0.48;
  b.hue[0] = 0.45;
  for (let c = 0; c < K && c + 1 < N; c++) {
    const i = c + 1;
    const f = fib(c, K);
    const p = mul(norm([f[0] * 1.1, f[1] * 0.62, f[2] * 1.1]), 2.2);
    b.set(i, p);
    b.parent[i] = 0;
    b.scale[i] = 0.3;
    b.hue[i] = c / (K - 1);
    group[i] = c;
    members.push([i]);
    hubs.push(p);
  }
  const per = Math.max(1, (N - K - 1) / K);
  for (let i = K + 1; i < N; i++) {
    const c = (i - K - 1) % K;
    const m = members[c];
    const p = m[Math.floor(m.length * Math.pow(r(), 0.55))];
    let cand = add(b.get(p), mul(unit(r), 0.17 + 0.12 * r()));
    const off = sub(cand, hubs[c]);
    const ol = len(off);
    const lim = 0.62 + 0.42 * Math.sqrt(m.length / per);
    if (ol > lim) cand = add(hubs[c], mul(off, (lim / ol) * (0.75 + 0.25 * r())));
    b.set(i, cand);
    b.parent[i] = p;
    group[i] = c;
    m.push(i);
    b.hue[i] = clamp01(c / (K - 1) + (r() - 0.5) * 0.18);
    b.scale[i] = 0.05 + r() * 0.04 + (m.length < 8 ? 0.05 : 0);
  }
  for (let c = 0; c < K; c++) b.link(1 + c, 1 + ((c + 1) % K));
  // Negotiation channels: long links between members of neighbouring colonies.
  for (let k = 0; k < K * 5; k++) {
    const c = k % K;
    const c2 = (c + 1 + (k % 3)) % K;
    const ma = members[c], mb = members[c2];
    if (ma.length < 3 || mb.length < 3) continue;
    const a = ma[1 + Math.floor(r() * (ma.length - 1))];
    const d = mb[1 + Math.floor(r() * (mb.length - 1))];
    b.link(a, d);
  }
  nearLinks(b, 0.2, 0.35, r, group);
  return finalize(b, 'agents');
}

/* ---------- 02 Automation: circulation loop (trefoil) ---------- */
function buildAutomation(N, r) {
  const b = new Builder(N);
  const S = 5;
  const steps = Math.max(2, Math.ceil((N - 1) / S));
  const knot = (u) => {
    const rr = 2 + Math.cos(3 * u);
    return [rr * Math.cos(2 * u) * 0.92, rr * Math.sin(2 * u) * 0.8, -Math.sin(3 * u) * 0.95];
  };
  const spoke = Math.max(4, Math.floor(steps / 6));
  b.set(0, [0, 0, 0]);
  b.scale[0] = 0.42;
  b.hue[0] = 0.5;
  for (let i = 1; i < N; i++) {
    const k = i - 1;
    const s = k % S;
    const st = Math.floor(k / S);
    const u = (st / steps) * TAU;
    const c = knot(u);
    const t = norm(sub(knot(u + 0.01), c));
    const n = norm(cross(t, [0, 0, 1]));
    const bv = cross(t, n);
    const ang = (s / S) * TAU + u * 5;
    const rad = 0.3 * (0.8 + 0.4 * r());
    b.set(i, add(c, add(mul(n, Math.cos(ang) * rad), mul(bv, Math.sin(ang) * rad))));
    b.parent[i] = st === 0 ? 0 : i - S;
    b.hue[i] = clamp01(0.5 - 0.5 * Math.cos(u) + (r() - 0.5) * 0.12);
    b.scale[i] = st % 14 === 0 ? 0.13 : 0.055 + r() * 0.03;
    if (st % 2 === 0) {
      if (s > 0) b.link(i - 1, i);
      if (s === S - 1) b.link(i - (S - 1), i);
    }
    if (s === 0 && st > 0 && st % spoke === 0) b.link(0, i);
    if (st === steps - 1) b.link(1 + s, i);
  }
  return finalize(b, 'automation');
}

/* ---------- 03 Perception: receptive shells ---------- */
function buildPerception(N, r) {
  const b = new Builder(N);
  const R = [0, 0.5, 1.1, 1.8, 2.7];
  const weights = R.slice(1).map((x) => Math.pow(x, 1.7));
  const total = weights.reduce((a, c) => a + c, 0);
  const counts = weights.map((w) => Math.round((w / total) * (N - 1)));
  counts[3] = N - 1 - counts[0] - counts[1] - counts[2];
  const B = 13;
  const bundles = [];
  for (let k = 0; k < B; k++) bundles.push(fib(k, B));
  const baseScale = [0.45, 0.16, 0.11, 0.08, 0.06];
  // 1. Specify every receptor, then 2. order them so growth reaches all shells early.
  const specs = [];
  for (let s = 1; s <= 4; s++) {
    const cnt = counts[s - 1];
    for (let k = 0; k < cnt; k++) {
      let d;
      if (s === 1) d = fib(k, Math.max(1, cnt));
      else {
        const spread = 0.12 + 0.12 * (s - 1);
        d = norm(add(bundles[k % B], mul(unit(r), spread * Math.sqrt(r()) * 1.3)));
      }
      const rad = R[s] * (0.93 + 0.14 * r());
      specs.push({ s, d, p: [d[0] * rad, d[1] * rad * 0.92, d[2] * rad * 0.9], key: s + r() * 3 });
    }
  }
  specs.sort((a, c) => a.key - c.key);
  const group = new Int16Array(N).fill(0);
  const placed = [[0], [], [], [], []];
  b.set(0, [0, 0, 0]);
  b.scale[0] = baseScale[0];
  b.hue[0] = 1;
  for (let i = 1; i < N && i - 1 < specs.length; i++) {
    const { s, d, p } = specs[i - 1];
    let ps = s - 1;
    while (ps > 0 && placed[ps].length === 0) ps--;
    const pool = placed[ps];
    let best = pool[0], bd = -2;
    if (ps > 0) {
      for (let q = 0; q < pool.length; q++) {
        const j = pool[q];
        const pj = b.get(j);
        const dot = (pj[0] * d[0] + pj[1] * d[1] + pj[2] * d[2]) / (len(pj) || 1);
        if (dot > bd) { bd = dot; best = j; }
      }
    }
    b.set(i, p);
    b.parent[i] = best;
    b.hue[i] = clamp01(1 - ((s - 1) / 3) * 0.95 + (r() - 0.5) * 0.1);
    b.scale[i] = baseScale[s] + r() * 0.02;
    group[i] = s;
    placed[s].push(i);
  }
  nearLinks(b, 0.36, 0.5, r, group);
  return finalize(b, 'perception');
}

/* ---------- 04 Reasoning: deliberation tree ---------- */
function buildReasoning(N, r) {
  const b = new Builder(N);
  const layer = new Uint16Array(N);
  b.set(0, [0, 0, 0]);
  const q = [0];
  let qh = 0;
  let i = 1;
  while (i < N && qh < q.length) {
    const p = q[qh++];
    const L = layer[p] + 1;
    const kids = L <= 2 ? 3 : r() < 0.2 ? 1 : r() < 0.55 ? 2 : 3;
    const pp = b.get(p);
    const pxz = Math.hypot(pp[0], pp[2]);
    for (let k = 0; k < kids && i < N; k++) {
      const a = r() * TAU;
      let dx = Math.cos(a), dz = Math.sin(a);
      if (pxz > 0.05) {
        dx = (pp[0] / pxz) * 0.9 + dx * 0.8;
        dz = (pp[2] / pxz) * 0.9 + dz * 0.8;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
      }
      const dist = 0.85 * Math.pow(0.8, L - 1) + 0.1;
      let x = pp[0] + dx * dist, z = pp[2] + dz * dist;
      const rr = Math.hypot(x, z);
      if (rr > 2.9) { x *= 2.9 / rr; z *= 2.9 / rr; }
      b.set(i, [x, 0, z]);
      b.parent[i] = p;
      layer[i] = L;
      q.push(i);
      i++;
    }
  }
  let maxL = 1;
  for (let k = 0; k < N; k++) if (layer[k] > maxL) maxL = layer[k];
  const chosen = new Uint8Array(N);
  for (let k = N - 1; k >= 0; k = b.parent[k]) { chosen[k] = 1; if (k === 0) break; }
  for (let k = 0; k < N; k++) {
    b.pos[k * 3 + 1] = -2.6 + (layer[k] / maxL) * 5.2 + (k ? (r() - 0.5) * 0.14 : 0);
    if (chosen[k]) {
      b.hue[k] = 0.02;
      b.scale[k] = 0.15;
    } else {
      b.hue[k] = 0.55 + 0.45 * r();
      b.scale[k] = (0.05 + r() * 0.035) * (1.25 - (layer[k] / maxL) * 0.45);
    }
  }
  b.scale[0] = 0.42;
  b.hue[0] = 0.3;
  nearLinks(b, 0.32, 0.3, r, layer);
  return finalize(b, 'reasoning');
}

const BUILDERS = {
  organism: buildOrganism,
  agents: buildAgents,
  automation: buildAutomation,
  perception: buildPerception,
  reasoning: buildReasoning,
};

export function buildTopology(kind, N, seed = 1977) {
  return BUILDERS[kind](N, rng(seed + CAPS.indexOf(kind) * 7919));
}

export function buildAll(N, seed = 1977) {
  const out = {};
  for (const k of CAPS) out[k] = buildTopology(k, N, seed);
  return out;
}

// Number of edges whose endpoints are both alive (edges are sorted by max endpoint).
export function activeEdges(t, active) {
  let lo = 0, hi = t.edgeCount;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t.edgeMax[m] < active) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function activeFor(gen, N) {
  const g = Math.max(1, Math.min(GENERATIONS.length, gen));
  return Math.max(12, Math.round(N * GENERATIONS[g - 1]));
}

function adjacency(t) {
  if (t._adj) return t._adj;
  const { N, edges, edgeCount } = t;
  const start = new Uint32Array(N + 1);
  for (let k = 0; k < edgeCount; k++) {
    start[edges[k * 2] + 1]++;
    start[edges[k * 2 + 1] + 1]++;
  }
  for (let i = 0; i < N; i++) start[i + 1] += start[i];
  const fill = start.slice(0, N);
  const list = new Uint32Array(edgeCount * 2);
  for (let k = 0; k < edgeCount; k++) {
    const a = edges[k * 2], c = edges[k * 2 + 1];
    list[fill[a]++] = c;
    list[fill[c]++] = a;
  }
  t._adj = { start, list };
  return t._adj;
}

// Breadth-first hop distance from `src` across the living part of a topology.
export function hops(t, src, active, out, maxHop = 64) {
  out.fill(999);
  if (src < 0 || src >= active) return out;
  const { start, list } = adjacency(t);
  const q = new Int32Array(active);
  let h = 0, tl = 0;
  q[tl++] = src;
  out[src] = 0;
  while (h < tl) {
    const v = q[h++];
    const hv = out[v];
    if (hv >= maxHop) continue;
    for (let k = start[v]; k < start[v + 1]; k++) {
      const w = list[k];
      if (w >= active || out[w] <= hv + 1) continue;
      out[w] = hv + 1;
      q[tl++] = w;
    }
  }
  return out;
}

// Simple perspective projection used by the SVG fallback and diagram generator.
export function project(t, active, rotY = 0.55, tilt = 0.22, dist = 11) {
  const n = Math.min(active, t.N);
  const xy = new Float32Array(n * 2);
  const depth = new Float32Array(n);
  const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(tilt), sx = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const x = t.pos[i * 3], y = t.pos[i * 3 + 1], z = t.pos[i * 3 + 2];
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    const k = dist / (dist - z2);
    xy[i * 2] = x1 * k;
    xy[i * 2 + 1] = -y2 * k;
    depth[i] = z2;
  }
  return { xy, depth, n };
}
