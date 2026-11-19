# vf.js — animation kernel API

The kernel keeps the founding contract — **the whole frame is a pure function of
time `t`** — and gives it a vocabulary. Everything below is seekable: evaluate at
any `t`, in any order, and you get the identical frame. Load order matters:

```html
<script src="vf.js"></script>   <!-- kernel -->
<script src="fx-lib.js"></script> <!-- FX on top of the kernel -->
```

---

## Values

### `VF.interp(x, inRange, outRange, { ease, extrapolate })`

Multi-keyframe interpolation. Ranges must be equal length and `inRange` strictly
increasing (throws otherwise — good, typos should be loud).

```js
VF.interp(t, [0, 0.6], [0, 100], { ease: 'outCubic' });            // 0→100 over 0.6s
VF.interp(t, [0, 1, 3, 3.6], [0, 1, 1, 0]);                        // fade in, hold, fade out
VF.interp(t, [0, 1, 2], [0, 1, 0], { ease: ['outCubic', 'inCubic'] }); // per-segment easing
```

- `ease` — an `VF.Ease` name string, a function, or an **array** (one per segment).
- `extrapolate` — `'clamp'` (**default**; the most common code-video bug is a
  value drifting past its range), `'extend'` (continue the end segments),
  `'wrap'`, `'identity'`.

### `VF.Ease`

Full family: `linear · in/out/inOut × {Quad, Cubic, Quart, Sin, Exp, Circle,
Back, Elastic, Bounce}` · `bezier(x1, y1, x2, y2)` (CSS cubic-bezier) ·
`step(n, 'floor'|'ceil')` (discrete staircase — ticking counters, stop-motion)
· modifiers `Ease.out(Ease.inBack)` etc.

### `VF.spring(x, w, z)` → progress 0..1

Raw closed-form spring: `x` = seconds since the target change. Analytic —
never integrate, so `t=90` computes without touching `t=0..89`. Handles
critically damped `z ≥ 1` correctly.

### `VF.springAt(t, { at, preset | w, z, from, to, duration, reverse })`

The one you use in `render(t)`: a spring that starts at absolute time `at`.

```js
VF.springAt(t, { at: 0.2, preset: 'hero' });                       // 0→1, hero preset
VF.springAt(t, { at: 1.0, from: 0, to: 320, duration: 0.8 });      // curve stretched to settle at exactly 0.8s
VF.springAt(t, { at: 2.0, reverse: true });                        // exit: 1→0
```

Presets (`VF.springPreset(name)` / `preset:` option), from craft-rules:

| preset | w | z | use for |
|---|---|---|---|
| `button` | 24 | 0.80 | buttons, indicators, small chips |
| `container` | 15 | 0.72 | cards, panels, camera moves |
| `hero` | 10 | 0.92 | hero type, logos — big and slightly slow |
| `sticker` | 18 | 0.45 | mascots, stickers — visibly bouncy |

### `VF.beat(t, te, amp = 0.03, dec = 9)`

Exponential decay pulse at trigger time `te` — camera punches, flashes, shake
envelopes. Zero before `te`, decays after.

### `VF.random(seed)` · `VF.int(seed, n)` · `VF.pick(seed, arr)`

Seeded randomness — **seed is mandatory** (throws without one). Same seed +
same call site ⇒ same value on every frame and every worker.

```js
const hue = VF.random('particles-3');        // 0..1
const idx = VF.int('slot-' + i, colors.length);
```

---

## Time anchors (named events)

### `VF.events(map)` · `VF.at(name, offset = 0)`

Code expresses **dependency**; the numbers live in one anchor table. Moving an
anchor moves everything hanging off it. `VF.events` also accepts the `lines`
array from `vo_timeline.json` and auto-registers `l1`, `l1.start`, `l1.end`, …

```js
VF.events({ beat: 1.15, reveal: 2.4 });       // or: VF.events(TIMELINE.lines)
VF.at('reveal');          // 2.4
VF.at('reveal', -0.15);   // 2.25 — effect lands 150ms early
VF.at('l3.end');          // narration line 3 ends here
```

Unknown anchors throw and list the registered names — no more silent `undefined`
constants.

---

## Timeline

### `VF.scene({ dur, layers })` → `{ render(t), dur, layers }`

Builds a standard `window.render`. Each **layer** is one element + a time window
with **local time**; outside the window it is hidden (`visibility:hidden`).
Overlaps are legal and stack by `z`.

```js
const film = VF.scene({ dur: TIMELINE.total, layers: [
  VF.layer({ id: 's1', el: $('#s1'), at: 0, dur: VF.at('l1.end'), fn: (t) => { ... } }),
  VF.layer({ id: 's2', el: $('#s2'), at: VF.after('s1'), dur: 3, z: 1, fn: (t) => { ... } }),
]});
window.render = (t) => { film.render(t); fx(t); caps(t); };
```

- layer fields: `{ id, el, at, dur, z, fn }` — `fn(localT, globalT)`; `el` gets
  its visibility toggled; omit `at` to start at 0; omit `dur` to run to the end.
- `fn` draws or sets styles; canvas layers just don't pass `el` (or pass the
  canvas and draw in `fn`).

### `VF.after(id, offset = 0)`

Relative anchor: "start when layer `id` ends, plus offset". Change one layer's
`dur` and everything downstream slides automatically — no re-typed numbers.
Unresolved or circular references throw.

### `VF.animate(el, t, tracks)`

Declarative per-element animation, evaluated as a pure function of `t`.
Contributions **compose**: an entrance and an exit on the same element multiply
their opacities and concatenate transforms.

```js
VF.animate($('card'), t, [
  { at: 0.2, spring: 'container', from: { opacity: 0, y: 60 } },       // spring entrance
  { at: 2.8, dur: 0.4, ease: 'inCubic', to: { opacity: 0, x: -80 } },  // directed exit
]);
```

- track: `{ at, dur = 0.6, spring | ease, from, to }` — spring takes a preset
  name or `{ w, z }`; animatable keys: `opacity, x, y, scale, rotate`.

---

## Look

### `VF.theme(overrides)` → palette

Every FX reads the theme live; one call re-skins the whole film.

```js
VF.theme({ fn: '#FF6B6B', alt: '#FFD98A' });   // defaults are the IDE-dark palette
```

Keys: `bg · text · dim · kw · fn · num · warn · alt` (IDE-dark syntax palette
from SKILL.md).

---

## Sugar

`VF.clamp(x, a, b)` · `VF.lerp(a, b, k)` · `VF.$(id)` — plus introspection
`VF._anchors()` / `VF._presets` for agent self-checks and tests.

---

## Ground rules (unchanged, now enforceable)

- No `Math.random` / `Date.now` / `performance.now` / rAF / timers / CSS
  transitions — `scripts/lint_page.py` fails the build on any of them
  (`// vf:allow` for justified, reviewed exceptions).
- Any frame must re-render identically in isolation — guard it with
  `scripts/regression.py` (golden-frame hashes) before shipping.
