# Craft rules — the difference between "AI video" and film

## Determinism (non-negotiable, machine-checked)
- `window.render = (t) => {...}` draws frame t. No rAF, no setTimeout, no CSS
  transitions, no unseeded randomness — `lint_page.py` blocks the build on any
  of them (`// vf:allow` only for reviewed, setup-only lines). `window.ready`
  flips true only after fonts AND images resolve.
- Any value that "changes target" mid-scene is a spring per change, composed:
  `v(t) = v0 + Σ (vi − vi−1) · spring(t − ti)` — the kernel implements this
  shape; declare the changes as `VF.animate` tracks or `VF.springAt` calls
  instead of hand-writing the sum.

## Motion
- Springs come from presets (`VF.springPreset` / `preset:` option):
  buttons/indicators `button` · containers/camera `container` · hero type/logos
  `hero` · stickers/mascots `sticker`. Custom: `springAt(t, { at, w, z })`.
- Values over time come from `VF.interp` with `extrapolate: 'clamp'` (default) —
  a value drifting past its range after the animation is a defect.
- Every entrance has direction (translate/scale) — write it in
  `VF.animate(el, t, [{ at, spring, from: { opacity: 0, y: 70 } }])`. A bare
  opacity fade is a defect.
- Every exit has a direction too — add a second track
  (`{ at, dur, ease: 'inCubic', to: { opacity: 0, x: -80 } }`). Nothing just vanishes.
- Discrete value (a counter that ticks, not slides): `VF.Ease.step(n)`.
- Beats: with narration, cuts land on line ends (`VF.at('l2.end')`). Without, on
  a BPM grid (`audio_tools.py beats`) declared as `VF.events`; biggest change on
  downbeats. Scene windows use `VF.after('s1')` so a timing change slides the
  whole downstream film, not just one number.

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
  the same id as scene containers). `VF.animate` throws on a null element —
  that is usually an id typo.

## Audio
- Film length = narration total + tail. `render.py` pads short audio with
  silence (`apad`) instead of truncating the film — the old `-shortest`
  footgun is gone, but still prefer beds ≥ film length for clean endings.
- `mixdown.py` handles ducking; verify with `audio_tools.py check` (loudness,
  waveform PNG, spectrum). Look for clipping, dead air, permanent bass rumble.
- ≤ 10s audio may land 1–2 LU off -14 after one loudnorm pass — acceptable.

## Acceptance loop
1. `lint_page.py` clean → render → `analyze_video.py` contact sheet — review as
   a critic, not the author.
2. Detected cuts ≈ narration `suggested_cuts` (±0.1s).
3. `regression.py` golden frames PASS (or an intentional, logged re-baseline).
4. Score: attractiveness / sync / clarity / motion / captions (1–10). Any score
   < 8 → fix → re-render only the broken span (`--start/--duration`).
5. Log rounds in `qa/review_log.md`; deliver it with the film.
