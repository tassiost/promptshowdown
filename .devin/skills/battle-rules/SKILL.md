---
name: battle-rules
description: Battle system rules — movement, abilities, spells, kill attribution, targeting, avoidance, weapons
triggers:
  - model
allowed-tools:
  - read
  - grep
  - glob
---

Detailed engineering rules for the battle system in Prompt Showdown. Invoke this skill
when working on battle logic, unit AI, abilities, spells, targeting, movement, collision,
kill attribution, or weapon attachment.

The entire game is in `index.html` (~13K lines). Search by function/constant name.

## Continuous Draft: Cumulative Army Rule

Drafting is **cumulative** — all units (including killed ones) carry over between rounds
and revive to full HP. The army grows each round as new picks are added.

- `onBattleEnd` stores ALL units from `Battle._finalUnits` into `playerSurvivors`/`enemySurvivors`
  — no `u.h>0` filter. Dead units are included.
- `buildArmy`/`buildBotArmy` revive survivors: `clean.h=clean.mh` (heal to full).
- **Never** filter survivors by `u.h>0` — that would discard dead units.
- `_isSurvivor` flag is for visual distinction only (0.85 alpha in draft view).

## Movement-Range Alignment Rule

**Any movement behavior with a "stand still" zone must ensure that zone is entirely within
attack range (`u.r`).** If the stand-still zone extends beyond `u.r`, units get stuck out
of attack range and stare forever.

The `kite` movement function had this bug (BUG-087): dead zone was `r*0.5` to `r*1.1`, but
attack range is `r`. The gap between `r` and `r*1.1` was a no-man's-land. Fixed by changing
upper threshold from `r*1.1` to `r`.

When designing movement functions:
1. Identify the dead zone (distances where unit doesn't move)
2. Ensure dead zone's upper bound <= `u.r`
3. Test with same-type matchups (two identical units converge to dead zone boundary)

Related patterns: `hold_midpoint` uses `d>u.r` (correct). `flee`/`chase` have no dead zone.
`hold` never moves (relies on formation). `patrol` moves side-to-side (by design).

## Spell System Rules

### Persistent Zone Effects
`tickZones` must handle **all** effect types in `SPELL_ENUM.effect`, not just a subset.
Each effect applied once per second to units within zone radius. Missing handlers cause
zones to silently do nothing.

### Spell Target Filtering
`Spell.fire` must filter affected units by team. Ally targets (`ally_*`, `lowest_ally`)
filter to allies. All other targets (including `center`) default to enemies only. Never
leave a target type unfiltered.

### Damage Over Time Stacking
`damage_over_time` must use `Math.max` for `poisonDmg` to avoid overwriting higher existing
poison damage. Same rule for any status effect from multiple sources.

### Manual Spell Casting
Spells cast manually via spell bar UI (`Battle._castPlayerSpell`). Power-based cooldown
(3-10s via `Battle._spellCooldown`). Auto-fire triggers (`Spell.checkTriggers`) run
alongside manual casting — both call `Spell.fire`. New spell effects must work in both paths.

### Spell Bar UI
`#spellBar` is a flex container below battle canvas. Hidden when not on battle screen.
Spell buttons (`.spellBtn`) show icon, name, cooldown overlay (`.spellCD`). Re-renders from
`Battle.playerSpells` array (`{spec, cooldown, maxCD}`).

## Kill Attribution Rules

### All Damage Sources Must Set lastAttacker
Every code path that reduces HP must set `u.lastAttacker`:
- Direct melee attacks (`takeDamage`)
- Projectile hits (`updateProjectiles` — synth attacker with `id:p.owner`)
- Splash damage (`e.lastAttacker=attacker` for each splash target)
- Thorns reflect (`attacker.lastAttacker=target`)
- Poison ticks (lastAttacker set when poison applied, not each tick)
- Arena mechanics (environment kills pass `null` — `onUnitDeath` handles gracefully)

Without `lastAttacker`: ramp bonus, on_kill trigger, kill count, MVP, battle stats, kill feed
all break.

### onUnitDeath Death Detection
`onUnitDeath(u)` called once when `u.h<=0 && u.deathT===undefined`. Sets `u.deathT=0` to
prevent double-calling. Arena mechanics call it directly (setting `deathT=0`).

## Ability Trigger Rules

- `on_first_hit` only on actual damage — `hasBeenHit` set true only when damage applied.
  Dodge and shield paths return early, do NOT set `hasBeenHit`.
- Cooldown cap at zero — use `Math.max(0, u.abCool - dt)`, never `u.abCool -= dt`.
- Minion spawn limit — `spawn` ability checks `this.units.length < 100`.
- `on_death`, `on_kill`, `on_spawn` handled in `onUnitDeath()`. `on_spawn` sets
  `spawnTriggered=true` after firing.

## Unit Avoidance System

### Soft Avoidance (Movement-Time)
`avoidanceOffset(u, allies, radius=28)` — repulsion vector pushing `u` away from nearby
allies. Called in `Battle.act()` after `MOVEMENT[u.movement]()`. Push strength falls off
linearly (full at 0, zero at radius). Scaled by `effSpeed(u) * 0.4` (capped at 40% of speed).
Only considers allies (same team).

### Hard Separation (Post-Movement)
`Battle.separate(all)` — runs after all units moved. Pushes overlapping units apart with
minimum distance `Math.max(a.z, b.z) * 1.8` (~18px for z=10). The 1.8× matches sprite scale.

### Tuning
Clumping: increase avoidance radius (28) or push cap (0.4).
Jittery: decrease radius or push cap. Hard separation multiplier (1.8) should match sprite scale.

## Weapon Attachment System

### Grip-Relative Coordinates
`WEAPONS` defines shapes using grip-relative coordinates (drawn relative to grip point, not
shoulder). Each entry has: `shape`, `parentJoint`, `parentPivot` (shoulder position),
`gripOffset` (hand position relative to shoulder), `grip` (grip point in shape-local space).

### RecipeAssembler Attachment
`RecipeAssembler.build` attaches weapons by translating shape from shoulder (`parentPivot`)
to grip point (`parentPivot + gripOffset`). Weapon inherits parent joint's animation.
`scaleShape` must scale `parentPivot`, `gripOffset`, `grip`, `jointRange`.

### Enemy Facing
Enemy sprites are mirrored via `c.scale(-1,1)` after the sprite scale factor. Weapon shapes
flip correctly because they're in the same transform stack.

### Bow String Animation
Bow weapons have a `grip` point. `drawShapeRaw` draws a string line from `parentPivot` to
`grip` when `weaponType==="bow"`. The string animates with `arm_raise` joint during attack.

### Stale Recipe Rebuild
`RecipeAssembler.build` caches the assembled recipe. If unit fields change (e.g., via forge),
call `RecipeAssembler.build` again to rebuild. The cache key is the unit's recipe reference.

## Targeting Functions

Team-level targeting functions (`lowest_hp`, `highest_hp`, `enemy_carry`, `enemy_support`,
`enemy_frontline`, `enemy_backline`, `enemy_cluster`) return the same result for all units
on the same team. `_getCachedTarget` caches per `(team, targetingKey)` per frame.
`_targetCache` is reset to `{}` at the start of each `update()`.

## Battle Timeout
Battle ends as draw after 90s (prevents kite/flee standoffs). Winner determined by total HP.

## Determinism Rules (DET)

### DMath — Deterministic Math
All sim-state-affecting math must use `DMath.*` instead of `Math.*`:
- `DMath.sqrt(x)` — Newton-Raphson, deterministic (replaces `Math.sqrt`)
- `DMath.sin(x)` / `DMath.cos(x)` — 1024-entry lookup table (replaces `Math.sin`/`Math.cos`)
- `DMath.hypot(dx,dy)` — uses `DMath.sqrt` (replaces `Math.hypot`)

`Math.*` is still fine for UI/render-only code (canvas transforms, particle FX, toast).

### Seeded PRNG — rand/randRange
All sim-state-affecting randomness must use `rand()`/`randRange(a,b)` instead of `R()`/`Q()`:
- `rand()` — deterministic LCG PRNG seeded by `seedBattle(seed)`
- `randRange(a,b)` — `a + rand() * (b-a)` (replaces `Q(a,b)`)
- `randInt(a,b)` — `a + Math.floor(rand() * (b-a))` (replaces `R(a,b)`)

`R()`/`Q()`/`Math.random()` are fine for UI-only randomness (particle FX, toast, etc).

### Fixed Timestep
`Battle.update(dt)` always receives `FIXED_DT = 1/60`. The accumulator in `Battle.loop()`
drains real frame time (×speed) into fixed steps. Max 4 steps per frame. Never pass
variable dt to `update()`. Render interpolation uses `_lastDt` (real frame time).

### Lockstep Commands
Spell casts, speed changes, and pauses queue via `queueCommand(cmd, targetTick)` and
transmit via `cmd_lock`. Both peers execute at the same tick. `LOCKSTEP_DELAY=3` ticks.
`executeCommands(tick)` runs at the top of `update()`, before sim logic.
