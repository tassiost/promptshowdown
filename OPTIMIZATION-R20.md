# OPTIMIZATION-R20.md — Unify/Streamline, Bug Hunt, Optimize

Session: R20. Approach: unify/streamline first, then bug hunt, then optimize.
No parallel subagents.

## Phase 1: Unify/Streamline

### _spriteScale() helper — Eliminates 3× duplicate formula
**Location**: `src/rendering.js`
**Problem**: `Math.max(0.1,(u.z||10)/10*1.8)` appeared 3 times (lines 85, 592, 632).
**Fix**: Added `_spriteScale(u)` helper function. Replaced all 3 sites.

### _spawnSpellMinion() helper — Eliminates 2× duplicate minion spawn
**Location**: `src/battle.js`
**Problem**: "Spell Minion" spawn code was duplicated in `SPELL_EFFECT.summon`
(line 218) and `tickZones` (line 389). Both created identical minions with
the same stats, only differing in anchor position and attacker reference.
**Fix**: Extracted `_spawnSpellMinion(battle,team,x,y,attackerRef)` helper.
Both sites now call it in a single line.

## Phase 2: Bug Hunt

### BUG-R20-1: fireRecipeFx particle spawn without MAX_PARTICLES budget check
**Location**: `src/rendering.js` — `BattleFX.fireRecipeFx`
**Problem**: The "projectile" FX path spawned up to 5 particles in a loop
without checking `MAX_PARTICLES` budget. If the particle array was already
near the limit (100), this could overflow it, causing performance degradation.
All other particle spawn sites (burst, spellZone, unitAura, death FX) check
the budget — this was the only one that didn't.
**Fix**: Added budget check: `const budget=MAX_PARTICLES-(Battle.particles?.length||0);`
and clamped `steps` to `Math.min(5,Math.floor(d/20),budget)`.

### Verified (No Issues)
- `getLungeOffset` returns shared buffer — all callers use values immediately
  or copy them. No aliasing bugs.
- `_gameTransform` cache invalidation correct (zoom/pan/resize).
- `checkEnd` called after `update` — alive arrays are always initialized.
- `_syncAllUnits` uses `Object.assign` for in-place update — correct.
- `_endBattle` has `_ending` guard against double-call.
- Spell cast in lockstep mode correctly queues command and sets `_pendingCast`.
- `_executeSpellCast` looks up spell from `_allPlayerSpells[team][idx]` —
  correct team-based lookup for both peers.
- Death FX checks `dBudget` before spawning particles.
- `unitAura` checks budget before spawning.
- All `for...of` in battle.js are in init/debug/setup code.
- Pass 0 team glow iterates units 2× (once per team) — correct for batching.

## Phase 3: Optimize

No new hot-path optimizations needed. The `_spriteScale` and `_spawnSpellMinion`
helpers reduce code duplication but don't affect runtime performance (the
formula was already inline, and minion spawn is rare).

## Phase 4: E2E Tests

Multiple runs: 216/0/0, 213/1/2, 215/0/1. 0 real bugs.
All failures are flaky headless Chromium timing issues:
- "arena 0 (none): not running" — battle didn't start in time
- "units moving: no movement" — battle didn't progress in time
- "damage numbers: none yet" — battle didn't progress in time
None are code bugs — all are rAF timing issues in headless mode.
