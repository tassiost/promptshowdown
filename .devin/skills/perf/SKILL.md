---
name: perf
description: Run performance profiling (6 scenarios: empty, 5v5, 20v20, 50v50, MP lockstep, MP guest)
triggers:
  - user
allowed-tools:
  - read
  - exec
  - grep
permissions:
  allow:
    - Exec(python3 *)
    - Exec(lsof *)
    - Exec(kill *)
    - Exec(sleep *)
    - Exec(pmset *)
---

Run the Prompt Showdown performance profiler. Measures CPU (update + render), GPU
estimate, memory, and per-function timings across 6 scenarios with combat active.

## Steps

1. Build the project (profiler runs against the built version):
   ```
   cd /Users/tassio/Downloads/promptshowdown && npm run build
   ```

2. Kill any existing server on port 8765:
   ```
   lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1
   ```

3. Start a fresh HTTP server in dist:
   ```
   cd /Users/tassio/Downloads/promptshowdown/dist && python3 -m http.server 8765 &>/dev/null &
   sleep 2
   ```

4. Run the canonical profiler:
   ```
   cd /Users/tassio/Downloads/promptshowdown && python3 perf.py
   ```

5. Report the results. The profiler outputs 6 scenarios:
   - **Empty screen** — baseline (background rendering only)
   - **5v5 (10 units)** — light battle
   - **20v20 (40 units)** — medium battle
   - **50v50 (100 units)** — stress test with combat
   - **MP Lockstep (50v50)** — multiplayer lockstep sim (both peers run sim)
   - **MP Guest (50v50)** — multiplayer guest interpolation (render only, no sim)

6. Key metrics to report:
   - **FPS** — should be ~59-60 (setTimeout overhead in test harness; real browser = 60)
   - **CPU avg** — update + render time. 50v50 target: <3ms (budget is 16.67ms)
   - **Slow frames (>20ms)** — should be 0 in all scenarios
   - **Memory** — should be stable, no growth between scenarios

7. For 50v50, also report sub-function timings:
   - `act` — per-unit AI (target: <0.015ms/call)
   - `spriteDraw` — sprite cache hit rate (target: <0.005ms/call)
   - `separate` — collision separation (target: <0.2ms/call)
   - `drawBackground` — cached background (target: <0.05ms/call)
   - `drawDmgNums` — damage number batching (target: <0.07ms/call)
   - `updateProjectiles` — projectile pool + Map lookup (target: <0.08ms/call)

8. Clean up:
   ```
   lsof -ti:8765 | xargs kill -9 2>/dev/null
   ```

## Notes

- The profiler uses `setTimeout(16.67ms)` to override `requestAnimationFrame`, bypassing
  macOS low power mode 30Hz throttling. FPS shows ~59 due to setTimeout overhead — in a
  real 60Hz browser this would be exactly 60.
- Each scenario runs for 10 seconds. Total runtime: ~60 seconds.
- Results are saved to `perf_results.json`.
- If Playwright is not installed, run: `pip install playwright && python3 -m playwright install chromium`
- See PERF-R12.md for the full optimization history and methodology.
