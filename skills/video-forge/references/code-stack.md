# Code stack — what to use when

Pick by look, not by habit. Combine freely (a film may use 2–3 stacks).

| Stack | Best at | Watch out |
|---|---|---|
| HTML/CSS/SVG + DOM springs | product promos, UI motion, kinetic type, infographics | no CSS transitions — write styles inside `render(t)` |
| Canvas 2D | particle fields, filmstrips, sparklines, procedural texture | scale by devicePixelRatio; paths get expensive >2000 objs |
| WebGL2 fragment shader | nebulae, glows, grain, scanlines,全场氛围 | `#version 300 es` on BOTH shaders; `preserveDrawingBuffer:true`; verify one frame with pixel readback before rendering the film |
| Three.js | true 3D scenes, camera moves | heavy; keep materials cheap |
| p5.js / p5.brush | hand-drawn feel, whiteboard | quantize strokes to 12/s for "boiling" |
| Remotion / HyperFrames | componentized long-form, teams | extra build step |
| Manim | math / step-by-step explainers | look is austere |

## Choosing a look
- Product/fintech: IDE-dark `#07090F`, syntax palette (see SKILL.md), nebula shader ambience, spring DOM.
- Retro/pixel: tiny canvas + integer upscale, quantize fps to 8–12.
- Explainer: light paper background, blueprint strokes, generous whitespace.
- NEVER default to dark-bg + centered-text + fade-in everything. That is what an
  unrestricted model produces; briefs must forbid it explicitly.

## Sound
- SFX: `audio_tools.py sfx timeline.json` — times copied from picture keyframes.
- Music: numpy template (kick = swept sine, hats = filtered noise, pad = detuned
  sines through one-pole LP, bass/arp on chord tones). BPM grid drives cuts when
  there is no narration.
- Narration: `tts.py` (edge-tts). It is the timing authority; the music beds under it.
