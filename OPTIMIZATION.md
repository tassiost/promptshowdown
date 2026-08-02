# Optimization Plan — 60fps/60tps Target

**Goal**: Achieve 60fps rendering + 60tps simulation in all scenarios:
- Empty screen (background only)
- Full scene (100+ units, projectiles, particles, zones)
- Single-player (host/solo sim)
- Multiplayer lockstep (both peers run sim)
- Multiplayer snapshot fallback (guest interpolation)

## Research Findings (Web)

### Canvas 2D Performance (MDN, web.dev, Chrome blog)
1. **`alpha: false`** on `getContext("2d")` — canvas is opaque, speeds up transparent content drawing. Free win.
2. **`desynchronized: true`** — bypasses DOM compositor queue, reduces latency. Chrome supports it.
3. **`willReadFrequently: false`** (default) — keep GPU acceleration. We don't use `getImageData` in hot paths.
4. **Integer coordinates for `drawImage`** — avoids sub-pixel anti-aliasing. Already done (`|0`).
5. **Pre-render to offscreen canvas** — already done (sprite cache).
6. **Batch canvas state changes** — already done (HP bars, shadows, status rings).
7. **`createImageBitmap`** for GPU-resident sprites — Chrome's 2D canvas GPU accel uses this internally for `drawImage` from canvas sources.

### V8 JavaScript Performance (v8.dev, mrale.ph)
1. **Hidden classes** — objects with same property order share hidden classes → fast inline caches. `unit()` + `initRuntime()` must always add properties in the same order.
2. **Float64Array > Float32Array in JS** — V8 promotes f32 to f64 on read, causing conversion overhead. Use f64 or plain arrays.
3. **Avoid `for...of` in hot paths** — allocates iterator. Already using index loops.
4. **Monomorphic IC > polymorphic IC** — ensure each call site sees the same object shape. Conditional property addition (`u.x = u.x || default`) can cause divergence.

### Fixed Timestep + Lockstep (Gaffer on Games, Zack Sinisi)
1. **Accumulator pattern** — already implemented. Fixed `1/60` steps, max 4 per frame.
2. **Input delay** — `LOCKSTEP_DELAY=3` ticks (~50ms) gives time for command propagation.
3. **Pacing** — don't simulate past `_peerConfirmedTick + 10` to avoid running ahead.
4. **No-op sync packets** — if no commands for N ticks, send a tick_ack so peer knows we're alive.

### Memory Management (web.dev, Chrome DevTools)
1. **`performance.memory`** — non-standard but works in Chrome. `usedJSHeapSize` / `totalJSHeapSize` / `jsHeapSizeLimit`.
2. **`performance.measureUserAgentSpecificMemory()`** — standard, more accurate, but async + requires GC.
3. **GC pauses** — 5-30ms freezes. Avoid per-frame allocations. Already pooled.
4. **`--enable-precise-memory-info`** — Chrome flag for exact heap sizes.

## Current Baseline (perf.py)

| Scenario | FPS | Slow frames | Update avg | Render avg | CPU avg | "GPU" avg |
|---|---|---|---|---|---|---|
| Empty | 59.2 | 0 | 0.00ms | 0.00ms | 0.00ms | 0.00ms |
| 5v5 | 59.0 | 2 | 0.47ms | 0.66ms | 1.13ms | 15.95ms |
| 20v20 | 58.6 | 0 | 1.00ms | 0.76ms | 1.78ms | 15.33ms |
| 50v50 | 58.4 | 7 | 2.17ms | 1.06ms | 3.25ms | 13.96ms |
| MP Guest | 58.9 | 1 | 0.00ms | 0.51ms | 0.00ms | 0.00ms |

### Issues Found
1. **FPS ~58-59, not 60** — perf script uses `setTimeout(16.67ms)` for rAF, losing ~0.3ms/frame to timer overhead.
2. **CPU time miscounted** — `cpuTimes[i] = updateTimes[i] + renderTimes[i]` pairs one update with one render, but the accumulator can call update 0-4 times per frame. Need to accumulate all updates within a frame.
3. **"GPU" metric misleading** — `frameInterval - cpuTime` includes vsync wait, browser overhead, setTimeout jitter. Not actual GPU time. Need better labeling + separate measurement.
4. **Empty screen shows 0ms** — render is genuinely sub-millisecond (just background). No units = trivial work. But `drawBackground` sub-function not showing up — investigate.
5. **No TPS measurement** — need to track simulation ticks per second separately from frames.
6. **No lockstep scenario** — perf script only tests snapshot guest mode, not lockstep (both peers sim).
7. **No canvas context optimization** — `getContext("2d")` without `{alpha: false, desynchronized: true}`.

## Optimization Plan

### Phase A: Fix Measurement (perf.py)
- [x] Fix CPU time: wrap entire loop() in one timer (all updates + render)
- [x] Add TPS counter: count `update()` calls per second
- [x] Add lockstep scenario: both peers run sim (test with 100 units)
- [x] Add memory breakdown: JS heap used/min/max/total
- [x] Use real rAF (not setTimeout) for accurate 60fps measurement
- [x] Label "Non-CPU" as frame interval - CPU (includes vsync, browser, GPU)

### Phase B: Canvas Context Optimization
- [x] Add `{alpha: false, desynchronized: true}` to main canvas `getContext` calls (3 sites)
- [x] Verified sprite cache canvases keep default `alpha: true` (need transparency)

### Phase C: Unify Single/Multiplayer Paths
- [x] Verified lockstep uses same `loop()` → `update()` + `render()` as single-player
- [x] Verified snapshot fallback uses `_interpLoop()` → `_interpRender()` + `render()`
- [x] Both paths share all pools, caches, arrays (no duplication found)

### Phase D: Bug Hunt
- [x] Fixed: `disconnect()` didn't clear lockstep state → sim could stall after peer disconnect
- [x] Fixed: `_localTeam` not reset to "player" for solo battles after guest lockstep
- [x] Fixed: `stop()` didn't clear `snapTimer` → interval leak on error/timeout stop
- [x] Fixed: Per-hit allocation `{x:0,y:0}` fallback in sprite render (replaced with `_zeroDir`)
- [x] Verified: No hidden class divergence in `initRuntime()` (consistent property order)
- [x] Verified: No per-frame allocations in hot paths (all use pooled arrays/objects)

### Phase E: Hot Path Optimization
- [x] Profiled 50v50 with sub-function timing — all sub-functions well under budget
- [x] `act()`: 622ms total / 59k calls = 0.01ms avg — already optimized (spatial grid, cached targets)
- [x] `spriteDraw()`: 103ms total / 39k calls = 0.003ms avg — already optimized (sprite cache, `|0` rounding)
- [x] `separate()`: 67ms total / 603 calls = 0.11ms avg — already optimized (flat array grid)
- [x] `drawBackground()`: 19ms total / 602 calls = 0.03ms avg — already optimized (offscreen canvas cache)
- [x] No V8 deoptimization triggers found (no delete in hot paths, no try/catch in inner loops)

### Phase F: Verify Targets
- [x] Empty screen: 60.2fps, 60.2tps, 0 slow frames
- [x] 50v50 single-player: 60.2fps, 60.2tps, 0 slow frames
- [x] 50v50 lockstep: 60.1fps, 60.0tps, 0 slow frames
- [x] 50v50 snapshot guest: 60.2fps, 0 slow frames (0 tps expected — no sim in guest mode)
- [x] Memory stable (15-19MB across all scenarios, no growth over 10s)
- [x] E2E tests pass (187 PASS, 0 FAIL, 1 WARN — known timing-sensitive warning)

## Results Log

### Baseline (before optimization — old perf.py with setTimeout rAF)
| Scenario | FPS | TPS | CPU avg | Slow |
|---|---|---|---|---|
| Empty | 59.2 | N/A | 0.00ms | 0 |
| 5v5 | 59.0 | N/A | 1.13ms | 2 |
| 20v20 | 58.6 | N/A | 1.78ms | 0 |
| 50v50 | 58.4 | N/A | 3.25ms | 7 |
| MP Guest | 58.9 | N/A | 0.00ms | 1 |

### Final (after all phases — new perf.py with real rAF + canvas opts + bug fixes)
| Scenario | FPS | TPS | CPU avg | CPU p99 | Slow | Memory |
|---|---|---|---|---|---|---|
| Empty | 60.2 | 60.2 | 0.12ms | 0.40ms | 0 | 15.0MB |
| 5v5 (10) | 60.3 | 60.3 | 0.39ms | 1.10ms | 0 | 15.5MB |
| 20v20 (40) | 60.2 | 60.2 | 0.63ms | 1.40ms | 0 | 16.0MB |
| 50v50 (100) | 60.2 | 60.2 | 1.14ms | 2.60ms | 0 | 17.0MB |
| MP Lockstep | 60.1 | 60.0 | 1.15ms | 2.90ms | 0 | 19.4MB |
| MP Guest | 60.2 | 0.0* | 0.21ms | 0.40ms | 0 | 18.8MB |

*MP Guest has 0 TPS because the guest doesn't run the sim (snapshot interpolation only).

### Key Improvements
1. **Measurement fix**: Old perf.py used `setTimeout(16.67ms)` which lost ~0.3ms/frame to timer
   overhead, capping FPS at ~59. New perf.py uses real `requestAnimationFrame` for accurate
   60fps measurement. Also added TPS counter and lockstep scenario.
2. **Canvas context**: `alpha: false` + `desynchronized: true` on main canvas contexts (3 sites)
   for faster compositing and lower latency.
3. **Bug fixes**: 4 bugs fixed (disconnect lockstep leak, _localTeam reset, snapTimer leak,
   per-hit allocation). None were causing measurable perf issues but all were correctness bugs.
4. **CPU headroom**: 50v50 uses only 1.14ms avg CPU (p99=2.60ms) out of 16.67ms budget.
   That's 86% headroom — plenty of margin for heavier scenes or lower-end devices.
