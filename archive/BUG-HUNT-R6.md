# Bug Hunt R6 — Spell System & CSS Layout Deep Dive

Date: 2026-08-01

## Overview

Round 6 focused on deep testing of the spell system (all 11 effects, zones, target filtering, manual + auto casting, cooldowns, triggers) and CSS layout of fixed-position overlays. A Playwright-based subagent drove the module-scoped spell system via `window.Battle` / `window.G` / `window.unit`, exercising real code paths through `Battle.fireSpell`, `Battle.update`, `Spell.checkTriggers`, and `Spell.tickZones`.

**Result: 3 bugs found. 2 fixed (BUG-101, BUG-102). 1 documented as design finding (BUG-103).**

## Bugs Found

### BUG-101 (FIXED): All `calc(NNpx+env(safe-area-inset-*))` CSS declarations are invalid — 16 overlays mispositioned

**Severity: Critical (UI completely broken in battle/draft)**

**Root cause:** CSS `calc()` requires whitespace around `+` and `-` operators. All 16 instances of `calc(NNpx+env(...))` in `index.html` had **no spaces** around `+`, making the entire declaration invalid. The browser discards the invalid `top`/`bottom`/`padding` value, causing fixed-position elements to fall back to their static position (top:0) or `auto`.

**Verified empirically:**
- `calc(50px+env(safe-area-inset-bottom,0px))` → computed `bottom: 725px` (invalid, element at top:0)
- `calc(50px + env(safe-area-inset-bottom,0px))` → computed `bottom: 50px` (correct, element at bottom)

**Affected elements (all 16):**
| Line | Element | Property | Impact |
|------|---------|----------|--------|
| 29 | `#app` container | padding-top/bottom/left/right | Safe-area padding ignored |
| 32 | `.screen` | padding-top/bottom | Safe-area padding ignored |
| 313 | `#draftHUD` | padding-top | HUD at top:0 instead of 4px |
| 333 | `#comebackBanner` | top | Banner at top:0, overlaps HUD |
| 334 | `#draftOverlay` | padding-bottom | Bottom padding ignored |
| 359 | `#battleHUD` | padding-top | HUD at top:0 instead of 4px |
| 381 | Battle stats bar | top | At top:0, overlaps HUD |
| 386 | `#roundHistoryBar` | top | At top:0, overlaps stats |
| 387 | `#spellBar` | bottom | **At top:0 — Forfeit button overlaps and intercepts all clicks** |
| 389 | `#compBonus` | top | At top:0, overlaps HUD |
| 390 | `#battleStats` | top | At top:0, overlaps HUD |
| 391 | `#killFeed` | top | At top:0, overlaps HUD |
| 392 | `#unitInspector` | bottom | At static position, misplaced |
| 394 | Forfeit button | top | At top:0, overlaps HUD |
| 395 | Bottom control bar | padding-bottom | Bottom padding ignored |
| 402 | `#battleControlsHint` | bottom | At top:0, overlaps HUD |

**Most visible symptom:** The spell bar (`#spellBar`) rendered at the TOP of the viewport (y=0) instead of the bottom. The Forfeit button (z-index:100, top:70px) sat on top of it and intercepted all spell-bar clicks, making manual spell casting via UI impossible.

**Fix:** Added spaces around `+` in all 16 `calc()` expressions:
```
calc(50px+env(safe-area-inset-bottom,0px))  →  calc(50px + env(safe-area-inset-bottom,0px))
```
Applied via `sed -i '' 's/calc(\([0-9.]*px\)+env(/calc(\1 + env(/g' index.html`.

**Verification:** After fix, `#spellBar` computed `bottom: 50px`, rendered at `top: 636` (viewport height 743). Spell button at `y: 636, height: 57`. Forfeit button at `top: 74`. No overlap. Manual spell casting via UI now works.

---

### BUG-102 (FIXED): `Quests.track` crashes when `G.save.quests` is undefined — breaks spell casting

**Severity: High (latent crash, breaks entire spell system)**

**Root cause:** `Quests.track(event,data)` (line 6820) dereferences `G.save.quests.list` without first checking that `G.save.quests` itself exists:
```js
// BROKEN — crashes if G.save.quests is undefined
const q=G.save.quests;
if(!q.list||!Array.isArray(q.list))return;  // TypeError: Cannot read properties of undefined
```

`Spell.fire` unconditionally calls `Quests.track("spell_use")` as its last action (line 4917). If `G.save.quests` is `undefined` (fresh/incompletely-migrated save, or save not yet loaded via the async IDB path), this throws and propagates out of `Spell.fire`, aborting the spell cast.

**Same issue in 3 other Quests methods:**
- `checkStreak()` (line 6787) — `q.streak` throws if `q` is undefined
- `generateDaily()` (line 6804) — `q.date`/`q.list` throws if `q` is undefined
- `claim(id)` (line 6835) — `q.list.find()` throws if `q` is undefined

**Fix:** Added null guard for `q` in all 4 methods:
```js
// FIXED
const q=G.save.quests;
if(!q||!q.list||!Array.isArray(q.list))return;
```

**Verification:** With `G.save.quests = undefined`, all 4 methods return gracefully (no throw). `Battle.fireSpell` completes successfully. `Spell.fire` no longer crashes.

---

### BUG-103 (Design Finding): `heal_allies` spell with `center` target heals ENEMIES instead of allies

**Severity: Low (mitigated by forge validation, only affects imported/P2P spells)**

**Root cause:** `Spell.fire` filters affected units by **target name**, not by effect intent (line 4906-4911):
```js
if(spec.target.startsWith("ally")||spec.target==="lowest_ally"){
  affected=affected.filter(u=>u.team===team);  // allies only
}else{
  affected=affected.filter(u=>u.team!==team);  // enemies only (center, enemy_*)
}
```

`center` is not an `ally*` target, so it falls into the `else` branch and filters to **enemies only** — regardless of the effect being `heal_allies`. A healing spell with `center` target heals enemies; a shield spell shields enemies.

**Mitigation:** The forge system's `semanticValidateSpell` (line 2917-2919) detects this combination and auto-fixes it:
```js
if(SPELL_ALLY_EFFECTS.includes(a.effect)&&!SPELL_ALLY_TARGETS.includes(a.target))flagged.push("target");
// Auto-fix: attrs.target="ally_cluster";
```

This validation runs in both the template forge and the LLM forge paths. However, spells imported via save import or received via P2P bypass this validation and could have the self-sabotaging combination.

**Documented as by-design:** The AGENTS.md rules explicitly state: "All other targets (including `center`) default to enemies only." This is the intended filter behavior. The fix should be at the generation/import layer (validate on import/P2P receive), not at the `Spell.fire` filter level.

**Recommendation:** Run `semanticValidateSpell` on imported and P2P-received spells before adding them to the spellbook.

---

## Spell System — Verified Working (36 checks PASS)

### All 11 Spell Effects
| Effect | Verification | Status |
|--------|-------------|--------|
| `damage` | -40 HP applied to target | PASS |
| `damage_over_time` | poison 12/tick, uses `Math.max` for stacking | PASS |
| `heal_allies` | HP restored, capped at `mh` | PASS |
| `heal_over_time` | regen 15/tick → +60 over 2s | PASS |
| `shield_allies` | `shieldActive=3` (duration-based immunity) | PASS |
| `slow` | `slow=4` applied to target | PASS |
| `stun` | `stun=2` applied to target | PASS |
| `buff_speed` | `moveSpeedMod` 100→130 | PASS |
| `buff_dmg` | `d` 20→30 via `baseD×1.5` | PASS |
| `summon` | 3 minions spawned for magnitude 50 | PASS |
| `knockback` | Anchor stationary, others pushed away | PASS |

### Persistent Zones
- Zone creation: `{x,y,radius,duration,team}` stored in `Battle.zones`
- `tickZones` applies effect once per second (verified deltas `[20,20,20]`)
- Zone removed when `duration<=0` via `_remove` flag
- Ally-target zone affects allies only; `center` zone affects enemies only

### Target Filtering
- `damage@enemy_cluster` → enemies only ✓
- `heal_allies@ally_cluster` → allies only ✓
- `damage@center` → enemies only ✓
- (BUG-103: `heal_allies@center` → enemies only — wrong for beneficial effect)

### Manual Casting
- `Battle._castPlayerSpell` fires effect, sets `cooldown=maxCD`
- Cooldown ticks down via `Battle.update`, re-enables at 0
- Spell bar renders buttons with icon + name + tooltip + cooldown overlay
- (BUG-101: spell bar was at top:0, unclickable — now fixed)

### Auto-Fire Triggers (all 5)
| Trigger | Condition | Status |
|---------|-----------|--------|
| `battle_start` | `time < 0.1` | PASS |
| `on_first_contact` | `dist < 80` | PASS |
| `delayed_3s` | `time >= 3` | PASS |
| `when_ally_hurt` | `h < mh×0.5` | PASS |
| `periodic_5s` | every 5s (`fired` reset) | PASS |

### Edge Cases
- No valid targets (all enemies dead) → no-op, no error
- Spell on dead unit → filtered out (h>0 filter)
- Empty battle → no error

### Effect/Target Inventory Mismatches (not bugs — spec vs. implementation)
The task spec listed effect/target names that don't exist in the code:
- `freeze` — not a spell effect (only a keyword for "Frost Nova" preset which uses `effect:"stun"`)
- `cleanse` — not a spell effect (it's a unit ability, not in `SPELL_EFFECT`)
- `buff_shield` — actual name is `shield_allies`
- `buff_damage` — actual name is `buff_dmg`
- `ally_all`, `ally_lowest`, `enemy_all` — don't exist in `SPELL_TARGET`

Unknown effects silently no-op (`SPELL_EFFECT[spec.effect]?.(...)` — no error, no warning). Unknown targets cause `Spell.fire` to return early (anchor null). A spell with a typo'd effect/target name is a silent dud.

**Actual `SPELL_ENUM.effect`:** `damage, damage_over_time, slow, stun, heal_allies, heal_over_time, shield_allies, summon, knockback, buff_dmg, buff_speed`

**Actual `SPELL_TARGET`:** `enemy_cluster, enemy_frontline, enemy_backline, enemy_carry, lowest_hp_enemy, highest_hp_enemy, random_enemy, center, ally_cluster, lowest_ally`

---

## Files Changed

1. **`index.html`** — Fixed 16 `calc()` expressions (BUG-101) and 4 `Quests.*` null guards (BUG-102)
2. **`bug_hunt_r6_spells.py`** — Created by subagent (Playwright spell system test suite, 39 tests)

## Test Coverage

- Spell system: 39 tests (36 PASS / 3 FAIL → 2 now fixed, 1 documented)
- CSS layout: 2 empirical verification tests (calc validity, spell bar positioning)
- Quests null safety: 5 tests (track, checkStreak, generateDaily, claim, spellFire)
