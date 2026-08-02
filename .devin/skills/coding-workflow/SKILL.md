---
name: coding-workflow
description: Full development workflow — quick start, verification, commit style, known issues
triggers:
  - model
allowed-tools:
  - read
  - exec
  - grep
  - glob
---

Use this skill for any coding task in this repo — bug fixes, features, refactors,
performance work. Covers the full development workflow.

## Quick Start

```bash
# Start local server (port 8765 for tests, port 8000 for Play.command)
python3 -m http.server 8765
# Open http://localhost:8765/index.html in Chrome/Edge
```

Or double-click `Play.command` to start server + open browser.

## Before Making Changes

1. **Read AGENTS.md** — it has the 10 critical invariants you must not break.
2. **Check `docs/FILE_MAP.md`** for where things live in `index.html` (~13K lines, single file).
3. **Search for existing patterns** — mimic neighboring code style.
4. **Invoke knowledge skills** for the subsystem you're working on:
   - `/battle-rules` — battle logic, abilities, spells, targeting, movement
   - `/system-rules` — P2P, save, security, forge, init, PWA, audio
   - `/render-rules` — sprite rendering, canvas, performance, hot paths

## Verification (before considering a task complete)

```bash
# 1. Kill any existing server
lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1

# 2. Start fresh server
python3 -m http.server 8765 &>/dev/null & sleep 2

# 3. Run E2E tests (184 tests, ~60s)
python3 e2e_test.py

# 4. Clean up
lsof -ti:8765 | xargs kill -9 2>/dev/null
```

If you changed performance-critical code (render, update, act, separate):
```bash
# Run perf profiler (5 scenarios, ~60s)
python3 perf.py
```

All 184 E2E tests must pass. 50v50 must hit 60 FPS with 0 slow frames.

## Commit Style

```
AREA: <one-line description>

<optional body explaining why, not what>

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
```

Common areas: `PERF-R12`, `BUG-HUNT`, `forge`, `battle`, `p2p`, `save`, `render`, `spell`, `workflow`.

## Project Structure

```
index.html              — entire game (HTML + CSS + JS, ~13K lines)
vendor/                 — vendored ES modules (trystero, lz-string)
e2e_test.py             — E2E test suite (184 tests, Playwright)
perf.py                 — performance profiler (5 scenarios, Playwright)
Play.command            — macOS double-click launcher
render.yaml             — Render.com deployment blueprint
AGENTS.md               — critical invariants (read first, 68 lines)
docs/FILE_MAP.md        — line-by-line map of index.html
PERF-R12.md             — performance optimization details
BUGS.md                 — bug hunt log
archive/                — historical session logs (BUG-HUNT-R*, OVERNIGHT*, etc.)
.devin/skills/          — AI workflow skills (this file + 5 others)
```

## Critical Invariants (do not break)

1. **Unit names sanitized at creation** in `unit()` — strip `<>`, replace `"` with `'`, truncate 20
2. **Save import must run migration** — `importSave()` calls `migrateSave(data)` first
3. **Continuous draft: never filter survivors by `u.h>0`** — dead units carry over + revive
4. **Movement dead zone must be within attack range** — upper bound <= `u.r`
5. **All HP reductions must set `u.lastAttacker`** — melee, projectiles, splash, thorns, poison
6. **Spell targets must be filtered by team** — ally targets to allies, others to enemies
7. **`sanitizeSpell()` for all untrusted spells** — P2P, URL import, save import
8. **P2P guest must not run authoritative logic** — guest `onBattleEnd` returns early
9. **Never re-create `#cv` canvas** — single shared canvas, only reparent via `G.screen()`
10. **Never allocate in hot paths** — index loops, pooled objects, reusable arrays, squared distance

## Common Pitfalls

- **"Unit doesn't render"**: check `BODY_PLANS` has the body plan, `WEAPONS` has the weapon type
- **"Spell does nothing"**: check `tickZones` handles the effect type, `Spell.fire` filters by team
- **"Kill not attributed"**: check `lastAttacker` is set on every HP reduction path
- **"Units stare at each other"**: movement dead zone extends beyond attack range (see rule 4)
- **"P2P desync"**: guest running authoritative logic, or version mismatch in role handshake
- **"Save import crashes"**: `migrateSave` not called, or missing migration for new version
- **"Performance regression"**: `for...of` in hot path, per-frame allocation, `Math.sqrt` in distance check
- **"XSS"**: user string in `innerHTML` without `escapeHtml()`, or unsanitized unit/spell name

## LLM Rules

- **Never set `max_tokens`** on `chat.completions.create` — local inference is free
- **Never cap daily forges** — the forgeCount cap has been removed
- **Never add LLM timeouts** — the Cancel button is the only escape hatch
- **Prefer richer prompts and multi-call generation** over cramped single calls
- **Always clear the IndexedDB cache** when testing generation changes:
  `indexedDB.deleteDatabase('promptshowdown_llm_cache_v8')`

## Project Rules

- **Never use chrome-devtools MCP** — all browser testing goes through Playwright MCP
- **Never limit LLM usage** — inference is free (local WebLLM, no API costs)
- **No new npm dependencies** — vendor anything needed in `vendor/`
- **Keep it single-file** — all game code in `index.html`
