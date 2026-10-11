// NEXORA — page orchestration: capability explorer, growth-by-exploration,
// scroll-linked re-wiring, anatomy plate, growth track, signal log and form.
import { CAP_META, GENERATIONS, buildAll, activeFor } from './topology.js';
import { createFallback } from './fallback.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const root = document.documentElement;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) root.classList.add('reduced');
root.classList.add('ui-ready');
const mobile = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const N = mobile ? 720 : 1600;
const MAX_GEN = GENERATIONS.length;

const state = {
  topo: 'organism',
  gen: 1,
  appliedGen: 0,
  ambient: !reduced,
  organism: null,
  stage: 'hero',
  visited: new Set(),
  visible: true,
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const pad = (n, w = 4) => String(Math.max(0, Math.round(n))).padStart(w, '0');
const live = (msg) => {
  const el = $('#live');
  el.textContent = '';
  window.setTimeout(() => (el.textContent = msg), 40);
};
const hudAll = (key) => $$(`[data-hud="${key}"]`);
const setHud = (key, value) => hudAll(key).forEach((el) => (el.textContent = value));

const GLYPHS = '01<>/\\[]{}+=*#ABCDEFHKMNRSTUVXZ';
function scramble(el, finalText, dur = 700) {
  if (!el) return;
  if (reduced) {
    el.textContent = finalText;
    return;
  }
  cancelAnimationFrame(el._scr || 0);
  const start = performance.now();
  const n = finalText.length;
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    let out = '';
    for (let i = 0; i < n; i++) {
      const ch = finalText[i];
      if (ch === ' ' || i < p * n * 1.15 - 2) out += ch;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = p >= 1 ? finalText : out;
    if (p < 1) el._scr = requestAnimationFrame(step);
  };
  el._scr = requestAnimationFrame(step);
}

const counters = new Map();
function countTo(el, to) {
  const from = counters.get(el) ?? 0;
  counters.set(el, to);
  if (reduced || from === to) {
    el.textContent = pad(to);
    return;
  }
  const start = performance.now();
  const dur = 900;
  const token = (el._ct = (el._ct || 0) + 1);
  const step = (t) => {
    if (el._ct !== token) return;
    const p = Math.min(1, (t - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = pad(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */
function onStats(s) {
  hudAll('neurons').forEach((el) => countTo(el, s.neurons));
  hudAll('synapses').forEach((el) => countTo(el, s.synapses));
}

function updateGenUI(pulse) {
  setHud('gen', pad(state.gen, 2));
  $$('.gen-bars i, .tm-bars i').forEach((el, i) => el.classList.toggle('on', i % MAX_GEN < state.gen));
  const chip = $('[data-gen-chip]');
  chip.setAttribute('aria-label', `Organism growth: generation ${state.gen} of ${MAX_GEN}`);
  if (pulse && !reduced) {
    chip.classList.remove('is-pulse');
    void chip.offsetWidth;
    chip.classList.add('is-pulse');
  }
  const growBtn = $('[data-act="grow"]');
  const label = $('[data-grow-label]');
  if (state.gen >= MAX_GEN) {
    label.textContent = 'Fully grown';
    growBtn.setAttribute('aria-disabled', 'true');
  } else {
    label.textContent = 'Grow branch';
    growBtn.removeAttribute('aria-disabled');
  }
}

let statusTimer = 0;
function updateTopologyUI(source) {
  const m = CAP_META[state.topo];
  setHud('mode', m.name);
  scramble($('[data-hud="topo"]'), m.topo, 600);
  setHud('desc', m.desc);
  const big = $('[data-hud="topo-big"]');
  if (big) scramble(big, m.topo, 800);
  setHud('seed', m.name);
  setHud('seed-topo', m.topo);
  $$('.rail-item').forEach((b) => {
    const on = b.dataset.cap === state.topo;
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
  if (source === 'init') return;
  const status = $('[data-hud="status"]');
  status.textContent = reduced ? 'Re-wired' : 'Re-wiring synapses…';
  status.classList.add('is-busy');
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    status.textContent = state.ambient ? 'Stable · signals flowing' : 'Stable · motion paused';
    status.classList.remove('is-busy');
  }, reduced ? 400 : 2300);
  if (source === 'chapter') {
    $$('.chapter').forEach((c) => c.classList.toggle('is-active', c.dataset.cap === state.topo));
  }
}

function setTopology(key, { announce = false, source = 'rail' } = {}) {
  if (!CAP_META[key] || key === state.topo) return;
  state.topo = key;
  if (state.organism) state.organism.setTopology(key);
  updateTopologyUI(source);
  if (announce) live(`Network re-wired for ${CAP_META[key].name}: ${CAP_META[key].topo} topology.`);
}

/* growth: generations rise as sections are explored; applied when the organism is on screen */
function growTo(gen, { manual = false } = {}) {
  gen = Math.min(MAX_GEN, gen);
  if (gen <= state.gen) return false;
  state.gen = gen;
  updateGenUI(true);
  applyGrowth();
  if (manual) live(`New branch grown. Generation ${state.gen} of ${MAX_GEN}.`);
  return true;
}
function applyGrowth() {
  if (!state.organism || !state.visible) return;
  if (state.appliedGen < state.gen) {
    state.appliedGen = state.gen;
    state.organism.grow(activeFor(state.gen, N));
  }
}

function setAmbient(on) {
  state.ambient = on;
  root.classList.toggle('motion-paused', !on);
  if (state.organism) state.organism.setAmbient(on);
  $$('[data-act="motion"]').forEach((b) => b.setAttribute('aria-pressed', on ? 'false' : 'true'));
  $$('[data-motion-label]').forEach((l) => (l.textContent = on ? 'Pause motion' : 'Play motion'));
  const status = $('[data-hud="status"]');
  if (!status.classList.contains('is-busy')) status.textContent = on ? 'Stable · signals flowing' : 'Stable · motion paused';
  logSync();
}

/* ------------------------------------------------------------------ */
/* organism boot                                                       */
/* ------------------------------------------------------------------ */
async function bootOrganism() {
  const topologies = buildAll(N);
  const canvas = $('#organism-canvas');
  const opts = { topologies, N, reduced, mobile, onChange: onStats };
  let organism = null;
  try {
    const mod = await import('./scene.js');
    organism = mod.createOrganism(canvas, opts);
    root.classList.add('has-webgl');
  } catch (err) {
    root.classList.add('no-webgl');
    organism = createFallback($('#organism-fallback'), opts);
  }
  state.organism = organism;
  organism.setTopology(state.topo, { instant: true });
  organism.setStage(state.stage);
  if (!state.ambient) organism.setAmbient(false);
  applyGrowth();
  organism.setRunning(state.visible && !document.hidden);
  onStats(organism.stats());
}

/* ------------------------------------------------------------------ */
/* hero: rail, controls, direct manipulation                           */
/* ------------------------------------------------------------------ */
function initHero() {
  // decode-in headline (visual copy is aria-hidden; the heading keeps its real text)
  const h1 = $('#hero-title');
  if (!reduced) {
    const text = h1.textContent.replace(/\s+/g, ' ').trim();
    const visual = document.createElement('span');
    visual.className = 'h1-visual';
    visual.setAttribute('aria-hidden', 'true');
    let i = 0;
    $$('.h1-line', h1).forEach((line) => {
      const lineEl = document.createElement('span');
      lineEl.className = 'h1-line';
      line.childNodes.forEach((node) => {
        const accent = node.nodeType === 1 && node.classList.contains('h1-accent');
        const words = node.textContent.split(/(\s+)/);
        words.forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) {
            lineEl.appendChild(document.createTextNode(' '));
            return;
          }
          const word = document.createElement('span');
          word.className = 'w' + (accent ? ' h1-accent' : '');
          for (const ch of w) {
            const c = document.createElement('span');
            c.className = 'ch';
            c.style.setProperty('--i', i++);
            c.textContent = ch;
            word.appendChild(c);
          }
          lineEl.appendChild(word);
        });
      });
      visual.appendChild(lineEl);
      visual.appendChild(document.createTextNode(' '));
    });
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    h1.replaceChildren(sr, visual);
  }

  // capability rail — radiogroup with roving focus
  const items = $$('.rail-item');
  items.forEach((btn, idx) => {
    btn.addEventListener('click', () => setTopology(btn.dataset.cap, { announce: true }));
    btn.addEventListener('keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % items.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = items.length - 1;
      if (next < 0) return;
      e.preventDefault();
      items[next].focus();
      setTopology(items[next].dataset.cap, { announce: true });
      if (items[next].scrollIntoView && window.innerWidth < 900) {
        items[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
    });
  });

  // telemetry controls
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const o = state.organism;
    if (act === 'stim' && o) {
      o.stimulateRoot();
      live('Signal fired from the core.');
    } else if (act === 'grow') {
      if (!growTo(state.gen + 1, { manual: true })) {
        if (o) o.stimulateRoot();
        live('The organism is fully grown.');
      }
    } else if (act === 'rotl' && o) o.nudge(-1);
    else if (act === 'rotr' && o) o.nudge(1);
    else if (act === 'motion') setAmbient(!state.ambient);
  });

  // direct manipulation on the empty field: drag to turn, tap to fire
  const hit = $('.hero-hit');
  const fieldX = $('[data-field="x"]');
  const fieldY = $('[data-field="y"]');
  const fmt = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  let down = null;
  hit.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, last: e.clientX, moved: false };
    try { hit.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    state.organism?.drag(0, 'start');
  });
  hit.addEventListener('pointermove', (e) => {
    state.organism?.pointer(e.clientX, e.clientY, true);
    fieldX.textContent = fmt((e.clientX / window.innerWidth) * 2 - 1);
    fieldY.textContent = fmt(1 - (e.clientY / window.innerHeight) * 2);
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.last;
    down.last = e.clientX;
    if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) down.moved = true;
    state.organism?.drag(dx);
  });
  const end = (e, cancelled) => {
    if (!down || e.pointerId !== down.id) return;
    if (!cancelled && !down.moved) state.organism?.stimulate(e.clientX, e.clientY);
    state.organism?.drag(0, 'end');
    down = null;
  };
  hit.addEventListener('pointerup', (e) => end(e, false));
  hit.addEventListener('pointercancel', (e) => end(e, true));
  hit.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') state.organism?.pointer(0, 0, false);
  });
}

/* ------------------------------------------------------------------ */
/* sections: stage, nav state, exploration growth, visibility          */
/* ------------------------------------------------------------------ */
function initSections() {
  const sections = $$('main > section');
  const navLinks = $$('.site-nav a, .menu-list a');

  const enter = (sec) => {
    const id = sec.id;
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (sec.dataset.stage) {
      state.stage = sec.dataset.stage;
      document.body.dataset.stage = state.stage;
      state.organism?.setStage(state.stage);
    }
    if (!state.visited.has(id)) {
      const first = state.visited.size === 0;
      state.visited.add(id);
      if (!first) growTo(state.gen + 1);
    }
  };
  const centre = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && enter(e.target)),
    { rootMargin: '-50% 0px -50% 0px' }
  );
  sections.forEach((s) => centre.observe(s));

  // the organism only renders while a transparent "organism" section is on screen
  const onScreen = new Set();
  const vis = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target)));
    syncVisibility(onScreen.size > 0);
  });
  $$('[data-stage]', $('main')).forEach((s) => vis.observe(s));
  document.addEventListener('visibilitychange', () => syncVisibility(state.visibleSections));
}
function syncVisibility(sectionsVisible) {
  state.visibleSections = sectionsVisible;
  state.visible = !!sectionsVisible && !document.hidden;
  root.classList.toggle('organism-hidden', !sectionsVisible);
  if (state.organism) {
    state.organism.setRunning(state.visible);
    if (state.visible) applyGrowth();
  }
}

/* chapters re-wire the network as they cross the centre of the viewport */
function initChapters() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-seen');
        setTopology(e.target.dataset.cap, { source: 'chapter' });
        $$('.chapter').forEach((c) => c.classList.toggle('is-active', c === e.target));
      });
    },
    { rootMargin: '-42% 0px -42% 0px' }
  );
  $$('.chapter').forEach((c) => io.observe(c));
}

/* ------------------------------------------------------------------ */
/* header & menu                                                       */
/* ------------------------------------------------------------------ */
function initHeader() {
  const header = $('.site-header');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const btn = $('.menu-btn');
  const panel = $('#menu');
  const main = $('main');
  const footer = $('.site-footer');
  const setOpen = (open, refocus = true) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('.menu-label', btn).textContent = open ? 'Close' : 'Menu';
    panel.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    main.inert = open;
    footer.inert = open;
    if (open) $('a', panel).focus();
    else if (refocus) btn.focus();
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false, false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1180 && !panel.hidden) setOpen(false, false);
  });
}

/* ------------------------------------------------------------------ */
/* scan reveals                                                        */
/* ------------------------------------------------------------------ */
function initScan() {
  const els = $$('[data-scan]');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    },
    { threshold: 0.35 }
  );
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ */
/* anatomy plate                                                       */
/* ------------------------------------------------------------------ */
function initAnatomy() {
  const plate = $('.plate');
  const cap = $('[data-plate-cap]');
  const items = $$('.anat-item');
  const names = {};
  items.forEach((b) => (names[b.dataset.layer] = $('.ai-name', b).firstChild.textContent.trim()));
  let pinned = null;
  const show = (layer) => {
    plate.dataset.focus = layer || '';
    items.forEach((b) => b.classList.toggle('is-focus', b.dataset.layer === layer));
    cap.textContent = layer ? names[layer] : 'All layers';
  };
  items.forEach((b) => {
    const layer = b.dataset.layer;
    b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && show(layer));
    b.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && show(pinned));
    b.addEventListener('focus', () => show(layer));
    b.addEventListener('blur', () => show(pinned));
    b.addEventListener('click', () => {
      pinned = pinned === layer ? null : layer;
      items.forEach((x) => x.setAttribute('aria-pressed', x.dataset.layer === pinned ? 'true' : 'false'));
      show(pinned);
    });
  });
  plate.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const g = e.target.closest('[data-layer]');
    show(g ? g.dataset.layer : pinned);
  });
  plate.addEventListener('pointerleave', () => show(pinned));
}

/* ------------------------------------------------------------------ */
/* growth track: vertical scroll drives a horizontal journey            */
/* ------------------------------------------------------------------ */
function initTrack() {
  const sec = $('#growth');
  const pin = $('.growth-pin', sec);
  const track = $('.track', sec);
  const fill = $('.tp-fill', sec);
  const stages = $$('.stage', sec);
  const mq = window.matchMedia('(min-width: 900px) and (min-height: 620px)');
  let dist = 0;

  const seen = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-seen')),
    { threshold: 0.45 }
  );
  stages.forEach((s) => seen.observe(s));

  function measure() {
    if (!mq.matches) {
      sec.classList.remove('is-horizontal');
      sec.style.height = '';
      track.style.transform = '';
      return;
    }
    sec.classList.add('is-horizontal');
    dist = Math.max(0, track.offsetWidth - pin.clientWidth);
    sec.style.height = `${pin.offsetHeight + dist}px`;
    update();
  }
  function update() {
    if (!mq.matches) return;
    const r = sec.getBoundingClientRect();
    const total = sec.offsetHeight - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    const cur = Math.min(stages.length - 1, Math.floor(p * stages.length * 0.999));
    stages.forEach((s, i) => s.classList.toggle('is-current', i === cur));
  }
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener('resize', measure);
  mq.addEventListener('change', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
}

/* ------------------------------------------------------------------ */
/* signal log (illustrative, fictional)                                */
/* ------------------------------------------------------------------ */
const LOG = [
  ['agents', 'agents/procure', 'Split “renew design licences” into three sub-tasks; plan awaiting review.'],
  ['immune', 'immune', 'Held an export of the customer list — outside the granted scope.'],
  ['reasoning', 'reasoning', 'Confidence 0.58 is below the 0.70 floor. Escalated to the finance lead.'],
  ['automation', 'automation/invoices', 'Routed around a stalled ERP sync; retry queued with full trace.'],
  ['perception', 'perception', 'Read 14 scanned contracts; flagged two unusual renewal clauses.'],
  ['memory', 'memory', 'Forgot session context for “Q3 hiring” on request.'],
  ['agents', 'agents/support', 'Handed off to a person: refund above the approval threshold.'],
  ['membrane', 'membrane', 'New permission requested: read-only access to CRM notes.'],
  ['reasoning', 'reasoning', 'Compared four plans; chose the cheapest reversible option.'],
  ['automation', 'automation/onboarding', 'Workflow re-wiring proposed after an HR field was renamed.'],
  ['immune', 'immune', 'Agent “ledger” queried 40× its usual rate — paused pending review.'],
  ['prune', 'prune', 'Retired unused branch “legacy-reports” after 60 quiet days.'],
];
let logTimer = 0;
let logIdx = 0;
let logT = 8.2;
let logOnScreen = false;
function logLine(entry, animate) {
  const [kind, src, msg] = entry;
  logT += 1.4 + Math.random() * 3.2;
  const li = document.createElement('li');
  if (animate) li.className = 'is-new';
  const t = document.createElement('span');
  t.className = 'log-t';
  const m = Math.floor(logT / 60), s = (logT % 60).toFixed(1).padStart(4, '0');
  t.textContent = `T+${String(m).padStart(2, '0')}:${s}`;
  const k = document.createElement('span');
  k.className = `log-src k-${kind}`;
  k.textContent = src;
  const p = document.createElement('span');
  p.className = 'log-msg';
  p.textContent = msg;
  li.append(t, k, p);
  return li;
}
function pushLog(animate = true) {
  const list = $('.log-list');
  list.appendChild(logLine(LOG[logIdx++ % LOG.length], animate));
  while (list.children.length > 7) list.firstElementChild.remove();
}
function logSync() {
  clearInterval(logTimer);
  logTimer = 0;
  if (state.ambient && logOnScreen) logTimer = window.setInterval(() => pushLog(true), 2600);
}
function initLog() {
  for (let i = 0; i < 6; i++) pushLog(false);
  const io = new IntersectionObserver((entries) => {
    logOnScreen = entries[0].isIntersecting;
    logSync();
  });
  io.observe($('.log'));
}

/* ------------------------------------------------------------------ */
/* access form                                                         */
/* ------------------------------------------------------------------ */
function initForm() {
  const form = $('#seed-form');
  const summary = $('.form-summary', form);
  const success = $('#seed-success');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const rules = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Enter your full name.'),
    email: (v) => (!v.trim() ? 'Enter your work email.' : EMAIL.test(v.trim()) ? '' : 'Enter an email address like name@company.com.'),
    org: (v) => (v.trim().length >= 2 ? '' : 'Enter the name of your organisation.'),
    size: (v) => (v ? '' : 'Choose a team size.'),
    cap: (v) => (v ? '' : 'Choose where the organism should start.'),
    msg: (v) => (v.trim().length >= 20 ? '' : `Describe one workflow in at least 20 characters (${v.trim().length} so far).`),
    consent: (v) => (v ? '' : 'Please confirm you understand this is a demo.'),
  };
  const errId = { name: 'f-name-err', email: 'f-email-err', org: 'f-org-err', size: 'f-size-err', cap: 'f-cap-err', msg: 'f-msg-err', consent: 'f-consent-err' };
  const value = (name) => {
    if (name === 'cap') return (form.querySelector('input[name="cap"]:checked') || {}).value || '';
    if (name === 'consent') return form.elements.consent.checked;
    return form.elements[name].value;
  };
  const control = (name) => (name === 'cap' ? form.querySelector('input[name="cap"]') : form.elements[name]);
  const check = (name) => {
    const msg = rules[name](value(name));
    $(`#${errId[name]}`).textContent = msg;
    if (name === 'cap') {
      $$('input[name="cap"]', form).forEach((r) => r.setAttribute('aria-invalid', msg ? 'true' : 'false'));
      $('.cap-field', form).classList.toggle('is-invalid', !!msg);
    } else control(name).setAttribute('aria-invalid', msg ? 'true' : 'false');
    return msg;
  };
  const touched = new Set();
  ['name', 'email', 'org', 'msg'].forEach((n) => {
    form.elements[n].addEventListener('blur', () => {
      touched.add(n);
      check(n);
    });
    form.elements[n].addEventListener('input', () => touched.has(n) && check(n));
  });
  form.elements.size.addEventListener('change', () => check('size'));
  form.elements.consent.addEventListener('change', () => check('consent'));
  $$('input[name="cap"]', form).forEach((r) =>
    r.addEventListener('change', () => {
      check('cap');
      setTopology(r.value, { announce: true, source: 'form' });
    })
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = Object.keys(rules).map((n) => [n, check(n)]).filter(([, m]) => m);
    if (errors.length) {
      summary.hidden = false;
      summary.textContent = `${errors.length === 1 ? 'One field needs' : `${errors.length} fields need`} attention before the seed can be planted.`;
      control(errors[0][0]).focus();
      return;
    }
    summary.hidden = true;
    const cap = value('cap');
    $('[data-success-cap]').textContent = CAP_META[cap].name;
    form.hidden = true;
    success.hidden = false;
    success.focus();
    setTopology(cap, { source: 'form' });
    if (!growTo(state.gen + 1)) state.organism?.stimulateRoot();
    else window.setTimeout(() => state.organism?.stimulateRoot(), 1800);
  });

  success.addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="reset-form"]')) return;
    form.reset();
    touched.clear();
    Object.values(errId).forEach((id) => ($(`#${id}`).textContent = ''));
    $$('[aria-invalid]', form).forEach((el) => el.setAttribute('aria-invalid', 'false'));
    $('.cap-field', form).classList.remove('is-invalid');
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */
initHero();
initHeader();
initScan();
initAnatomy();
initTrack();
initLog();
initForm();
initSections();
initChapters();
updateGenUI(false);
updateTopologyUI('init');
setAmbient(state.ambient);
bootOrganism();

// hash routes: re-anchor once late layout (fonts, pinned track height) has settled
window.addEventListener('load', () => {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (target) window.setTimeout(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }), 60);
});
