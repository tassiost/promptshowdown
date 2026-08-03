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
- **Status:** [FIXED] (commit `503f8c6`)
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

### 4. Comeback banner offset to the right on mobile
- **Status:** [FIXED] (commit `c8cb438`)
- **Symptom:** The "⭐ COMEBACK BONUS — 4th draw!" banner appeared off-center (shifted
  right) on mobile devices.
- **Root cause:** The `.screen` class has `animation:fadeIn .3s ease` and the `fadeIn`
  keyframe uses `transform:translateY(0)` in its `to` state. Per CSS spec, any element
  with a `transform` becomes a containing block for `position:fixed` descendants. This
  means the banner's `left:50%` was relative to the `.screen` element (shifted by body
  padding on mobile), not the viewport. The `translateX(-50%)` then centered based on
  the banner's own width, but from the wrong starting position.
- **Fix:** Replaced `left:50%;transform:translateX(-50%)` with `left:0;right:0;
  text-align:center` + an `inline-block` child. No `transform` needed, so it's immune
  to the containing-block issue. Added `pointer-events:none` on the wrapper so taps
  pass through to the draft UI underneath.

---

## Forge / AI Issues

### 5. Forge progress bar not shown immediately
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

### 6. Model not downloading in background on app load
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

### 7. Forge always produces humanoids (bodyPlan prompt ignored concept)
- **Status:** [FIXED] (commit `2535a2d`)
- **Symptom:** Forging a unit like "elephant" or "car" always produced a humanoid body
  plan, regardless of the concept.
- **Root cause:** The `bodyPlan` prompt function was defined as `bodyPlan:()=>...` — it
  took **no parameters** and didn't reference the user's concept. The LLM was asked
  "Given this unit's identity, what body plan fits: humanoid, quadruped, dragon..."
  with no mention of "elephant" or "car". The small model defaulted to "humanoid" (the
  most common/safe answer).
- **Fix:**
  - `bodyPlan` prompt now includes the concept name and descriptions of each body plan
    option (e.g. "quadruped = four-legged animal (horse, wolf, elephant)",
    "mechanical = machine/robot/vehicle (car, tank, drone)").
  - `weaponType` prompt now includes concept name + bodyPlan for context (animals use
    claws/breath, machines use rifle, etc.).
  - Added template fallbacks for: elephant, car, robot, spider, wolf, cat, bear, shark
    (previously fell through to random template).

### 8. SmolLM2-360M produces lower-quality concepts than Qwen2.5-1.5B
- **Status:** [OPEN] — trade-off from fix #3
- **Description:** The 360M model is less creative and may produce more generic unit
  names/concepts than the 1.5B model. This is an unavoidable trade-off for mobile
  stability — the 1.5B model crashes iOS Safari.
- **Mitigation:** Template fallback is always available. Users can tap "Skip Ad (template)"
  to bypass the LLM entirely and get a procedural unit. The LLM is only used for the
  "Watch Ad" path. Improved prompts (fix #7) help the small model produce better results.

### 9. Web Worker import may fail on some CDN setups
- **Status:** [WONTFIX] — upstream CDN issue
- **Description:** The Web Worker code imports web-llm from `esm.run` which may fail on
  some CDN configurations. Non-fatal — main-thread fallback works.
- **Reference:** BUGS.md item #4.

---

## Rendering Issues

### 10. Units hard to identify as friend or foe
- **Status:** [FIXED] (commit `5bb8fcb`)
- **Symptom:** Players couldn't easily tell their units apart from enemies. Colors were
  already used for unit variety (primaryColor, accentColor), so team colors couldn't be
  applied to the body.
- **Root cause:** The only team indicators were very subtle: ground decal at 0.15 alpha
  (nearly invisible), HP bar border at 1px (very thin), and name text at 9px (tiny). The
  unit bodies used their own colors with no team distinction.
- **Fix:** Added three team identification cues, all using existing `TEAM_COLORS` (blue
  `#4af` for player, red `#f44` for enemy) without affecting unit body colors:
  1. **Base ring** — ground decal alpha increased from 0.15 to 0.3, added 1.5px
     team-colored stroke ring at unit feet (like StarCraft/AoE base rings).
  2. **HP bar** — border thickness increased from 1px to 2px, added team-colored
     background tint at 0.15 alpha.
  3. **Outline glow** — subtle team-colored aura ellipse behind each unit sprite at
     0.12 alpha (blue for player, red for enemy).
- **Performance:** All three cues use simple ellipse/rect draws, no filters or shadows.
  Perf: all scenarios 60 FPS / 60 TPS, 0 slow frames.

### 11. Sprite bob clipping — units cut off at top and bottom when bouncing
- **Status:** [FIXED] (commit `3f490c6`)
- **Symptom:** Units bounce up and down (idle/move animation), but get cut off at the
  bottom when bouncing down and cut off at the top when bouncing up.
- **Root cause:** Two bugs in the sprite cache system:
  1. **Double-bob** — The bob offset was applied BOTH in the sprite cache
     (`u.y = cy + bobY`) AND in the draw path (`dy = ... + bobY`), causing the sprite
     to bounce twice as much as intended (~5.6px instead of 2px).
  2. **Bottom clipping** — The cache origin was at `spriteH - PAD` (4px from bottom),
     but sprite shapes extend to y=+12 (legs) which scaled by 1.8 = 21.6px below
     origin. Only 4px was available — the bottom was clipped by ~17px.
- **Fix:**
  - Removed bob from the cache — it's now applied only at draw time (smoother since
    it uses continuous `t` from `Battle.time` instead of being quantized to 8 cache
    frames).
  - Moved origin to 70% from top (`SPRITE_ORIGIN_FRAC=0.7`), leaving 30% of the canvas
    height for the lower sprite extent (legs/feet + bob).
  - Added `v2` to cache key to invalidate old caches with the wrong origin.

---

## Multiplayer Issues

### 12. MP guest army wiped each round (continuous draft bug)
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

### 13. Lockstep stall — sim freezes if peer stops sending tick_ack
- **Status:** [FIXED] (commit `4ea0914`)
- **Symptom:** The sim would freeze if a peer stopped sending `tick_ack` (disconnected
  or lagged). No timeout existed to detect this.
- **Fix:** Added a 5-second stall watchdog in `Battle.loop()`. If the sim cannot advance
  for 5 seconds while in lockstep, it sets `_desyncFallback=true` and
  `_lockstepActive=false`, allowing it to resume freely.
- **Test:** TEST 21 (Lockstep Stall Watchdog).

### 14. Late command desync — commands arriving after target tick silently dropped
- **Status:** [FIXED] (commit `4ea0914`)
- **Symptom:** Commands arriving after their target tick were silently dropped, leading
  to desync between peers.
- **Fix:** `networkReceive` now triggers `_desyncFallback=true` if a `cmd_lock` arrives
  for a tick that has already passed. This prevents late commands from causing silent
  desync; the next round falls back to snapshot sync.
- **Test:** TEST 22 (Late Command Detection).

---

## UX Issues

### 15. Battle result screen appears too fast — no time to see what happened
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

### 16. Frame rate inconsistencies — not consistently 60 FPS
- **Status:** [FIXED] (commit `4aca3b6`)
- **Symptom:** Frame rate was not consistently 60 FPS across all scenarios.
- **Fix:** Fixed frame limiter, added CDP GPU tracing, fixed 4 determinism bugs.
- **Result:** All scenarios (empty, 5v5, 20v20, 50v50, MP Lockstep, MP Guest) now run
  at 60 FPS / 60 TPS with 0 slow frames.

---

## Potential / Untested Issues

### 17. iOS PWA "Add to Home Screen" — white gap below bottom nav
- **Status:** [OPEN]
- **Description:** On iOS PWA standalone mode, `100dvh` may resolve to the viewport
  excluding the bottom safe area inset (~34px), leaving a white gap. The `--standalone-gap`
  fix addresses the interactive zone but the visual gap may still appear on some devices.
- **Workaround:** The `--standalone-gap` CSS variable (measured via
  `screen.height - innerHeight`) should fill this gap, but needs testing on actual hardware.

### 18. Android Chrome safe area — untested
- **Status:** [OPEN]
- **Description:** The safe area fixes were designed for iOS. Android Chrome has
  different safe area behavior (navigation bar at bottom). Needs testing on Android
  devices to confirm `env(safe-area-inset-bottom)` works correctly.

---

## Summary

| # | Issue | Status | Commit |
|---|-------|--------|--------|
| 1 | Safe area not respected on iOS | [FIXED] | `518c331` |
| 2 | Fullscreen button on iPhone | [FIXED] | `518c331` |
| 3 | Forge crashes on mobile (OOM) | [FIXED] | `503f8c6` |
| 4 | Comeback banner offset on mobile | [FIXED] | `c8cb438` |
| 5 | Forge progress bar not shown immediately | [FIXED] | `aa51060` |
| 6 | Model not downloading in background | [FIXED] | `aa51060` |
| 7 | Forge always produces humanoids | [FIXED] | `2535a2d` |
| 8 | SmolLM2-360M lower quality (trade-off) | [OPEN] | — |
| 9 | Web Worker CDN import failure | [WONTFIX] | — |
| 10 | Units hard to identify as friend/foe | [FIXED] | `5bb8fcb` |
| 11 | Sprite bob clipping (double-bob + bottom) | [FIXED] | `3f490c6` |
| 12 | MP guest army wiped each round | [FIXED] | `486e550` |
| 13 | Lockstep stall freeze | [FIXED] | `4ea0914` |
| 14 | Late command desync | [FIXED] | `4ea0914` |
| 15 | Battle result appears too fast | [FIXED] | `d910361` |
| 16 | Frame rate inconsistencies | [FIXED] | `4aca3b6` |
| 17 | iOS PWA white gap below nav | [OPEN] | — |
| 18 | Android Chrome safe area untested | [OPEN] | — |

**Fixed:** 14 | **Open:** 3 | **Wontfix:** 1 | **Total:** 18
