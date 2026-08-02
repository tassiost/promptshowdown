# Feedback

## Forge

- **Model download feedback**: ~~The forge needs clear feedback while the model is downloading. Add a progress bar with an estimated time remaining. Since we are still testing, set the estimated download time to **1s**.~~ **DONE** — forgeModelProgress bar exists with ~1s estimate. Also added generation progress bar showing per-field question progress (24 fields for units, 9 for spells).
- **Default to Unit button**: ~~The unit button should be selected by default and visually shown as pressed/active. The user can still switch to Spell if they want.~~ **DONE** — unit mode is default.

## In-Game Visuals

- **Visual quality**: We want near-infinite visual potential since the LLM codes the visuals, but the LLM is slow and somewhat limited. We need to find ways to make anything it generates look better with minimal effort.
  - Example: add a **black outline** to sprites/entities to improve readability and polish regardless of what the LLM produces.
  - **Progress**: Added additive blending for particles, drop shadows, projectile trails/glow, vignette overlay, noise texture background, parallax midground, depth fog, gradient HP bars with damage ghost, animated status rings, weapon-specific projectiles (arrows/bolts/fireballs), team-colored HP bar borders/names/damage numbers, and sprite top clipping fix.

## Performance

- **60 FPS in all scenarios**: All scenarios (empty, 5v5, 20v20, 50v50, MP guest) run at 60 FPS with 0 slow frames. 50v50 (100 units + projectiles + combat) uses only 2.45ms CPU — 15% of the 16.67ms frame budget (85% headroom). On a 6x slower machine, still 60 FPS.
  - **Progress**: 90 optimizations in PERF-R12.md including sprite caching (pre-rendered offscreen canvases), object pooling (zero GC in hot paths), spatial grids (flat-array O(n) avoidance + separation), render batching (HP bars, status rings, shadows, damage numbers), per-frame targeting cache, index loops, squared distance checks, and single/multiplayer render unification.
  - **CPU vs GPU**: CPU (JS update + render) = 2.45ms, GPU (canvas paint + vsync) = ~14.4ms. GPU is dominated by vsync wait, not actual GPU work.
  - **Memory**: 14.5MB empty → 17.0MB full battle → 20.0MB MP guest. No memory leaks.
