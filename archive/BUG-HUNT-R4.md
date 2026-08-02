# Bug Hunt R4 — Comprehensive Audit

Date: 2026-08-01

## Weapon Rendering

**Status: CONFIRMED WORKING**

- `SpriteRenderer.draw` called 778+ times per session
- Weapon shapes (`parentJoint != null`) drawn 1463+ times per session
- Pixel analysis confirms weapon pixels visible around ALL units:
  - Wizard staff: 245 weapon px (4.6% of body)
  - Slash sword: 1107 weapon px (13%)
  - Archer bow: 501 weapon px (9.3%)
  - Knight shield: 1357 weapon px (25.6%)
  - Priest staff: 858 weapon px (18.5%)
- Weapons drawn last in shape array (on top of body) — not occluded
- Joint rotation (`arm_raise`) moves weapons above unit during attack animation
- Earlier "0 weapon draw calls" report was a Playwright console.log capture issue, not a rendering bug

## Bugs Found and Fixed

### R4-1: `sizeMod` not preserved on unit objects (Minor)

**Severity:** Low (data preservation)
**Status:** FIXED

`unit()` factory used `x.sizeMod` only to build the recipe/visuals but did not include it in the returned object — unlike `bodyPlan`, `headFeature`, `aura`, etc. This meant the size category couldn't be read back from a saved/serialized unit.

**Fix:** Added `sizeMod:x.sizeMod||"medium"` to the `unit()` return object (line 1190).

### R4-2: `_allUnits` not synced at battle end (Major)

**Severity:** High (gameplay — cumulative draft broken)
**Status:** FIXED

`Battle._allUnits` was introduced to track all units (including dead ones removed from `this.units` after death animation). However, units that died but hadn't finished their death animation (`deathT < 0.5`) when the battle ended were still in `this.units` with `h=0`, but `_allUnits` still had their old HP values. This caused `playerSurvivors` to have stale HP values from before the battle.

**Root cause:** The death cleanup only updated `_allUnits` for units being removed (`deathT >= 0.5`). Units still in `this.units` with `h=0` but `deathT < 0.5` were never synced to `_allUnits`.

**Fix:** Added `Battle._syncAllUnits()` method that syncs all units from `this.units` to `_allUnits`. Called at all 3 battle-end points (timeout, normal end, skip safety).

## E2E Test Results

### Main Suite (e2e_test_r3.py): 24/24 PASS

- Page load, G init, main menu, save state
- All 12 screen navigations (forge, deck, shop, upgrade, codex, settings, stats, tierlist, profile, replays, achievements, matchmaking)
- Forge (skip ad + watch ad)
- Quick match (draft → battle → result)
- Settings toggles (audio, reducedMotion)
- Export/import save
- Quests readable
- 0 pageerrors, 1 expected warning (WebGPU fallback)

### Battle System Tests (bug_hunt_battle.py): 7/7 PASS

| Test | Result |
|------|--------|
| Cumulative draft | PASS — dead units kept in survivors, revived to full HP next round |
| Forged unit size | PASS — z=16 matches SIZE_SCALE["large"] * BODY_SIZE["dragon"] * 10 |
| Dead unit revival | PASS — h=0 units revived to h=mh in buildArmy |
| Spell casting | PASS — manual cast works, cooldown set, enemy HP drops |
| HP bar display | PASS — green/yellow/red pixels match HP ratio |
| Kill attribution | PASS — lastAttacker set on damaged units |
| Floating damage numbers | PASS — Battle.damageNums populated |

### Game Flow Tests (bug_hunt_r4.py): 8/8 SUCCESS

| Flow | Errors | Notes |
|------|--------|-------|
| Forge | 0 | forgeSkipAd + keepForge clean |
| Deck/loadout | 0 | 4 loadout cards + 3 collection cards clicked |
| Shop | 0 | 3 offers clicked, reroll + buy exercised |
| Multi-round match | 0 | R1 → result → next round → R2 → result |
| Settings toggles | 0 | All 9 controls toggled |
| Stats | 0 | Rendered correctly |
| Codex | 0 | All 5 tabs clicked |
| Upgrade | 0 | Upgrade buttons clicked |

**Total: 0 console errors, 0 pageerrors across all flows.**

## Additional Verification

- **Canvas sizing:** Draft and battle canvas both 420x800 (correct mobile portrait)
- **Game transform:** scale=1.05, offsetX=0, offsetY=111.25 (correct contain scaling)
- **Unit bounds:** 0 units out of bounds during battle
- **HP bars:** 481 HP-bar pixels across 5 units (correct colors #34d399/#fbbf24/#fb7185)
- **Damage numbers:** 3 active damage numbers with values 19, 15, 13
- **Safe area insets:** viewport-fit=cover in meta tag, env() padding on body + overlays
- **Forged dragon in battle:** 63 damage dealt, 1 kill at t=5s — actively fighting
- **3-round match:** Cumulative draft works — army grows each round, dead units revived

## Known Non-Bugs

- **WebGPU warning:** "AI init failed, using procedural forge" — expected in headless/no-GPU environments. Game falls back to template forge gracefully.
- **Canvas 300x150 on menu screens:** Default canvas size before sizing. Canvas is hidden on non-draft/battle screens, so this is harmless.
- **`save.losses` is null:** Losses are tracked in `save.ranked.losses`, not `save.losses`. Stats screen uses `save.stats` object. Not a bug.
- **Round-2 battle slow in headless:** requestAnimationFrame throttled in headless Chromium. Battle still completes within 90s game-time timeout. Test-environment artifact only.
