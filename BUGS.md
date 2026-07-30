# Bug Hunt — Prompt Showdown

Status legend: 🔴 confirmed | 🟡 suspected | 🟢 fixed | ⚪ cannot reproduce

---

## Critical

### BUG-001 🟢 `lighten()` produces invalid hex colors (crashes forge preview)
**File:** index.html:841-846
**Found:** 2026-07-30
**Repro:** Forge any unit with a pattern (e.g. "dragon" → scales pattern). The pattern applies `c2=lighten(scaled.c,0.15)` to body shapes. When `scaled.c` is a 3-char hex (e.g. `#fb0`, `#a72`, `#000`), `lighten` produces invalid output like `#2635d6.4` (decimal point in hex).
**Root cause:** Two bugs in `lighten`:
1. `r`, `g`, `b` are not `Math.round`'d → `(1<<24)+(r<<16)+(g<<8)+b` is a float → `.toString(16)` includes decimal point (e.g. `19281366.25.toString(16)` = `"12635d6.4"`)
2. 3-char hex (`#fb0`) not expanded to 6-char (`#ffbb00`) → `parseInt('fb0',16)` = 4016 = 0x0FB0, wrong channels extracted
**Impact:** Forge preview crashes with `addColorStop` SyntaxError. Any forged unit with a pattern on a 3-char-hex shape breaks rendering. Also affects `headHex=lighten(primary,0.2)` if primary is 3-char (unlikely since COLOR_MAP uses 6-char, but possible).
**Fix:** Round channels + handle 3-char hex:
```js
function lighten(hex,amt){
  let h=hex.slice(1);
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  const r=Math.min(255,Math.round(((n>>16)&255)+amt*255));
  const g=Math.min(255,Math.round(((n>>8)&255)+amt*255));
  const b=Math.min(255,Math.round((n&255)+amt*255));
  return"#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
```

### BUG-002 🟢 RECIPE_MINIFY key collisions corrupt P2P serialization
**File:** index.html:1418-1428
**Found:** 2026-07-30
**Repro:** Serialize a forged unit via `serializeUnitsForPeer` → `deserializeUnitsFromPeer`. Shapes with `cx`/`cy` properties (circles, arcs, ellipses) lose those properties.
**Root cause:** `RECIPE_MINIFY` maps both `cx:"x"` and `x:"x"` to the same short key `"x"`. When `RECIPE_EXPAND` is built via `Object.fromEntries(Object.entries(RECIPE_MINIFY).map(([k,v])=>[v,k]))`, duplicate values overwrite — `RECIPE_EXPAND["x"]="x"` (last wins), so `cx` is lost. Same for `cy:"y"` / `y:"y"`.
**Verified:** `{t:'circle',cx:10,cy:20,r:8}` → minified `{t:'circle',x:10,y:20,r:8}` → expanded `{t:'circle',x:10,y:20,r:8}` (cx/cy become x/y — wrong keys for circle renderer).
**Impact:** P2P multiplayer: forged units sent to peer render incorrectly (shapes with cx/cy misplaced or invisible). Share URLs may also be affected.
**Fix:** Use unique short keys: `cx:"cx"`, `cy:"cy"` (or `cx:"kx"`, `cy:"ky"`).

### BUG-003 � `unit()` drops visual modifier fields (P2P + share + clone)
**File:** index.html:611-635
**Found:** 2026-07-30
**Repro:** Forge a unit with visual modifiers → serialize for P2P → deserialize on peer. The peer's unit has no `headFeature`, `backFeature`, `tailFeature`, `aura`, `eyeStyle`, `pattern`, `weaponStyle`, or `bodyPlan`.
**Root cause:** `attrsToUnit` (line 1525-1531) stores visual modifiers on the unit object. But `unit()` (line 611-635) only copies a fixed set of fields — it doesn't preserve `headFeature`, `backFeature`, `tailFeature`, `aura`, `eyeStyle`, `pattern`, `weaponStyle`, or `bodyPlan`. These are silently dropped.
**Affected paths:**
- `deserializeUnitsFromPeer` → `unit(d)` → drops visual modifiers
- `cloneUnit(u)` → `unit(JSON.parse(JSON.stringify(u)))` → drops visual modifiers
- `shareUnit` (line 4359) → doesn't include visual modifiers in shared data
**Impact:** P2P: peer sees broken unit (no aura, no head features, wrong eyes). Share: imported unit missing visual modifiers. Clone: cloned units lose visual modifiers (affects draft duplicates).
**Fix:** Add visual modifier fields to `unit()`:
```js
bodyPlan:x.bodyPlan||null,
headFeature:x.headFeature||"none",
backFeature:x.backFeature||"none",
tailFeature:x.tailFeature||"none",
aura:x.aura||"none",
eyeStyle:x.eyeStyle||"normal",
pattern:x.pattern||"none",
weaponStyle:x.weaponStyle||"standard",
```
Also add them to `shareUnit`'s data payload.

---

## Medium

### BUG-004 � Spell persistent zones hardcoded to enemies only
**File:** index.html:3185-3186
**Found:** 2026-07-30
**Description:** `tickZones` always applies zone effects to `u.team!==z.team` (enemies). Ally-targeted persistent zones (e.g., healing zone, shield zone) would damage allies instead of helping them.
**Impact:** Any spell with `shape:"persistent_zone"` and `target:"ally_*"` will target enemies instead. Currently no such spell exists in templates, but LLM-forged spells could produce them.
**Fix:** Check `z.spec.target` to determine ally vs enemy filtering.

### BUG-005 � Movement functions don't check if target is dead
**File:** index.html:2136-2161
**Found:** 2026-07-30
**Description:** `chase`, `flee`, `hold_midpoint`, `kite` check `if(target)` but not `if(target.h>0)`. Units could chase/flee dead targets.
**Note:** In practice, the targeting functions pre-filter dead units (line 3350-3351), so `target` should always be alive. However, a unit could die between targeting and movement in the same frame (if another unit kills it first in the loop). Low real-world impact.
**Fix:** Add `target&&target.h>0` checks in movement functions.

### BUG-006 � Shape cap too low (14) drops visual features
**File:** index.html:1346-1347
**Found:** 2026-07-30
**Description:** `while(shapes.length>14)shapes.splice(shapes.length-1,1)` drops from the END. Shapes are added: body → weapon → head features → back features → tail features. So it drops tail first, then back, then head, then weapon. The comment says "drop lowest-priority: pattern, then back, then head" but pattern (body shapes) is never dropped.
**Impact:** Complex units with many features lose tail/back features. Not critical but suboptimal priority.
**Fix:** Drop in priority order: tail → back → head → weapon (current order is tail → back → head → weapon, which is actually reasonable). Or increase cap. Low severity.

### BUG-007 � `G.screen()` leaves blank page if target doesn't exist
**File:** index.html:4204-4212
**Found:** 2026-07-30
**Description:** If `$(id)` returns null, all screens lose `active` class and none gets it. Player sees blank page.
**Fix:** Fall back to menu screen: `if(!target)target=$("menu");`

### BUG-008 � All-spell draft picks → empty army → instant loss
**File:** index.html:4841-4855
**Found:** 2026-07-30
**Description:** If all draft picks are spells (20% chance each, ~0.8% for 3 picks), `buildArmy()` returns empty array. Battle starts with 0 player units → instant loss.
**Fix:** Guarantee at least 1 unit in draft, or auto-fill with base units if army is empty.

### BUG-009 � `migrateSave` keeps empty loadout array
**File:** index.html:547
**Found:** 2026-07-30
**Description:** `if(s.loadout)` is truthy for `[]`. Empty loadout → player can't field units. Only triggers with corrupt save data.
**Fix:** `if(s.loadout&&s.loadout.length>0)`

---

## Low

### BUG-010 � Poison ticks after unit death
**File:** index.html:3320-3324
**Found:** 2026-07-30
**Description:** Poison continues ticking on dead units (h<=0) until duration expires. Harmless (dead units are skipped in main loop) but wastes computation.
**Fix:** Add `if(u.h<=0)continue;` before poison tick.

### BUG-011 � `eyeStyle:"closed"` doesn't skip eye drawing
**File:** index.html:2516-2535
**Found:** 2026-07-30
**Description:** `EYE_STYLES.closed = null` but `drawFace` doesn't check for `eyeStyle==="closed"` to skip eyes. It only checks `recipe.face===false`. Units with `eyeStyle:"closed"` still draw eyes.
**Fix:** Add `if(u.recipe?.eyeStyle==="closed")return;` in `drawFace`.

### BUG-012 � `GameAudio.stopMusic` doesn't disconnect gain nodes
**File:** index.html:2713-2717
**Found:** 2026-07-30
**Description:** `stopMusic` stops oscillators but doesn't disconnect gain nodes (`bg`, `g`). Minor memory leak in audio graph.
**Fix:** Store gain nodes and disconnect them in `stopMusic`.

### BUG-013 � Quest streak doesn't update across midnight
**File:** index.html:3833-3848
**Found:** 2026-07-30
**Description:** `checkStreak()` only runs during `G.init()`. If a session spans midnight, streak won't increment until next restart.
**Fix:** Check streak on each match end or periodically.

### BUG-014 � Double-forge race condition
**File:** index.html:5304
**Found:** 2026-07-30
**Description:** Rapidly clicking "Watch Ad" + "Skip" could call `_doForge` twice. Second call overwrites `pendingForgeUnit`.
**Fix:** Set a `_forgeRunning` flag and guard against re-entry.

---

## Investigated — Not Bugs

- **Targeting functions don't filter dead units** (line 2115-2130): NOT a bug — enemies array is pre-filtered with `h>0` at line 3350-3351 before being passed to targeting.
- **Spell periodic trigger missing init** (line 3165-3167): NOT a bug — `lastFire:0` is initialized at line 3273.
- **`renderPreview` crashes on null recipe**: NOT a bug — `draw()` has a null-recipe guard at line 2463.
- **`drawFace` crashes on null recipe**: NOT a bug — `u.recipe&&u.recipe.eyeColor` guard at line 2529 protects the eyeStyle access.
- **`GameAudio.startMusic` creates multiple bass oscillators**: NOT a bug — `if(this.musicInterval)return` guard at line 2691 prevents double-start.
- **Colorblind filter mutates shapes**: NOT a bug — `shape={...shape,c:...}` creates a new object at line 2371.
- **`scaleShape` mutates original pts**: NOT a bug — `out.pts=out.pts.map(...)` creates new arrays.
- **RecipeAssembler pattern mutates BODY_PLANS**: NOT a bug — `scaleShape` returns new objects, pattern is applied to the copy.

---

## Round 2 — 2026-07-30 (battle timeout investigation)

### BUG-015 🟢 Projectiles not homing (fixed position → guaranteed miss vs moving targets)
**File:** index.html:3560-3588 (updateProjectiles)
**Found:** 2026-07-30
**Description:** Projectiles stored `tx`/`ty` at fire time but never updated them. Hit check was `Math.hypot(f.x-p.tx,f.y-p.ty)<=22` — if target moved >22px before projectile arrived, it missed. With projectile speed 320px/s and Archer range 170, travel time ~0.53s, a unit at speed 65 moves ~34px → guaranteed miss. This caused ranged units to be ineffective, leading to timeouts.
**Fix:** Added `targetId` to projectile, track target position each frame (homing). Also added `f.z` to hit radius so larger units are easier to hit.

### BUG-016 🟢 Separation uses `a.z+b.z` (sum of radii) — prevents melee units from closing distance
**File:** index.html:3599 (separate)
**Found:** 2026-07-30
**Description:** `separate()` pushed units apart to `a.z+b.z` distance. Two large forged units (z=40 each) get pushed to 80px apart, but melee range is typically 30-40. They can never close distance → softlock → timeout.
**Fix:** Changed to `Math.max(a.z,b.z)` — units overlap to the larger unit's radius, allowing melee contact.

### BUG-017 🟢 `on_first_hit` trigger only marks `firstHitUsed` for shield ability
**File:** index.html:3546-3553
**Found:** 2026-07-30
**Description:** `triggerAbility` only set `u.firstHitUsed=true` inside the `case "shield"` block. If a unit had `abilityTrigger:"on_first_hit"` with any other triggered ability (heal, spawn, explode, heal_burst), `firstHitUsed` was never set, so the ability fired every frame.
**Fix:** Move `firstHitUsed` mark to after the switch statement, applies to all triggered abilities.

### BUG-018 🟢 Spell SFX operator precedence bug (always plays "fire" sound)
**File:** index.html:3157
**Found:** 2026-07-30
**Description:** `GameAudio.sfx("spell_"+spec.fxType==="explosion"?"fire":...)` — JS concatenates first: `"spell_explosion"==="explosion"` is always `false`, so the ternary always falls through to `"fire"`. Frost/lightning spell sounds never play.
**Fix:** Add parentheses: `"spell_"+(spec.fxType==="explosion"?"fire":...)`.

### BUG-019 🟢 Poison damage hardcoded to 3 (ignores `poisonDmg` from spells/abilities)
**File:** index.html:3338
**Found:** 2026-07-30
**Description:** Poison tick used `u.h-=3` (hardcoded). `SPELL_EFFECT.damage_over_time` set `u.poisonDmg=spec.magnitude||10` but it was never read. Spell-based poison did only 3/tick instead of the specified magnitude. Unit ability `poison` also didn't set `poisonDmg`, so it used the default 3.
**Fix:** Changed to `u.h-=u.poisonDmg||3`. Also set `poisonDmg` in the unit poison ability (`attacker.d*0.3`).

### BUG-020 🟢 Streak toast displays `[object Object]` instead of count
**File:** index.html:3894
**Found:** 2026-07-30
**Description:** `toast(\`🔥 ${q.streak}-day streak!\`)` — `q.streak` is an object `{lastLogin, count}`, so the template literal prints `[object Object]`.
**Fix:** Changed to `q.streak.count`.

### BUG-021 🟢 `applySnapshot` resets guest unit animation/runtime state
**File:** index.html:3813
**Found:** 2026-07-30
**Description:** `applySnapshot` called `this.initRuntime({...u})` on every snapshot, which unconditionally resets `animState="idle"`, `attackT=-1`, `cool=0`, etc. This overwrote the host's animation state, so guest saw no attack/move/death animations.
**Fix:** Changed to shallow copy `{...u, mh:u.mh||u.h, prevH:u.prevH??u.h}` — preserves all runtime fields from host.

### BUG-022 🟢 `applySnapshot` doesn't update projectiles (guest sees no projectiles)
**File:** index.html:3813
**Found:** 2026-07-30
**Description:** `Battle.snapshot()` includes `projectiles` but `applySnapshot` never set `this.projectiles`. Guest rendered stale/empty projectile array.
**Fix:** Added `if(s.projectiles)this.projectiles=s.projectiles`.

### BUG-023 🟢 `buildArmyFromSelected` missing empty army fallback (P2P guest all-spell picks)
**File:** index.html:5022-5036
**Found:** 2026-07-30
**Description:** `_buildArmyFromPicks` had an empty-army fallback (added in BUG-008 fix), but `buildArmyFromSelected` (used for P2P guest army) did not. If a guest sent all-spell picks, the guest army would be empty → instant loss.
**Fix:** Added the same empty-army fallback to `buildArmyFromSelected`.

---

## Round 3 — 2026-07-30 (deep bug hunt)

### BUG-024 🔴 Attack cooldown inverted (fast attackers attack slower)
**File:** index.html:3441
**Found:** 2026-07-30
**Description:** `u.cool=u.a` set cooldown to the attack speed value directly. But `a` is attacks-per-second, so cooldown should be `1/a`. With the old code, a unit with `a=2` (fast) got a 2s cooldown (slow), and a unit with `a=0.5` (slow) got a 0.5s cooldown (fast). This inverted attack speeds for all units.
**Fix:** Changed to `u.cool=1/u.a`.

### BUG-025 🔴 Slow status has no effect on movement speed
**File:** index.html:2146-2174
**Found:** 2026-07-30
**Description:** The `slow` debuff (`u.slow`) was tracked and decremented, and a visual ring was drawn, but movement functions used `u.s*(u.moveSpeedMod/100)*dt` without checking `u.slow`. Slowed units moved at full speed.
**Fix:** Added `effSpeed(u)` helper that halves speed when `u.slow>0`. All movement functions now use `effSpeed(u)`.

### BUG-026 🟡 `spell_use` quest never tracked (impossible to complete)
**File:** index.html:3877, 3142-3165
**Found:** 2026-07-30
**Description:** The "Use a spell in battle" quest (`type:"spell_use"`) was defined in `QUEST_POOL` but `Quests.track("spell_use")` was never called anywhere. The quest was impossible to complete.
**Fix:** Added `Quests.track("spell_use")` in `Spell.fire()`.

### BUG-027 🟡 `Quests.track` ignores `data` parameter for value-based quests
**File:** index.html:3918-3928
**Found:** 2026-07-30
**Description:** `track(event,data)` always incremented progress by 1, ignoring `data`. For `round_reach` quests, `track("round_reach",5)` was called but only incremented by 1, requiring 5 matches reaching round 5 instead of 1.
**Fix:** `track` now uses `data` as the increment amount when provided.

### BUG-028 🟡 `analyticsOptOut` saved to wrong path (opt-out doesn't work)
**File:** index.html:4559-4564, 495
**Found:** 2026-07-30
**Description:** `saveSetting('analyticsOptOut',val)` stored the value at `this.save.settings.analyticsOptOut`, but `Analytics.track` checks `G.save?.analyticsOptOut` (top-level). The opt-out setting was never read, so analytics were always sent.
**Fix:** `saveSetting` now stores `analyticsOptOut` at the top level of save data.

### BUG-029 🟡 `deserializeUnitsFromPeer` converts spells to broken units
**File:** index.html:1499-1508
**Found:** 2026-07-30
**Description:** When spells (with `_isSpell:true`) were sent via `serializeUnitsForPeer` in `round_deck` messages, `deserializeUnitsFromPeer` called `unit(d)` on them. `unit()` doesn't preserve `_isSpell`, so spells became regular units with default stats. The host would then try to build an army from these broken "units".
**Fix:** Added `if(d._isSpell)return d` before calling `unit(d)`.

### BUG-030 🟢 `_importSharedUnit` doesn't sanitize via `unit()`
**File:** index.html:4455-4462
**Found:** 2026-07-30
**Description:** `_importSharedUnit` passed the raw parsed JSON from the share URL directly to `addForge`, without calling `unit()` to validate/sanitize. Imported units could have missing fields, wrong types, or invalid values, causing battle crashes.
**Fix:** Now calls `unit(this._pendingImport)` before adding to collection.

### BUG-031 🟢 Redundant `transmit("hit")` causes guest warning spam
**File:** index.html:3493
**Found:** 2026-07-30
**Description:** `takeDamage` called `transmit("hit",{target,damage})` on every hit, but the guest doesn't handle "hit" messages. The guest logged `"Unknown network message type: hit"` warnings at 20Hz during battles.
**Fix:** Removed the `transmit("hit")` call — hit data is already in snapshots.

### BUG-032 🟢 `onSpell` FX has redundant nullish coalescing (`x??x`)
**File:** index.html:2806
**Found:** 2026-07-30
**Description:** `anchor.x??anchor.x` is a no-op — both branches return the same value. Was likely intended to fall back to a different field.
**Fix:** Changed to `anchor.x??0`.

### BUG-033 🟢 `applyColorblind` doesn't handle 3-char hex (same as BUG-001)
**File:** index.html:4575-4587
**Found:** 2026-07-30
**Description:** `parseInt("fb0",16)` = 4016, wrong channels extracted. Same class of bug as BUG-001. Unlikely to trigger since shape colors come from `COLOR_MAP` (6-char hex), but possible with custom colors.
**Fix:** Added 3-char hex expansion before parsing.

### BUG-034 🟢 Timeout `checkEnd` missing screen shake + error reporting
**File:** index.html:3754-3762
**Found:** 2026-07-30
**Description:** The timeout path in `checkEnd` didn't call `BattleFX.shake(4)` (unlike normal end) and silently swallowed errors in `onEnd` callback with `catch(e){}`.
**Fix:** Added `BattleFX.shake(4)` and `showError()` in the catch block.

---

## Round 4 — 2026-07-31 (deep bug hunt continued)

### BUG-035 🟢 Guest disconnect leaves guest hanging (no handler for host leaving)
**File:** index.html:1925-1933
**Found:** 2026-07-31
**Description:** `onPeerLeave` only handled host-side disconnect (showing "Continue vs Bot" prompt). When the host disconnected, the guest's `onPeerLeave` fired but the `if(Match.active&&role==="host")` check meant the guest got no prompt or cleanup. Guest was left on a frozen battle screen indefinitely.
**Fix:** Added `else if(Match.active&&role==="guest")` branch that stops battle, stops snapshots, shows toast, and calls `G.onMatchEnd("enemy")`.

### BUG-036 🟢 `parseEnum` function undefined (crashes LLM spell forge)
**File:** index.html:1804-1808
**Found:** 2026-07-31
**Description:** `SPELL_FIELD_PARSERS` used `parseEnum(a,values,defaultValue)` but `parseEnum` was never defined. When the LLM was available and a spell was forged, the parser would throw a `ReferenceError`, crashing the spell forge.
**Fix:** Added `parseEnum` function next to `parseStat` that trims/lowercases the answer and checks membership in the enum values array.

### BUG-037 🟢 Upgrade screen allows upgrading past level 10 (wastes coins)
**File:** index.html:5710-5720
**Found:** 2026-07-31
**Description:** `applyUpgrades` caps at level 10, but the upgrade screen didn't check the cap. Players could spend coins upgrading to level 11+ with no effect. `upgradeUnit` also lacked a cap check.
**Fix:** Added `maxed=lvl>=10` check in upgrade screen rendering (disables button, shows "MAX"). Added `if(this.unitLevel(name)>=10)` guard in `upgradeUnit`.

### BUG-038 🟢 `fuseUnit` allows fusing past level 10 (wastes units)
**File:** index.html:5695
**Found:** 2026-07-31
**Description:** Same as BUG-037 but for fusion. `fuseUnit` didn't check the level cap, so players could fuse units past level 10 with no stat benefit, wasting a duplicate unit.
**Fix:** Added `if(this.unitLevel(name)>=10)` guard at the start of `fuseUnit`.

### BUG-039 🟢 `showSpellForgePreview` references undefined `btn` (ReferenceError)
**File:** index.html:5499
**Found:** 2026-07-31
**Description:** `showSpellForgePreview` used `if(btn)$("forgeGenBtn").style.display="inline-block"` but `btn` was a local variable in `_doForge`, not in scope here. This threw a `ReferenceError` every time a spell forge preview was shown, preventing the "Generate" button from reappearing.
**Fix:** Replaced with `const genBtn=$("forgeGenBtn"); if(genBtn)genBtn.style.display="inline-block"`.

### BUG-040 🟢 P2P `forge` message converts spells to broken units
**File:** index.html:2031-2034
**Found:** 2026-07-31
**Description:** The `forge` network message handler called `unit(data.d)` on all incoming data. If a spell (with `_isSpell:true`) was shared via P2P forge, `unit()` stripped `_isSpell` and created a broken unit with default stats. The spell was lost.
**Fix:** Added `if(data.d._isSpell)` branch that adds the spell to `G.save.spellbook` instead of calling `unit()`.

### BUG-041 🟢 `_importSharedUnit` converts spells to broken units
**File:** index.html:4485-4493
**Found:** 2026-07-31
**Description:** Same class as BUG-040 but for URL import. `_importSharedUnit` called `unit(this._pendingImport)` unconditionally, stripping `_isSpell` from spells. Also, the preview showed unit stats (HP, DMG) for spells which don't have those fields.
**Fix:** Added `if(this._pendingImport._isSpell)` branch that adds to spellbook directly. Also updated `importUnitFromURL` preview to show spell info (effect, trigger) instead of unit stats.

### BUG-042 🟢 Guest draft draw count ignores host's comeback eligibility
**File:** index.html:2048-2055, 4727-4733
**Found:** 2026-07-31
**Description:** The host sends `drawIndex` (draw count: 3 or 4 for comeback) in the `round_start` message. The guest's `round_start` handler set `G.roundDraftState.drawCount` from this value, but `startRoundDraft()` immediately overwrote `roundDraftState` with a locally-computed `Match.comebackEligible()?4:3`. From the guest's perspective, comeback eligibility is inverted (guest lost = host won), so the guest got the wrong draw count.
**Fix:** Store host-sent draw count in `G._hostDrawCount` before calling `startRoundDraft()`. In `startRoundDraft()`, guests use `G._hostDrawCount` instead of locally-computed `comebackEligible()`.

### BUG-043 🟢 P2P host applies own upgrade levels to guest's units
**File:** index.html:5065, 5081
**Found:** 2026-07-31
**Description:** `buildArmyFromSelected` (used by host to build guest army) called `this.applyUpgrades(cloneUnit(pick))` which uses the **host's** `this.unitLevel(u.n)`. The guest's units were upgraded based on the host's upgrade levels, not the guest's. A guest with level 5 Knight would get the host's level 0 Knight stats if the host hadn't upgraded Knight.
**Fix:** Guest now sends `upgrades` map (unit name → level) with the `deck` message. `startHostBattle` and `buildArmyFromSelected` accept `guestUpgrades` and use `_applyUpgradeLevel(u, guestUpgrades[name]||0)` instead of `applyUpgrades(u)` for guest units. Refactored `applyUpgrades` to delegate to `_applyUpgradeLevel` for reuse.

---

## Round 5 — 2026-07-31 (abilities, spells, P2P, bot)

### BUG-044 🟢 Ranged lifesteal doesn't heal owner (heals disposable synth attacker)
**File:** index.html:3634-3636
**Found:** 2026-07-31
**Description:** Projectile hits create a synthetic attacker object (`synth={h:1,mh:1,...}`) and call `takeDamage(synth,target)`. When the attacker has `ability:"lifesteal"`, `takeDamage` heals `synth.h` (the disposable object), not the real owner unit. Ranged units with lifesteal never heal.
**Fix:** Before `takeDamage`, find the real owner unit by `p.owner` id and sync `synth.h=owner.h, synth.mh=owner.mh`. After `takeDamage`, write back `owner.h=synth.h` if healing occurred.

### BUG-045 🟢 Ranged ramp doesn't apply to owner (applies to synth, lost on GC)
**File:** index.html:3595-3602
**Found:** 2026-07-31
**Description:** When a projectile kill triggers ramp, `onUnitDeath` uses `u.lastAttacker` which is the synth object. The ramp bonus (`killer.d*=1.15`) is applied to the synth, which is then garbage collected. The real owner's damage never increases.
**Fix:** In `onUnitDeath`, if `killer` is not in `this.units` (it's a synth), resolve the real owner via `killer.id` and apply ramp to the real unit instead.

### BUG-046 🟢 Spell shape `anchor.x??anchor.x` no-op (same as BUG-032)
**File:** index.html:3079, 3084, 3100, 3118
**Found:** 2026-07-31
**Description:** `circle_aoe`, `line`, `cone`, and `persistent_zone` spell shapes all used `anchor.x??anchor.x` (no-op). If `anchor.x` is `undefined`, it stays `undefined` instead of falling back to `0`, causing `Math.hypot(u.x-undefined,...)` = `NaN` → no units affected.
**Fix:** Changed all to `anchor.x??0, anchor.y??0`.

### BUG-047 🟢 Bot gets comeback bonus when it wins (inverted eligibility)
**File:** index.html:5014, 4939
**Found:** 2026-07-31
**Description:** `generateScoutPicks` and `buildBotArmy` used `Match.comebackEligible()` to determine the bot's draw count. `comebackEligible()` returns true when `last.winner==="enemy"` (bot won). So the bot got 4 draws when it won, not when it lost — the opposite of the comeback mechanic's intent.
**Fix:** Replaced with `botComeback = Match.history.length>0 && last.winner==="player"` (bot lost → bot gets 4 draws).

### BUG-048 🟢 `G.renderScout()` undefined — crashes guest on opponent_picks
**File:** index.html:2065
**Found:** 2026-07-31
**Description:** The `opponent_picks` network handler called `G.renderScout()` but the function is `G.showScout()`. This threw `TypeError: G.renderScout is not a function` whenever the guest received opponent picks after round 1.
**Fix:** Changed to `G.showScout()`.

### BUG-049 🟢 Guest `round_end` winner/lives not translated (inverted display)
**File:** index.html:2068-2074
**Found:** 2026-07-31
**Description:** The guest's `round_end` handler used the host's winner and lives directly. Host's "player" = host won, but guest's `roundResult` shows "ROUND WON" for `winner==="player"`. Guest saw "ROUND WON" when they lost. Lives were also inverted — guest saw host's lives as their own.
**Fix:** Translate winner (`"player"→"enemy"`, `"enemy"→"player"`) and swap `livesPlayer`/`livesEnemy` for guest perspective.

### BUG-050 🟢 Guest `match_end` winner not translated (inverted display)
**File:** index.html:2076-2080
**Found:** 2026-07-31
**Description:** Same as BUG-049 but for match end. Guest's `onMatchEnd` received host's winner directly, showing "MATCH WON" when the guest lost.
**Fix:** Translate winner for guest perspective before calling `G.onMatchEnd()`.

### BUG-051 🟢 Guest starts draft independently of host (race condition)
**File:** index.html:5186
**Found:** 2026-07-31
**Description:** `roundResult` set the "Next Round" button to call `Match.startRound()` for both host and guest. In P2P, the guest calling `Match.startRound()` starts the draft locally without waiting for the host's `round_start` message. The guest's draft would use stale `_hostDrawCount` from the previous round.
**Fix:** In P2P guest mode, disable the "Next Round" button and show "WAITING FOR HOST..." — the guest's draft starts when the host sends `round_start`.

### BUG-052 🟢 Guest role tracking uses wrong team (tracks host's roles)
**File:** index.html:5157
**Found:** 2026-07-31
**Description:** `onBattleEnd` tracked surviving units from `team==="player"` for the Role Master achievement. In P2P guest mode, the guest's units are `team==="enemy"` in snapshots. The guest would track the host's surviving roles, not their own.
**Fix:** Use `teamForRole = connected&&role==="guest" ? "enemy" : "player"` when filtering survivors.

### BUG-053 🟢 Spell deduplication doesn't work for spells in draft
**File:** index.html:4791, 4914
**Found:** 2026-07-31
**Description:** `drawOne` tracked used names via `st.picks.map(u=>u.n)`. Spells have `name` (not `n`), so `u.n` is `undefined` for spells. `usedNames` contained `undefined`, and `rollOne` never checked spell names against `usedNames`. The same spell could be offered multiple times in the same draw.
**Fix:** `drawOne` now uses `u._isSpell?u.name:u.n` for both initial set and adding. `rollOne` filters `availableSpells` by `usedNames.has(s.name)`.

### BUG-054 🟢 Settings migration uses `audio` instead of `audioEnabled`
**File:** index.html:580
**Found:** 2026-07-31
**Description:** Migration set `s.settings={audio:true,...}` but `applyAudioSettings` checks `s.audioEnabled`. The `audio` field was never read, so the default audio-enabled state relied on `undefined!==false` being `true` (works but inconsistent).
**Fix:** Changed migration to `audioEnabled:true`.

### BUG-055 🟢 LLM spell semantic validation doesn't auto-fix invalid enums
**File:** index.html:1873-1877
**Found:** 2026-07-31
**Description:** `semanticValidateSpell` flagged invalid `trigger`, `effect`, `shape`, and `fxType` values, but the auto-fix only handled `target` and `duration`. Invalid enum values would silently produce spells that do nothing (`SPELL_SHAPE[undefined]?.()` returns `[]`).
**Fix:** Added auto-fix for invalid `trigger` (→`"battle_start"`), `effect` (→`"damage"`), `shape` (→`"circle_aoe"`), and `fxType` (→`"explosion"`).

---

## Round 6 — 2026-07-31 (P2P matchmaking, triggers, FX, UI, shared spells)

### BUG-056 🟢 `on_first_hit` ability trigger fires at battle start, not on first hit
**File:** index.html:2250
**Found:** 2026-07-31
**Description:** `ABILITY_TRIGGERS.on_first_hit` checked `!u.firstHitUsed`, which is true at battle start (before any attack). The ability fired on frame 1, effectively making it a `battle_start` trigger. The intent is to fire when the unit is first attacked.
**Fix:** Added `u.hasBeenHit` flag (set in `takeDamage` when the unit is attacked, including dodge/shield blocks). Trigger now checks `u.hasBeenHit && !u.firstHitUsed`.

### BUG-057 🟢 P2P matchmaking: both players become host (dual-host deadlock)
**File:** index.html:2004-2008
**Found:** 2026-07-31
**Description:** `startMatchmaking` calls `G.host(queueRoom,true)` for both players. Both set `role="host"` and send `transmit("role","host")`. When each receives the other's `"role","host"`, the old code just kept `role="host"` for both. Neither acted as guest — the match never started properly.
**Fix:** When receiving `"role","host"` while already `role="host"`, both players exchange a random tiebreaker ID via `role_tiebreak` message. The player with the lower ID becomes host, the other becomes guest.

### BUG-058 🟢 Reconnect overlay not cancelled when peer rejoins
**File:** index.html:1927
**Found:** 2026-07-31
**Description:** `onPeerJoin` didn't call `cancelReconnect()`. If a peer disconnected and reconnected during the grace period, the reconnect overlay stayed visible and the timer kept counting down. When it expired, `Match.forfeit()` fired even though the peer had reconnected.
**Fix:** Added `G.cancelReconnect()` call in `onPeerJoin`.

### BUG-059 🟢 Bot comeback in disconnect prompt uses inverted eligibility
**File:** index.html:1978
**Found:** 2026-07-31
**Description:** `showDisconnectPrompt` used `Match.comebackEligible()?4:3` for the replacement bot's draw count. `comebackEligible()` returns true when the player lost, but the bot (replacing the human opponent) should get comeback when the player won (bot lost). Same inversion as BUG-047.
**Fix:** Replaced with `Match.history.length>0 && last.winner==="player" ? 4 : 3`.

### BUG-060 🟢 `screen()` removes the error panel (z-index 9999 cleanup)
**File:** index.html:4350-4351
**Found:** 2026-07-31
**Description:** `screen()` removes all `div`s with `position:fixed` and `z-index:9999`. The error panel (`#errorPanel`) has both properties. After navigating to any screen, the error panel was removed from the DOM. Subsequent `showError()` calls silently returned (null guard), swallowing all error messages.
**Fix:** Added `if(d.id==="errorPanel")return;` to exclude the error panel from cleanup.

### BUG-061 🟢 `swapLoadoutSlot` allows duplicate units in loadout
**File:** index.html:5750-5757
**Found:** 2026-07-31
**Description:** `swapLoadoutSlot` cycled to the next collection unit without checking if it was already in another loadout slot. The player could end up with 4 copies of the same unit, which doubled/tripled the roll weight in `rollOne`.
**Fix:** Now skips units already in the loadout, cycling to the next available unit. Falls back to simple cycle only if all units are in the loadout (tiny collection edge case).

### BUG-062 🟢 Imported shared spells not sanitized
**File:** index.html:4549
**Found:** 2026-07-31
**Description:** `_importSharedUnit` added shared spells to the spellbook without validating enum fields. Malformed share links could inject spells with invalid `trigger`/`effect`/`shape`/`fxType` that silently fail in battle.
**Fix:** Added sanitization: invalid enums default to `battle_start`/`damage`/`circle_aoe`/`explosion`. Numeric fields (`magnitude`, `radius`, `duration`) are clamped.

### BUG-063 🟢 Forged spells not sanitized before adding to spellbook
**File:** index.html:5587
**Found:** 2026-07-31
**Description:** `addSpellToBook` added `pendingForgeSpell` directly. While `generateSpell` already sanitizes, the safety net was missing for template fallbacks or edge cases.
**Fix:** Added same sanitization as BUG-062 for consistency.

### BUG-064 🟢 Analytics queue grows unboundedly when endpoint is null
**File:** index.html:494-497
**Found:** 2026-07-31
**Description:** `Analytics.track` always pushed events to the queue, but `_flush` never sent them (endpoint is `null` by default). The queue grew indefinitely — one event per match, forge, ad, etc.
**Fix:** `track` now returns early if `!this.endpoint`, preventing queue growth when no endpoint is configured.

---

## Round 7 — 2026-07-31

### BUG-065 🔴 P2P race condition: host receives guest deck before host army is ready
**File:** index.html:2059-2065, 5056-5066
**Found:** 2026-07-31
**Description:** In P2P, if the guest finished drafting before the host, the guest's `deck` message arrived while `G.pendingHostArmy` was still stale from the previous round (or undefined for round 1). The host would call `startHostBattle` with the wrong army, causing an incorrect battle.
**Fix:** Store the guest's deck in `_pendingGuestDeck` and only call `startHostBattle` when both `pendingHostArmy` and `_pendingGuestDeck` are ready. Clear both at the start of each draft round.

### BUG-066 🔴 P2P guest loses when host disconnects (should win)
**File:** index.html:1960
**Found:** 2026-07-31
**Description:** When the host disconnected mid-match, `onPeerLeave` called `G.onMatchEnd("enemy")` for the guest. From the guest's perspective, "enemy" = host, so `winner==="player"` was false → guest loses. This is wrong — the guest should win by default when the host disconnects.
**Fix:** Changed to `G.onMatchEnd("player")` so the guest wins on host disconnect.

### BUG-067 🔴 Host forfeit doesn't notify guest
**File:** index.html:2337-2340
**Found:** 2026-07-31
**Description:** `Match.forfeit()` didn't send `match_end` to the guest. The guest would be stuck waiting indefinitely after the host forfeited.
**Fix:** Added `transmit("match_end",{winner:"enemy"})` in `forfeit()` when the host forfeits, so the guest receives the match end notification.

### BUG-068 🟡 Persistent zones with "damage" effect do nothing
**File:** index.html:3273
**Found:** 2026-07-31
**Description:** `tickZones` only handled `damage_over_time`, `slow`, and `heal_over_time` effects. A persistent zone with `effect:"damage"` (e.g., a fire wall) would never deal damage — the initial `Spell.fire` skips effect application for persistent zones, and `tickZones` didn't handle the `damage` effect.
**Fix:** `tickZones` now treats `"damage"` the same as `"damage_over_time"` — applies `magnitude` damage to affected units once per tick.

### BUG-069 🟡 P2P scout screen shows bot picks instead of real opponent picks
**File:** index.html:5085-5103, 2297-2300
**Found:** 2026-07-31
**Description:** `generateScoutPicks` always generated bot picks for both host and guest in P2P, overwriting any real opponent picks. The guest's `opponent_picks` message handler would set the correct picks, but `generateScoutPicks` in `battle()` would overwrite them. Additionally, `Match.startRound` sent bot placeholder picks to the guest instead of the host's actual previous-round picks.
**Fix:** `generateScoutPicks` now skips bot generation for P2P guests (keeps picks from `round_start`/`opponent_picks` messages). `Match.startRound` now sends the host's actual previous-round picks (`G.prevPlayerPicks`) instead of bot placeholder picks.

### BUG-070 🟡 Disconnect "Continue vs Bot" loses custom opponent units
**File:** index.html:1953, 1977-1992
**Found:** 2026-07-31
**Description:** `showDisconnectPrompt` received only opponent pick names (strings), then resolved them via `G.base.find(b=>b.n===n)`. Custom (LLM-forged) units aren't in `G.base`, so they'd be filtered out with `.filter(Boolean)`, leaving the bot with fewer units than expected.
**Fix:** Pass full `opponentPicks` objects (not just names) to `showDisconnectPrompt`, preserving custom units when converting to bot.

### BUG-071 🟢 Rage ability division by zero when attacker.mh is 0
**File:** index.html:3555
**Found:** 2026-07-31
**Description:** `dmg*=1+(1-attacker.h/attacker.mh)` divides by `attacker.mh`. If a malformed unit has `mh=0`, this produces `NaN` damage, making the target's HP `NaN` and preventing it from ever dying.
**Fix:** Added `attacker.mh>0` guard to the rage ability condition.

### BUG-072 🟢 Polygon shape with missing pts crashes renderer
**File:** index.html:2497-2499
**Found:** 2026-07-31
**Description:** `_drawShapeRaw` for polygon shapes iterates `shape.pts` without checking if it exists. A malformed recipe with a polygon shape but no `pts` array would throw a TypeError, crashing the render loop.
**Fix:** Added `if(!shape.pts||!shape.pts.length)break;` guard before iterating polygon points.

---

## Round 8 — 2026-07-31

### BUG-073 🔴 P2P guest double round-end / match-end
**File:** index.html:5244-5249
**Found:** 2026-07-31
**Description:** When the guest received a snapshot with `winner` set, `applyRemoteSnapshot` called `onBattleEnd`, which called `Match.onRoundEnd` — decrementing lives and pushing to history. Then the host's `round_end` message arrived and set `Match.livesPlayer`/`Match.livesEnemy` (overwriting the decremented values), but `Match.history` still had a duplicate entry. If the match ended, `Match.onRoundEnd` called `onMatchEnd`, and then the `match_end` message also called `onMatchEnd` — double match end.
**Fix:** Guest's `onBattleEnd` now returns early for P2P guests. The host sends `round_end`/`match_end` messages that handle all state updates and UI transitions for the guest.

### BUG-074 🟡 Spell with "center" target hits both allies and enemies
**File:** index.html:3229-3233
**Found:** 2026-07-31
**Description:** `Spell.fire` only filtered affected units by team for targets starting with "ally" or "enemy". The "center" target (which targets the middle of the battlefield) fell through — both allies and enemies would be affected by damage spells.
**Fix:** Changed the filter to a binary ally/enemy split: ally targets filter to allies, all other targets (including "center") default to enemies only.

### BUG-075 🟡 damage_over_time spell overwrites higher poison damage from unit abilities
**File:** index.html:3181
**Found:** 2026-07-31
**Description:** `SPELL_EFFECT.damage_over_time` set `u.poisonDmg=spec.magnitude||10`, overwriting any existing poison damage. If a unit ability (poison) had already applied higher poison damage (`attacker.d*0.3`), the spell would reduce it.
**Fix:** Changed to `u.poisonDmg=Math.max(u.poisonDmg||0,spec.magnitude||10)` to preserve the higher damage value, matching the unit ability's behavior.

### BUG-076 🟡 Shared unit loses color on import
**File:** index.html:4521
**Found:** 2026-07-31
**Description:** `shareUnit` serialized `primaryColor:u.c` but not `c` (the hex color field). On import, `unit()` looks for `x.c`, not `x.primaryColor`, so the imported unit would default to `#0ff` (cyan) instead of its original color.
**Fix:** Added `c:u.c` to the serialized data alongside `primaryColor:u.c`.

### BUG-077 🟡 P2P guest match hint uses wrong team for death log
**File:** index.html:5372
**Found:** 2026-07-31
**Description:** `generateMatchHint` filtered `deathLog` for `d.team==="player"`. In P2P, the guest's units are team "enemy" in snapshots, so the guest's death log entries have `team:"enemy"`. The hint never found player deaths for the guest, so death-order-based strategy hints never appeared.
**Fix:** Added team translation: `const playerTeam=connected&&role==="guest"?"enemy":"player"` and filter by `playerTeam`.

### BUG-078 🟢 Rage damage multiplier exceeds 2x when attacker HP goes negative
**File:** index.html:3559
**Found:** 2026-07-31
**Description:** Rage damage multiplier is `1+(1-h/mh)`. If `h` goes negative (e.g., from overkill), the multiplier exceeds 2.0. This could happen with projectile kills where the attacker dies between launch and impact.
**Fix:** Clamped with `Math.max(0,1-attacker.h/attacker.mh)` to cap the multiplier at 2.0.

### BUG-079 🟢 Settings "Master Mute" label is misleading
**File:** index.html:134
**Found:** 2026-07-31
**Description:** The checkbox labeled "Master Mute" actually enables audio when checked (`audioEnabled=true`). The label contradicts the behavior — users would expect checking "Mute" to silence audio, but it does the opposite.
**Fix:** Changed label to "Audio Enabled" to match the actual behavior.
