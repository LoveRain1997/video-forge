/* ============================================================
 * video-forge vf.js  v2.0 — animation kernel
 * The frame stays a pure function of time t (any frame re-renders
 * identically in isolation). The kernel gives you the vocabulary:
 *
 *   VF.interp(x, [in], [out], {ease, extrapolate})   keyframe interpolation
 *   VF.Ease.outCubic / .bezier(...) / .inOut(f)      easing family
 *   VF.springAt(t, {at, preset|w,z, from,to, duration})  analytic spring
 *   VF.random(seed)                                  seeded randomness (required)
 *   VF.events(map) / VF.at(name)                     named time anchors
 *   VF.scene({dur, layers}) + VF.layer / VF.after    scene & layer timeline
 *   VF.animate(el, t, tracks)                        declarative DOM keyframes
 *   VF.theme({...})                                  palette every FX reads
 *
 * Load BEFORE fx-lib.js:  <script src="vf.js"></script>
 *                         <script src="fx-lib.js"></script>
 * ============================================================ */
window.VF = (function () {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const $ = id => document.getElementById(id);

  /* ================= Ease family ================= */
  const C1 = 1.70158, C2 = C1 * 1.525, C3 = C1 + 1;

  function outBounce(x) {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }

  /* CSS cubic-bezier timing: Newton-Raphson on x, bisection fallback */
  function bezier(x1, y1, x2, y2) {
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
      throw new Error('VF.Ease.bezier: x1/x2 must be in [0,1] (CSS constraint)');
    const A = (a1, a2) => 1 - 3 * a2 + 3 * a1;
    const B = (a1, a2) => 3 * a2 - 6 * a1;
    const C = a1 => 3 * a1;
    const fx = (t, a1, a2) => ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
    const dx = (t, a1, a2) => 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = fx(t, x1, x2) - x;
        if (Math.abs(err) < 1e-6) return fx(t, y1, y2);
        const d = dx(t, x1, x2);
        if (Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      let lo = 0, hi = 1;
      t = clamp(x, 0, 1);
      for (let i = 0; i < 24; i++) {
        const v = fx(t, x1, x2);
        if (Math.abs(v - x) < 1e-6) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return fx(t, y1, y2);
    };
  }

  /* Discrete staircase: quantize progress into n steps ("stop-motion" feel) */
  function step(n = 4, mode = 'floor') {
    const f = mode === 'ceil' ? Math.ceil : Math.floor;
    return x => f(clamp(x, 0, 1) * n) / n;
  }

  const Ease = {
    linear: x => x,
    inQuad: x => x * x,                       outQuad: x => 1 - (1 - x) * (1 - x),
    inOutQuad: x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) * (-2 * x + 2) / 2,
    inCubic: x => x ** 3,                     outCubic: x => 1 - (1 - x) ** 3,
    inOutCubic: x => x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2,
    inQuart: x => x ** 4,                     outQuart: x => 1 - (1 - x) ** 4,
    inOutQuart: x => x < .5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2,
    inSin: x => 1 - Math.cos(x * Math.PI / 2), outSin: x => Math.sin(x * Math.PI / 2),
    inOutSin: x => -(Math.cos(Math.PI * x) - 1) / 2,
    inExp: x => x === 0 ? 0 : 2 ** (10 * x - 10), outExp: x => x === 1 ? 1 : 1 - 2 ** (-10 * x),
    inOutExp: x => x === 0 ? 0 : x === 1 ? 1 : x < .5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,
    inCircle: x => 1 - Math.sqrt(1 - x * x),  outCircle: x => Math.sqrt(1 - (x - 1) ** 2),
    inOutCircle: x => x < .5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2,
    inBack: x => C3 * x ** 3 - C1 * x * x,    outBack: x => 1 + C3 * (x - 1) ** 3 + C1 * (x - 1) ** 2,
    inOutBack: x => x < .5 ? (2 * x) ** 2 * (C2 * 2 * x - C1) / 2 : ((2 * x - 2) ** 2 * (C3 * (2 * x - 2) + C2) + 2) / 2,
    outBounce, inBounce: x => 1 - outBounce(1 - x),
    inOutBounce: x => x < .5 ? (1 - outBounce(1 - 2 * x)) / 2 : (1 + outBounce(2 * x - 1)) / 2,
    inElastic: x => x === 0 ? 0 : x === 1 ? 1 : -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * (2 * Math.PI / 3)),
    outElastic: x => x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
    inOutElastic: x => x === 0 ? 0 : x === 1 ? 1 : x < .5
      ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * (2 * Math.PI / 4.5))) / 2
      : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * (2 * Math.PI / 4.5))) / 2 + 1,
    bezier, step,
    /* modifiers: Ease.out(Ease.inBack) ... */
    in: f => x => f(x),
    out: f => x => 1 - f(1 - x),
    inOut: f => x => x < 0.5 ? f(2 * x) / 2 : 1 - f(2 - 2 * x) / 2,
  };

  function resolveEase(e, seg = 0, all = 1) {
    if (typeof e === 'function') return e;
    if (Array.isArray(e)) return resolveEase(e[seg] !== undefined ? e[seg] : e[e.length - 1]);
    if (typeof e === 'string') {
      const f = Ease[e];
      if (!f) throw new Error(`VF: unknown ease '${e}'. Available: ${Object.keys(Ease).filter(k => typeof Ease[k] === 'function').join(', ')}`);
      return f;
    }
    if (e == null) return Ease.linear;
    throw new Error('VF: ease must be a function, a name string, or an array of either');
  }

  /* ================= interp — multi-keyframe interpolation ================= */
  /* Multi-keyframe interpolation. `extrapolate` defaults to 'clamp' — the
   * most common code-video bug is a value drifting past its range. */
  const mod = (n, m) => ((n % m) + m) % m;
  function interp(x, inR, outR, opts = {}) {
    const { ease = null, extrapolate = 'clamp' } = opts;
    if (!Array.isArray(inR) || !Array.isArray(outR)) throw new Error('VF.interp: inRange/outRange must be arrays');
    if (inR.length !== outR.length) throw new Error(`VF.interp: inRange (${inR.length}) and outRange (${outR.length}) must have equal length`);
    if (inR.length < 2) throw new Error('VF.interp: need at least 2 keyframes');
    for (let k = 1; k < inR.length; k++)
      if (inR[k] <= inR[k - 1]) throw new Error(`VF.interp: inRange must be strictly increasing (got ${inR[k - 1]} -> ${inR[k]})`);

    if (x < inR[0] || x > inR[inR.length - 1]) {
      if (extrapolate === 'clamp') return x < inR[0] ? outR[0] : outR[outR.length - 1];
      if (extrapolate === 'identity') return x;
      const n = inR.length - 1;
      if (extrapolate === 'extend') {
        if (x < inR[0]) return outR[0] + (outR[1] - outR[0]) * resolveEase(ease, 0)( (x - inR[0]) / (inR[1] - inR[0]) );
        return outR[n] + (outR[n] - outR[n - 1]) * resolveEase(ease, n - 1)( (x - inR[n]) / (inR[n] - inR[n - 1]) );
      }
      if (extrapolate === 'wrap') {
        const span = inR[n] - inR[0];
        x = inR[0] + mod(x - inR[0], span);
      } else throw new Error(`VF.interp: unknown extrapolate '${extrapolate}' (clamp|extend|wrap|identity)`);
    }

    let s = 0;
    while (s < inR.length - 2 && x >= inR[s + 1]) s++;
    const k = (x - inR[s]) / (inR[s + 1] - inR[s]);
    const f = resolveEase(ease, s, inR.length - 1);
    return outR[s] + (outR[s + 1] - outR[s]) * f(clamp(k, 0, 1));
  }

  /* ================= spring (analytic, seekable) ================= */
  /* Closed-form underdamped solution: x = seconds since the target change.
   * Never integrate — any t must be computable on its own. */
  function spring(x, w = 14, z = 0.72) {
    if (x <= 0) return 0;
    if (z >= 0.999) {                       /* critically damped: no oscillation */
      return 1 - (1 + w * x) * Math.exp(-w * x);
    }
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }

  /* Craft-rules presets: button w22-26 z.75-.85 · container w14-16 z.7-.75 ·
   * hero type w9-11 z.85-1 · sticker w16-20 z.4-.5 */
  const PRESETS = {
    button:    { w: 24, z: 0.8 },
    container: { w: 15, z: 0.72 },
    hero:      { w: 10, z: 0.92 },
    sticker:   { w: 18, z: 0.45 },
  };
  function springPreset(name) {
    const p = PRESETS[name];
    if (!p) throw new Error(`VF.springPreset: unknown preset '${name}'. Available: ${Object.keys(PRESETS).join(', ')}`);
    return { ...p };
  }

  /* Find w so the spring envelope settles to `tol` at `dur` (closed form). */
  function wForDuration(dur, z = 0.72, tol = 0.01) {
    if (dur <= 0) throw new Error('VF.springAt: duration must be > 0');
    const zz = Math.max(0.05, Math.min(z, 0.99));
    return Math.log(1 / tol) / (zz * dur);
  }

  /* springAt(t, {at, preset|w,z, from, to, duration, reverse}) — one call
   * gives the value at absolute time t for a spring that starts at `at`. */
  function springAt(t, o = {}) {
    let { at = 0, w, z = 0.72, from = 0, to = 1, duration = null, reverse = false, preset = null } = o;
    if (preset) { const p = springPreset(preset); if (w === undefined) w = p.w; z = p.z; }
    if (w === undefined) w = 14;
    if (duration != null) w = wForDuration(duration, z);
    let v = spring(t - at, w, z);
    if (reverse) v = 1 - v;
    return from + (to - from) * v;
  }

  /* Exponential decay pulse (camera punch / flash / shake share this). */
  const beat = (t, te, amp = 0.03, dec = 9) => { const x = t - te; return x < 0 ? 0 : amp * Math.exp(-x * dec); };

  /* ================= seeded random (seed mandatory) ================= */
  /* Unseeded randomness would tear frames apart across workers — seed is
   * mandatory. Same seed + same call site => same value, every frame. */
  function random(seed) {
    if (seed === undefined || seed === null)
      throw new Error('VF.random: seed required (string or number) — unseeded randomness is banned in render(t) pages.');
    let h = 1779033703 ^ String(seed).length;
    for (let i = 0; i < String(seed).length; i++) {
      h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const int = (seed, n) => Math.floor(random(seed) * n);          /* [0, n) */
  const pick = (seed, arr) => arr[int(seed, arr.length)];

  /* ================= named time anchors ================= */
  /* Code expresses dependency ("start when line 2 ends"); the numbers live in
   * one anchor table — from vo_timeline.json or hand-declared — and moving an
   * anchor moves everything that hangs off it. */
  let ANCHORS = {};
  function events(src) {
    if (Array.isArray(src)) {
      /* vo_timeline.json `.lines` → anchors `l1`, `l1.start`, `l1.end` (+ name if present) */
      const m = {};
      src.forEach(l => {
        const k = l.name || 'l' + l.i;
        if (typeof l.start === 'number') m[k + '.start'] = l.start;
        if (typeof l.end === 'number') { m[k + '.end'] = l.end; m[k] = l.end; }
      });
      ANCHORS = Object.assign({}, ANCHORS, m);
    } else if (src && typeof src === 'object') {
      ANCHORS = Object.assign({}, ANCHORS, src);
    } else throw new Error('VF.events: pass an object {name: seconds} or vo_timeline lines array');
    return { ...ANCHORS };
  }
  function at(name, offset = 0) {
    const v = ANCHORS[name];
    if (v === undefined)
      throw new Error(`VF.at: unknown anchor '${name}'. Known: ${Object.keys(ANCHORS).join(', ') || '(none — call VF.events first)'}`);
    return v + offset;
  }

  /* ================= theme ================= */
  /* IDE-dark syntax palette (the house look). FX read these live, so
   * VF.theme({ fn: '#FF6B6B' }) re-skins every effect. */
  const THEME = {
    bg: '#07090F', text: '#E8EDF8', dim: '#4A5878',
    kw: '#6CB2FF', fn: '#38E1C8', num: '#F4C64A',
    warn: '#FF5555', alt: '#8FD8FF',
  };
  function theme(overrides) {
    if (overrides) Object.assign(THEME, overrides);
    return { ...THEME };
  }

  /* ================= scene / layer timeline (Sequence model) ================= */
  /* A layer = one DOM element (or canvas draw fn) + a time window with LOCAL
   * time; outside the window it is hidden. Relative anchors via VF.after:
   * change one layer's dur and everything downstream slides automatically. */
  const isAfter = v => v && typeof v === 'object' && v.__vfAfter;
  function after(id, offset = 0) { return { __vfAfter: id, offset }; }
  function layer(def) { return def; }          /* sugar + future-proofing */

  function scene(cfg) {
    const { dur, layers = [] } = cfg;
    if (!(dur > 0)) throw new Error('VF.scene: dur (seconds) is required');
    const resolved = {}; const pending = [...layers]; let guard = 0;
    while (pending.length) {
      const L = pending.shift();
      if (!L.id) throw new Error('VF.scene: every layer needs an id');
      let start = L.at;
      if (isAfter(start)) {
        const ref = resolved[start.__vfAfter];
        if (ref === undefined) {
          pending.push(L);
          if (++guard > layers.length * 2 + 8)
            throw new Error(`VF.scene: unresolved or circular after('${start.__vfAfter}')`);
          continue;
        }
        start = ref.end + start.offset;
      }
      if (start === undefined) start = 0;
      const len = L.dur != null ? L.dur : dur - start;
      if (!(len > 0)) throw new Error(`VF.scene: layer '${L.id}' needs a positive dur`);
      if (start + len > dur + 1e-9)
        throw new Error(`VF.scene: layer '${L.id}' ends at ${(start + len).toFixed(2)}s — past scene dur ${dur}s`);
      L.__start = start; L.__end = start + len;
      resolved[L.id] = { start, end: L.__end };
    }
    const sorted = [...layers].sort((a, b) => (a.z || 0) - (b.z || 0));
    const render = (t) => {
      for (const L of sorted) {
        const on = t >= L.__start && t < L.__end;
        if (L.el) L.el.style.visibility = on ? 'visible' : 'hidden';
        if (!on || !L.fn) continue;
        L.fn(t - L.__start, t);               /* (localT, globalT) */
      }
    };
    return { render, dur, layers: resolved };
  }

  /* ================= declarative DOM animation ================= */
  /* One element, one list of tracks. Each track is evaluated as a pure
   * function of t (spring or eased interp), contributions compose: an
   * entrance and an exit on the same element multiply their opacities.
   *   VF.animate(el, t, [
   *     { at: 0.2, spring: 'hero',   from: { opacity: 0, y: 70 } },
   *     { at: 2.8, dur: 0.4, ease: 'inCubic', from: { opacity: 1, x: 0 }, to: { opacity: 0, x: -80 } },
   *   ]); */
  function animate(el, t, tracks) {
    if (!el) throw new Error('VF.animate: element is null (duplicate id? missing DOM?)');
    let op = 1; const tf = [];
    for (const tr of tracks) {
      const to = Object.assign({ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }, tr.to || {});
      const from = Object.assign({}, to, tr.from || {});
      const dur = tr.dur != null ? tr.dur : 0.6;
      let k;
      if (tr.spring) {
        const sp = typeof tr.spring === 'string' ? springPreset(tr.spring) : tr.spring;
        k = spring(t - (tr.at || 0), sp.w, sp.z != null ? sp.z : 0.72);
      } else {
        k = interp(t, [tr.at || 0, (tr.at || 0) + dur], [0, 1], { ease: tr.ease || 'outCubic' });
      }
      op *= lerp(from.opacity, to.opacity, k);
      tf.push(`translate(${lerp(from.x, to.x, k).toFixed(2)}px,${lerp(from.y, to.y, k).toFixed(2)}px)`);
      tf.push(`scale(${lerp(from.scale, to.scale, k).toFixed(4)})`);
      if (from.rotate || to.rotate) tf.push(`rotate(${lerp(from.rotate || 0, to.rotate || 0, k).toFixed(2)}deg)`);
    }
    el.style.opacity = clamp(op, 0, 1).toFixed(3);
    el.style.transform = tf.join(' ');
    return { opacity: +el.style.opacity, transform: el.style.transform };
  }

  return {
    /* sugar */
    clamp, lerp, $,
    /* values */
    Ease, interp, spring, springAt, springPreset, beat,
    /* randomness */
    random, int, pick,
    /* time anchors */
    events, at, after,
    /* timeline */
    scene, layer, animate,
    /* look */
    theme,
    /* introspection (agent self-check / tests) */
    _anchors: () => ({ ...ANCHORS }),
    _presets: PRESETS,
  };
})();
