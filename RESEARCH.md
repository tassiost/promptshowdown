# RESEARCH.md — Autobattler Research Findings

Research session: surveyed autobattler projects, multiplayer architectures, and AI-first
game templates to identify ideas we can adopt without violating our constraints
(single-file, no build step, no dependencies).

## Table of Contents

1. [Machine Guard Corps](#1-machine-guard-corps)
2. [Pokemon Auto Chess (Colyseus)](#2-pokemon-auto-chess-colyseus)
3. [chibi-arena (Rust + Godot)](#3-chibi-arena-rust--godot)
4. [Lagless (TypeScript ECS)](#4-lagless-typescript-ecs)
5. [OpenFront (Pure TypeScript)](#5-openfront-pure-typescript)
6. [TFT Design Docs (Riot Games)](#6-tft-design-docs-riot-games)
7. [Phaser-TypeScript-AI-First-Starter](#7-phaser-typescript-ai-first-starter)
8. [Multiplayer Architecture Comparison](#8-multiplayer-architecture-comparison)
9. [Concrete Takeaways for Prompt Showdown](#9-concrete-takeaways-for-prompt-showdown)

---

## 1. Machine Guard Corps

**Repo**: `reference/Machine-Guard-Corps/` (cloned locally, gitignored)
**Source**: https://github.com/Mars723/Machine-Guard-Corps
**Stack**: Vanilla JS, HTML5 Canvas, CSS. Single `game.js` (~3,456 lines). No build step,
no dependencies. **Same constraints as us.**

### Overview

Sci-fi lane-defense autobattler. Your base on the left, alien hive on the right. Deploy
units with energy, earn scrap from kills, upgrade your tower, evolve units, fight an
adaptive AI hive. Win by destroying the hive; lose if your base hits 0 HP.

### Key Features We Don't Have

#### Evolution System (standout feature)
Every player unit has **2 evolution paths**, each with stat changes + a new mechanic:
- Infantry → **Blast Infantry** (explodes on death, radius 96, 130 dmg) OR **Field Mechanic** (drops repair parts on death that heal allies)
- Dog → **Ghost Dog** (10s stealth, untargetable but splash still hits) OR **Razor Roller** (rushes forward dealing lane damage)
- Drone → **Highwing** (flying, avoids melee + splash) OR **Arc Volt** (chain lightning, 4 targets, 0.68 falloff)
- Tank → **Aegis** (holographic shield reflects ranged projectiles) OR **Pulse** (periodic EMP shockwave, damages + stuns nearby ground enemies)
- Railgun → **Linebreaker** (fixed-length piercing beam) OR **Skyfall Cannon** (orbital strike, heavy AOE)

This is a **branching upgrade tree** that changes unit behavior fundamentally — not just
stat bumps. Bought with scrap via `Cmd/Ctrl+1-0`.

#### Heat System (second resource)
Machines build heat when attacking. At 100 heat → 2s shutdown (can't move or attack).
Coolant Banks upgrade reduces buildup + improves cooling. Adds a second resource axis
beyond HP — a unit can be alive but overheated and useless.

#### Fortress Systems (both bases are alive)
- **Auto-turret**: both fortresses have automatic weapons (damage/range/firerate upgradeable)
- **Out-of-combat regen**: if a fortress avoids damage for 8s, it slowly repairs
- **Emergency shields**: at 50% HP → 5s invulnerability; at 15% HP → 10s invulnerability. The hive also refills its energy when shields trigger.

#### Boss Escalation
6 boss tiers with unique shapes/mechanics: Hive Siege Core → Broodmaw Crusher → Void
Prism Tyrant → Carapace Sovereign → Dreadspire Artillery → Star-Eater Monarch. After
the sequence exhausts, **double-boss rounds** begin. Bosses have aura buffs, splash
damage, and high armor.

#### Enemy AI with Its Own Economy
The hive isn't a scripted wave spawner. It has its own energy (regenerates faster than
player), upgrade logic, boss timing, and defensive reactions. Elite variants (1.55x HP,
1.25x dmg, dashed gold ring) add variety.

#### Active Skills (player agency)
Three cooldown-based skills: **Missile Strike** (AOE damage), **EMP Pulse** (slow all
enemies 3.6s), **Repair Swarm** (heal all machines + reduce heat). Gives the player
something to do during the auto-battle.

#### Per-Unit Bespoke Drawing
Each unit type has its own `drawInfantry()`, `drawDog()`, `drawDrone()`, etc. function
with hand-crafted shapes. Each draw function knows the unit's anatomy and can animate
parts independently (roller spins, drone bobs, boss shapes vary by tier).

#### Visual Feedback Systems
- Status rings: slow = blue dashed, stun = cyan solid, shutdown = yellow pulsing, shield = green/purple
- Projectile trails (7-point history, fading alpha)
- Floating text for heals/damage
- Elite dashed gold ring
- Evolution marks on evolved units
- Hit flash (white circle overlay)
- Shield flash (colored ring)

### File Structure
```
game.js     3,456 lines  — all game logic + rendering
index.html     86 lines  — page shell + UI layout
style.css     385 lines  — responsive sci-fi UI styling
```

### What We Can Learn
- **Evolution paths** are the highest-impact feature for gameplay depth. Our upgrade
  system is stat-only; adding branching behavioral upgrades would transform the game.
- **Active skills** give player agency during auto-battle — low effort, medium impact.
- **Heat/overheat** adds tactical resource management beyond HP.
- **Boss escalation** creates a natural difficulty curve and late-game drama.
- **Per-unit draw functions** produce more distinctive visuals than generic recipes,
  but at the cost of more code. Our `SPRITE_RECIPES` approach is more scalable.

---

## 2. Pokemon Auto Chess (Colyseus)

**Source**: https://github.com/keldaanCommunity/pokemonAutoChess (1.8k stars)
**Stack**: TypeScript, Colyseus, MongoDB, Firebase, Redis, PM2. Full-stack multiplayer.

### Architecture
- **Colyseus** server manages rooms, state synchronization, messaging
- **Redis** handles presence and pub/sub between server instances
- **MongoDB** stores user data, game history, statistics
- **Firebase** provides authentication
- **WebSockets** for real-time communication

### Room Lifecycle
Players move through four room types:
1. `CustomLobbyRoom` — matchmaking, chat, browsing games
2. `PreparationRoom` — game setup, team selection, configuration
3. `GameRoom` — core gameplay with server-authoritative state
4. `AfterGameRoom` — post-game results, statistics, rewards

### State Synchronization (Colyseus schema-based)
- Server state defined with `@type()` decorators on `Schema` classes
- Colyseus tracks **property-level changes** and sends only the diff at `patchRate` intervals
- A 100-unit battlefield doesn't send 100 units every frame — only changed fields
- Clients receive full state on join, then incremental patches

### Command Pattern
Every player action is a command class (`BuyCommand`, `PlaceCommand`, etc.). Room
message handlers dispatch commands. This isolates game logic from networking.

### Server Runs the Sim
`GameRoom.startGame()` sets a `setSimulationInterval()` — the server ticks the
simulation and broadcasts state. Clients never run game logic. **No desync possible.**

### Reconnection
`allowReconnection()` with a timeout. If a player disconnects, their seat is held; on
reconnect, they get the full current state.

### Scaling
PM2 cluster mode + Redis presence. Rooms distribute across server instances.
Matchmaking works across all instances.

### Game Design Ideas
- **Strategy pattern for abilities**: each ability is its own class extending `AbilityStrategy`. The `process()` method receives (pokemon, state, board, target, critFlag).
- **PP (Power Points) system**: units build PP by attacking, taking damage, and from items. When PP hits max, the ability fires. More dynamic than cooldown-only.
- **Damage types**: PHYSICAL (reduced by DEF), SPECIAL (reduced by SPDEF), TRUE (ignores defense).
- **Precomputed data pipeline**: `npm run precompute` processes pokemon + synergy data into JSON.
- **Tiered synergies**: bonuses activate at 2/4/6 pieces of a trait, with escalating power.

### What We Can Learn
- **Command pattern** for player actions — cleaner than inline switch statements
- **PP/mana system** — abilities that charge from combat engagement feel more dynamic
- **Damage types + resistances** — adds tactical depth (armor-piercing vs magic)
- **Tiered synergies** — 2/4/6 piece thresholds with escalating bonuses
- **Schema-based state sync** — property-level diffs are bandwidth-optimal (relevant for our relay plan)
- **Reconnection with seat holding** — we currently drop on disconnect

---

## 3. chibi-arena (Rust + Godot)

**Source**: https://github.com/ayuan153/chibi-arena
**Stack**: Rust (sim), Godot 4.6 (client), WebSocket (networking), RON (data), PostgreSQL (prod)

### Architecture
Multi-crate workspace with clean dependency boundaries:
```
crates/
├── aa2-sim/      # Deterministic combat simulation
├── aa2-data/     # Shared types, schemas, RON loaders
├── aa2-game/     # Game state machine, economy, draft, action dispatch
├── aa2-net/      # Serde wire types (ClientMsg/ServerMsg/DTOs)
├── aa2-client/   # Godot GDExtension (gdext); NetClient for networked mode
└── aa2-server/   # Authoritative WebSocket game server (tokio + tungstenite)
```

### Key Design Decisions
- **Deterministic simulation** — fixed-seed combat enables reproducible tests, replays, and server-authoritative validation
- **Server-authoritative dumb client** — server owns game state and runs the sim; clients send intents and render received state
- **Declarative data files (RON)** — units, abilities, and bodies defined in data files, not code

### What We Can Learn
- **Conceptual separation** of sim/data/game/net/client/server — we can emulate this with IIFE namespaces or comment-delimited sections in our single file
- **Server-authoritative dumb client** — the cleanest multiplayer model; no desync possible because only one entity runs the sim
- **Declarative data files** — extract `SPRITE_RECIPES`, `UNIT_DEFS`, `SPELL_DEFS` into a separate `data.js` loaded before the main script

---

## 4. Lagless (TypeScript ECS)

**Source**: https://github.com/GbGr/lagless
**Stack**: TypeScript, ArrayBuffer-based ECS, Bun server, Pixi.js rendering

### Key Innovation: All State in One ArrayBuffer
Structure-of-Arrays (SoA) layout — entire simulation state lives in a single pre-allocated
ArrayBuffer. This enables:
- **Instant snapshots** via `ArrayBuffer.slice()`
- **Zero-overhead state transfer**
- **Rollback netcode**: when a remote input arrives for an already-simulated tick, roll back to the nearest snapshot and re-simulate forward

### PRNG State in the Snapshot
The `xoshiro128**` PRNG state lives in the ArrayBuffer. Rollback restores the exact random
sequence. Our `rand()` uses a module-level seed — we'd need to snapshot/restore it manually.

### What We Can Learn
- **Rollback netcode** — our lockstep is forward-only; rollback would make desync recovery trivial
- **State in ArrayBuffer** — not practical for our single-file approach, but the concept of "snapshot = slice state" is relevant for the relay plan's state serialization
- **PRNG as part of state** — if we ever do rollback, the PRNG seed must be snapshotted

---

## 5. OpenFront (Pure TypeScript)

**Source**: https://www.mintlify.com/openfrontio/OpenFrontIO/technical/core-simulation
**Stack**: Pure TypeScript, zero external dependencies, runs in browser/Node.js/workers

### Key Principles
- **Deterministic** — same inputs always produce same outputs
- **Pure** — no side effects, randomness, or I/O in the core
- **Thread-safe** — runs in worker threads
- **Portable** — works in browser, Node.js, and offline

### Banned in the Core
- `Math.random()` (use seeded RNG)
- `Date.now()` (use tick counters)
- External npm packages
- File I/O or network calls
- Non-deterministic algorithms

### Intent-Execution Architecture
Clients send intents (structured actions), server executes them against game state. The
cleanest multiplayer model — no desync possible because only one entity runs the sim.

### What We Can Learn
- **Sim in Web Worker** — move the entire sim into a Web Worker and communicate via `postMessage`. Frees the main thread for rendering, eliminates jank-induced desync.
- **Intent-based commands** — both peers queue intents and execute them at a scheduled tick, even without a server
- **Pure deterministic core** — we already enforce this via `DMath.*` and `rand()`, but could go further

---

## 6. TFT Design Docs (Riot Games)

**Sources**:
- https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-design-pillars-of-tft/
- https://teamfighttactics.leagueoflegends.com/en-gb/news/dev/dev-tft-into-the-arcane-learnings/
- https://teamfighttactics.leagueoflegends.com/en-au/news/dev/dev-tft-inkborn-fables-learnings/
- https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-tft-magic-n-mayhem-learnings/
- https://teamfighttactics.leagueoflegends.com/en-us/news/dev/dev-teamfight-tactics-galaxies-learnings/

### Cost Tier Structure
- **1-cost**: early game, filler units
- **4-cost**: primary carries, comps built around them
- **5-cost**: caps that separate 1st from 4th place

Our units don't have a cost economy — adding a draft/gold system with cost tiers would
add strategic depth.

### Trait Design Learnings
- Small traits (2/4 pieces) that grant team-wide power are good — they let you flex into partial synergies
- Vertical traits (6+ pieces) should be viable but not mandatory
- "Cybernetic required an early 3 and then you were locked into 6 or you weren't playing it" — this is a design failure
- Our composition bonuses should avoid this trap

### Champion Augments
Best when they "change how the champion is played fundamentally" but are "relatively
narrow." Machine Guard Corps's evolution system is exactly this — Ghost Dog plays
completely differently from Razor Roller.

### Power Structure
3-star 2-costs were competing with 2-star 4-costs, which was wrong. The lesson:
investment in upgrading cheap units should cap out before expensive units come online.

### Mastery Pillars
- **Knowledge**: drafting, trait synergies, item optimization
- **Positioning**: board layout, frontline/backline
- **Economy**: when to save, when to roll, when to level
- **Adaptability**: reading the lobby, pivoting comps

---

## 7. Phaser-TypeScript-AI-First-Starter

**Source**: https://github.com/boringstack-xyz/Phaser-TypeScript-AI-First-Starter
**Stack**: Phaser 4, TypeScript 6, Vite 8, Vitest 4, ESLint 10, dependency-cruiser, Zod

### Overview
A template repository for building Phaser games with AI agents. Not a game — a starter
kit. The pitch: "a programmer who has never shipped a game can become a one-person game
studio in a single weekend."

### Architecture: Enforced Layered Boundaries

```
app       → composition root (wires everything)
features  → orchestrate domain + ports, emit events
runtime   → Phaser scenes, sprites, input, audio, adapters
domain    → pure state + behaviors. No engine. No wall-clock. No storage.
content   → Zod-validated definitions, levels, balance
shared    → leaf utilities, types, event bus, test fakes
```

### The Golden Rule: Domain is Pure by Construction
- No `phaser` imports from `src/domain/**` — enforced by lint + dep-cruiser
- No `Math.random`, no `Date.now`, no `window`, no `localStorage` in domain — inject via ports
- Content is schema-validated at import time — malformed JSON breaks the build

### Port Interfaces
```typescript
interface ITimePort { now: () => number; }
interface IRandomPort { nextFloat: () => number; nextInt: (min, max) => number; }
interface IAudioPort { play: (soundId: string) => void; }
interface ISaveGamePort { save: (key, payload) => Promise<void>; load: (key) => Promise<string|null>; }
```

Domain depends on interfaces. Runtime provides concrete implementations. This is
**dependency inversion** applied to game dev — and it's what makes deterministic
simulation trivial.

### Enforcement Mechanisms
1. `eslint-plugin-boundaries` — catches violations in editor/PR
2. `dependency-cruiser` — belt-and-braces in CI
3. `arch-invariants` CI job — grep-based guard banning `phaser`/`Math.random`/`Date.now`/`localStorage` in `src/domain`

### AI-First Workflow
GitHub Spec Kit: `/speckit:specify → clarify → plan → tasks → analyze → implement`.
Every non-trivial feature walks this pipeline. A "constitution" file anchors every step
to the architecture rules.

Code generators (`pnpm new:module|scene|feature|port|content|adr`) scaffold canonical
file layout in ~200 tokens instead of hand-writing 500-800.

Auto-generated `catalog.md` — an index of every module, feature, scene, and port.

### What We Can Learn (Without Adopting Their Stack)
- **Port interfaces for impure operations** — our `rand()`/`DMath.*` are already this conceptually, but making them explicit interfaces would clarify the boundary
- **Content as data, not code** — extract `SPRITE_RECIPES`, `UNIT_DEFS`, `SPELL_DEFS` to a separate `<script>` block or `data.js`
- **Auto-generated catalog** — our `docs/FILE_MAP.md` is hand-maintained; a script could generate it
- **Architecture enforcement via grep** — add a check to our e2e tests: grep for `Math.random()` inside sim functions, `Date.now()` inside `Battle.update()`
- **Spec-driven feature workflow** — for large features like the multiplayer refactor

### The Throughline
Their port pattern is the architectural foundation that makes host-authoritative relay
clean: if the sim domain only talks to ports, you can run it on the host and send state
to the guest without the guest needing to run the sim at all.

---

## 8. Multiplayer Architecture Comparison

### Our Current Architecture

**trystero** (WebRTC + BitTorrent trackers) with **deterministic lockstep**. Both peers
run the sim independently from the same seed + armies, syncing only commands (`cmd_lock`
messages scheduled `LOCKSTEP_DELAY=3` ticks in the future). Desync detection via
`stateHash()` at round end, with `_desyncFallback` dropping to snapshot sync on mismatch.

This is **Algorithmic Consensus + Input Replication** — the hardest combination. Every
bug we fixed in the recent bug hunt was a determinism violation.

### The Three Approaches

| Approach | Who uses it | Determinism required | Server needed | Cheat resistance |
|----------|-------------|---------------------|---------------|-----------------|
| Deterministic lockstep (us) | RTS, fighting (GGPO) | Yes, strict | No (relay only) | Medium |
| Host-authoritative relay | martini-kit, most "P2P" | No | Minimal (relay) | Medium |
| Server-authoritative | Pokemon Auto Chess, chibi-arena | No | Yes (full server) | High |

### The Peercraft Paper Finding
Browser P2P research identifies that **deterministic lockstep is unusable in browsers**
because different browser engines (V8 vs SpiderMonkey vs JavaScriptCore) produce different
floating-point results. They propose **Resynchronizing-at-Root**: tolerate desyncs and
fix with re-simulation from the last confirmed state. This is rollback netcode for P2P.

### The multitap Framework Insight
"Client/server vs P2P" is the wrong question. The real decisions are:
1. **Dissemination**: Input replication (send commands) vs State replication (send snapshots)
2. **Consensus**: Single authority (one entity owns truth) vs Algorithmic consensus (peers agree)
3. **Optimistic strategy**: None (wait) vs Eager (apply locally, fix later) vs Prediction (guess ahead)

We chose: Input replication + Algorithmic consensus + Eager application = hardest combo.

### Colyseus Specifically
Great architecture (room lifecycle, schema-based state sync with property-level diffs,
command pattern, reconnection) but requires Node.js + MongoDB + Redis + Firebase.
**We should steal its ideas, not the framework.**

### Recommendation: Host-Authoritative Relay
See [NETRELAY.md](NETRELAY.md) for the full implementation plan. Summary:

- Only the host runs the sim. Guest sends commands, receives state snapshots.
- No desync possible — only one entity runs the sim.
- ~50-100ms guest input latency (imperceptible for autobattler).
- No server needed — works with existing trystero transport.
- Would delete: `stateHash()`, `_desyncFallback`, `DMath.*`, `rand()`, lockstep scheduling.
- Current lockstep code preserved behind a flag for potential future use.

---

## 9. Concrete Takeaways for Prompt Showdown

### High Impact, Low Effort
| Idea | Source | Effort | Impact |
|------|--------|--------|--------|
| Active skills on cooldown (player agency) | Machine Guard | Low | Medium |
| Tiered synergies (2/4/6 pieces → escalating bonuses) | Pokemon Auto Chess + TFT | Medium | High |
| Architecture enforcement via grep in tests | Phaser Starter | Low | Medium |
| Auto-generated file catalog | Phaser Starter | Low | Medium |

### High Impact, Medium Effort
| Idea | Source | Effort | Impact |
|------|--------|--------|--------|
| Per-unit evolution paths (2 choices, changes mechanics) | Machine Guard | High | Very high |
| PP/mana system (abilities charge from combat) | Pokemon Auto Chess | Medium | High |
| Damage types (physical/special/true + resist) | Pokemon Auto Chess | Medium | High |
| Host-authoritative relay (eliminate desync) | multitap + martini-kit | Medium | Very high |
| Declarative data extraction (data.js) | chibi-arena + Phaser Starter | Low | Medium |
| Ability strategy pattern (registry of ability objects) | Pokemon Auto Chess | Low | Medium |

### High Impact, High Effort
| Idea | Source | Effort | Impact |
|------|--------|--------|--------|
| Boss escalation with unique mechanics per tier | Machine Guard | High | High |
| Enemy AI with its own economy + upgrade logic | Machine Guard | High | High |
| Heat/overheat system (second resource) | Machine Guard | Medium | Medium |
| Sim in Web Worker (free main thread) | OpenFront | High | High |
| Rollback netcode (snapshot + re-simulate) | Lagless | Very high | Very high |
| Fortress/base auto-turret + regen + shields | Machine Guard | Medium | Medium |

### The Throughline
All roads point to the same conclusion: **separate the pure simulation from the impure
runtime, and have only one entity run the sim.** The port pattern (from the Phaser
starter) shows how to make that separation clean. The host-authoritative relay (from
multitap + martini-kit) shows how to apply it to multiplayer. Colyseus shows the
production-grade version of the same pattern.
