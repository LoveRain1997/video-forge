# Craft rules — the difference between "AI video" and film

## Determinism (non-negotiable)
- `window.render = (t) => {...}` draws frame t. No rAF, no setTimeout, no CSS
  transitions, no `Math.random()` (seeded only). `window.ready` flips true only
  after fonts AND images resolve.
- Any value that "changes target" (cursor, container width) uses the closed-form
  spring sum: `v(t) = v0 + Σ (vi − vi−1) · spring(t − ti)`.

## Motion
- Spring presets: buttons/indicators w22–26 z0.75–0.85 · containers/camera w14–16
  z0.7–0.75 · hero type/logos w9–11 z0.85–1 · stickers/mascots w16–20 z0.4–0.5.
- Every entrance has direction (translate/scale). A bare opacity fade is a defect.
- Every exit has a direction too. Nothing just vanishes.
- Beats: with narration, cuts land on line ends. Without, on a BPM grid
  (`audio_tools.py beats`); biggest change on downbeats.

## Layout
- Subject ≥ 1/3 of frame; camera always does something (push, drift, punch).
- One sentence per screen, ≥ 2.5s dwell. Burned captions sit at the safe line and
  must never cover the subject — check a still with captions on.
- Multi-aspect: re-layout per aspect, never crop a landscape master.

## Fonts & i18n
- Ship fonts with the project (`@font-face`), gate `window.ready` on
  `document.fonts.ready` + every `<img>`.
- CJK fallback stack: `'Inter','Microsoft YaHei',sans-serif`.
- innerHTML-injected strings with `<` must be HTML-escaped (`&lt;slug&gt;`).
- Unique DOM ids. A duplicate id silently breaks scenes (footgun: counters using
  the same id as scene containers).

## Audio
- Film length = narration total + tail. Music/SFX WAVs ≥ film length, or
  FFmpeg `-shortest` truncates the video silently.
- `mixdown.py` handles ducking; verify with `audio_tools.py check` (loudness,
  waveform PNG, spectrum). Look for clipping, dead air, permanent bass rumble.
- ≤ 10s audio may land 1–2 LU off -14 after one loudnorm pass — acceptable.

## Acceptance loop
1. `analyze_video.py` contact sheet — review as a critic, not the author.
2. Detected cuts ≈ narration `suggested_cuts` (±0.1s).
3. Score: attractiveness / sync / clarity / motion / captions (1–10). Any score
   < 8 → fix → re-render only the broken span (`--start/--duration`).
4. Log rounds in `qa/review_log.md`; deliver it with the film.
