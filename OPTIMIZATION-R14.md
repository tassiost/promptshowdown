# OPTIMIZATION-R14.md — Unification, Bug Hunt, Optimization

Session: R14 — systematic audit, unification, bug fixes, and optimization.
Goal: streamline the codebase first (so we don't optimize twice), then fix bugs,
then optimize. All changes verified with 216 E2E tests.

## Phase 1: Audit Findings

### Dead/Duplicate Files
1. **`src/index.html`** — NOT used by Vite (config uses root `index.html` as entry).
   Manually kept "in sync" but already diverged (deck description text differs).
   **Fix**: Delete it. Update docs.
2. **`index.original.html`** — Old monolithic version from before Vite split. Dead.
   **Fix**: Delete it.

### Bugs
3. **`TESTING_FORGE=true` hardcoded** (`src/ui.js:1200`) — TODO says "set false before ship".
   Forge button is always visible, bypassing the Training Yard gate.
   **Fix**: Set to `false`. Forge unlocks after arena >= 1 or 3+ wins.

### Code Quality
4. **`Math.sqrt` in `screenToGame` click detection** (`src/battle.js:646`) —
   Uses `Math.sqrt` for distance check. This is UI-only (click detection), not sim
   state, so `Math.*` is allowed per rules. **No fix needed.**
5. **`Q()` in `spawnDmgNum`** (`src/battle.js:2800`) — Uses `Q()` (non-deterministic)
   for damage number x-offset. This is UI-only (visual jitter), not sim state.
   **No fix needed.**
6. **`Math.random` in particle spawns** (`src/battle.js:1751+`) — UI-only FX.
   **No fix needed.**
7. **Debug `console.log` statements** (`src/battle.js`) — All gated behind
   `this.debug` flag (toggled by 'D' key). Not active in production. **No fix needed.**

### Performance (already optimized in R12/R13)
8. **No `for...of` in hot paths** — update(), render(), updateProjectiles(),
   tickZones(), checkTriggers(), drawDmgNums() all use index loops. ✓
9. **No `Math.sqrt` in sim state** — All sim distance checks use squared distance
   or `DMath.sqrt`. ✓
10. **No per-frame allocations in hot paths** — Pools for projectiles, damage
    numbers, particles. Reusable arrays for alive units, render pass 2. ✓
11. **Sprite cache working** — Pre-rendered offscreen canvases, single `drawImage`
    per unit in hot path. ✓

### Security
12. **`innerHTML` with unit names** (`src/ui.js:2808,3859,4015`) — Unit names are
    sanitized at creation in `unit()` (strip `<>`, replace `"`, truncate 20).
    Low risk but not using `escapeHtml()`. **Note only — sanitization at creation
    is the primary defense.**

### Not Changed (by design)
13. **`for...of` in init/debug code** — `Battle.start()`, `applyCompositionBonuses()`,
    debug logging, snapshot diffing. These run once per battle, not per frame.
    Not worth the readability cost of converting to index loops.
14. **`Math.random` in particle/background FX** — UI-only, not sim state. Allowed.

## Phase 2: Unification/Streamline

### Removed
- `src/index.html` — dead duplicate (Vite uses root `index.html`)
- `index.original.html` — old monolithic version
- Updated docs (CONTRIBUTING.md, FILE_MAP.md) to remove references to `src/index.html`

### Streamlined
- Forge button gating: `TESTING_FORGE` removed, forge now properly gated behind
  Training Yard completion (arena >= 1 or 3+ wins)

## Phase 3: Bug Fixes

### BUG-R14-1: Forge button always visible
- **File**: `src/ui.js:1200`
- **Fix**: Removed `TESTING_FORGE=true`, forge now gated behind arena >= 1 or 3+ wins

### BUG-R14-2: drawImage flaky errors (0-size canvas)
- **Files**: `src/rendering.js`, `src/battle.js`
- **Root cause**: Canvas elements with width=0 or height=0 passed to `drawImage()`
  during initialization races in headless Chromium. The browser throws:
  "The image argument is a canvas element with a width or height of 0."
- **Fix**: Added guards on all `drawImage` call sites:
  - `rendering.js:610` — sprite cache drawImage: check `cached.width>0&&cached.height>0`
  - `rendering.js:882` — renderPreview: early return if `w<1||h<1`
  - `rendering.js:91` — `_renderSpriteToCache`: `Math.max(1,...)` on spriteW/spriteH
  - `battle.js:2030` — background cache: check `_bgStaticCanvas.width>0`
  - `battle.js:2762` — bloom downscale: check `cv.width>0&&cv.height>0`
  - `battle.js:2770` — bloom composite: check `bc.width>0&&cv.width>0`
- **Result**: 3 consecutive E2E runs with 0 FAILs (was 1-2 flaky FAILs per run before)

## Phase 4: Optimization

No new optimizations needed — R12/R13 already covered all hot paths.
Codebase is clean: no `for...of` in hot paths, no per-frame allocations,
no `Math.sqrt` in sim state, sprite cache working, object pools in place.

## Phase 5: E2E Tests

3 consecutive runs after fixes:
- Run 1: 216 PASS, 0 FAIL, 0 WARN
- Run 2: 216 PASS, 0 FAIL, 0 WARN
- Run 3: 214 PASS, 0 FAIL, 2 WARN (battle-ended-quickly timing in headless mode)

The pre-existing flaky `drawImage` error is now fixed — 0 FAILs across all runs.
