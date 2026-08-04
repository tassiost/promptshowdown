# OPTIMIZATION-R16.md — Unify/Streamline, Bug Hunt, Optimize

Session: R16. Approach: unify/streamline first (so we don't optimize the same
thing twice), then bug hunt, then optimize. No parallel subagents.

## Phase 1: Unify/Streamline

### Deduplication
- **`escapeHtml` (forge.js) == `esc` (utils.js)** — identical functions.
  Removed `escapeHtml` from forge.js, replaced 4 calls in ui.js with `esc()`.
  (User had already applied the ui.js changes manually.)

### Audit Results (No Duplication Found)
- All constants (`ABILITY_DESCRIPTIONS`, `ABILITY_OPTS`, `TEAM_COLORS`,
  `ROLE_COLORS`, `WEAPON_COLOR`) defined exactly once — no duplicates.
- All functions (`sanitizeHex`, `clamp`, `cloneUnit`, `deepClone`) defined
  exactly once.
- `ABILITY_ICONS` already hoisted in R15 (was 3× duplicated).
- `abLabel()` helper already added in R15 (was 4× repeated pattern).
- Card creation patterns (25 sites) are all different contexts — not duplication.
- `$()` DOM lookups are spread across different functions — not duplication.

## Phase 2: Bug Hunt

### BUG-R16-1: Non-deterministic targeting (P2P desync risk)
**Location**: `src/battle-helpers.js` — `TARGETING.random_ally` and `TARGETING.random`
**Problem**: Used `R()` (Math.random-based) instead of `rand()` (seeded PRNG).
In P2P lockstep mode, both peers must run identical sims from the same seed.
If any unit uses `random_ally` or `random` targeting, the peers would select
different targets → divergent combat → desync.
**Fix**: Replaced `F(R()*count)` with `randInt(0,count)` (uses seeded `rand()`).
Violated AGENTS.md rule 12: "Never use R()/Q()/Math.random() in sim state".

### BUG-R16-2: Double team glow in fallback sprite path
**Location**: `src/rendering.js` — fallback sprite rendering (cache miss/death)
**Problem**: R15 moved team glow to Battle.render() Pass 0 (batched by team)
and removed it from the cached sprite path. But the FALLBACK path (used for
death, spawn, cache miss) still drew the glow — causing double-drawing for
any unit in the fallback path.
**Fix**: Removed team glow from fallback path. Now only drawn in Pass 0.

### Not Changed (Verified Correct)
- All `dx/dd` divisions guarded with `||1` (no NaN risk).
- All switch cases have `break` (no fallthrough).
- `importSave` runs `migrateSave` + sanitizes spells/units.
- `_endBattle` has `_ending` guard (no double-call).
- Network `disconnect()` clears all state (heartbeat, lockstep, relay).
- Spell targeting filters by team (ally vs enemy) — correct.
- `periodic_5s` spell trigger: `fired=true` then `fired=false` is correct
  (allows re-firing every 5s).
- All `for...of` in battle.js are in init/debug code (not hot paths).
- All `Math.random()` in battle.js are in particle/background FX (not sim state).
- `Q()` in `spawnDmgNum` is visual-only (floating damage numbers) — OK.

## Phase 3: Optimize

### No New Optimizations Needed
- Hot paths already optimized in R12-R15 (sprite cache, object pooling,
  spatial grids, render batching, index loops, squared distance).
- Team glow already batched in R15 (Pass 0).
- HP bar batching already done in R12 (7 groups).
- Status ring batching already done in R12 (4 batched paths).
- Shadow batching already done in R12 (single path + per-alpha for dying).
- Targeting cache already done in R12 (per-frame `_targetCache`).
- `_getCachedTarget` already has optimized `enemy_cluster` (flat array grid).

## Phase 4: E2E Tests

3 consecutive runs: 213+1FAIL+2WARN, 216, 216. 0 real bugs.
Flaky failures are headless Chromium timing issues (requestAnimationFrame
not firing consistently in headless mode) — not code bugs.
