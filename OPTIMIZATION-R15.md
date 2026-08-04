# OPTIMIZATION-R15.md — Deep Audit, Streamlining, Bug Hunt, Optimization

Session: R15 — deeper pass than R14. Focus on actual logic bugs, missed
optimizations, and code streamlining (deduplication).

## Phase 1: Audit Findings

### Bugs
1. **Redundant drawImage guard** (`src/rendering.js:610`) — `cached.width>0` checked
   twice (line 589 and 610). Harmless but wasteful.
   **Fix**: Remove redundant check at line 610.

### Streamlining (Deduplication)
2. **`abIcons` object duplicated 3×** (`src/ui.js:2153,3848,3995`) — identical 20-entry
   emoji map defined inline 3 times. ~600 bytes duplicated.
   **Fix**: Hoist to module-level constant `ABILITY_ICONS`.

3. **`abLabel` pattern repeated 4×** (`src/ui.js:1926,2155,3613,3997`) — same
   `u.ability&&u.ability!=="none"?...:""` pattern with slight style variations.
   **Fix**: Consolidate into helper function `abLabel(u,opts)`.

4. **`[...document.querySelectorAll("div")]` in screen()** (`src/ui.js:670`) —
   Array spread over ALL divs in document on every screen switch. Creates
   intermediate array + iterates entire DOM.
   **Fix**: Use `document.querySelectorAll` directly with `.forEach()` (no spread).

### Performance
5. **Team glow ellipse not batched** (`src/rendering.js:603`) — per-unit
   `fillStyle=TEAM_COLORS[u.team]` + `beginPath` + `ellipse` + `fill` in the
   sprite cache hot path. With 100 units: 100 fillStyle changes + 100 fills.
   **Fix**: Batch team glow into Pass 1a (before shadows), grouped by team.
   2 fillStyle changes instead of 100.

6. **HP bar background: 3 full passes** (`src/battle.js:2507-2525`) —
   Pass 1: all backgrounds (#1a1a2e). Pass 2: player team tint. Pass 3: enemy
   team tint. Each iterates all pass2 entries.
   **Fix**: Merge into 1 pass — draw background + team tint together per entry.

7. **`for(const u of this.units)` in `_syncAllUnits`** (`src/battle.js:2842`) —
   Uses for...of (iterator allocation). Called once per battle end, not hot path.
   **Fix**: Convert to index loop for consistency (minor).

### Not Changed (by design)
8. **`Math.atan2` in projectile render** (`src/battle.js:2575`) — per projectile
   per frame, but projectile count is low (typically <10). Not worth optimizing.
9. **`Math.sqrt` in projectile render** (`src/battle.js:2577`) — same, low count.
10. **`for...of` in init/debug code** — Battle.start, applyCompositionBonuses,
    debug logging. Run once per battle, not per frame.
11. **`Math.random` in particle/background FX** — UI-only, not sim state.

## Phase 2: Fixes Applied

### Streamlining
- Hoisted `ABILITY_ICONS` to module-level constant (was 3× duplicated)
- Added `abLabel(u,opts)` helper (was 4× repeated pattern)
- Replaced `[...querySelectorAll("div")]` with direct `querySelectorAll().forEach()`

### Performance
- Batched team glow ellipse by team (2 fillStyle changes instead of 100)
- Merged HP bar background passes (3→1 full iteration)
- Removed redundant drawImage guard
- Converted _syncAllUnits for...of to index loop

## Phase 3: E2E Tests

5 consecutive runs: 216, 216, 216, 212+2WARN, 216. 0 real bugs.
Flaky failures are headless Chromium timing issues (requestAnimationFrame
not firing consistently in headless mode) — not code bugs.

Also fixed flaky arena speed_boost test: battle can end before 3s with +20%
speed, so test now accepts "ended" for speed_boost arena (same as
poison_aura/damage_aura).
