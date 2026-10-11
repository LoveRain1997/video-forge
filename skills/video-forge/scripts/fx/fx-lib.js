/* ============================================================
 * video-forge fx-lib.js  v1.0 — plug-and-play FX library
 * Deterministic: every frame is a pure function of time t, so any
 * single frame can be re-rendered in isolation.
 * Usage: <script src="fx-lib.js"></script> then window.VF.*
 * Credits: hardened in production on top of the MIT-licensed
 *          xilo-opus-video renderer (see README).
 * ============================================================ */
window.VF = (function () {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => sstep(a, b, t);
  const segOut = (t, a, b) => 1 - sstep(a, b, t);
  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const lerp = (a, b, k) => a + (b - a) * k;

  /* 闭式弹簧：x=距目标改变的时间(秒)。w 越大越快，z 越小回弹越大 */
  function spring(x, w = 14, z = 0.72) {
    if (x <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }
  /* 确定性伪随机 */
  function rnd(s) { const v = Math.sin(s * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  /* 节拍冲击：te 时刻的指数衰减脉冲（镜头 punch / 闪光 / 震屏共用） */
  const beat = (t, te, amp = 0.03, dec = 9) => { const x = t - te; return x < 0 ? 0 : amp * Math.exp(-x * dec); };
  const $ = id => document.getElementById(id);
  function setE(el, o, tf) { el.style.opacity = o; if (tf !== undefined) el.style.transform = tf; }

  /* 元素弹入：位移+缩放+透明度一次到位（默认容器档参数） */
  function pop(el, t, te, dx = 0, dy = 60, w = 14, z = 0.72, sc = 1) {
    const s = spring(t - te, w, z);
    setE(el, clamp(s * 1.6, 0, 1), `translate(${(1 - s) * dx}px,${(1 - s) * dy}px) scale(${sc * (0.86 + 0.14 * s)})`);
  }
  /* 打字机：把 text 按 [t0,t1] 进度写进 el（innerHTML，光标自动附加） */
  function typewriter(el, text, t, t0, t1, cursor = true) {
    const n = Math.floor(clamp((t - t0) / (t1 - t0), 0, 1) * text.length);
    el.innerHTML = text.slice(0, n) + (cursor && n < text.length ? '<span class="vf-cursor"></span>' : '');
  }

  /* ---------- FX 画布特效（传入 2d ctx 与画布宽高） ---------- */

  /* 冲击波环 */
  function ring(cx, t, te, x, y, color = 'rgba(56,225,200,.8)', maxr = 800, dur = 0.8, alpha = 0.6) {
    const p = t - te; if (p < 0 || p > dur) return; const k = p / dur;
    cx.globalAlpha = (1 - k) * alpha; cx.strokeStyle = color; cx.lineWidth = 9 * (1 - k) + 1.5;
    cx.beginPath(); cx.arc(x, y, 30 + k * maxr, 0, 7); cx.stroke(); cx.globalAlpha = 1;
  }
  /* 故障转场：在切点 te ±0.32s 画横向错位切片（seed 取 te 保证确定性） */
  function glitch(cx, t, te, W = 1920, H = 1080, strength = 1) {
    const p = t - te; if (p < -0.03 || p > 0.32) return;
    const seed = Math.floor(te * 10);
    for (let i = 0; i < 8; i++) {
      const y = rnd(seed * 3 + i) * (H - 40), h = 6 + rnd(seed * 7 + i) * 36;
      const off = (rnd(seed * 11 + i) - 0.5) * 90 * strength * (1 - Math.abs(p) / 0.32);
      const col = ['rgba(56,225,200,.5)', 'rgba(255,85,85,.45)', 'rgba(108,178,255,.45)'][i % 3];
      cx.globalAlpha = (1 - Math.abs(p) / 0.32) * 0.8 * strength; cx.fillStyle = col;
      cx.fillRect(off, y, W, h);
    }
    cx.globalAlpha = 1;
  }
  /* 背景彗星拖尾（每帧调用，常驻层） */
  function comets(cx, t, W = 1920, H = 1080, n = 9, alpha = 0.15) {
    for (let i = 0; i < n; i++) {
      const sp = 140 + rnd(i * 13 + 5) * 260, x = ((t * sp + rnd(i * 3) * W * 1.25) % (W * 1.25)) - W * 0.125;
      const y = H * 0.08 + rnd(i * 7 + 2) * H * 0.82, len = 90 + rnd(i * 5 + 1) * 130;
      cx.globalAlpha = alpha + rnd(i * 11) * alpha;
      const g = cx.createLinearGradient(x, y, x + len, y + len * 0.22);
      g.addColorStop(0, 'rgba(143,216,255,0)'); g.addColorStop(1, 'rgba(143,216,255,.9)');
      cx.strokeStyle = g; cx.lineWidth = 1.6 + rnd(i) * 1.4;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + len, y + len * 0.22); cx.stroke();
    }
    cx.globalAlpha = 1;
  }
  /* 全屏光扫（转场/收尾） */
  function sweep(cx, t, te, W = 1920, H = 1080, alpha = 0.12) {
    const p = t - te; if (p < 0 || p > 0.9) return; const k = p / 0.9;
    const g = cx.createLinearGradient(k * (W + 500) - 400, 0, k * (W + 500), H * 0.2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${alpha})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g; cx.fillRect(k * (W + 500) - 400, 0, 400, H);
  }
  /* 径向射线爆发（定版/大事件） */
  function radialBurst(cx, t, te, x, y, n = 24, seed = 1, maxr = 900, dur = 0.7) {
    const p = t - te; if (p < 0 || p > dur) return; const k = p / dur;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + seed;
      const r1 = 30 + k * maxr, r2 = r1 + 50 * (1 - k);
      cx.globalAlpha = (1 - k) * 0.8; cx.strokeStyle = i % 3 ? '#8FD8FF' : '#FFD98A'; cx.lineWidth = 3;
      cx.beginPath(); cx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); cx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); cx.stroke();
    }
    cx.globalAlpha = 1;
  }
  /* 连线光点流动（管线/流程图） */
  function flowdots(cx, t, x1, y1, x2, y2, on, color = '#38E1C8') {
    if (!on) return;
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.35) + i / 3) % 1;
      cx.globalAlpha = 0.85 * Math.sin(k * Math.PI); cx.fillStyle = color;
      cx.beginPath(); cx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 5, 0, 7); cx.fill();
    }
    cx.globalAlpha = 1;
  }
  /* 粒子爆闪（贴纸/徽章/落定点） */
  function burst(cx, t, te, x, y, n = 12, seed = 1, dur = 0.55) {
    const p = t - te; if (p < 0 || p > dur) return; const k = p / dur;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + seed, sp = 180 + rnd(seed * 9 + i) * 260;
      const r1 = 14 + p * sp, r2 = r1 + 16 * (1 - k);
      cx.globalAlpha = (1 - k) * 0.85; cx.strokeStyle = i % 2 ? '#8FD8FF' : '#FFD98A'; cx.lineWidth = 2.5;
      cx.beginPath(); cx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); cx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  /* ---------- 镜头：punch + 震屏（挂在 #stage 的 transform 上） ---------- */
  function camera(t, cuts, punch = 0.03, shake = 5) {
    let pk = 1, sx = 0, sy = 0;
    cuts.forEach((te, i) => {
      pk += beat(t, te, punch);
      sx += Math.sin(t * (57 + i * 5)) * shake * beat(t, te, 1, 11);
      sy += Math.cos(t * (69 + i * 4)) * shake * 0.6 * beat(t, te, 1, 11);
    });
    return `scale(${pk}) translate(${sx}px,${sy}px)`;
  }

  /* ---------- 字幕轨道（画面内烧录式） ----------
   * CAPTIONS: [{start,end,text}]（与 vo_timeline.json 同构）
   * 在 body 里自动插入 #xvp-caption，每帧调 render(t) 即可。
   * 样式可用 opts 覆盖：{size, bottom, color, outline, maxW, font}
   */
  function installCaptions(CAPTIONS, opts = {}) {
    const o = Object.assign({
      size: 46, bottom: 0.065, color: '#FFFFFF', outline: 'rgba(4,8,20,.85)',
      font: "'Inter','Microsoft YaHei',sans-serif", weight: 700, maxW: 0.86, bg: null, popW: 16, popZ: 0.6
    }, opts);
    let d = document.getElementById('xvp-caption');
    if (!d) {
      d = document.createElement('div'); d.id = 'xvp-caption';
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
      const line = CAPTIONS.find(c => t >= c.start - 0.08 && t <= c.end + 0.15);
      if (!line) { d.style.opacity = 0; return; }
      const pop = spring(t - line.start, o.popW, o.popZ);
      inner.style.color = o.color;
      inner.style.textShadow = `0 0 12px ${o.outline},0 2px 0 ${o.outline},-2px 0 0 ${o.outline},2px 0 0 ${o.outline},0 -2px 0 ${o.outline}`;
      inner.textContent = line.text;
      d.style.opacity = clamp(pop * 1.5, 0, 1);
      d.style.transform = `translateY(${(1 - pop) * 26}px)`;
    };
  }

  return { clamp, sstep, seg, segOut, easeOut, lerp, spring, rnd, beat, $, setE, pop, typewriter,
           ring, glitch, comets, sweep, radialBurst, flowdots, burst, camera, installCaptions };
})();
/* 光标样式（打字机用），自动注入 */
(function(){const st=document.createElement('style');
 st.textContent=`.vf-cursor{display:inline-block;width:.55em;height:1.1em;background:#38E1C8;vertical-align:-0.12em;margin-left:2px}`;
 document.head.appendChild(st);})();
