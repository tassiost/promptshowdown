# Bug Hunt R11 — Deep E2E + Static Analysis

Date: 2026-08-02

## Overview

Sequential (no parallel subagents) bug hunt. Focus areas:
- Deep scan of ability triggers, spell effects, projectile system, sprite rendering
- P2P serialization/deserialization edge cases
- Onboarding flow, comeback mechanic, endless mode
- Collection filter/sort, fusion, shop edge cases
- URL import edge cases, replay structure
- All 21 abilities tested in isolation
- All 11 spell effects tested in isolation
- All 4 arena mechanics tested end-to-end

## Methodology

1. Static analysis: targeted grep/read for bug patterns in untested code paths
2. E2E tests: Playwright browser automation covering all flows (184 tests)
3. Each bug logged with: ID, severity, area, description, fix

## Bugs Found

### BUG-R11-001: buff_dmg spell overwrites ramp bonus (damage reduction)
- **Severity**: Medium
- **Area**: Battle / Spells / buff_dmg
- **Description**: The `buff_dmg` spell effect (both the instant version at line 5024 and the persistent zone version at line 5128) recalculated unit damage as `u.d=Math.round((u.baseD||u.d)*u._buffDmgApplied)`. If a unit had the `ramp` ability and had already ramped up its damage (e.g., `u.d = baseD * 2.5` after several kills), applying `buff_dmg` would reset `u.d` to `baseD * 1.2` (the buff multiplier), **reducing** the unit's damage. This made `buff_dmg` actively harmful to `ramp` units.
- **Root Cause**: The buff calculation used `u.baseD * buffPct` which didn't account for ramp bonuses that had increased `u.d` beyond `baseD`. The `Math.max` for `_buffDmgApplied` prevented stacking the buff itself, but didn't prevent the buff from overwriting a higher ramped damage value.
- **Fix**: Changed both locations to use `u.d=Math.max(u.d,buffed)` — the buff only increases damage, never decreases it. If the unit's current damage (including ramp) is higher than the buffed value, the buff is a no-op.
- **Status**: Fixed

## Static Analysis Results

### Systems Reviewed (no new bugs found)

1. **Ability triggers** (`ABILITY_TRIGGERS`): All 10 triggers verified. `on_cooldown` checks `abCool<=0`, `when_ally_hurt` checks allies below 50% HP, `on_first_hit` uses `hasBeenHit` + `firstHitUsed` flags. All correct.

2. **triggerAbility** (21 abilities): All abilities verified. `heal` targets lowest-HP ally, `spawn` caps at 100 units, `explode` hits enemies within 60px, `blink_strike` teleports near target (clamped next frame), `chain_lightning` hits 3 closest enemies. All correct.

3. **takeDamage**: Handles dodge (50% chance), shield (immune), rage (scales with missing HP), executioner (3× below 25% HP), crit, lifesteal, slow, splash, poison, thorns. All damage sources set `lastAttacker`. Correct.

4. **Projectile system**: Homing projectiles track target, synthetic attacker carries projectile properties, lifesteal/ramp copied back to real owner. `synth.d>owner.d` check at line 6048 is dead code (ramp modifies in `onUnitDeath`, not `takeDamage`) but harmless. Correct.

5. **onUnitDeath**: Handles `on_death` trigger, ramp bonus (cap 3× baseD), `on_kill` trigger, kill count, battle stats, kill feed, first blood sound, death FX by body plan. Projectile synth killers resolved by ID. Arena environment kills handled gracefully. Correct.

6. **Spell system** (`Spell.fire`, `checkTriggers`, `tickZones`): All 11 effects handled in both instant and zone paths. Team filtering correct (ally targets → allies only, all others → enemies only). `damage_over_time` uses `Math.max` for `poisonDmg` to prevent overwriting. `buff_speed` uses `Math.max` for `moveSpeedMod`. All correct (after buff_dmg fix).

7. **P2P serialization**: Starter units sent as names, custom units as full objects with minified recipes. Deserialization caps at 100 units, sanitizes spells via `sanitizeSpell`, runs custom units through `unit()`. Compression via LZString with fallback. Correct.

8. **Onboarding**: 6-step interactive tutorial with coachmarks. `_onboardAdvance` and `_onboardSkip` work correctly. Coachmark overlay removed on screen switch (z-index 9999 cleanup). All correct.

9. **Draft flow**: `drawOne` generates 3 cards with no dupes, `pickDraft` places units on battlefield, `reroll` decrements counter and redraws. Comeback (4th draw) for player who lost last round. Bot picks revealed simultaneously. All correct.

10. **Match flow**: `Match.start` → `startRound` (increments round) → `startRoundDraft` → draft → `startBattle` → `Battle.start` → `onBattleEnd` → `Match.onRoundEnd` → next round or `onMatchEnd`. Lives decremented correctly, draw reduces both. Correct.

11. **Save migration**: Uses original `ver` for all comparisons (not updated `s.version`), so all migration steps run in sequence. Future versions refused. Error fallback returns safe default. Correct.

12. **Import/export**: Export uses `btoa(unescape(encodeURIComponent(json)))` for UTF-8 safety. Import validates version, runs migration, sanitizes spellbook and collection. Correct.

13. **Shop**: Cost scales with collection size. Collection capped at 50. Reroll costs 10 coins. "Already owned" handled gracefully. Correct.

14. **Upgrade**: Cost scales with level (`30+lvl*20`). Capped at level 10. `applyUpgrades` boosts HP and DMG by 10% per level. `baseD` set after upgrades so ramp cap uses upgraded base. Correct.

15. **Fusion**: Takes higher of each stat. Removes duplicate. Increments upgrade level. Correct.

16. **Arena mechanics**: `poison_aura` (2 dmg/sec), `speed_boost` (+20% speed, applied once via `_baseS`), `damage_aura` (3 dmg/sec). Environment kills use synthetic `lastAttacker` with `team:"environment"`. `onUnitDeath` handles this gracefully. Correct.

17. **Survivor cleanup**: `onBattleEnd` thoroughly cleans 25+ runtime fields. `buildArmy`/`buildBotArmy` heal to full. `_baseS` restored to prevent speed boost compounding. Correct.

18. **Composition bonuses**: HP/DMG/speed bonuses applied after `initRuntime` (so `baseD` is pre-bonus). `u.mh=u.h` after HP bonus. Correct — ramp cap based on intrinsic damage, not temporary match buff.

19. **checkEnd**: 90s timeout for kite stalemates. Winner by HP total on timeout. `_finalUnits` snapshot before `stop()`. `_syncAllUnits` updates `_allUnits` for cumulative draft. Correct.

20. **`_allUnits` tracking**: Dead units synced to `_allUnits` when removed from `this.units` (after death animation). Alive units synced at battle end. Correct.

21. **Kill attribution**: All damage sources set `lastAttacker`. Poison ticks use the `lastAttacker` set when poison was applied. Dead attackers can't ramp (checked `killer.h>0`). Kill count on dead units is harmless (not in `_finalUnits` for MVP). Correct.

22. **`showConfirm`**: Uses `innerHTML` with `message` parameter. All callers pass static strings or `esc()`-escaped strings. Safe.

23. **`showError`/`toast`**: Use `innerText` (not `innerHTML`). XSS-safe.

24. **`Battle.log`**: Uses `innerHTML` with `<span>` tags. Unit names sanitized by `unit()`. Safe.

25. **`_renderSpellBar`**: Spell names from spellbook (sanitized at creation). Safe.

26. **`showSpellForgePreview`**: Spell name sanitized by `SPELL_FIELD_PARSERS.name` (R10 fix). Safe.

27. **`importUnitFromURL`**: Name sanitized, effect/trigger/role/ability escaped via `escapeHtml()`, numeric stats coerced via `Number()` (R10 fix). Safe.

28. **`_gameTransform`**: Uses `Math.min` (contain) not `Math.max` (cover) — game area letterboxed, background fills viewport. AGENTS.md comment says "cover" but code is "contain". The "contain" behavior is correct for this game (centered play area, full-screen background). Documentation mismatch, not a bug.

29. **`separate`**: Handles d=0 edge case with random direction. Spatial partitioning via grid hash. Correct.

30. **`_baseSpeedMod`**: Stored at `initRuntime` but never read. Dead code — `buff_speed` uses `_buffSpeedApplied` with `Math.max` instead. Harmless.

## E2E Test Results

Test suite: `e2e_test_r11.py` (184 tests covering all major flows + isolated ability/spell testing)

```
PASS:     184
FAIL:     0
WARN:     0
ERRORS:   0
BUGS:     0
```

### Test Coverage

| Test | Area | Result |
|------|------|--------|
| 1 | Page Load + Init (5 tests) | 5/5 PASS |
| 2 | Onboarding (2 tests) | 2/2 PASS |
| 3 | All Screens (14 screens) | 14/14 PASS |
| 4 | Settings (9 tests: 5 langs, 3 diffs, audio) | 9/9 PASS |
| 5 | Forge (12 tests: unit, spell, cap) | 12/12 PASS |
| 6 | Deck (11 tests: loadout, presets, fusion, sort) | 11/11 PASS |
| 7 | Draft Flow (5 tests: pick, reroll) | 5/5 PASS |
| 8 | Battle Edge Cases (8 tests: NaN, HP, cooldowns, movement) | 8/8 PASS |
| 9 | Battle Abilities (63 tests: 21 abilities × 3 checks) | 63/63 PASS |
| 10 | Spell Effects (22 tests: 11 effects × 2 checks) | 22/22 PASS |
| 11 | Match Flow (1 test: full match completion) | 1/1 PASS |
| 12 | Save/Load/Import/Export (4 tests) | 4/4 PASS |
| 13 | Quests + Achievements (5 tests) | 5/5 PASS |
| 14 | Upgrade + Shop + Codex + Tierlist + Profile + Stats (14 tests) | 14/14 PASS |
| 15 | Arena Mechanics (7 tests: all 4 arenas + speed boost) | 7/7 PASS |
| 16 | Replays (1 test) | 1/1 PASS |
| 17 | URL Import (1 test) | 1/1 PASS |
| 18 | Console Errors (1 test) | 1/1 PASS |

### Console Errors / PageErrors

**0 console errors, 0 page errors** throughout all 184 tests.

## Summary

- **1 bug found and fixed** (buff_dmg overwriting ramp bonus)
- **0 bugs remaining** in E2E test suite
- **0 console errors / page errors**
- All 184 functional tests pass
- Static analysis covered 30 subsystems with no additional issues found
- All 21 abilities tested in isolation (init, no crash, no NaN)
- All 11 spell effects tested in isolation (fire, no NaN)
- All 4 arena mechanics tested end-to-end
