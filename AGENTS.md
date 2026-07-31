# AGENTS.md — Prompt Showdown Engineering Notes

## Battle System: Movement-Range Alignment Rule

### The Bug (BUG-087)

Wizards (and all `kite` movement units) would stare at each other indefinitely instead of fighting. Two wizards would approach each other, stop at a distance just outside attack range, and never close the gap.

### Root Cause

The `kite` movement function had a **dead zone** that didn't align with the attack range:

```javascript
// BROKEN — dead zone is r*0.5 to r*1.1, but attack range is r
kite:(u,target,dt)=>{
  if(d<u.r*0.5)moveAway(u,target,sp);
  else if(d>u.r*1.1)moveToward(u,target,sp);
  // Between r and r*1.1: no movement, but also can't attack (dist > r)
}
```

The attack check in `act()` requires `dist(u,target) <= u.r`. But the kite dead zone (where the unit doesn't move) extended from `r*0.5` to `r*1.1`. The gap between `r` and `r*1.1` is a **no-man's-land**: the unit is too far to attack but the kite behavior says "you're in the sweet spot, don't move."

When two kite units face each other, they both settle at distance ~`r*1.1` (just outside attack range) and stare forever.

### Fix

Changed the upper kite threshold from `r*1.1` to `r` so the dead zone ends exactly at attack range:

```javascript
// FIXED — dead zone is r*0.5 to r, aligned with attack range
kite:(u,target,dt)=>{
  if(d<u.r*0.5)moveAway(u,target,sp);
  else if(d>u.r)moveToward(u,target,sp);
  // At d<=r: in attack range, can attack, stays put (correct kite behavior)
}
```

### The Rule

**Any movement behavior that has a "stand still" zone must ensure that zone is entirely within attack range.** If the stand-still zone extends beyond `u.r`, units will get stuck out of attack range.

When designing or modifying movement functions:

1. **Identify the dead zone** — the range of distances where the unit doesn't move.
2. **Ensure the dead zone's upper bound <= `u.r`** — so the unit can always attack when standing still.
3. **Test with same-type matchups** — two identical units facing each other is the most common edge case. If both have the same range and movement, they'll converge to the dead zone boundary. If that boundary is outside attack range, they stall forever.

### Affected Units

All units with `movement:"kite"` were affected:
- Wizard (r=160) — most noticeable due to high range
- Archer (r=170) — same issue, but less noticeable since archers are usually mixed with melee
- Plague (r=90)
- Phoenix (r=120)
- Any LLM-generated unit with `movement:"kite"`

### Related Patterns to Watch

- `hold_midpoint` uses `d>u.r` as its threshold — this is correct (dead zone is `d<=r`, entirely within attack range).
- `flee` always moves away — no dead zone, no issue.
- `chase` always moves toward — no dead zone, no issue.
- `hold` never moves — the unit relies on being placed in range by formation. If formation places it out of range, it will never attack. This is a separate potential issue.
- `patrol` moves side-to-side — doesn't close distance. If the enemy is out of range, the unit will never attack. This is by design (patrol is for defensive units).

## P2P Synchronization Rules

### Guest State Must Mirror Host State

The host is authoritative for all match state. The guest must track the same state via messages:

- **`Match.round`**: Guest must increment on every `round_start` message. Do not call `Match.start` from `match_start` — it prematurely increments round via `startRound`.
- **`Match.history`**: Guest must push entries on `round_end` and `match_end` (final round only). Without this, quest tracking, achievements, and replays break.
- **`Match.livesPlayer`/`Match.livesEnemy`**: Guest must swap lives from host perspective (host's player = guest's enemy).
- **Winner translation**: Host's `"player"` = guest's `"enemy"` and vice versa. Always translate when receiving match/round results.

### Guest Should Not Run Authoritative Logic

The guest must not call `Match.onRoundEnd` or `Match.onMatchEnd` directly from battle end. These are triggered by host messages (`round_end`, `match_end`). The guest's `onBattleEnd` should return early for P2P.

### Scout Picks

The host should not send `opponent_picks` with bot picks — the guest already has the host's real previous-round picks from `round_start`. Bot picks are local placeholders for the host's scout screen only.

## Spell System Rules

### Persistent Zone Effects

`tickZones` must handle **all** effect types in `SPELL_ENUM.effect`, not just a subset. Each effect should be applied once per second to units within the zone radius. Missing handlers cause zones to silently do nothing.

### Spell Target Filtering

`Spell.fire` must filter affected units by team. Ally targets (`ally_*`, `lowest_ally`) filter to allies. All other targets (including `center`) default to enemies only. Never leave a target type unfiltered — it would hit both teams.

### Damage Over Time Stacking

`damage_over_time` spell effect must use `Math.max` for `poisonDmg` to avoid overwriting higher existing poison damage from unit abilities. Same rule applies to any status effect that could be applied by multiple sources.

### Manual Spell Casting

Spells can be cast manually by the player via the spell bar UI (`Battle._castPlayerSpell`). Each manually-cast spell has a power-based cooldown (3-10s, computed by `Battle._spellCooldown`). The spell bar auto-renders at ~4fps to show cooldown countdowns. Auto-fire triggers (`Spell.checkTriggers`) still run alongside manual casting — both paths call `Spell.fire`. When adding a new spell effect, ensure it works in both auto-fire and manual cast paths (they share the same `Spell.fire` entry point).

### Spell Bar UI

The spell bar (`#spellBar`) is a flex container below the battle canvas. It should be hidden when not on the battle screen (handled by `G.screen()`). Spell buttons (`.spellBtn`) show an icon, name, and cooldown overlay (`.spellCD`). Buttons are disabled while on cooldown. The spell bar re-renders from `Battle.playerSpells` array — each entry has `{spec, cooldown, maxCD}`.

## Kill Attribution Rules

### All Damage Sources Must Set lastAttacker

Every code path that reduces a unit's HP must set `u.lastAttacker` to the responsible attacker. This includes:
- Direct melee attacks (`takeDamage`)
- Projectile hits (`updateProjectiles` — uses synth attacker with `id:p.owner`, resolved in `onUnitDeath`)
- Splash damage (`e.lastAttacker=attacker` for each splash target)
- Thorns reflect (`attacker.lastAttacker=target`)
- Poison ticks (lastAttacker is set when poison is applied, not on each tick)
- Arena mechanics (environment kills pass `null` killer — `onUnitDeath` handles this gracefully)

If `lastAttacker` is not set, kills won't be attributed for:
- Ramp bonus (+15% dmg on kill)
- on_kill ability trigger
- Kill count for MVP
- Battle stats (playerKills/enemyKills)
- Kill feed overlay

### onUnitDeath Death Detection

`onUnitDeath(u)` is called once per unit when `u.h<=0 && u.deathT===undefined`. The function sets `u.deathT=0` to prevent double-calling. Arena mechanics call `onUnitDeath` directly (setting `deathT=0`), so the main loop's death detection won't re-call it. The `null` killer parameter passed by arena mechanics is ignored — `onUnitDeath` uses `u.lastAttacker` as the killer, not the second parameter.

## Save System Rules

### Import Must Run Migration

`importSave()` must call `migrateSave(data)` before assigning to `this.save`. Imported saves from older versions will be missing fields added in later migrations. Without migration, imported saves cause undefined behavior and errors.

### IndexedDB Fallback

When localStorage quota is exceeded, `saveData()` falls back to writing to IndexedDB via `idbPut()`. The load path must also check IndexedDB:
- `loadData()` — synchronous, reads from localStorage only (fast path)
- `loadDataAsync(cb)` — async, tries localStorage first, then IndexedDB fallback
- `G.init()` uses the sync path if `save.version` exists (99% of users), async path if not

The splash screen stays visible during the async IDB lookup. `hideSplash()` is called in `_initRest()` after init completes.

### Debounced Saves for High-Frequency Events

High-frequency save calls (quest tracking, settings changes, difficulty changes) must use `saveDataDebounced()` instead of `saveData()`. This batches writes within 500ms, reducing localStorage I/O. Critical saves (match end, forge, import) still use synchronous `saveData()`.

## Security Rules

### Unit Name Sanitization

Unit names are user-generated (LLM forge, save import, P2P). They must be sanitized at creation in `unit()` to prevent XSS:
- Angle brackets (`<` `>`) are stripped
- Double quotes (`"`) are replaced with single quotes (`'`)
- Names are truncated to 20 characters

This prevents XSS in all downstream `innerHTML` templates without needing to escape at each usage site. Never bypass this sanitization — if you need to display a raw name, use `textContent` instead of `innerHTML`.

## Forge System Rules

### Daily Forge Cap

`_doForge()` enforces a daily cap of 10 forges per day using `save.forgeDate` and `save.forgeCount`:
- On each forge: if `forgeDate !== today`, reset `forgeCount` to 0 and update `forgeDate`
- If `forgeCount >= 10`, show toast and return early
- Increment `forgeCount` after the cap check passes

The cap prevents unlimited forging and encourages strategic unit creation.
