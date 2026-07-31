# Prompt Showdown — Comprehensive Codebase Improvement Scan

**File reviewed:** `index.html` (~7000 lines, single-file game)
**Date:** 2025

---

## 1. Gameplay Improvements

### 1.1 Battle Simulation
- **No unit collision damage**: Units separate via push-apart but deal no contact damage. Adding small collision damage would make positioning matter more.
- **`enemy_cluster` targeting is O(n²)**: `TARGETING.enemy_cluster` computes pairwise distances for every enemy each frame. With many units this is expensive. Consider caching the cluster centroid per frame.
- **Dodge chance is flat 50%**: `dodge` ability uses `R()<0.5` — no scaling, no counterplay. Could scale with speed or level.
- **Rage damage uncapped at low HP**: `dmg*=1+(1-attacker.h/attacker.mh)` can double damage at 1 HP. This is intentional but extreme; consider a softer curve.
- **No healing cap per round**: Multiple healers can stack indefinitely. Consider diminishing returns.
- **Minion TTL expiry sets `h=0` but doesn't trigger `onUnitDeath`**: At line 3431, `u.ttl<=0` sets `u.h=0` but the death detection at line 3447 checks `u.h<=0&&u.deathT===undefined` — this works, but minion deaths from TTL don't appear in the death log, which could skew post-match hints.
- **Battle timeout at 90s is generous but has no escalation**: Consider adding a damage-over-time "enrage" mechanic after 60s to prevent stalemates more naturally.
- **`patrol` movement only moves on X axis**: `u.x+=Math.sin(u.patrolT*2)*effSpeed(u)*dt*0.5` — patrolling units never adjust Y, making them predictable.

### 1.2 Draft & Strategy
- **Rerolls are per-match (3 total)**: No way to earn more rerolls. Could tie to quests or coins.
- **Bot draft strategy is basic**: `BotStrategy` only checks for missing frontline/carry roles. No synergy detection, no counter-picking based on player abilities (only checks for `ramp`).
- **No draft timer**: Players can stare at cards indefinitely. A optional timer would add tension.
- **Comeback mechanic is 4th draw only**: Could add scaling comeback (e.g., stat boost for losing team's units).

### 1.3 Progression
- **Only 4 arenas**: The progression is short. More arenas or a rotating arena system would add replayability.
- **Upgrade cost formula is linear**: `30+lvl*20` — diminishing returns aren't built in, making high-level upgrades too expensive relative to their +10% gain.
- **Fusion takes higher of each stat**: This means fusing two identical units gives no benefit beyond the level up. Consider a small bonus for fusing identical copies.
- **No unit trade/sacrifice mechanic**: Players accumulate collection units with no way to discard or convert unwanted ones.

### 1.4 Spell System
- **Spells have no cooldown between periodic fires**: `periodic_5s` spells fire every 5s with no limit — could be too strong in long battles.
- **Manual casting now available**: Spell bar UI lets players tap to cast spells during battle with power-based cooldowns (3-10s). Auto-fire triggers still work alongside manual casting.
- **No spell crafting UI**: Spells can only be forged via LLM or shared. No way to combine or modify existing spells.
- **Spell summon minions have fixed stats**: `Spell Minion` is always `{h:30,d:8,r:25,s:60}` regardless of arena tier.

---

## 2. Performance

### 2.1 Rendering
- **`_drawShapeRaw` creates objects on every call**: Lines 2457-2459 create new `shape` objects via spread for colorblind/high-contrast filters. This runs per-shape per-frame. Consider pre-computing filtered colors once when the recipe is built.
- **`drawFace` called every frame for every unit**: No culling for off-screen units (though the canvas is small, so this is minor).
- **Particle system is capped at 60**: `MAX_PARTICLES=60` is very conservative. On desktop, 200+ would be fine and look better.
- **`BattleFX.burst` checks `Battle.particles?.length` each call**: Minor, but the optional chaining adds overhead in a hot path.
- **`separate()` is O(n²)**: With 30+ units on screen, this is 900 distance checks per frame. Consider spatial partitioning (grid-based).
- **`render()` draws HP bars and names for every unit every frame**: Could batch text rendering or skip for dead/dying units.
- **Canvas width is `Math.min(400, innerWidth-20)` but height is fixed 550**: On very small screens, the canvas might be too tall. Consider responsive height.
- **No `devicePixelRatio` handling**: Canvas renders at 1x resolution — looks blurry on retina displays. Should scale canvas by `devicePixelRatio` and use CSS to maintain display size.

### 2.2 Memory
- **`cloneUnit` uses `JSON.parse(JSON.stringify(u))`**: This is slow for deep cloning. `structuredClone()` is available in modern browsers and is faster.
- **`Battle.units` array is filtered multiple times per frame**: `players` and `enemies` are filtered from `this.units` at lines 3451-3452, then again in `checkEnd()`. Could cache or use a single pass.
- **`this.units=this.units.filter(...)` creates a new array every frame** (line 3482): For death cleanup. Could use in-place removal or a separate "to remove" flag.
- **Snapshots sent at 20Hz include full unit objects**: `Battle.snapshot()` sends `this.units` directly — these are large objects with recipes (arrays of shapes). Consider delta compression or sending only changed fields.

### 2.3 LLM
- **Per-field generation makes 24 sequential LLM calls**: `FIELD_ORDER` has 24 fields, each requiring a separate `askField` call. This is very slow. Consider batching into fewer calls (e.g., generate all enum fields in one call, all numeric fields in another).
- **No LLM response caching per field**: If the same prompt is re-forged, all 24 fields are re-queried even if the prompt is identical (though `generateUnit` does cache the final result).

---

## 3. User Experience

### 3.1 UI/UX
- **No keyboard navigation**: All interactions are click/tap only. Adding keyboard shortcuts (e.g., 1/2/3 for draft picks, Space for tick) would improve desktop UX.
- **No loading indicator during bot army generation**: `buildBotArmy()` is synchronous but could take a moment with large pools.
- **Battle log uses `innerHTML+=`**: Line 3837 appends HTML strings, which is slow and could cause layout thrashing. Consider using `textContent` and `createElement`.
- **`screen()` removes all fixed overlays**: Lines 4370-4373 query all `div` elements to clean up overlays. This is expensive — should track overlays in an array.
- **No "back" button on forge screen**: Once in the forge, you must generate or skip to leave. Should have a cancel/back button.
- **Deck screen doesn't show unit abilities in detail**: Only shows ability name, not description or stats like range/speed.
- **No unit detail view**: Tapping a unit card in deck/collection doesn't show a detailed view with full stats, ability description, and animated preview.
- **Settings screen has no "apply" feedback**: Changing settings saves silently. A toast or visual confirmation would help.
- **No confirmation on loadout swap**: Tapping a loadout slot immediately swaps — no undo.
- **Scout screen reveals all opponent picks at once**: No suspense in revealing. Could reveal one at a time or let player tap each card.

### 3.2 Onboarding
- **Onboarding is 6 steps but non-interactive**: The coachmarks just say "tap X" but don't wait for the player to actually do it. Players skip through without learning.
- **No tooltip on first draft**: The first time a player sees draft cards, there's no explanation of rarity colors or role hints.
- **No explanation of abilities**: New players see "splash", "ramp", "lifesteal" etc. with no tooltip explaining what they do.

### 3.3 Accessibility
- **No ARIA labels**: Buttons and interactive elements have no `aria-label` or `role` attributes.
- **Color-only differentiation**: Team colors (blue vs red), rarity tiers, and status effects rely on color alone. The colorblind filter helps but doesn't cover all cases.
- **No screen reader support for battle**: Battle state (HP, unit count, turn) is displayed visually but not announced.
- **No font size adjustment**: Only high-contrast mode exists. No way to increase text size.
- **`confirm()` dialogs**: Lines 4621, 5893 use native `confirm()` which is inaccessible and ugly. Should use custom modal.
- **No focus indicators**: Custom buttons don't show focus rings for keyboard navigation.
- **Reduced motion only partially implemented**: `G.save.settings.reducedMotion` is saved but never checked in the rendering code. Screen shake and particle effects should be reduced/skipped.

---

## 4. Architecture

### 4.1 Code Organization
- **Everything in one 6,000-line file**: While the README states this is intentional (no build step), the file is becoming unwieldy. Consider splitting into ES modules loaded via `<script type="module">` — this works without a build step.
- **No consistent naming convention**: Mix of camelCase (`moveToward`), PascalCase (`Battle`, `Match`), UPPER_SNAKE (`MAX_PARTICLES`), and lowercase (`unit`, `cloneUnit`). Objects like `G`, `Battle`, `Match` are singletons but not clearly namespaced.
- **`G` object is a god object**: Contains save data, UI methods, game logic, networking, forge, deck, achievements — all in one object. Should be split into modules (SaveManager, UIManager, ForgeManager, etc.).
- **Global state via closures**: `room`, `sendNet`, `connected`, `role`, `_peerId` are module-level let variables. This makes testing and reset difficult.

### 4.2 Error Handling
- **`showError` shows raw error messages**: Lines 386-392 display `e.message` directly to users. Should show user-friendly messages and log details to console.
- **Silent catches**: Multiple `catch(e){}` blocks with no logging (e.g., line 4544, 5973). Errors are swallowed silently.
- **No error boundary for battle loop**: If `update()` or `render()` throws, the `requestAnimationFrame` chain breaks silently. Should wrap in try/catch and show error.

### 4.3 Data Persistence
- **`saveData()` called very frequently**: Quest tracking, settings changes, forge, match end — each calls `saveData()` which does `JSON.stringify` + `localStorage.setItem`. Consider debouncing or batching saves.
- **No IndexedDB fallback**: localStorage has a 5MB limit. With 50 collection units + 50 ai units + replays, this could overflow. IndexedDB would be more robust.
- **`migrateSave` doesn't validate**: It adds missing fields but doesn't validate types or remove corrupt data. A malformed save could cause runtime errors.

### 4.4 Networking
- **Snapshot serialization sends raw objects**: `transmit("snap", snap)` sends the full snapshot including function references (though JSON.stringify strips them). Should explicitly serialize only needed fields.
- **No message versioning**: Network messages have no protocol version. A mismatched client could crash on unknown message types.
- **No reconnection logic**: If the host's network drops briefly, the match is forfeited. The `showReconnect` UI exists but isn't wired to actual reconnection.
- **`trystero` room ID is hardcoded**: `psd-arena-${arenaIdx}-queue` — no way to create private rooms with custom codes from the UI (the `roomId` input exists but matchmaking bypasses it).

### 4.5 Testing
- **No tests**: Zero unit tests, integration tests, or E2E tests. The game has complex combat logic, spell effects, and networking — all untested.
- **No debug mode for abilities**: `Battle.debug` exists but only logs positions/stats. No way to test specific ability interactions.
- **No battle replay system**: `saveReplay` stores metadata but not actual battle state. Can't replay battles to debug issues.

---

## 5. Multiplayer

### 5.1 Synchronization
- **20Hz snapshots may be insufficient**: Fast-moving units or projectiles may appear to teleport. Consider interpolation on the guest side.
- **No snapshot interpolation**: `applyRemoteSnapshot` directly replaces `Battle.units` with the snapshot data. This causes jitter. Should interpolate between previous and current snapshot.
- **No client-side prediction**: Guest sees only host's state with no prediction. Input latency is high (round-trip + 50ms snapshot interval).
- **Guest can't see projectiles smoothly**: `Battle.projectiles=snap.projectiles||[]` replaces the entire array — projectiles may jump.

### 5.2 Matchmaking
- **5-second timeout is very short**: `matchmakingTimer` at 5000ms falls back to bot quickly. Players in different regions may not connect in time.
- **No skill-based matching**: Ranked rating exists but isn't used in matchmaking. Players of any skill level can be matched together.
- **No private rooms from UI**: The `roomId` input exists but matchmaking always uses the arena queue room. No way to play with a specific friend.

### 5.3 Disconnect Handling
- **Host disconnect = guest loses**: Guest gets "Host disconnected" and returns to menu with a loss. Should offer "Continue vs Bot" for guests too.
- **No mid-round reconnect**: If a player disconnects during a battle, the match is immediately forfeited. The `gracefulDisconnect` method exists but isn't called by the network layer.

---

## 6. Visual / Rendering

### 6.1 Sprite System
- **No silhouette outline for unit readability**: Units blend into the dark background. A 1-2px black outline around the entire sprite would dramatically improve readability (documented in `VISUALS-RESEARCH.md`).
- **No team color tinting**: Friendly and enemy units are distinguished only by a thin stroke and HP bar color. A team-colored outline or glow would help.
- **Drop shadow is a flat ellipse**: Could use a blurred shadow for more depth.
- **No rim lighting**: Units have no edge highlight to separate them from the background.
- **`drawFace` eyes are basic circles**: No expressions, blinking, or target tracking (though `u.target` is stored, `drawFace` doesn't use it for eye direction).

### 6.2 Animations
- **Attack animation is 0.4s for all units**: Fast attackers (high `a` value) should have faster attack animations. Currently `u.attackT+=dt/0.4` is hardcoded.
- **No hit reaction animation**: Units flash white but don't flinch or recoil when hit.
- **Death animation is always rotation + fade**: Could vary by body plan (e.g., shatter for golem, dissolve for ghost).
- **No idle variety**: All units use the same bob animation. Could add breathing, looking around, etc.

### 6.3 Battlefield
- **Background is solid `#080810`**: No arena-themed backgrounds. Each arena could have a distinct color scheme, pattern, or parallax effect.
- **No ground line or perspective**: Units float in space. A subtle ground line or grid would add depth.
- **No environmental hazards**: The battlefield is empty. Could add obstacles, high ground, or zones.

---

## 7. Audio

### 7.1 SFX
- **Limited variety**: Only ~15 SFX. Many abilities share sounds (e.g., `heal` and `heal_burst` both use "heal" SFX).
- **No unit-specific sounds**: All melee attacks sound the same regardless of weapon type. Could vary pitch/waveform by weapon.
- **No ambient sounds**: No background ambience during battle (crowd, wind, etc.).

### 7.2 Music
- **Procedural music is very simple**: Single bass drone + arpeggio. Could add percussion, harmony, or dynamic intensity based on battle state.
- **Music doesn't change with arena**: Root note changes but the pattern is identical. Each arena could have a distinct musical style.
- **No music in menu/forge**: Only plays during battle. Menu music would add atmosphere.

---

## 8. Security & Privacy

### 8.1 Data Validation
- **Shared unit import doesn't fully validate**: `importUnitFromURL` parses JSON from URL params and passes to `unit()` which clamps values, but doesn't validate `recipe` shapes — a malicious share link could contain arbitrary shape data that could crash the renderer.
- **No input sanitization on forge prompt**: `promptEl.value` is used directly. While the LLM processes it, the template fallback uses it as a unit name (`prompt.slice(0,20)`) — could contain HTML that breaks the UI (though `innerText` is used in most places).
- **P2P messages are trusted**: `networkReceive` doesn't validate message structure beyond type checking. A malicious peer could send malformed data.

### 8.2 Privacy
- **Analytics has no endpoint by default**: Good — but if an endpoint is configured, `installId` is persisted and sent. Should disclose this in privacy policy.
- **No GDPR/CCPA compliance**: No cookie banner, no data deletion flow, no privacy policy link.

---

## 9. Mobile

### 9.1 Touch
- **Tap-to-tick is the only battle control**: No way to speed up/slow down battle on mobile. The `auto` button helps but is 120ms intervals (8fps).
- **No pinch-to-zoom on battlefield**: Can't zoom in to see units better on small screens.
- **Canvas doesn't respond to orientation change**: Width is set once at battle start. Rotating the phone doesn't resize.

### 9.2 Performance
- **`isMobile` detection is basic**: Checks touch + max-width 820px. Tablets and large phones may not be detected.
- **No quality auto-detection**: `qualityTier()` returns `"high"` by default on auto. No FPS monitoring to downgrade if performance is poor.
- **`_fpsTier` is never set**: `qualityTier()` references `this._fpsTier` but it's never assigned. Auto quality detection is non-functional.

---

## 10. Miscellaneous

### 10.1 Dead Code
- **`G.save.ai` is duplicated with `G.save.collection`**: Both store forged units. `addForge` pushes to both. This wastes storage and creates sync issues.
- **`G.deckUnits()` is a backward-compat alias**: Line 4409 — could be removed if nothing uses it externally.
- **`SPRITE_RECIPES` for starter units could be generated by `RecipeAssembler`**: The hand-authored recipes duplicate the body plan system.

### 10.2 Bugs
- **`addToLoadout` has a logic error**: Line 5812 checks `this.save.loadout.findIndex(n=>n===name)` but this is the same as `existingSlot` which was already checked. The "find duplicate slot" branch never executes differently from the existing slot check.
- **`_comebackCheck` checks `Match.livesEnemy<=0` but this is checked at match end**: By the time achievements are checked, `Match.livesEnemy` may already be 0 from the final round. The check should verify the match history shows a round 1 loss.
- **`loadoutUnits()` doesn't apply upgrades**: Returns raw collection/base units. Upgrades are only applied in `buildArmy()`. This means the deck screen shows base stats, not upgraded stats.
- **`renderSynergyMeter` uses `loadoutUnits()` which returns un-upgraded units**: Role counts are correct but displayed stats may be misleading.
- **`Battle.auto()` interval is 120ms but `tick()` uses fixed `dt=0.05` (50ms)**: Auto-battle runs at ~8fps but simulates 50ms steps. This means auto-battle is 2.4x slower than real-time.
- **`fxTypeFreq` returns 0 for most types**: The pitch modifier is 0 for non-elemental types, making all basic attacks sound identical.
- **`qualityTier` references `this._fpsTier` but it's never set**: Auto quality detection is non-functional.
- **`reducedMotion` setting is saved but never checked**: Screen shake and particles are always active.

### 10.3 i18n
- **Only 3 languages (en, es, pt)**: No Asian or other European languages.
- **i18n only covers menu/tutorial strings**: In-game text (battle log, toasts, quest descriptions, achievement names) is all hardcoded English.
- **No RTL support**: CSS doesn't account for right-to-left languages.

### 10.4 PWA
- **No service worker**: The manifest is registered but without a SW, there's no offline support or push notifications.
- **`display:"fullscreen"` may not work on all platforms**: `"standalone"` is more widely supported.

---

## Priority Recommendations

### Quick Wins (Low effort, high impact)
1. **Fix `reducedMotion` not being checked** — add conditionals in `BattleFX.shake()` and `BattleFX.burst()`
2. **Fix `qualityTier` / `_fpsTier` never being set** — implement FPS monitoring
3. **Add team-colored outlines** — 2px stroke around sprites for readability
4. **Fix `addToLoadout` logic bug** — the duplicate slot check is broken
5. **Add keyboard shortcuts** — 1/2/3 for draft picks, Space for battle tick
6. **Replace `confirm()` with custom modals** — better UX and accessibility
7. **Show upgraded stats in deck screen** — call `applyUpgrades` in `loadoutUnits()` or display

### Medium Priority
8. **Debounce `saveData()` calls** — batch saves to avoid localStorage thrashing
9. **Add snapshot interpolation for P2P** — smooth guest rendering
10. **Implement unit detail view** — tap card to see full stats + animated preview
11. **Add ability tooltips** — explain what each ability does
12. **Vary attack animation speed by unit attack speed** — `dt/u.a` instead of `dt/0.4`
13. **Add arena-themed backgrounds** — distinct visual identity per arena
14. **Pre-compute colorblind-filtered colors** — don't filter per-shape per-frame
15. **Use `structuredClone()` instead of `JSON.parse(JSON.stringify())`** — faster deep cloning

### Long-term
16. **Split into ES modules** — improve maintainability without adding a build step
17. **Add unit tests for combat logic** — abilities, damage calculation, spell effects
18. **Implement delta compression for P2P snapshots** — reduce bandwidth
19. **Add service worker for offline play** — full PWA support
20. **Batch LLM field generation** — reduce 24 sequential calls to 3-4 batched calls
21. **Add spatial partitioning for collision separation** — O(n) instead of O(n²)
22. **Implement proper interpolation for guest rendering** — smooth multiplayer experience
