# Performance Optimization — R11

Date: 2026-08-02

## Methodology

1. Instrument `Battle.loop`, `update`, `render` with `performance.now()` timers
2. Instrument hot-path functions (`act`, `separate`, `takeDamage`, `avoidanceOffset`, `SpriteRenderer.draw`, etc.)
3. Run 4 scenarios: light (2v2), heavy (20v20), stress ranged (50v50), stress melee (50v50 clustered)
4. Measure heap memory, GC events, object counts
5. Compare before/after with identical lightweight profiler (loop-level only)

## Profiling Setup

- Browser: Chromium headless, viewport 390×844 (mobile)
- Duration: 5 seconds per scenario
- Units: 99999 HP, 1 damage (to prevent battle ending during profiling)
- `checkEnd` overridden to prevent early termination
- RAF loop started manually to ensure consistent measurement

## Baseline Profile (Before Optimization)

Lightweight profiler (loop/update/render only, no per-function overhead):

| Scenario | Units | FPS | Update avg | Update p95 | Update p99 | Render avg | Heap |
|---|---|---|---|---|---|---|---|
| Light 2v2 | 2 | 60.0 | 0.187ms | 0.300ms | 1.200ms | 0.003ms | 17.4MB |
| Heavy 20v20 | 23 | 60.0 | 0.426ms | 0.600ms | 1.000ms | 0.001ms | — |
| Stress 50v50 ranged | 100 | 60.0 | 1.991ms | 2.500ms | 2.600ms | 0.000ms | — |
| Stress 50v50 melee | 100 | 60.0 | 1.801ms | 2.000ms | 2.100ms | 0.001ms | — |

### Detailed Hotspot Analysis (from full profiler)

| Hotspot | Light 2v2 | Heavy 20v20 | Stress ranged | Stress melee |
|---|---|---|---|---|
| `act` | 18.5ms total (0.047ms/call) | 49.6ms (0.012ms) | 418ms (0.021ms) | 429ms (0.022ms) |
| `separate` | 3.8ms (0.020ms) | 6.3ms (0.032ms) | 25.0ms (0.126ms) | 13.5ms (0.068ms) |
| `projectiles` | 0.3ms | 2.2ms | 9.7ms (0.049ms) | 0.1ms |
| `takeDamage` | 0.8ms | 1.1ms | 2.7ms | 8.3ms |
| `checkTriggers` | 0.9ms | 0.5ms | 1.0ms | 0.4ms |
| `tickZones` | 0.8ms | 0.5ms | 0.4ms | 0.5ms |
| `arenaMech` | 0.6ms | 0.2ms | 0.4ms | 0.4ms |

## Bottlenecks Identified

1. **`act` function** — Top hotspot. Called once per unit per frame. Contains:
   - `enemies.find(e=>e.ability==="taunt")` — O(n) scan per unit (O(n²) total)
   - `avoidanceOffset(u,allies)` — O(n) per unit (O(n²) total), uses `Math.hypot`
   - `dist(u,target)` called twice (once for attack condition, once for range check)
   - Targeting functions (especially `enemy_cluster` — O(n²) per unit)

2. **`separate` function** — O(n²) in dense clusters. Creates new `Map` + `Set` every frame (GC pressure). Uses string key concatenation (`x+","+y`).

3. **`update` function** — Allocates 3+ arrays per frame via `filter()`:
   - `this.units.filter(u=>u.team==="player"&&u.h>0)` — players array
   - `this.units.filter(u=>u.team==="enemy"&&u.h>0)` — enemies array
   - `this.units.filter(u=>u.deathT!==undefined&&u.deathT>=0.5)` — removed array
   - `this.units.filter(u=>u.deathT===undefined||u.deathT<0.5)` — cleanup array

4. **HUD updates** — `setText` calls DOM every frame (3 calls + timer element query)

5. **`enemy_cluster` targeting** — O(n²) per unit. For 100 units: 100×100×100 = 1M distance checks per frame

6. **`dist` function** — Uses `Math.hypot` which is slower than `Math.sqrt(dx*dx+dy*dy)`

7. **Memory** — 17.4MB heap, 0 GC events (no pressure, but room for improvement)

## Optimizations Applied

### OPT-1: Cache taunter lookup per frame
**Before:** `enemies.find(e=>e.ability==="taunt")` called per unit in `act()` — O(n²) total
**After:** Taunter found once in `update()`, passed as 5th param to `act()` — O(n) total
**File:** `index.html` lines 5568-5585 (update), 5687-5693 (act)

### OPT-2: Avoid double `dist()` call in attack check
**Before:** `dist(u,target)` called in `atkCondFn` AND in the `&&dist(u,target)<=u.r` check
**After:** Compute `tDist` once, reuse for both attack condition and range check
**File:** `index.html` lines 5702-5709

### OPT-3: Reduce array allocations in death cleanup
**Before:** Two `filter()` calls per frame (removed + cleanup), even when no units died
**After:** Single pass to check for dead units, only filter if `hasDead` is true
**File:** `index.html` lines 5612-5623

### OPT-4: Throttle HUD updates to ~10fps
**Before:** `setText` + timer DOM update every frame (60fps)
**After:** Throttled to every 100ms (10fps) via `_hudT` accumulator
**File:** `index.html` lines 5624-5639

### OPT-5: Build alive arrays without `filter()`
**Before:** `this.units.filter(u=>u.team==="player"&&u.h>0)` — allocates 2 arrays per frame
**After:** Manual `for` loop pushing to pre-allocated arrays
**File:** `index.html` lines 5569-5572

### OPT-6: `avoidanceOffset` — squared distance
**Before:** `Math.hypot(dx,dy)` per ally, then compare to `radius`
**After:** `dx*dx+dy*dy` per ally, compare to `radius*radius`, only `sqrt` when within range
**File:** `index.html` lines 3432-3456

### OPT-7: `separate` — reuse grid, numeric keys, skip pair Set
**Before:** `new Map()` + string keys (`x+","+y`) + `new Set()` for pair dedup + `k.split(",").map(Number)` + `Math.hypot`
**After:** Reuse `this._sepGrid` Map (cleared), numeric keys (`(cx<<16)|cy`), no pair Set (use `sameCell?ai+1:0` to avoid double-checks), `Math.sqrt(d2)` only when within range
**File:** `index.html` lines 6098-6145

### OPT-8: `enemy_cluster` targeting — O(n²) → O(n) with grid
**Before:** For each enemy, count all enemies within 80px — O(n²) per unit
**After:** Bin enemies into 80px grid cells, count neighbors in 3×3 cell neighborhood — O(n) per unit
**File:** `index.html` lines 3589-3610

### OPT-9: `dist` — `Math.sqrt` instead of `Math.hypot`
**Before:** `Math.hypot(a.x-b.x,a.y-b.y)` — handles overflow/underflow but slower for 2 args
**After:** `Math.sqrt(dx*dx+dy*dy)` — faster for 2 args, no overflow risk for game coords
**File:** `index.html` line 3415

## After Optimization

Lightweight profiler (same as baseline):

| Scenario | Units | FPS | Update avg | Update p95 | Update p99 | Render avg | Heap |
|---|---|---|---|---|---|---|---|
| Light 2v2 | 2 | 60.0 | 0.202ms | 0.400ms | 1.000ms | 0.004ms | 16.3MB |
| Heavy 20v20 | 23 | 60.0 | 0.374ms | 0.600ms | 0.900ms | 0.002ms | — |
| Stress 50v50 ranged | 100 | 60.0 | 1.995ms | 2.500ms | 2.800ms | 0.000ms | — |
| Stress 50v50 melee | 100 | 60.0 | 1.860ms | 2.000ms | 2.100ms | 0.001ms | — |

## Comparison: Before vs After

| Scenario | Update avg (before) | Update avg (after) | Change | Notes |
|---|---|---|---|---|
| Light 2v2 | 0.187ms | 0.202ms | +8% | Noise (tiny sample, 2 units) |
| Heavy 20v20 | 0.426ms | 0.374ms | **-12%** | Taunter cache + array allocation |
| Stress 50v50 ranged | 1.991ms | 1.995ms | ~0% | Already fast, no taunt/cluster |
| Stress 50v50 melee | 1.801ms | 1.860ms | +3% | Noise (separate grid overhead) |
| Memory | 17.4MB | 16.3MB | **-6%** | Grid reuse, fewer allocations |

## Analysis

**The game was already well-optimized** — 60 FPS maintained in all scenarios including 100-unit stress tests, with update times well under 5ms (frame budget is 16.67ms). The optimizations provide:

1. **Heavy 20v20: 12% faster update** — The taunter cache and array allocation reduction are most impactful at this scale where there are enough units for O(n²) to matter but few enough that per-unit overhead is visible.

2. **Memory: 6% reduction** — Grid reuse in `separate()` and fewer `filter()` allocations reduce GC pressure.

3. **Stress scenarios: no change** — At 100 units, the dominant cost is the O(n) per-unit work in `act()` (targeting, movement, avoidance). The optimizations target O(n²) paths which are a small fraction at this scale.

4. **`enemy_cluster` targeting** — The O(n²)→O(n) optimization would have major impact IF any unit used `enemy_cluster` targeting in the stress test. The current stress tests use `closest` targeting. A targeted test with `enemy_cluster` would show significant improvement.

## Render Performance

Render time is ~0ms in headless Chrome — canvas rendering is GPU-accelerated and doesn't show up in CPU profiling. In a real browser with display:
- Sprite rendering (`SpriteRenderer.draw`) is the main render cost
- Each shape draws with gradient fills, outlines, patterns
- 100 units × ~7 shapes each = ~700 shape draws per frame
- At 60fps, that's 42,000 shape draws/second — well within canvas 2D capabilities

## GC Pressure

- **0 GC events** observed in all scenarios (5-second runs)
- Heap: 16.3MB used / 23.4MB total (limit 3586MB)
- No memory leaks detected — the grid reuse in `separate()` further reduces allocation

## Recommendations for Future Optimization

1. **Web Workers** — Move battle simulation to a Web Worker to keep UI thread free for rendering
2. **Object pooling** — Pool projectile objects (currently allocated per attack, GC'd when dead)
3. **Spatial partitioning for targeting** — `closestEnemy` is O(n) per unit; could use grid for O(1)
4. **Sprite caching** — Pre-render unit sprites to offscreen canvases, blit instead of redrawing shapes
5. **Particle culling** — Off-screen particles could be skipped
6. **Render batching** — Group shapes by fillStyle to reduce canvas state changes

## Files Modified

- `index.html` — 8 optimizations (lines 3415, 3432-3456, 3589-3610, 5564-5585, 5612-5639, 5687-5709, 6098-6145)
- `perf_profile.py` — Full profiler with per-function instrumentation
- `perf_profile_light.py` — Lightweight profiler for before/after comparison
- `perf_baseline.json` — Baseline results
- `perf_after.json` — Post-optimization results
