# OPTIMIZATION-R19.md — Unify/Streamline, Bug Hunt, Optimize

Session: R19. Approach: unify/streamline first, then bug hunt, then optimize.
No parallel subagents.

## Phase 1: Unify/Streamline

### Hoisted _FORMATION_PLAYER/_FORMATION_ENEMY constants
**Location**: `src/ui.js` — `_formationY`
**Problem**: `FORMATION_PLAYER` and `FORMATION_ENEMY` objects were allocated
inside `_formationY` every call. While not a hot path (called during draft
setup), it's unnecessary allocation.
**Fix**: Hoisted to module-level constants `_FORMATION_PLAYER` and
`_FORMATION_ENEMY`.

## Phase 2: Bug Hunt

### BUG-R19-1: onUnitDeath called with extra ignored argument
**Location**: `src/battle.js` — `_applyArenaMechanics`
**Problem**: `this.onUnitDeath(u, envSynth)` was called with 2 arguments, but
`onUnitDeath(u)` only accepts 1. The `envSynth` argument was silently ignored.
The kill attribution worked because `u.lastAttacker=envSynth` was set before
the call, but the extra argument was misleading and could confuse future
maintenance.
**Fix**: Removed the extra `envSynth` argument from both call sites
(poison_aura and damage_aura mechanics).

### Verified (No Issues)
- `deriveAtkSpd` clamps to [0.5, 2.5] — no division by zero in `1/u.a`.
- `initRuntime` doesn't set `poisonAttacker` — correct (undefined means never
  poisoned, line 1166 check handles it).
- Avoidance grid generation counter works correctly (rebuilt between teams).
- `separate` function grid offsets correct (self + 4 neighbors, no double-check).
- `takeDamage` lifesteal on ranged units correctly propagates via synth object.
- `synth.d > owner.d` check in updateProjectiles is dead code (synth.d is set
  to owner.d, takeDamage doesn't modify attacker.d) — harmless.
- Spell `tickZones` correctly filters by team (allyZone check).
- `SPELL_EFFECT` functions use `.forEach()` — not hot paths (called once per
  spell cast, not per frame).
- All `for...of` in battle.js are in init/debug/setup code, not per-frame.
- `applyUpgrades` uses `F()` (Math.floor) — fine for battle setup (both peers
  receive same upgraded units via army serialization).
- Snapshot sync uses object pools correctly.
- `showConfirm` correctly uses `showModal` (runtime call, load order OK).
- Remaining overlay creation sites (coachmark, reconnect, ad prompt) have
  different layouts — not suitable for showModal consolidation.

## Phase 3: Optimize

No new hot-path optimizations needed. All hot paths already optimized in
R12-R18. The `_FORMATION_PLAYER/_FORMATION_ENEMY` hoist reduces allocation
but is not a hot path.

## Phase 4: E2E Tests

Multiple runs: 214/0/2, 214/1/1, 216/0/0. 0 real bugs.
All failures are flaky headless Chromium timing issues:
- "units moving: no movement" — battle didn't progress in time
- "damage numbers: none yet" — battle didn't progress in time
- "arena 0 (none): not running" — battle didn't start in time
None are code bugs — all are rAF timing issues in headless mode.
