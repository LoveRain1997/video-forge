# video-forge 🎬

**Make studio-grade videos entirely with code.** An agent skill that turns a narration
script (or just an idea) into a finished MP4 — with a production FX library, AI
voice-over, and burned-in subtitles. Every frame is deterministic code, so any frame
or any 3-second span can be re-rendered in isolation.

**用代码做出「有配音、有字幕、特效拉满」的视频。** 这是一个 AI Agent Skill：
写一个 `render(t)` 网页 → Playwright 逐帧截图 → FFmpeg 合成 MP4。
特效即插即用、edge-tts 旁白自动卡点、字幕画面内烧录 + SRT/ASS 导出。

```ebnf
narration.txt ──▶ tts.py ──▶ vo_timeline.json ──▶ scene cuts land on sentence ends
index.html ──▶ render.py ──▶ 990 PNG frames ──▶ FFmpeg ──▶ final.mp4 (captions burned in)
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
   by line and *measures* each line's duration → scene cuts land exactly on sentence ends.
2. **Three plans + previews** — key frame per plan, you pick one.
3. **brief.md** — 10-block structured prompt (facts, forbidden defaults, timeline, FX, captions).
4. **Scene-by-scene build** — every scene self-checked via stills, scored ≥ 8/10.
5. **Mixdown** — music auto-ducks under narration; loudnorm −14 LUFS.
6. **Render & acceptance** — contact sheet + cut detection must match the narration
   timeline; motion blur via `--subframes 2`.
7. **Deliver** — final.mp4 (captions burned in) + SRT/ASS + full project folder.

## FX library (`window.VF.*`)

| | | |
|---|---|---|
| glitch transitions | comet trails | shockwave rings |
| radial ray bursts | particle bursts | light sweeps |
| flow dots (pipelines) | 3D spring entrances | typewriter |
| camera punch + shake | closed-form springs (4 presets) | caption track |
| scanlines | beat punches | motion blur (`--subframes`) |

All deterministic — a pure function of time `t`. Re-render any single frame, any time.

## Repo layout

```
skills/video-forge/
  SKILL.md            the agent-facing workflow (read this first)
  scripts/            tts.py · mixdown.py · subtitles.py · render.py ·
                      analyze_video.py · check_env.py · audio_tools.py · fx/fx-lib.js
  references/         code-stack · plan-format · brief-template · craft-rules
examples/             stills from real productions
```

## Examples / 示例

See `examples/` — stills from a 10s international fintech promo (real market data,
English VO, burned captions) and an FX-library smoke test. 渲染 990 帧 ≈ 2 分钟（1080p30）。

## License

MIT — see [LICENSE](LICENSE). The renderer core builds on
[xilo-opus-video](https://github.com/Kianzzz/xilo-opus-video) by Kianzzz (MIT);
the FX library, narration pipeline and subtitle tooling were built and hardened in
production by LoveRain1997.
