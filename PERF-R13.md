# PERF-R13.md — Performance Optimization & Bug Hunt Log

## Target
60 FPS + 60 TPS in all scenarios:
- Empty screen (background only)
- Full scene (100 units, mixed ranged+melee, projectiles, particles)
- Single-player (SP) and Multiplayer (MP lockstep + MP guest)

## Results (After R13 Optimizations)

```
Scenario                FPS    TPS  CPU avg  GPU/frame  Slow   JSHeap   Nodes
-------------------- ------ ------ -------- ---------- ----- -------- -------
Empty                 60.0O  60.1O    0.15m      1.12m     0     8.3MB    1656
5v5 (10)              60.0O  60.1O    0.74m      2.98m     0     9.5MB   14897
20v20 (40)            60.0O  60.1O    1.17m      3.87m     0     9.3MB   49526
50v50 (100)           60.0O  60.1O    2.02m      5.21m     0    14.9MB   59253
MP Lockstep           60.0O  60.1O    2.10m      5.66m     0    12.8MB   47937
MP Guest              75.4O   0.0O    0.33m      3.84m     0    19.1MB    1376
```

All scenarios: 60 FPS, 60 TPS, 0 slow frames (>20ms).
MP Guest runs at 75 FPS (rAF without sim) — TPS=0 because guest doesn't simulate.

## CPU Improvement (Before → After R13)

| Scenario    | Before CPU | After CPU | Improvement |
|-------------|-----------|-----------|-------------|
| Empty       | 0.13ms    | 0.15ms    | +0.02ms (noise) |
| 5v5         | 0.84ms    | 0.74ms    | -12% |
| 20v20       | 1.29ms    | 1.17ms    | -9% |
| 50v50       | 2.26ms    | 2.02ms    | -11% |
| MP Lockstep | 2.19ms    | 2.10ms    | -4% |
| MP Guest    | 0.35ms    | 0.33ms    | -6% |

## Bugs Found & Fixed (10 bugs)

### BUG 1: Double render in applyRemoteSnapshot (visual snap)
- **Location:** `applyRemoteSnapshot()` line ~12038
- **Issue:** Called `Battle.renderOnly()` on every snapshot, which renders the
  NEW positions without interpolation. Then the interp loop renders interpolated
  positions on the next rAF. This caused a 1-frame "snap" to new positions
  before interpolation kicked in.
- **Fix:** Only call `renderOnly()` on the first snapshot (when `!Battle._interpFrom`).
  On subsequent snapshots, the interp loop handles rendering.

### BUG 2: applySnapshot allocates N objects per snapshot (20Hz)
- **Location:** `applySnapshot()` line ~8754
- **Issue:** `this.units=s.units.filter(...).map(u=>({...u,...}))` — created N new
  objects every snapshot. With 100 units at 20Hz, that's 2000 objects/sec.
- **Fix:** Reuse existing unit objects by matching ID. Update in place for existing
  units, create new objects only for new IDs. Uses `_snapUnitMap`, `_snapExistingMap`,
  and `_snapReuseArr` pools.

### BUG 3: applyRemoteSnapshot interpFrom allocations (20Hz)
- **Location:** `applyRemoteSnapshot()` line ~12030
- **Issue:** `Battle._interpFrom={units:Battle.units.map(u=>({id:u.id,...}))}` —
  N allocations per snapshot for interpolation state.
- **Fix:** Reuse `_interpFromPool` array with pooled objects. Grow pool as needed,
  never shrink (avoids GC pressure).

### BUG 4: applyRemoteSnapshot spread + filter allocation
- **Location:** `applyRemoteSnapshot()` line ~12027
- **Issue:** `snap={...snap,units:snap.units.filter(...)}` — spread + filter
  allocation per snapshot.
- **Fix:** Filter in-place only when invalid units are detected (rare). Avoids
  allocation in the common case (all units valid).

### BUG 5: applyRemoteSnapshot HUD filter() calls (20Hz)
- **Location:** `applyRemoteSnapshot()` lines ~12042-12043
- **Issue:** Two `filter()` calls per snapshot for HUD update (myAlive, hostAlive).
- **Fix:** Replaced with count loops (single pass over units).

### BUG 6: applySnapshot crit lookup O(n) find
- **Location:** `applySnapshot()` line ~8793
- **Issue:** `this.units.find(x=>x.id===rc.id)` — O(n) find inside a loop over
  recentCrits. With 100 units and 5 crits, that's 500 comparisons per snapshot.
- **Fix:** Use `_curSnapIds` Set for O(1) existence check before the find.
  Still does find() for the actual unit, but only when the ID is known to exist.

### BUG 7: compressedSnapshot host allocations (20Hz)
- **Location:** `compressedSnapshot()` lines ~8731-8735
- **Issue:** `this.units.map(u=>({...}))` — N allocations per snapshot on the
  HOST side. With 100 units at 20Hz, that's 2000 objects/sec on the host.
- **Fix:** Reuse `_snapPool` and `_snapProjPool` arrays. Grow as needed, never
  shrink. Objects are mutated in place. Safe because `transmit()` serializes
  synchronously via JSON.stringify, so the pool is only used briefly.

### BUG 8: Guest HUD not throttled (20Hz vs SP 10Hz)
- **Location:** `applyRemoteSnapshot()` lines ~12042-12046
- **Issue:** Guest HUD updated every snapshot (20Hz). SP path throttles to 10fps.
  Inconsistent — guest does 2x the DOM updates.
- **Fix:** Throttle guest HUD to 10fps using `_guestHudT` accumulator.

### BUG 9: Heartbeat pong dropped by rate limiter
- **Location:** `networkReceive()` line ~3506
- **Issue:** Rate limiter at the start of `networkReceive` drops ALL messages
  when rate exceeds 60/sec. During snapshot bursts (20Hz + commands), pongs
  could be dropped, causing false disconnect detection.
- **Fix:** Move ping/pong handling BEFORE the rate limiter. Heartbeat messages
  are critical for connection monitoring and must not be dropped.

### BUG 10: interpFrom pool stale fromMap
- **Location:** `_interpRender()` line ~8897, `applyRemoteSnapshot()` line ~12119
- **Issue:** When using pooled `_interpFromPool` array, the array reference stays
  the same across snapshots. `_interpRender` caches `_interpFromUnits` and only
  rebuilds the fromMap when the reference changes. With pooling, the reference
  never changes, so the fromMap has stale positions from the previous snapshot.
- **Fix:** Set `Battle._interpFromUnits=null` after updating `_interpFrom` in
  `applyRemoteSnapshot`, forcing the fromMap to be rebuilt on the next render.

## Code Unification (SP/MP Shared Paths)

### UNIFY 1: Position clamping loop
- **Before:** Two separate loops in `update()` — one for players, one for enemies.
  Same logic, just different arrays.
- **After:** Single loop over `this.units` with `if(u.h<=0)continue` guard.
  Works for both SP and MP (lockstep uses same `update()` path).

### Shared Code Paths (Already Unified)
These paths are already shared between SP and MP — no duplication found:
- `Battle.update()` — same function for SP, MP lockstep, and MP snapshot fallback
- `Battle.render()` — same render function for SP and MP lockstep
- `Battle._interpRender()` — MP guest only, but reuses `Battle.render()`
- `Battle.act()` — same AI logic for all modes
- `Battle.separate()` — same collision separation for all modes
- `Battle.updateProjectiles()` — same projectile update for all modes
- `SpriteRenderer.draw()` — same sprite rendering for all modes
- `BattleFX.update()` — same FX update for all modes

The only SP/MP divergence is:
1. `Battle.loop()` — lockstep pacing (`_peerConfirmedTick` check) is a no-op in SP
2. `Battle._interpRender()` — guest-only interpolation path
3. `G.startSnapshots()` / `G.applyRemoteSnapshot()` — host/guest snapshot protocol

These are necessary divergences — the core sim and render paths are unified.

## Verification

- **E2E tests:** 211 PASS, 0 FAIL, 0 WARN
- **Perf:** All 6 scenarios at 60 FPS / 60 TPS, 0 slow frames
- **CPU time:** Improved 4-12% across all scenarios
- **Memory:** Stable (8-19MB JS heap, well within limits)
