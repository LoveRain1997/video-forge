# brief.md template — the film's complete, reusable prompt

Fill every block with confirmed decisions. This file is both the build contract and
a portable prompt for re-runs.

```
## <role>
Senior motion designer for <genre>. Fluent in <stacks>. Taste: <three adjectives>.

## <inputs>
Every fact, asset, number the film may use — with provenance. Anything not listed
here must not appear on screen.

## <direction>
- Look: background, palette (hex), typography, texture.
- Motion language: springs (w/z presets), typewriter, camera behavior.
- MUST-APPEAR facts (exact strings).
- FORBIDDEN list — the defaults you are banning, e.g.:
  fade-in-everything, centered-text-on-dark, purple gradients, emoji icons,
  uniform-speed movement, logos you don't have rights to.

## <structure>
Scene table: | time | cut | scene | on-screen | effect triggers |
Cuts MUST equal narration line ends (from vo_timeline.json).

## <narration>
Voice, rate, the approved script, line/start/end table.

## <effects>
Which items from the FX menu, triggered when (reference timeline constants).

## <captions>
On/off; style overrides vs the default (bottom 4.5%, 54px bold white, heavy outline).

## <build>
index.html layout (layers), fonts via @font-face, determinism notes, render flags.

## <gotchas>
Known traps for THIS film: font loading gate, shader version, -shortest, id
collisions, innerHTML-escaped strings, caption/subject collisions…

## <start>
"Build scene 1, render 3 stills, self-score, proceed." (the standing order)
```
