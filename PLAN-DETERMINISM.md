# Determinism Plan — Live Lockstep Multiplayer

**Goal**: Both players run the same battle simulation independently in real-time, syncing only inputs (spell casts, speed changes). Determinism guarantees identical results. Replaces the current host-authoritative snapshot architecture with peer-equal lockstep.

**Approach**: Deterministic math library (`DMath`) + seeded PRNG + fixed timestep + command-based lockstep sync. Keeps float math — only replaces the ~6 non-deterministic `Math.*` functions.

---

## Why This Works

IEEE 754 guarantees that basic arithmetic (`+`, `-`, `*`, `/`) produces identical results across all browsers. The JS spec marks only transcendental functions (`sqrt`, `sin`, `cos`, `atan`, `hypot`) as "implementation-approximate" — these are the only sources of cross-browser divergence. By replacing just those with deterministic implementations, we get full determinism while keeping float positions/HP/speed.

---

## Current vs. Proposed Architecture

| | Current (snapshots) | Lockstep (deterministic) |
|---|---|---|
| **Who runs the sim** | Host only | Both players independently |
| **What's synced** | Full state at 20Hz (1-2 KB/s) | Commands only (~200 B/s) |
| **Guest spell cast** | Send to host → host executes → snapshot back (~100ms) | Queue command for future tick → both execute (~50ms) |
| **Host disconnect** | Match over | Other player finishes alone |
| **Guest feels like** | Watching a video | Playing the game |
| **Bandwidth** | 1-2 KB/s | ~200 B/s (10× less) |
| **Replays** | Metadata only (unit names, winners) | Seed + armies + commands (~200 bytes, full replay) |

---

## Match Flow (4 rounds, live)

```
Round 1:
  Draft  — both players pick units (turn-based, already synced via P2P)
  Battle — both players run sim from same seed, sync spell-cast commands
           Player A casts spell at tick 240 → command sent to Player B
           Player B's sim executes cast at tick 242 → identical result
  Result — both compute winner independently, verify hash matches

Round 2:
  Draft  — both pick new units (survivors carry over, already synced)
  Battle — same seed + round offset, sync spell-cast commands
  Result — verify hash

... repeat until someone loses 3 lives ...
```

Both players are online for the full match. The draft is turn-based (already works). The battle is real-time lockstep — both run the sim at the same speed and sync only inputs.

---

## Phase 1: DMath Library + Seeded PRNG (~2h)

### 1.1 Create `DMath` object (insert before line 692, near `const R=Math.random`)

```javascript
// ─── Deterministic Math ──────────────────────────────────────────────────────
// IEEE 754 basic arithmetic is already cross-browser deterministic.
// Only transcendental functions need deterministic replacements.
// Rounding to 6 decimals kills browser differences (they're in 15th+ decimal)
// while keeping sub-pixel precision (0.000001 game units << 1 pixel).
const DMath = {
  _sinTable: null,
  _init() {
    // 1024-entry sin lookup table (0.35° resolution — plenty for movement)
    this._sinTable = new Float64Array(1024);
    for (let i = 0; i < 1024; i++)
      this._sinTable[i] = Math.round(Math.sin(i / 1024 * 2 * Math.PI) * 1e6) / 1e6;
  },
  sqrt(x) { return Math.round(Math.sqrt(x) * 1e6) / 1e6; },
  sin(x) {
    if (!this._sinTable) this._init();
    // Normalize angle to [0, 2π), then lookup
    const idx = ((x / (2 * Math.PI)) * 1024) | 0;
    return this._sinTable[((idx % 1024) + 1024) % 1024];
  },
  cos(x) { return this.sin(x + Math.PI / 2); },
  atan(x) { return Math.round(Math.atan(x) * 1e6) / 1e6; },
  atan2(y, x) {
    if (x === 0) return y > 0 ? Math.PI / 2 : y < 0 ? -Math.PI / 2 : 0;
    return this.atan(y / x) + (x < 0 ? y >= 0 ? Math.PI : -Math.PI : 0);
  },
  hypot(x, y) { return this.sqrt(x * x + y * y); },
};

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
let _battleSeed = 0;
let _rngState = 0;
function seedBattle(s) { _battleSeed = s >>> 0; _rngState = s >>> 0; }
function rand() {
  _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(a, b) { return a + Math.floor(rand() * (b - a)); }
function randRange(a, b) { return a + rand() * (b - a); }
```

### 1.2 Seed generation and sharing

Seed at match start, shared via P2P handshake so both peers get the same seed:

```javascript
// In Match.start() — line 3881
start(lives, onMatchEnd) {
  // ... existing code ...
  // Generate seed: host creates it, guest receives via P2P handshake
  this.seed = (role === "host" || !connected)
    ? (Math.random() * 0xFFFFFFFF) >>> 0
    : this._receivedSeed;
  if (connected && role === "host") transmit("seed", { seed: this.seed });
  // ... existing code ...
}

// In Battle.start() — line 5787, reset PRNG for each round
start(units, enemies, onEnd, spells) {
  // ... existing code ...
  seedBattle(Match.seed + Match.round);  // Deterministic per round
  // ... existing code ...
}
```

### 1.3 FNV-1a state hash (for desync detection)

```javascript
// Insert near DMath
function fnv1aHash(obj) {
  const s = JSON.stringify(obj);  // Simple — can optimize later
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// In Battle — add stateHash() method
stateHash() {
  return fnv1aHash(this.units.map(u => ({
    i: u.id, x: Math.round(u.x * 1000), y: Math.round(u.y * 1000),
    h: Math.round(u.h), s: u.animState
  })));
}
```

---

## Phase 2: Replace Call Sites (~3h)

### 2.1 Replace `Math.sqrt` → `DMath.sqrt` (state-affecting only)

| Line | File section | Current | Replace with |
|------|-------------|---------|--------------|
| 3428 | `dist()` | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(dx*dx+dy*dy)` |
| 3431 | `moveToward()` | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(...)` |
| 3436 | `moveAway()` | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(...)` |
| 3500 | `avoidanceOffset()` | `Math.sqrt(d2)` | `DMath.sqrt(d2)` |
| 3514 | `avoidanceOffset()` fallback | `Math.sqrt(d2)` | `DMath.sqrt(d2)` |
| 3523 | `avoidanceOffset()` | `Math.sqrt(ax*ax+ay*ay)` | `DMath.sqrt(...)` |
| 6305 | `attack()` | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(...)` |
| 6377 | `attack()` hit react | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(...)` |
| 6676 | `updateProjectiles()` | `Math.sqrt(dx*dx+dy*dy)` | `DMath.sqrt(...)` |
| 6808 | `separate()` | `Math.sqrt(d2)` | `DMath.sqrt(d2)` |

**Do NOT replace** (visual-only): lines 5893, 6266, 7403

### 2.2 Replace `Math.sin`/`Math.cos` → `DMath.sin`/`DMath.cos` (state-affecting only)

| Line | File section | Current | Replace with |
|------|-------------|---------|--------------|
| 3503 | `avoidanceOffset()` | `Math.cos(ang)`, `Math.sin(ang)` | `DMath.cos(ang)`, `DMath.sin(ang)` |
| 3517 | `avoidanceOffset()` fallback | same | same |
| 3820 | `patrol` movement | `Math.sin(u.patrolT*2)` | `DMath.sin(u.patrolT*2)` |
| 3845 | `strafe` movement | `Math.sin(u.strafeT*3)` | `DMath.sin(u.strafeT*3)` |

**Do NOT replace** (visual-only): lines 4036, 4372-4406, 4508, 4514, 4708-4755, 4788, 5052, 5103, 5150, 6811, 6883-6895, 7067, 7142, 7289-7292, 7328, 7444, 7456, 7468, 7505, 7521, 9483

### 2.3 Replace `Math.hypot` → `DMath.hypot` (spell system, all state-affecting)

| Line | File section | Current | Replace with |
|------|-------------|---------|--------------|
| 5388 | `SPELL_TARGET.circle_aoe` | `Math.hypot(u.x-ax,u.y-ay)` | `DMath.hypot(...)` |
| 5400 | `SPELL_SHAPE.line` | `Math.hypot(dx,dy)` | `DMath.hypot(...)` |
| 5403 | `SPELL_SHAPE.line` | `Math.hypot(u.x-px,u.y-py)` | `DMath.hypot(...)` |
| 5412 | `SPELL_SHAPE.cone` | `Math.hypot(dirX,dirY)` | `DMath.hypot(...)` |
| 5417 | `SPELL_SHAPE.cone` | `Math.hypot(dx,dy)` | `DMath.hypot(...)` |
| 5466 | `SPELL_EFFECT.knockback` | `Math.hypot(dx,dy)` | `DMath.hypot(...)` |

### 2.4 Replace `R()`/`Q()` → `rand()`/`randRange()` (state-affecting only)

| Line | File section | Current | Replace with |
|------|-------------|---------|--------------|
| 3503 | `avoidanceOffset()` | `Math.random()*Math.PI*2` | `rand()*Math.PI*2` |
| 3517 | `avoidanceOffset()` fallback | same | same |
| 5364 | `SPELL_TARGET.random_enemy` | `F(R()*es.length)` | `randInt(0,es.length)` |
| 6333 | `takeDamage()` dodge | `R()<0.5` | `rand()<0.5` |
| 6342 | `takeDamage()` crit | `R()<(attacker.crit\|\|0)` | `rand()<(attacker.crit\|\|0)` |
| 3830 | `blink` movement | `Q(-20,20)` | `randRange(-20,20)` |
| 5452 | spell summon | `Q(-20,20)` | `randRange(-20,20)` |
| 5453 | spell summon | `Q(-20,20)` | `randRange(-20,20)` |
| 6450 | spawn ability | `Q(-20,20)` | `randRange(-20,20)` |
| 6451 | spawn ability | `Q(-20,20)` | `randRange(-20,20)` |
| 6494 | blink_strike | `Q(-15,15)` | `randRange(-15,15)` |
| 6495 | blink_strike | `Q(-15,15)` | `randRange(-15,15)` |

**Do NOT replace** R()/Q() in: draft, shop, forge, bot AI, UI, BattleFX (visual only).

**Important**: The `R()` and `Q()` aliases at lines 692-694 stay as-is for non-battle code. Only the battle sim call sites change to `rand()`/`randRange()`.

### 2.5 Summary of replacements

- `Math.sqrt`: 10 state-affecting calls → `DMath.sqrt`
- `Math.sin`/`Math.cos`: 6 state-affecting calls → `DMath.sin`/`DMath.cos`
- `Math.hypot`: 6 state-affecting calls → `DMath.hypot`
- `R()`/`Q()`: 12 state-affecting calls → `rand()`/`randRange()`
- **Total: 34 call sites**

---

## Phase 3: Fixed Timestep (~2h)

### 3.1 Modify `Battle.loop()` (lines 5954-5982)

Current (variable dt):
```javascript
loop(time){
  this.frame=requestAnimationFrame(this._loopBound);
  if(document.hidden){this.last=time;return;}
  let dt=(time-this.last)/1000;
  if(dt<this.targetFrameTime())return;
  this.last=time;
  dt=Math.min(dt,0.05);
  // ... speed multiplier ...
  dt*=effectiveSpeed;
  this.update(dt);
}
```

New (fixed timestep with accumulator):
```javascript
loop(time){
  this.frame=requestAnimationFrame(this._loopBound);
  if(document.hidden){this.last=time;return;}
  const frameTime=(time-this.last)/1000;
  if(frameTime<this.targetFrameTime())return;
  this.last=time;
  
  // Fixed timestep: simulate in 1/60s increments
  const FIXED_DT=1/60;
  this._accumulator+=Math.min(frameTime,0.1)*this._effectiveSpeed;
  let steps=0;
  while(this._accumulator>=FIXED_DT && steps<4){  // Max 4 steps to avoid spiral
    this.update(FIXED_DT);
    this._accumulator-=FIXED_DT;
    steps++;
  }
  // Render happens after sim steps (render uses interpolated positions)
  this.render();
}
```

### 3.2 Speed multiplier

Move speed multiplier to accumulator input (not dt):
```javascript
// In loop, before the while loop:
this._effectiveSpeed = effectiveSpeed;  // Store for accumulator
this._accumulator += Math.min(frameTime, 0.1) * this._effectiveSpeed;
```

### 3.3 Battle.start() initialization

```javascript
// In Battle.start() — add:
this._accumulator = 0;
this._effectiveSpeed = 1;
```

### 3.4 Render separation

Currently `update()` calls render at the end. With fixed timestep, render must happen AFTER the while loop, not inside update. Check if `update()` calls `this.render()` — if so, remove that call and add explicit `this.render()` after the while loop.

### 3.5 Tick counter

Add a monotonically increasing tick counter for command scheduling:
```javascript
// In Battle
this._tick = 0;  // In start()

// In update(), at the top:
update(dt) {
  this._tick++;
  // ... rest of update ...
}
```

Commands are scheduled by tick number — "execute this spell cast at tick 242".

---

## Phase 4: Lockstep Command Protocol (~5h)

### 4.1 Command definition

```javascript
const CMD = {
  SPELL_CAST: "spell_cast",   // {spellIdx, targetX, targetY, tick}
  SPEED: "speed",             // {speed, tick}  — 1x/2x/4x
  PAUSE: "pause",             // {tick}
  RESUME: "resume",           // {tick}
};
```

### 4.2 Command buffer

Each player maintains a command buffer keyed by tick:

```javascript
// In Battle
this._cmdBuffer = new Map();  // tick → array of commands

// Queue a command for a future tick
queueCommand(cmd, tick) {
  if (!this._cmdBuffer.has(tick)) this._cmdBuffer.set(tick, []);
  this._cmdBuffer.get(tick).push(cmd);
}

// Execute commands scheduled for the current tick
executeCommands(tick) {
  const cmds = this._cmdBuffer.get(tick);
  if (!cmds) return;
  for (const c of cmds) {
    if (c.type === CMD.SPELL_CAST) this._castPlayerSpell(c.spellIdx, c.targetX, c.targetY);
    // ... other command types ...
  }
  this._cmdBuffer.delete(tick);
}
```

### 4.3 Lockstep pacing

Both players must stay within a few ticks of each other. If one player's sim runs ahead, it must wait for the other player's commands to arrive.

```javascript
// In Battle.loop(), before the while loop:
const LOCKSTEP_DELAY = 3;  // Execute commands 3 ticks in the future (50ms at 60fps)
const MAX_TICK_AHEAD = 10; // Don't simulate more than 10 ticks ahead of confirmed peer

// Get the latest tick the peer has confirmed
const peerTick = this._peerConfirmedTick || 0;

// Don't sim ahead of peer by more than MAX_TICK_AHEAD
const maxTick = peerTick + MAX_TICK_AHEAD;
while(this._accumulator>=FIXED_DT && steps<4 && this._tick < maxTick){
  this.update(FIXED_DT);
  this._accumulator-=FIXED_DT;
  steps++;
}
```

### 4.4 Spell cast flow (the key interaction)

**Local player casts spell:**
```javascript
_castPlayerSpell(spellIdx, targetX, targetY) {
  const targetTick = this._tick + LOCKSTEP_DELAY;  // Execute 3 ticks from now
  const cmd = { type: CMD.SPELL_CAST, spellIdx, targetX, targetY, tick: targetTick };
  
  // Queue locally
  this.queueCommand(cmd, targetTick);
  
  // Send to peer
  if (connected) transmit("cmd", cmd);
  
  // Show local "casting" indicator (visual only, doesn't affect sim)
  this._showCastIndicator(spellIdx, targetX, targetY);
}
```

**Remote player receives command:**
```javascript
// In networkReceive handler:
if (data.t === "cmd") {
  Battle.queueCommand(data.d, data.d.tick);
  Battle._peerConfirmedTick = Math.max(Battle._peerConfirmedTick, data.d.tick);
}
```

**Both sims execute at the scheduled tick:**
```javascript
// In Battle.update(), at the top:
update(dt) {
  this._tick++;
  this.executeCommands(this._tick);  // Execute any commands scheduled for this tick
  // ... rest of update ...
}
```

### 4.5 Tick acknowledgment

Each player sends "I've reached tick N" so the other knows it's safe to advance:

```javascript
// In Battle.update(), at the end:
if (connected && this._tick % 10 === 0) {  // Every 10 ticks (~167ms)
  transmit("tick_ack", { tick: this._tick });
}

// In networkReceive:
if (data.t === "tick_ack") {
  Battle._peerConfirmedTick = Math.max(Battle._peerConfirmedTick, data.d.tick);
}
```

### 4.6 Desync detection and fallback

At the end of each round, both players compare state hashes:

```javascript
// In Match.onRoundEnd() — line 3910
onRoundEnd(winner) {
  // ... existing code ...
  if (connected) {
    const myHash = Battle.stateHash();
    this._pendingHash = { round: this.round, winner, hash: myHash };
    transmit("round_hash", this._pendingHash);
    // Wait for peer's hash — if mismatch, fall back to host authority next round
  }
}

// In networkReceive:
if (data.t === "round_hash") {
  const peerHash = data.d;
  const myHash = Battle.stateHash();
  if (peerHash.hash !== myHash) {
    console.error("DESYNC detected at round", peerHash.round,
                  "my:", myHash, "peer:", peerHash.hash);
    // Fall back to snapshot sync for next round
    Battle._desyncFallback = true;
  }
}
```

If desync is detected, the next round uses the old snapshot-based sync (host-authoritative). This is a safety net — if determinism has a bug, the match continues instead of breaking.

### 4.7 Replacing snapshot sync

The existing 20Hz snapshot system (`startSnapshots`, `applyRemoteSnapshot`, `_interpRender`) is replaced by the command protocol. However, keep the snapshot code as a fallback for desync recovery:

```javascript
// In G.startRoundDraft() or wherever battle starts:
if (connected && !Battle._desyncFallback) {
  // Lockstep mode: both run sim, sync commands only
  Battle.startLockstep(armyA, armyB);
} else if (connected && Battle._desyncFallback) {
  // Fallback: host runs sim, guest gets snapshots (old behavior)
  if (role === "host") Battle.start(armyA, armyB);
  else Battle.startGuestMode();  // render-only, apply snapshots
}
```

### 4.8 Phase 4 breakdown

| Step | What | Hours |
|------|------|-------|
| 4a | Command buffer + queue/execute | 1 |
| 4b | Spell cast flow (local queue + P2P send + remote receive) | 1.5 |
| 4c | Lockstep pacing (tick ack, max tick ahead) | 1 |
| 4d | Desync detection (hash comparison at round end, fallback) | 1 |
| 4e | Replace snapshot sync with command sync (keep as fallback) | 0.5 |
| **Total** | | **5h** |

---

## Phase 5: Determinism Tests (~2h)

### 5.1 Golden vector test (add to e2e_test.py)

```python
# TEST: Determinism — same seed produces same hash
page.evaluate("""
  Match.seed = 12345;
  G.startMatch(3);  # Start match with fixed seed
  # ... draft armies deterministically ...
  Battle.start(armyA, armyB);
  # Run 600 ticks (10 seconds at 60fps)
  for (let i = 0; i < 600; i++) Battle.update(1/60);
  const hash = Battle.stateHash();
  return hash;
""")
# Assert hash === "expected_hash_value"
# This pins the simulation — any change that alters results breaks the test
```

### 5.2 Cross-browser test

Run the same golden vector in Chrome and Safari, compare hashes. Add to CI if GitHub Actions is set up.

### 5.3 Property-based test

```python
# Run 100 random seeds, verify same seed → same hash across 2 runs
for seed in range(100):
    hash1 = run_battle_with_seed(seed)
    hash2 = run_battle_with_seed(seed)
    assert hash1 == hash2  # Same seed → same result
```

### 5.4 Desync detection test

```python
# Verify that different seeds produce different hashes (sanity check)
hash1 = run_battle_with_seed(12345)
hash2 = run_battle_with_seed(54321)
assert hash1 != hash2
```

### 5.5 Lockstep command test

```python
# Two browser contexts, same seed, exchange commands, verify same hash
ctx1 = browser.new_context()
ctx2 = browser.new_context()
# ... setup both with same seed ...
# Player 1 casts spell at tick 50
# Both run sim to tick 600
# Assert stateHash() is identical in both contexts
```

---

## Migration Strategy

### Backward compatibility
- Existing saves/replays are not affected (they store metadata, not seeds)
- Existing P2P matches fall back to snapshot sync if peer doesn't support determinism (version check in role handshake)
- The `DMath` library is additive — existing `Math.*` calls in non-battle code stay as-is

### Rollout order
1. **Phase 1-2**: DMath + PRNG (no behavior change, just deterministic math) → run E2E tests
2. **Phase 3**: Fixed timestep (slight feel change — battle runs at exactly 60 ticks/sec) → run perf profiler
3. **Phase 4**: Lockstep protocol (new P2P mode, snapshot sync kept as fallback) → run P2P tests
4. **Phase 5**: Tests (pins the behavior, catches regressions)

### Risk mitigation
- After Phase 2, run E2E tests — all 184 must still pass
- After Phase 3, run perf profiler — 50v50 must still hit 60 FPS
- After Phase 4, run P2P tests — both lockstep and fallback modes must work
- Keep snapshot sync as fallback for desync recovery
- Version check in role handshake: if peer version < new version, use old snapshot sync

---

## Input Delay Analysis

Lockstep requires commands to execute at a future tick, not immediately. The delay is:

```
delay = max(ping, LOCKSTEP_DELAY * FIXED_DT)
      = max(ping, 3 * 16.67ms)
      = max(ping, 50ms)
```

| Connection | Ping | Spell cast delay | Feel |
|-----------|------|-----------------|------|
| LAN | 5ms | 50ms (LOCKSTEP_DELAY) | Instant |
| Good WiFi | 30ms | 50ms (LOCKSTEP_DELAY) | Instant |
| Typical | 80ms | 80ms (ping-bound) | Slight lag |
| Bad | 200ms | 200ms (ping-bound) | Noticeable — show "casting..." indicator |

For comparison, the current snapshot-based system has ~100ms guest spell cast delay (round trip to host + back). Lockstep is faster for the guest in all cases.

The local player (host in current system, either player in lockstep) currently has 0ms delay. In lockstep, both players have the same delay. This is more fair but slightly worse for the host. The tradeoff: both players are equal peers, no one is a spectator.

---

## Files Changed

| File | Changes |
|------|---------|
| `index.html` | DMath lib (~30 lines), PRNG (~15 lines), 34 call site replacements, fixed timestep (~25 lines), command protocol (~80 lines), state hash (~10 lines), lockstep pacing (~20 lines) |
| `e2e_test.py` | Add determinism + lockstep tests (~60 lines) |
| `AGENTS.md` | Add determinism rule to critical invariants |
| `.devin/skills/battle-rules/SKILL.md` | Add determinism section |
| `.devin/skills/system-rules/SKILL.md` | Add lockstep protocol section |
| `.devin/skills/render-rules/SKILL.md` | Note that DMath is for state, Math.* OK for visual |

**Total: ~250 lines of new code, 34 line-level edits**

---

## What This Enables

1. **Live lockstep multiplayer**: Both players run sim independently, sync only spell-cast commands. Equal peers, no spectator.
2. **10× less bandwidth**: Commands (~200 B/s) vs snapshots (1-2 KB/s)
3. **Host disconnect resilience**: Other player finishes the sim alone
4. **True replays**: Store seed + armies + commands (~200 bytes) — full battle reconstruction
5. **Bug repro**: "Seed 12345, round 2, tick 240" reproduces any bug deterministically
6. **Spectator mode**: Third party can run sim from seed + armies + commands and watch live

## What This Does NOT Enable

- **Rollback netcode**: Would need state snapshots for rewind + re-simulate. This plan is lockstep-only (no rollback). If a command arrives late, it executes at a later tick (visual hiccup, not a rollback).
- **Cross-device float determinism for non-DMath operations**: If someone adds new `Math.sqrt` calls without using `DMath`, those will diverge. The determinism tests catch this.

---

## Total Time Estimate

| Phase | Hours | Cumulative |
|-------|-------|------------|
| 1. DMath lib + PRNG | 2 | 2 |
| 2. Replace call sites | 3 | 5 |
| 3. Fixed timestep | 2 | 7 |
| 4. Lockstep protocol | 5 | 12 |
| 5. Tests | 2 | 14 |
| **Total** | **14** | |
