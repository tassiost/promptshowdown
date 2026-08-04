# GAPS.md — Feature Gap Analysis vs. Similar Games

Research session (2026-08-04): surveyed Prompt Showdown's current feature set
(via codebase audit) and compared it against the broader autobattler / draft-battler
genre to identify what we still need to add. Companion to `RESEARCH.md` (which covers
reference projects + architecture); this doc focuses on **game-mechanic feature gaps**.

## How to Read This Doc

- **Have** = already implemented in `src/` (cited with file:line)
- **Gap** = present in comparable games but missing here
- **N/A** = intentionally out of scope (not a gap)
- Each gap is tagged with `Priority` (P0 must-have / P1 high-value / P2 nice-to-have)
  and `Effort` (S/M/L/XL) based on our single-file vanilla-JS constraint

Sources: TFT wiki + Mobalytics, Hearthstone Battlegrounds wiki + Blizzard posts,
Marvel Snap help center, Super Auto Pets wiki, Pokemon Auto Chess site, Machine
Guard Corps repo, Backpack Battles Steam/guides, Storybook Brawl wiki, MTG
Arena Limited guides, Gamedeveloper autobattler analysis, Wikipedia.

---

## 1. Draft System

### Have
- Continuous draft: 3 units/round, survivors carry over (`ui.js:1593-1628`, `match.js:54-55`)
- 3 rerolls per match, reset on round 1 (`ui.js:1595-1596`)
- 20s pick timer with auto-pick (`ui.js:1699-1708`)
- Comeback mechanic: loser gets a 4th draw card (`match.js:82-87`)
- Scout screen reveals opponent picks (`ui.js:1785-1795`)
- Rarity-weighted draw (`ui.js:1967-1990`)
- Draft battlefield preview (`ui.js:1437-1583`)
- Bot drafting with role-fill logic (`bot.js:58-80`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| D1 | **Ban/pick phase** | TFT carousel, MTG draft | P1 | M | Pre-match ban 1-2 units from opponent's pool or shared pool. Adds counterplay depth. |
| D2 | **Blind draft mode** | (genre variant) | P2 | S | Both players draft without seeing opponent's pool until scout. Toggle in arena config. |
| D3 | **Shared carousel round** | TFT (every 6 rounds) | P1 | M | Periodic shared draft where loser picks first. Breaks up continuous-draft monotony. |
| D4 | **Snake/rotation draft** | MTG booster draft | P2 | M | Alternate draft format where picks rotate turn order. Could be an arena variant. |
| D5 | **Freeze/lock shop offering** | TFT, HS BG, SAP | P1 | S | Lock one draft card so it survives a reroll. Cheap QoL + strategic depth. |
| D6 | **Tier-gated availability** | SAP, HS BG, TFT | P2 | M | Higher-rarity units only appear after round N. Smooths power curve. |
| D7 | **Shared unit pool** | TFT, HS BG, Pokemon AC | P2 | L | Limited copies of each unit across both players — drafting denies opponent. Big design change. |
| D8 | **Pre-match loadout draft** | Marvel Snap, MTG sealed | P2 | M | Build a deck before the match starts instead of round-by-round. Alternate mode. |

---

## 2. Units & Stats

### Have
- Core stats: HP, DMG, Range, Speed, AtkSpeed, Crit (`forge.js:40-44`)
- Rarity tiers: common / rare / legendary (`forge.js:49`)
- Draft cost 1-20 (`forge.js:50`)
- Roles: frontline / carry / counter / support / utility (`forge.js:57`)
- Player XP/level + unit upgrade levels 0-10 (`ui.js:614-628`)
- Behaviour Composition API: 12 targeting, 8 movement, 6 attack conditions, 10 triggers (`battle-helpers.js:407-411`)
- 21 abilities, 19 weapon types (`battle-helpers.js:411`, `forge.js:11`)
- Visual customization: bodyPlan, features, aura, pattern, colors (`forge.js:59-68`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| U1 | **Armor / damage reduction stat** | TFT items, Pokemon AC | P1 | M | Flat or % damage reduction. Currently only HP scaling — no way to build "tanky vs physical". |
| U2 | **Magic resistance** | TFT, Pokemon AC | P2 | M | Separate resist for spell damage. Pairs with U1. |
| U3 | **Mana / energy resource** | Pokemon AC (PP), TFT mana | P1 | L | Abilities charge from combat instead of being always-on passives. Big gameplay shift. |
| U4 | **Evolution / ascension paths** | Machine Guard, Pokemon AC | P0 | L | Branching upgrade tree that changes unit behavior (not just stat bumps). RESEARCH.md flags this as Very High impact. |
| U5 | **3-copy merge (golden unit)** | TFT, HS BG, SAP, Pokemon AC | P1 | M | Combine 3 identical units → stronger "golden" version. Universal genre convention. |
| U6 | **Damage types** | Pokemon AC (phys/special/true) | P2 | M | Classify damage for resist calculations. Pairs with U1/U2. |
| U7 | **Unit cap / board size scaling** | TFT (level → capacity) | P2 | S | Currently fixed loadout of 4. Could scale with player level. |
| U8 | **Stat caps** | SAP (50 cap) | P2 | S | Prevent runaway stats in endless mode. |

---

## 3. Combat

### Have
- 19 weapons with distinct FX + ranges (`forge.js:11`, `forge.js:322`)
- Melee / ranged / breath attack types (`forge.js:322`)
- Projectiles with trails (`rendering.js:1280-1281`)
- 21 abilities incl. splash, heal, dodge, poison, spawn, lifesteal, explode, shield, rage, slow, ramp, thorns, blink_strike, frenzy, regen, cleanse, taunt, executioner, chain_lightning (`battle-helpers.js:411`)
- Spells: 5 triggers, 11 targets, 11 effects, 6 shapes, 7 FX (`battle.js:7-13`)
- AoE shapes: point, circle, line, cone, persistent_zone (`battle.js:11`)
- Status effects: poison, slow, stun, regen, shield, rage (`battle.js:206-211`)
- Crits with visual burst (`rendering.js:1139`)
- Knockback via spells (`battle.js:11`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| C1 | **Silence / ability lock** | TFT, HS BG, MTG | P1 | S | Prevent target from using abilities for a duration. New status effect. |
| C2 | **Stealth / invisibility** | Machine Guard (Ghost Dog), MTG | P1 | M | Untargetable by single-target but vulnerable to AoE. Adds positioning depth. |
| C3 | **Charm / mind control** | HS BG, MTG | P2 | M | Temporarily flip a unit to your team. High-impact spell. |
| C4 | **Fear / flee** | MTG, HS BG | P2 | S | Force enemy to move away. Movement-impairing debuff. |
| C5 | **Bleed / stacking DoT** | SAP, HS BG | P2 | S | Like poison but stacks. Different damage profile. |
| C6 | **Buff auras (team-wide)** | TFT traits, Machine Guard bosses | P1 | M | Unit emits aura that buffs nearby allies. Pairs with synergy system. |
| C7 | **Ground / flying split** | Machine Guard, Storybook Brawl | P2 | M | Flying units avoid melee + ground-targeted spells. Adds a tactical axis. |
| C8 | **Active player skills (cooldown)** | Machine Guard (Q/W/E) | P0 | M | ✅ **IMPLEMENTED** — spell bar UI with manual casting + power-based cooldowns (3-10s). Spells are drafted 30% chance and castable during battle (`battle.js:499,811`). |
| C9 | **Armor penetration** | TFT items | P2 | S | Counter-stat for U1. |
| C10 | **True damage** | TFT, Pokemon AC | P2 | S | Bypasses all resist. Important for U1/U2 balance. |

---

## 4. Match Structure

### Have
- Sequential rounds until lives = 0 (`match.js:31-45`)
- Configurable lives per arena (`match.js:3-6`, `ui.js:424-437`)
- Draw condition: both lose a life (`match.js:62`)
- Match history + death log (`match.js:8`, `match.js:20`)
- Forfeit + 30s reconnect grace (`match.js:90-108`)
- Replay save/load (`save.js:118-120`, `ui.js:857-863`)
- Endless mode with scaling difficulty (`ui.js:1356-1365`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| M1 | **Round time limit** | HS BG, Storybook Brawl | P1 | S | ✅ **IMPLEMENTED** — 90s battle timeout, resolves by HP total (`battle.js:2958`). |
| M2 | **Sudden death / overtime** | (genre variant) | P2 | S | If round timer expires, both sides take escalating damage. Pairs with M1. |
| M3 | **Best-of-N series** | MTG Traditional | P2 | S | Match = best of 3/5 rounds instead of lives. Arena config option. |
| M4 | **PvE / neutral rounds** | TFT minions, Pokemon AC portals | P1 | M | Every Nth round is vs neutral creeps that drop items/gold. Breaks up PvP, gives comeback room. |
| M5 | **Boss rounds** | Machine Guard (6 tiers) | P1 | L | Special rounds vs a single powerful boss with unique mechanics. RESEARCH.md flags as High impact. |
| M6 | **Placement-based damage** | TFT, HS BG | P2 | M | Damage to loser scales with surviving enemy units, not flat 1 life. More punishing for blowouts. |
| M7 | **Spectator mode** | TFT, HS BG | P2 | L | Watch another P2P match. Requires relay/3rd peer. |

---

## 5. Economy

### Have
- Coins (primary currency) (`ui.js:538`)
- Coin rewards: wins, streaks, daily first win, quests (`ui.js:2598-2687`)
- Shop: buy random units, 10-coin reroll, cost scales with collection (`ui.js:4288-4423`)
- Upgrade units with coins (`ui.js:4274-4288`)
- Win streak bonuses (`ui.js:2641-2646`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| E1 | **In-match economy (per-round income)** | TFT, HS BG, SAP, Pokemon AC | P0 | M | Currently no gold flow *during* a match — economy is meta-only. Core genre convention. Could be "compute tokens" thematically. |
| E2 | **Interest on savings** | TFT (+1g per 10g, max 5) | P1 | S | Reward hoarding. Pairs with E1. |
| E3 | **Loss streak bonus** | TFT | P1 | S | Compensate losing players. We have win streaks but not loss streaks. |
| E4 | **Sell / refund units** | TFT, SAP, Backpack Battles | P1 | S | Sell drafted units back for partial coins. Currently no way to divest. |
| E5 | **Spend-it-all (no carryover)** | HS BG | P2 | S | Alt economy mode where coins reset each round. Simpler than interest. |
| E6 | **Kill bounty** | Pokemon AC, TFT (last hit) | P2 | S | Earn coins from kills during battle, not just wins. |
| E7 | **Premium currency** | TFT, Marvel Snap, SAP | P2 | M | Real-money currency for cosmetics. Monetization — needs care given our P2P/no-server stance. |

---

## 6. Synergy / Trait System  ⚠ BIGGEST GAP

### Have
- Roles: frontline / carry / counter / support / utility (`forge.js:57`)
- Synergy *meter* (role balance indicator) (`ui.js:4076-4152`)
- Role-based drafting hints (`ui.js:1785-1795`)
- Role win tracking (`ui.js:562`, `save.js:83`)
- Formation positioning by role (`ui.js:1585-1593`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| S1 | **Origin / faction traits** | TFT (Demacia, Piltover), Pokemon AC (Fire, Water) | P0 | L | Units belong to factions; N units of same faction → bonus. **The single most-requested feature in RESEARCH.md.** |
| S2 | **Class traits** | TFT (Sorcerer, Brawler), HS BG tribes | P0 | L | Combat-role synergies (e.g., 3 ranged → +atk speed). Distinct from our 5 roles. |
| S3 | **Tiered thresholds (2/4/6)** | TFT, Pokemon AC | P0 | S | Bonuses escalate at piece counts. Standard genre convention. |
| S4 | **Trait emblems / reassignment** | TFT (Spatula) | P2 | M | Item that grants a unit an extra trait. Flexible synergy building. |
| S5 | **Active synergy indicators in draft** | TFT | P1 | S | Show live trait counts while drafting, not just role balance. |
| S6 | **Set rotation** | TFT (every ~4 months) | P2 | XL | Periodically overhaul traits/units. Long-term content strategy. |
| S7 | **Tribe-restricted lobbies** | HS BG | P2 | M | Only certain factions available in a match. Adds variety. |

> **Note:** S1+S2+S3 together form the single highest-impact addition. Every comparable
> autobattler has trait synergies; we have only role labels. RESEARCH.md (Pokemon Auto
> Chess + TFT rows) flags this as High impact, Medium effort.

---

## 7. Items / Equipment

### Have
- (Nothing — no item system)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| I1 | **Item components** | TFT, Pokemon AC, MTG auras | P1 | M | Base stat items dropped from PvE rounds or bought. |
| I2 | **Item combining** | TFT (2 components → complete), Backpack Battles | P1 | L | Combine components into stronger items. Recipe discovery. |
| I3 | **Equipment slots per unit** | TFT (3 slots), Pokemon AC (3) | P1 | S | Limit items per unit. |
| I4 | **Item rarity tiers** | Backpack Battles, SAP food | P2 | S | Common/Rare/Epic/Legendary items. |
| I5 | **Consumable items / food** | SAP (food), HS BG (Tavern Spells) | P2 | M | One-use buffs. Different from equippable items. |
| I6 | **Item shop** | Backpack Battles, SAP | P2 | M | Separate from unit shop. |

> **Decision needed:** Items are a big system. Could scope to I1+I3 (simple stat items)
> first, defer combining. Or skip entirely and lean into the forge/spell system instead.

---

## 8. Forge / Customization

### Have
- LLM forge with web-llm (SmolLM2-360M mobile, Qwen2.5-1.5B desktop) (`forge.js:88-104`)
- Procedural fallback if LLM unavailable (`forge.js:168-181`)
- Recipe assembler (visual recipe builder) (`forge.js:200-400`)
- Visual modifiers (bodyPlan, features, aura, pattern, etc.) (`forge.js:59-68`)
- Spell forge + spellbook (`forge.js:1888-1922`, `save.js:87-96`)
- URL-based unit/spell sharing (`ui.js:820-835`)
- Fuse duplicates to level up (`ui.js:4211-4212`)
- Daily forge cap + ad-reward skip (`save.js:80-84`, `utils.js:415-444`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| F1 | **Live visual preview during forge** | (UX convention) | P1 | S | Show sprite as you tweak recipe params before generating. |
| F2 | **Spell combining / crafting** | TFT items, HS BG Spellcraft | P2 | M | Combine spells into stronger variants. |
| F3 | **Forge templates / presets** | (UX convention) | P2 | S | Save a recipe template to re-run with variations. |
| F4 | **Trait assignment in forge** | TFT emblems | P1 | S | Let forge assign origin/class traits (pairs with S1/S2). |
| F5 | **Evolution forge** | Machine Guard, Pokemon AC | P0 | L | Forge evolution paths for a unit (pairs with U4). |
| F6 | **Model-themed cosmetics** | (AI theme unique) | P2 | M | Visual styles themed after LLM model families. Differentiator. |

---

## 9. Multiplayer / P2P

### Have
- Trystero WebRTC P2P (`network.js:179-246`)
- Room system with optional password (`network.js:188-190`)
- Host/guest roles, host authoritative (`network.js:6`)
- Lockstep mode with command scheduling (`network.js:14-16`, `battle.js:LOCKSTEP_DELAY`)
- Desync detection via state hash + Merkle tree (`battle-helpers.js:34-70`)
- Snapshot fallback on desync (`network.js:16`)
- Host-authoritative relay option (`network.js:16-17`, `NETRELAY.md`)
- Heartbeat 2s/10s timeout, rate limiting, ICE/STUN/TURN (`network.js:18-43`)
- Matchmaking queue per arena (`ui.js:1254-1337`)
- Message signing (anti-cheat) (`network.js`)
- Latency stats (RTT/jitter/loss) (`network.js:39-41`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| N1 | **In-game chat / emotes** | HS BG (pings), TFT, Marvel Snap | P1 | S | Quick chat wheel + emotes. P2P already has a channel. |
| N2 | **2v2 / Duos mode** | HS BG Duos, TFT Double Up | P2 | XL | 4-player P2P. Big netcode change. |
| N3 | **Spectator mode** | TFT, HS BG | P2 | L | 3rd peer receives state only. Requires relay. |
| N4 | **Tournament / custom lobbies** | HS BG, SAP, Backpack Battles | P2 | M | Private rooms with custom rules. |
| N5 | **Ranked matchmaking (MMR)** | TFT, HS BG, Marvel Snap, Pokemon AC | P1 | M | We have ELO (`save.js:114-115`) but no MMR-based pairing. Matchmaking queue is first-come. |
| N6 | **Reconnect mid-match** | (genre convention) | P1 | M | We have 30s grace (`match.js:99-108`) but no full reconnect to in-progress match. |
| N7 | **Async PvP (vs saved builds)** | SAP Arena, Backpack Battles | P2 | L | Battle saved loadouts without live opponent. Sidesteps P2P availability. |

---

## 10. Bots / AI Opponents

### Have
- Bot opponent when P2P unavailable (`bot.js:23-81`)
- Bot loadout from arena pool (`bot.js:26-56`)
- Role-fill + counter-pick strategy (`bot.js:4-21`)
- Difficulty: easy / normal / hard (`ui.js:1382-1392`)
- Endless scaling (`ui.js:1356-1365`)
- 30% spell inclusion (`bot.js:73-78`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| B1 | **Adaptive AI (learns from player)** | Machine Guard (adaptive hive) | P2 | L | Track player's win patterns, counter-strategize. |
| B2 | **Bot personalities** | Machine Guard (elite variants) | P2 | S | Aggressive / defensive / economy-focused bots. |
| B3 | **Co-op vs AI** | TFT Double Up vs bots | P2 | L | 2 humans vs 1-2 bots. Pairs with N2. |
| B4 | **Bot uses active skills** | Machine Guard (Q/W/E) | P1 | S | If we add C8, bots should use it too. |
| B5 | **Bot uses synergies** | TFT AI, Pokemon AC | P1 | M | Bot drafts for trait bonuses once S1/S2 exist. |

---

## 11. Progression / Meta

### Have
- Save system (LocalStorage + IndexedDB) with migration (`save.js:2-129`)
- Player XP/level (`ui.js:614-615`)
- Arena ladder (5 arenas, unlock thresholds) (`ui.js:424-437`)
- Daily quests (3 rotating) (`quests.js:37-54`)
- Login streaks (`quests.js:19-36`)
- 20+ achievements (`ui.js:3058-3120`)
- Collection + 4-unit loadout (`save.js:64-74`)
- ELO rating (`save.js:114-115`)
- Replay system (`save.js:118-120`)
- Stats tracking (`ui.js:4514-4551`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| P1 | **Ranked ladder tiers** | TFT (Iron→Challenger), Marvel Snap, MTG | P1 | S | ✅ **IMPLEMENTED** — Bronze→Legend tiers via `rankedTier()` (`ui.js:794-802`). |
| P2 | **Seasonal resets** | TFT, HS BG, Marvel Snap | P2 | S | Partial rank reset each season. |
| P3 | **Battle pass** | TFT, Marvel Snap, SAP | P2 | L | Free + premium reward tracks. Monetization. |
| P4 | **Cosmetics (skins, boards)** | TFT, HS BG, Marvel Snap | P2 | L | Cosmetic-only unlocks. Pairs with F6. |
| P5 | **Guild / clan system** | (genre variant) | P2 | XL | Social meta-layer. Big scope. |
| P6 | **Quest variety expansion** | HS BG quests, Marvel Snap missions | P2 | S | More quest types beyond current 3 dailies. |
| P7 | **Weekly events** | SAP (weekly packs), TFT (set events) | P2 | M | Time-limited modes/rewards. |
| P8 | **Tutorial / onboarding expansion** | TFT, Marvel Snap | P1 | S | ✅ **IMPLEMENTED** — 6-step interactive onboarding tutorial (`ui.js:721-763`). |

---

## 12. UI / UX

### Have
- 19 screens (menu, draft, battle, forge, deck, shop, codex, stats, settings, etc.) (`index.html:101-243`)
- Toasts, custom tooltips, confirm modals (`utils.js:14-42`)
- Mobile support (touch, PWA, iOS standalone) (`utils.js:44-101`)
- 4-language i18n (EN/ES/PT/DE) (`utils.js:262-359`)
- Settings (audio, quality, reduced motion, colorblind, high contrast) (`ui.js:1054-1070`)
- Haptics, fullscreen, loading splash (`utils.js:51-101`)
- Card UI with rarity glows (`ui.js:1919-1950`)
- Spell bar, lives HUD, synergy meter (`battle.js`, `ui.js:1629-1640`, `ui.js:4076-4152`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| X1 | **In-game chat / emote wheel** | HS BG, TFT, Marvel Snap | P1 | S | Pairs with N1. |
| X2 | **Match summary / post-game stats** | TFT, Marvel Snap, Backpack Battles | P1 | S | ✅ **IMPLEMENTED** — MVP display, match analysis, highlights, performance ranking (`ui.js:2780-2852`). |
| X3 | **Codex / unit database** | (we have a codex screen) | P2 | S | Expand codex with stats, synergies, lore. |
| X4 | **Tier list (community)** | TFT community tools | P2 | M | We have a tier list screen; could add community data. |
| X5 | **Color themes beyond arena** | (UX convention) | P2 | S | Player-selectable UI themes. |
| X6 | **Replay viewer with controls** | TFT, MTG | P2 | M | Scrub, pause, slow-mo replays. We save replays but viewer is basic. |
| X7 | **Ad system (real)** | SAP, Marvel Snap | P2 | M | Current AdSDK is a stub (`utils.js:417-444`). |

---

## 13. Rendering / Audio

### Have
- Recipe-based sprite system + skeletal animation (`rendering.js:1-197`)
- Sprite cache, particle FX, screen shake (`rendering.js`)
- Team colors, ground decals, drop shadows (`rendering.js:113-138`)
- Damage numbers, crit burst, weapon FX (`rendering.js:1139`, `rendering.js:1276-1281`)
- Reduced motion + quality settings (`rendering.js:79-82`, `ui.js:1058`)
- Audio (SFX + music volume) (`ui.js:1054-1070`)

### Gaps

| # | Feature | In | Priority | Effort | Notes |
|---|---------|----|---------|--------|-------|
| R1 | **Per-unit bespoke drawing** | Machine Guard (drawInfantry, drawDog...) | P2 | L | Hand-crafted draw per unit type. Currently all procedural. |
| R2 | **Weather / environment FX** | (genre convention) | P2 | M | Rain, snow, fog per arena theme. |
| R3 | **Boss visual escalation** | Machine Guard (6 boss tiers) | P2 | M | Pairs with M5. |
| R4 | **Status ring overlays** | Machine Guard | P1 | S | ✅ **IMPLEMENTED** — colored rings for shield (white), stun (yellow), poison (green), slow (blue) (`battle.js:2448-2460`). |
| R5 | **Projectile trail variety** | Machine Guard (7-point history) | P2 | S | More trail types per weapon. |

---

## Priority Summary

### P0 — Must Have (core genre conventions we lack)
| ID | Feature | Effort | Status |
|----|---------|--------|--------|
| S1+S2+S3 | Origin/class traits with tiered thresholds | L | ❌ Missing |
| U4 / F5 | Unit evolution paths (forge + battle) | L | ❌ Missing |
| E1 | In-match economy (per-round income) | M | ❌ Missing |
| ~~C8~~ | ~~Active player skills (cooldown)~~ | ~~M~~ | ✅ Implemented (spell bar) |

### P1 — High Value
| ID | Feature | Effort | Status |
|----|---------|--------|--------|
| U1 | Armor stat | M | ❌ Missing |
| U3 | Mana / energy resource | L | ❌ Missing |
| U5 | 3-copy merge (golden units) | M | ❌ Missing |
| C1 | Silence status | S | ❌ Missing |
| C2 | Stealth | M | ❌ Missing |
| C6 | Buff auras | M | ❌ Missing |
| ~~M1~~ | ~~Round time limit~~ | ~~S~~ | ✅ Implemented (90s timeout) |
| M4 | PvE / neutral rounds | M | ❌ Missing |
| M5 | Boss rounds | L | ❌ Missing |
| E2 | Interest on savings | S | ❌ Missing |
| E3 | Loss streak bonus | S | ❌ Missing |
| E4 | Sell / refund units | S | ❌ Missing |
| D1 | Ban/pick phase | M | ❌ Missing |
| D3 | Shared carousel round | M | ❌ Missing |
| D5 | Freeze/lock shop offering | S | ❌ Missing |
| S5 | Active synergy indicators in draft | S | ❌ Missing (needs S1/S2 first) |
| I1+I2+I3 | Item system (components + combine + slots) | M-L | ❌ Missing |
| F1 | Live visual preview in forge | S | ❌ Missing |
| F4 | Trait assignment in forge | S | ❌ Missing (needs S1/S2 first) |
| N1 / X1 | Chat / emote wheel | S | ❌ Missing |
| N5 | MMR-based matchmaking | M | ❌ Missing |
| N6 | Mid-match reconnect | M | ❌ Missing |
| B4 | Bot uses active skills | S | ❌ Missing |
| B5 | Bot uses synergies | M | ❌ Missing (needs S1/S2 first) |
| ~~P1~~ | ~~Ranked ladder tiers~~ | ~~S~~ | ✅ Implemented (Bronze→Legend) |
| ~~P8~~ | ~~Expanded onboarding~~ | ~~S~~ | ✅ Implemented (6-step tutorial) |
| ~~X2~~ | ~~Post-game match summary~~ | ~~S~~ | ✅ Implemented (MVP + analysis) |
| ~~R4~~ | ~~Status ring overlays~~ | ~~S~~ | ✅ Implemented (shield/stun/poison/slow) |

### P2 — Nice to Have
Everything else in the tables above (cosmetics, seasons, guilds, 2v2, spectator,
premium currency, weather FX, etc.). Defer until P0/P1 are in.

---

## Suggested Roadmap

A reasonable build order that respects dependencies. Items marked ✅ are done.

1. **Traits (S1+S2+S3)** — foundation; everything else builds on it ❌
2. **In-match economy (E1+E2+E3)** — gives meaning to drafting choices ❌
3. **Sell/refund (E4) + Freeze shop (D5)** — QoL that the new economy needs ❌
4. **3-copy merge (U5)** — uses the economy; pairs with traits ❌
5. ~~**Active skills (C8) + Bot skills (B4)** — player agency during battle~~ ✅ (C8 done via spell bar; B4 still missing)
6. **Item system v1 (I1+I3)** — simple stat items from PvE rounds ❌
7. **PvE rounds (M4) + Boss rounds (M5)** — source for items, breaks up PvP ❌
8. **Evolution paths (U4+F5)** — deep upgrade tree (RESEARCH.md top pick) ❌
9. **Armor + magic resist (U1+U2)** — balance for new damage sources ❌
10. ~~**Round time limit (M1)** — once battles get more complex~~ ✅
11. **Silence + stealth (C1+C2)** — new status effects for spell variety ❌
12. ~~**Ranked tiers (P1)** + MMR (N5)** — competitive structure~~ ✅ (P1 done; N5 still missing)
13. ~~**Chat/emotes (N1)** + post-game summary (X2)** — multiplayer polish~~ ✅ (X2 done; N1 still missing)

Each phase is independently shippable. Traits + economy alone would close the
biggest genre-convention gap and make the game feel like a "real" autobattler.

---

## Open Design Questions

1. **Economy theme:** Pure gold, or AI-themed (compute tokens, training data)?
   AI theme would differentiate but adds flavor-text burden.
2. **Trait flavor:** Generic fantasy factions, or AI-model families (GPT/Claude/Gemini)?
   The latter leans into the "Prompt Showdown" identity.
3. **Items vs. forge:** Do we need both? Forge already covers unit customization.
   Items might overlap. Could make "items" = forgeable spell-adjacent equipment.
4. **Evolution vs. 3-copy merge:** Both? Merge is the genre convention; evolution
   is the Machine Guard differentiator. Could merge → unlock evolution choice.
5. **PvE scope:** Full boss roster (Machine Guard's 6 tiers) or just 1-2 neutral rounds?
6. **Multiplayer ceiling:** Stay 1v1 P2P, or invest in 2v2/async? P2P complexity
   scales poorly with player count.
