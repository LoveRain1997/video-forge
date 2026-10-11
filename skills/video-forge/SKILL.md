---
name: video-forge
description: >-
  Make studio-grade videos entirely with code: the agent writes a render(t) web page,
  Playwright screenshots it frame by frame, FFmpeg assembles the MP4. Ships a production
  FX library (glitch transitions, comet trails, shockwave rings, radial bursts, 3D spring
  entrances, light sweeps, motion blur), an edge-tts narration pipeline (line-by-line
  synthesis with measured timings, so every scene cut lands exactly on a sentence end,
  plus automatic music ducking), and burned-in subtitles with SRT/ASS export.
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

Three pillars on top of that core loop:

1. **FX library** (`scripts/fx/fx-lib.js`) — production-hardened effects, plug and play.
2. **Narration pipeline** (`scripts/tts.py`) — edge-tts line-by-line synthesis with
   *measured* durations; scene cuts are derived from speech, never guessed.
3. **Subtitles** (`scripts/subtitles.py` + `fx-lib.js` caption track) — burned-in
   captions styled to match the film, plus SRT/ASS for platforms.

```
video-forge/
  SKILL.md              this file
  scripts/
    fx/fx-lib.js        FX library (window.VF.* after a <script> include)
    tts.py              narration: edge-tts → measured timeline (vo_timeline.json) → vo.wav
    mixdown.py          music auto-duck under narration + sfx → loudnorm -14 LUFS
    subtitles.py        vo_timeline.json → SRT / ASS (with burn-in command)
    render.py           frame-by-frame renderer (--still / --subframes motion blur / --start)
    analyze_video.py    finished-film contact sheet + cut detection (acceptance)
    check_env.py        environment check
    audio_tools.py      sfx synthesis / beat detection
  references/           code-stack, plan-format, brief-template, craft-rules
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
`audio/vo.wav`. **Every scene cut must land on a line end** (rounded to 0.05s).
Film duration = last line end + 0.7–1.2s. This timeline is the single source of
truth for scene windows, effect triggers, counters, and captions.

### Step 3 — Three plans + previews
Following `references/code-stack.md`, propose three *distinct* plans (different in
style, structure, or stack — not just palette). Render one key frame each
(`render.py --still`), let the user pick, then write `brief.md` per
`references/brief-template.md`. The template adds three blocks on top of the
classic seven:

```
<narration>  line / start-end / scene mapping (from vo_timeline.json)
<effects>    which FX from the menu, triggered when (reference the timeline)
<captions>   on/off, style (default: bottom 4.5%, 54px, bold white, heavy outline)
```

### Step 4 — Build: index.html + fx-lib.js
Copy `scripts/fx/fx-lib.js` into the project and include it. Rules:
1. Cut times live as constants `const C1..Cn` taken from `vo_timeline.json`;
   scene windows, glitches, camera punches and captions all reference these
   constants — never re-type the numbers.
2. Effects from the menu below; apply the full set by default, dial back only on request.
3. Captions: `const renderCaps = VF.installCaptions(TIMELINE.lines)` and call
   `renderCaps(t)` every frame.
4. Scene by scene: after each scene, render 3 stills and self-check (text overflow,
   overlaps, subject size, caption collision). Score ≥ 8/10 before moving on.

### Step 5 — Sound
```
python scripts/mixdown.py --music audio/music.wav --sfx audio/sfx.wav --vo audio/vo.wav --out audio/mix.wav
```
Music auto-ducks under narration (envelope-based, 200 ms smoothing). SFX times are
copied from the picture's keyframes (`audio_tools.py sfx`). **Music/SFX files must be
at least as long as the film** — FFmpeg `-shortest` otherwise truncates the video.

### Step 6 — Render & acceptance
```
python scripts/render.py index.html out/final.mp4 --size 1920x1080 --fps 30 \
       --duration <total> --audio audio/mix.wav --subframes 2
python scripts/analyze_video.py out/final.mp4 --out qa/final
python scripts/subtitles.py audio/vo_timeline.json --out out/subs.srt --ass out/subs.ass
```
- `--subframes 2` = motion blur (2× render time; tell the user first).
- Acceptance: contact sheet review; detected cuts must match `suggested_cuts` (±0.1s);
  `audio_tools.py check` for loudness/clipping; caption legibility still; score
  attractiveness / sync / clarity / motion / captions ≥ 8 and log to `qa/review_log.md`.

### Step 7 — Deliver
`out/final.mp4` (captions burned in) + `out/subs.srt` + `brief.md` + `index.html`
+ `qa/`. Include the narration text, key creative decisions, and known limitations.

## FX menu (`window.VF.*`, all on by default)

| Effect | API | Use for |
|---|---|---|
| Glitch transition | `VF.glitch(cx,t,te,W,H)` | every scene cut (auto) |
| Camera punch + shake | `VF.camera(t,cuts)` | on stage transform (auto) |
| Comet trails | `VF.comets(cx,t,W,H)` | ambient background (auto) |
| Shockwave ring | `VF.ring(cx,t,te,x,y,...)` | logo / card / number landings |
| Radial burst | `VF.radialBurst(cx,t,te,x,y)` | end cards / big moments |
| Particle burst | `VF.burst(cx,t,te,x,y)` | stamps / badges / icons |
| Light sweep | `VF.sweep(cx,t,te)` | outros / chapter turns |
| Flow dots | `VF.flowdots(cx,t,x1,y1,x2,y2,on)` | pipelines / diagrams |
| 3D spring-in | `VF.pop(...)` + CSS `rotateY` | cards / containers |
| Typewriter | `VF.typewriter(el,text,t,t0,t1)` | code / terminal scenes |
| Scanlines | CSS repeating gradient + sin flicker | terminals / retro |
| Motion blur | `render.py --subframes 2` | fast motion |
| Closed-form spring | `VF.spring(x,w,z)` (4 presets) | every entrance (no plain fades) |
| Caption track | `VF.installCaptions(lines)` | on by default |

IDE-dark syntax palette: keyword `#6CB2FF` / function `#38E1C8` / number `#F4C64A` /
comment `#4A5878` / text `#E8EDF8` on `#07090F`. CJK stack: `'Inter','Microsoft YaHei',sans-serif`.

## If this happens

- **edge-tts network fails**: tell the user, switch network or fall back to an offline
  TTS (quality drop, stated explicitly).
- **One narration line changed**: re-run `tts.py` (other lines cached), re-render only
  the affected span (`--start/--duration`).
- **Output shorter than requested**: check that music/sfx WAVs are ≥ film length
  (`-shortest` truncation).
- **No narration wanted**: skip steps 1–2's VO parts, disable the caption track, and
  drive cuts from a beat grid instead.
- **User only wants the prompt/plan**: stop after `brief.md` + narration timeline.

## Ground rules

- The frame is a pure function of `t`: no rAF/setTimeout/CSS transitions; randomness
  only via seeded generators. Any frame must re-render identically in isolation.
- Facts come only from the user's materials — never invent features or numbers.
- Effects serve the story; if a flash doesn't land on a beat or a line end, cut it.
- Log every review round (issues, scores) to `qa/review_log.md` and deliver it.

## Credits

Renderer core and original workflow based on **xilo-opus-video** by Kianzzz (MIT).
FX library, narration pipeline and subtitle tooling built and hardened in production
by LoveRain1997.
