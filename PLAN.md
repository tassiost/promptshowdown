# Prompt Showdown v5 — Draft Showdown Clone + LLM Reward Layer

**Product strategy: two tiers.**

1. **Tier 1 — Draft Showdown clone (ship first):** A complete, fully-playable hybrid-casual PVP card-draft auto-battler. Rounds, lives, 3-pick-per-round drafting, comeback mechanic, 4-card loadout, arenas, opponent scout, synergy hints, P2P multiplayer. Uses a curated 6-unit roster with simple visuals (colored shapes with role-coded borders). No LLM dependency — the game is fun and complete without it. **There is no separate "singleplayer" mode.** Every match goes through the same matchmaking flow — if no human opponent is found within a timeout, the slot is filled by a bot (random starter deck, random drafting). The player never knows (or cares) whether they fought a human or a bot; the UX is identical.

2. **Tier 2 — LLM reward layer (pack on top):** The LLM-generated procedural units are a **reward feature gated behind watching an ad**. User taps "Forge Custom Unit" → prompted to watch a rewarded ad → LLM generates *during* ad playback (~15-30s ad hides ~10-20s generation latency) → ad ends → unit preview ready → keep or reroll. The ad revenue funds the game; the user gets a custom unit for their time. No separate "generating..." wait screen — the ad IS the wait screen.

**Why this order:** Tier 1 is a shippable game on its own. If the LLM layer has issues (WebGPU unavailable, model too slow, generation quality poor), the game still works. Tier 2 is upside — a differentiator that monetizes through rewarded ads, not a dependency.

Single-file `index.html` architecture preserved. P2P multiplayer preserved.

---

## Tier Structure

| Tier | Phases | What it delivers | Dependency |
|---|---|---|---|
| **Tier 1** | 8, 9, 10, 13, 14, 15, 16, 18, 19a | Complete Draft Showdown clone | None — ships standalone |
| **Tier 2** | 11, 12, 17, 19b | LLM procedural units + sprites + FX + ad integration | Tier 1 must be complete |

**Tier 1 visuals:** Units render as colored shapes with role-coded borders (🛡️ frontline = square, 🎯 carry = triangle, ✨ support = diamond, ⚔️ counter = inverted triangle, 🛠️ utility = hexagon). Simple but readable. Phase 11 (full procedural sprite system) replaces this in Tier 2.

**Tier 1 unit creation:** Players start with a 6-unit roster and use it throughout. No forge, no LLM. The 6 starters cover all 5 roles and use the same Behaviour Composition API (5 fields) that LLM units will use in Tier 2 — one unified system, no separate "mode" or "preset" indirection. (If playtesting shows 6 is too limited, additional starter units can be added in Phase 15 as arena-unlock rewards — but the initial ship is 6 units.)

**Tier 2 unit creation:** The forge becomes available as a rewarded-ad feature. LLM generates custom units with procedural sprites + behaviours. These go into the collection alongside starter units and can be slotted into the 4-card loadout.

---

## File Insertion Order (within `index.html`)

New objects inserted in this order, between the network helpers and `G`:

```
... network state + transmit + networkReceive ...
const RANGED_THRESHOLD=80;
const TARGETING={...};        // NEW Phase 10 — behaviour API lookup tables
const MOVEMENT={...};         // NEW Phase 10
const ATTACK_CONDITIONS={...};// NEW Phase 10
const ABILITY_TRIGGERS={...}; // NEW Phase 10
const Battle={...};           // existing — extended in Phase 10, 11, 17
const Match={...};            // NEW Phase 8 — sibling of Battle
const SpriteRenderer={...};   // NEW Phase 11 — used by Battle.render
const BattleFX={...};         // NEW Phase 17 — used by Battle.update + render
const Bot={...};              // NEW Phase 9/18 — fake multiplayer bot (random drafting)
const arenas=[...];           // NEW Phase 15
const G={...};                // existing — extended throughout
```

Rationale: `Battle.act()` references `TARGETING`/`MOVEMENT`/etc. at call time, so they must be defined before `Battle` (they're `const` — hoisted but not initialized until their line). `Battle` references `SpriteRenderer` and `BattleFX` in its methods at call time (runtime, not definition time), so their order relative to `Battle` is flexible, but keeping them before `G` matches the existing pattern.

---

## Match & Round State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
  G.start() ──→ Match.start() ──→ startRoundDraft()            │
                                      │                        │
                                      ▼                        │
                              ┌──────────────┐                 │
                              │  DRAFT       │  3 draws × 3   │
                              │  (Phase 9)   │  picks (or 4   │
                              └──────┬───────┘  if comeback)   │
                                     │ all picks locked        │
                                     ▼                        │
                              ┌──────────────┐                 │
                              │  SCOUT       │  tap to reveal  │
                              │  (Phase 14)  │  opponent picks │
                              └──────┬───────┘                 │
                                     │ "FIGHT" button          │
                                     ▼                        │
                              ┌──────────────┐                 │
                              │  BATTLE      │  auto-combat    │
                              │  (Battle)    │  hands-off      │
                              └──────┬───────┘                 │
                                     │ onBattleEnd(winner)     │
                                     ▼                        │
                              ┌──────────────┐                 │
                              │  ROUND       │  show winner,   │
                              │  RESULT      │  decrement life │
                              └──────┬───────┘                 │
                                     │                         │
                              ┌──────┴──────┐                  │
                              │             │                  │
                     lives>0  ▼             ▼ lives==0         │
                     next round         MATCH RESULT           │
                     (comeback          (award XP/coins,       │
                     check here)         arena progress)       │
                              │             │                  │
                              └─────────────┘                  │
                                     │                         │
                                     ▼                         │
                                  G.menu()                     │
```

**Comeback check** happens at `next round` branch: if the player who just lost the round still has lives > 0, they get 4 draws next round instead of 3. Tracked via `Match.history[lastRoundWinner]`.

---

## The LLM Hook (Tier 2 — our differentiator)

The LLM-generated procedural units are a **rewarded-ad feature** — the unique differentiator that monetizes the game. The core game (Tier 1) is fully playable without it.

**The UX flow:**
1. User taps "✨ Forge Custom Unit" (appears in menu after completing Training Yard)
2. Prompt: "Watch a short ad to forge a custom unit? [Watch Ad] [Skip]"
3. **Rewarded ad plays** (15-30s) — standard mobile ad (video, playable, or interstitial)
4. **LLM generates in parallel during ad playback** — the ad hides the latency entirely
5. Ad ends → unit preview is ready (or nearly ready) → user sees animated sprite + stats
6. "Keep" (adds to collection) or "Reroll" (watch another ad to re-generate)
7. Forged units go into `save.collection`; slot them into your 4-card loadout from the Deck screen

**Why ad-gated generation is genius UX:**
- The ad duration (~15-30s) aligns perfectly with LLM generation time (~10-20s hybrid approach)
- No separate "generating..." wait screen — the ad IS the wait screen
- User gets value (custom unit) for their time (watching ad) — not a paywall, not a timer
- Ad revenue funds the game; LLM cost is zero (runs locally, no API calls)
- If the user skips the ad → template fallback (instant, free, but less custom)

**The generation approach (hybrid JSON-mode-first + Behaviour Composition API):**

1. **JSON mode call** (1 call, ~5-10s) — WebLLM's WebAssembly grammar sampler forces valid JSON matching our schema. The LLM picks 17 fields including the **5 behaviour API fields** (`targeting`, `movement`, `attackCondition`, `abilityTrigger`, `moveSpeedMod`) that compose into 20,160+ unique behaviour combinations:
```json
{
  "name": "Archer", "role": "carry",
  "targeting": "closest", "movement": "kite", "attackCondition": "always",
  "abilityTrigger": "never", "moveSpeedMod": 100,
  "hp": 55, "dmg": 20, "range": 180, "speed": 65, "ability": "none",
  "bodyPlan": "humanoid", "weaponType": "bow",
  "primaryColor": "green", "accentColor": "green", "sizeMod": "medium"
}
```
The grammar guarantees: valid JSON, all 17 fields present, enum values valid, integers in range. Derived fields (fxType, atkSpd, crit, headColor, weaponColor) are computed from the LLM's choices — not in the schema. The 12-value `ability` enum covers staples like lifesteal (vampire), explode (suicide bomber), heal_burst (healing shower on death), shield (turtle), rage (berserker), and slow (debuffer) — validated against 8 scenario archetypes during planning.

2. **Semantic validation** (instant) — cross-field consistency checks catch things the grammar can't:
- "Archer has hp=180? Carries should be squishy (30-80). Flag `hp` for re-ask."
- "targeting: lowest_ally + attackCondition: always? That means attacking allies. Flag `attackCondition` for re-ask."

3. **Per-field fallback** (only for flagged fields, ~2-5s each) — targeted micro-prompts. These may run after the ad ends (2-4 short calls, ~5-15s). If the ad was 30s, the unit is already ready. If the ad was 15s, the user sees a brief "finishing up..." spinner for the remaining fallback calls.

4. **RecipeAssembler** builds the visual recipe from the final attributes using body-plan + weapon templates — the LLM never emits shape coordinates.

**The Behaviour Composition API** is the key to interesting LLM units. Instead of picking one of 7 fixed modes, the LLM picks 5 simple enum values that `Battle.act()` composes via lookup tables. This gives 20,160+ behaviour combinations from fields a 0.5B model can reliably fill. Novel combinations emerge naturally — a "pumpkin" that rolls into the backline and explodes in a healing shower on death, a "vampire" that sustains itself via lifesteal, a "berserker" that charges the tankiest enemy at 150% speed and hits harder as it takes damage, an "executioner" that holds position and only attacks low-HP carries.

**Why hybrid (not pure JSON mode or pure per-field):**
- Pure JSON mode is fast (~5s) but a 0.5B model may get semantic values wrong (archer with hp=180). The grammar guarantees structure, not semantics.
- Pure per-field is reliable (~30s, 15 calls) but slow — would need a longer ad.
- Hybrid is fast in the common case (~5-10s, 1 call) and catches semantic errors with 0-4 targeted re-asks (~10-20s total). Fits within a standard 15-30s ad with room to spare.

This is informed by the macsand project (`/Users/tassio/macsand/WEBLLM_MATERIAL_PLAN.md`), which uses per-field micro-prompts with Qwen2.5-1.5B and notes that WebLLM's JSON mode "could replace the 18 per-field calls with a single LLM call — ~18x faster." We take that improvement but keep per-field as a semantic fallback.

**Endgame vision:** the curated roster is a starter set (training wheels). The endgame is entirely LLM-generated — players build their whole 4-card loadout from prompts, each forged by watching an ad. Every unit has unique behaviour composed from the 5-field API, not bucketed into a fixed archetype.

---

## Reference: Draft Showdown Mechanics We're Adopting

- **Match = best-of-N rounds.** First to lose all lives (default 3) loses.
- **3 draws × 3 picks per round.** Each draw shows 3 cards, pick 1, repeat 3×.
- **4th-draw comeback.** Loser of the previous round gets an extra draw.
- **Persistent 4-card loadout** between matches.
- **Auto-combat** — hands-off once the horn sounds.
- **Role-tagged units** — frontline / carry / support / counter / utility.
- **Scout the opponent** — tap to reveal their picks before battle.
- **Arena ladder** — themed, unlock-gated.
- **Match length: minutes, not hours.**

---

## Current State of `index.html` (v4)

| Area | Today | v5 target |
|---|---|---|
| Match structure | 1 draft → 1 battle → result | Rounds + lives (Phase 8) |
| Draft | 3 rows × 3 cards, 3 rerolls | 3 draws × 3 picks per round + 4th-draw comeback (Phase 9) |
| Unit rendering | Static colored circles | Procedural sprite system, 6-10 shapes + articulated animation (Phase 11) |
| Unit behaviour | Chase + attack, implicit roles | Behaviour Composition API: 5 composable fields, 20,160+ combos (Phase 10) |
| Unit creation | AI forge (flat stats, generic prompt, Llama-3.2-1B) | LLM generates behaviour + visual via grammar-constrained JSON (Phase 12, Qwen2.5-0.5B) |
| Deck | All owned units pooled | 4-card loadout from collection (Phase 13) |
| Opponent scout | None | Tap to reveal (Phase 14) |
| Arenas | None | Arena ladder (Phase 15) |
| FX | None (static redraw) | Procedural FX system, interprets LLM FX specs (Phase 17) |
| P2P | Host-authoritative 20Hz, solo play vs random mobs | Matchmaking + bot fallback (fake multiplayer), extended for rounds/lives/LLM units (Phase 18) |
| Solo play | `G.battle()` spawns 6 random enemies | **Removed.** No separate solo mode — bot fills the opponent slot if matchmaking fails (Phase 18) |
| Progression | XP/coins/upgrades/fusion/achievements | Keep + extend (Phase 19) |

---

## Phase 8 — Match & Lives System ✅ DONE

**Why first:** everything else (rounds, comeback, scout) depends on a match arc.

### Changes
- New `Match` object (sibling of `Battle`) owning: `livesPlayer`, `livesEnemy`, `round`, `history[]`, `onMatchEnd`.
- Default lives = **3** per side (configurable per arena in Phase 15).
- `G.start()` now starts a **Match**, not a single battle. Match drives rounds.
- `onBattleEnd(winner)` → Match records round result, decrements loser's life, then either starts next round or fires `onMatchEnd`.
- Result screen branches: **round result** (mid-match) vs **match result** (final).
- Match result awards XP/coins (move from per-round to per-match).

### Code touchpoints
- New `Match` object near `Battle` (line ~488).
- `G.start()` (line ~878) → `Match.start()`.
- `G.onBattleEnd` (line ~1047) → delegates to `Match.onRoundEnd`.
- `G.roundEnd` (line ~1067) → split into `roundResult` / `matchResult`.
- New HUD: lives hearts (♡/♥) for both sides on battle + draft screens.

### Save migration
- Bump `CURRENT_VERSION` (v5 → v6). `migrateSave()` adds `matchWins`, `arena`, `loadout`, `collection` fields. **All new save fields are defined here in Phase 8** so subsequent phases (10, 12, 13) can use them without forward-dependency issues.
- `save.collection` = existing `save.ai` units (marked `legacy: true` — old format, no recipe or behaviour API fields). Phase 12's forge appends to this.
- `save.loadout` = first 4 of `save.deck` (or first 4 base unit names if deck is missing). Phase 13's deck screen edits this.
- `save.arena` = 0, `save.matchWins` = 0.
- Drop `save.achievements.forge5` (old "forge 5 AI units" — replaced by new forge achievements in Phase 19).

---

## Phase 10 — Behaviour Composition API + Starter Roster ✅ DONE

**Today:** `Battle.act()` (line ~583) does chase-closest + attack-when-in-range for all units. No behaviour variety, no role tags. The current model is `Llama-3.2-1B-Instruct-q4f32_1-MLC` (line 323); the forge generates flat stats via a generic prompt.

### The Behaviour Composition API

Instead of a single `mode` enum with 7 fixed buckets, every unit has **5 composable behaviour fields** that `Battle.act()` interprets via lookup tables. This gives the LLM (Phase 12) a rich "API" to create interesting, varied behaviour — 10×6×4×7×12 = **20,160 possible combinations** vs 7 fixed modes — while still being simple enums a 0.5B model can fill reliably.

| Field | Type | Options | What it controls |
|---|---|---|---|
| `targeting` | enum | `closest`, `lowest_hp`, `highest_hp`, `enemy_carry`, `enemy_support`, `enemy_backline`, `enemy_frontline`, `enemy_cluster`, `lowest_ally`, `random` | Who the unit focuses on |
| `movement` | enum | `chase`, `flee`, `hold`, `hold_midpoint`, `kite`, `patrol` | How the unit moves relative to its target |
| `attackCondition` | enum | `always`, `only_if_healthy`, `only_if_target_low`, `never` | When the unit attacks |
| `abilityTrigger` | enum | `on_cooldown`, `when_ally_hurt`, `when_surrounded`, `on_low_hp`, `on_death`, `on_first_hit`, `never` | When the unit uses its ability |
| `moveSpeedMod` | integer | 50–150 (% of base speed) | Speed multiplier — 150 = dive, 50 = cautious |

**Ability types** — the `ability` field has 12 values, split into passive (always active) and triggered (fire when `abilityTrigger` condition is met):

| Ability | Type | Effect |
|---|---|---|
| `none` | — | No ability |
| `splash` | passive | Attacks deal AoE damage to enemies near target |
| `heal` | triggered | Heal lowest-HP ally (single target) |
| `dodge` | passive | 50% chance to avoid incoming attacks |
| `poison` | passive | Attacks apply poison DoT (damage over time) |
| `spawn` | triggered | Spawn a disposable minion (chase closest, low HP, 5s TTL) |
| `lifesteal` | passive | Heal self for 50% of damage dealt |
| `explode` | triggered | AoE damage around self (pairs with `on_death` or `on_cooldown`) |
| `heal_burst` | triggered | AoE heal around self (pairs with `on_death`, `on_cooldown`, or `when_ally_hurt`) |
| `shield` | triggered | Temporary damage immunity for 2s (pairs with `on_low_hp` or `on_first_hit`) |
| `rage` | passive | Damage scales with missing HP (up to +100% at 10% HP) |
| `slow` | passive | Hit targets are slowed 50% for 1s |

Passive abilities (`splash`, `dodge`, `poison`, `lifesteal`, `rage`, `slow`) pair with `abilityTrigger: never` — they're applied automatically during damage calculation, not triggered. Triggered abilities (`heal`, `spawn`, `explode`, `heal_burst`, `shield`) fire when their `abilityTrigger` condition is met.

**`Battle.act()` implementation** — each enum maps to a pure function in a lookup table:

```js
const TARGETING = {
  closest:        (u, enemies, allies) => closestEnemy(u, enemies),
  lowest_hp:      (u, enemies, allies) => lowestBy(enemies, e => e.h),
  highest_hp:     (u, enemies, allies) => highestBy(enemies, e => e.h),
  enemy_carry:    (u, enemies, allies) => enemies.find(e => e.role === "carry") || closestEnemy(u, enemies),
  enemy_support:  (u, enemies, allies) => enemies.find(e => e.role === "support") || closestEnemy(u, enemies),
  enemy_backline: (u, enemies, allies) => {
    // target the enemy furthest from their own side (back = high Y for player-side, low Y for enemy-side)
    const backY = enemies[0]?.team === "player" ? Math.max(...enemies.map(e=>e.y)) : Math.min(...enemies.map(e=>e.y));
    return enemies.reduce((best, e) => Math.abs(e.y - backY) < Math.abs(best.y - backY) ? e : best, enemies[0]);
  },
  enemy_frontline:(u, enemies, allies) => {
    const frontY = enemies[0]?.team === "player" ? Math.min(...enemies.map(e=>e.y)) : Math.max(...enemies.map(e=>e.y));
    return enemies.reduce((best, e) => Math.abs(e.y - frontY) < Math.abs(best.y - frontY) ? e : best, enemies[0]);
  },
  enemy_cluster:  (u, enemies, allies) => {
    // target the position with the most enemies in range (for AoE) — return the centroid enemy
    let best = enemies[0], bestCount = 0;
    for (const e of enemies) {
      const count = enemies.filter(other => dist(e, other) < 80).length;
      if (count > bestCount) { bestCount = count; best = e; }
    }
    return best;
  },
  lowest_ally:    (u, enemies, allies) => lowestBy(allies.filter(a => a !== u), a => a.h),
  random:         (u, enemies, allies) => enemies[Math.floor(R() * enemies.length)],  // R() = existing seeded RNG
};

const MOVEMENT = {
  chase:        (u, target, dt) => { if (target) moveToward(u, target, u.s * (u.moveSpeedMod/100) * dt); },
  flee:         (u, target, dt) => { if (target) moveAway(u, target, u.s * (u.moveSpeedMod/100) * dt); },
  hold:         (u, target, dt) => { /* no movement */ },
  hold_midpoint:(u, target, dt) => {
                  const mid = u.team === "player" ? Battle.canvasH * 0.6 : Battle.canvasH * 0.4;
                  if (Math.abs(u.y - mid) > 10) { u.y += Math.sign(mid - u.y) * u.s * (u.moveSpeedMod/100) * dt; }
                },
  kite:         (u, target, dt) => {
                  if (!target) return;
                  const d = dist(u, target);
                  if (d < u.r * 0.5) moveAway(u, target, u.s * (u.moveSpeedMod/100) * dt);
                  else if (d > u.r * 1.1) moveToward(u, target, u.s * (u.moveSpeedMod/100) * dt);
                  // else: in kite band, hold
                },
  patrol:       (u, target, dt) => {
                  u.patrolT = (u.patrolT || 0) + dt;
                  u.x += Math.sin(u.patrolT * 2) * u.s * (u.moveSpeedMod/100) * dt * 0.5;
                },
};

const ATTACK_CONDITIONS = {
  always:             (u, target) => true,
  only_if_healthy:    (u, target) => u.h > u.mh * 0.5,
  only_if_target_low: (u, target) => target && target.h < target.mh * 0.3,
  never:              (u, target) => false,
};

const ABILITY_TRIGGERS = {
  on_cooldown:      (u, allies, enemies) => u.abCool <= 0,
  when_ally_hurt:   (u, allies, enemies) => allies.some(a => a !== u && a.h < a.mh * 0.5) && u.abCool <= 0,
  when_surrounded:  (u, allies, enemies) => enemies.filter(e => dist(u, e) < 60).length >= 2 && u.abCool <= 0,
  on_low_hp:        (u, allies, enemies) => u.h < u.mh * 0.3 && u.abCool <= 0,
  on_death:         (u, allies, enemies) => false,  // handled in Battle.onUnitDeath(), not in act()
  on_first_hit:     (u, allies, enemies) => !u.firstHitUsed,  // once per battle, no cooldown check
  never:            (u, allies, enemies) => false,
};

// The main act() is now a 4-line composition:
act(u, enemies, allies, dt) {
  if (u.h <= 0 || u.stun > 0) return;
  if (u.abCool > 0) u.abCool -= dt;
  const target = TARGETING[u.targeting](u, enemies, allies);
  MOVEMENT[u.movement](u, target, dt);
  if (ATTACK_CONDITIONS[u.attackCondition](u, target) && u.cool <= 0 && target && dist(u, target) <= u.r) {
    this.attack(u, target, enemies); u.cool = u.a;
  }
  if (ABILITY_TRIGGERS[u.abilityTrigger](u, allies, enemies)) {
    this.triggerAbility(u, allies, enemies);
  }
}
```

**`on_first_hit` is once-per-battle** — no cooldown check, just `!u.firstHitUsed`. After firing, `triggerAbility()` sets `u.firstHitUsed = true` (see the `shield` case below).

**`triggerAbility(u, allies, enemies)`** — called from `act()` when `abilityTrigger` fires. Dispatches by `u.ability`:
```js
triggerAbility(u, allies, enemies) {
  switch (u.ability) {
    case "heal": {
      const ally = lowestBy(allies.filter(a => a !== u && a.h > 0), a => a.h);
      if (ally) { ally.h = Math.min(ally.mh, ally.h + u.d * 2); u.abCool = 3.0; }
      break;
    }
    case "spawn": {
      const minion = unit({n:"Minion", h:20, d:5, r:20, s:50, a:1, c:u.c,
        targeting:"closest", movement:"chase", attackCondition:"always",
        abilityTrigger:"never", moveSpeedMod:100, team:u.team, ttl:5});
      Battle.spawnUnit(minion);
      u.abCool = 2.0;
      break;
    }
    case "explode": {
      for (const e of enemies.filter(e => e.h > 0 && dist(u, e) < 60))
        Battle.takeDamage(e, u.d * 2, u);
      u.abCool = 5.0;  // only matters if abilityTrigger is on_cooldown (recharge bomber)
      break;
    }
    case "heal_burst": {
      for (const a of allies.filter(a => a.h > 0 && dist(u, a) < 60))
        a.h = Math.min(a.mh, a.h + u.d * 2);
      u.abCool = 4.0;  // only matters if abilityTrigger is on_cooldown
      break;
    }
    case "shield": {
      u.shieldActive = 2.0;  // 2s immunity, decremented in update()
      u.abCool = 8.0;
      if (u.abilityTrigger === "on_first_hit") u.firstHitUsed = true;
      break;
    }
    // "none" and passive abilities: no-op here (passives handled in attack/takeDamage)
  }
}
```

**Passive ability formulas** — applied in `Battle.attack()` and `Battle.takeDamage()`, not via `triggerAbility()`:
```js
// In Battle.attack(attacker, target, enemies):
attack(attacker, target, enemies) {
  let dmg = attacker.d;
  // rage: damage scales linearly with missing HP (up to +100% at 0 HP)
  if (attacker.ability === "rage")
    dmg *= 1 + (1 - attacker.h / attacker.mh);
  // crit
  if (R() < attacker.crit) { dmg *= 2; attacker._crit = true; }
  // dodge: 50% chance to completely avoid
  if (target.ability === "dodge" && R() < 0.5) return;
  // shield: immune if active
  if (target.shieldActive > 0) return;
  Battle.takeDamage(target, dmg, attacker);
  // lifesteal: heal attacker for 50% of damage dealt
  if (attacker.ability === "lifesteal")
    attacker.h = Math.min(attacker.mh, attacker.h + dmg * 0.5);
  // slow: debuff target for 1s (refreshes, doesn't stack)
  if (attacker.ability === "slow") target.slow = 1.0;
  // splash: AoE damage to enemies near target (50% damage)
  if (attacker.ability === "splash")
    for (const e of enemies.filter(e => e !== target && e.h > 0 && dist(target, e) < 40))
      Battle.takeDamage(e, dmg * 0.5, attacker);
  // poison: apply DoT (refreshes duration, doesn't stack damage)
  if (attacker.ability === "poison") { target.poison = 3.0; target.poisonTick = 0; }
}
```
**Stacking rules:** slow refreshes (resets to 1s), poison refreshes (resets to 3s), rage is always-on (recomputed per hit), lifesteal is per-hit, dodge is per-incoming-hit, splash is per-hit. No stacking penalties or diminishing returns — simple and predictable.

**Death sequence** (ordered, critical for `on_death` abilities + death animation):
```
1. Battle.update() detects u.h <= 0 (and u.deathT === undefined, i.e. not already dying)
2. Battle.onUnitDeath(u) fires:
   - If u.abilityTrigger === "on_death": call triggerAbility(u, allies, enemies)
     (explode deals AoE damage, heal_burst heals allies — happens BEFORE removal)
   - Set u.deathT = 0 (start death animation timer)
   - BattleFX.onDeath(u) (Phase 17: death burst particles)
3. Unit stays in the array with h=0, deathT incrementing each frame
4. After deathT >= 0.5 (death animation done): remove from array
5. During death animation: unit doesn't act (act() checks h <= 0), but is still rendered
   (SpriteRenderer shows death animation: alpha fade + rotation)
```

**`Battle.update()` with allies** — splits units by team, passes the right allies array:
```js
update(dt) {
  const players = this.units.filter(u => u.team === "player" && u.h > 0);
  const enemies = this.units.filter(u => u.team === "enemy" && u.h > 0);
  for (const u of this.units) {
    if (u.h <= 0) { if (u.deathT !== undefined) u.deathT += dt; continue; }
    const allies = u.team === "player" ? players : enemies;
    const targets = u.team === "player" ? enemies : players;
    this.act(u, targets, allies, dt);
  }
  // death cleanup: remove units with deathT >= 0.5
  this.units = this.units.filter(u => u.deathT === undefined || u.deathT < 0.5);
  // ... existing projectile/poison/slow/shield updates
}
```
Note: `this.units` is now a single array containing both teams (was `this.units` + `this.enemies` as separate arrays). `Battle.start()` sets `u.team` on each unit when spawning.

**`on_death` handling:** `on_death` is not checked in `act()` (a dead unit can't act). Instead, `Battle.onUnitDeath(u)` checks if `u.abilityTrigger === "on_death"` and fires the ability once. This covers: explode (AoE damage on death), heal_burst (AoE heal on death), and any future on-death effects.

**Passive ability handling:** Passive abilities (`lifesteal`, `rage`, `slow`, `dodge`, `splash`, `poison`) are applied in `Battle.attack()` and `Battle.takeDamage()` — not via the trigger system. `lifesteal` heals the attacker on hit, `rage` scales the attacker's damage, `slow` debuffs the target, `dodge` is checked before applying damage, `splash`/`poison` are applied to the target on hit.

**No preset system.** Starter units, bot units, and LLM units all use the same 5 behaviour fields directly. There is no `mode` or `preset` indirection — `Battle.act()` always reads `u.targeting`, `u.movement`, `u.attackCondition`, `u.abilityTrigger`, `u.moveSpeedMod`. One system, one code path.

**Why this is better than fixed modes for the LLM:**
- The LLM picks 5 simple enum values instead of 1 complex mode — easier for a 0.5B model (each field is a short classification question).
- 20,160 combinations means LLM units feel truly unique, not bucketed into 7 archetypes.
- Interesting emergent behaviours appear from novel combinations:
  - `targeting: highest_hp` + `movement: chase` + `moveSpeedMod: 150` → a "berserker" that charges the tankiest enemy
  - `targeting: enemy_carry` + `movement: hold` + `attackCondition: only_if_target_low` → an "executioner" sniper that waits for the carry to be low, then finishes them
  - `targeting: lowest_ally` + `movement: hold_midpoint` + `abilityTrigger: when_ally_hurt` → a "bodyguard" that holds the line and heals
  - `targeting: enemy_backline` + `movement: chase` + `moveSpeedMod: 120` + `ability: heal_burst` + `abilityTrigger: on_death` → a "pumpkin" that rolls into the backline, flattens squishies, and explodes in a healing shower on death
  - `ability: lifesteal` + `abilityTrigger: never` + `movement: chase` → a "vampire" that sustains itself by attacking
  - `ability: rage` + `abilityTrigger: never` + `attackCondition: only_if_healthy` → a "berserker" that fights aggressively while healthy and hits harder as it takes damage
- The semantic validator (Phase 12) can catch nonsensical combinations (e.g. `targeting: lowest_ally` + `attackCondition: always` = attacking allies, which is wrong).

**`Battle.act()` signature change:** now takes `allies` in addition to `enemies` (needed for `lowest_ally` targeting and `when_ally_hurt` trigger). `Battle.update()` passes both arrays.

### Other changes
- Add `role` field: `"frontline" | "carry" | "support" | "counter" | "utility"`. Used by `enemy_carry`/`enemy_support` targeting and synergy hints (Phase 16).
- `movement: hold` means the unit never moves regardless of its `speed` value. Speed is irrelevant for this movement type. (A static sniper can have speed=30; it doesn't matter.)
- `movement: hold_midpoint` uses **relative Y coordinates**: `canvasH * 0.6` for player, `canvasH * 0.4` for enemy — works on any viewport size.
- **Starter roster** — 6 hand-authored units. Each sets the 5 behaviour fields directly (same API the LLM uses). Stats changed from v4 — Engineer replaces Plague.

**Behaviour:**

| Name | targeting | movement | attackCondition | abilityTrigger | moveSpeedMod |
|---|---|---|---|---|---|
| Knight | closest | hold_midpoint | always | on_cooldown | 80 |
| Archer | closest | kite | always | never | 100 |
| Slash | closest | chase | always | never | 100 |
| Priest | lowest_ally | flee | never | when_ally_hurt | 100 |
| Assassin | lowest_hp | chase | always | on_low_hp | 150 |
| Engineer | closest | flee | always | on_cooldown | 80 |

**Stats:**

| Name | Role | HP | DMG | Range | Speed | AtkSpd | Crit | Ability | Color |
|---|---|---|---|---|---|---|---|---|---|
| Knight | frontline | 110 | 12 | 40 | 50 | 1.0 | 0.05 | `none` | `#44aaff` |
| Archer | carry | 55 | 18 | 170 | 65 | 1.2 | 0.15 | `none` | `#44ff44` |
| Slash | counter | 70 | 24 | 35 | 85 | 1.0 | 0.10 | `splash` | `#ff4444` |
| Priest | support | 65 | 10 | 100 | 50 | 1.5 | 0.05 | `heal` | `#ffdd44` |
| Assassin | counter | 45 | 20 | 30 | 110 | 0.8 | 0.30 | `dodge` | `#ff44ff` |
| Engineer | utility | 60 | 8 | 90 | 45 | 1.3 | 0.05 | `spawn` | `#ff8844` |

(Changes from v4: Knight hp 90→110, dmg 14→12, speed 70→50; Archer dmg 20→18, speed 60→65; Slash dmg 26→24; 6th unit Plague→Engineer. Priest keeps dmg=10 — `attackCondition: never` means she won't attack by default, but a forged support unit with `attackCondition: always` can fight. The API makes it a choice, not a hardcoded rule.)

- The old `G.enemy` array (line ~820) is **removed**. Enemies are now bot opponents that draft from the starter roster (or arena-themed pools in Phase 15). The 4 old enemy types (Guard, Mage, Cultist, Ranger) are no longer hardcoded — if they're wanted as distinct units, they should be added to the starter roster or arena bot pools. For Tier 1, the bot drafts from the same 6 starters the player has.

- `validateAIUnit()` (line ~389) — **renamed to `validateUnit(unit, arenaIndex)`**. Validates the 5 behaviour fields (each must be in its enum) + role + clamped params. One function used by starter units, bot units, and LLM units. Arena index optional (defaults to 0 = Training Yard clamps). Phase 15 makes the clamps arena-dependent.
- **Hide the forge button in Tier 1.** The current forge button (HTML line ~101 area) and `G.forge()` (line ~1137) are hidden/disabled. Set `display:none` on the forge button in `G.init()` when Tier 2 (Phase 12) is not yet implemented. Re-enabled in Phase 12. This prevents users from hitting the broken v4 forge flow.

### Code touchpoints
- `Battle.act()` (line ~583) — rewrite as the 4-line composition above (lookup-table dispatch).
- `Battle.update()` — **rewrite to single `this.units` array** (was `this.units` + `this.enemies` as separate arrays). Split by `u.team` each frame to build `players`/`enemies` arrays for `act()`. Add `onUnitDeath(u)` hook for `on_death` ability triggers. Death cleanup: remove units with `deathT >= 0.5`.
- `Battle.start()` — set `u.team = "player"` or `"enemy"` on each unit when spawning. Set `Battle.canvasH = canvas.height` (used by `hold_midpoint` movement — relative Y coordinates).
- `Battle.attack()` — extend existing `dealDamage()` (line ~626): add `lifesteal` (heal attacker), `rage` (scale damage by missing HP), `slow` (debuff target) on top of existing dodge/crit/splash/poison. Rename `dealDamage` → `takeDamage` for clarity (it's called on the target, not the attacker). Keep existing projectile logic (ranged units fire projectiles, melee deal damage instantly).
- `Battle.takeDamage()` — check `dodge` (50% skip, up from current 20%), `shield` (immune if active). Existing dodge/splash/poison logic stays; shield is new.
- `Battle.initRuntime()` (line ~505) — add `patrolT` (for patrol movement), `moveSpeedMod` default 100, `firstHitUsed` (for `on_first_hit`), `shieldActive` (for shield ability), `rageBonus` (cached rage multiplier). Also add `u.mh = u.h` (max HP, used by rage/health checks) and `u.team` (set in `Battle.start()` to `"player"` or `"enemy"` — needed for `enemy_backline`/`enemy_frontline` targeting and `hold_midpoint` movement). Also add `u.deathT = undefined` (death animation timer, set when HP hits 0).
- `G.base` (line ~812) — add `targeting`/`movement`/`attackCondition`/`abilityTrigger`/`moveSpeedMod` + `role` to each unit. Replace Plague with Engineer. No `preset` or `mode` field — just the 5 behaviour fields directly.
- `G.enemy` (line ~820) — **remove**. Bot opponents draft from `G.base` (or arena pools in Phase 15). No separate enemy array.
- `unit()` factory — accept/normalize the 5 behaviour fields + `role`. Defaults: `targeting:"closest", movement:"chase", attackCondition:"always", abilityTrigger:"never", moveSpeedMod:100`.
- `G.init()` — hide forge button (`$("forgeButton").style.display="none"` or equivalent).
- New `spawn` ability handling in `Battle.update()` — owner ticks spawner cooldown, spawns minion with low HP that despawns after N seconds. Minion gets `targeting: closest, movement: chase, attackCondition: always, abilityTrigger: never, moveSpeedMod: 100`.
- New `explode` ability in `Battle.onUnitDeath()` — AoE damage to enemies within 60px.
- New `heal_burst` ability in `Battle.triggerAbility()` / `onUnitDeath()` — AoE heal to allies within 60px.
- New `shield` ability in `Battle.triggerAbility()` — set `u.shieldActive = 2.0` (2s immunity), decrement in `update()`.
- New lookup tables: `TARGETING`, `MOVEMENT`, `ATTACK_CONDITIONS`, `ABILITY_TRIGGERS` (~120 lines total with the expanded enums).
- New `PASSIVE_ABILITIES` set + `TRIGGERED_ABILITIES` set — used by `Battle.attack()` and `triggerAbility()` to dispatch correctly.

### Runtime invariants & minor details
- **`R()` determinism:** `R()` is the existing seeded RNG (already used in v4 for dodge/crit). Only the host runs `act()`; P2P guests apply snapshots. Bot matches are local (no sync needed). Use `R()` consistently in all battle code for reproducibility.
- **`Battle.canvasH`:** set in `Battle.start()` from the canvas element. Updated on resize if the canvas resizes mid-battle (check in `render()`).
- **Minion stats:** minions spawned by the `spawn` ability use the full 5-field API: `{targeting:"closest", movement:"chase", attackCondition:"always", abilityTrigger:"never", moveSpeedMod:100, h:20, d:5, r:20, s:50, a:1, ttl:5, team:u.team}`. TTL decremented in `update()`; removed when `ttl <= 0`.
- **Poison/slow/shield ticking in `update()`:** each frame, decrement `u.slow` (if >0), `u.shieldActive` (if >0), apply poison damage (`u.poison` decremented, `u.h -= 1` every 0.5s while `u.poison > 0`). These are status effects, not abilities — handled in `update()` after `act()`.
- **`normalizePrompt(s)`:** `s.trim().toLowerCase()`. Used for cache key + fusion matching.
- **`cacheKey(prompt, modelId)`:** `${prompt}:${modelId}`. IndexedDB key for the unit spec cache.
- **Phase 11 FX channel:** Phase 11's keyframe format has an `fx` channel, but the FX system (Phase 17) doesn't exist yet. Phase 11's `SpriteRenderer` treats `fx` keyframes as no-ops (skip). Phase 17 adds `BattleFX.fireRecipeFx()` and wires it into the renderer.
- **`maxLength` on `name` field:** web-llm's grammar sampler may not enforce `maxLength: 20` on strings. The `FIELD_PARSERS.name` parser truncates to 20 chars as a safety net.
- **Helper functions to extract:** the current code uses inline distance/movement (e.g. `Math.hypot(dx,dy)`, `attacker.x += (dx/dist)*speed*dt`). Phase 10 extracts these into named helpers used by the lookup tables: `dist(a,b)` → `Math.hypot(a.x-b.x, a.y-b.y)`, `moveToward(u,t,d)` → normalize + move, `moveAway(u,t,d)` → normalize + move opposite, `closestEnemy(u,enemies)` → replaces `Battle.closest()`, `lowestBy(arr,fn)` / `highestBy(arr,fn)` → min/max by predicate. Also `lighten(hex,amt)` and `scaleShape(shape,scale)` for the RecipeAssembler. All trivial (~30 lines total).
- **Team field migration:** current code uses numeric `team` (0=player, 1=enemy) in `Battle.units` / `Battle.enemies` as separate arrays. Phase 10 migrates to string `team` (`"player"` / `"enemy"`) in a single `this.units` array. This affects: `act()`, `attack()` (projectile team check at line ~652), `updateProjectiles()`, `healAllies()`, and snapshot serialization. All `team===0` / `team===1` checks become `team==="player"` / `team==="enemy"`.
- **`R()` consistency:** the current code uses `R()` (a seeded RNG) for dodge, crit, etc. All new battle code (`Battle.attack()`, `triggerAbility()`, lookup tables) also uses `R()` — not `Math.random()`. This keeps the codebase consistent. Since only the host runs `act()` and guests apply snapshots, determinism is preserved regardless.

---

## Phase 11 — Procedural Sprite System

**Today:** `Battle.render()` (line ~708) draws units as solid colored circles. No articulation, no animation states.

### Changes
- New `SpriteRenderer` object that interprets a visual recipe (shapes + animations) and draws it on the canvas.

**Coordinate system:** all shape positions are relative to the unit's center `(u.x, u.y)`. Shape `(x, y)` is an offset from center. Y is down (canvas convention). Shapes are drawn in array order (later shapes on top).

**Shape types** (each is a plain object drawn with canvas 2D primitives):
- `circle`: `{t:"circle", cx, cy, r, c}` → `arc(cx, cy, r, 0, 2π)` + fill
- `rect`: `{t:"rect", x, y, w, h, c, joint?}` → `fillRect(x, y, w, h)`
- `line`: `{t:"line", x1, y1, x2, y2, c, w, name?}` → `moveTo(x1,y1)` + `lineTo(x2,y2)` + `lineWidth=w` + stroke
- `polygon`: `{t:"polygon", pts:[[x,y]...], c}` → `moveTo`/`lineTo` chain + fill
- `arc`: `{t:"arc", cx, cy, r, start, end, c, w}` → partial arc (for bows, horns)

**Joint system** (skeletal animation):
- A shape with a `joint` field (e.g. `"shoulder_r"`) has a **pivot point** at its top-center (for rects: `(x + w/2, y)`).
- The joint's rotation/offset is driven by **named transform channels** in the animation keyframes. Channel names are free-form strings the LLM picks (`arm_raise`, `leg_swing`, `bow_draw`).
- At render time, for each jointed shape:
  1. Look up the channel value from the interpolated animation state (e.g. `arm_raise = 0.7`).
  2. Translate to the pivot point: `ctx.translate(pivotX, pivotY)`.
  3. Rotate by `channelValue * maxAngle` (e.g. `arm_raise` maps to 0-90° rotation).
  4. Draw the shape relative to the pivot.
  5. Restore transform.
- Channel-to-angle mapping is hardcoded per channel name in a lookup table: `{arm_raise: 90°, leg_swing: 30°, bow_draw: 15°, head_tilt: 20°, ...}`. Unknown channels default to 30°. This keeps the LLM's output interpretable without it needing to specify angles.

**Keyframe interpolation:**
- Each animation state (`idle`, `move`, `attack`, `death`) is an array of keyframes: `[{t:0, arm_raise:0, bob:0}, {t:0.5, arm_raise:1, bob:1}, {t:1, arm_raise:0, bob:0}]`.
- `t` is normalized 0-1 time. The renderer computes the current `t` from elapsed time and the animation's loop duration:
  - `idle`: 2s loop, always playing
  - `move`: 0.6s loop, plays when unit is moving
  - `attack`: 0.4s one-shot, plays when `cool` resets (attack triggered)
  - `death`: 0.5s one-shot, plays once when HP hits 0
- Interpolation between keyframes is **linear lerp** for numeric channels. For the `fx` channel (a string trigger like `"fx":"arrow"`), fire the FX when the keyframe is crossed (not interpolated). **Note:** in Phase 11, `fx` keyframes are no-ops (the FX system doesn't exist yet). Phase 17 wires `BattleFX.fireRecipeFx()` into the renderer to handle them.
- `SpriteRenderer.interpolate(keyframes, t)` → returns a flat object of channel values at time `t`.

**State selection** in `Battle.render()`:
```
if u.h <= 0:           state = "death", t = u.deathT (0→1 over 0.5s)
else if u.attackedThisFrame: state = "attack", t = u.attackT (0→1 over 0.4s)
else if u.movedThisFrame:    state = "move", t = (Battle.time / 0.6) % 1
else:                   state = "idle", t = (Battle.time / 2.0) % 1
```

**Fallback:** if a unit has no `recipe` field, fall back to the current circle rendering (colored circle + HP bar + status rings). This covers legacy migrated units and any validation-failed LLM output.

**Performance:** 6-10 shapes × ~12 units = ~120 shape draws per frame. Each shape is 1-3 canvas calls. ~360 canvas calls per frame — well within budget for canvas 2D at 30-60 FPS. No images, no filters, no shadows. Joint transforms use `save()`/`restore()` (cheap).

### Starter unit recipes
- Hand-author visual recipes for the 6 starter units so the game looks good even before the LLM is loaded.
- Knight: helmet (circle) + armor body (rect) + shield (rect) + sword (line). Attack = sword swing.
- Archer: head + body + arms + legs + bow. Attack = draw bow + release.
- Slash: head + body + arms holding sword. Attack = overhead slash.
- Priest: head + robe (trapezoid) + staff (line). Attack = staff raise + heal glow.
- Assassin: head + dark body + daggers (2 lines). Attack = dual stab.
- Engineer: head + body + wrench (line). Attack = wrench swing + machine spawn.

### Code touchpoints
- New `SpriteRenderer` object (~150 lines) near `Battle`.
- `Battle.render()` (line ~708) — replace circle drawing with `SpriteRenderer.draw()` for units that have a recipe; keep circle fallback.
- `unit()` factory — accept `recipe` field (visual recipe object).
- `G.base` (line ~809) — add hand-authored `recipe` to each starter unit.
- `Battle.initRuntime()` (line ~502) — add `animState` ("idle"/"move"/"attack"/"death"), `animT` (animation time), `attackT` (attack animation trigger).

---

## Phase 12 — LLM Integration

**Today:** The forge (line ~1137) generates flat stats via a generic prompt. The current model is `Llama-3.2-1B-Instruct-q4f32_1-MLC` (line 323). The `@mlc-ai/web-llm` import is already correct (lines 176-178, multi-CDN). The forge button is hidden in Tier 1 (Phase 10). This phase re-enables it as an ad-gated LLM unit forge.

### Architecture: Hybrid JSON-mode-first + per-field fallback

WebLLM v0.2.84 supports `response_format: { type: "json_object", schema: <JSON schema string> }` — a WebAssembly grammar sampler that **forces** the LLM to emit valid JSON matching our exact schema. This eliminates the structural failure mode (malformed JSON, dropped fields, invalid enum values) that motivated the pure per-field approach.

**The hybrid approach:**
1. **JSON mode call first** (1 call, ~5-10s) — grammar-constrained, guaranteed valid structure + enum values + integer ranges.
2. **Semantic validation** (instant, no LLM) — cross-field consistency checks (carry shouldn't have hp=200, bow should produce projectile FX, etc.).
3. **Per-field fallback** (only for semantically inconsistent fields, ~2-5s each) — targeted micro-prompts to re-ask just the bad fields.
4. **Recipe assembler** builds the visual recipe from the final attributes.

**Why hybrid (not pure JSON mode):** The grammar sampler guarantees *structural* validity but not *semantic* validity. A 0.5B model might emit `{"role":"carry","hp":180}` — structurally valid JSON matching the schema, but semantically wrong (carries are squishy, hp should be 30-80). The per-field fallback catches and fixes these semantic errors without paying the cost of 15 separate calls for every forge.

**Why hybrid (not pure per-field):** The per-field approach (17 calls, ~35s) is reliable but slow. JSON mode gets all 17 fields in one call (~5-10s). Most fields will be semantically correct on the first try — only 2-4 typically need re-asking. Total: ~10-20s typical, vs ~35s for pure per-field.

**Performance comparison:**

| Approach | Calls | Best case | Typical case | Worst case |
|---|---|---|---|---|
| Pure JSON mode | 1 | ~5s | ~5s (no semantic errors) | ~5s (but semantically wrong, uncaught) |
| Pure per-field | 17 | ~25s | ~35s | ~85s |
| **Hybrid** | 1 + 0-4 | ~5s | ~10-20s | ~25s (1 + 4 fallback calls) |
| Template fallback | 0 | instant | instant | instant |

The hybrid is strictly better: fastest in the common case, no worse than per-field in the worst case, and catches semantic errors that pure JSON mode would miss.

This pattern is informed by the macsand project (`/Users/tassio/macsand/WEBLLM_MATERIAL_PLAN.md`), which uses per-field micro-prompts with Qwen2.5-1.5B. The macsand plan notes that WebLLM's JSON mode "could replace the 18 per-field calls with a single LLM call — ~18x faster generation with guaranteed valid JSON." We're taking that improvement but keeping per-field as a fallback for semantic correctness.

#### Step 1: Web Worker (LLM off the main thread)

LLM inference takes 5-25s per generation. Running on the main thread would freeze the game. Use `CreateWebWorkerMLCEngine` (official web-llm pattern) to run the engine in a dedicated Web Worker.

Since we're a single-file `index.html` (no bundler), the worker is created from a Blob URL:

```js
const workerCode = `
  import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";
  const handler = new WebWorkerMLCEngineHandler();
  self.onmessage = (msg) => handler.onmessage(msg);
`;
const blob = new Blob([workerCode], { type: "application/javascript" });
const worker = new Worker(URL.createObjectURL(blob), { type: "module" });
const engine = await CreateWebWorkerMLCEngine(worker, MODEL_ID, {
  initProgressCallback: (r) => updateAI("Downloading AI " + Math.floor(r.progress * 100) + "%", r.progress * 100),
});
```

#### Step 2: JSON schema for grammar-constrained generation

The LLM emits a **flat object of attributes** (not the nested visual recipe — the RecipeAssembler builds that). The schema uses enums for all categorical fields and integer ranges for stats. Colors use **named color enums** (not hex strings) to avoid regex pattern limitations in the grammar sampler and to be easier for a small model to answer correctly.

**Key design decisions:**
- `name` is in the schema (eliminates the separate `askName` call — saves 1 LLM call).
- `mode` is replaced by the 5 **Behaviour Composition API** fields from Phase 10 (`targeting`, `movement`, `attackCondition`, `abilityTrigger`, `moveSpeedMod`). This gives the LLM rich behaviour control via simple enums.
- `fxType` is **derived from `weaponType`** (not in the schema) — bow→projectile, staff→flash, hammer→burst, sword/dagger/claws→none, shield→flash, none→none. One less field for the LLM to get wrong.
- `atkSpd` and `crit` are **derived from role + speed** (not in the schema) — see derivation rules below. The LLM doesn't need to understand attack-speed balance; we derive it from the role it picked.
- Colors reduced from 4 to 2 (`primaryColor`, `accentColor`) — `headColor` is derived from `primaryColor` (lighten 20%), `weaponColor` is derived from `weaponType` (fixed palette per weapon). Fewer fields = less chance of semantic error.

```json
{
  "type": "object",
  "properties": {
    "name":           {"type": "string", "maxLength": 20},
    "role":           {"type": "string", "enum": ["frontline", "carry", "support", "counter", "utility"]},
    "targeting":      {"type": "string", "enum": ["closest", "lowest_hp", "highest_hp", "enemy_carry", "enemy_support", "enemy_backline", "enemy_frontline", "enemy_cluster", "lowest_ally", "random"]},
    "movement":       {"type": "string", "enum": ["chase", "flee", "hold", "hold_midpoint", "kite", "patrol"]},
    "attackCondition":{"type": "string", "enum": ["always", "only_if_healthy", "only_if_target_low", "never"]},
    "abilityTrigger": {"type": "string", "enum": ["on_cooldown", "when_ally_hurt", "when_surrounded", "on_low_hp", "on_death", "on_first_hit", "never"]},
    "moveSpeedMod":   {"type": "integer", "minimum": 50, "maximum": 150},
    "hp":             {"type": "integer", "minimum": 10, "maximum": 200},
    "dmg":            {"type": "integer", "minimum": 5, "maximum": 50},
    "range":          {"type": "integer", "minimum": 30, "maximum": 250},
    "speed":          {"type": "integer", "minimum": 30, "maximum": 120},
    "ability":        {"type": "string", "enum": ["none", "splash", "heal", "dodge", "poison", "spawn", "lifesteal", "explode", "heal_burst", "shield", "rage", "slow"]},
    "bodyPlan":       {"type": "string", "enum": ["humanoid", "quadruped", "blob", "flying", "mechanical", "structure"]},
    "weaponType":     {"type": "string", "enum": ["none", "sword", "bow", "staff", "dagger", "shield", "hammer", "claws"]},
    "primaryColor":   {"type": "string", "enum": ["green", "blue", "red", "purple", "yellow", "orange", "black", "white", "brown", "gray", "pink", "cyan"]},
    "accentColor":    {"type": "string", "enum": ["green", "blue", "red", "purple", "yellow", "orange", "black", "white", "brown", "gray", "pink", "cyan"]},
    "sizeMod":        {"type": "string", "enum": ["small", "medium", "large"]}
  },
  "required": ["name", "role", "targeting", "movement", "attackCondition", "abilityTrigger", "moveSpeedMod", "hp", "dmg", "range", "speed", "ability", "bodyPlan", "weaponType", "primaryColor", "accentColor", "sizeMod"]
}
```

**17 required fields** — all enums or bounded integers. The grammar sampler guarantees valid values for all of them. The enums are larger now (targeting has 10 options, ability has 12) but the grammar sampler handles this fine — web-llm examples use 10+ option enums without issue.

**Named color → hex mapping** (lookup table, not LLM's job):
```js
const COLOR_MAP = {
  green: "#4a7", blue: "#48f", red: "#f44", purple: "#a4f",
  yellow: "#fd4", orange: "#f84", black: "#222", white: "#eee",
  brown: "#a72", gray: "#888", pink: "#f6c", cyan: "#0ff"
};

// Derived colors (not from LLM):
function deriveHeadColor(primaryHex) { /* lighten primary by 20% */ }
const WEAPON_COLOR = { sword:"#ccc", bow:"#a72", staff:"#fb0", dagger:"#ccc", shield:"#ccc", hammer:"#888", claws:"#ccc", none:"#888" };

// Derived FX (not from LLM):
const WEAPON_FX = { bow:"projectile", staff:"flash", hammer:"burst", sword:"none", dagger:"none", shield:"flash", claws:"none", none:"none" };

// Derived stats (not from LLM):
function deriveAtkSpd(attrs) {
  // carries attack fast, frontline attacks slow, speed contributes
  const base = attrs.role === "carry" ? 1.2 : attrs.role === "frontline" ? 0.8 : 1.0;
  return clamp(base + (attrs.speed - 60) * 0.005, 0.5, 2.5);
}
function deriveCrit(attrs) {
  // carries and counters have high crit, frontline/support have low
  const base = attrs.role === "carry" ? 0.15 : attrs.role === "counter" ? 0.20 : 0.05;
  return clamp(base + (attrs.movement === "chase" && attrs.moveSpeedMod >= 150 ? 0.05 : 0), 0, 0.4);
}
```

**Why named colors (not hex):** The grammar sampler's regex pattern support for arbitrary strings is limited and slow. Enum-constrained named colors are guaranteed valid by the grammar, easier for a 0.5B model to answer ("green" vs "#4a7"), and map to hex via a simple lookup. The trade-off is less color variety (12 options vs 16M hex values), but 12 well-chosen colors cover the visual space adequately for small sprites.

**Why derived fields (fxType, atkSpd, crit, headColor, weaponColor):** Every field removed from the schema is one less chance for the 0.5B model to produce a semantically wrong value. These fields are deterministic functions of fields the LLM does control (weaponType, role, speed, primaryColor) — the LLM picks the concept, we handle the details. This is the same principle as the RecipeAssembler: the LLM picks attributes, code builds the spec.

#### Step 3: JSON mode call

```js
const request = {
  stream: false,
  messages: [
    {
      role: "system",
      content: "You are a game unit designer for a top-down auto-battler. Given a unit concept, output a JSON object with the unit's name, combat behaviour, stats, and visual appearance. Pick values that fit the concept. The targeting, movement, attackCondition, abilityTrigger, and moveSpeedMod fields together define how the unit fights — choose combinations that make sense for the unit."
    },
    {
      role: "user",
      content: `Design a unit based on: "${prompt}". Choose a name, role, behaviour (targeting, movement, attackCondition, abilityTrigger, moveSpeedMod), stats (hp, dmg, range, speed), ability, body plan, weapon, colors, and size. All fields are required.`
    }
  ],
  max_tokens: 300,
  temperature: 0.7,
  response_format: {
    type: "json_object",
    schema: UNIT_SCHEMA  // the JSON schema string from Step 2
  }
};
const reply = await engine.chat.completions.create(request);
const attrs = JSON.parse(reply.choices[0].message.content);
```

The grammar sampler guarantees:
- Valid JSON (no malformed output)
- All 17 required fields present
- Enum values are valid (no `"targeting": "fly"` — must be one of the 7 options)
- Integers are in range (no `hp: 9999` — clamped to 10-200 by the grammar)
- `name` is a string with ≤20 chars

What the grammar sampler does **not** guarantee:
- Semantic correctness (archer with `hp: 180` is structurally valid but wrong)
- Cross-field consistency (`targeting: lowest_ally` + `attackCondition: always` is valid but means attacking allies)

#### Step 4: Semantic validation (cross-field consistency)

After the JSON mode call, validate the attributes for **semantic consistency** — not structural validity (the grammar handled that). Flag fields that need re-asking:

```js
const CONSISTENCY_RULES = [
  // Role ↔ HP: carries are squishy, frontline is tanky
  { if: a => a.role === "carry"     && a.hp > 80,  flag: "hp",     reason: "carry should be squishy (hp 30-80)" },
  { if: a => a.role === "frontline" && a.hp < 80,  flag: "hp",     reason: "frontline should be tanky (hp 80-200)" },
  { if: a => a.role === "support"   && a.hp > 100, flag: "hp",     reason: "support should be moderate (hp 40-100)" },

  // Movement ↔ Speed: chase + high moveSpeedMod = diver (fast), hold = slow
  { if: a => a.movement === "chase" && a.moveSpeedMod >= 150 && a.speed < 80, flag: "speed", reason: "divers (chase + 150% speed) should be fast (80-120)" },
  { if: a => a.movement === "hold"  && a.speed > 60, flag: "speed", reason: "static units (hold) don't need speed (30-60)" },

  // Targeting ↔ AttackCondition: can't attack allies
  { if: a => a.targeting === "lowest_ally" && a.attackCondition !== "never", flag: "attackCondition", reason: "targeting allies but attacking = friendly fire" },

  // AbilityTrigger ↔ Ability: can't trigger an ability you don't have
  { if: a => a.ability === "none" && a.abilityTrigger !== "never", flag: "abilityTrigger", reason: "no ability but trigger is set" },
  { if: a => a.ability === "heal" && a.abilityTrigger !== "when_ally_hurt" && a.abilityTrigger !== "on_cooldown", flag: "abilityTrigger", reason: "heal ability should trigger when allies hurt or on cooldown" },
  { if: a => a.ability === "spawn" && a.abilityTrigger !== "on_cooldown", flag: "abilityTrigger", reason: "spawn ability should trigger on cooldown" },

  // Passive abilities must have trigger: never (they're always active, not triggered)
  { if: a => ["lifesteal","rage","slow","splash","dodge","poison"].includes(a.ability) && a.abilityTrigger !== "never", flag: "abilityTrigger", reason: "passive abilities (lifesteal/rage/slow/splash/dodge/poison) don't trigger — set to never" },

  // Triggered abilities need a real trigger (not never)
  { if: a => ["heal","spawn","explode","heal_burst","shield"].includes(a.ability) && a.abilityTrigger === "never", flag: "abilityTrigger", reason: "triggered abilities need a trigger (on_cooldown, on_death, etc.)" },

  // explode pairs with on_death (suicide bomber) or on_cooldown (recharge bomber)
  { if: a => a.ability === "explode" && !["on_death","on_cooldown"].includes(a.abilityTrigger), flag: "abilityTrigger", reason: "explode should trigger on_death or on_cooldown" },

  // heal_burst: on_death = healing shower, on_cooldown = periodic AoE heal, when_ally_hurt = reactive AoE heal
  { if: a => a.ability === "heal_burst" && !["on_death","on_cooldown","when_ally_hurt"].includes(a.abilityTrigger), flag: "abilityTrigger", reason: "heal_burst should trigger on_death, on_cooldown, or when_ally_hurt" },

  // shield is defensive — pairs with on_low_hp (turtle) or on_first_hit (cloak-like)
  { if: a => a.ability === "shield" && !["on_low_hp","on_first_hit"].includes(a.abilityTrigger), flag: "abilityTrigger", reason: "shield should trigger on_low_hp or on_first_hit" },

  // Movement ↔ Range: kite needs high range, chase needs low range
  { if: a => a.movement === "kite"  && a.range < 100, flag: "range", reason: "kiting needs long range (100+)" },
  { if: a => a.movement === "chase" && a.range > 80,  flag: "range", reason: "chasing melee should have low range (30-80)" },

  // Role ↔ Targeting: supports target allies, carries target enemies
  { if: a => a.role === "support" && !["lowest_ally", "closest"].includes(a.targeting), flag: "targeting", reason: "support should target allies or closest" },
  { if: a => a.role === "carry"   && a.targeting === "lowest_ally", flag: "targeting", reason: "carry should target enemies, not allies" },

  // structure body plan should be immobile
  { if: a => a.bodyPlan === "structure" && a.movement !== "hold", flag: "movement", reason: "structures don't move (use hold)" },
];

function semanticValidate(attrs) {
  const flagged = new Set();
  for (const rule of CONSISTENCY_RULES) {
    if (rule.if(attrs)) flagged.add(rule.flag);
  }
  return [...flagged];
}
```

Typically 0-4 fields get flagged. The grammar already guaranteed structural validity, so we only re-ask fields that are semantically inconsistent.

#### Step 5: Per-field fallback (only for flagged fields)

For each flagged field, send a **targeted micro-prompt** that includes the context the LLM needs to answer correctly. These are the same `FIELD_PROMPTS` used by the pure per-field fallback (Step 9) — one prompt table, used by both paths:

```js
const FIELD_PROMPTS = {
  name:           (prompt) => `Give a short name (max 20 chars) for a unit based on: "${prompt}". Answer with the name only.`,
  role:           (name, attrs) => `A ${name} — is it a frontline, carry, support, counter, or utility? Answer with one word.`,
  targeting:      (name, attrs) => `A ${name} is a ${attrs.role}. Who should it target: closest, lowest_hp, highest_hp, enemy_carry, enemy_support, enemy_backline, enemy_frontline, enemy_cluster, lowest_ally, random? Answer with one word.`,
  movement:       (name, attrs) => `A ${name} is a ${attrs.role}. How should it move: chase, flee, hold, hold_midpoint, kite, patrol? Answer with one word.`,
  attackCondition:(name, attrs) => `A ${name} targets ${attrs.targeting}. When should it attack: always, only_if_healthy, only_if_target_low, never? Answer with one word.`,
  abilityTrigger: (name, attrs) => `A ${name} has ability ${attrs.ability}. When should it trigger: on_cooldown, when_ally_hurt, when_surrounded, on_low_hp, on_death, on_first_hit, never? Answer with one word.`,
  moveSpeedMod:   (name, attrs) => `A ${name} moves by ${attrs.movement}. What speed modifier fits, 50 (cautious) to 150 (aggressive)? Answer with a number only.`,
  hp:             (name, attrs) => `A ${name} is a ${attrs.role}. How tough is a typical ${attrs.role}, on a scale of 10-200? Answer with a number only.`,
  dmg:            (name, attrs) => `A ${name} is a ${attrs.role}. How much damage should it deal per hit, 5 (weak) to 50 (strong)? Answer with a number only.`,
  range:          (name, attrs) => `A ${name} moves by ${attrs.movement}. What attack range fits, 30 (melee) to 250 (sniper)? Answer with a number only.`,
  speed:          (name, attrs) => `A ${name} moves by ${attrs.movement}. How fast should a ${attrs.movement} unit be, 30 (slow) to 120 (fast)? Answer with a number only.`,
  ability:        (name, attrs) => `A ${name} triggers abilities ${attrs.abilityTrigger}. What ability fits: none, splash, heal, dodge, poison, spawn, lifesteal, explode, heal_burst, shield, rage, slow? Answer with one word.`,
  bodyPlan:       (name, attrs) => `A ${name} — what body plan fits: humanoid, quadruped, blob, flying, mechanical, structure? Answer with one word.`,
  weaponType:     (name, attrs) => `A ${name} — what weapon fits: none, sword, bow, staff, dagger, shield, hammer, claws? Answer with one word.`,
  primaryColor:   (name, attrs) => `A ${name} — what color fits: green, blue, red, purple, yellow, orange, black, white, brown, gray, pink, cyan? Answer with one word.`,
  accentColor:    (name, attrs) => `A ${name} — what accent color fits: green, blue, red, purple, yellow, orange, black, white, brown, gray, pink, cyan? Answer with one word.`,
  sizeMod:        (name, attrs) => `A ${name} — what size fits: small, medium, large? Answer with one word.`,
};

async function reaskFields(name, attrs, flagged) {
  for (const field of flagged) {
    try {
      const prompt = FIELD_PROMPTS[field](name, attrs);
      const reply = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 32, temperature: 0.7, stream: false
      });
      const answer = reply.choices[0].message.content.trim();
      attrs[field] = FIELD_PARSERS[field](answer);
    } catch {
      // keep the original JSON mode value (already structurally valid)
    }
  }
  return attrs;
}
```

Each fallback call is ~2-5s. With 0-4 flagged fields, total fallback time is 0-20s.

**`FIELD_PARSERS`** — parse LLM text replies into typed values. Used by both `reaskFields()` and the pure per-field fallback (Step 9):
```js
const ENUM_FIELDS = {
  role: ["frontline","carry","support","counter","utility"],
  targeting: ["closest","lowest_hp","highest_hp","enemy_carry","enemy_support","enemy_backline","enemy_frontline","enemy_cluster","lowest_ally","random"],
  movement: ["chase","flee","hold","hold_midpoint","kite","patrol"],
  attackCondition: ["always","only_if_healthy","only_if_target_low","never"],
  abilityTrigger: ["on_cooldown","when_ally_hurt","when_surrounded","on_low_hp","on_death","on_first_hit","never"],
  ability: ["none","splash","heal","dodge","poison","spawn","lifesteal","explode","heal_burst","shield","rage","slow"],
  bodyPlan: ["humanoid","quadruped","blob","flying","mechanical","structure"],
  weaponType: ["none","sword","bow","staff","dagger","shield","hammer","claws"],
  primaryColor: Object.keys(COLOR_MAP),
  accentColor: Object.keys(COLOR_MAP),
  sizeMod: ["small","medium","large"],
};
const INT_FIELDS = { hp:[10,200], dmg:[5,50], range:[30,250], speed:[30,120], moveSpeedMod:[50,150] };

const FIELD_PARSERS = {
  name: (s) => s.trim().slice(0, 20),
  ...Object.fromEntries(Object.entries(ENUM_FIELDS).map(([f, vals]) =>
    [f, (s) => { const v = s.trim().toLowerCase(); return vals.includes(v) ? v : vals[0]; }])),
  ...Object.fromEntries(Object.entries(INT_FIELDS).map(([f, [min, max]]) =>
    [f, (s) => { const n = parseInt(s); return isNaN(n) ? min : Math.max(min, Math.min(max, n)); }])),
};
```
Enum parser: match case-insensitively, fallback to first valid value if no match. Int parser: parse + clamp to range, fallback to min if NaN.

#### Step 6: Recipe assembler

The LLM's visual answers are **attributes**, not shapes. A `RecipeAssembler.build(attrs)` function builds the full visual recipe (shapes + animations + FX) from those attributes using body-plan + weapon templates. Output is the same recipe format Phase 11's `SpriteRenderer` consumes:

```js
const COLOR_MAP = { green:"#44ff44", blue:"#44aaff", red:"#ff4444", purple:"#aa44ff",
  yellow:"#ffdd44", orange:"#ff8844", black:"#444444", white:"#dddddd",
  brown:"#886644", gray:"#888888", pink:"#ff88aa", cyan:"#44ffff" };

const WEAPON_FX = { sword:"none", bow:"projectile", staff:"flash", dagger:"none",
  shield:"none", hammer:"burst", claws:"none", none:"none" };

const BODY_PLANS = {
  humanoid: (c) => ({
    shapes: [
      {t:"circle", cx:0, cy:-18, r:6, c:c.head},        // head
      {t:"rect", x:-5, y:-12, w:10, h:14, c:c.primary}, // torso
      {t:"rect", x:-9, y:-10, w:4, h:10, c:c.primary, joint:"shoulder_l"}, // left arm
      {t:"rect", x:5,  y:-10, w:4, h:10, c:c.primary, joint:"shoulder_r"}, // right arm
      {t:"rect", x:-5, y:2,  w:4, h:10, c:c.primary, joint:"hip_l"},       // left leg
      {t:"rect", x:1,  y:2,  w:4, h:10, c:c.primary, joint:"hip_r"},       // right leg
    ],
    animations: { idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
                  move:[{t:0,leg_swing:0},{t:0.5,leg_swing:1},{t:1,leg_swing:0}],
                  death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}] }
  }),
  quadruped: (c) => ({ /* body + head + 4 legs + tail */ }),
  blob:      (c) => ({ /* large circle + 2 eyes */ }),
  flying:    (c) => ({ /* body + 2 wings + head */ }),
  mechanical:(c) => ({ /* body + head + treads */ }),
  structure: (c) => ({ /* single rect/circle, no joints */ }),
};

const WEAPONS = {
  sword:  { shape:{t:"line", x1:9, y1:-8, x2:16, y2:-16, c:"silver", w:2},
            attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}] },
  bow:    { shape:{t:"arc", cx:12, cy:-10, r:8, start:-1, end:1, c:"brown", w:2},
            attack:[{t:0,bow_draw:0},{t:0.5,bow_draw:1},{t:1,bow_draw:0}] },
  staff:  { shape:{t:"line", x1:8, y1:-12, x2:8, y2:-24, c:"brown", w:2},
            attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}] },
  dagger: { shape:{t:"line", x1:9, y1:-8, x2:13, y2:-12, c:"silver", w:1},
            attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}] },
  shield: { shape:{t:"rect", x:-13, y:-10, w:6, h:10, c:c.accent},
            attack:[{t:0,arm_raise:0},{t:1,arm_raise:0}] },
  hammer: { shape:{t:"rect", x:12, y:-18, w:6, h:6, c:"silver"},
            attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}] },
  claws:  { shape:{t:"line", x1:9, y1:-6, x2:12, y2:-2, c:"silver", w:1},
            attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}] },
  none:   { shape:null, attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}] },
};

const SIZE_SCALE = { small:0.7, medium:1.0, large:1.3 };

function RecipeAssembler_build(attrs) {
  const primary = COLOR_MAP[attrs.primaryColor] || "#888";
  const accent  = COLOR_MAP[attrs.accentColor]  || "#aaa";
  const head    = lighten(primary, 0.2);  // derived
  const weapon  = attrs.weaponType !== "none" ? "silver" : primary;  // derived
  const colors  = { primary, accent, head, weapon };
  const scale   = SIZE_SCALE[attrs.sizeMod] || 1.0;
  const fxType  = WEAPON_FX[attrs.weaponType] || "none";

  const body = BODY_PLANS[attrs.bodyPlan](colors);
  const weaponTpl = WEAPONS[attrs.weaponType];
  const shapes = body.shapes.map(s => scaleShape(s, scale));
  if (weaponTpl.shape) shapes.push(scaleShape(weaponTpl.shape, scale));

  return {
    shapes,
    animations: {
      ...body.animations,
      attack: weaponTpl.attack  // weapon-specific attack animation overrides body default
    },
    fx: fxType !== "none" ? { [fxType]: FX_TEMPLATES[fxType] } : {}
  };
}
```

**Body plans** (hardcoded templates, one per `bodyPlan` value):
- `humanoid`: head (circle) + torso (rect) + 2 arms (rects with shoulder joints) + 2 legs (rects with hip joints) + weapon. 7-9 shapes.
- `quadruped`: body (rect) + head (circle) + 4 legs (rects) + tail (line) + weapon. 7-9 shapes.
- `blob`: single large circle + 2 eyes (small circles) + optional weapon. 3-5 shapes.
- `flying`: body (circle) + 2 wings (arcs) + head + weapon. 5-7 shapes.
- `mechanical`: body (rect) + head (rect) + treads/wheels (circles) + weapon. 6-8 shapes.
- `structure`: single rect or circle, no joints, no weapon. 1-3 shapes. (Immobile — pairs with `movement: hold`.)

**Weapon templates** (added to the body plan based on `weaponType`):
- `sword`: line at right arm, attack = arm_raise + slash
- `bow`: arc + line, attack = bow_draw + release + projectile FX
- `staff`: line, attack = staff_raise + flash FX
- `dagger`: 2 short lines, attack = dual stab
- `shield`: rect on left arm, +20% damage reduction
- `hammer`: large rect on right arm, attack = overhead smash + burst FX
- `claws`: 2 small lines at hands, attack = slash
- `none`: no weapon, attack = punch (arm_raise only)

**Animation templates** (per body plan + weapon combo):
- `idle`: gentle bob (sin wave)
- `move`: leg_swing (alternating hip rotation) + slight bob
- `attack`: weapon-specific (from `WEAPONS[weaponType].attack`) + arm_raise
- `death`: alpha fade 1→0 + rotation 0→90°

**FX templates** (per `fxType`, derived from `weaponType` via `WEAPON_FX`):
- `projectile`: small dot traveling to target, with trail
- `burst`: expanding ring at impact
- `flash`: brief color flash at unit
- `none`: no FX

Colors from the LLM (named) are mapped to hex via `COLOR_MAP`, then applied to the relevant shapes (primaryColor → torso/arms/legs, derived headColor → head, derived weaponColor → weapon, accentColor → trim/details). FX type is derived from weaponType via `WEAPON_FX` lookup. `sizeMod` scales all shape positions/dimensions via `SIZE_SCALE`.

#### Step 7: IndexedDB cache

Same as before — cache generated unit specs keyed by normalized prompt + model ID. Re-forging the same prompt hits the cache instantly (free re-roll).

```js
const DB_NAME = "promptshowdown_llm_cache";
const STORE = "unit_specs";
const SCHEMA_VERSION = 1;  // bump to invalidate cache when schema/prompts change
```

#### Step 8: Generation orchestrator (full hybrid flow)

```js
async function generateUnit(rawPrompt) {
  const prompt = normalizePrompt(rawPrompt);
  const key = cacheKey(prompt, MODEL_ID);

  // 1. Cache hit?
  const cached = await cacheGet(key);
  if (cached) return cached.unit;

  // 2. JSON mode call — all 17 attributes (including name) in one grammar-constrained call
  updateProgress(0, 2, "generating");
  let attrs;
  try {
    attrs = await jsonModeCall(prompt);
  } catch (e) {
    // JSON mode failed (model doesn't support grammar, or call errored)
    // Fall back to pure per-field approach
    attrs = await perFieldFallback(prompt, ALL_FIELDS);
  }

  // 3. Semantic validation — flag inconsistent fields
  const flagged = semanticValidate(attrs);
  if (flagged.length > 0) {
    updateProgress(1, 2, `fixing ${flagged.length} fields`);
    attrs = await reaskFields(attrs.name, attrs, flagged);
  }

  // 4. Map named colors to hex + derive secondary colors/stats
  const primaryHex = COLOR_MAP[attrs.primaryColor] || "#4a7";
  const accentHex = COLOR_MAP[attrs.accentColor] || "#0ff";
  const headHex = deriveHeadColor(primaryHex);
  const weaponHex = WEAPON_COLOR[attrs.weaponType] || "#888";
  const fxType = WEAPON_FX[attrs.weaponType] || "none";
  const atkSpd = deriveAtkSpd(attrs);
  const crit = deriveCrit(attrs);

  // 5. Assemble visual recipe from attributes
  const recipe = RecipeAssembler.build({
    ...attrs,
    primaryHex, accentHex, headHex, weaponHex, fxType
  });

  // 6. Assemble unit with behaviour API fields + derived stats, validate + clamp
  const unit = validateUnit({
    n: attrs.name,
    role: attrs.role,
    targeting: attrs.targeting, movement: attrs.movement,
    attackCondition: attrs.attackCondition, abilityTrigger: attrs.abilityTrigger,
    moveSpeedMod: attrs.moveSpeedMod,
    hp: attrs.hp, dmg: attrs.dmg, range: attrs.range, speed: attrs.speed,
    a: atkSpd, crit: crit,
    ability: attrs.ability === "none" ? "" : attrs.ability,
    recipe
  }, save.arena);  // arena index → arena-dependent clamps (Phase 15)

  // 7. Cache
  await cachePut({ key, prompt, modelId: MODEL_ID, unit, generatedAt: Date.now() });

  return unit;
}
```

**Progress UX:** 2 stages — "Generating..." and "Fixing N fields..." (if any). No separate "name" stage since `name` is in the JSON schema. The ad hides most of this.

#### Step 9: Pure per-field fallback (if JSON mode unsupported)

If the model doesn't support grammar (rare — "most models in WebLLM support grammar" per docs) or the JSON mode call errors, fall back to the pure per-field approach — 17 sequential calls using the same `FIELD_PROMPTS` table from Step 5. Each field gets its own micro-prompt call, parsed by `FIELD_PARSERS[field]`. Same prompt table, same parsers — just called for all 17 fields instead of only the flagged ones.

#### Step 10: Template fallback (if no LLM at all)

If WebGPU unavailable, model download skipped/fails, or all LLM calls fail — pick from predefined attribute templates by keyword matching. Each template sets all 17 fields including the behaviour API fields:
- "archer"/"bow"/"hunter" → {role:carry, targeting:closest, movement:kite, attackCondition:always, abilityTrigger:never, moveSpeedMod:100, hp:55, dmg:18, range:170, speed:65, ability:none, bodyPlan:humanoid, weaponType:bow, primaryColor:green, accentColor:green, sizeMod:medium}
- "tank"/"knight"/"warrior"/"guard" → {role:frontline, targeting:closest, movement:hold_midpoint, attackCondition:always, abilityTrigger:on_low_hp, moveSpeedMod:80, hp:110, dmg:12, range:40, speed:50, ability:shield, bodyPlan:humanoid, weaponType:shield, primaryColor:blue, accentColor:white, sizeMod:large}
- "mage"/"wizard"/"sorcerer" → {role:carry, targeting:enemy_cluster, movement:hold, attackCondition:always, abilityTrigger:on_cooldown, moveSpeedMod:50, hp:80, dmg:20, range:140, speed:40, ability:splash, bodyPlan:humanoid, weaponType:staff, primaryColor:purple, accentColor:cyan, sizeMod:medium}
- "assassin"/"rogue"/"ninja" → {role:counter, targeting:lowest_hp, movement:chase, attackCondition:always, abilityTrigger:on_low_hp, moveSpeedMod:150, hp:45, dmg:22, range:30, speed:110, ability:dodge, bodyPlan:humanoid, weaponType:dagger, primaryColor:black, accentColor:red, sizeMod:small}
- "healer"/"priest"/"cleric" → {role:support, targeting:lowest_ally, movement:flee, attackCondition:never, abilityTrigger:when_ally_hurt, moveSpeedMod:100, hp:65, dmg:10, range:100, speed:50, ability:heal, bodyPlan:humanoid, weaponType:staff, primaryColor:yellow, accentColor:white, sizeMod:medium}
- "engineer"/"builder"/"mech" → {role:utility, targeting:closest, movement:flee, attackCondition:always, abilityTrigger:on_cooldown, moveSpeedMod:80, hp:60, dmg:8, range:90, speed:45, ability:spawn, bodyPlan:mechanical, weaponType:hammer, primaryColor:orange, accentColor:gray, sizeMod:medium}
- "vampire"/"dracula"/"leech" → {role:counter, targeting:closest, movement:chase, attackCondition:always, abilityTrigger:never, moveSpeedMod:120, hp:70, dmg:16, range:35, speed:80, ability:lifesteal, bodyPlan:humanoid, weaponType:dagger, primaryColor:red, accentColor:black, sizeMod:medium}
- "berserker"/"barbarian" → {role:frontline, targeting:highest_hp, movement:chase, attackCondition:always, abilityTrigger:never, moveSpeedMod:140, hp:90, dmg:18, range:35, speed:90, ability:rage, bodyPlan:humanoid, weaponType:hammer, primaryColor:orange, accentColor:red, sizeMod:large}
- "bomber"/"grenadier"/"suicide" → {role:counter, targeting:enemy_cluster, movement:chase, attackCondition:never, abilityTrigger:on_death, moveSpeedMod:130, hp:50, dmg:30, range:40, speed:100, ability:explode, bodyPlan:mechanical, weaponType:none, primaryColor:gray, accentColor:orange, sizeMod:small}
- "pumpkin"/"jack-o" → {role:utility, targeting:enemy_backline, movement:chase, attackCondition:always, abilityTrigger:on_death, moveSpeedMod:120, hp:80, dmg:20, range:40, speed:70, ability:heal_burst, bodyPlan:blob, weaponType:none, primaryColor:orange, accentColor:green, sizeMod:large}
- "turtle"/"shell"/"crab" → {role:frontline, targeting:closest, movement:hold_midpoint, attackCondition:always, abilityTrigger:on_low_hp, moveSpeedMod:50, hp:150, dmg:8, range:30, speed:30, ability:shield, bodyPlan:quadruped, weaponType:claws, primaryColor:green, accentColor:brown, sizeMod:large}
- "wall"/"tower"/"turret"/"crystal" → {role:frontline, targeting:closest, movement:hold, attackCondition:always, abilityTrigger:never, moveSpeedMod:50, hp:200, dmg:15, range:120, speed:30, ability:slow, bodyPlan:structure, weaponType:none, primaryColor:gray, accentColor:cyan, sizeMod:large}
- no match → random template with the prompt as the unit name
- Templates apply ±20% param variation to hp/dmg/range/speed so each fallback forge isn't identical.

#### Step 11: Rewarded ad integration (the monetization layer)

The LLM forge is gated behind watching a rewarded ad. The ad plays while the LLM generates, hiding the latency.

**Ad flow:**
```
User taps "✨ Forge Custom Unit"
  → "Watch a short ad to forge a custom unit?" [Watch Ad] [Skip]
  → If "Watch Ad": start ad playback + start LLM generation in parallel
    → Ad plays (15-30s) — LLM generates in Web Worker (hidden)
    → Ad ends → check if LLM is done:
      → Done: show unit preview immediately
      → Almost done (fallback calls running): show "Finishing up..." spinner (≤10s)
      → Failed: show "Generation failed, using template" → template fallback unit
  → If "Skip": template fallback (instant, free, less custom)
```

**Ad SDK integration:**
- Use a standard mobile ad SDK (Google AdMob, Unity Ads, or ironSource) via their web SDK / JS bridge.
- For the single-file `index.html` prototype: stub the ad with a 15s countdown timer (`showAdStub(duration, onComplete)`) that simulates ad playback. Replace with real SDK integration before production launch.
- The ad stub shows a full-screen overlay with a countdown — "Ad: 15s..." — and calls `onComplete` when done. This lets us develop and test the full flow without an ad SDK.

**Parallel execution:**
```js
async function forgeWithAd(prompt) {
  // Start both in parallel
  const adPromise = showAd(15000);  // 15s ad (or stub)
  const genPromise = generateUnit(prompt);  // LLM generation in Web Worker

  // Wait for both
  await adPromise;  // ad finishes first (usually)
  let unit;
  try {
    unit = await genPromise;  // should be done or nearly done
  } catch {
    unit = templateFallback(prompt);  // ad watched but LLM failed — still give them a unit
  }

  showForgePreview(unit);  // show preview + keep/reroll
}
```

**Key UX principle:** the user ALWAYS gets a unit after watching the ad, even if the LLM fails. If the LLM fails, they get a template-fallback unit. The ad is never wasted from the user's perspective.

**Reroll flow:** "Reroll" = watch another ad to re-generate the same prompt (or a new prompt). Cached prompts (same text) are free — no ad needed, instant result.

#### Step 12: Model download UX

- The model download happens **on first forge attempt**, not at startup. When the user first taps "Forge Custom Unit" and agrees to watch an ad:
  1. Check if model is cached (IndexedDB). If yes, proceed to ad + generation.
  2. If not cached: "First time: the AI model (~500MB download, ~945MB VRAM) will download in the background. Watch the ad and we'll have your unit ready!" → start download + ad in parallel. The ad (15-30s) covers the start of the download; if download isn't done by ad end, show "Loading AI model... (one-time only)" with progress bar until ready, then generate.
  3. Subsequent forges: model is cached, generation starts instantly with the ad.
- Model: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (replaces current `Llama-3.2-1B-Instruct-q4f32_1-MLC`). Confirmed in web-llm registry with `low_resource_required: true`, `vram_required_MB: 944.62`. The 0.5B model is smaller and faster than the current 1B model, with grammar/JSON-schema support.
- This means the first forge has a longer wait (ad + download + generation), but every forge after is just ad + generation (~15-30s total).
- `preloadAI()` (line ~381) — repurpose to silently preload the model in the background after the game starts, so by the time the user first taps "Forge," the model may already be cached. No UX prompt — just a silent background download if WebGPU is present.

#### Step 13: Forge screen redesign

- **Entry point:** "✨ Forge Custom Unit" button in the menu (appears after completing Training Yard — Tier 1 arena 0).
- **Forge screen:** text input for unit name + "Watch Ad to Generate" button. No coin cost (the ad IS the cost). Preview canvas showing the generated sprite animated in idle state + stats card. "Keep" (adds to collection) or "Reroll" (watch another ad) buttons.
- **No 3-stage progress bar** — the ad hides the generation. Only show "Finishing up..." if fallback calls are still running after the ad ends.
- **Model status indicator:** small badge showing "AI: Ready" / "AI: Loading..." / "AI: Unavailable (templates)" so the user knows what to expect.

#### Step 14: Cost & balance

- **No coin cost for forging** — the ad is the cost. This is more user-friendly than coin-gating and aligns with the rewarded-ad monetization model.
- **Rerolling:** watch another ad (or free if the prompt is cached).
- **Arena-based param clamps** (Phase 15) still gate power: Training Yard clamps hp≤100, dmg≤25; Void Rift clamps hp≤200, dmg≤50. This prevents a new player from forging a game-breaking unit in the first arena.
- **Daily forge cap:** optional — limit to 5 forged units per day to prevent ad fatigue. Track in `save.forgeDate` + `save.forgeCount`. Reset daily. (Start without a cap; add if ad completion rates drop.)

### Code touchpoints
- `MODEL` constant (line 323) — change from `Llama-3.2-1B-Instruct-q4f32_1-MLC` to `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`.
- `preloadAI()` (line ~381) — repurpose to silently preload the model in the background after startup if WebGPU present. No UX prompt.
- `initLLM()` (line ~342) — rewrite to use `CreateWebWorkerMLCEngine` (blob worker) instead of `CreateMLCEngine`.
- `validateUnit()` (was `validateAIUnit`, line ~389) — already rewritten in Phase 10. Phase 12 extends it to also check recipe has ≥3 shapes. Arena-dependent clamps added in Phase 15. One function, used everywhere.
- `G.forge()` (line ~1137) — rewrite: re-enable forge button → prompt input → `forgeWithAd()` (ad + generation in parallel) → preview → keep/reroll. Adds to `save.collection`.
- `G.generateAI()` (line ~1150) — remove (replaced by `generateUnit()`).
- `G.warmAICache()` (line ~1182) — remove (replaced by IndexedDB cache).
- `aiCache` (line ~327) — remove (replaced by IndexedDB cache).
- Forge screen markup — add text input, "Watch Ad to Generate" button, ad overlay, preview canvas, keep/reroll buttons, model status badge. Re-enable the forge button hidden in Phase 10.
- New `showAd(duration, onComplete)` function — ad stub (15s countdown overlay) for development; replace with real SDK before launch.
- New `forgeWithAd(prompt)` function — parallel ad + generation, always returns a unit.
- New `UNIT_SCHEMA` constant — the JSON schema string (17 fields) for grammar-constrained generation.
- New `COLOR_MAP` — named color → hex lookup (12 colors).
- New `WEAPON_COLOR`, `WEAPON_FX` — derived color/FX per weapon type.
- New `deriveHeadColor()`, `deriveAtkSpd()`, `deriveCrit()` — derived fields from LLM attributes.
- New `CONSISTENCY_RULES` array — cross-field semantic validation rules (uses behaviour API fields).
- New `FIELD_PROMPTS` object — per-field prompts for all 17 fields. Used by both the semantic re-ask path (only flagged fields) and the pure per-field fallback path (all 17 fields). One table, two uses.
- New `RecipeAssembler` object (~200 lines) — builds visual recipe from attributes using body-plan + weapon templates.
- New `generateUnit()` orchestrator (~80 lines) — cache → JSON mode → semantic validate → re-ask flagged → derive → assemble → validate → cache.
- New `cacheGet/cachePut` functions (~60 lines) — IndexedDB wrapper.
- New `templateFallback(prompt)` function — keyword matching to full 17-field attribute templates.

---

## Phase 13 — 4-Card Loadout + Collection ✅ DONE

**Today:** `deckUnits()` returns all owned units (base + forged). Draft Showdown uses a fixed 4-card loadout.

### Changes
- New `save.loadout` = array of exactly 4 unit names (can include duplicates — stacking allowed).
- New `save.collection` = all units the player owns (starter roster + LLM-forged units).
- Draft pool per match = `save.loadout` resolved to unit objects (with upgrades + recipes applied).
- Default loadout on migrate: 4 starter units (Knight, Archer, Slash, Priest).
- Deck screen redesign: 4 slot row at top (the loadout) + scrollable collection below; tap collection card to swap into a slot.
- Forging adds to `save.collection`; from the Deck screen you slot forged units into the loadout.
- **Endgame:** as players forge more units, they replace starter units in the loadout. The starter roster is training wheels; the endgame loadout is entirely LLM-generated.

### Code touchpoints
- `G.deckUnits()` (line ~874) → returns `save.loadout` resolved, not the whole pool.
- `G.deck()` screen — rewrite to loadout + collection layout.
- `G.forge()` (Phase 12) → adds to `save.collection`.
- Fusion (line ~1260 region) — operates on collection entries (fuse duplicates of the same unit to level it up).
- `migrateSave()`: move existing `save.ai` into `save.collection`; build default `save.loadout` from `save.deck` (first 4).

---

## Phase 9 — Round-Based Draft Cadence ✅ DONE

**Draft Showdown's signature:** 3 draws × 3 picks per round, plus 4th-draw comeback.

### Changes
- `G.start()` (per round) calls `startRoundDraft()` instead of the current single-shot draft.
- Each round: **3 sequential draws**. Each draw shows 3 cards, you pick 1. After 3 draws → army locked → battle.
- Track `roundDraftState = { drawIndex: 0, picks: [] }`.
- **4th-draw comeback:** if the player lost the previous round, they get 4 draws instead of 3. Same for the AI/opponent.
- Rerolls: keep at 3 per *match* (not per round) — cross-round resource management.
- Visual: progress dots "● ● ●" showing which draw you're on; 4th draw highlighted gold.

### Code touchpoints
- `G.start()` (line ~881) and `G.makeDraft()` (line ~902) — refactor into `drawOne()` callable 3-4× per round.
- `G.draftCard` onclick (line ~931) → advances to next draw.
- `G.battle()` (line ~979) → triggered after final pick of the round. If opponent is a bot, generate bot picks via `Bot.draftRound()`.
- New `roundDraftState` field on `G` and on the multiplayer snapshot.
- New `Bot` object (~30 lines): random loadout from starters, random drafting.

### Bot opponent drafting (fake multiplayer)
**Today:** `G.battle()` (line ~976) spawns 6 random enemies from `this.enemy`. This is the old "solo play" mode.

**New approach: there is no solo play.** Every match goes through matchmaking (Phase 18). If no human opponent is found within a timeout (e.g. 5s), the opponent slot is filled by a **bot**. The bot is intentionally simple — it feels like fighting a casual human opponent, not an AI:

- New `Bot` object (inserted before `G`, see File Insertion Order):
  - `loadout` — random 4 units picked from the 6 starters (random subset, can include duplicates). Generated once per match.
  - `draftRound(drawCount)` → returns array of 3-4 picked units. For each draw, the bot picks a **random** card from the 3 shown. No strategy, no counter-picking, no role-fill logic.
  - The bot does NOT use rerolls.
  - The bot's loadout is themed by arena (Phase 15): in Training Yard, the bot's 4-card loadout is drawn from the starter roster; in higher arenas, the bot's pool includes arena-themed units (still random subset, still random drafting).
- `G.battle()` → if the opponent is a bot, calls `Bot.draftRound()` to generate the bot's picks, then builds the enemy army from those picks (3 copies each, same as player).
- **The player never sees "vs Bot" or "vs AI".** The scout screen (Phase 14) shows the opponent's picks identically whether human or bot. The match result screen doesn't distinguish. This keeps the UX unified — "fake multiplayer."
- **Why random, not smart:** A smart AI (counter-picking, role-filling) would be harder to build and could feel unfair or frustrating. A random-drafting bot feels like a casual human opponent who doesn't know the meta. It's also trivially simple (~30 lines) and can't bug out into an unwinnable state. If we later want difficulty levels, we can add a `BotStrategy` layer — but the default is random.

---

## Phase 14 — Opponent Scout ✅ DONE

### Changes
- Pre-battle (after draft, before horn): show opponent portrait card. Tap reveals their 3 picked units for the round with stats + sprite preview.
- Opponent is either a human (P2P) or a bot (fake multiplayer) — the scout screen looks identical either way. The player doesn't know which.
- In P2P: host broadcasts `opponent_picks` to guest at round start.
- In bot matches: the bot's picks are generated locally (no network).
- Strategic layer: see enemy Assassin → protect your carry; see enemy Sniper → add a diver.

### Code touchpoints
- New "scout" sub-screen between draft and battle.
- `G.battle()` (line ~976) — generate/receive opponent picks, store on `Match`, render scout UI.
- Multiplayer: new `opponent_picks` message in `networkReceive` (line ~450).

---

## Phase 15 — Arena Ladder ✅ DONE

### Changes
- `save.arena` = index into an arenas array. Each arena: name, theme color, **bot loadout pool**, lives config, unlock threshold (matchWins).
- Arenas (working names, trademark-safe):
  1. **Training Yard** (default, 3 lives, easy bots, bot loadout = random 4 from starters)
  2. **District Z** (undead theme, 3 lives, poison-heavy bot loadout)
  3. **Golden Goal Arena** (3 lives, balanced hard bot loadout)
  4. **Void Rift** (post-game, 4 lives, all modes represented, higher param caps for LLM units, bot loadout = full roster)
- Higher arenas unlock higher param clamp ceilings for LLM-forged units (e.g. Training Yard caps hp at 100, Void Rift caps at 200). This gates power progression.
- Menu shows current arena + "Next arena: X wins to unlock".
- Winning a match awards coins + advances arena progress.
- **Bot loadout per arena:** `Bot.loadoutForArena(arenaIndex)` returns a random 4-unit loadout from the arena's pool. In Training Yard, the pool is the 6 starters. In higher arenas, the pool includes arena-themed units (still random subset, still random drafting — the bot doesn't get smarter, just has a different pool).

### Code touchpoints
- New `arenas` array near `G.base`. Each arena entry includes `botPool` (array of unit names the bot drafts from).
- `G.battle()` (line ~979) — if opponent is bot, pass `arenas[save.arena].botPool` to `Bot.loadoutForArena()`.
- `validateUnit()` (Phase 10) — param clamps become arena-dependent (pass `save.arena` as second arg).
- `G.menu()` — render arena badge + unlock progress. Single "Play" button (no solo/multi toggle).
- `migrateSave()` — default `save.arena=0`.

---

## Phase 16 — Synergy Hints & Strategy

### Changes
- On the loadout screen, show a **synergy meter**: counts roles in your 4-card loadout, warns if unbalanced ("⚠ No frontline — backline exposed").
- During draft, highlight picks that fill a missing role in your current round army.
- Post-match: show a one-line "why you lost" hint (templated from unit death order + role gaps).

### Code touchpoints
- `G.deck()` — add synergy meter widget.
- `G.draftCard()` (line ~928) — role-fill highlight.
- `Match.onRoundEnd` — generate hint from unit death order (track in `Battle`).

---

## Phase 17 — Procedural FX System

**Today:** `Battle.render()` draws static shapes. No hit flashes, death animation, particles, or screen shake.

### Changes
- FX layer that makes combat feel alive, **state-derived** so P2P guests see the same juice without extra network traffic.
- **LLM-generated FX:** the visual recipe's `fx` field (e.g. `{"arrow": {"t":"projectile","c":"#a72","speed":200,"trail":true}}`) is interpreted by the FX system. When a unit attacks, its recipe's attack animation fires the named FX. This means an LLM-generated "archer" fires arrow projectiles, an "ice mage" fires ice shards, etc. — all from the recipe.
- **Core FX** (hardcoded, always present):

| FX | Trigger | Visual |
|---|---|---|
| Hit flash | HP decreased this frame | unit flashes white 80ms |
| Crit burst | crit flag on damage | gold flash + 6-particle spark + screen shake |
| Death burst | unit alive→dead | expand + fade 200ms, 8 particles |
| Spawn pop-in | unit added | scale 0→1 ease-out-back 150ms |
| Attack lunge | `cool` reset high→low | offset 4px toward target 60ms |
| Screen shake | crit, carry death, round end | ±2-4px transform, decay |
| Round-end flash | winner decided | full-canvas color wash 400ms |

- **Particle system:** `Battle.particles[]` capped at 60 (mobile). Updated in `Battle.update()`, drawn in `render()`.
- **State-derived for P2P:** guests compute FX from snapshot deltas (HP down → hit flash, unit gone → death burst). Add lightweight `recentCrits: [{id, t}]` to snapshot for reliable crit FX.

### Code touchpoints
- New `BattleFX` object (~80 lines) with `onHit/onDeath/onSpawn/onAttack/shake` + `fireRecipeFx(unit, fxName)`.
- `Battle.render()` (line ~708) — wrap in shake transform, add particle pass, alpha lerps, recipe FX.
- `Battle.initRuntime()` (line ~502) — add `prevH`, `prevCool`, `spawnT`, `hitFlash`, `lungeT`, `deathT`.
- `Battle.applySnapshot()` (line ~789) — diff against previous snapshot, fire same FX calls.
- `G.startSnapshots()` (line ~1029) — include `recentCrits` in snap envelope.
- `SpriteRenderer` (Phase 11) — animation `fx` keyframes call `BattleFX.fireRecipeFx()`.

---

## Phase 18 — Multiplayer Protocol Extension + Matchmaking + Bot Fallback

### Matchmaking flow (replaces solo play)
**There is no "solo" button.** The player taps "Play" and matchmaking begins immediately:
1. **Start matchmaking** via trystero (existing room/join logic). Show "Finding opponent..." with a spinner.
2. **Timeout (5s default, configurable per arena):** if no opponent found, silently fill the slot with a `Bot` (Phase 9). The UI transitions from "Finding opponent..." to the draft screen — no "vs Bot" label, no indication that the opponent is a bot.
3. **Opponent found:** if a human joins within the timeout, cancel the bot and start a P2P match.
4. **Mid-match disconnect (P2P only):** if the human opponent disconnects mid-match, offer "Continue vs Bot" (fill their slot with a bot using their current loadout) or "Forfeit." This prevents a disconnect from ruining a match.
5. **Bot matches are fully local:** no network traffic, no trystero room. The `Match` object drives both the player's and bot's drafting/battle locally. This means bot matches have zero latency and work offline.

**trystero matchmaking mechanics:** trystero is room-based P2P — there's no central matchmaking service. For automatic matching, all players searching for a match join a shared **queue room** named by arena: `"psd-arena-{N}-queue"` (e.g. `"psd-arena-0-queue"` for Training Yard). The first player to join becomes the "host" (creates the room); subsequent joiners are "guests." When a guest joins, the host immediately starts a P2P match with them and both leave the queue room. If two guests join simultaneously, the host pairs with the first and the second becomes a new host. This is hacky but workable — it's the same pattern trystero's own examples use for "find a random opponent." The queue room is ephemeral (no state, just presence). If no one joins within 5s, the host gives up and starts a bot match.

**Why 5s timeout:** Long enough to find a human in an active player base, short enough that the player doesn't stare at a spinner. If the player base grows, increase to 10s. If it's small, 5s ensures the player is always in a match quickly. The bot is the safety net — the player always gets to play.

### New message types (added to `networkReceive`, line ~450)
- `match_start` — host → guest: arena, lives, who goes first.
- `round_start` — host → guest: draw_index (3 or 4 if comeback), your loadout snapshot.
- `opponent_picks` — host → guest: host's locked picks for the round (with visual recipes so guest renders them).
- `round_end` — host → guest: round winner, updated lives, next draw_index.
- `match_end` — host → guest: final winner, rewards.

### Snapshot extension
- Existing `snap` (line ~1033) — add `round`, `livesPlayer`, `livesEnemy`, `drawIndex`, `recentCrits`.
- Visual recipes sent once in `round_start` (not per-snapshot — recipes are static during a round).

### Recipe serialization (P2P bandwidth)
A visual recipe is ~1-3KB JSON (6-10 shapes + 4 animation states + FX). With 3 picks × 2 players = 6-12 unique units per round, that's 6-36KB sent in `round_start`. Over trystero (torrent signaling, not a direct data channel), large messages can be slow or fragment.

**Mitigation:**
- **Minify field names** before sending: `shapes→s`, `anim→a`, `attack→at`, `idle→i`, `move→m`, `death→d`, `circle→c`, `rect→r`, `line→l`, `polygon→p`, `arc→ar`. Reduces size ~40%.
- **Deduplicate:** if both players use the same starter unit (e.g. both have Knight), send the name only — the receiver resolves it from their own roster. Only LLM-forged units (unique) need full recipe transmission.
- **Compress:** `JSON.stringify` → `lz-string` compress (already a tiny library, ~5KB). Typical 3KB recipe compresses to ~800 bytes.
- **Fallback:** if a recipe fails to arrive (trystero drop), the receiver falls back to circle rendering for that unit. Combat still works (behaviour is in the snapshot, not the recipe).

### Guest flow
- Guest drafts locally (3-4 draws), sends `round_deck`, waits for `opponent_picks` + `snap` stream. After round end, shows round result, then drafts again or sees match result.

### Bot flow (fake multiplayer — no network)
- `Match.start()` checks: is the opponent a bot? If yes, skip all trystero/network logic.
- Each round: player drafts locally (3-4 draws). Bot drafts simultaneously via `Bot.draftRound()` (random picks, instant). Both armies are built locally.
- Battle runs locally (same `Battle` object, no snapshots sent).
- `Match.onRoundEnd()` decrements lives, starts next round or ends match.
- **The entire match flow is identical to P2P** — the only difference is no network messages and the opponent's picks come from `Bot` instead of `networkReceive`. This is why it's "fake multiplayer" — the game code doesn't branch on human vs bot; it just has a different source for opponent data.

### Code touchpoints for matchmaking + bot
- `G.start()` (line ~881) — rewrite: start matchmaking (trystero room) → on timeout, create `Bot` → `Match.start({opponent: bot})`.
- New `Bot` object (~30 lines): `loadout` (random 4 from starters), `draftRound(drawCount)` (random picks), `loadoutForArena(arenaIndex)` (themed pool).
- `Match` object — accept `opponent` field (`"human"` or `Bot` instance). Branch only on where opponent data comes from, not on match flow.
- `G.menu()` — remove any "solo" / "multiplayer" buttons. Single "Play" button starts matchmaking.
- Existing `G.battle()` (line ~979) — if `Match.opponent instanceof Bot`, generate bot picks locally instead of waiting for network.
- Disconnect handling: `networkReceive` on disconnect → if mid-match, prompt "Continue vs Bot" → swap `Match.opponent` to a new `Bot` using the disconnected player's last known loadout.

---

## Phase 19a — Tier 1 Polish (after Draft Showdown clone is complete)

- **Match pacing:** target 90-120s per match (3-5 rounds). Tune unit HP/DMG if rounds drag.
- **4th-draw feel:** gold glow, "COMEBACK" banner.
- **Arena transitions:** toast + theme color shift.
- **Role-coded shapes** consistent across draft / battle / scout / deck (🛡️ square, 🎯 triangle, ✨ diamond, ⚔️ inverted triangle, 🛠️ hexagon).
- **Unified Play button:** single "Play" button → matchmaking → bot fallback. No "solo" / "multiplayer" toggle. Verify the transition from "Finding opponent..." to draft is seamless whether human or bot.
- **Achievements:** "Comeback King" (win after losing round 1), "Arena Master" (unlock all arenas), "Role Master" (win with each role as last standing). Remove "AI Smith" (forge5 — old achievement).
- **Mobile:** verify lives HUD, 4th-draw banner, scout screen fit on small viewports.
- **Ship Tier 1 as a complete game.** Playable, fun, no LLM dependency.

## Phase 19b — Tier 2 Polish (after LLM layer is packed on)

- **Sprite rendering:** verify LLM-generated sprites render correctly on mobile (6-10 shapes × 12 units).
- **Ad integration:** replace ad stub with real SDK (Google AdMob / Unity Ads). Test ad completion → generation flow end-to-end.
- **Model download UX:** verify silent background preload, first-forge download flow, "Finishing up..." spinner.
- **New achievements:** "First Forge" (create your first LLM unit), "Full Custom" (win a match with a 4-card LLM-only loadout).
- **Daily forge cap:** add if ad completion rates drop (limit 5/day).
- **Balance:** verify LLM units don't break the meta across all arenas.

---

## Implementation Order & Dependencies

### Tier 1 — Draft Showdown Clone (ship first)

```
Phase 8  (Match & Lives)              ──┐
Phase 9  (Round draft cadence)        ──┼─→ Phase 14 (Scout) ──→ Phase 18 (MP protocol)
Phase 13 (4-card loadout)             ──┘
Phase 10 (Behaviour modes + starters) ──→ Phase 16 (Synergy hints)
Phase 15 (Arenas)                     ──→ Phase 19a (Tier 1 Polish)
```

**Tier 1 ship order: 8 → 10 → 9 → 13 → 15 → 14 → 16 → 18 → 19a**

- Phase 8 first (save migration + Match object — everything depends on it).
- Phase 10 (behaviour modes + starter roster) — the game needs distinct unit behaviours to be fun.
- Phase 9 (round draft cadence) — the core Draft Showdown mechanic.
- Phase 13 (4-card loadout) — deck building.
- Phase 15 (arenas) — progression.
- Phase 14 (scout) — strategic depth.
- Phase 16 (synergy hints) — onboarding.
- Phase 18 (MP protocol) — multiplayer.
- Phase 19a (polish) — ship Tier 1 as a complete game.

**Tier 1 uses simple visuals:** role-coded shapes (square/triangle/diamond/etc.) with colored borders. No procedural sprites, no LLM. The game is fully playable and fun.

### Tier 2 — LLM Reward Layer (pack on top)

```
Phase 11 (Procedural sprites)         ──┐
                                        ├─→ Phase 12 (LLM + ads) ──→ Phase 17 (FX) ──→ Phase 19b (Tier 2 Polish)
```

**Tier 2 ship order: 11 → 12 → 17 → 19b**

- Phase 11 (procedural sprite system) — replaces Tier 1's simple shapes with full sprite rendering. Hand-authored recipes for the starter roster; LLM-generated recipes come in Phase 12.
- Phase 12 (LLM integration + rewarded ads) — the forge becomes available as an ad-gated feature. Hybrid JSON-mode-first generation runs during ad playback.
- Phase 17 (procedural FX) — hit flashes, crit bursts, death bursts, screen shake, LLM-generated FX from recipes.
- Phase 19b (Tier 2 polish) — replace ad stub with real SDK, verify mobile, add forge achievements, final balance.

**Tier 2 is purely additive.** If it's delayed or has issues, Tier 1 is already shipped and making ad revenue from match rewards (if we add rewarded ads there too) or is just a fun free game.

---

## Save Migration (v5 → v6)

`migrateSave()` additions:
```js
// v6: match/arena/loadout/collection; forge repurposed for LLM visuals+behaviour
if (!save.version || save.version < 6) {
  // Existing forged units → collection (they have old-format stats, no recipe or behaviour fields)
  // Mark them as legacy; player can re-forge or discard.
  save.collection = (save.ai || []).map(u => ({...u, legacy: true}));
  delete save.ai;
  save.loadout = (save.deck || baseNames).slice(0, 4);
  while (save.loadout.length < 4) save.loadout.push(baseNames[save.loadout.length % baseNames.length]);
  save.arena = 0;
  save.matchWins = 0;
  // achievements: drop forge5 (old "forge 5 AI units"), will add new forge achievements
  if (save.achievements) delete save.achievements.forge5;
  save.version = 6;
}
```

---

## What Stays From v4

- Single-file `index.html` architecture.
- `Battle` object + combat simulation (projectiles, crits, status effects, abilities) — extended with the Behaviour Composition API.
- Host-authoritative P2P over trystero — **extended with matchmaking + bot fallback** (Phase 18). No separate solo mode; bot fills in if no human found.
- The current "solo play" (`G.battle()` spawning random enemies from `this.enemy`) — **removed**. Replaced by fake multiplayer (bot opponent via `Bot` object).
- XP / coins / upgrades / fusion / achievements.
- Mobile polish (adaptive FPS, pause-on-hidden, vibration, fullscreen, PWA manifest).
- Error panel + crash-wrapped init.
- The `@mlc-ai/web-llm` multi-CDN import (lines 176-178) — already correct, kept as-is.
- The forge — **repurposed** (Tier 2). Was a flat-stats generator; now an ad-gated LLM unit forge with the Behaviour Composition API. Hidden in Tier 1 (Phase 10), re-enabled in Phase 12.
- The current model (`Llama-3.2-1B-Instruct-q4f32_1-MLC`, line 323) — replaced with `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` in Phase 12 (smaller, faster, grammar support).

---

## Open Questions (resolve before Phase 10)

1. **Lives count:** 3 (Draft Showdown default) or configurable per arena? → **Resolved:** 3 default, arena-configurable in Phase 15.
2. **Loadout duplicates:** allow 4× same unit? → **Resolved:** yes (stacking allowed, matches Draft Showdown).
3. **Loss drop-down in arenas:** punitive ladder or just unlock-gated? → **Resolved:** unlock-gated only (non-punitive); revisit in Phase 19 if climbing feels pointless.
4. **Bot opponent loadout:** synthetic per-arena pool, or pull from player's collection? → **Resolved:** random 4 from the arena's bot pool (starters in Training Yard, themed units in higher arenas). Bot drafts randomly — no strategy, no counter-picking. This is "fake multiplayer" — the bot feels like a casual human, not an AI.
5. **Match rewards:** per-match only, or small per-round consolation XP? → **Resolved:** per-match, with 5 XP round-loss consolation to soften comebacks.
6. **LLM model on desktop:** Qwen2.5-0.5B confirmed for all devices. Desktop could offer 1.5B in settings for richer output. → **Deferred:** auto-select 0.5B everywhere for now; add settings toggle in Phase 19 if output quality is poor.
7. **Recipe sharing in P2P:** when a guest uses an LLM unit, the host needs its recipe to render. → **Resolved:** send minified + lz-compressed recipes in `round_start`, dedupe starter units, fall back to circle rendering if recipe drops.
8. **Fusion with LLM units:** each LLM unit is unique — how do you get duplicates to fuse? → **Final decision: fuse-by-name.** Re-forge the same prompt (watch another ad, or free if cached) to get a variant; fuse two units with the same `name` field. Fusion takes the higher of each stat (hp, dmg, range, speed) and keeps the first unit's behaviour fields + recipe (no averaging — keeps it simple and predictable). This matches the "level up your unit" fantasy. Starter units fuse by name too (two Knights → stronger Knight). Fusion cost: coins, scaling with fusion level.
9. **LLM unit balance:** clamped params are wide (hp 10-200). Could a player forge 4× hp=200 units and steamroll? → **Resolved:** arena-based clamps (Phase 15) gate this. Training Yard clamps hp≤100. Also, high-HP units with low speed/dmg are countered by `targeting: lowest_hp` + `movement: chase` + `moveSpeedMod: 150` (diver) and poison. The role/counter system self-balances.
10. **Behaviour API field count:** 17 schema fields with large enums (targeting: 10, ability: 12) is a lot for a 0.5B model. Will it produce good values? → **Mitigation:** all fields are enums or bounded integers — the grammar sampler forces valid values regardless of enum size. Semantic validation catches cross-field errors (15 rules now, covering passive/triggered ability consistency, targeting/role consistency, etc.). If the model struggles (many fields flagged per forge), the fallback prompts re-ask only the bad fields with focused questions. The Harry Potter example in web-llm's repo shows ~10 enum fields working with Qwen2.5-1.5B; 17 should be feasible with 0.5B given grammar constraints. Test early in Phase 12. If quality is poor, reduce enum sizes (e.g. drop `enemy_cluster`/`enemy_frontline` targeting, drop `slow`/`rage` abilities) — the system degrades gracefully.

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Tier 1 isn't fun without LLM** | Medium (core loop must stand alone) | High (no ship) | Tier 1 is a complete Draft Showdown clone with distinct behaviours, drafting, arenas, scout, synergy. The LLM is upside, not the core fun. Playtest Tier 1 before starting Tier 2. |
| **Ad SDK integration complexity** | Medium (web SDKs vary in quality) | Medium (Tier 2 delayed) | Develop with ad stub (15s countdown overlay). Replace with real SDK (AdMob/Unity Ads) in Phase 19b. Game works with stub — just no real ad revenue until integrated. |
| **Ad completion rate too low** | Medium (users skip ads) | Medium (less revenue + fewer forges) | Always give a unit after watching (even on LLM failure — template fallback). Rerolls on cached prompts are free. Daily forge cap prevents ad fatigue. |
| **Ad duration < generation time** | Low (hybrid is ~10-20s, ads are 15-30s) | Low (brief spinner) | "Finishing up..." spinner for remaining fallback calls. If consistently >5s after ad, increase `max_tokens` or reduce fallback fields. |
| **LLM produces invalid/irrelevant answers** | Low (grammar sampler guarantees structure) | Low (semantic fallback) | Grammar sampler forces valid JSON + enum values + integer ranges. Semantic validation catches cross-field inconsistencies. Per-field fallback re-asks only flagged fields. Unit always registers. |
| **WebGPU OOM on mobile** | Medium (500MB model + game) | High (forge unavailable) | Detect OOM in `initLLM()` catch → show "AI unavailable on this device, using templates" → template fallback. Game fully playable without LLM. Tier 1 has no LLM at all. |
| **LLM generation too slow (>30s)** | Low (hybrid is 1 + 0-4 calls, not 15) | Low (hidden by ad) | 30s total timeout → use fallbacks for unanswered fields. Ad hides the wait. Re-rolls on same prompt hit cache (instant, free). LLM in Web Worker so game stays interactive. |
| **Recipe too large for P2P** | Low (3KB × 12 = 36KB max) | Low (slow round start) | Minify field names + lz-string compress + dedupe starter units. Fallback to role-coded shapes (Tier 1 visuals) if recipe drops. |
| **Sprite rendering kills mobile FPS** | Low (120 shapes/frame) | High (unplayable) | Cap shapes at 10 per unit. Cap units at 12 per battle. Graceful degradation: if FPS < 25 for 1s, reduce to Tier 1 role-coded shapes for all units (Phase 17 perf guard). |
| **LLM units break game balance** | Medium (wide param clamps) | High (meta broken) | Arena-based clamps (Phase 15). Role/counter system self-balances. No coin cost (ad-gated), but daily forge cap limits volume. |
| **Model download fails / interrupted** | Medium (mobile network) | Medium (forge unavailable) | web-llm caches to IndexedDB (resumable). If download fails, template fallback. User still gets a unit after watching the ad. Silent background preload after startup. |
| **Save migration corrupts data** | Low (well-tested migration) | High (data loss) | `migrateSave()` backs up old save before migrating (existing v4 pattern). Test migration with a v5 save before shipping. |
| **trystero P2P drops recipes** | Medium (torrent signaling) | Low (visual only) | Recipes are visual-only; combat behaviour is in snapshots. Tier 1 role-coded shapes fallback. Re-send on next round. |
| **Bot matches feel stale (random drafting, no strategy)** | Medium (bot is intentionally simple) | Low (still playable, just not challenging) | Bot drafts randomly — feels like a casual human. Arena-themed bot pools (Phase 15) add variety. If players find bots too easy, add a `BotStrategy` layer (role-fill, counter-pick) as a future enhancement. The bot is the safety net, not the main experience — as the player base grows, more matches are human vs human. |
| **Matchmaking timeout too short/long** | Low (5s default, configurable) | Low (bot fills in) | 5s ensures quick matches. If player base grows, increase timeout. If too small, decrease. Bot is always ready as fallback. |
| **Web Worker creation fails (CSP/blob restrictions)** | Low (most browsers allow blob workers) | Medium (LLM on main thread) | Blob worker with CDN `import` may hit CORS in Safari. Mitigation: fetch the web-llm module source as text, inline it into the blob (no CDN import inside worker). If that fails, fall back to `CreateMLCEngine` on main thread with frame-drop warning. If too slow, template fallback. |
| **Behaviour API produces degenerate combos** | Low (semantic validation catches most) | Low (unit still works, just suboptimal) | Semantic validation flags nonsensical combinations (targeting allies + attacking, passive ability + trigger set, explode without on_death, etc. — 15 rules total). Flagged fields get re-asked. Even unflagged "unusual" combos are valid — a unit that holds position and never attacks is useless but not game-breaking. Playtest and add rules as needed. |
| **New abilities (explode, lifesteal, rage, shield, etc.) break balance** | Medium (12 abilities, some powerful) | Medium (meta dominated) | Arena-based param clamps (Phase 15) gate raw stats. Passive abilities (lifesteal, rage) scale with the unit's own dmg/hp — a weak vampire steals little. Triggered abilities (explode, heal_burst) fire once or on cooldown — not spammable. `on_death` abilities are a trade-off (the unit died). Playtest each ability in Phase 12 smoke testing; nerf via clamps if needed. |

---

## Verification Strategy (per phase)

Each phase ships with a manual smoke test via chrome-devtools MCP (existing workflow):

| Phase | Smoke test |
|---|---|
| 8 (Match & Lives) | Start match → win round → lose round → win round → match ends at 0 lives. Lives HUD updates. XP/coins awarded on match end (not round). |
| 10 (Behaviour API) | Spawn each starter unit in a bot match → verify behaviour (Archer kites, Knight holds midpoint, Assassin dives lowest-HP, Priest heals, Engineer spawns minions). Verify forge button is hidden. Verify `hold_midpoint` is relative to canvas height (resize window → midpoint adjusts). Verify new abilities: spawn a unit with `lifesteal` → heals on hit; `explode` + `on_death` → AoE damage on death; `heal_burst` + `on_death` → AoE heal on death; `shield` + `on_low_hp` → becomes immune at low HP; `rage` → damage increases as HP drops. |
| 11 (Sprites) | Battle with starter roster → verify each unit renders as multi-shape sprite with idle/move/attack/death animations. Verify circle fallback for legacy units. |
| 12 (LLM) | Tap "Forge" → "Watch ad?" prompt → ad stub plays (15s countdown) → LLM generates during ad → ad ends → preview animates → keep adds to collection → unit appears in deck screen. Forge "archer" again → cache hit (instant, free, no ad). Forge with WebGPU unavailable → template fallback after ad. Forge "xyzzy" (nonsense) → template fallback with random body plan. Verify semantic validation: forge "tank" → if JSON mode returns hp=30 (wrong for frontline), verify hp gets re-asked. Verify behaviour API: forge "berserker" → verify it has a novel combo (e.g. targeting:highest_hp + movement:chase + moveSpeedMod:150 + ability:rage). Forge "vampire" → verify lifesteal passive works in battle (heals on hit). Forge "pumpkin" → verify heal_burst on death heals nearby allies. Forge "bomber" → verify explode on death deals AoE damage. Verify ad always gives a unit even if LLM fails. |
| 9 (Round draft) | Start match → draft 3 picks (3 draws) → battle → next round → verify 4th draw if lost previous round. Rerolls persist across rounds. Verify bot opponent drafts randomly (no counter-picking visible). Verify bot loadout is a random 4 from starters. |
| 18 (MP + bots) | Tap "Play" → "Finding opponent..." → timeout (5s) → bot fills slot → full match plays identically to P2P. Verify no "vs Bot" label anywhere. Verify mid-match disconnect → "Continue vs Bot" prompt → bot takes over with disconnected player's loadout. Verify bot match works offline (disable network → match still plays). |
| 13 (Loadout) | Deck screen → swap collection unit into loadout slot → start match → draft pool is the 4 loadout units. |
| 14 (Scout) | After draft → scout screen shows opponent's 3 picks with sprite previews. |
| 15 (Arenas) | Win 3 matches in Training Yard → unlock District Z → enemy pool changes. Forge unit in Training Yard → verify hp clamped to 100. |
| 17 (FX) | Battle → verify hit flashes, crit bursts, death bursts, screen shake, projectile trails. Verify guest sees same FX in P2P. |
| 18 (MP) | Host + guest → full match → rounds draft independently → scout shows opponent picks → recipes render on both sides → match end syncs. |

---

## Before Starting Implementation

A few things to verify/prepare before writing any code:

### 1. Verify web-llm JSON schema support with Qwen2.5-0.5B
The plan assumes web-llm's grammar sampler works with our 17-field schema (10-value enums, 12-value enums, nested objects). The Harry Potter example in web-llm's repo confirms this works with Llama-3.2-3B and Qwen2.5-1.5B. **Before Phase 12, write a 30-line test:** load `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, send our schema with a test prompt, verify the output is valid JSON with all fields. If the 0.5B model struggles with 17 fields, reduce the schema (drop `accentColor`, derive from `primaryColor`; drop `sizeMod`, default to medium). This is the single biggest technical risk — test it early.

### 2. Confirm `index.html` line numbers
The plan references line numbers from v4 (`Battle.act()` at ~583, `G.base` at ~812, etc.). These will drift as earlier phases are implemented. **Before each phase, re-check the actual line numbers** by grepping for the function/variable name, not the line number. The line numbers in the plan are approximate guides, not exact targets.

### 3. Set up a smoke test harness
The verification table describes manual smoke tests via chrome-devtools MCP. **Before Phase 8, create a simple test script** that:
- Loads `index.html` in a headless browser
- Simulates a full match (start → draft → battle → round result → next round → match end)
- Checks that lives decrement, rounds advance, rewards are awarded
This harness will be extended each phase and gives confidence that refactors don't break the core loop.

### 4. Decide on ad SDK
Phase 12 uses an "ad stub" (15s countdown). **Before Phase 12, pick a rewarded ad SDK** (Google AdSense for Games, Unity Ads, etc.) and verify it works in a single-file HTML context. The stub is fine for development; the real SDK is a Phase 19b task. But knowing which SDK we'll use affects the ad display code structure.

### 5. trystero version check
The plan assumes trystero's room/join API. **Before Phase 18, verify the current trystero version** and its API — the plan's matchmaking flow depends on joining a shared queue room. If trystero's API has changed, adjust the matchmaking code accordingly.

### 6. Git branch strategy
Each phase is a logical unit of work. **Recommend: one branch per phase** (`phase-8-match`, `phase-10-behaviour`, etc.), merged to main after smoke testing. This keeps the diff per phase reviewable and makes it easy to revert a phase if it introduces issues. Tier 1 ships from main after Phase 19a; Tier 2 phases branch off main after that.
