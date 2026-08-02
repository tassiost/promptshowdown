# AGENTS.md — Prompt Showdown

Single-file AI auto-battler (`index.html`, ~13K lines). No build step, no dependencies.
Serve over HTTP: `python3 -m http.server 8765` → `http://localhost:8765/index.html`

## How to Run

- **Play**: `python3 -m http.server 8765` then open in Chrome/Edge
- **E2E tests**: Use the `/test` skill (184 tests, ~60s)
- **Performance**: Use the `/perf` skill (5 scenarios, ~60s)
- **Bug hunt**: Use the `/bughunt` skill (static analysis + E2E)

## Critical Rules (Never Break These)

1. **Unit names sanitized at creation** in `unit()` — strip `<>`, replace `"` with `'`,
   truncate to 20 chars. Never bypass. Use `textContent` for raw names.

2. **Save import must run migration** — `importSave()` calls `migrateSave(data)` before
   assigning to `this.save`. Without it, old saves crash on missing fields.

3. **Continuous draft: never filter survivors by `u.h>0`** — dead units carry over and
   revive to full HP. `onBattleEnd` stores ALL units from `Battle._finalUnits`.

4. **Movement dead zone must be within attack range** — any movement behavior with a
   "stand still" zone must ensure that zone's upper bound <= `u.r`. Otherwise units stall.

5. **All HP reductions must set `u.lastAttacker`** — melee, projectiles, splash, thorns,
   poison. Without it: ramp bonus, on_kill, MVP, kill stats all break.

6. **Spell targets must be filtered by team** — ally targets filter to allies, all others
   default to enemies. Never leave a target type unfiltered.

7. **`sanitizeSpell()` for all untrusted spells** — P2P, URL import, save import. Validates
   enums, clamps numerics, sanitizes name. Returns `null` for invalid.

8. **P2P guest must not run authoritative logic** — guest doesn't call `Match.onRoundEnd`
   or `Match.onMatchEnd`. These come from host messages. Guest `onBattleEnd` returns early.

9. **Never re-create `#cv` canvas** — single shared canvas, only reparent between draft
   and battle via `G.screen()`. `Battle.start` re-initializes context after reparenting.

10. **Never allocate in hot paths** — use index loops (`for(let i=0;...)` not `for...of`),
    pooled objects, reusable arrays, squared distance checks. See `/render-rules` skill.

## Skills (Invoke for Detailed Knowledge)

- **`/coding-workflow`** — Full dev workflow: quick start, verification, commit style (auto-invoked)
- **`/battle-rules`** — Battle system: movement, abilities, spells, kill attribution,
  targeting, avoidance, weapons, draft system
- **`/system-rules`** — P2P sync, save/import, security, forge, init, PWA, audio, quests
- **`/render-rules`** — Sprite rendering, canvas, performance optimization, hot paths
- **`/test`** — Run E2E test suite (184 tests)
- **`/perf`** — Run performance profiler (5 scenarios)
- **`/bughunt`** — Static analysis + E2E bug hunt workflow

## Documentation

- **[docs/FILE_MAP.md](docs/FILE_MAP.md)** — Line-by-line map of index.html (where everything lives)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system architecture
- **[PERF-R12.md](PERF-R12.md)** — Performance optimization details (90 optimizations)
- **[BUGS.md](BUGS.md)** — Bug hunt log (213 bugs found and fixed)
- **[archive/](archive/)** — Historical session logs (BUG-HUNT-R*, OVERNIGHT*, PLAN-TIER*)

## Code Style

- Vanilla JS, no framework, no bundler, no build step
- Single file (`index.html`) — HTML + CSS + JS inline
- Compact code style — short variable names in hot paths (`u`, `c`, `dt`, `r`)
- Comments use `//` prefix, marked with phase/bug IDs for traceability
- Commit messages: `AREA: description` (e.g., `PERF-R12: Batch shadow paths`)
