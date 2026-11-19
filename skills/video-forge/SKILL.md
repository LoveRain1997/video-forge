---
name: video-forge
description: >-
  Make studio-grade videos entirely with code: the agent writes a render(t) web page,
  Playwright screenshots it frame by frame, FFmpeg assembles the MP4. Ships a deterministic
  animation kernel (keyframe interp with 30+ easings, analytic springs with presets, a
  scene/layer timeline with relative anchors, named time events, seeded randomness, a live
  theme system), a production FX library on top of it (glitch transitions, comet trails,
  shockwave rings, radial bursts, light sweeps, motion blur), an edge-tts narration pipeline
  (line-by-line synthesis with measured timings and a per-line cache, so every scene cut
  lands exactly on a sentence end, plus automatic music ducking), burned-in subtitles with
  SRT/ASS export, a determinism linter and golden-frame regression guard.
  Use when the user asks to "make a video / promo / explainer / motion graphic" —
  especially with voice-over, narration, subtitles, or "cool effects" — or wants to
  upgrade from basic code-video workflows. Also matches Chinese requests:
  做视频 带配音 加字幕 炫酷特效 宣传片 讲解片 旁白.
  Not for: generating photoreal footage with video models, editing existing clips in
  NLEs, or audio-only requests.
---

# video-forge — studio-grade videos, written as code

The agent does not "generate" video. It writes a deterministic web page exposing
`window.render(t)` (the whole frame as a pure function of time), screenshots it with
Playwright at N fps, and assembles an MP4 with FFmpeg. Sound is synthesized in code.
Because every frame is reproducible, any single frame — or any 3-second span — can be
re-rendered in isolation after a change.

Four pillars on top of that core loop:

1. **Animation kernel** (`scripts/fx/vf.js`) — keyframe `interp`, a full easing
   family, analytic springs with presets, a scene/layer timeline with relative
   anchors, named time anchors, seeded randomness, theme system. See
   `references/vf-api.md`.
2. **FX library** (`scripts/fx/fx-lib.js`) — production-hardened effects built on
   the kernel, all reading the live theme. Plug and play.
3. **Narration pipeline** (`scripts/tts.py`) — edge-tts line-by-line synthesis with
   *measured* durations and a per-line cache; scene cuts are derived from speech,
   never guessed.
4. **Subtitles** (`scripts/subtitles.py` + `fx-lib.js` caption track) — burned-in
   captions styled to match the film, plus SRT/ASS for platforms.

Guard rails: `scripts/lint_page.py` (determinism contract) and
`scripts/regression.py` (golden-frame hashes) keep films reproducible.

```
video-forge/
  SKILL.md              this file
  scripts/
    fx/vf.js            animation kernel (window.VF.* — load FIRST)
    fx/fx-lib.js        FX library + caption track (extends window.VF)
    tts.py              narration: edge-tts → measured timeline (vo_timeline.json) → vo.wav
    mixdown.py          music auto-duck under narration + sfx → loudnorm -14 LUFS
    subtitles.py        vo_timeline.json → SRT / ASS (with burn-in command)
    render.py           frame-by-frame renderer (--still / --subframes motion blur / --start)
    lint_page.py        determinism lint (banned: wall clock, timers, unseeded random)
    regression.py       golden-frame hashes (init / check / --update)
    analyze_video.py    finished-film contact sheet + cut detection (acceptance)
    check_env.py        environment check
    audio_tools.py      sfx synthesis / beat detection
  references/           vf-api · code-stack · plan-format · brief-template · craft-rules
```

Dependencies: Python 3.9+, numpy, playwright + chromium, FFmpeg. Narration additionally
needs `pip install edge-tts` (network access to Microsoft's TTS endpoint).
Run `python scripts/check_env.py` once before starting.

## Workflow (narration-first)

### Step 0 — Environment
`check_env.py`; for narrated films also `python -c "import edge_tts"`.
Install missing pieces only after telling the user.

### Step 1 — Brief & narration script
Ask at most 3 questions: aspect (default 1920×1080), **voice-over on/off + voice**
(default on; `en-US-AndrewMultilingualNeural` for English, `zh-CN-YunxiNeural` for
Chinese, rate +12%), subtitles on (default on). Then **write the narration script
first** and get it approved: one line per row, ≤ 20 words per line, line count
derived from target duration ÷ (≈4.8 words/s + 0.2s pause). Only after approval
move to production.

### Step 2 — Synthesize narration, lock the timeline
```
python scripts/tts.py --script narration.txt --outdir audio --voice en-US-AndrewMultilingualNeural --rate +12%
```
Produces `audio/vo_timeline.json` (per-line start/end + `suggested_cuts`) and
`audio/vo.wav`. Lines are cached per `voice|rate|pitch|text` in `audio/cache/` —
editing one line re-synthesizes only that line. **Every scene cut must land on a
line end** (rounded to 0.05s). Film duration = last line end + 0.7–1.2s. This
timeline is the single source of truth for scene windows, effect triggers,
counters, and captions.

### Step 3 — Three plans + previews
Following `references/code-stack.md`, propose three *distinct* plans (different in
style, structure, or stack — not just palette). Render one key frame each
(`render.py --still`), let the user pick, then write `brief.md` per
`references/brief-template.md`. The template adds three blocks on top of the
classic seven:

```
<narration>  line / start-end / scene mapping (from vo_timeline.json)
<effects>    which FX from the menu, triggered when (reference VF.at anchors)
<captions>   on/off, style (default: bottom 4.5%, 54px, bold white, heavy outline)
```

### Step 4 — Build: index.html + vf.js + fx-lib.js
Copy `scripts/fx/vf.js` **and** `scripts/fx/fx-lib.js` into the project, include
vf.js first. Build scenes with the kernel (see `references/vf-api.md`):

```js
VF.events(TIMELINE.lines);                     // anchors: l1, l1.end, l2, ...
const film = VF.scene({ dur: TIMELINE.total, layers: [
  VF.layer({ id: 's1', el: $('#s1'), at: 0, dur: VF.at('l1.end'), fn: (t) => {
    VF.animate($('#hero'), t, [{ at: 0.15, spring: 'hero', from: { opacity: 0, y: 70 } }]);
  }}),
  VF.layer({ id: 's2', el: $('#s2'), at: VF.after('s1'), dur: 3, fn: drawScene2 }),
]});
const renderCaps = VF.captions(TIMELINE.lines);
window.render = (t) => {
  $('#stage').style.transform = VF.camera(t, TIMELINE.suggested_cuts.map((_, i) => VF.at(`l${i + 1}.end`)));
  film.render(t); renderCaps(t);
};
```

Rules:
1. Scene cuts come from anchors (`VF.at('l2.end')`, `VF.after('s1')`) — never
   re-typed numbers. Editing one line's narration shifts everything downstream.
2. Motion comes from the kernel (`interp` / `springAt` / `animate`); every
   entrance has direction, every exit has direction.
3. Effects from the menu below; apply the full set by default, dial back only on request.
4. Scene by scene: after each scene, render 3 stills and self-check (text overflow,
   overlaps, subject size, caption collision). Score ≥ 8/10 before moving on.

### Step 5 — Sound
```
python scripts/mixdown.py --music audio/music.wav --sfx audio/sfx.wav --vo audio/vo.wav --out audio/mix.wav
```
Music auto-ducks under narration (envelope-based, 200 ms smoothing). SFX times are
copied from the picture's keyframes (`audio_tools.py sfx`). A short music/SFX file
is fine — `render.py` pads audio to the film length instead of truncating it.

### Step 6 — Lint, render & acceptance
```
python scripts/lint_page.py <project-dir>
python scripts/render.py index.html out/final.mp4 --size 1920x1080 --fps 30 \
       --duration <total> --audio audio/mix.wav --subframes 2
python scripts/analyze_video.py out/final.mp4 --out qa/final
python scripts/subtitles.py audio/vo_timeline.json --out out/subs.srt --ass out/subs.ass
python scripts/regression.py index.html --out qa/golden --duration <total> \
       --timeline audio/vo_timeline.json init    # then rerun without "init" to check
```
- Lint is **mandatory** before the first render; a finding blocks the build
  (justify with an inline `// vf:allow` only after thinking).
- `--subframes 2` = motion blur (2× render time; tell the user first).
- Acceptance: contact sheet review; detected cuts must match `suggested_cuts` (±0.1s);
  `audio_tools.py check` for loudness/clipping; caption legibility still; golden
  frames PASS; score attractiveness / sync / clarity / motion / captions ≥ 8 and
  log to `qa/review_log.md`.

### Step 7 — Deliver
`out/final.mp4` (captions burned in) + `out/subs.srt` + `brief.md` + `index.html`
+ `qa/`. Include the narration text, key creative decisions, and known limitations.

## Animation kernel quick reference (`window.VF.*`)

Full API with examples: `references/vf-api.md`. Canonical cheat sheet:

| Need | API |
|---|---|
| Keyframe value | `VF.interp(t, [0,.6], [0,100], { ease:'outCubic', extrapolate:'clamp' })` |
| Ease family | `VF.Ease.outCubic` · `.bezier(.2,.8,.2,1)` · `.step(10)` · `Ease.out(Ease.inBack)` |
| Spring entrance | `VF.springAt(t, { at:.2, preset:'hero' })` — presets: `button / container / hero / sticker` |
| Element entrance+exit | `VF.animate(el, t, [{ at, spring, from:{opacity,y} }, { at, ease, to:{opacity:0,x} }])` |
| Scene windows | `VF.scene({dur, layers:[VF.layer({id, el, at, dur, z, fn})]})` |
| Relative timing | `at: VF.after('s1')` — slides when s1's dur changes |
| Narration anchors | `VF.events(TIMELINE.lines)` → `VF.at('l2.end')` |
| Seeded random | `VF.random('seed')` / `VF.int(seed, n)` / `VF.pick(seed, arr)` — seed mandatory |
| Theme (FX re-skin) | `VF.theme({ fn:'#FF6B6B', alt:'#FFD98A' })` |

## FX menu (`window.VF.*`, all on by default)

| Effect | API | Use for |
|---|---|---|
| Glitch transition | `VF.glitch(cx,t,te,{W,H,strength})` | every scene cut (auto) |
| Camera punch + shake | `VF.camera(t,cuts,{seed})` | on stage transform (auto) |
| Comet trails | `VF.comets(cx,t,{W,H,n})` | ambient background (auto) |
| Shockwave ring | `VF.ring(cx,t,te,x,y,{color})` | logo / card / number landings |
| Radial burst | `VF.radialBurst(cx,t,te,x,y)` | end cards / big moments |
| Particle burst | `VF.burst(cx,t,te,x,y)` | stamps / badges / icons |
| Light sweep | `VF.sweep(cx,t,te)` | outros / chapter turns |
| Flow dots (polyline) | `VF.flowdots(cx,t,pts,on)` | pipelines / diagrams |
| Spring entrance | `VF.animate(el,t,[{spring,...}])` | cards / containers (add CSS `rotateY` for 3D) |
| Typewriter | `VF.typewriter(el,text,t,at,dur)` | code / terminal scenes |
| Scanlines | CSS repeating gradient + sin flicker | terminals / retro |
| Motion blur | `render.py --subframes 2` | fast motion |
| Caption track | `VF.captions(lines, opts)` | on by default |

IDE-dark syntax palette: keyword `#6CB2FF` / function `#38E1C8` / number `#F4C64A` /
comment `#4A5878` / text `#E8EDF8` on `#07090F` — these are the kernel theme
defaults; re-skin with one `VF.theme({...})` call. CJK stack:
`'Inter','Microsoft YaHei',sans-serif`.

## If this happens

- **Lint fails**: fix the finding (seed the random, inline the constant). An
  `// vf:allow` exemption is for reviewed, setup-only code — never inside `render(t)`.
- **edge-tts network fails**: tell the user, switch network or fall back to an offline
  TTS (quality drop, stated explicitly). Failed lines retry 3× before giving up.
- **One narration line changed**: re-run `tts.py` (other lines come from cache),
  re-render only the affected span (`--start/--duration`). Anchors keep downstream
  scenes aligned automatically.
- **Regression DRIFT**: a guarded frame changed. Intentional? Re-baseline with
  `--update` and say so in `qa/review_log.md`. Otherwise diff your last edit.
- **No narration wanted**: skip steps 1–2's VO parts, disable the caption track, and
  drive cuts from a beat grid (`audio_tools.py beats`) declared as `VF.events`.
- **User only wants the prompt/plan**: stop after `brief.md` + narration timeline.

## Ground rules

- The frame is a pure function of `t`: no rAF/setTimeout/CSS transitions; randomness
  only via `VF.random(seed)`. `lint_page.py` enforces this; any frame must re-render
  identically in isolation — `regression.py` proves it.
- Facts come only from the user's materials — never invent features or numbers.
- Effects serve the story; if a flash doesn't land on a beat or a line end, cut it.
- Log every review round (issues, scores) to `qa/review_log.md` and deliver it.

## Credits

Renderer core and original workflow based on **xilo-opus-video** by Kianzzz (MIT).
FX library, animation kernel, narration pipeline and subtitle tooling built and
hardened in production by LoveRain1997.
