# Feedback

## Forge

- **Model download feedback**: ~~The forge needs clear feedback while the model is downloading. Add a progress bar with an estimated time remaining. Since we are still testing, set the estimated download time to **1s**.~~ **DONE** — forgeModelProgress bar exists with ~1s estimate. Also added generation progress bar showing per-field question progress (24 fields for units, 9 for spells).
- **Default to Unit button**: ~~The unit button should be selected by default and visually shown as pressed/active. The user can still switch to Spell if they want.~~ **DONE** — unit mode is default.

## In-Game Visuals

- **Visual quality**: We want near-infinite visual potential since the LLM codes the visuals, but the LLM is slow and somewhat limited. We need to find ways to make anything it generates look better with minimal effort.
  - Example: add a **black outline** to sprites/entities to improve readability and polish regardless of what the LLM produces.
  - **Progress**: Added additive blending for particles, drop shadows, projectile trails/glow, vignette overlay, noise texture background, parallax midground, depth fog, gradient HP bars with damage ghost, animated status rings, weapon-specific projectiles (arrows/bolts/fireballs), team-colored HP bar borders/names/damage numbers, and sprite top clipping fix.
- **Unit scale normalization**: All units now use `z=10` (same visual height). Previously generated units had `z=6-15` causing wildly different sizes. Size variety comes from sprite recipe shapes, not the z scale factor.
- **Draft sprite consistency**: Fixed `unit()` to preserve existing recipes with shapes instead of rebuilding them via `RecipeAssembler.build()` with default params. This ensures the same sprite renders in both the deck screen and the draft/battle.

## Deck Builder UX

- **Three interaction patterns**: Tap a loadout slot to select it (highlights with glow), then tap a collection unit to fill it. Or drag a collection unit onto a loadout slot. Or tap a collection unit without a slot selected to get a popup with 4 slot buttons to choose which to replace.
- **Drag between slots**: Loadout slots can be reordered by dragging one onto another.
- **Context-aware hints**: Collection cards show different hint text based on whether a slot is selected.
- **Removed clutter**: Tip of the Day, Unit Spotlight, and Tier List removed from main menu. Code archived in `archive/removed-ui-features.md`.

## UI Navigation

- **Fixed back button**: Single `#backBtn` at top-left, shows/hides based on active screen. Removed 12 inline back buttons from screen bottoms.
- **Fullscreen button**: Moved to top-right (`#fsBtn`).
- **Menu button tooltips**: All 17 menu buttons have hover/long-press tooltips with title + description.

## Performance

- **60 FPS in all scenarios**: All scenarios (empty, 5v5, 20v20, 50v50, MP guest) run at 60 FPS with 0 slow frames. 50v50 (100 units + projectiles + combat) uses only 2.45ms CPU — 15% of the 16.67ms frame budget (85% headroom). On a 6x slower machine, still 60 FPS.
  - **Progress**: 90 optimizations in PERF-R12.md + further optimizations in PERF-R13.md and OPTIMIZATION-R14 through R20 (sprite caching, object pooling, spatial grids, render batching, per-frame targeting cache, index loops, squared distance checks, helper extraction, particle budget checks, formation constant hoisting). 216 E2E tests pass with 0 real bugs.
  - **CPU vs GPU**: CPU (JS update + render) = 2.45ms, GPU (canvas paint + vsync) = ~14.4ms. GPU is dominated by vsync wait, not actual GPU work.
  - **Memory**: 14.5MB empty → 17.0MB full battle → 20.0MB MP guest. No memory leaks.
