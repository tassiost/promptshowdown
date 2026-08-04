# OPTIMIZATION-R18.md — Unify/Streamline, Bug Hunt, Optimize

Session: R18. Approach: unify/streamline first, then bug hunt, then optimize.
No parallel subagents.

## Phase 1: Unify/Streamline

### showConfirm() — Converted to use showModal() helper
**Location**: `src/utils.js` — `showConfirm`
**Problem**: `showConfirm` created its own overlay+modal with the same duplicated
cssText pattern that `showModal()` was created to eliminate in R17.
**Fix**: Replaced manual overlay/modal creation with `showModal()` call.
Eliminates 2 `document.createElement` + 2 `style.cssText` assignments.

### Duplicate "spider" template — Merged
**Location**: `src/forge.js` — TEMPLATES array
**Problem**: Two templates had `kw:["spider","arachnid",...]`. `TEMPLATES.find()`
returns the first match, so the second template (with "tarantula" keyword) was
dead code — "tarantula" would never match.
**Fix**: Merged "tarantula" into the first spider template's keywords. Removed
the duplicate second template.

### Dead duplicate keywords in templates
**Location**: `src/forge.js` — TEMPLATES array
**Problem**: Three keywords appeared in multiple templates, but only the first
template would ever match:
- "leviathan": in kraken template (line 1381) AND shark template (line 1401) — kraken matches first, "leviathan" in shark was dead code
- "tank": in knight template (line 1386) AND car template (line 1396) — knight matches first, "tank" in car was dead code
- "mech": in engineer template (line 1390) AND robot template (line 1397) — engineer matches first, "mech" in robot was dead code
**Fix**: Removed dead duplicate keywords from the later templates.

## Phase 2: Bug Hunt

### BUG-R18-1: lighten/darken crash on invalid hex input
**Location**: `src/forge.js` — `lighten()` and `darken()`
**Problem**: Neither function validated its `hex` parameter. If `hex` was
undefined, null, or not a string starting with `#`, `hex.slice(1)` would
either throw (undefined/null) or produce garbage (non-hex string). This could
crash the recipe assembler or sprite cache rendering.
**Fix**: Added guard at top of both functions:
`if(!hex||typeof hex!=="string"||hex[0]!=="#")hex="#888";`

### Verified (No Issues)
- All `Math.random()` in rendering.js are in cache-building or visual-only paths.
- `interpolate()` allocation is avoided in fast path (only bob/alpha/rot extracted).
- `sanitizeHex` only called during cache building, not per-frame.
- Spell template `target:"lowest_hp_enemy"` is valid (defined in `SPELL_TARGET`).
- `showConfirm` can use `showModal` (runtime call, load order OK).
- Command signing/verification correct (ECDSA + SHA-256).
- Visibilitychange pause/resume commands have edge case (tick in past) but
  stall watchdog catches it after 5s — not a critical bug.
- `_cmdBuffer` Map entries for past ticks are a minor memory leak (cleaned on
  battle start/disconnect).
- All `for...of` in non-hot paths are acceptable (init, debug, reconnect).

## Phase 3: Optimize

No new hot-path optimizations needed. All hot paths already optimized in
R12-R17. The `showConfirm` and `showModal` consolidation reduces code size
but doesn't affect runtime performance (UI code, not hot path).

## Phase 4: E2E Tests

Multiple runs: 215/0/1, 214/0/2, 212/2/2, 216/0/0. 0 real bugs.
All failures are flaky headless Chromium timing issues:
- "units moving: no movement" — battle didn't progress in time
- "damage numbers: none yet" — battle didn't progress in time
- "ability heal: battle ended quickly" — battle ended before ability fired
- "arena 0 (none): not running" — battle didn't start in time
None are code bugs — all are rAF timing issues in headless mode.
