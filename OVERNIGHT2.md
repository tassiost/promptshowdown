# Overnight Execution — Round 2: Fix All Remaining Bugs + Implement Improvements

Execute all remaining unimplemented items from the MD files. Commit and push after each block. Update this file (mark items DONE) and OVERNIGHT-STATUS.md after each block so progress is visible.

Code efficiently and streamlined. Use helper functions and avoid duplicating code. Research online if something is unclear. Test via Playwright MCP (never chrome-devtools — it is forbidden on this project). Don't finish until it's finished.

## Two rules you must never break

1. **Never use chrome-devtools MCP.** All browser automation and smoke tests go through the playwright MCP server. If playwright is unavailable, stop that block, note it in OVERNIGHT-STATUS.md, and move on — do not fall back to chrome-devtools.
2. **Never limit LLM usage.** Inference is free (local WebLLM, no API costs). Never set max_tokens on chat.completions.create. Never cap daily forges. Never add LLM timeouts — the Cancel button is the only escape hatch. Prefer richer prompts and multi-call generation over cramped single calls.

## Per-block workflow

1. Read the relevant section in the MD files — note touchpoints and line numbers.
2. Re-grep for touchpoint locations (line numbers drift as you edit). Read current code before editing.
3. Implement. Match existing code style (compact vanilla JS, single-file index.html, no new deps unless specified, no comments unless non-obvious).
4. Smoke test via playwright MCP: list tools first (mcp_list_tools for playwright — never guess names), navigate to http://localhost:8765/index.html, run a basic smoke test (fresh save → play match → win/lose round → verify no console errors), screenshot. Fix before committing.
5. Commit: `<block>: <one-line description>` + co-author trailer (check git log for style). Push to origin/main.
6. Update OVERNIGHT-STATUS.md. Commit that too.

## Blockers

- Smoke test fails after 3 fix attempts → revert (`git checkout -- index.html`), note in OVERNIGHT-STATUS.md, move to next block. Don't get stuck.
- Phase needs a server endpoint → implement client side fully with endpoint URL configurable (default null = no-op). Note it needs manual setup.
- Never ask the user for help — they're asleep. Make reasonable decisions, note them in OVERNIGHT-STATUS.md, continue.

---

## Pre-flight

1. `cd /Users/tassio/Downloads/promptshowdown`
2. Commit any uncommitted WIP, push.
3. Start `python3 -m http.server 8765` in the background.
4. Verify no max_tokens in index.html (grep for it).
5. Commit + push if needed.

---

## Block A — Critical Confirmed Bugs (🔴)

Fix these first — they affect gameplay correctness.

### A1: BUG-024 — Attack cooldown inverted
- **File:** index.html (grep for `u.cool=u.a`)
- **Fix:** Change `u.cool=u.a` to `u.cool=1/u.a` everywhere it appears. `a` is attacks-per-second, so cooldown = 1/a seconds.
- **Test:** Start a match with Archer (a=1.5). Verify she attacks every ~0.67s, not every 1.5s. Verify slow attackers (a=0.5) attack every 2s, not every 0.5s.

### A2: BUG-025 — Slow status has no effect on movement speed
- **File:** index.html (grep for `effSpeed` and movement functions: chase, flee, hold_midpoint, kite, patrol)
- **Fix:** Ensure all movement functions use `effSpeed(u)` instead of `u.s*(u.moveSpeedMod/100)*dt`. If `effSpeed` doesn't exist, create it: `function effSpeed(u){const base=u.s*(u.moveSpeedMod||100)/100;return u.slow>0?base*0.5:base;}`. Check that `u.slow` is decremented each frame.
- **Test:** Cast a slow spell on enemy units. Verify they move at half speed while slowed, then return to normal when slow expires.

### A3: BUG-087 — Kite movement dead zone exceeds attack range
- **File:** index.html (grep for `kite` in movement functions)
- **Fix:** Change the upper kite threshold from `r*1.1` to `r` so the dead zone ends exactly at attack range. Units should always close to within attack range before stopping.
- **Test:** Match with two Wizard units (r=160, kite). Verify they close to within 160px and attack, not stare at each other at 176px.

### A4: BUG-065 — P2P race condition: host receives guest deck before host army is ready
- **File:** index.html (grep for `pendingHostArmy`, `_pendingGuestDeck`, `startHostBattle`)
- **Fix:** Store the guest's deck in `_pendingGuestDeck` and only call `startHostBattle` when both `pendingHostArmy` and `_pendingGuestDeck` are ready. Clear both at the start of each draft round.
- **Test:** P2P match — guest finishes draft before host. Verify battle starts with correct armies for both sides.

### A5: BUG-066 — P2P guest loses when host disconnects
- **File:** index.html (grep for `onPeerLeave`, `onMatchEnd`)
- **Fix:** When host disconnects, call `G.onMatchEnd("player")` for the guest (guest wins by default).
- **Test:** P2P match — simulate host disconnect. Verify guest gets a win, not a loss.

### A6: BUG-067 — Host forfeit doesn't notify guest
- **File:** index.html (grep for `forfeit`, `match_end`)
- **Fix:** In `Match.forfeit()`, when host forfeits, send `transmit("match_end",{winner:"enemy"})` so the guest receives the match end notification.
- **Test:** P2P match — host forfeits. Verify guest gets match end screen, not stuck waiting.

### A7: BUG-073 — P2P guest double round-end / match-end
- **File:** index.html (grep for `applyRemoteSnapshot`, `onBattleEnd` for guest)
- **Fix:** Guest's `onBattleEnd` should return early for P2P guests. The host sends `round_end`/`match_end` messages that handle all state updates and UI transitions for the guest.
- **Test:** P2P match — play 3 rounds. Verify no duplicate history entries, no double match end. Verify lives decrement correctly for guest.

### A8: BUG-080 — P2P guest Match.round never increments past 1
- **File:** index.html (grep for `round_start` handler for guest, `Match.round`)
- **Fix:** The guest's `round_start` handler should increment `Match.round` for every round, matching the host's increment. Refactor `match_start` handler to initialize match state without calling `Match.start` (avoiding premature `startRound`).
- **Test:** P2P match — play 3 rounds. Verify guest's `Match.round` reaches 3. Verify `round_reach` quest tracking works for guest.

### A9: BUG-081 — P2P guest Match.history never populated
- **File:** index.html (grep for `round_end` handler for guest, `Match.history`)
- **Fix:** Guest's `round_end` handler should push `{round, winner}` to `Match.history` (with translated winner). `match_end` handler should also push the final round if not already recorded.
- **Test:** P2P match — play 3 rounds. Verify guest's `Match.history` has 3 entries. Verify comeback checks and quest tracking work for guest.

---

## Block B — Suspected Bugs (🟡)

Fix all suspected bugs. These are likely real issues even if not confirmed.

### B1: BUG-003 — unit() drops visual modifier fields
- **File:** index.html (grep for `function unit(` or `const unit=`)
- **Fix:** Add these fields to the `unit()` function's copied fields: `bodyPlan:x.bodyPlan||null, headFeature:x.headFeature||"none", backFeature:x.backFeature||"none", tailFeature:x.tailFeature||"none", aura:x.aura||"none", eyeStyle:x.eyeStyle||"normal", pattern:x.pattern||"none", weaponStyle:x.weaponStyle||"standard"`. Also add them to `shareUnit`'s data payload.
- **Test:** Forge a unit with visual modifiers → share via URL → import on another tab → verify all modifiers preserved.

### B2: BUG-004 — Spell persistent zones hardcoded to enemies only
- **File:** index.html (grep for `tickZones`)
- **Fix:** Check `z.spec.target` to determine ally vs enemy filtering. If target starts with "ally", apply to allies; otherwise apply to enemies.
- **Test:** Forge a healing persistent zone spell (heal_allies, persistent_zone). Verify it heals allies, not damages them.

### B3: BUG-005 — Movement functions don't check if target is dead
- **File:** index.html (grep for movement functions: chase, flee, hold_midpoint, kite)
- **Fix:** Add `target&&target.h>0` checks in all movement functions before using the target.
- **Test:** Kill a unit that is being chased. Verify chaser retargets instead of moving toward dead unit.

### B4: BUG-006 — Shape cap too low (14) drops visual features in wrong order
- **File:** index.html (grep for `shapes.length>14` or `while(shapes.length>`)
- **Fix:** Increase cap from 14 to 18 (perf is fine with 12 units × 18 shapes = 216 shapes, well within Canvas 2D budget). If keeping 14, drop in priority order: tail → back → head → weapon (current order is actually reasonable, just increase cap).
- **Test:** Forge a unit with all 7 visual modifiers. Verify all modifiers render (tail, back, head, weapon all visible).

### B5: BUG-007 — G.screen() leaves blank page if target doesn't exist
- **File:** index.html (grep for `screen(` function definition)
- **Fix:** Add `if(!target)target=$("menu");` fallback after trying to get the target element.
- **Test:** Call `G.screen("nonexistent")` from console. Verify menu shows, not blank page.

### B6: BUG-008 — All-spell draft picks → empty army → instant loss
- **File:** index.html (grep for `_buildArmyFromPicks`, `buildArmy`)
- **Fix:** Guarantee at least 1 unit in draft pool (reduce spell chance if no units picked yet), or auto-fill with a base unit if army is empty after all picks.
- **Test:** Force all 3 draft picks to be spells (mock). Verify player gets at least 1 unit in battle.

### B7: BUG-009 — migrateSave keeps empty loadout array
- **File:** index.html (grep for `migrateSave`, `s.loadout`)
- **Fix:** Change `if(s.loadout)` to `if(s.loadout&&s.loadout.length>0)`. If empty, reset to default loadout.
- **Test:** Clear localStorage, set loadout to `[]`, reload. Verify default loadout is restored.

### B8: BUG-010 — Poison ticks after unit death
- **File:** index.html (grep for `poison` in update/tick logic)
- **Fix:** Add `if(u.h<=0)continue;` before poison tick in the main unit update loop.
- **Test:** Verify no console errors when a poisoned unit dies. Verify poison stops ticking on dead units.

### B9: BUG-011 — eyeStyle:"closed" doesn't skip eye drawing
- **File:** index.html (grep for `drawFace`)
- **Fix:** Add `if(u.recipe?.eyeStyle==="closed")return;` at the top of `drawFace`.
- **Test:** Forge a unit with `eyeStyle:"closed"`. Verify no eyes are drawn.

### B10: BUG-012 — GameAudio.stopMusic doesn't disconnect gain nodes
- **File:** index.html (grep for `stopMusic`)
- **Fix:** Store gain nodes when created in `startMusic`, disconnect them in `stopMusic`.
- **Test:** Start/stop music 10 times. Verify no audio context warnings or memory growth.

### B11: BUG-013 — Quest streak doesn't update across midnight
- **File:** index.html (grep for `checkStreak`)
- **Fix:** Call `Quests.checkStreak()` on each match end in addition to `G.init()`.
- **Test:** Mock date change during a session. Verify streak updates without page reload.

### B12: BUG-014 — Double-forge race condition
- **File:** index.html (grep for `_doForge`, `forgeGenBtn`)
- **Fix:** Set a `_forgeRunning` flag at the start of `_doForge` and guard against re-entry. Clear it when forge completes or is cancelled.
- **Test:** Rapidly click "Watch Ad" + "Skip" 5 times. Verify only 1 forge executes.

### B13: BUG-026 — spell_use quest never tracked
- **File:** index.html (grep for `Spell.fire` or `spell_use`)
- **Fix:** Add `Quests.track("spell_use")` in `Spell.fire()`.
- **Test:** Have "Use a spell in battle" quest. Play a match with a spell. Verify quest progress increments.

### B14: BUG-027 — Quests.track ignores data parameter
- **File:** index.html (grep for `Quests.track`, `track(event`)
- **Fix:** `track` should use `data` as the increment amount when provided: `q.progress += data||1`.
- **Test:** Have "Reach Round 5" quest. Play a match reaching round 5. Verify quest completes in 1 match, not 5.

### B15: BUG-028 — analyticsOptOut saved to wrong path
- **File:** index.html (grep for `analyticsOptOut`)
- **Fix:** Ensure `saveSetting('analyticsOptOut',val)` stores at `G.save.analyticsOptOut` (top-level), and `Analytics.track` checks `G.save?.analyticsOptOut`.
- **Test:** Enable analytics opt-out in settings. Verify no beacon events are sent.

### B16: BUG-029 — deserializeUnitsFromPeer converts spells to broken units
- **File:** index.html (grep for `deserializeUnitsFromPeer`)
- **Fix:** Add `if(d._isSpell)return d;` before calling `unit(d)`.
- **Test:** P2P match where guest has a spell in loadout. Verify spell is preserved on host side.

### B17: BUG-068 — Persistent zones with "damage" effect do nothing
- **File:** index.html (grep for `tickZones`)
- **Fix:** `tickZones` should treat `"damage"` the same as `"damage_over_time"` — applies `magnitude` damage to affected units once per tick.
- **Test:** Forge a fire wall spell (damage, persistent_zone). Verify it deals damage each tick.

### B18: BUG-069 — P2P scout screen shows bot picks instead of real opponent picks
- **File:** index.html (grep for `generateScoutPicks`)
- **Fix:** `generateScoutPicks` should skip bot generation for P2P guests (keeps picks from `round_start`/`opponent_picks` messages). `Match.startRound` should send the host's actual previous-round picks instead of bot placeholder picks.
- **Test:** P2P match round 2. Verify guest scout screen shows host's actual round 1 picks, not random bot picks.

### B19: BUG-070 — Disconnect "Continue vs Bot" loses custom opponent units
- **File:** index.html (grep for `showDisconnectPrompt`)
- **Fix:** Pass full `opponentPicks` objects (not just names) to `showDisconnectPrompt`, preserving custom units when converting to bot.
- **Test:** P2P match where opponent has forged units. Disconnect. Verify "Continue vs Bot" has the opponent's actual forged units.

### B20: BUG-074 — Spell with "center" target hits both allies and enemies
- **File:** index.html (grep for `Spell.fire`, target filtering)
- **Fix:** Change the filter to a binary ally/enemy split: ally targets filter to allies, all other targets (including "center") default to enemies only.
- **Test:** Forge a damage spell with "center" target. Verify it only damages enemies, not allies.

### B21: BUG-075 — damage_over_time spell overwrites higher poison damage
- **File:** index.html (grep for `damage_over_time` in SPELL_EFFECT)
- **Fix:** Change to `u.poisonDmg=Math.max(u.poisonDmg||0,spec.magnitude||10)` to preserve the higher damage value.
- **Test:** Apply unit poison (dmg*0.3=9), then spell poison (magnitude=5). Verify poison stays at 9, not 5.

### B22: BUG-076 — Shared unit loses color on import
- **File:** index.html (grep for `shareUnit`)
- **Fix:** Add `c:u.c` to the serialized data alongside `primaryColor:u.c`.
- **Test:** Share a colored unit via URL. Import. Verify color matches original.

### B23: BUG-077 — P2P guest match hint uses wrong team for death log
- **File:** index.html (grep for `generateMatchHint`, `deathLog`)
- **Fix:** Add team translation: `const playerTeam=connected&&role==="guest"?"enemy":"player"` and filter death log by `playerTeam`.
- **Test:** P2P match as guest. Lose a round. Verify strategy hint references your dead units, not the host's.

### B24: BUG-082 — P2P host sends bot opponent_picks, overwriting guest's real picks
- **File:** index.html (grep for `generateScoutPicks`, `opponent_picks`)
- **Fix:** Remove the `transmit("opponent_picks", ...)` call from the host's `generateScoutPicks`. The host's bot picks are only used locally as placeholders. The guest already has correct picks from `round_start`.
- **Test:** P2P match round 2. Verify guest sees host's real picks, not random bot picks.

### B25: BUG-083 — Persistent zones with heal_allies effect do nothing
- **File:** index.html (grep for `tickZones`, `heal_over_time`, `heal_allies`)
- **Fix:** Change the check from `"heal_over_time"` to `"heal_allies"||"heal_over_time"` to handle both.
- **Test:** Forge a healing zone spell (heal_allies, persistent_zone). Verify it heals allies in the zone.

### B26: BUG-084 — Persistent zones missing shield_allies, stun, buff_dmg, buff_speed
- **File:** index.html (grep for `tickZones`)
- **Fix:** Add handling for `shield_allies`, `stun`, `buff_dmg`, and `buff_speed` in `tickZones`, applying the effect once per second to affected units in the zone.
- **Test:** Forge each effect type as a persistent zone. Verify each works correctly.

---

## Block C — Quick Win Improvements

### C1: Per-shape black stroke (1-line visual win)
- **File:** index.html (grep for `_drawShapeRaw`)
- **Fix:** In `_drawShapeRaw`, after filling each shape, stroke with `#000` at `lineWidth=1`. Add `c.strokeStyle="#000";c.lineWidth=1;c.stroke();` after each fill call (for rect, arc, ellipse, polygon). Skip if shape already has an outline color (`shape.oc`).
- **Test:** Start a match. Verify all units have crisp black outlines. Verify no performance drop.

### C2: Fix reducedMotion not being checked
- **File:** index.html (grep for `reducedMotion`, `BattleFX.shake`, `BattleFX.burst`)
- **Fix:** In `BattleFX.shake()`, return early if `G.save?.settings?.reducedMotion`. In `BattleFX.burst()`, reduce particle count to 0 if reducedMotion. In `Battle.update`, skip squash/stretch channels if reducedMotion. In `SpriteRenderer.updateSecondaries` (if exists), skip if reducedMotion.
- **Test:** Enable reduced motion in settings. Verify no screen shake, no particle bursts, no squash/stretch. Verify hit flash still shows.

### C3: Fix qualityTier / _fpsTier never being set
- **File:** index.html (grep for `qualityTier`, `_fpsTier`, `FPS`)
- **Fix:** Implement FPS monitoring in `Battle.loop`: track frame times, compute rolling average FPS every 30 frames, set `this._fpsTier` to "high" (>50fps), "medium" (30-50), "low" (<30). `qualityTier()` should return the user's preset if not "auto", otherwise return `this._fpsTier`.
- **Test:** Set quality to "auto". Throttle CPU (Playwright). Verify quality degrades. Set quality to "low". Verify it stays low regardless of FPS.

### C4: Fix addToLoadout logic bug
- **File:** index.html (grep for `addToLoadout`)
- **Fix:** The duplicate slot check uses `findIndex(n=>n===name)` which is the same as `existingSlot`. Fix the logic so it actually finds a DIFFERENT slot that already has this unit. If the unit is already in another slot, either swap or prevent the add.
- **Test:** Add a unit to slot 1, then try adding the same unit to slot 2. Verify it doesn't duplicate.

### C5: Default forge to Unit button
- **File:** index.html (grep for forge UI, `forgeUnit`, `forgeSpell`, button active class)
- **Fix:** Make the "Unit" forge button selected by default on screen load. Add the `active`/`pressed` CSS class to it. The user can still switch to Spell.
- **Test:** Open forge screen. Verify "Unit" button is visually active by default.

### C6: Model download progress bar (1s estimate)
- **File:** index.html (grep for model download, `showModelProgress`, forge loading)
- **Fix:** Add a progress bar UI element during model download. Set estimated time to 1s (testing mode). Show percentage + time remaining. Update progress during download.
- **Test:** Clear model cache. Open forge. Verify progress bar shows during model download.

### C7: Keyboard shortcuts
- **File:** index.html (grep for keydown, addEventListener)
- **Fix:** Add `keydown` listener: `1`/`2`/`3` for draft picks, `Space` for battle tick, `R` for reroll, `Escape` to go back/close modals. Only active when relevant screen is shown.
- **Test:** Draft screen → press 1 → verify first card picked. Battle → press Space → verify tick. Forge → press Escape → verify back to menu.

### C8: Replace confirm() with custom modals
- **File:** index.html (grep for `confirm(`)
- **Fix:** Create a `showConfirm(message, onYes, onNo)` function that shows a custom modal with Yes/No buttons. Replace all `confirm()` calls with this. Style it to match the game's UI.
- **Test:** Trigger a confirm dialog (e.g., reset game). Verify custom modal shows, not native browser dialog. Verify Yes/No buttons work.

### C9: Show upgraded stats in deck screen
- **File:** index.html (grep for `loadoutUnits`, deck rendering)
- **Fix:** In the deck screen rendering, apply upgrades to displayed stats. Either call `applyUpgrades` on the units returned by `loadoutUnits()` for display purposes, or show the upgraded stats alongside base stats.
- **Test:** Upgrade a unit to level 5. Open deck screen. Verify displayed stats reflect the upgrade.

### C10: Vary attack animation speed by unit attack speed
- **File:** index.html (grep for `attackT`, `dt/0.4`)
- **Fix:** Change `u.attackT+=dt/0.4` to `u.attackT+=dt*u.a` (or `dt/(1/u.a)`). Faster attackers should have faster attack animations.
- **Test:** Match with Archer (a=1.5) vs Knight (a=1.0). Verify Archer's attack animation is visibly faster.

---

## Block D — Visual Enhancements

### D1: Auto gradient shading
- **File:** index.html (grep for `_drawShapeRaw`, `fillStyle`)
- **Fix:** Add a `darken(hex,amt)` function (mirrors `lighten` but subtracts). In `_drawShapeRaw`, when `shape.fill !== 'gradient'` and no explicit gradient, auto-create a vertical gradient: `lighten(shape.c, 0.12)` at top → `darken(shape.c, 0.12)` at bottom. For circles, use radial gradient with light spot offset to top-left.
- **Test:** Start a match. Verify all flat-colored shapes now have depth (lighter top, darker bottom). Verify no performance drop.

### D2: Soft drop shadow with blur
- **File:** index.html (grep for drop shadow, `ellipse`, `u.z`)
- **Fix:** Replace the hard ellipse shadow with a blurred version. Use `ctx.save(); ctx.filter='blur(3px)'; ctx.globalAlpha=0.3*alpha; ctx.fillStyle="#000"; /* draw ellipse */ ctx.restore();`. Feature-detect `ctx.filter` support; fall back to hard shadow if unsupported.
- **Test:** Start a match. Verify shadows are soft/blurred, not hard ellipses. Verify on mobile (Safari).

### D3: Ground decal / team ring
- **File:** index.html (grep for `SpriteRenderer.draw`, drop shadow drawing)
- **Fix:** Before drawing the sprite, draw a semi-transparent colored circle at the unit's feet. Player team: `rgba(68,170,255,0.15)`, enemy team: `rgba(255,68,68,0.15)`. Draw as a flat ellipse, not a filled circle.
- **Test:** Start a match. Verify team-colored ground decals under each unit. Verify player units have blue tint, enemies have red tint.

### D4: Hit reaction animation
- **File:** index.html (grep for `takeDamage`, hit flash, `u.hitFlash`)
- **Fix:** When a unit takes damage, set `u.hitReact=0.15` (15ms recoil). In `SpriteRenderer.draw`, if `u.hitReact>0`, offset the sprite position by 2-3px away from the attacker and decay `hitReact` each frame. This adds a flinch effect.
- **Test:** Attack a unit. Verify it recoils slightly when hit, not just flashes white.

### D5: Death animation variety by body plan
- **File:** index.html (grep for death animation, `deathT`, `animState==="death"`)
- **Fix:** Vary death animation by body plan: `golem`/`construct` → shatter into pieces (spawn colored rect particles), `ghost`/`wraith` → dissolve (fade alpha + rise), `blob`/`slime` → flatten (scale Y to 0), default → existing rotation + fade. Use `u.recipe?.bodyPlan` to select.
- **Test:** Kill units of different body plans. Verify varied death animations (golem shatters, ghost dissolves, blob flattens).

---

## Block E — Performance & Architecture

### E1: Debounce saveData() calls
- **File:** index.html (grep for `saveData`)
- **Fix:** Add a debounce to `saveData`: instead of immediately writing to localStorage, set a 500ms timer. If called again within 500ms, reset the timer. Add a `saveDataNow()` for critical saves (match end, forge). Call `saveDataNow()` on `beforeunload`.
- **Test:** Play a match. Verify localStorage writes are batched (check via console logging in dev). Verify data persists on reload.

### E2: Use structuredClone() instead of JSON.parse(JSON.stringify())
- **File:** index.html (grep for `JSON.parse(JSON.stringify(`)
- **Fix:** Replace all `JSON.parse(JSON.stringify(x))` with `structuredClone(x)`. Fallback: `typeof structuredClone!=="undefined"?structuredClone(x):JSON.parse(JSON.stringify(x))`.
- **Test:** Play a match with forged units. Verify no errors. Verify cloning works correctly.

### E3: devicePixelRatio handling
- **File:** index.html (grep for `cv.width`, `canvas.width`, `getContext`)
- **Fix:** In `Battle.start`, set canvas resolution to `cv.width * devicePixelRatio` × `cv.height * devicePixelRatio`, then scale the context with `ctx.scale(devicePixelRatio, devicePixelRatio)`. Set CSS width/height to the display size. This makes rendering crisp on retina displays.
- **Test:** Open on a retina display. Verify canvas is crisp, not blurry. Verify no layout breakage.

### E4: Pre-compute colorblind-filtered colors
- **File:** index.html (grep for colorblind filter, `applyColorblind`, `_drawShapeRaw` colorblind)
- **Fix:** Instead of creating new shape objects with filtered colors per-shape per-frame, pre-compute filtered colors when the recipe is built or when colorblind setting changes. Store a filtered color map and look it up in `_drawShapeRaw`.
- **Test:** Enable colorblind filter. Verify colors are correct. Verify no per-frame object creation (check via console profiling).

### E5: Error boundary for battle loop
- **File:** index.html (grep for `requestAnimationFrame`, `this.loop`)
- **Fix:** Wrap the `update()` and `render()` calls in `Battle.loop` with try/catch. On error, call `showError(e)` and stop the battle loop (don't let RAF chain break silently). Log the error to analytics if available.
- **Test:** Inject a throwing error in `update()` (mock). Verify error shows, battle stops gracefully, no silent RAF break.

### E6: Fix Battle.auto() interval mismatch
- **File:** index.html (grep for `auto()`, `setInterval`, `tick()`)
- **Fix:** Either change the auto interval to 50ms (matching `dt=0.05`) or change `dt` in `tick()` to match the interval. Recommended: change interval to 50ms for real-time speed, or add a speed multiplier.
- **Test:** Start auto-battle. Verify it runs at a reasonable speed (not 2.4x slower than real-time).

### E7: Fix fxTypeFreq returning 0 for most types
- **File:** index.html (grep for `fxTypeFreq`)
- **Fix:** Add non-zero frequency modifiers for all fxTypes: fire=0, frost=200, lightning=400, poison=-100, heal=300, shockwave=100, fire_wall=-50. This gives each elemental type a distinct pitch.
- **Test:** Match with different unit types. Verify attack sounds vary by fxType (frost sounds higher, poison sounds lower).

---

## Block F — UX Improvements

### F1: Ability tooltips
- **File:** index.html (grep for ability display, deck screen, `u.ability`)
- **Fix:** Add a tooltip element that shows on hover/tap over an ability name. Include: ability name, description (what it does), and whether it's passive or triggered. Create an `ABILITY_DESCRIPTIONS` map with descriptions for each ability (splash, ramp, lifesteal, rage, shield, dodge, heal, heal_burst, spawn, explode, poison).
- **Test:** Open deck screen. Hover/tap an ability name. Verify tooltip shows with description.

### F2: Unit detail view
- **File:** index.html (grep for deck rendering, collection rendering)
- **Fix:** Add a `showUnitDetail(unit)` function that opens a modal with: full stats (HP, DMG, range, speed, attack speed, crit), ability name + description, role, rarity, and an animated sprite preview on a mini canvas (reuse `SpriteRenderer.draw` or `renderPreview`).
- **Test:** Open deck/collection. Tap a unit card. Verify detail modal shows with all stats + animated preview.

### F3: Back button on forge screen
- **File:** index.html (grep for forge screen HTML, forge UI)
- **Fix:** Add a "Back" or "Cancel" button on the forge screen that returns to the menu without generating anything. Place it in the forge header area.
- **Test:** Open forge. Tap Back. Verify returns to menu with no generation triggered.

### F4: Settings apply feedback
- **File:** index.html (grep for settings, `saveSetting`)
- **Fix:** After saving a setting, show a brief toast: "Settings saved". Use the existing `toast()` function.
- **Test:** Open settings. Change any toggle. Verify "Settings saved" toast appears.

### F5: Scout screen progressive reveal
- **File:** index.html (grep for `showScout`, scout rendering)
- **Fix:** Instead of revealing all opponent picks at once, show them face-down (card backs). Player taps each card to reveal it individually. Add a "Reveal All" button for convenience.
- **Test:** Play a match. Reach scout screen. Verify cards are face-down. Tap one → verify it flips/reveals. Tap "Reveal All" → verify all reveal.

---

## Block G — i18n Expansion

### G1: Add more languages
- **File:** index.html (grep for `STRINGS`, `t(`, language definitions)
- **Fix:** Add `de`, `fr`, `ja` to the STRINGS object. Translate the key UI strings (menu, draft, scout, battle, result, forge, settings, quests). Use machine translation (DeepL/Google Translate quality). Mark them as "beta" in the language picker.
- **Test:** Switch language to German → verify key UI strings in German. Switch to Japanese → verify strings + no layout breakage.

### G2: Extract in-game text to string table
- **File:** index.html (grep for `toast(`, `innerText=`, `innerHTML=` in non-UI contexts)
- **Fix:** Extract battle log messages, toast notifications, quest descriptions, achievement names, and other in-game text into the STRINGS table. Replace hardcoded strings with `t(...)` calls. This is mechanical but touches many files.
- **Test:** Switch to Spanish. Play a full match. Verify battle log, toasts, quest descriptions, and achievement notifications are all in Spanish.

---

## Block H — PWA & Mobile

### H1: Add service worker for offline play
- **File:** index.html (grep for `setupPWA`, manifest, service worker)
- **Fix:** Create an inline service worker (via Blob URL or a separate `sw.js` file). Cache `index.html` and all vendor files. Serve from cache when offline. Update cache on new version.
- **Test:** Load the game. Go offline (Playwright network emulation). Reload. Verify game loads and plays offline.

### H2: Fix display mode
- **File:** index.html (grep for manifest, `display`)
- **Fix:** Change `display:"fullscreen"` to `display:"standalone"` in the manifest. More widely supported.
- **Test:** Add to home screen on mobile (Playwright emulation). Verify it opens in standalone mode.

### H3: Canvas responds to orientation change
- **File:** index.html (grep for `cv.width`, `orientationchange`, `resize`)
- **Fix:** Add an `orientationchange` event listener that resizes the canvas to `Math.min(400, innerWidth-20)` × `550` (or responsive height). Re-render.
- **Test:** Start a battle. Rotate device (Playwright). Verify canvas resizes correctly.

---

## Block I — Audio Improvements

### I1: Menu/forge music
- **File:** index.html (grep for `startMusic`, `stopMusic`, `GameAudio`)
- **Fix:** Add a lighter ambient music track for menu and forge screens. Different from battle music — slower, calmer. Start when entering menu, stop when starting a match. Lower gain (0.08).
- **Test:** Open menu → verify ambient music plays. Start match → verify battle music replaces it. Return to menu → verify ambient music returns.

### I2: Arena-specific music patterns
- **File:** index.html (grep for `startMusic`, arena root note)
- **Fix:** Vary the music pattern by arena: Training Yard = major key arpeggio, District Z = minor key drone, Golden Goal = pentatonic scale, Void Rift = chromatic/diminished. Keep the same tempo/intensity system.
- **Test:** Play matches in different arenas. Verify music sounds distinct per arena.

### I3: More SFX variety
- **File:** index.html (grep for `GameAudio.sfx`, SFX definitions)
- **Fix:** Add weapon-type-specific attack sounds: sword = sharp metallic (square wave 300Hz), bow = string twang (triangle 800Hz), staff = magical (sine 400Hz + shimmer), claw = ripping (noise burst 100ms). Map weapon types to SFX variants.
- **Test:** Match with Knight (sword) vs Archer (bow) vs Wizard (staff). Verify each has distinct attack sounds.

---

## Block J — Long-term Improvements

### J1: Batch LLM field generation
- **File:** index.html (grep for `FIELD_ORDER`, `askField`, `generateUnit`)
- **Fix:** Instead of 24 sequential LLM calls, batch into 3-4 calls: 1) all enum fields in one JSON call, 2) all numeric fields in one call, 3) name + visual fields in one call. This reduces generation time from ~15s to ~5s.
- **Test:** Forge a unit. Verify generation completes in ~5s instead of ~15s. Verify output quality is the same.

### J2: Spatial partitioning for collision separation
- **File:** index.html (grep for `separate(`)
- **Fix:** Implement a uniform grid spatial hash. Divide the battlefield into 60×60px cells. Each frame, bin units into cells, only check collisions within the same + adjacent cells. O(n) instead of O(n²).
- **Test:** Match with 12+ units. Verify no performance drop. Verify separation still works correctly (no overlapping units).

### J3: Snapshot interpolation for P2P
- **File:** index.html (grep for `applyRemoteSnapshot`, `applySnapshot`)
- **Fix:** Instead of directly replacing `Battle.units` with snapshot data, interpolate between the previous and current snapshot. Store `prevSnapshot` and `currSnapshot`, lerp unit positions/HP between them at the render frame rate. Snap to current on new snapshot arrival.
- **Test:** P2P match. Verify guest rendering is smooth, no jitter/teleporting.

### J4: No IndexedDB fallback
- **File:** index.html (grep for `saveData`, `localStorage`)
- **Fix:** Add an IndexedDB wrapper that stores save data when localStorage is near quota. Check quota on save — if `localStorage` remaining space < 100KB, write to IndexedDB instead. Load from IndexedDB if localStorage is empty.
- **Test:** Fill localStorage to near quota (mock). Save game. Verify data persists in IndexedDB. Reload. Verify data loads correctly.

---

## OVERNIGHT-STATUS.md format

```
# Overnight Execution Status — Round 2
## Completed
- [x] Pre-flight: ...
- [x] Block A: Critical bugs fixed — committed <hash>, pushed
- [x] Block B: Suspected bugs fixed — committed <hash>, pushed
...
## Skipped / Blocked
- [ ] Block X: skipped (reason)
## Notes
- ...
## Current
Working on Block Y: ...
```

Start with pre-flight, then Block A. Don't finish until it's finished.
