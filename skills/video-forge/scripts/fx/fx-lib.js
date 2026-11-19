/* ============================================================
 * video-forge fx-lib.js  v2.0 — production FX, built on the vf.js kernel
 * Deterministic: every frame is a pure function of time t.
 * Requires vf.js (loaded first). Extends the same window.VF namespace:
 *   <script src="vf.js"></script>
 *   <script src="fx-lib.js"></script>
 * All FX read VF.theme() live — re-skin with VF.theme({ fn: '#FF6B6B', ... }).
 * Credits: hardened in production on top of the MIT-licensed
 *          xilo-opus-video renderer (see README).
 * ============================================================ */
(function () {
  'use strict';
  if (!window.VF) throw new Error('fx-lib.js requires vf.js — load it first');
  const { clamp, lerp, spring, beat, random, int, Ease, interp } = window.VF;
  const T = () => window.VF.theme();

  /* #rrggbb -> rgba string with alpha */
  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- DOM helpers ---------- */

  /* Typewriter: writes `text` into el over [at, at+dur], auto cursor.
   * Escape any literal '<' in text (&lt;) before passing. */
  function typewriter(el, text, t, at, dur, opts = {}) {
    const { cursor = true } = opts;
    const n = Math.floor(interp(t, [at, at + dur], [0, text.length], { ease: 'linear' }));
    el.innerHTML = text.slice(0, n) + (cursor && n < text.length && n > 0 ? '<span class="vf-cursor"></span>' : '');
    if (cursor && n >= text.length) el.innerHTML = text; /* drop the cursor on the last char */
  }

  /* ---------- Canvas FX (pass the 2d ctx; W/H default to 1080p) ---------- */

  /* Shockwave ring — logo / card / number landings */
  function ring(cx, t, te, x, y, opts = {}) {
    const { color = T().fn, maxr = 800, dur = 0.8, alpha = 0.6, width = 9 } = opts;
    const p = t - te; if (p < 0 || p > dur) return;
    const k = p / dur;
    cx.globalAlpha = (1 - k) * alpha; cx.strokeStyle = color; cx.lineWidth = width * (1 - k) + 1.5;
    cx.beginPath(); cx.arc(x, y, 30 + k * maxr, 0, 7); cx.stroke(); cx.globalAlpha = 1;
  }

  /* Glitch transition — horizontal displaced slices at a cut ±0.32s.
   * Slices wrap around the edges (v1 leaked background at the borders). */
  function glitch(cx, t, te, opts = {}) {
    const { W = 1920, H = 1080, strength = 1, slices = 8 } = opts;
    const p = t - te; if (p < -0.03 || p > 0.32) return;
    const fade = 1 - Math.abs(p) / 0.32;
    const th = T(); const cols = [rgba(th.fn, .5), rgba(th.warn, .45), rgba(th.kw, .45)];
    const seed = Math.floor(te * 10);
    for (let i = 0; i < slices; i++) {
      const y = random(seed * 3 + i) * (H - 40), h = 6 + random(seed * 7 + i) * 36;
      const off = (random(seed * 11 + i) - 0.5) * 90 * strength * fade;
      cx.globalAlpha = fade * 0.8 * strength; cx.fillStyle = cols[i % 3];
      cx.fillRect(off, y, W, h);
      cx.fillRect(off > 0 ? off - W : off + W, y, W, h);   /* wrap the far edge */
    }
    cx.globalAlpha = 1;
  }

  /* Comet trails — ambient background layer, call every frame */
  function comets(cx, t, opts = {}) {
    const { W = 1920, H = 1080, n = 9, alpha = 0.15, color = T().alt } = opts;
    for (let i = 0; i < n; i++) {
      const sp = 140 + random(i * 13 + 5) * 260, x = ((t * sp + random(i * 3) * W * 1.25) % (W * 1.25)) - W * 0.125;
      const y = H * 0.08 + random(i * 7 + 2) * H * 0.82, len = 90 + random(i * 5 + 1) * 130;
      cx.globalAlpha = alpha + random(i * 11) * alpha;
      const g = cx.createLinearGradient(x, y, x + len, y + len * 0.22);
      g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, .9));
      cx.strokeStyle = g; cx.lineWidth = 1.6 + random(i) * 1.4;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + len, y + len * 0.22); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  /* Light sweep — transitions / outros */
  function sweep(cx, t, te, opts = {}) {
    const { W = 1920, H = 1080, alpha = 0.12, color = '#FFFFFF' } = opts;
    const p = t - te; if (p < 0 || p > 0.9) return;
    const k = p / 0.9;
    const g = cx.createLinearGradient(k * (W + 500) - 400, 0, k * (W + 500), H * 0.2);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(.5, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    cx.fillStyle = g; cx.fillRect(k * (W + 500) - 400, 0, 400, H);
  }

  /* Radial ray burst — end cards / big moments */
  function radialBurst(cx, t, te, x, y, opts = {}) {
    const { n = 24, seed = 1, maxr = 900, dur = 0.7, colors = [T().alt, T().num] } = opts;
    const p = t - te; if (p < 0 || p > dur) return;
    const k = p / dur;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + seed;
      const r1 = 30 + k * maxr, r2 = r1 + 50 * (1 - k);
      cx.globalAlpha = (1 - k) * 0.8; cx.strokeStyle = colors[i % colors.length]; cx.lineWidth = 3;
      cx.beginPath(); cx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); cx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  /* Particle burst — stamps / badges / landing points */
  function burst(cx, t, te, x, y, opts = {}) {
    const { n = 12, seed = 1, dur = 0.55, colors = [T().alt, T().num] } = opts;
    const p = t - te; if (p < 0 || p > dur) return;
    const k = p / dur;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + seed, sp = 180 + random(seed * 9 + i) * 260;
      const r1 = 14 + p * sp, r2 = r1 + 16 * (1 - k);
      cx.globalAlpha = (1 - k) * 0.85; cx.strokeStyle = colors[i % colors.length]; cx.lineWidth = 2.5;
      cx.beginPath(); cx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); cx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  /* Flow dots along a polyline — pipelines / diagrams.
   * pts: [[x1,y1],[x2,y2],...]  (v1 only did straight lines) */
  function flowdots(cx, t, pts, on, opts = {}) {
    if (!on) return;
    const { n = 3, speed = 0.35, size = 5, color = T().fn } = opts;
    let L = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(d); L += d;
    }
    for (let i = 0; i < n; i++) {
      const k = ((t * speed) + i / n) % 1;
      let d = k * L, x = pts[pts.length - 1][0], y = pts[pts.length - 1][1];
      for (let s = 0; s < segs.length; s++) {
        if (d <= segs[s]) {
          const f = segs[s] ? d / segs[s] : 0;
          x = lerp(pts[s][0], pts[s + 1][0], f); y = lerp(pts[s][1], pts[s + 1][1], f);
          break;
        }
        d -= segs[s];
      }
      cx.globalAlpha = 0.85 * Math.sin(k * Math.PI); cx.fillStyle = color;
      cx.beginPath(); cx.arc(x, y, size, 0, 7); cx.fill();
    }
    cx.globalAlpha = 1;
  }

  /* ---------- camera: punch + seeded shake (apply to #stage transform) ---------- */
  function camera(t, cuts, opts = {}) {
    const { punch = 0.03, shake = 5, seed = 1 } = opts;
    let pk = 1, sx = 0, sy = 0;
    cuts.forEach((te, i) => {
      pk += beat(t, te, punch);
      const b = beat(t, te, 1, 11);                 /* fast-decay shake envelope */
      const f1 = 40 + random(seed * 7.3 + i * 1.7) * 40;
      const f2 = 40 + random(seed * 3.1 + i * 2.3) * 40;
      const p1 = random(seed * 9.7 + i * 3.1) * Math.PI * 2;
      const p2 = random(seed * 5.9 + i * 4.7) * Math.PI * 2;
      sx += Math.sin(t * f1 + p1) * shake * b;
      sy += Math.cos(t * f2 + p2) * shake * 0.6 * b;
    });
    return `scale(${pk.toFixed(4)}) translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)`;
  }

  /* ---------- burned-in caption track ----------
   * lines: [{start, end, text}] — same shape as vo_timeline.json lines.
   * Default style matches SKILL.md: bottom 4.5%, 54px bold white, heavy outline. */
  function captions(lines, opts = {}) {
    const o = Object.assign({
      size: 54, bottom: 0.045, color: '#FFFFFF', outline: 'rgba(7,9,15,.85)',
      font: "'Inter','Microsoft YaHei',sans-serif", weight: 700, maxW: 0.86, bg: null,
      preset: 'container',
    }, opts);
    let d = document.getElementById('vf-caption');
    if (!d) {
      d = document.createElement('div'); d.id = 'vf-caption';
      d.style.cssText = `position:absolute;left:0;right:0;bottom:${(o.bottom * 100)}%;display:flex;justify-content:center;align-items:flex-end;pointer-events:none;z-index:40;opacity:0`;
      const s = document.createElement('div');
      s.style.cssText = `font-family:${o.font};font-weight:${o.weight};white-space:pre-wrap;text-align:center;line-height:1.4;`;
      d.appendChild(s); (document.getElementById('stage') || document.body).appendChild(d);
    }
    const inner = d.firstChild;
    inner.style.fontSize = o.size + 'px';
    inner.style.maxWidth = (o.maxW * 100) + '%';
    if (o.bg) { inner.style.background = o.bg; inner.style.padding = '10px 30px'; inner.style.borderRadius = '14px'; }
    return function renderCaptions(t) {
      const line = lines.find(c => t >= c.start - 0.08 && t <= c.end + 0.15);
      if (!line) { d.style.opacity = 0; return; }
      const k = spring(t - line.start, ...presetArgs(o.preset));
      inner.style.color = o.color;
      inner.style.textShadow = `0 0 12px ${o.outline},0 2px 0 ${o.outline},-2px 0 0 ${o.outline},2px 0 0 ${o.outline},0 -2px 0 ${o.outline}`;
      inner.textContent = line.text;
      d.style.opacity = clamp(k * 1.5, 0, 1).toFixed(3);
      d.style.transform = `translateY(${((1 - k) * 26).toFixed(1)}px)`;
    };
  }
  function presetArgs(name) {
    const p = window.VF._presets[name] || window.VF._presets.container;
    return [p.w, p.z];
  }

  /* publish onto the kernel namespace (animate already lives on VF) */
  Object.assign(window.VF, {
    typewriter,
    ring, glitch, comets, sweep, radialBurst, flowdots, burst, camera, captions,
    rgba,
  });
})();

/* cursor style for the typewriter (theme-aware), injected once */
(function () {
  const st = document.createElement('style');
  const c = (window.VF && window.VF.theme().fn) || '#38E1C8';
  st.textContent = `.vf-cursor{display:inline-block;width:.55em;height:1.1em;background:${c};vertical-align:-0.12em;margin-left:2px}`;
  document.head.appendChild(st);
})();
