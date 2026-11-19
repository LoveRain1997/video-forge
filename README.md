# video-forge 🎬

**Make studio-grade videos entirely with code.** An agent skill that turns a narration
script (or just an idea) into a finished MP4 — with a deterministic animation kernel, a
production FX library, AI voice-over, and burned-in subtitles. Every frame is
deterministic code, so any frame or any 3-second span can be re-rendered in isolation.

**用代码做出「有配音、有字幕、特效拉满」的视频。** 这是一个 AI Agent Skill：
写一个 `render(t)` 网页 → Playwright 逐帧截图 → FFmpeg 合成 MP4。
动画内核（关键帧插值 / 解析弹簧 / 场景图层时间轴 / 命名锚点 / 主题系统）、
特效即插即用、edge-tts 旁白自动卡点（逐句缓存）、字幕画面内烧录 + SRT/ASS 导出，
另附确定性 lint 与黄金帧回归护栏。

```ebnf
narration.txt ──▶ tts.py ──▶ vo_timeline.json ──▶ VF.at('l2.end') anchors ──▶ cuts land on sentence ends
index.html ──▶ lint_page.py ──▶ render.py ──▶ 990 PNG frames ──▶ FFmpeg ──▶ final.mp4 (captions burned in)
qa/golden    ◀── regression.py (golden-frame hashes)
```

## Install / 安装

```bash
npx skills add LoveRain1997/video-forge
# or
git clone https://github.com/LoveRain1997/video-forge
cp -r video-forge/skills/video-forge ~/.claude/skills/    # Claude Code
cp -r video-forge/skills/video-forge ~/.zcode/skills/     # ZCode
```

Requirements: Python 3.9+, numpy, playwright (+ `playwright install chromium`), FFmpeg.
Narration: `pip install edge-tts`.

## Usage / 使用

Talk to your agent:

> *"Make a 30s promo for my product with voice-over and subtitles."*
> *"用 video-forge 做一支 30 秒宣传片，要配音和字幕。*

The skill drives the full pipeline:

1. **Narration first** — writes the script, you approve, `tts.py` synthesizes line
   by line and *measures* each line's duration → scene cuts land exactly on sentence
   ends. Lines are cached; editing one line re-synthesizes only that one.
2. **Three plans + previews** — key frame per plan, you pick one.
3. **brief.md** — 10-block structured prompt (facts, forbidden defaults, timeline, FX, captions).
4. **Scene-by-scene build** — `VF.scene` layers + `VF.after` anchors + `VF.animate`
   entrances; every scene self-checked via stills, scored ≥ 8/10.
5. **Lint** — `lint_page.py` enforces the determinism contract before the first render.
6. **Mixdown** — music auto-ducks under narration; loudnorm −14 LUFS.
7. **Render & acceptance** — contact sheet + cut detection must match the narration
   timeline; golden-frame regression must PASS; motion blur via `--subframes 2`.
8. **Deliver** — final.mp4 (captions burned in) + SRT/ASS + full project folder.

## Animation kernel (`window.VF.*`)

v2 ships a kernel with the vocabulary a motion designer actually wants, while
keeping the pure-function-of-`t` contract:

```js
VF.events(TIMELINE.lines);                       // anchors from narration: l1, l1.end, ...
const film = VF.scene({ dur: TIMELINE.total, layers: [
  VF.layer({ id: 's1', el: $('#s1'), at: 0, dur: VF.at('l1.end'), fn: (t) =>
    VF.animate($('#hero'), t, [{ at: 0.15, spring: 'hero', from: { opacity: 0, y: 70 } }] )}),
  VF.layer({ id: 's2', el: $('#s2'), at: VF.after('s1'), dur: 3 }),   // slides when s1 changes
]});
window.render = (t) => film.render(t);
```

| | | |
|---|---|---|
| `VF.interp` multi-keyframe + clamp | 30+ easings + `bezier` + `step` | analytic `VF.springAt` + 4 presets |
| `VF.scene` / `VF.layer` timeline | `VF.after` relative anchors | `VF.events` / `VF.at` named anchors |
| `VF.random(seed)` (mandatory) | `VF.theme({...})` live re-skin | `VF.animate` declarative keyframes |

## FX library

| | | |
|---|---|---|
| glitch transitions (edge-safe) | comet trails | shockwave rings |
| radial ray bursts | particle bursts | light sweeps |
| flow dots (polyline pipelines) | spring entrances | typewriter |
| camera punch + seeded shake | caption track | motion blur (`--subframes`) |

All deterministic — a pure function of time `t`, all reading `VF.theme()`.
Re-render any single frame, any time.

## Guard rails

- `scripts/lint_page.py` — fails the build on wall-clock sources, timers and
  unseeded randomness (the determinism contract, machine-checked).
- `scripts/regression.py` — golden-frame sha256 manifest: `init` once, `check`
  before shipping; DRIFT tells you exactly which frame your last edit changed.

## Repo layout

```
skills/video-forge/
  SKILL.md            the agent-facing workflow (read this first)
  scripts/            vf.js · fx-lib.js · tts.py · mixdown.py · subtitles.py ·
                      render.py · lint_page.py · regression.py ·
                      analyze_video.py · check_env.py · audio_tools.py
  references/         vf-api · code-stack · plan-format · brief-template · craft-rules
examples/hello-vf/    5s end-to-end demo of the kernel (render + lint + regression)
examples/             stills from real productions
```

## Examples / 示例

`examples/hello-vf` renders in seconds and exercises the whole kernel:

```bash
python skills/video-forge/scripts/render.py examples/hello-vf/index.html out/demo.mp4 \
       --size 1280x720 --fps 30 --duration 5
python skills/video-forge/scripts/lint_page.py examples/hello-vf
python skills/video-forge/scripts/regression.py examples/hello-vf/index.html \
       --out qa/golden --size 1280x720 --at 0,1.2,2.4,3.4,4.9 init
```

See `examples/` for stills from a 10s international fintech promo (real market data,
English VO, burned captions) and an FX-library smoke test. 渲染 990 帧 ≈ 2 分钟（1080p30）。

## License

MIT — see [LICENSE](LICENSE). The renderer core builds on
[xilo-opus-video](https://github.com/Kianzzz/xilo-opus-video) by Kianzzz (MIT);
the FX library, narration pipeline and subtitle tooling were built and hardened in
production by LoveRain1997.
