# Architecture

Prompt Showdown is a single-file auto-battler (`index.html`, ~7000 lines) with AI unit generation, P2P multiplayer, and progression. This document covers all major systems.

## Table of Contents

1. [File Structure](#file-structure)
2. [CSS & UI](#css--ui)
3. [Screens](#screens)
4. [Game Objects](#game-objects)
5. [LLM Unit Generation](#llm-unit-generation)
6. [P2P Multiplayer Protocol](#p2p-multiplayer-protocol)
7. [Draft System](#draft-system)
8. [Battle System](#battle-system)
9. [Behaviour Composition API](#behaviour-composition-api)
10. [Sprite Rendering](#sprite-rendering)
11. [Battle FX](#battle-fx)
12. [Progression System](#progression-system)
13. [Save System](#save-system)
14. [Configuration Constants](#configuration-constants)
15. [Vendored Dependencies](#vendored-dependencies)

---

## File Structure

```
index.html          ~7000 lines, single file
├── CSS             lines 11-99    (CSS variables, components, screens, spell bar)
├── HTML            lines 101-243  (10 screens + splash + error panel)
└── JavaScript      lines 245-6900 (ES module, all game logic)
    ├── Imports     lines 245-284  (web-llm, trystero, lz-string)
    ├── Save        lines 285-410  (loadData, saveData, migration)
    ├── Unit        lines 416-442  (unit() factory, cloneUnit)
    ├── LLM Init    lines 443-559  (WebGPU detection, model load, cancel)
    ├── LLM Gen     lines 560-698  (color maps, schema, validation rules, descriptions)
    ├── Recipes     lines 699-905  (assembler, template fallback, P2P serialization)
    ├── LLM Cache   lines 906-1233 (IndexedDB, field generation, unit generation)
    ├── Networking  lines 1234-1433 (Trystero, message protocol, disconnect)
    ├── Behaviour   lines 1434-1612 (targeting, movement, abilities, Match)
    ├── Spells      lines 3790-4040 (Spell.fire, triggers, zones, targets, shapes, effects)
    ├── Sprites     lines 1613-1770 (SpriteRenderer, joints, animations, patterns)
    ├── Battle FX   lines 1774-1914 (particles, hit flashes, screen shake)
    ├── Battle      lines 1915-5000 (simulation, rendering, spell bar, snapshots)
    ├── Bot         lines 2464-2604 (bot opponent, sprite recipes)
    ├── Game (G)    lines 2605-6900 (screens, progression, forge, deck)
    └── Exports     lines 6800-6900 (window globals, PWA, event listeners)
```

---

## CSS & UI

### Design System (lines 13-25)

CSS variables define the palette (purple/gold Draft Showdown style):

| Variable | Value | Usage |
|----------|-------|-------|
| `--bg` | `#0a0e1a` | Background gradient start |
| `--bg2` | `#141b2e` | Background gradient end |
| `--card` | `#1c2640` | Card/panel background |
| `--card2` | `#283656` | Hover background |
| `--border` | `#3a4a6e` | Borders |
| `--text` | `#f0f4ff` | Primary text |
| `--muted` | `#94a3c4` | Secondary text |
| `--accent` | `#7c3aed` | Purple (buttons, highlights) |
| `--accent2` | `#a78bfa` | Light purple |
| `--gold` | `#fbbf24` | Gold (title gradient, level badges) |
| `--ok` | `#34d399` | Emerald (success, selected) |
| `--warn` | `#fbbf24` | Amber (warnings) |
| `--danger` | `#fb7185` | Red (destructive actions) |
| `--rare` | `#60a5fa` | Blue (rare rarity) |
| `--legendary` | `#fbbf24` | Gold (legendary rarity) |
| `--epic` | `#c084fc` | Purple (epic rarity) |

### Components

- **Buttons** (`.btn`): Full-width, gradient background, rounded 10px, hover lift with glow shadow, text shadows
- **Cards** (`.card`): Gradient background with inner highlight, rounded 10px, soft shadow, hover lift with accent glow, rarity-based glow
- **Spell buttons** (`.spellBtn`): Purple gradient, cooldown overlay with countdown number, icon + name
- **Pills** (`.pill`): Rounded 20px badges for stats
- **Inputs** (`.input`, `#forgePrompt`): Rounded, focus border highlight
- **Screen transitions**: Fade-in + slide-up animation (`@keyframes fadeIn`)
- **Title**: Gold-to-purple gradient text with glow

---

## Screens

### Menu (`#menu`, lines 106-123)
Main hub. Shows stats pills (wins, level, coins, AI units, network status), arena badge, and navigation buttons (Fight, Forge, Deck, Upgrade, Reset).

### Matchmaking (`#matchmaking`, lines 125-130)
Spinner + status text while searching for P2P opponent. Falls back to bot match after 15s timeout.

### Lobby (`#lobby`, lines 132-142)
Manual P2P room configuration. Room ID input, Host/Join buttons, connection status.

### Draft (`#draft`, lines 144-154)
Pick 1 unit per draw (3 draws, or 4 with comeback bonus). Shows lives HUD, progress dots, comeback banner, draft cards, reroll button (3 per match).

### Scout (`#scout`, lines 156-162)
Preview opponent's picks with sprite previews before battle.

### Battle (`#battle`, lines 164-180)
Canvas-based combat. HUD shows lives, HP counts, turn counter. Spell bar below canvas shows clickable spell buttons with cooldown overlays. Controls: Tick (manual advance), Auto (play continuously), Skip (forfeit). Battle log overlay.

### Result (`#result`, lines 180-192)
Round outcome with title, lives display, match hint, rewards (XP + coins), Next Round / Menu buttons.

### Forge (`#forge`, lines 194-215)
AI unit generation. Text prompt input, Watch Ad / Skip Ad buttons, model download progress bar with Cancel, sprite preview, Keep / Reroll buttons.

### Deck (`#deck`, lines 217-226)
Loadout management. 4 loadout slots with level badges, synergy meter (role balance), full collection with fusion (tap duplicates) and slot swapping.

### Upgrade (`#upgrade`, lines 228-234)
Spend coins to level up units (+10% HP/DMG per level). Shows cost and stat preview.

---

## Game Objects

### `G` (lines 2605-3717) — Main Game Controller

The central object that orchestrates all game flow.

**Properties:**
- `save` — Player save data (persisted to localStorage)
- `arenas` — 6-arena ladder configuration
- `base` — 6 starter units (Knight, Archer, Slash, Priest, Assassin, Engineer)
- `selected` — Current draft picks (3-4 units)
- `opponentPicks` — Enemy picks for scout screen
- `pendingForgeUnit` — Generated unit awaiting Keep/Reroll
- `roundDraftState` — Draft state machine `{drawIndex, picks, drawCount}`
- `rerolls` — Rerolls remaining (3 per match)

**Key methods:**
| Method | Purpose |
|--------|---------|
| `init()` | Initialize game, render menu, load save |
| `startMatchmaking()` | Begin P2P search, fallback to bot after 15s |
| `start()` | Begin match (draft → battle flow) |
| `forge()` / `forgeWithAd()` | AI unit generation flow |
| `deck()` | Loadout/collection management UI |
| `upgrade()` | Coin-based unit upgrade UI |
| `buildArmy()` | Convert selected picks to 9-unit army (3 copies each) |
| `showForgePreview(u)` | Render forged unit sprite + stats |
| `keepForge(u)` | Add forged unit to collection |
| `fuseUnit(name)` | Combine 2 duplicates → +1 level |
| `addToLoadout(name)` | Swap unit into loadout slot |
| `onMatchEnd(winner)` | Award XP/coins, update arena progress |

### `Match` (lines 1541-1612) — Match State Machine

**Properties:**
- `livesPlayer`, `livesEnemy` — Current lives (default 3)
- `round` — Current round number
- `history` — Array of completed round results
- `active` — Match active flag
- `deathLog` — Accumulated deaths for hints

**Key methods:**
| Method | Purpose |
|--------|---------|
| `start(lives, onMatchEnd)` | Initialize match |
| `startRound()` | Begin next round's draft |
| `onRoundEnd(winner)` | Handle round completion, decrement loser life |
| `comebackEligible()` | Check if loser gets 4th draw |
| `forfeit()` | Handle disconnect forfeit |

### `Battle` (lines 1916-2463) — Combat Simulation

**Properties:**
- `units` — Single array (player + enemy, distinguished by `team` field)
- `projectiles` — Ranged attack projectiles
- `particles` — FX particles (capped at 60)
- `shakeAmount` — Screen shake intensity
- `time` — Simulation time
- `running` — Active flag
- `winner` — Battle winner (null while ongoing)
- `canvasH` — Canvas height (550)
- `spells` — Auto-fire spell entries `{spec, team, fired, lastFire}`
- `zones` — Persistent spell zones
- `playerSpells` — Manually-castable player spells `{spec, cooldown, maxCD}`

**Key methods:**
| Method | Purpose |
|--------|---------|
| `initRuntime(u)` | Attach combat fields (cool, abCool, poison, slow, stun, animState) |
| `start(units, enemies, onEnd, spells)` | Initialize battle (spells separated into auto-fire + manual cast lists) |
| `loop(time)` | Main game loop (adaptive frame budget) |
| `update(dt)` | Simulation step (spells → status effects → movement → attacks → abilities → projectiles → collision) |
| `act(u, enemies, allies, dt)` | Unit AI via Behaviour Composition API |
| `attack(attacker, target, enemies)` | Melee/ranged attack logic |
| `triggerAbility(u, allies, enemies)` | Execute abilities |
| `updateProjectiles(dt)` | Move and collide projectiles |
| `separate(units)` | Collision separation |
| `render()` | Draw all units, projectiles, particles |
| `_renderSpellBar()` | Render clickable spell buttons with cooldown overlays |
| `_castPlayerSpell(idx)` | Cast a player spell manually (sets cooldown) |
| `fireSpell(spec, team)` | Fire a spell (wrapper around Spell.fire) |
| `_spellCooldown(spec)` | Compute cooldown based on effect power (3-10s) |
| `getSnapshot()` | Serialize state for P2P |
| `applySnapshot(s)` | Deserialize + fire FX from deltas (guest) |
| `renderOnly()` | Render without simulation (guest mode) |

### `Bot` (lines 2465-2502) — AI Opponent

**Properties:**
- `loadout` — 4 random units from arena's bot pool

**Key methods:**
| Method | Purpose |
|--------|---------|
| `generateLoadout(botPool)` | Create 4-unit loadout from pool |
| `draftRound(drawCount)` | Pick `drawCount` random cards from loadout |

### `SpriteRenderer` (lines 1613-1770) — Visual Recipe Interpreter

**Properties:**
- `JOINT_ANGLES` — Max rotation per joint (arm_raise: 90°, leg_swing: 30°, bow_draw: 45°, tail_wag: 20°)
- `ANIM_DURATIONS` — Duration per animation state (idle, walk, attack, dead)

**Key methods:**
| Method | Purpose |
|--------|---------|
| `interpolate(keyframes, t)` | Lerp between keyframes |
| `evalJoint(joint, val)` | Calculate rotation matrix for joint |
| `drawShape(c, shape, jointRot)` | Draw primitive with transform |
| `draw(c, u)` | Draw unit with recipe or role-coded fallback |
| `renderPreview(canvas, u)` | Render unit to small canvas (for cards) |

### `BattleFX` (lines 1774-1914) — Procedural FX System

State-derived FX system (particles, flashes, shake) that works for both host simulation and guest snapshot rendering.

**Key methods:**
| Method | Purpose |
|--------|---------|
| `burst(x, y, color, count, speed)` | Spawn particles |
| `onHit(u)` | Unit flashes white (80ms) |
| `onCrit(u)` | Gold flash + 6 particles + shake |
| `onDeath(u)` | 8 particles + shake (bigger for carries) |
| `onSpawn(u)` | Pop-in animation (scale 0→1, ease-out-back) |
| `onAttack(u, target)` | Lunge toward target (60ms) |
| `shake(amount)` | Screen shake with decay |
| `fireRecipeFx(u, target)` | Weapon-based FX (projectile trail, flash, burst) |

---

## LLM Unit Generation

### Overview

The forge uses a **per-field micro-prompt** approach: instead of asking the LLM for a complete JSON unit in one call, it asks for each field individually, building context as it goes. This produces more creative and coherent units than bulk generation.

### Model

- **Model**: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (via web-llm)
- **Runs in-browser** via WebGPU (Chrome/Edge desktop)
- **No API costs** — inference is 100% local
- **No max_tokens cap** — local inference is free
- Falls back to template generation when WebGPU is unavailable

### Field Order (lines 1165-1170)

Fields are queried in order, with each answer added to the context for subsequent prompts:

```
name → role → bodyPlan → weaponType → primaryColor → accentColor → sizeMod →
headFeature → backFeature → tailFeature → aura → eyeStyle → pattern → weaponStyle →
targeting → movement → ability → abilityTrigger → attackCondition →
hp → dmg → range → speed → moveSpeedMod
```

### Per-Field Prompts (lines 1112-1134)

Each field has a dedicated prompt function. Enum fields list shuffled options (to counter first-option bias). Stat fields provide role/weapon-based guidance.

**Example (role):**
```
What combat role fits this unit? frontline = durable tank that soaks damage.
carry = fragile damage dealer. support = heals or buffs allies.
counter = punishes enemy weaknesses. utility = flexible specialist.
Answer with one word.
```

**Example (hp, after role is known):**
```
How tough is this unit? Frontlines are tanks: 120-200 HP.
Carries are squishy: 15-60 HP. Pick any number 10-200 that fits.
```

### Enum Fields (lines 1077-1089)

| Field | Options | Count |
|-------|---------|-------|
| `role` | frontline, carry, support, counter, utility, assassin, bruiser | 7 |
| `targeting` | nearest, lowest_hp, enemy_carry, enemy_support, enemy_frontline, enemy_backline, lowest_ally, highest_hp_ally, random, self, taunt, random_ally, highest_hp_enemy | 13 |
| `movement` | chase, hold, kite, flee, patrol, hold_midpoint, blink, strafe | 8 |
| `attackCondition` | always, only_if_target_low, only_if_ally_near, only_if_safe, only_if_near_allies, only_if_far_from_enemies, only_if_target_high_hp | 7 |
| `abilityTrigger` | on_cooldown, on_low_hp, on_enemy_near, on_ally_damaged, on_death, on_spawn, passive, on_kill, periodic_3s, on_first_hit | 10 |
| `ability` | none, splash, heal, dodge, poison, explode, shield, spawn, lifesteal, rage, counter, heal_burst, thorns, blink_strike, frenzy, regen, cleanse, taunt, executioner, chain_lightning, slow | 21 |
| `bodyPlan` | humanoid, quadruped, dragon, serpent, bird, insect, crab, golem, ghost, fish, blob, flying, mechanical, structure, plant, undead, demon, beast-man, aquatic, monopod, centaur, hydra, elemental, aberration, ooze, crystal, construct, angel | 28 |
| `weaponType` | sword, bow, staff, dagger, claws, hammer, shield, breath, none, scythe, whip, spear, rifle, wand | 14 |
| `primaryColor` / `accentColor` | red, blue, green, purple, orange, cyan, pink, lime, gold, white, black, brown | 12 |
| `sizeMod` | small, medium, large | 3 |
| `headFeature` | none, helmet, horns, crown, hood, hat, antenna, frill, mask, eyepatch, tiara, beak | 12 |
| `backFeature` | none, wings, cape, spikes, shell, jetpack, wings_insect, wings_angel, tentacles, fins, crystal_growth | 11 |
| `tailFeature` | none, tail, tail_fluffy, tail_barbed, tail_split | 5 |
| `aura` | none, fire, frost, lightning, poison, holy, shadow, void, nature, blood, tech | 11 |
| `eyeStyle` | normal, glowing, visor, scar, star, cross, spiral, visor_red | 8 |
| `pattern` | none, stripes, spots, circuit, tribal, stars, hexagons, marble | 8 |
| `weaponStyle` | plain, engraved, glowing, rusted, crystal, bone, molten | 7 |

### Stat Fields (line 1090)

| Field | Min | Max |
|-------|-----|-----|
| `hp` | 10 | 200 |
| `dmg` | 5 | 50 |
| `range` | 30 | 250 |
| `speed` | 30 | 120 |
| `moveSpeedMod` | 50 | 150 |

### Generation Flow (lines 1185-1233)

```
generateUnit(prompt, arenaIndex)
  1. Check IndexedDB cache (key: modelId:prompt)
  2. Wait for LLM load if downloading (cancel support)
  3. If no LLM → templateFallback(prompt)
  4. For each field in FIELD_ORDER:
       a. Build context JSON from previously-decided fields
       b. System: "You are designing a game unit... So far: {context}"
       c. User: FIELD_PROMPTS[field](name, attrs)
       d. Parse answer, retry up to 2 times on invalid
  5. Semantic validation via CONSISTENCY_RULES
  6. Auto-fix flagged fields (cheaper than re-asking)
  7. Re-ask only flagged fields via targeted micro-prompts
  8. Build unit via attrsToUnit()
  9. Cache result in IndexedDB
```

### Caching (lines 1018-1073)

- **Database**: `promptshowdown_llm_cache_v8` (IndexedDB)
- **Store**: `unit_specs`
- **Key**: `modelId:prompt`
- 2-second guard timeout for hung opens
- Best-effort writes (silently fail if IndexedDB unavailable)

### Template Fallback (lines 886-905)

When LLM is unavailable, archetype templates are used (keyword-matched with ±20% param variation for variety).

---

## P2P Multiplayer Protocol

### Transport

- **Library**: Trystero v0.25.3 (vendored locally in `vendor/`)
- **Signaling**: WebTorrent trackers (wss://tracker.webtorrent.dev, wss://tracker.openwebtorrent.com, etc.)
- **No server needed** — pure WebRTC peer-to-peer

### Message Types (lines 1326-1338)

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `role` | both | `"host"` / `"guest"` | Role assignment |
| `request_deck` | host→guest | `{}` | Request guest's drafted units |
| `deck` | guest→host | `{selected: [units]}` | Guest sends deck |
| `snap` | host→guest | full battle state | 20Hz battle snapshot |
| `cmd` | guest→host | `{cmd: "tick"\|"auto"\|"skip"}` | Guest battle commands |
| `forge` | both | unit data | Share forged unit |
| `match_start` | host→guest | `{arena, lives, firstPlayer}` | Match initialization |
| `round_start` | host→guest | `{drawIndex, opponentPicks}` | New round |
| `opponent_picks` | host→guest | `{picks}` | Scout screen data |
| `round_end` | host→guest | `{winner, livesPlayer, livesEnemy}` | Round result |
| `match_end` | host→guest | `{winner}` | Match winner |
| `round_deck` | guest→host | `{picks}` | Guest's draft picks |

### Host-Authoritative Flow

```
1. Both players click FIGHT → join same queue room
2. First peer = host, second = guest (role messages exchanged)
3. Host sends match_start → both enter draft
4. Draft: host sends round_start, guest sends round_deck
5. Scout: host sends opponent_picks
6. Battle:
   - Host runs authoritative Battle simulation
   - Host broadcasts snap at 20Hz (units, projectiles, winner, recentCrits)
   - Guest calls applySnapshot() (derives FX from state deltas)
   - Guest can send cmd for manual tick/auto/skip
7. Round end: host sends round_end with winner + lives
8. Match end: host sends match_end with overall winner
```

### Snapshot System (lines 2396-2450)

**`getSnapshot()`** returns:
```javascript
{
  time: Battle.time,
  units: Battle.units,       // positions, HP, team, animation state
  projectiles: Battle.projectiles,
  winner: Battle.winner,
  recentCrits: Battle.recentCrits
}
```

**`applySnapshot(s)`** derives FX from state deltas:
- New unit → spawn FX
- HP decreased → hit flash
- Unit disappeared → death FX
- recentCrits → crit FX
- Winner transition → round-end flash + shake

### Serialization (lines 907-989)

- **`minifyRecipe()`**: Compresses recipe field names (~40% smaller: `shapes`→`s`, `circle`→`c`, etc.)
- **`serializeUnitsForPeer(units)`**: Starter units send name only; custom units send full data with minified recipe. Entire payload compressed with lz-string if available.
- **`deserializeUnitsFromPeer(data)`**: Decompresses, resolves starter names from `G.base`, expands minified recipes.

### Disconnect Handling (lines 1301-1323)

On mid-match disconnect, host sees a prompt:
- **Continue vs Bot** — swaps opponent to bot using last known loadout
- **Forfeit** — ends the match

---

## Draft System

### Rarity (lines 2972-2982)

- 70% common, 25% rare, 5% legendary
- Filters by rarity + excludes already-used names in current draw
- Falls back to any unit if rarity pool empty

### Rerolls (lines 2957-2968)

- 3 rerolls per match
- Re-rolls current offering without consuming a draw

### Comeback Bonus (lines 1599-1605, 2915-2917)

- If player lost the previous round, they get a 4th draw (★)
- Visual banner: "⭐ COMEBACK BONUS — 4th draw!"

---

## Battle System

### Simulation Loop (lines 1915-2463)

```
Battle.update(dt):
  1. Spell trigger checks (auto-fire) + zone ticking + player spell cooldown ticks
  2. Update status effects (poison damage, slow/stun timers)
  3. For each unit: act(u, enemies, allies, dt)
     a. Check attackCondition
     b. Move according to movement pattern
     c. Attack if in range and condition met
     d. Trigger ability if abilityTrigger met
  4. Update projectiles (move, collide, deal damage)
  5. Collision separation (prevent overlapping)
  6. Check for winner (one team eliminated)
  7. Update FX (particles, flashes, shake decay)
  8. Re-render spell bar (~4fps throttled)
```

### Unit Runtime Fields (lines 1938-1966)

Attached by `initRuntime(u)`, not persisted:
- `cool` — Attack cooldown timer
- `abCool` — Ability cooldown timer
- `poison` — Poison stacks + timer
- `slow` — Slow timer
- `stun` — Stun timer
- `animState` — Current animation (idle/walk/attack/dead)
- `animTime` — Time in current animation
- `flash` — Hit flash timer
- `lunge` — Attack lunge offset

### Combat

- **Ranged threshold**: Units with range > 80 fire projectiles; others melee
- **Crits**: `crit` chance (0-1) deals 2x damage + gold FX
- **Abilities**: 21 abilities (splash, heal, dodge, poison, explode, shield, spawn, lifesteal, rage, counter, heal_burst, thorns, blink_strike, frenzy, regen, cleanse, taunt, executioner, chain_lightning, slow, none)
- **Status effects**: Poison (DoT), Slow (reduced move speed), Stun (can't act)
- **Spells**: Auto-fire (trigger-based) + manual cast via spell bar UI with cooldowns

### Spell System

Spells are special draftable cards (30% chance from spellbook) that can be cast during battle:

- **Auto-fire**: Each spell has a trigger (`battle_start`, `on_first_contact`, `delayed_3s`, `when_ally_hurt`, `periodic_5s`) that fires it automatically
- **Manual cast**: Player can tap spell buttons in the spell bar to cast on demand
- **Cooldowns**: Manual casts have power-based cooldowns (3-10s depending on effect)
- **Targets**: 13 target types (enemy_cluster, enemy_frontline, enemy_backline, enemy_carry, lowest_hp_enemy, highest_hp_enemy, random_enemy, center, ally_cluster, lowest_ally)
- **Shapes**: circle_aoe, line, cone, point, persistent_zone
- **Effects**: damage, damage_over_time, slow, stun, heal_allies, shield_allies, buff_dmg, buff_speed, summon
- **FX types**: explosion, frost, lightning, poison_cloud, heal_glow, shockwave, fire_wall
- **Persistent zones**: Tick once per second, apply effect to units within radius

---

## Behaviour Composition API

Units are controlled by 5 composable enum fields that determine their AI without scripting:

### Targeting (who to attack)
`nearest`, `lowest_hp`, `enemy_carry`, `enemy_support`, `enemy_frontline`, `enemy_backline`, `lowest_ally` (for healers), `highest_hp_ally`, `random`, `self`, `taunt` (force enemies to target this unit), `random_ally`, `highest_hp_enemy`

### Movement (how to position)
`chase` (pursue nearest enemy), `hold` (stay near spawn), `kite` (maintain range), `flee` (run from enemies), `patrol` (move toward enemy side), `hold_midpoint` (hold center), `blink` (teleport toward target), `strafe` (weaving approach)

### Attack Condition (when to attack)
`always`, `only_if_target_low` (execute low-HP targets), `only_if_ally_near` (safety in numbers), `only_if_safe` (no enemies near), `only_if_near_allies`, `only_if_far_from_enemies`, `only_if_target_high_hp`

### Ability Trigger (when to use ability)
`on_cooldown`, `on_low_hp`, `on_enemy_near`, `on_ally_damaged`, `on_death`, `on_spawn`, `passive`, `on_kill`, `periodic_3s`, `on_first_hit`

### Role (archetype classification)
`frontline` (durable tank), `carry` (fragile damage dealer), `support` (healer/buffer), `counter` (ambush predator), `utility` (versatile specialist), `assassin` (burst damage), `bruiser` (hybrid fighter)

---

## Sprite Rendering

### Body Plans (lines 700-800)

28 body plans, each defining a set of shape primitives with joint attachments:

| Plan | Shapes | Joints |
|------|--------|--------|
| humanoid | head, body, 2 arms, 2 legs | arm_raise, leg_swing |
| quadruped | head, body, 4 legs, tail | leg_swing, tail_wag |
| dragon | head, body, wings, tail | wing_flap, tail_wag |
| serpent | head, body segments | body_wave |
| bird | body, wings, beak | wing_flap |
| insect | body, 6 legs, antennae | leg_swing |
| crab | shell, 8 legs, claws | leg_swing |
| golem | head, body, arms, legs | arm_raise, leg_swing |
| ghost | body, arms | float |
| fish | body, fins, tail | tail_wag |
| blob | body, eyes | bounce |
| flying | body, wings | wing_flap |
| mechanical | body, treads, turret | turret_rotate |
| structure | base, tower | none |
| plant | stem, leaves, flower | sway |
| undead | head, body, arms | arm_raise |
| demon | head, body, horns, wings | wing_flap |
| beast-man | head, body, arms, legs, tail | arm_raise, leg_swing, tail_wag |
| aquatic | body, fins | fin_wave |
| monopod | body, 1 leg | bounce |
| centaur | upper body, lower body, 4 legs | arm_raise, leg_swing |
| hydra | body, 3 heads, tail | head_weave, tail_wag |
| elemental | body, aura particles | pulse |
| aberration | body, tentacles | tentacle_wave |
| ooze | body, drips | wobble |
| crystal | body, facets | shimmer |
| construct | body, gears | gear_rotate |
| angel | body, wings, halo | wing_flap |

### Weapons (lines 800-830)

14 weapons, each adding a shape to the right arm:
- sword (line), bow (arc), staff (line + orb), dagger (short line), claws (lines), hammer (rect), shield (arc), breath (particles), scythe (curved line), whip (segmented line), spear (long line), rifle (rect + barrel), wand (short line + spark), none

### Visual Modifiers

7 visual modifier categories give the LLM more creative freedom:
- **headFeature** (12 options): helmet, horns, crown, hood, hat, antenna, frill, mask, eyepatch, tiara, beak
- **backFeature** (11 options): wings, cape, spikes, shell, jetpack, wings_insect, wings_angel, tentacles, fins, crystal_growth
- **tailFeature** (5 options): tail, tail_fluffy, tail_barbed, tail_split
- **aura** (11 options): fire, frost, lightning, poison, holy, shadow, void, nature, blood, tech
- **eyeStyle** (8 options): glowing, visor, scar, star, cross, spiral, visor_red
- **pattern** (8 options): stripes, spots, circuit, tribal, stars, hexagons, marble
- **weaponStyle** (7 options): engraved, glowing, rusted, crystal, bone, molten

### Shape Primitives

| Type | Fields |
|------|--------|
| `circle` | cx, cy, r, c |
| `rect` | x, y, w, h, c |
| `line` | x1, y1, x2, y2, c, w |
| `arc` | cx, cy, r, start, end, c, w |
| `poly` | pts (array), c |

### Joints & Animation (lines 1613-1770)

- **Joints**: arm_raise (90°), leg_swing (30°), bow_draw (45°), tail_wag (20°), wing_flap (60°)
- **Animation states**: idle (subtle sway), walk (leg swing), attack (arm raise + lunge), dead (fall over)
- **Interpolation**: Keyframe-based lerping between animation states

### Recipe Assembler (lines 845-866)

`RecipeAssembler.build(attrs)` assembles a visual recipe from:
- Body plan template (based on `bodyPlan` field — 28 body plans)
- Weapon overlay (based on `weaponType` field — 14 weapons)
- Color substitution (`primaryColor`, `accentColor`)
- Size scaling (`sizeMod`)
- Visual modifiers: `headFeature`, `backFeature`, `tailFeature`, `aura`, `eyeStyle`, `pattern`, `weaponStyle`
- Pattern rendering: stripes, spots, circuit, tribal, stars, hexagons, marble

### Description Maps

The game includes human-readable descriptions for all enum fields, shown in the unit detail modal and forge preview:

| Map | Covers | Count |
|-----|--------|-------|
| `ABILITY_DESCRIPTIONS` | All abilities | 21 |
| `MOVEMENT_DESCRIPTIONS` | All movement types | 8 |
| `TARGETING_DESCRIPTIONS` | All targeting options | 13 |
| `TRIGGER_DESCRIPTIONS` | All ability triggers | 10 |
| `WEAPON_DESCRIPTIONS` | All weapon types | 14 |

---

## Battle FX

### Particle System (lines 1774-1914)

- Capped at 60 particles for performance
- Particles have position, velocity, color, life, size
- Spawned on hits, crits, deaths, abilities

### State-Derived FX

FX are derived from state changes, not events. This means:
- **Host**: FX fire from simulation events (attack, hit, death)
- **Guest**: FX fire from snapshot deltas (HP decreased → hit flash, unit removed → death FX)
- Both host and guest see the same visual effects

### Screen Shake

- Triggered on crits, deaths, round ends
- Exponential decay
- Larger shake for carry deaths

---

## Progression System

### XP & Levels (lines 2635-2650)

- Win a round → +10 XP, +5 coins
- Win a match → +50 XP, +20 coins
- Level up at 100 XP per level
- Level unlocks new arenas

### Coins

- Earned from match wins
- Spent on unit upgrades (30 coins per level)

### Unit Upgrades (lines 3630-3680)

- +10% HP and DMG per level
- Cost: 30 coins per level
- Upgrades stored in `save.upgrades[unitName] = level`

### Fusion (lines 3540-3570)

- 2 duplicates of same unit → fuse for +1 level
- Tap a duplicate in collection to fuse

### Arenas (lines 2610-2633)

6 arenas with increasing difficulty:

| Arena | Lives | Bot Pool |
|-------|-------|----------|
| Training Yard | 3 | 6 starter units |
| District Z | 3 | + Plague, Cultist |
| Shadow Realm | 4 | + Berserker, Vamp |
| Inferno | 4 | + Bomber, Shielder |
| Crystal Citadel | 5 | + Healer, Tank |
| The Void | 5 | All units |

---

## Save System

### Storage (lines 285-410)

- **`loadData()`**: Reads from `localStorage`, parses JSON, migrates old versions
- **`saveData(s)`**: Writes to localStorage as JSON
- **Key**: `promptshowdown_v7`

### Save Schema

```javascript
{
  version: 7,
  wins: 0,
  level: 1,
  xp: 0,
  coins: 0,
  arena: 0,              // current arena index
  loadout: ["Knight","Archer","Slash","Priest"],
  collection: [],         // forged units (max 50)
  ai: [],                 // backward-compat forge storage
  upgrades: {},           // {unitName: level}
  forgeCount: 0,
  roleWins: {}            // {role: count} for achievements
}
```

### Migration (lines 373-405)

- Current version: 7
- On load: if `s.version < 7`, add missing fields
- Fields added over time: `forgeCount`, `roleWins`, `collection`, etc.

---

## Configuration Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `DEFAULT_LIVES` | 3 | line 1543 | Default lives per match |
| `RANGED_THRESHOLD` | 80 | line 1920 | Range above which units fire projectiles |
| `MAX_PARTICLES` | 60 | line 1773 | Particle cap for performance |
| `MODEL` | `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | line 456 | Web-LLM model ID |
| `CACHE_DB` | `promptshowdown_llm_cache_v8` | line 1018 | IndexedDB database name |
| `SAVE_KEY` | `promptshowdown_v7` | line 287 | localStorage key |
| Rarity weights | 70/25/5 | line 2976 | Common/rare/legendary probabilities |

---

## Vendored Dependencies

### `vendor/core.mjs` (~50KB)
- **Source**: @trystero-p2p/core@0.25.3 via esm.sh
- **Purpose**: Trystero P2P core (WebRTC, room management, actions)
- **Why vendored**: esm.sh had intermittent `ERR_CONNECTION_CLOSED` in browsers; local file is reliable

### `vendor/torrent.mjs` (~4KB)
- **Source**: @trystero-p2p/torrent@0.25.3 via esm.sh
- **Purpose**: BitTorrent tracker signaling for P2P room discovery
- **Import**: `import { joinRoom } from "./vendor/torrent.mjs"`
- **Default trackers**: wss://tracker.webtorrent.dev, wss://tracker.openwebtorrent.com, wss://tracker.btorrent.xyz, wss://open.ftorrent.com, wss://tracker.files.fm:7073/announce

### `vendor/lz-string.mjs` (~6KB)
- **Source**: lz-string@1.5.0 via esm.sh
- **Purpose**: Compress P2P unit payloads (~40% bandwidth savings)
- **Import**: `import { LZString } from "./vendor/lz-string.mjs"`

### Runtime Dependencies (loaded from CDN)

- **web-llm**: `https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm` — LLM inference engine
- **Qwen2.5-1.5B model**: Downloaded by web-llm on first use, cached in IndexedDB
