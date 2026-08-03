# ISSUES.md — Known Issues & Fix Log

Status legend: [FIXED] patched / [OPEN] not yet fixed / [WONTFIX] by design / [UPSTREAM] third-party issue

---

## Mobile Issues

### 1. Safe area not respected — bottom buttons inaccessible on iOS
- **Status:** [FIXED] (commit `518c331`)
- **Symptom:** On iPhone, the bottom battle controls (tick, auto, speed, skip) were
  hidden behind the home indicator / Safari toolbar.
- **Root cause:** `env(safe-area-inset-bottom)` returns `0px` in two iOS scenarios:
  1. Safari portrait mode — Apple reports 0px because the bottom nav bar animates.
  2. PWA standalone mode — WebKit bug #254868: `innerHeight` is ~59px shorter than
     `screen.height`, but `env()` still returns 0px.
- **Fix:**
  - Added JS gap measurement: `screen.height - innerHeight` → `--standalone-gap` CSS variable.
  - All bottom padding now uses `max(env(safe-area-inset-bottom,0px), var(--standalone-gap,0px))`.
  - Added `100dvh` (dynamic viewport height) after `100vh` for body and fullscreen screens.
  - Re-measures on `resize` and `orientationchange`.
- **Affected elements:** body, `.screen`, battle controls bar, spell bar, unit inspector,
  battle controls hint.

### 2. Fullscreen button doesn't work on iPhone
- **Status:** [FIXED] (commit `518c331`)
- **Symptom:** Tapping the fullscreen button (⛶) on iPhone does nothing.
- **Root cause:** The Fullscreen API (`requestFullscreen()`) is NOT supported on iPhone
  Safari for arbitrary elements — only for `<video>`. It works on iPad and macOS Safari
  but Apple has not enabled it on iPhone (as of iOS 18).
- **Fix:**
  - Detect iPhone via `navigator.userAgent`.
  - On iPhone: use pseudo-fullscreen — toggles a `body.pseudo-fullscreen` CSS class that
    removes padding and fills the screen.
  - On desktop/iPad/Android: still uses native Fullscreen API (with `webkitRequestFullscreen`
    fallback).
  - Button icon changes between `⛶` and `⬜` to indicate state.
  - Also fixed `#fsBtn` position to use `env(safe-area-inset-left/top)`.

### 3. Forge crashes midway through on mobile
- **Status:** [FIXED] (commit pending)
- **Symptom:** Forging on mobile crashes the tab midway through generation. Safari shows
  "A problem occurred with this webpage" and reloads.
- **Root cause:** The model `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` requires ~1630MB VRAM.
  iOS Safari jetsam-kills tabs at ~800MB RAM. The model downloads successfully but the
  tab is killed when inference begins (WebGPU buffer allocation exceeds the memory limit).
  This is an OS-level kill — there is no JavaScript exception to catch; the tab simply
  reloads.
- **Fix:**
  - Use `SmolLM2-360M-Instruct-q4f16_1-MLC` (~580MB VRAM) on mobile instead of
    `Qwen2.5-1.5B` (~1630MB). The 360M model fits within iOS's ~800MB tab limit.
  - Added WebGPU `maxBufferSize` check: if < 512MB, skip LLM entirely and use template
    fallback (prevents crash on older devices with limited WebGPU memory).
  - Desktop continues using Qwen2.5-1.5B for better quality.
- **Trade-off:** SmolLM2-360M produces lower-quality unit concepts than Qwen2.5-1.5B,
  but it won't crash the browser. Template fallback is always available as a last resort.
- **References:**
  - [mlc-ai/web-llm#753](https://github.com/mlc-ai/web-llm/issues/753) — iOS tab crash
  - [WebKit bug #275958](https://bugs.webkit.org/show_bug.cgi?id=275958) — 1GB buffer limit
  - [Ludion blog](https://ludion.ai/blog/webgpu-reports-vs-reality/) — WebGPU on phones

### 4. Forge progress bar not shown immediately
- **Status:** [FIXED] (commit `aa51060`)
- **Symptom:** Forge screen just says "Loading" instead of showing the progress bar
  right away when entering the forge.
- **Root cause:** The forge screen always hid the progress bar on entry
  (`_hideModelProgress()`), even if the model was actively downloading in the
  background. The progress bar only appeared after tapping "Watch Ad to Generate".
- **Fix:**
  - `forge()` now checks `llmLoading && !llmReady` and shows the progress bar
    immediately on screen entry if the model is still loading.
  - Added global `aiStatus` poller (every 500ms) that updates the AI status badge
    during background download, visible from any screen.
  - `updateAIFromProgress` now also updates the `aiStatus` badge with download
    percentage.

### 5. Model not downloading in background on app load
- **Status:** [FIXED] (commit `aa51060`)
- **Symptom:** It feels like the model is not being downloaded in the background when
  the app loads — the user has to wait when they first tap Forge.
- **Root cause:** `preloadAI()` was already called inside `loadModules()` right after
  the web-llm module loaded, but there was no visible feedback. The user couldn't tell
  the model was downloading until they navigated to the forge screen.
- **Fix:**
  - Added global `aiStatus` poller that updates the AI badge every 500ms during
    background download (e.g. "AI: 42% downloaded"), visible from any screen.
  - Removed redundant `preloadAI()` call after `G.init()` (already called inside
    `loadModules()` before trystero/LZString imports).

---

## Multiplayer Issues

### 6. MP guest army wiped each round (continuous draft bug)
- **Status:** [FIXED] (commit `486e550`)
- **Symptom:** In multiplayer, the host's army grew each round (2→3→4...) but the
  guest's army was wiped to only new picks each round (2→1→1...).
- **Root cause:** `startHostBattle()` built the guest's army via `buildArmyFromSelected()`
  which only used the guest's new draft picks — it did NOT include survivors from
  previous rounds. The host's army (`buildArmy()`) correctly included survivors.
- **Fix:** `startHostBattle()` now combines `this.enemySurvivors` (guest's units from
  previous rounds) with the guest's new draft picks.
- **Tests:** TEST 23 (SP carry-over) + TEST 24 (MP carry-over) verify both host and
  guest armies accumulate correctly across rounds.

### 7. Lockstep stall — sim freezes if peer stops sending tick_ack
- **Status:** [FIXED] (commit `4ea0914`)
- **Symptom:** The sim would freeze if a peer stopped sending `tick_ack` (disconnected
  or lagged). No timeout existed to detect this.
- **Fix:** Added a 5-second stall watchdog in `Battle.loop()`. If the sim cannot advance
  for 5 seconds while in lockstep, it sets `_desyncFallback=true` and
  `_lockstepActive=false`, allowing it to resume freely.
- **Test:** TEST 21 (Lockstep Stall Watchdog).

### 8. Late command desync — commands arriving after target tick silently dropped
- **Status:** [FIXED] (commit `4ea0914`)
- **Symptom:** Commands arriving after their target tick were silently dropped, leading
  to desync between peers.
- **Fix:** `networkReceive` now triggers `_desyncFallback=true` if a `cmd_lock` arrives
  for a tick that has already passed. This prevents late commands from causing silent
  desync; the next round falls back to snapshot sync.
- **Test:** TEST 22 (Late Command Detection).

---

## UX Issues

### 9. Battle result screen appears too fast — no time to see what happened
- **Status:** [FIXED] (commit `d910361`)
- **Symptom:** After a round ends, the screen immediately transitions to the result
  screen, giving players no time to see the final state of the battlefield.
- **Fix:** Added `_endBattle()` helper that snapshots state, stops the sim, renders one
  final frame (with round-end flash and screen shake), then calls `onEnd` after a 1-second
  delay via `setTimeout`. The rAF loop stops immediately when `running=false`, so no CPU
  is wasted during the pause.
- **Guard:** `_ending` flag prevents double-calls (e.g. timeout + normal end simultaneously).

---

## Performance Issues

### 10. Frame rate inconsistencies — not consistently 60 FPS
- **Status:** [FIXED] (commit `4aca3b6`)
- **Symptom:** Frame rate was not consistently 60 FPS across all scenarios.
- **Fix:** Fixed frame limiter, added CDP GPU tracing, fixed 4 determinism bugs.
- **Result:** All scenarios (empty, 5v5, 20v20, 50v50, MP Lockstep, MP Guest) now run
  at 60 FPS / 60 TPS with 0 slow frames.

---

## Model Quality Issues

### 11. SmolLM2-360M produces lower-quality concepts than Qwen2.5-1.5B
- **Status:** [OPEN] — trade-off from fix #3
- **Description:** The 360M model is less creative and may produce more generic unit
  names/concepts than the 1.5B model. This is an unavoidable trade-off for mobile
  stability — the 1.5B model crashes iOS Safari.
- **Mitigation:** Template fallback is always available. Users can tap "Skip Ad (template)"
  to bypass the LLM entirely and get a procedural unit. The LLM is only used for the
  "Watch Ad" path.

### 12. Web Worker import may fail on some CDN setups
- **Status:** [WONTFIX] — upstream CDN issue
- **Description:** The Web Worker code imports web-llm from `esm.run` which may fail on
  some CDN configurations. Non-fatal — main-thread fallback works.
- **Reference:** BUGS.md item #4.

---

## Not Yet Reported / Potential Issues

### 13. iOS PWA "Add to Home Screen" — white gap below bottom nav
- **Status:** [OPEN]
- **Description:** On iOS PWA standalone mode, `100dvh` may resolve to the viewport
  excluding the bottom safe area inset (~34px), leaving a white gap. The `--standalone-gap`
  fix addresses the interactive zone but the visual gap may still appear on some devices.
- **Workaround:** The `--standalone-gap` CSS variable (measured via
  `screen.height - innerHeight`) should fill this gap, but needs testing on actual hardware.

### 14. Android Chrome safe area — untested
- **Status:** [OPEN]
- **Description:** The safe area fixes were designed for iOS. Android Chrome has
  different safe area behavior (navigation bar at bottom). Needs testing on Android
  devices to confirm `env(safe-area-inset-bottom)` works correctly.
