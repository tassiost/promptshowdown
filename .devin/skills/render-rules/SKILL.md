---
name: render-rules
description: Rendering rules — sprite system, canvas, performance optimization, hot paths
triggers:
  - model
allowed-tools:
  - read
  - grep
  - glob
---

Detailed engineering rules for rendering and performance in Prompt Showdown. Invoke this
skill when working on sprite rendering, canvas drawing, animations, visual FX, or any code
in the hot render/update path.

The entire game is in `index.html` (~13K lines). Search by function/constant name.

## Sprite Rendering System

### Sprite Scale Factor
Sprites designed for coordinate space where `u.z=10` = ~36px tall. `SpriteRenderer.draw`
applies uniform scale `(u.z/10) * 1.8` before drawing. A unit with `z=10` renders at 1.8×
(~65px tall). Scale applied via `c.translate(u.x,u.y); c.scale(s,s); c.translate(-u.x,-u.y)`.
Enemy flip (`c.scale(-1,1)`) applied **after** scale factor.

### Card Preview Sizing
`SpriteRenderer.renderPreview` caps `z` to fit small card canvases (40-64px). Formula:
`z = min(u.z, h*0.13)`. Unit positioned at `y = h*0.6` (lower-center). If you change the
sprite scale factor (1.8), update this cap formula.

### HP Bar and Name Position
Name/HP bar positioned relative to `spriteTop = u.y - (u.z/10) * 1.8 * 26`. If you change
the sprite scale factor, update the `26` constant (unscaled sprite half-height).

### Single Shared Canvas (Draft + Battle)
Only **one** canvas (`#cv`) for both draft and battle. `G.screen(id)` reparents `#cv` between
`#draftCanvasSlot` and `#battle`. Key rules:
- `_sizeDraftCanvas()` updates `Battle.canvasW`/`Battle.canvasH` and sets `Battle.ctx = null`
- `renderDraftBattlefield()` uses `$("cv")`, not a separate canvas
- **Never re-create `#cv`** — it must persist as single DOM node. Only reparent it.
- `Battle.start` re-initializes canvas size and context after reparenting

### Full-Screen Battlefield
Canvas fills entire viewport. UI overlays use `position:fixed` with semi-transparent backgrounds.
- Draft/battle screens use `fullscreen` CSS class: `max-width:none; width:100vw; height:100vh; position:fixed; inset:0`
- Canvas `#cv`: `position:absolute; inset:0`, no border/radius/shadow
- Game coordinate space: 400×550 (`Battle.GAME_W`/`GAME_H`)
- `_gameTransform()`: "contain" transform, `scale = Math.min(vw/GAME_W, vh/GAME_H)`, centered
- `drawBackground()` fills full viewport in screen space (before game-space transform)
- `screenToGame(sx,sy)` converts screen coords to game-space for click detection

## Performance Optimization Rules (PERF-R12)

All scenarios run at 60 FPS with 0 slow frames. 50v50 (100 units + combat) uses only 2.45ms
CPU — 15% of 16.67ms budget. See `PERF-R12.md` for full details.

### Sprite Cache (Hot Path)
`SpriteRenderer.draw` pre-renders each unique `(recipe, state, frameIdx, team)` combination to
offscreen canvas. Hot path = single `drawImage` per unit. Fallback (cache miss, death, spawn)
does full shape rendering — rare.

Key rules:
- **Never** change sprite shape/color at runtime and expect cache to reflect it. Cache key is
  `(recipe, state, frameIdx, team)`. Add new visual states to the cache key.
- `_getCachedSprite` lazily builds cache entry. Don't pre-warm.
- `_clearSpriteCache()` called when entering new battle (in `Battle.start` and
  `applyRemoteSnapshot` when units go from empty to non-empty).
- `SPRITE_CACHE_FRAMES` controls animation granularity (default 8 frames per state).
- Enemy flip baked into cache (separate entries for player/enemy). Don't apply `c.scale(-1,1)`
  in hot path.
- `drawFace` skipped when >30 units (`_frameUnitCount <= 30`).

### Object Pooling (Zero GC in Hot Paths)
Never allocate in hot paths. All per-frame allocations eliminated via pooling:
- **Projectiles**: `_projPool` — `pop()`/`push()`. Trail is flat `[0,0,0,0,0,0,0,0]` array, shifted in-place.
- **Damage numbers**: `_dmgPool` — capped at 40 on-screen, excess recycled.
- **Particles**: `_particlePool` — global, reused via `_spawnParticle`/`_recycleParticle`.
- **Damage window entries**: `_dmgWinPool` — flat `[time, dmg]` arrays.
- **Synth attacker**: `_projSynth` — single reusable object for projectile hit damage.
- **hitReactDir**: Reused in place (not re-allocated per hit). Better for V8 hidden classes.
- **avoidanceOffset**: Returns `_avoidBuf` (pre-allocated `{x,y}`), never allocates.
- **Pass2 render entries**: `_renderPass2` — array of entry objects reused across frames.

### Spatial Grids (O(n) instead of O(n²))
Two flat-array grids avoid Map overhead:
- **Avoidance grid** (`_avoidFlatGen`/`_avoidFlatUnits`): cellSize=30, 16×21 cells. Generation
  counter incremented by 2 per frame. `avoidanceOffset` checks 9 neighboring cells.
- **Separation grid** (`_sepFlatGen`/`_sepFlatUnits`): cellSize=60, 9×12 cells. Tracks non-empty
  cell keys in `_sepKeys` array. Checks 5 neighbor offsets to avoid double-checking pairs.
Both use `Int32Array` for generation tracking and pre-allocated cell arrays.

### Render Batching (Minimize Canvas State Changes)
Canvas state changes (`fillStyle`, `strokeStyle`, `font`, `globalAlpha`) are expensive. Batch by:
- **HP bars**: 7 groups (bg, player border, enemy border, ghost, green, yellow, red, highlight)
  instead of per-unit fillStyle. 7 state changes for 100 units.
- **Status rings**: 4 batched paths (shield, stun, poison, slow) — all same-type rings in one
  `beginPath` + `stroke()`. Uses `moveTo` before each `arc` for distinct sub-paths.
- **Shadows**: All alive-unit shadows in one `beginPath` + `fill()` (constant alpha=0.35).
  Dying units (per-unit alpha) drawn separately.
- **Damage numbers**: 4-pass color batch (player, enemy, heal, crit) — fillStyle set once per group.
- **Background**: Static parts cached to offscreen canvas. Only dynamic parts (parallax ridge,
  ambient particles) drawn per frame.

### Per-Frame Targeting Cache
Team-level targeting functions return same result for all units on same team. `_getCachedTarget`
caches per `(team, targetingKey)` per frame. `_targetCache` reset to `{}` at start of each `update()`.

### Index Loops (Never for...of in Hot Paths)
`for...of` allocates iterator object per call. All hot-path loops use index-based:
`for(let i=0;i<arr.length;i++)`. Applies to: update, render, act, separate, updateProjectiles,
tickZones, checkTriggers, drawDmgNums, applySnapshot, _interpRender, all targeting functions.

### Squared Distance (Avoid Math.sqrt)
Distance checks use `dx*dx+dy*dy` compared against `r*r` instead of `Math.sqrt(dx*dx+dy*dy) <= r`.
Math.sqrt only called when actual distance value needed (movement, avoidance push).

### Reusable Arrays (No Per-Frame Allocation)
- `_alivePlayers`/`_aliveEnemies`: built once per `update()`, reused via `length=0` + push.
- `_renderPass2`: render pass 2 entries, reused via `length=0` + index assignment.
- `_sepKeys`: separation grid non-empty cell keys, reused via `length=0` + push.
- `_zoneAffected`: spell zone affected units, reused via `length=0` + push.
- `_prevSnapMap`/`_curSnapIds`: snapshot diff maps, reused via `clear()`.

### MP Guest Render Unification
Render path fully unified — both single-player and MP guest call `this.render()`. All shared
infrastructure (sprite cache, pools, background cache, pass2 arrays) used by both. Only
difference: single-player runs `Battle.update()`, MP guest runs `_interpRender()` (interpolates
between snapshots without simulation).

### Low Power Mode Testing
macOS low power mode throttles `requestAnimationFrame` to 30Hz. The perf script (`perf.py`)
overrides rAF with `setTimeout(16.67ms)` to simulate 60fps. In real 60Hz browser, results
would be exactly 60 FPS (~59 FPS in tests is setTimeout overhead).

## Canvas Rendering Rules

### 2D Canvas Has No Context Loss
`webglcontextlost`/`webglcontextrestored` events are WebGL-only. Don't add listeners for
2D canvas — they never fire.

### Always clearRect Before Drawing
`render()` must `clearRect(0,0,c.canvas.width,c.canvas.height)` before `drawBackground()`.
Prevents artifacts from previous frames during screen transitions or resize.

### Sprite Height in Y-Clamp
Y-clamp for units must account for sprite height: `u.y = clamp(u.y, spriteH+12, ch-u.z)`
where `spriteH = (u.z||10)/10*1.8*26`. Without this, tall sprites clip at the top of canvas.

## CSS calc() Whitespace Rule
CSS `calc()` requires whitespace around `+` and `-`: `calc(100vh - 60px)` not `calc(100vh-60px)`.
Without whitespace, the entire expression is ignored by the CSS parser, breaking layout silently.
