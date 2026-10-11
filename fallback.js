// NEXORA — SVG fallback organism for browsers without WebGL.
// Same topologies, same API as the WebGL scene: rewire, grow, fire signals, turn.
import { activeEdges, hops, project } from './topology.js';

const NS = 'http://www.w3.org/2000/svg';
const CYAN = [41, 227, 242];
const UV = [122, 77, 255];

function hueColor(h) {
  const c = CYAN.map((v, k) => Math.round(v + (UV[k] - v) * h));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function createFallback(container, { topologies, N, reduced, onChange }) {
  container.innerHTML = '';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-4.4 -3.4 8.8 6.8');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = `
    <defs>
      <filter id="fb-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.05" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="fb-line" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#29E3F2"/><stop offset="1" stop-color="#7A4DFF"/>
      </linearGradient>
    </defs>`;
  container.appendChild(svg);

  let key = 'organism';
  let active = 0;
  let rot = 0.55;
  let layer = null;
  let raf = 0;
  const hopArr = new Float32Array(N);

  function draw(fade) {
    const t = topologies[key];
    const { xy, depth, n } = project(t, active, rot, 0.2, 11);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'fb-layer');
    let d = '';
    const E = activeEdges(t, active);
    for (let e = 0; e < E; e++) {
      const a = t.edges[e * 2], b = t.edges[e * 2 + 1];
      d += `M${xy[a * 2].toFixed(2)} ${xy[a * 2 + 1].toFixed(2)}L${xy[b * 2].toFixed(2)} ${xy[b * 2 + 1].toFixed(2)}`;
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'fb-edges');
    path.setAttribute('stroke', 'url(#fb-line)');
    g.appendChild(path);
    const ng = document.createElementNS(NS, 'g');
    ng.setAttribute('filter', 'url(#fb-glow)');
    let html = '';
    for (let i = 0; i < n; i++) {
      const k = 11 / (11 - depth[i]);
      const r = Math.max(0.018, t.scale[i] * 0.32 * k);
      const op = Math.max(0.25, Math.min(1, 0.55 + depth[i] * 0.12));
      html += `<circle class="fb-node" data-i="${i}" cx="${xy[i * 2].toFixed(2)}" cy="${xy[i * 2 + 1].toFixed(2)}" r="${r.toFixed(3)}" fill="${hueColor(t.hue[i])}" opacity="${op.toFixed(2)}"/>`;
    }
    ng.innerHTML = html;
    g.appendChild(ng);
    if (fade && !reduced) g.classList.add('is-entering');
    svg.appendChild(g);
    if (layer) {
      const old = layer;
      if (fade && !reduced) {
        old.classList.add('is-leaving');
        setTimeout(() => old.remove(), 900);
      } else old.remove();
    }
    layer = g;
  }

  function redrawSoon() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      draw(false);
    });
  }

  function emit() {
    if (onChange) onChange({ neurons: active, synapses: activeEdges(topologies[key], active), topology: key });
  }

  function fire(src) {
    if (!layer) return;
    hops(topologies[key], src, active, hopArr);
    layer.querySelectorAll('.fb-node').forEach((c) => {
      const h = hopArr[+c.dataset.i];
      c.classList.remove('is-firing');
      if (h < 900) c.style.setProperty('--d', `${Math.round(h * 70)}ms`);
    });
    void layer.getBoundingClientRect();
    layer.querySelectorAll('.fb-node').forEach((c) => {
      if (hopArr[+c.dataset.i] < 900) c.classList.add('is-firing');
    });
  }

  return {
    kind: 'svg',
    setTopology(k, { instant = false } = {}) {
      if (!topologies[k] || (k === key && layer)) return;
      key = k;
      draw(!instant);
      emit();
    },
    grow(target) {
      active = Math.max(1, Math.min(N, target));
      draw(false);
      emit();
    },
    stimulate() {
      fire(Math.floor(Math.random() * Math.max(1, active)));
    },
    stimulateRoot() {
      fire(0);
    },
    pointer() {},
    drag(dx) {
      if (!dx) return;
      rot += dx * 0.006;
      redrawSoon();
    },
    nudge(dir) {
      rot += dir * 0.6;
      draw(false);
    },
    setStage(name) {
      container.dataset.stage = name;
    },
    setAmbient(on) {
      container.classList.toggle('is-still', !on);
    },
    isAmbient: () => !container.classList.contains('is-still'),
    setRunning() {},
    stats: () => ({ neurons: active, synapses: activeEdges(topologies[key], active), topology: key }),
  };
}
