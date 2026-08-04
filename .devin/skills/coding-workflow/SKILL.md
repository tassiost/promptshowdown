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
# Dev server with HMR (port 5173)
npm run dev

# Or build + serve the single-file output (port 8765 for tests)
npm run build
cd dist && python3 -m http.server 8765
# Open http://localhost:8765/index.html in Chrome/Edge
```

## Before Making Changes

1. **Read AGENTS.md** — it has the 17 critical invariants you must not break.
2. **Check `docs/FILE_MAP.md`** for where things live in the `src/` modules.
3. **Search for existing patterns** — mimic neighboring code style.
4. **Invoke knowledge skills** for the subsystem you're working on:
   - `/battle-rules` — battle logic, abilities, spells, targeting, movement
   - `/system-rules` — P2P, save, security, forge, init, PWA, audio
   - `/render-rules` — sprite rendering, canvas, performance, hot paths

## Verification (before considering a task complete)

```bash
# 1. Build the project
npm run build

# 2. Kill any existing server
lsof -ti:8765 | xargs kill -9 2>/dev/null; sleep 1

# 3. Start fresh server
cd dist && python3 -m http.server 8765 &>/dev/null & sleep 2

# 4. Run E2E tests (216 tests, ~60s)
python3 e2e_test.py

# 5. Clean up
lsof -ti:8765 | xargs kill -9 2>/dev/null
```

If you changed performance-critical code (render, update, act, separate):
```bash
# Run perf profiler (6 scenarios, ~60s)
python3 perf.py
```

All 216 E2E tests must pass. 50v50 must hit 60 FPS with 0 slow frames.

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
src/                    — source modules (concatenated via // INCLUDE: in main.js)
  main.js               — entry point (INCLUDE directives inline all modules)
  imports.js            — dynamic imports (web-llm, trystero, lz-string)
  forge.js              — LLM forge, recipe assembler, unit() factory
  generated_units.js    — LLM-forged units added to base roster
  battle.js             — battle object, spells, combat, sim
  rendering.js          — sprite rendering, procedural FX, audio
  ui.js                 — UI screens, deck builder, forge UI, tooltips
  game.js               — G object, init, PWA, event handlers
  ...                   — (utils, save, network, match, quests, bot, etc.)
index.html              — root HTML (Vite entry point)
dist/index.html         — built single file (npm run build)
vendor/                 — vendored ES modules (trystero, lz-string)
vite.config.js          — Vite config with concat-modules plugin + singlefile
e2e_test.py             — E2E test suite (216 tests, Playwright)
perf.py                 — performance profiler (6 scenarios, Playwright)
render.yaml             — Render.com deployment blueprint
AGENTS.md               — critical invariants (read first)
docs/FILE_MAP.md        — map of src/ modules and what lives where
PERF-R12.md             — performance optimization details
BUGS.md                 — bug hunt log
archive/                — historical session logs + removed features
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
- **Keep it single-file output** — source in `src/`, builds to single `dist/index.html`
