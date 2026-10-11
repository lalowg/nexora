# NEXORA — The Living Intelligence

**Production:** `https://nexora-ashy-ten.vercel.app`

A concept website for a fictional AI platform that is designed, built and sold as a *digital organism*. Instead of a product tour, the page opens on a living neural universe rendered in WebGL. It grows new branches as you explore, and it physically re-wires itself when you choose one of its four capabilities.

> Fictional concept brand — portfolio project. NEXORA is not a real company, product or service. The visualisation is illustrative and does not model any real system.

---

## Concept

Most AI platforms market themselves as a stack of features. NEXORA's position is that intelligence in an organisation should behave like a body: one nervous system shared by every capability, grown where the work needs it and pruned where it doesn't. The website *is* that organism. Every section reads it, dissects it or feeds it:

| # | Section | Composition | What it does |
|---|---|---|---|
| 01 | **Organism** | Full-bleed living network, HUD capability rail, telemetry strip | Signature interaction: rewire, fire signals, grow, turn |
| 02 | **Capabilities** | Sticky split spread over the live organism | Each chapter re-wires the same neurons into a new topology as it scrolls into view |
| 03 | **Anatomy** | Annotated scientific plate + index list | A cross-section figure; selecting a layer isolates it |
| 04 | **Growth** | Pinned horizontal journey (desktop) / timeline (mobile) | Seed → Sense → Learn → Branch → Prune → Mature, drawn as one cumulative branching glyph |
| 05 | **Protocol** | Typographic ledger + sticky terminal | Four governance principles and an illustrative, clearly labelled signal log |
| 06 | **Access** | Form panel beside the live organism | Choosing a capability re-wires the organism; submitting "plants a seed" (demo only) |

## Brand & positioning

- **Name:** NEXORA — *nexus* + *aura*: the connective, glowing layer between people, systems and decisions.
- **Line:** The Living Intelligence.
- **Positioning:** an AI platform for organisations that want autonomy *with* supervision. Grown, not assembled; observable, bounded, reversible and answerable.
- **Voice:** precise and calm, biological metaphors used with restraint. No metrics, clients, awards or testimonials are invented.

## Audience

Operations, platform and transformation leads at mid-size and large organisations who are past the chatbot-pilot stage and are evaluating agentic AI, but who need to explain governance to risk, legal and the board.

## Art direction

A dark observation chamber. The organism is the only light source; every interface element is an instrument reading it.

- **Palette:** charcoal `#0B0D10` (the chamber), cyan `#29E3F2` (signal, live state), ultraviolet `#7A4DFF` (deep cognition, memory), bone `#E7E9EE` (type, flashes of activity). A lighter violet (`#A98BFF`) is used for small text so contrast holds.
- **HUD language:** hairlines, chamfered corners, corner brackets, tabular numerals, uppercase micro-labels with wide tracking, a live field-coordinate readout.
- **Texture:** fixed film grain over everything, vignetting around the organism, depth-faded neurons that read like bokeh.
- **Imagery:** 100% original: the WebGL organism, a generated anatomy plate, procedurally generated growth glyphs, and capability wiring diagrams that are 2D projections of the *same* topology generators the WebGL scene uses.
- **Logo:** an "N" built from synapses and neurons inside an open cell membrane, with a bud breaking out through the gap. The intelligence is outgrowing its boundary, but only through the opening it has been given. The wordmark is drawn as chamfered strokes that echo Tomorrow.

## Typography

- **Display / HUD:** Tomorrow (300, 400, 500, 600): engineered, squared, slightly futurist without being sci-fi kitsch.
- **Text:** Hanken Grotesk (400, 500, 600): warm, highly legible grotesque for long reading.
- Fluid sizes with `clamp()`. Headings use `overflow-wrap: normal` and are sized to fit at 360 px, so words never break mid-word.

## Motion language

Motion behaves like a nervous system, not like a slideshow:

- **Growth:** new neurons sprout from their parent and extend their synapse as they travel, with a bright birth flash.
- **Re-wiring:** neurons migrate core-outward in a staggered wave with a slight swirl. The old synapse layer dissolves while the new wiring fades in. Once the network settles, a signal fires from the core to show it is "online".
- **Signals:** travelling pulses on a subset of synapses, plus breadth-first stimulus waves that ripple hop by hop through the real graph.
- **Acquisition scan:** headings are revealed by a cyan scan line sweeping across them, instead of the usual fade-up.
- **Decode:** the hero headline resolves letter by letter from cyan blocks through ultraviolet into bone.
- **Telemetry:** counters tick to new neuron and synapse totals, and the generation meter in the header pulses when the organism grows.

## Signature interaction — how to use it

1. **Choose a capability** in the HUD rail (*Organism, Agents, Automation, Perception, Reasoning*). The same neurons re-wire into a new topology:
   - **Organism:** dendritic whole
   - **Agents:** colony (seven autonomous sub-colonies with negotiation channels)
   - **Automation:** circulation loop (a braided trefoil that closes only when fully grown)
   - **Perception:** receptive shells (bundled receptors converging inward)
   - **Reasoning:** deliberation tree (branching plans, with the chosen path highlighted)
2. **Drag** the empty field to turn the organism. **Tap or click** anywhere on it to fire a signal from the nearest neuron and watch it ripple through the graph. Hovering shows an "attention" light that brightens nearby neurons.
3. **Explore the page.** Each section you visit for the first time grows the organism by one generation (six in total). If the organism is off-screen, the growth waits until you return so you can watch it sprout. You can also press **Grow branch**.
4. **Scroll through Capabilities.** Each chapter re-wires the organism as it crosses the middle of the screen.
5. **In Access**, picking where the seed should start re-wires the organism live. Submitting grows it and fires a signal.

**Keyboard:** the rail is a radio group (Tab to enter, arrow keys / Home / End to re-wire). The telemetry buttons give keyboard access to everything the pointer can do: *Fire signal, Grow branch, Turn left, Turn right, Pause/Play motion*. Every control has a visible focus state.

## Tech

- Static HTML/CSS/JS, no build step at runtime. ES modules:
  - `topology.js`: pure, deterministic generators for the five topologies. Each is a growth process (every node's parent has a lower index), so any prefix of nodes is a connected organism. Also contains the BFS hop distances and projection helpers.
  - `scene.js`: Three.js r169 (import map, jsDelivr). Instanced billboard neurons (`InstancedBufferGeometry`) and two cross-fading `LineSegments` synapse layers, all with custom GLSL: glow cores and halos, travelling pulses, stimulus waves, birth flashes, depth fade, pointer attention. Additive blending, no post-processing.
  - `fallback.js`: SVG renderer with the same API for browsers without WebGL.
  - `main.js`: orchestration (rail, exploration growth, scroll-linked re-wiring, anatomy plate, pinned growth track, signal log, form validation, menu).
- The inline SVG art (anatomy plate, growth glyphs, wiring diagrams) is generated once from the same topology code by a scratch script and committed as static markup.
- No network calls besides fonts and the Three.js module. The form never sends data.

## Local development

```bash
npx serve .
```

Then open the printed local URL. A server is needed because ES modules don't load from `file://`.

## Accessibility

- Semantic landmarks, one `<h1>`, skip link, `aria-current` on the section in view, a polite live region announcing re-wires and growth that you trigger yourself.
- The canvas is decorative (`aria-hidden`). The hero carries a text description of the visualisation, and every canvas interaction has a button or keyboard equivalent.
- The capability rail is a proper `radiogroup` with roving tabindex. The anatomy layers are toggle buttons (`aria-pressed`).
- Form: real client-side validation with inline errors linked through `aria-describedby`, `aria-invalid`, an error summary (`role="alert"`) and focus moved to the first invalid field. The success state says clearly that nothing was sent.
- `prefers-reduced-motion: reduce`: no autoplaying motion (the organism is still, the log doesn't stream, no decode or scan effects, and growth appears instantly). Everything stays fully interactive, and re-wires use short transitions. A **Pause motion** control is always available (hero and signal log) and also pauses the CSS loops.
- Text contrast is tuned for the dark ground. Muted copy is at least 66% bone, and the light violet is used for small type.

## Performance

- One WebGL context. Device-pixel ratio capped at 2 on desktop and 1.5 on mobile, with an adaptive drop to 1× if frames run slow.
- 1,600 neurons on desktop, 720 on small or low-core devices. Fewer dust particles on mobile.
- The render loop only runs while an "organism" section is on screen (IntersectionObserver) and the tab is visible. With motion paused it renders on demand, only while a transition is running.
- Per-frame CPU work is linear and allocation-free. Buffer uploads are limited to the live range (`addUpdateRange`).
- Three.js is loaded by dynamic import after the UI is ready. If it fails (offline CDN, no WebGL), the SVG fallback takes over with the same controls.
- Fonts: two families, only the weights used, `display=swap`. Hand-written JS is about 77 KB.

## Known limitations

- The topologies are artistic, not functional models of AI systems; labels say so.
- Without WebGL, the SVG fallback re-wires and grows instantly with a cross-fade instead of migrating neurons, and has no pointer attention light.
- The signal log, readouts and counts are illustrative and fictional.
- The horizontal growth track switches to a vertical timeline below 900 px wide or 620 px tall.
- `og.jpg` is produced separately by the portfolio lead.

## Credit

Designed & built by Saad Bashir — https://www.linkedin.com/in/saadbashirmarketing/
