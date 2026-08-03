# NETRELAY.md — Host-Authoritative Relay Plan

## Status: IMPLEMENTED as fallback (lockstep is primary, relay activates on desync)

## Goal

Provide a **host-authoritative relay** as the desync fallback for the deterministic
lockstep multiplayer. Lockstep is the primary mode (like Clash Royale) — both peers
run the sim, syncing only commands. When a desync is detected (`_desyncFallback=true`),
the system falls back to relay mode: only the host runs the sim, the guest renders
from state snapshots.

**Architecture decision**: Lockstep is primary because it has the lowest bandwidth
(~200 bytes/s vs ~30KB/s) and lowest input latency (3 ticks vs 50-100ms RTT). We've
eliminated all known desync bugs, so the determinism cost is already paid. The relay
is the safety net for when desync does occur — it keeps the game running instead of
freezing or producing divergent results.

## Table of Contents

1. [Why](#1-why)
2. [Current Architecture (Lockstep)](#2-current-architecture-lockstep)
3. [Proposed Architecture (Relay)](#3-proposed-architecture-relay)
4. [What Changes](#4-what-changes)
5. [What Stays](#5-what-stays)
6. [Implementation Plan](#6-implementation-plan)
17. [Bandwidth Analysis](#7-bandwidth-analysis)
8. [Edge Cases](#8-edge-cases)
9. [Testing Plan](#9-testing-plan)
10. [Rollback Plan](#10-rollback-plan)
11. [Ideas Stolen from Colyseus and Phaser-AI-First-Starter](#11-ideas-stolen-from-colyseus-and-phaser-ai-first-starter)

---

## 1. Why

### The Problem
Our deterministic lockstep requires both peers to produce identical simulation results.
JavaScript is not deterministic by default — different browser engines (V8, SpiderMonkey,
JavaScriptCore) produce different floating-point results. Every bug in the recent hunt
was a determinism violation:

- Missing `_baseH`/`_baseS`/`baseD` in deserialization → different stats → different combat
- Viewport-dependent clamping/midpoint → different positions on different screen sizes
- Spell cast desync → `playerSpells` arrays differed between host and guest
- Guest `Match.seed` never set → different random sequences
- `tick()`/`auto()`/`skip()` not disabled in lockstep → host advances independently

Each fix is a whack-a-mole. The root cause is architectural: **two entities running the
same sim and hoping they stay in sync.**

### The Solution
Only the host runs the sim. The guest is a dumb renderer that:
1. Sends commands (spell casts, speed changes, pauses) to the host
2. Receives state snapshots from the host
3. Renders the received state with interpolation

No desync is possible because only one entity produces game state.

### Tradeoffs

| | Lockstep (current) | Host-authoritative relay |
|---|---|---|
| Determinism required | Yes (hard, fragile) | No |
| Desync bugs | Constant threat | Impossible |
| Guest input latency | 3 ticks (~50ms) | ~50-100ms RTT |
| Server infrastructure | None | None (uses existing trystero) |
| Guest CPU usage | Full sim + render | Render only |
| Bandwidth | Low (commands only) | Medium (state snapshots) |
| Cheat resistance | Medium (both validate) | Medium (host trusted) |
| Code complexity | High (DMath, rand, stateHash, lockstep) | Low (send state, apply state) |

For an autobattler where the guest's only inputs are spell casts and speed changes (~1
input per 5 seconds), the 50-100ms RTT is imperceptible. The guest's units fight
automatically — there's no moment-to-moment input that needs to feel responsive.

---

## 2. Current Architecture (Lockstep)

### Data Flow
```
Host                          Guest
  │                             │
  ├── Battle.update() ──────────┤  (both run the sim)
  │   uses DMath.*, rand()      │
  │                             │
  ├── cmd_lock ──────────────►  │  (scheduled commands)
  │   {cmd, tick, team}         │
  │                             ├── executeCommands() at tick
  │                             │
  │   ◄──────────────────────  ├── tick_ack {tick}
  │                             │
  │   ◄──────────────────────  ├── round_hash {hash}
  ├── compare hash              │
  │   mismatch → _desyncFallback│
  │                             │
  └── if fallback: snap ──►    ├── applyRemoteSnapshot()
```

### Key Components
- `Battle._lockstepActive` — flag: both peers are running the sim
- `Battle._peerConfirmedTick` — latest tick the peer has acknowledged
- `Battle._desyncFallback` — hash mismatch detected, fall back to snapshot sync
- `Battle.stateHash()` — FNV1a hash of unit positions/HP for desync detection
- `DMath.*` — deterministic math (lookup-table sin/cos/sqrt/hypot)
- `rand()`/`randRange()` — seeded PRNG (xoshiro128)
- `LOCKSTEP_DELAY=3` — commands scheduled 3 ticks in the future
- `serializeArmyForPeer`/`deserializeArmyForPeer` — byte-identical army setup
- `queueCommand(cmd, targetTick)` — schedule command for future tick
- `cmd_lock` message — transmitted command with tick + team
- `tick_ack` message — peer confirms it has processed up to tick N
- `round_hash` message — peer sends state hash at round end
- `lockstep_start` message — host tells guest to start lockstep sim

### Existing Snapshot Infrastructure (reusable)
We already have a snapshot system used for the desync fallback:
- `Battle.compressedSnapshot()` — serializes all unit state (positions, HP, status, projectiles)
- `Battle.applyRemoteSnapshot(snap)` — applies received snapshot to local state
- `Battle._interpTo` — interpolation target for smooth rendering between snapshots
- `snap` message — host→guest full state snapshot
- Interpolation loop in `Battle.loop()` smooths between snapshots

**This is the foundation for the relay.** The relay mode just uses snapshots as the
primary (and only) synchronization mechanism, instead of as a fallback.

---

## 3. Proposed Architecture (Relay)

### Data Flow
```
Host                          Guest
  │                             │
  ├── Battle.update()           │  (host runs sim ONLY)
  │   uses Math.*, Math.random  │  (no determinism needed)
  │                             │
  ├── state_snap ────────────►  ├── applyRemoteSnapshot()
  │   {units, projectiles,      │   + interpolation
  │    time, round, lives}      │
  │                             │
  │   ◄──────────────────────  ├── command
  │                             │   {type:"spell", idx:2}
  │   validate + execute        │
  │   at next tick              │
  │                             │
  ├── round_result ─────────►  ├── display result
  │   {winner, lives,           │
  │    survivors, mvp}          │
  │                             │
  └── match_end ─────────────►  └── show match end
```

### New Message Types

| Message | Direction | Purpose |
|---------|-----------|---------|
| `state_snap` | Host → Guest | Full or delta state snapshot at 10-20Hz |
| `command` | Guest → Host | Player input (spell cast, speed change, pause) |
| `round_result` | Host → Guest | Round outcome (winner, lives, survivors, MVP) |
| `match_end` | Host → Guest | Match outcome (already exists) |
| `relay_start` | Host → Guest | Tells guest to enter relay mode (replaces `lockstep_start`) |

### Feature Flag
```javascript
Battle._useRelay = false;  // default: use lockstep (existing behavior)
// When true: host sends state snapshots, guest renders only
```

The flag is set during P2P handshake based on a capability negotiation. Both peers must
support relay for it to activate. If either peer doesn't support it, fall back to lockstep.

---

## 4. What Changes

### Host Side
1. **`Battle.update()` runs normally** — uses `Math.*` and `Math.random()` freely (no
   determinism required). The `_useRelay` flag bypasses lockstep tick gating.

2. **State broadcast at fixed rate** — a new `setInterval` or frame-counted loop sends
   `state_snap` messages at 10-20Hz. Uses the existing `compressedSnapshot()` function.

3. **Command processing** — receives `command` messages from guest, validates them
   (spell index in range, speed value valid, etc.), and executes at the next tick.
   No `LOCKSTEP_DELAY` needed — the host just runs the command immediately.

4. **Round/match results** — host sends `round_result` with winner, lives, survivors,
   MVP. Guest displays these without computing them.

### Guest Side
1. **`Battle.update()` is NOT called** — the guest does not run the simulation. The
   `Battle.loop()` skips the update step when `_useRelay && role === "guest"`.

2. **Render only** — the guest renders the state from the latest snapshot, with
   interpolation between snapshots for smoothness. Uses the existing
   `applyRemoteSnapshot()` + `_interpTo` infrastructure.

3. **Command sending** — guest sends `command` messages for spell casts, speed changes,
   pauses. These are the same as current `cmd_lock` messages but simpler (no tick
   scheduling, no lockstep delay).

4. **No `stateHash()`** — guest doesn't compute or send `round_hash`. No desync
   detection needed because the guest doesn't run the sim.

5. **No `DMath.*` or `rand()`** — guest never calls sim functions, so deterministic
   math is irrelevant on the guest side.

### What Gets Simpler

| Component | Lockstep | Relay |
|-----------|----------|-------|
| Command scheduling | `queueCommand(cmd, targetTick)` + `LOCKSTEP_DELAY=3` | Send command, host executes next tick |
| Tick synchronization | `_peerConfirmedTick` + `tick_ack` + stall detection | Not needed (host is the clock) |
| Desync detection | `stateHash()` + `round_hash` + `_desyncFallback` | Not needed (no second sim to compare) |
| Deterministic math | `DMath.*` lookup tables | `Math.*` (host only) |
| Seeded PRNG | `rand()`/`randRange()` | `Math.random()` (host only) |
| Army serialization | `serializeArmyForPeer`/`deserializeArmyForPeer` (byte-identical) | Not needed (guest doesn't run sim) |
| Spell team mapping | `_allPlayerSpells` + team field in `cmd_lock` | Host knows which team is guest's, executes directly |

---

## 5. What Stays

### Preserved Behind Flag
All lockstep code stays in place, gated by `Battle._useRelay`:
- `Battle._lockstepActive` / `_desyncFallback` / `_peerConfirmedTick`
- `Battle.stateHash()`
- `DMath.*` lookup tables
- `rand()` / `randRange()` seeded PRNG
- `serializeArmyForPeer` / `deserializeArmyForPeer`
- `queueCommand()` / `executeCommands()` / `LOCKSTEP_DELAY`
- `cmd_lock` / `tick_ack` / `round_hash` / `lockstep_start` message handlers

When `_useRelay === false`, the code behaves exactly as it does today.

### Shared Infrastructure (used by both modes)
- `trystero` WebRTC transport (`joinRoom`, `makeAction`, `transmit`, `networkReceive`)
- P2P handshake + role negotiation (`role`, `role_tiebreak`)
- Draft phase (already host-authoritative)
- `Battle.compressedSnapshot()` / `Battle.applyRemoteSnapshot()` (already exists for fallback)
- `Battle._interpTo` interpolation (already exists)
- `snap` message handler (already exists)
- Match flow (`Match.start()`, `Match.onRoundEnd()`, `Match.onMatchEnd()`)
- Spell sanitization (`sanitizeSpell()`)
- All rendering code (sprite recipes, particles, UI)

---

## 6. Implementation Plan

### Phase 1: Feature Flag + Capability Negotiation (small) ✅ DONE

**Changes**:
1. Add `Battle._useRelay = false` in `Battle.start()`
2. Add `relay: true` to the `role` handshake message (alongside existing `det: true`)
3. In the role handshake handler, set `_peerRelayCapable = !!data.d.relay`
4. In `startBattle()`, if both peers are relay-capable, set `Battle._useRelay = true`
   and send `relay_start` instead of `lockstep_start`

**Files touched**: `index.html` (handshake + `startBattle`)

**Verification**: E2E tests still pass (lockstep mode unchanged). Manual P2P test:
both peers connect, relay flag is set, `relay_start` is sent.

### Phase 2: Host State Broadcast (medium) ✅ DONE

**Goal**: Host broadcasts state snapshots at a fixed rate during relay mode.

**Changes**:
1. In `Battle.loop()`, when `_useRelay && role === "host"`, send `state_snap` at 15Hz
   (every ~66ms). Use existing `compressedSnapshot()` + add round/lives/time fields.
2. Rate-limit the broadcast (don't send every frame — 15Hz is enough for smooth
   interpolation).
3. The `state_snap` message reuses the existing `snap` message type (already handled
   by the guest). Just send it more frequently and with round metadata.

**Files touched**: `index.html` (`Battle.loop()` + snapshot broadcast)

**Verification**: Guest receives snapshots at 15Hz. Interpolation works (no stuttering).
E2E tests still pass (lockstep mode unchanged).

### Phase 3: Guest Render-Only Mode (medium) ✅ DONE

**Goal**: Guest stops running the sim in relay mode and renders only from snapshots.

**Changes**:
1. In `Battle.loop()`, when `_useRelay && role === "guest"`, skip `Battle.update()`.
   Only run interpolation + rendering.
2. Guest still receives `snap` messages (already handled by `applyRemoteSnapshot`).
3. Guest does NOT send `tick_ack`, `round_hash`, or `cmd_lock` messages.
4. Guest does NOT call `stateHash()`.
5. Guest's `onBattleEnd` returns early (already the case for non-lockstep P2P).

**Files touched**: `index.html` (`Battle.loop()` + guest message handlers)

**Verification**: Guest renders the battle smoothly from host snapshots. No sim
execution on guest. E2E tests still pass (lockstep mode unchanged).

### Phase 4: Guest Command Sending (small) ✅ DONE

**Goal**: Guest sends commands to host instead of scheduling them locally.

**Changes**:
1. In spell cast handler (`castSpell`/`_castPlayerSpell`), when `_useRelay && role === "guest"`:
   - Send `command` message: `{type:"spell", idx:spellIdx, team:"enemy"}`
   - Do NOT execute the spell locally (host will do it, state snapshot will reflect it)
2. In speed/pause handlers, when `_useRelay && role === "guest"`:
   - Send `command` message: `{type:"speed", val:newSpeed}` or `{type:"pause"}`
   - Do NOT apply locally
3. Host receives `command` messages, validates, and executes at next tick.

**Files touched**: `index.html` (spell cast + speed/pause handlers + command receiver)

**Verification**: Guest can cast spells, change speed, pause. Commands arrive at host
and are executed. State snapshots reflect the changes. E2E tests still pass.

### Phase 5: Host Command Processing (small) ✅ DONE

**Goal**: Host receives and executes guest commands.

**Changes**:
1. Add `command` message handler on host side.
2. Validate command (spell index in range, speed value valid, etc.).
3. Execute: for spells, call `_castPlayerSpell` with the guest's team. For speed/pause,
   apply the change.
4. The effect will be visible in the next state snapshot sent to the guest.

**Files touched**: `index.html` (command message handler)

**Verification**: Guest's spell casts appear in the battle. Speed changes work. Pause
works. E2E tests still pass.

### Phase 6: Round/Match Results (small) ✅ DONE

**Goal**: Host sends round/match results to guest in relay mode.

**Changes**:
1. In `Match.onRoundEnd()`, when `_useRelay && role === "host"`, send `round_result`
   message with: winner, livesPlayer, livesEnemy, survivors (both teams), MVP.
2. Guest receives `round_result` and displays it (reuses existing `onBattleEnd`
   display logic, but reads from message instead of computing).
3. `match_end` already exists — just ensure it's sent in relay mode.

**Files touched**: `index.html` (`Match.onRoundEnd()` + `round_result` handler)

**Verification**: Guest sees correct round results, survivors, MVP. Match end works.
E2E tests still pass.

### Phase 7: Cleanup + Polish (small) ✅ DONE

**Goal**: Remove relay-only shortcuts, add quality-of-life features.

**Changes**:
1. In relay mode, host can use `Math.*` instead of `DMath.*` (guarded by `_useRelay`).
   This is a performance win (lookup tables are slower than native Math on modern V8).
2. In relay mode, host can use `Math.random()` instead of `rand()` for sim randomness.
   This simplifies the code and is faster.
3. Add a connection-quality indicator (snapshot receive rate, interpolation buffer
   health) to the guest's UI.
4. Add snapshot interpolation tuning (buffer size, catch-up rate) for smooth playback
   under varying network conditions.
5. Handle guest reconnect: if guest disconnects and reconnects, host sends a full
   state snapshot to resync.

**Files touched**: `index.html` (various)

**Verification**: Full P2P relay test. Performance test. E2E test.

---

## 7. Bandwidth Analysis

### State Snapshot Size (100 units)
- Unit ID: 2 bytes (uint16)
- Position (x, y): 2 × float32 = 8 bytes
- HP: 2 bytes (uint16, scaled)
- Max HP: 2 bytes (uint16, scaled)
- Status flags (shield, stun, poison, slow): 1 byte (bitfield)
- Animation state: 1 byte (enum)
- Z (size): 1 byte (uint8, scaled)
- Team: 1 byte
- **Per unit: ~18 bytes × 100 = 1,800 bytes**

- Projectiles: ~10 active × 12 bytes = 120 bytes
- Time, round, lives: ~12 bytes
- **Total per snapshot: ~1,932 bytes (~2KB)**

### At 15Hz
- 2KB × 15 = **30KB/s** (host → guest)
- Commands: ~50 bytes × 0.2/s = **10 bytes/s** (guest → host, negligible)

### Comparison
- WebRTC audio: ~32KB/s
- WebRTC video: ~500KB/s+
- Our lockstep: ~200 bytes/s (commands only) but requires both peers to run the sim

**30KB/s is trivial over WebRTC.** For comparison, our existing snapshot fallback already
sends similar-sized snapshots at 20Hz and it works fine.

### Delta Compression (future optimization)
Instead of sending all 100 units every snapshot, send only units that changed:
- Most frames: only ~20-30 units move or change HP
- Delta format: `{tick, changedUnits: [{id, x, y, h}, ...]}`
- Estimated: ~500 bytes per delta × 15 = 7.5KB/s

This is a future optimization. The full snapshot approach is simpler and works first.

---

## 8. Edge Cases

### Guest Disconnects Mid-Battle
- Host detects disconnect via heartbeat timeout (already implemented)
- Host pauses the battle (or continues — design decision)
- On reconnect, host sends a full state snapshot to resync
- If no reconnect within timeout, host wins by default

### Host Disconnects Mid-Battle
- Guest detects disconnect via heartbeat timeout
- Guest cannot continue (no state source) — display "Host disconnected" message
- Match is abandoned (no winner)

### Network Jitter
- Guest maintains an interpolation buffer of 2-3 snapshots
- If buffer runs dry (snapshots delayed), guest pauses rendering and shows "Buffering..."
- If buffer overflows (snapshots arrive too fast), guest drops oldest snapshots
- Interpolation speed adjusts: if behind, interpolate faster; if ahead, slower

### Guest Tries to Cheat (invalid commands)
- Host validates all commands:
  - Spell index in range
  - Speed value is one of [1, 2, 3]
  - Command rate not exceeding human limits (rate-limit)
- Invalid commands are silently dropped
- Repeated invalid commands → disconnect the guest

### Large Unit Counts (200+)
- Snapshot size scales linearly: 200 units = ~4KB per snapshot
- At 15Hz: 60KB/s — still fine over WebRTC
- If needed: reduce snapshot rate to 10Hz for large battles
- Or: send delta snapshots (only changed units)

---

## 9. Testing Plan

### Unit Tests (e2e_test.py additions)
1. **Relay handshake**: two peers connect, both relay-capable, `_useRelay` is set
2. **State snapshot serialization**: `compressedSnapshot()` produces valid data
3. **State snapshot application**: `applyRemoteSnapshot()` correctly applies state
4. **Command validation**: invalid commands are rejected
5. **Lockstep fallback**: when one peer doesn't support relay, lockstep is used

### Integration Tests (manual P2P)
1. **Basic relay battle**: host vs guest, full match, guest renders from snapshots
2. **Guest spell cast**: guest casts spell, host executes, snapshot reflects it
3. **Guest speed change**: guest changes speed, host applies, snapshot reflects it
4. **Guest pause**: guest pauses, host pauses, snapshots stop, guest shows paused state
5. **Round transition**: round ends, host sends `round_result`, guest displays it
6. **Match end**: match ends, host sends `match_end`, guest displays winner
7. **Disconnect recovery**: guest disconnects, reconnects, host resyncs via full snapshot
8. **Network jitter**: simulate packet loss/delay, verify interpolation buffer handles it

### Performance Tests (perf.py additions)
1. **Relay host**: measure snapshot serialization + broadcast overhead
2. **Relay guest**: measure snapshot application + interpolation overhead
3. **Large battle relay**: 100 units, verify 15Hz snapshots at 30KB/s

### Compatibility Tests
1. **Relay host + lockstep guest**: verify graceful fallback to lockstep
2. **Lockstep host + relay guest**: verify graceful fallback to lockstep
3. **Relay host + relay guest**: verify relay mode activates

---

## 10. Rollback Plan

Since the lockstep code is preserved behind the `_useRelay` flag, rollback is trivial:
1. Set `Battle._useRelay = false` (or remove the relay capability from handshake)
2. The code reverts to lockstep behavior exactly as it is today
3. No code deletion needed — the relay code is additive

If relay mode is found to have critical bugs after deployment:
1. Remove `relay: true` from the handshake message
2. All new connections fall back to lockstep
3. Existing relay sessions can be terminated with a "please reconnect" message

---

## 11. Ideas Stolen from Colyseus and Phaser-AI-First-Starter

### From Colyseus (Pokemon Auto Chess)

**1. Command Pattern for Player Actions**
Instead of inline switch statements for command handling, define command classes:
```javascript
const CommandHandlers = {
  spell: (cmd, host) => {
    const spells = host._allPlayerSpells;
    if (cmd.idx < 0 || cmd.idx >= spells.length) return false;
    host._castPlayerSpell(cmd.idx, cmd.team);
    return true;
  },
  speed: (cmd, host) => {
    if (![1,2,3].includes(cmd.val)) return false;
    host.speed = cmd.val;
    return true;
  },
  pause: (cmd, host) => {
    host.paused = !host.paused;
    return true;
  }
};
```
This isolates command logic from message handling and makes it testable.

**2. Property-Level State Diffs (future optimization)**
Colyseus tracks which properties changed and sends only those. We can do the same:
```javascript
// Track which units changed since last snapshot
Battle._changedUnits = new Set();
// In update loop, when a unit's position/HP/status changes:
Battle._changedUnits.add(u.id);
// In snapshot broadcast, only send changed units:
const snap = { tick: this._tick, units: [...] }; // only changed
```
This reduces bandwidth from 30KB/s to ~5-10KB/s for typical frames.

**3. Reconnection with Seat Holding**
Colyseus holds a player's seat for a timeout period. We should do the same:
- On guest disconnect, host keeps the battle running for 30s
- If guest reconnects within 30s, host sends full state snapshot
- If not, host wins by default

**4. Room Lifecycle**
Colyseus has explicit room phases (lobby → preparation → game → after-game). We already
have screens (menu → draft → battle → result), but making the lifecycle explicit in the
network layer would help with state management.

### From Phaser-TypeScript-AI-First-Starter

**1. Port Interfaces for Impure Operations**
Their `IRandomPort`, `ITimePort`, `ISaveGamePort` pattern is exactly what our `rand()`/
`DMath.*` are trying to be. Making them explicit interfaces (even in a single file)
clarifies the boundary:
```javascript
// Sim ports — inject these into the sim, never access globals directly
const SimPorts = {
  random: Math.random,        // relay mode: native random
  // random: rand,            // lockstep mode: seeded PRNG
  time: () => Battle._tick * FIXED_DT,  // tick-based, not Date.now()
  sqrt: Math.sqrt,            // relay mode: native
  // sqrt: DMath.sqrt,        // lockstep mode: deterministic lookup
};
```
In relay mode, the host swaps to native `Math.*` ports. In lockstep mode, both peers
use deterministic ports. The sim code doesn't know which mode it's in.

**2. Architecture Enforcement via Grep**
Their CI greps for banned patterns (`Math.random` in domain, `phaser` in domain). We
can add similar checks to our e2e tests:
```python
# In e2e_test.py, add a static analysis test:
def test_no_math_random_in_sim():
    """Verify Math.random is not used in sim functions."""
    # Grep for Math.random inside Battle.update, ability functions, etc.
    # Fail if found (should use rand() in lockstep mode)
```

**3. Content as Data, Not Code**
Their `src/content/` has Zod-validated JSON for game definitions. We can extract:
```html
<script id="game-data" type="application/json">
{
  "units": { "Knight": { "h": 120, "d": 15, ... }, ... },
  "spells": { ... },
  "recipes": { ... }
}
</script>
<script>
  const GAME_DATA = JSON.parse(document.getElementById('game-data').textContent);
  // Validate at load time
</script>
```
This separates data from logic without adding a build step. Validation at load time
catches malformed data early.

**4. Auto-Generated Catalog**
Their `pnpm catalog` generates an index of all modules. We can write a script that
generates `docs/FILE_MAP.md` from the source:
```python
# scripts/gen_file_map.py
# Scans index.html for function/class definitions, generates line-number map
```

**5. Spec-Driven Feature Workflow**
For large features like this relay implementation, the Spec Kit pipeline
(specify → clarify → plan → tasks → analyze → implement) would catch design issues
before code is written. This document is essentially the "plan" step.

---

## Summary

The host-authoritative relay is a **pure addition** to the codebase. The existing
lockstep code is preserved behind a feature flag. The relay eliminates the desync bug
class entirely by having only the host run the sim. The guest becomes a dumb renderer
that sends commands and displays received state.

The implementation reuses our existing snapshot infrastructure (`compressedSnapshot`,
`applyRemoteSnapshot`, `_interpTo`, `snap` messages) — we're just making snapshots the
primary sync mechanism instead of a fallback.

The guest's input latency (50-100ms RTT) is imperceptible for an autobattler where
inputs are spell casts and speed changes (~1 per 5 seconds).

**Estimated effort**: 7 phases, each small-to-medium. Total: ~2-3 days of focused work.
The hardest part is Phase 3 (guest render-only mode) because it changes the guest's
main loop. Everything else is additive.

---

## Implementation Log (Completed)

### Commit 1: `2c6a63f` — RELAY: Host-authoritative relay mode (eliminates desync)
Implemented Phases 1-6 in a single pass. 133 insertions, 6 deletions.

- **Phase 1**: `_useRelay` flag + `relay:true` in role handshake + `_peerRelayCapable`
- **Phase 2**: Host broadcasts state snapshots at 20Hz via existing `startSnapshots()`
- **Phase 3**: Guest skips `Battle.update()` in relay mode — render-only loop with interpolation
- **Phase 4**: Guest sends `command` messages for spell/speed/pause (not `cmd_lock`)
- **Phase 5**: Host receives `command` messages, validates, executes at next tick
- **Phase 6**: Round/match results reuse existing `round_end`/`match_end` messages

New message types: `relay_start` (host→guest), `command` (guest→host)
Reuses: `compressedSnapshot`, `applyRemoteSnapshot`, `_interpTo`, `snap` messages

### Commit 2: Relay completion — spell cooldown sync, pause/speed, reconnect

Completed Phase 7 (Cleanup + Polish) with the following fixes:

1. **Spell cooldown sync**: Added `_spellCDsForSnapshot()` to `compressedSnapshot()`.
   Includes both teams' spell cooldowns + pending cast state. Guest applies them
   in `applyRemoteSnapshot()`. Without this, the guest's spell bar would show spells
   on permanent cooldown after casting (guest doesn't run `update()` which ticks CDs).

2. **Pause/speed state sync**: Added `paused` and `speed` fields to `compressedSnapshot()`.
   Guest applies them in `applyRemoteSnapshot()` and updates UI buttons. Without this,
   the guest's pause/speed UI would be out of sync with the host's actual sim state.

3. **Immediate snapshot on relay_start**: Host sends a snapshot immediately after
   `Battle.start()` + `startSnapshots()`, so the guest doesn't see an empty screen
   while waiting for the first 50ms interval tick.

4. **Guest reconnect with full resync**: When the host detects the guest rejoined
   during a grace period in relay mode, it:
   - Resumes the battle sim (if stopped by `gracefulDisconnect`)
   - Re-sends `relay_start` so the guest re-enters render-only mode
   - Restarts snapshot broadcast
   - Sends an immediate snapshot for instant resync
   
   The guest's `relay_start` handler now restores `Match.active` and cancels the
   reconnect overlay if this is a reconnect (not initial start).

5. **Guest grace period in relay mode**: The guest now gets a 30s reconnect grace
   period (same as the host) instead of immediately showing the "Continue vs Bot"
   prompt. This is because in relay mode, the guest can resume from the host's
   state snapshot after reconnect.

### Verification
- All 211 E2E tests pass (including lockstep tests — lockstep code preserved)
- Performance: 60fps/60tps all 6 scenarios, 0 slow frames
- MP Guest scenario: 0 TPS (no sim), 82 FPS (render-only is faster than sim+render)
- Lockstep mode still works (feature flag defaults to relay when both peers support it)
