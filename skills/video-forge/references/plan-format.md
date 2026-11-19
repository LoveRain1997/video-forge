# Plan format — three plans, each with a preview

Propose three plans that differ in **style, narrative structure, or stack** — never
three palettes of the same idea. Typical split:

1. **Safe** — closest to the material and the user's reference.
2. **Stylized** — a different visual language (kinetic type, blueprint, retro).
3. **Bold** — a structural bet (one continuous hero shot, a single metaphor).

Every plan states:
- **Visual summary** — scene-by-scene, one sentence each.
- **Stack** — from code-stack.md, and why it serves this plan.
- **Sound** — narration voice, music direction, SFX density.
- **Render estimate** — from the preview: per-frame seconds × frames × subframes × 1.3.
- **Risk** — what will probably need a second pass.

## Preview rules
- One key frame per plan via `render.py previews/plan-x.html previews/plan-x.png --still <t> --size <aspect>`.
- If the selling point is motion (beat-synced cuts, morphing UI), render a 2–4s
  sample MP4 instead.
- Fix obvious defects (overflow, crowding, empty frames) BEFORE showing the user.
- Present all three with file paths; let the user pick, mix, or send back.
