# Prompt Showdown — Tier 3: Depth & Infinite Spells

**Status: PLANNED (not yet implemented)**

Tier 1 (Draft Showdown clone) and Tier 2 (LLM unit forge) are complete per `PLAN.md`. This doc plans the next layer: closing the game-design gaps surfaced by auditing the current `index.html` against the real Draft Showdown (per the beginner guide / tier list research), and — the headline — **extending the LLM forge from units to spells, giving infinite spell variety from the same 0.5B model + grammar-sampler pipeline already built.**

All line numbers reference `index.html` as of commit `ee3914d` + the uncommitted LLM-cancel WIP. Single-file architecture preserved. No new dependencies.

> **⚠️ Tooling rule (very important):** Never use the `chrome-devtools` MCP server for smoke tests or any browser automation. **Always use the `playwright` MCP server instead.** This applies to every phase in this plan and to all future work on this project. chrome-devtools is explicitly forbidden.

> **⚠️ LLM usage rule (very important):** LLM inference is **free** (runs locally via WebLLM, no API costs). **Never limit tokens, never cap daily forges, never throttle generation.** Take full advantage of the model:
> - Do **not** set `max_tokens` on any `chat.completions.create` call — let the model use its full output budget. (The current code already omits it; keep it that way. The `max_tokens:300` / `max_tokens:32` values in `PLAN.md` are obsolete — do not reintroduce them.)
> - Remove the **daily forge cap of 5** (`save.forgeCount`, line 3314-3327, 3446-3447). Forging is gated by watching an ad, not by an artificial count. If ad fatigue is a concern, surface it via analytics and address it with UX, not a hard cap.
> - Prefer **richer prompts and multi-call generation** over cramped single calls. If a feature needs 3 LLM calls to produce great output, do 3 calls — the ad hides the latency and there's no cost penalty.
> - Do **not** add timeouts to LLM calls. The user-driven Cancel button (already implemented) is the only escape hatch.

---

## Why this tier exists

Research findings (real Draft Showdown):

1. **The defining unit is a "ramp carry"** — Merlinor, a backline DPS that *scales* and "wipes teams alone if protected." Our carries (Archer, Plague) are flat DPS. There is no unit that rewards the "build a frontline to protect your carry" fantasy that the entire beginner meta revolves around.
2. **Scout → counter is meaningless against the bot.** `Bot.draftRound` (line 2393) picks randomly from its loadout. The plan explicitly accepted this, but it makes the scout screen decorative — the bot has no strategy to read or react to.
3. **No spatial skill.** `_buildArmyFromPicks` (line 2897) scatters every unit randomly in the y-band. Real Draft Showdown's whole skill is frontline-in-front, carries-in-back. Our "frontline protects backline" synergy is purely behavioural, not positional.
4. **No spells.** TNT (AoE burst) and Waster (hazard zone) are referenced constantly in the beginner guide as counterplay tools. We have only units. Spells are also the cleanest vehicle for the LLM forge to produce *infinite* content — a spell spec is even smaller than a unit spec, so a 0.5B model with grammar sampling can reliably fill it.

---

## Tier Structure

| Phase | What it delivers | Dependency | Risk |
|---|---|---|---|
| **20** | Ramp carry ability + Wizard starter unit | None | Low — additive |
| **21** | Bot role-fill strategy (frontline+carry guaranteed) | None | Low — bot-only |
| **22** | Role-based formation positioning in army build | None | Medium — touches army build + P2P snapshot |
| **23** | Spell system + LLM spell forge (infinite spells) | Phase 22 (positioning matters for spell targeting) | Medium — new card type + LLM schema |

**Implementation order:** 20 → 21 → 22 → 23. Phases 20-22 are independent enough to ship in any order, but 23's spell targeting (cluster/backline/frontline) only becomes meaningful once Phase 22 makes those spatial concepts real. Each phase ships with a Playwright smoke test (never chrome-devtools — see tooling rule above) and its own commit.

---

## Phase 20 — Ramp Carry + Wizard Starter ✅ DONE

**Why:** Deliver the "protect your scaling carry" fantasy that the real game's meta is built around. Without a ramp unit, the frontline/protect synergy has no payoff — tanks protect nothing.

### Changes

1. **New ability: `ramp`.** Passive (joins `PASSIVE_ABILITIES`). Effect: the unit's `d` increases by a percentage each time it lands a kill. Implementation:
   - Add `"ramp"` to `ABILITY_OPTS` (line 1372).
   - Add `"ramp"` to `PASSIVE_ABILITIES` (line 1374).
   - In `Battle.takeDamage` (line 2028), after a target dies from this attack: if `attacker.ability==="ramp"`, `attacker.d = Math.round(attacker.d * 1.15)` (cap the multiplier at 3× base via `attacker.baseD` stored at `initRuntime`).
   - `initRuntime` (line 1869): store `u.baseD = u.d` for the ramp cap.
   - FX: `BattleFX.onKill(attacker)` — a small golden particle burst + brief size pulse so the ramp is *visible* (the "Merlinor getting scary" feedback loop).
2. **New starter unit: `Wizard` (Merlinor-equivalent).** Added to `G.base` (line 2523). Stats tuned to be a fragile ramp carry:
   ```
   {n:"Wizard", h:50, d:14, r:160, s:55, a:1.3, c:"#bb44ff", ability:"ramp", rar:"legendary", cost:4, crit:0.10,
    targeting:"closest", movement:"kite", attackCondition:"always", abilityTrigger:"never", moveSpeedMod:90,
    role:"carry", weaponType:"staff", recipe:SPRITE_RECIPES.Wizard}
   ```
   - Ranged (r>80 → projectile), kites, ramps on kill. Low base dmg (14) but scales to 42 at 3× cap. Fragile (50 HP) — dies instantly to a diver if unprotected. This is the unit the frontline exists to protect.
   - Add `SPRITE_RECIPES.Wizard` (line 2408): robe body, staff with `staff_raise` joint, hat (triangle), purple palette. Reuse the Priest staff animation channel.
3. **Add `ramp` to the LLM schema + enums** so forged units can also be ramp carries:
   - `UNIT_SCHEMA.ability.enum` (line 584) — add `"ramp"`.
   - `generateUnit` prompt enum list (line 1111) — add `ramp`.
   - `CONSISTENCY_RULES` (line 612): ramp is passive → `abilityTrigger` must be `"never"` (add a rule mirroring the lifesteal/rage line 622).
4. **Default loadout update:** swap `Priest` → `Wizard` in `save.loadout` default (line 2580) and the migration fallback (line 348), so new players meet the ramp fantasy immediately. Keep Priest in the roster as a draftable/support pick.

### Code touchpoints
- `ABILITY_OPTS` / `PASSIVE_ABILITIES` (1372-1375)
- `Battle.takeDamage` (2028-2065) — ramp-on-kill hook
- `Battle.initRuntime` (1869-1897) — `baseD`
- `BattleFX` (1705+) — `onKill`
- `G.base` (2523-2559) — Wizard entry
- `SPRITE_RECIPES` (2408+) — Wizard recipe
- `UNIT_SCHEMA` (570-592) + `generateUnit` prompt (1104-1117) + `CONSISTENCY_RULES` (612-634)
- `migrateSave` loadout default (336-348) + `G.init` (2580)

### Smoke test
Forge is in test mode (`TESTING_FORGE=true`). Start a bot match with Wizard in loadout → verify Wizard kites, deals ~14 dmg, and after 2-3 kills its damage visibly climbs (log + golden FX). Verify a Wizard with no frontline dies fast to an Assassin diver. Verify forging "a scaling mage" via LLM produces a unit with `ability:"ramp"`.

### Risks
| Risk | Mitigation |
|---|---|
| Ramp snowballs unbeatably | Cap at 3× base; ramp carries are 50 HP (one-shottable by divers). Counter-play is the Assassin, which already exists. |
| LLM picks ramp too often | `CONSISTENCY_RULES` flags ramp on non-carry roles; semantic fallback re-asks. Rarity weight in forge can bias against it. |

---

## Phase 21 — Bot Role-Fill Strategy ✅ PLANNED

**Why:** Make the scout screen meaningful. Today `Bot.draftRound` (line 2393) picks randomly — scouting it tells you nothing. A role-fill bot guarantees a frontline + a carry, so the player can scout "they have a tank and a ramp carry → I should pick Assassin" and have that *mean* something.

### Changes

1. **New `BotStrategy` object** (sibling of `Bot`, ~line 2403). Pure functions, no state.
   ```
   const BotStrategy={
     // Returns a sorted pick list for one draw slot, given current picks + pool.
     // Priority: 1) fill missing frontline, 2) fill missing carry,
     //            3) counter-pick if player scouted a ramp carry → Assassin,
     //            4) role-fill support/utility, 5) random from remaining.
     pickDraw(currentPicks, pool, scoutedPlayerPicks){
       const roles=currentPicks.map(p=>p.role);
       const missing=this.missingRoles(roles);
       if(missing.includes("frontline"))return this.firstOfRole(pool,"frontline");
       if(missing.includes("carry"))return this.firstOfRole(pool,"carry");
       if(scoutedPlayerPicks?.some(p=>p.ability==="ramp") &&
          !roles.includes("counter"))return this.firstOfRole(pool,"counter");
       if(missing.length)return this.firstOfRole(pool,missing[0]);
       return pool[F(R()*pool.length)];
     },
     missingRoles(roles){
       const want=["frontline","carry"]; // must-haves
       return want.filter(r=>!roles.includes(r));
     },
     firstOfRole(pool,role){return pool.find(u=>u.role===role)||pool[0];}
   };
   ```
2. **Rewrite `Bot.draftRound`** (line 2393) to call `BotStrategy.pickDraw` per draw, passing the bot's loadout as the pool and (optionally) `G.opponentPicks` from the *previous* round as the scout intel for counter-picking. First round has no intel → pure role-fill. Later rounds can counter-pick.
3. **Bot loadout generation** (`Bot.generateLoadout`, line 2373) — bias the random 4-pick so the pool *contains* at least one frontline and one carry (re-roll if missing). Otherwise role-fill would have nothing to fill with.
4. **No change to bot combat behaviour** — units still fight via `Battle.act`. Only the *draft* becomes strategic. This keeps the bot "feels like a casual human" (per the plan's risk note) — it builds sensible comps, doesn't play tactically mid-fight.

### Code touchpoints
- New `BotStrategy` object (~2403)
- `Bot.draftRound` (2393-2402)
- `Bot.generateLoadout` (2373-2389)
- `G.generateScoutPicks` (2949-2958) — pass previous-round player picks to bot for counter intel (store `Match.history` + player picks per round)

### Smoke test
Start 5 bot matches in Training Yard → scout each → verify every bot army has ≥1 frontline and ≥1 carry. Pick Wizard (ramp) round 1 → round 2 scout should show the bot picked a counter (Assassin/Cultist) if its pool contains one. Confirm bot is still beatable.

### Risks
| Risk | Mitigation |
|---|---|
| Bot becomes too hard | No combat-AI change — only draft composition. Bot still doesn't kite optimally or focus-fire. Difficulty stays "casual human." |
| Bot pool lacks a role → infinite loop | `firstOfRole` falls back to `pool[0]`; `generateLoadout` guarantees frontline+carry in pool. |
| Counter-pick feels like the bot cheats | Only counter-picks based on *scouted* picks (which the player also sees). Symmetric intel — fair. |

---

## Phase 22 — Role-Based Formation Positioning ✅ PLANNED

**Why:** Make positioning a real skill. Today `_buildArmyFromPicks` (line 2897) places every unit at `Q(40,360)` x and `Q(yMin,yMax)` y, uniformly. Real Draft Showdown's entire depth is "frontline in front, carries in back, divers in mid." Without this, the frontline/protect synergy is purely behavioural luck.

### Changes

1. **Role → y-band mapping.** Player army spawns on the left, enemy on the right. y is down; "front" = low y (toward enemy). Define:
   ```
   const FORMATION_Y={
     frontline:   [40,140],   // front
     counter:     [120,260],  // mid (divers launch from here)
     utility:     [180,320],  // mid-back
     carry:       [280,420],  // back
     support:     [340,460]   // very back
   };
   ```
   Enemy army mirrors: frontline at high y (toward player), carries at low y. This makes "frontline protects backline" spatially true — a chase-diver must physically cross the frontline to reach the carry.
2. **Rewrite `_buildArmyFromPicks`** (line 2897) to read `pick.role` and place the 3 copies in that role's y-band. x stays in the team's half (`Q(40,160)` player / `Q(240,360)` enemy) with a small spread per copy. Falls back to the old random band if role is missing (defensive).
3. **`enemy_frontline` / `enemy_backline` targeting** (line 1384-1393) already compute y-based front/back — they become *correct* for the first time once formation is real. No change needed, just verify.
4. **P2P snapshot** — positions are already in the snapshot (`serializeUnitsForPeer` / `Battle.snapshot`). Guest sees the same formation. Verify the snapshot includes `x,y` (it does — units are spread with `{...u,x,y}`). No protocol change.
5. **Scout screen** (line 2960) — optionally render opponent picks in a mini formation preview (frontline front, carries back) instead of a flat row, so the player reads the formation at a glance. Nice-to-have, not required.

### Code touchpoints
- New `FORMATION_Y` const (~2897)
- `G._buildArmyFromPicks` (2897-2908) — role-based placement
- `G.buildArmy` / `buildArmyFromSelected` (2887-3007) — pass through
- Verify `TARGETING.enemy_frontline`/`enemy_backline` (1384-1393) behave correctly
- `G.showScout` (2960+) — optional formation preview

### Smoke test
Start a match with loadout [Knight, Wizard, Assassin, Priest]. Verify on the battle canvas: Knight (frontline) is at the top (front), Wizard (carry) + Priest (support) at the bottom (back), Assassin (counter) mid. Verify an enemy Assassin has to walk past the Knight to reach the Wizard. Verify `enemy_backline` targeting now reliably picks the Wizard. Verify P2P guest sees matching positions.

### Risks
| Risk | Mitigation |
|---|---|
| Fixed formation removes positioning skill | This *adds* skill — the loadout composition now determines formation, which the player chooses in the Deck screen. Future: manual positioning toggle. |
| Units clump in narrow bands → AoE too strong | Bands overlap (counter 120-260, utility 180-320) and x is spread `Q(40,160)`. Splash radius is 40px — catches ~2-3 units max, same as today. |
| Existing arena bot pools without roles break | All `G.base` units have `role` set (line 2524-2558). Forged units get role from LLM. Fallback to random band if role missing. |
| P2P recipe drop renders units at wrong pos | Positions are in the snapshot, not the recipe. Recipe drop only affects visuals. |

---

## Phase 23 — Spell System + LLM Spell Forge (Infinite Spells) ✅ PLANNED

**Why:** The headline. Draft Showdown's signature cards (TNT, Waster) are spells, not units — and a spell spec is *smaller* than a unit spec (no body plan, no weapon, no movement), so the existing 0.5B + grammar-sampler pipeline can produce infinite spell variety even more reliably than units. This is the differentiator that turns the LLM forge from "custom units" into "custom *content*."

### Design: Spell Composition API

Analogous to the Behaviour Composition API, but for one-shot battlefield effects. A spell is a card drafted like a unit, stored in the loadout like a unit, but instead of spawning a fighter it **fires once at a defined battle moment** and produces an area effect.

**5 composable enum fields + 3 numeric fields:**

| Field | Enum / range | Meaning |
|---|---|---|
| `trigger` | `battle_start` \| `on_first_contact` \| `delayed_3s` \| `when_ally_hurt` \| `periodic_5s` | When the spell fires |
| `target` | `enemy_cluster` \| `enemy_frontline` \| `enemy_backline` \| `enemy_carry` \| `lowest_hp_enemy` \| `highest_hp_enemy` \| `random_enemy` \| `center` \| `ally_cluster` \| `lowest_ally` | Where the effect lands |
| `effect` | `damage` \| `damage_over_time` \| `slow` \| `stun` \| `heal_allies` \| `shield_allies` \| `summon` \| `knockback` \| `buff_dmg` \| `buff_speed` | What it does |
| `shape` | `point` \| `circle_aoe` \| `line` \| `cone` \| `persistent_zone` | AoE geometry |
| `fxType` | `explosion` \| `frost` \| `lightning` \| `poison_cloud` \| `heal_glow` \| `shockwave` \| `fire_wall` | Visual (drives particles) |
| `magnitude` | int 10-80 | Damage / heal / buff amount |
| `radius` | int 30-120 | AoE radius (for circle/cone/zone) |
| `duration` | int 0-6 | Seconds (for DoT / persistent zone / buff) |

Combinations: 5 × 10 × 10 × 5 × 7 × (mag/rad/dur ranges) → **tens of thousands** of distinct spells from fields a 0.5B model fills trivially. TNT = `{trigger:battle_start, target:enemy_cluster, effect:damage, shape:circle_aoe, fxType:explosion, magnitude:40, radius:60, duration:0}`. Waster = `{trigger:battle_start, target:enemy_frontline, effect:damage_over_time, shape:persistent_zone, fxType:fire_wall, magnitude:8, radius:50, duration:5}`.

### Changes

1. **New `Spell` object** (sibling of `Battle`, ~line 1850). Owns spell execution:
   ```
   const Spell={
     // Resolve a spell spec into an effect at battle time.
     // team = "player"|"enemy" — which side cast it.
     fire(spec, team, battle){
       const targets = SPELL_TARGET[spec.target](team, battle);
       const affected = SPELL_SHAPE[spec.shape](targets, spec, battle);
       SPELL_EFFECT[spec.effect](affected, spec, team, battle);
       BattleFX.onSpell(spec, targets, affected);
     }
   };
   const SPELL_TARGET={ /* enemy_cluster, enemy_frontline, ... — reuse TARGETING logic */ };
   const SPELL_SHAPE={
     point:(t)=>[t],
     circle_aoe:(t,spec,b)=>b.units.filter(u=>u.h>0&&dist(u,t)<spec.radius),
     line:(t,spec,b)=>{ /* units within a line from caster side to target */ },
     cone:(t,spec,b)=>{ /* units within cone angle from caster side */ },
     persistent_zone:(t,spec,b)=>{ /* register a zone in battle.zones, ticked each frame */ }
   };
   const SPELL_EFFECT={
     damage:(units,spec)=>units.forEach(u=>u.h-=spec.magnitude),
     damage_over_time:(units,spec)=>units.forEach(u=>{u.poison=spec.duration;u.poisonDmg=spec.magnitude;}),
     slow:(units,spec)=>units.forEach(u=>u.slow=spec.duration),
     stun:(units,spec)=>units.forEach(u=>u.stun=spec.duration),
     heal_allies:(units,spec)=>units.forEach(u=>u.h=Math.min(u.mh,u.h+spec.magnitude)),
     shield_allies:(units,spec)=>units.forEach(u=>u.shieldActive=spec.duration),
     summon:(units,spec,team,b)=>{ /* spawn N minions at target */ },
     knockback:(units,spec,team,b)=>{ /* push units away from target point */ },
     buff_dmg:(units,spec)=>units.forEach(u=>u.d=Math.round(u.d*(1+spec.magnitude/100))),
     buff_speed:(units,spec)=>units.forEach(u=>u.moveSpeedMod=(u.moveSpeedMod||100)+spec.magnitude)
   };
   ```
2. **Spell triggers in `Battle.update`** (line 1947). Add a `battle.spells` array (per-side spell specs from the loadout). Each frame, check each spell's trigger condition:
   - `battle_start` → fire on frame 1, then remove.
   - `on_first_contact` → fire when any player/enemy pair is within `RANGED_THRESHOLD`, then remove.
   - `delayed_3s` → fire when `battle.time >= 3`, then remove.
   - `when_ally_hurt` → fire when any ally < 50% HP (once per spell).
   - `periodic_5s` → fire every 5s (no removal).
   Persistent zones tick in `update`: apply `damage_over_time`/`slow` to units inside each frame, decrement `duration`, remove at 0.
3. **Spells as draftable cards.** `G.rollOne` (line 2873) currently draws from `loadoutUnits()`. Extend the draft pool to include `save.spellbook` (array of spell specs). A spell card renders with a ✨ icon + effect description instead of HP/DMG. Picking a spell adds it to `this.selected`; `_buildArmyFromPicks` skips spells (they don't spawn units) and instead collects them into a `this.spells` array passed to `Battle.start`.
4. **`Battle.start`** (line 1900) — accept a 4th arg `spells = {player:[], enemy:[]}`, store as `this.spells`. Triggers fire from `update`.
5. **LLM spell forge.** Reuse the entire `generateUnit` pipeline (line 1084) but with a spell schema + prompt:
   ```
   const SPELL_SCHEMA={
     type:"object",
     properties:{
       name:{type:"string",maxLength:20},
       trigger:{type:"string",enum:["battle_start","on_first_contact","delayed_3s","when_ally_hurt","periodic_5s"]},
       target:{type:"string",enum:["enemy_cluster","enemy_frontline","enemy_backline","enemy_carry","lowest_hp_enemy","highest_hp_enemy","random_enemy","center","ally_cluster","lowest_ally"]},
       effect:{type:"string",enum:["damage","damage_over_time","slow","stun","heal_allies","shield_allies","summon","knockback","buff_dmg","buff_speed"]},
       shape:{type:"string",enum:["point","circle_aoe","line","cone","persistent_zone"]},
       fxType:{type:"string",enum:["explosion","frost","lightning","poison_cloud","heal_glow","shockwave","fire_wall"]},
       magnitude:{type:"integer",minimum:10,maximum:80},
       radius:{type:"integer",minimum:30,maximum:120},
       duration:{type:"integer",minimum:0,maximum:6}
     },
     required:["name","trigger","target","effect","shape","fxType","magnitude","radius","duration"]
   };
   ```
   - New `generateSpell(prompt, arenaIndex)` — mirrors `generateUnit` (cache, LLM JSON mode, semantic validate, fallback). Cache store: reuse IndexedDB with a `spell_specs` store (or prefix keys `spell:`).
   - New `templateSpellFallback(prompt)` — hand-authored spell templates (TNT, Waster, Heal Rain, Frost Nova, ...).
   - New `semanticValidateSpell(a)` — cross-field rules: `heal_allies`/`shield_allies`/`buff_*` require an ally target; `persistent_zone` requires `duration>0`; `damage_over_time` requires `duration>0`; `summon` magnitude = minion count (cap 3); etc.
   - Forge UI (line 3331+): add a "Forge Spell" toggle next to "Forge Custom Unit." Same ad-gated flow, same cancel UX, same preview (render a spell card with effect text + an FX preview animation on a mini canvas).
6. **Save schema bump v6 → v7.** Add `save.spellbook = []` (forged spells) + `save.spellLoadout = []` (up to 2 spell slots alongside the 4 unit slots — or replace one unit slot; **open question below**). Migration in `migrateSave`.
7. **P2P.** Spells serialize like units (`serializeUnitsForPeer` → generalize to `serializeForPeer` handling both). Spell specs are tiny (~200 bytes) — no bandwidth concern. Guest executes spells locally from the spec (deterministic given same battle state). Host-authoritative: host sends spell-fire events in the snapshot, guest applies.

### Open questions (resolve before implementing Phase 23)
1. **Loadout slots:** 4 units + 0 spells, or 3 units + 1 spell, or 4 units + 1 spell (5-card loadout)? Real Draft Showdown mixes units and spells in the same 4-card loadout. **Recommendation:** keep 4-card loadout, spells occupy a card slot (so picking a spell means one fewer unit). Matches the real game and makes spell-vs-unit a real draft tradeoff.
2. **Spell rarity/weighting in draft:** spells should be rarer than units (e.g. 20% spell / 80% unit per draw) so battles don't become spell-spam. Configurable per arena.
3. **Spell balance:** `damage` magnitude 80 + radius 120 could wipe a frontline. **Mitigation:** arena clamps (reuse `validateUnit` arena maxDmg for spell magnitude), and persistent zones tick once per second not per frame.
4. **LLM spell cache key:** separate store or prefix? **Recommendation:** prefix `spell:` in the existing store — simpler migration.

### Code touchpoints
- New `Spell` + `SPELL_TARGET` + `SPELL_SHAPE` + `SPELL_EFFECT` objects (~1850, before `Battle`)
- New `SPELL_SCHEMA` (~570), `generateSpell` (~1084), `templateSpellFallback` (~832), `semanticValidateSpell` (~635)
- `Battle.start` (1900) — accept spells arg
- `Battle.update` (1947) — spell trigger ticking + persistent zone ticks
- `Battle` state (1853) — `this.spells`, `this.zones`
- `G.rollOne` (2873) — include spells in draft pool
- `G.draftCard` (2824) — spell card rendering
- `G._buildArmyFromPicks` (2897) — separate spells from units
- `G.battle` (2911) — pass spells to `Battle.start`
- Forge UI (3331+) — spell forge toggle + preview
- `serializeUnitsForPeer` → `serializeForPeer` (~line 1200) — handle spells
- `migrateSave` (336) — v7: `spellbook`, `spellLoadout`
- `UNIT_SCHEMA`/`generateUnit` unaffected (spells are a separate schema)

### Smoke test
1. **TNT:** forge spell "explosion" → LLM returns `effect:damage, shape:circle_aoe, fxType:explosion`. Draft it → battle → verify at `battle_start` an explosion FX fires on the enemy cluster, dealing ~40 damage in radius 60.
2. **Waster:** forge "fire wall" → `effect:damage_over_time, shape:persistent_zone, fxType:fire_wall, duration:5`. Verify a fire-wall zone renders on the enemy frontline, ticks damage for 5s, then disappears.
3. **Heal Rain:** forge "healing shower" → `effect:heal_allies, target:ally_cluster`. Verify it heals the player's clustered units.
4. **Template fallback:** disable LLM (no WebGPU) → forge "frost nova" → verify `templateSpellFallback` returns a valid stun spell.
5. **P2P:** host forges a spell, guest connects → verify guest renders + applies the spell identically.
6. **Balance:** verify a 4-spell loadout doesn't trivially win (spell rarity weighting + arena magnitude clamps should keep it fair).

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM produces nonsensical spell combos | Low (8 enum fields, smaller than unit's 17) | Low (semantic fallback) | `semanticValidateSpell` catches ally-effect + enemy-target, DoT without duration, etc. Per-field fallback re-asks. Template fallback always registers a spell. |
| Spells dominate units (spell-spam meta) | Medium | High (units become irrelevant) | Spell rarity in draft (20%), arena magnitude clamps, persistent zones tick 1/s not per-frame, spells occupy loadout slots (1 spell = 1 fewer unit). |
| Persistent zones kill mobile FPS | Low (few zones, simple particle cap) | Medium | Cap zones at 3 per side. Reuse `MAX_PARTICLES` budget. Degrade to instant-effect if FPS<25 (existing Phase 17 guard). |
| Spell FX not synced over P2P | Medium | Low (visual only) | FX are state-derived from `Battle.zones`/`this.spells` which are in the snapshot. Guest renders the same FX. Reuse the existing state-derived FX pattern (Phase 17). |
| Save migration v7 corrupts | Low | High | `migrateSave` backs up before migrating (existing pattern). Test with a v6 save. |
| Spell + unit fusion ambiguity | Low | Low | Spells don't fuse — they're consumable loadout cards. No fusion for spells (units only). |

---

## Verification Strategy (per phase)

| Phase | Smoke test |
|---|---|
| 20 (Ramp Carry) | Wizard in loadout → kites, ramps dmg on kills (visible FX + log), dies to divers unprotected. LLM forge produces ramp units. |
| 21 (Bot Strategy) | 5 bot matches → every bot army has frontline+carry. Player picks Wizard → bot counter-picks Assassin round 2. Bot still beatable. |
| 22 (Formation) | Loadout [Knight,Wizard,Assassin,Priest] → Knight front, Wizard/Priest back, Assassin mid on canvas. Divers must cross frontline. `enemy_backline` targets the carry. P2P guest matches. |
| 23 (Spells) | TNT (burst), Waster (DoT zone), Heal Rain (ally heal) all fire correctly at their triggers. Template fallback works without WebGPU. P2P guest renders identically. 4-spell loadout doesn't auto-win. |

---

## Implementation Order & Dependencies

```
Phase 20 (Ramp Carry)  ──┐
                         ├──→ Phase 23 (Spells) — needs positioning for spell targeting
Phase 21 (Bot Strategy) ─┤
                         │
Phase 22 (Formation)  ───┘
```

- **Phase 20, 21, 22** are independent and can ship in any order. Recommended order: 20 → 22 → 21 (ramp carry first so formation has a purpose, then bot strategy so scout is meaningful once formations exist).
- **Phase 23 depends on 22** — spell targeting (`enemy_frontline`/`enemy_backline`/`enemy_cluster`) only means something once units are spatially arranged by role. Implementing spells before formation would make every spell effectively "hit the random clump."
- Each phase = 1 commit + 1 Playwright smoke test (never chrome-devtools). Push to `origin/main` after each.

---

## What This Tier Does NOT Do (out of scope)

- **Real ad SDK integration** — still using the 15s ad stub (`showAdStub`). Real SDK is Phase 19b in `PLAN.md`, separate effort.
- **Manual unit positioning** — formation is auto by role. Manual drag-positioning is a future tier if playtesting shows it's wanted.
- **Spell fusion / upgrade** — spells are loadout cards, not collectible units. No fusion. (Could add "spell level" via coins later.)
- **Single-player / campaign** — still bot-fallback matchmaking only, per the Tier 1 design.
- **New arenas** — the 4 existing arenas suffice; spells + ramp carry add depth without new content gating.
