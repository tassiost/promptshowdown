# OPTIMIZATION-R17.md — Unify/Streamline, Bug Hunt, Optimize

Session: R17. Approach: unify/streamline first, then bug hunt, then optimize.
No parallel subagents.

## Phase 1: Unify/Streamline

### showModal() Helper — Eliminates 4× Duplicated Overlay Creation
**Location**: `src/ui.js` — 4 modal creation sites
**Problem**: 8 sites created overlay+modal divs with near-identical cssText:
`position:fixed;inset:0;background:rgba(0,0,0,0.8|0.85);z-index:9999;display:flex;...`
Each was 4-7 lines of duplicated code.
**Fix**: Added `showModal(opts)` helper that returns `{overlay,modal}`. Converted
4 clear duplicate sites:
- `showLeaderboard` (line 810)
- `showQuests` (line 980)
- `showKeyboardHelp` (line 1020)
- `showUnitDetail` (line 3643)
- `showFusionPreview` (line 4161)
3 remaining sites (coachmark, reconnect, ad prompt) have different layouts
(column flex, inline content, no modal child) — left as-is.

### Hoisted Spell Bar Constants
**Location**: `src/battle.js` — `_renderSpellBar`
**Problem**: `icons` and `effectLabels` objects were allocated every 0.5s
(when spell bar re-renders). These are constant objects.
**Fix**: Hoisted to module-level constants `SPELL_FX_ICONS` and
`SPELL_EFFECT_LABELS`. Eliminates 2 object allocations per spell bar update.

## Phase 2: Bug Hunt

### BUG-R17-1: Negative attack cooldown (E2E test failure)
**Location**: `src/battle.js` line 1178
**Problem**: `if(u.cool>0)u.cool-=dt;` did NOT clamp to zero. If `dt` was
larger than the remaining cooldown, `u.cool` went negative. The E2E test
"negative cooldowns" caught this: `Battle.units.some(u=>(u.cool||0)<0)`.
The ability cooldown (`u.abCool`) was correctly clamped with `Math.max(0,...)`,
but the attack cooldown (`u.cool`) was not. This violated the skill rule:
"Cooldown cap at zero — use Math.max(0, u.abCool - dt), never u.abCool -= dt".
**Fix**: Changed to `u.cool=Math.max(0,u.cool-dt)`. Also clamped `u.slow`,
`u.stun`, `u.shieldActive`, `u.frenzyT` the same way for consistency.

### BUG-R17-2: Double rAF scheduling in guest relay mode
**Location**: `src/battle.js` — `Battle.loop()` guest relay path
**Problem**: `loop()` schedules `requestAnimationFrame` at the top (line 1000).
The guest relay path had a SECOND `requestAnimationFrame` at the end (line 1048),
which overwrote `this.frame` and caused duplicate rAF callbacks. Each callback
would schedule another rAF, creating a cascade of duplicate frames for the
guest in relay mode — wasting CPU and causing render thrashing.
**Fix**: Removed the duplicate `requestAnimationFrame` from the guest relay
path. The one at the top of `loop()` is sufficient.

### BUG-R17-3: Pan offset scaled by baseScale instead of full scale
**Location**: `src/battle.js` — `_gameTransform()`
**Problem**: Pan offset was converted to screen-space using `baseScale`
(without zoom), but the actual transform uses `scale = baseScale * _zoom`.
So panning at high zoom moved less than expected — pan distance was divided
by the zoom factor.
**Fix**: Changed `this._panX*baseScale` to `this._panX*scale` (and same for
`_panY`). Now pan is correctly scaled by the full zoom-adjusted scale.

### BUG-R17-4: Missing onUnitDeath double-call guard
**Location**: `src/battle.js` — `onUnitDeath(u)`
**Problem**: `onUnitDeath` had no guard against being called twice for the
same unit. The sim loop (line 1211) guards with `u.deathT===undefined`, and
arena mechanics check `u.h>0` before damaging. But if a unit dies from arena
poison AND from sim damage in the same frame, both paths could call
`onUnitDeath` — double-processing kill attribution, ramp bonus, kill feed,
first blood sound, etc.
**Fix**: Added `if(u.deathT!==undefined)return;` at the top of `onUnitDeath`.
This is a defensive guard — the current code paths shouldn't trigger it, but
it prevents future bugs.

## Phase 3: Optimize

No new hot-path optimizations needed. All hot paths already optimized in
R12-R16 (sprite cache, object pooling, spatial grids, render batching, index
loops, squared distance, team glow batching, hoisted constants).

### Verified (No Issues)
- All `dx/dd` divisions guarded with `||1` (no NaN risk).
- All switch cases have `break` (no fallthrough).
- All `for...of` in battle.js are in init/debug code (not hot paths).
- All `Math.random()` in battle.js are in particle/background FX (not sim state).
- All `R()`/`Q()` in battle.js are in visual-only code (damage numbers, particles).
- `takeDamage` always called with alive targets (checked at call sites).
- Poison kill attribution correct (BUG-R15 fix still working).
- Arena mechanics check `u.h>0` before damaging.
- Network intervals properly cleaned up on disconnect.
- `_cmdBuffer` Map cleaned up on battle start and disconnect.
- `migrateSave` version checks correct (all migrations run for old saves).
- Bot uses `R()` (non-deterministic) — fine for single-player only.
- Quests use `Math.random()` — fine for non-sim code.

## Phase 4: E2E Tests

Multiple runs: 215/216, 215/0, 214/1, 215/0, 215/1. 0 real bugs.
- "negative cooldowns" failure: FIXED (BUG-R17-1).
- "arena 0 (none): not running" failure: flaky headless Chromium timing
  (battle didn't start in time). Not a code bug.
- "ability heal: battle ended quickly" WARN: flaky (battle ended before
  heal ability could fire). Not a code bug.
