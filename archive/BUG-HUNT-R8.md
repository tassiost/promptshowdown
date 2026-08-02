# Bug Hunt R8 — E2E Testing + Static Analysis

Date: 2026-08-01

## Overview

Systematic end-to-end testing of all game flows plus static analysis of index.html.
No parallel subagents — all testing done sequentially.

## Methodology

1. Static analysis: grep/read for code smells, logic errors, edge cases
2. E2E tests: Playwright-based browser automation covering all major flows
3. Each bug logged with: ID, severity, area, description, fix

## Bugs Found & Fixed

### Bug #1 — SPELL_EFFECT.summon missing unit cap (MAJOR)
- **Area**: Battle/Spells
- **Description**: The `SPELL_EFFECT.summon` function (line 4995) didn't check the total unit count before spawning minions. This could allow unlimited minion spawning via spells, causing memory exhaustion and performance degradation in long battles.
- **Fix**: Added `if(b.units.length>=100)break;` check inside the summon loop.
- **Note**: The `triggerAbility` spawn case and `tickZones` summon case were already fixed in R7, but the `SPELL_EFFECT.summon` direct effect was missed.

### Bug #2 — saveReplay silent error swallowing (MINOR)
- **Area**: Save/Replay
- **Description**: The `saveReplay` function (line 7993) had an empty `catch(e){}` block that silently swallowed errors. If replay saving failed, there was no way to debug the issue.
- **Fix**: Changed to `catch(e){console.warn("saveReplay failed:",e);}` for error logging while still being non-fatal.

## Static Analysis Results

### Checked Areas (all clean)

1. **Division by zero**: All divisions by `u.mh`, `target.mh`, `attacker.mh` are guarded with `>0` checks
2. **NaN propagation**: `spawnDmgNum` validates x/y are numbers; `spriteScale` uses `Math.max(0.1, ...)`
3. **Null target handling**: All `TARGETING` functions return null for empty arrays; `act()` checks `target&&target.h>0`
4. **Movement dead zones**: `kite` dead zone ends at `u.r` (aligned with attack range, fixed in R7)
5. **Timer cleanup**: `Battle.stop()` clears all timers (frame, interpRAF, autoTimer, music)
6. **Event listeners**: `audioInit` self-removes after first call; other listeners are global and persist
7. **innerHTML XSS**: Unit names sanitized by `unit()` factory; colors by `sanitizeHex()`; spell names by `sanitizeSpell()`
8. **Spell enum validation**: `Spell.fire` validates effect/shape/target against enums with console warnings
9. **Ability triggers**: All triggers handle edge cases (null allies, dead enemies, cooldown ready)
10. **Projectile system**: Handles dead targets (homing stops), missing targets (no hit), lifetime expiry
11. **P2P snapshots**: `applySnapshot` validates units array; `_processedCrits` pruned to prevent growth
12. **Battle timeout**: 90s timeout prevents infinite kite stalemates; `skip()` has 2000-iteration safety
13. **Cumulative draft**: `_allUnits` tracks all units (including dead) for revival between rounds
14. **Match end detection**: `onRoundEnd` properly decrements lives and checks for match end
15. **Save persistence**: `saveData` falls back to IndexedDB; `loadDataAsync` checks both
16. **Upgrade system**: Validates cost, checks max level, properly deducts coins
17. **Quest validation**: `generateDaily` validates QUEST_POOL; `claim` validates reward structure
18. **Cooldown cap**: `u.abCool` uses `Math.max(0, u.abCool-dt)` to prevent negative values
19. **Minion cap**: All three summon paths (ability, tickZones, SPELL_EFFECT) now check `units.length<100`
20. **Separation**: Spatial grid with random push for same-position units; checked set prevents double-processing

## E2E Test Results

### Test Summary
```
Total Tests:  42
PASS:         42
FAIL:          0
WARN:          1 (test timing issue, not a game bug)
BUGS:          0
PageErrors:    0 (excluding CORS from file://)
Console Errors: 0 (excluding CORS from file://)
```

### Test Coverage

| Test | Area | Result |
|------|------|--------|
| 1 | Page load + init | PASS |
| 2 | Onboarding + menu | PASS |
| 3 | Screen navigation (6 screens) | PASS |
| 4 | Forge unit (template) | PASS |
| 5 | Forge spell (template) | PASS |
| 6 | Forge daily cap | PASS |
| 7 | Deck management | PASS |
| 8 | Quick match (full battle) | PASS (96s) |
| 9 | Full match flow (3-5 rounds) | PASS (46s, 3 rounds) |
| 10 | Save/load persistence | PASS |
| 11 | Quests generation + validation | PASS |
| 12 | Achievements screen | PASS |
| 13 | Settings + language switch | PASS |
| 14 | Upgrade screen | PASS |
| 15 | Matchmaking + cancel | PASS |
| 16 | Battle edge cases (NaN, HP, cooldowns, movement) | PASS |
| 16b | Replay screen | PASS |
| 16c | Share match result | PASS |
| 17 | Console error summary | PASS (0 errors) |

### Battle Simulation Checks
- No NaN in unit positions/HP
- No negative HP values
- No negative ability cooldowns
- Units are moving (not stuck)
- Battle time advancing
- No PageErrors during battle
- No console errors during battle
- Match ends correctly (3 lives → match end)
- Round results show correctly
- "Next Round" vs "Play Again" button detection works

## Files Modified

- `index.html` — Fixed SPELL_EFFECT.summon unit cap, saveReplay error logging
- `BUG-HUNT-R8.md` — This document
- `e2e_test_r8.py` — Comprehensive E2E test suite (42 tests)

## Conclusion

The codebase is in excellent shape after R7+R8 bug hunts. Only 2 bugs were found in R8:
- 1 MAJOR (summon spell effect missing unit cap)
- 1 MINOR (saveReplay silent error)

Both have been fixed. All 42 E2E tests pass with 0 PageErrors and 0 console errors.
