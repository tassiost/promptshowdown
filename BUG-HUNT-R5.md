# Bug Hunt R5 — Systems & Edge Cases Audit

Date: 2026-08-01

## Overview

Round 5 focused on less-tested game systems: replays, achievements, quests, arena progression, save import/export, comeback mechanic, keyboard shortcuts, composition bonuses, win prediction, and edge cases (empty loadout, all-spell picks, forge daily cap, quest claiming).

**Result: 0 bugs found.** All systems function correctly. Several initial "findings" were test-code errors (wrong field names, wrong element IDs, wrong date format, not playing full matches) rather than game bugs.

## Systems Tested

### Replay System — PASS

- After a full match (5 rounds), `G.save.replays` has 1 entry
- Replay structure: `date` (ISO string), `winner`, `rounds` (number, not array), `roundHistory` (array), `units`, `enemyUnits`, `mvp`, `arena`, `endlessLevel`, `difficulty`
- Replays screen (`G.replaysScreen()`) renders correctly
- Replays capped at 10 (via `unshift` + `slice(0,10)`)

### Achievement System — PASS

- `G.save.achievements` starts as `{}` (empty — no achievements unlocked yet)
- `checkAchievements()` called at every match end (line 9282)
- 23 achievement definitions in `G.achievements` (firstWin, win10, win25, level5, level10, rich, rich500, comeback, arenaMaster, roleMaster, firstForge, fullCustom, streak3, streak5, streak10, endless5, endless10, hardWin, collector, collector50, damageDealer, exterminator, spellmaster)
- Achievements screen (`G.achievementsScreen()`) renders 17299 chars — all definitions shown with locked/unlocked status and progress
- Achievement checks use `G.save.matchWins` (not `G.save.wins`) — both are tracked correctly

### Quest System — PASS

- `G.save.quests.list` has 3 quests: `forge2`, `spell1`, `forge1`
- Quest progression works: `spell1` quest progressed from 0 to 1 after casting a spell in battle
- `Quests.claim(id)` works correctly:
  - Claiming completed quest: sets `claimed=true`, adds coins + XP
  - Claiming already-claimed quest: silently does nothing (no double reward)
  - Claiming incomplete quest: silently does nothing
  - Claiming non-existent quest: silently does nothing
- Quests modal (`G.showQuests()`) renders as overlay with progress bars and claim buttons

### Arena Progression — PASS

- 4 arenas: Training Yard (0 wins), District Z (3 wins), Golden Goal (8 wins), Void Rift (15 wins)
- Arena names use field `n` (e.g., `arenas[0].n = "Training Yard"`)
- Arena advancement: when `matchWins >= nextArena.unlock`, `save.arena` increments
- Each arena has `maxHp`, `maxDmg`, `mechanic`, `botPool`, `bgTheme`
- Endless mode: after clearing all arenas (Void Rift), `save.endlessLevel` increments each win

### Save Import/Export — PASS

- `G.importSave()` uses `prompt()` for save code input, requires "PSV4:" prefix
- Save code format: `PSV4:` + base64(JSON.stringify(save))
- Import runs `migrateSave(data)` before assigning to `G.save`
- `showConfirm` dialog asks for confirmation before overwriting
- After import: coins, matchWins, loadout, collection all correctly set
- Invalid save codes (non-PSV4, invalid JSON, null) handled gracefully with toast messages

### Save Migration — PASS

- `G.save.version` = 12 (current)
- All required fields present after init: version, coins, xp, arena, wins, loadout, collection, spellbook, quests, achievements, ranked, settings, presets, replays
- `migrateSave()` called during import to handle old save formats

### Comeback Mechanic — PASS

- `Match.comebackEligible()` returns true if player lost the last round
- When eligible, `drawCount` = 4 (instead of 3) — player gets 4 card picks
- Comeback banner (`#comebackBanner`) shows "⭐ COMEBACK BONUS — 4th draw!" with `display:block`
- All 4 picks work correctly (`drawIndex` increments 0→1→2→3→4)
- Comeback achievement (`comeback`) checks: won match after losing round 1

### Keyboard Shortcuts — PASS

| Key | Action | Status |
|-----|--------|--------|
| Space | Manual tick (advance one frame) | PASS — `G.tick()` called |
| P | Toggle pause | PASS — `Battle.paused` toggles true/false |
| 1 | Speed 1x | PASS — `Battle.speed=1` |
| 2 | Speed 2x | PASS — `Battle.speed=2` |
| 3 | Speed 4x | PASS — `Battle.speed=4` (exponential steps: 1x, 2x, 4x) |
| S | Skip battle | PASS — screen changes from battle to result |
| D | Toggle debug logging | PASS — `Battle.debug` toggles |
| R | Reroll (draft screen) | PASS — clicks reroll button |
| 1/2/3 (draft) | Pick card 1/2/3 | PASS — clicks corresponding card |

### Composition Bonuses — PASS

- `#compBonus` element renders during both draft and battle
- Shows role-based bonuses (e.g., "+5% SPD (counter)")
- Display:block with formatted HTML content

### Win Prediction — PASS (by design)

- `#winPrediction` element only renders when both `playerUnits` and `enemyUnits` have non-spell units
- `opponentPicks` is only set in P2P/scout mode, not quick match
- Win prediction correctly absent in quick match (no opponent picks to compare against)

### Edge Cases — PASS

| Case | Result |
|------|--------|
| Empty loadout | Fallback to base units — 1 card offered (pool limited by unique names) |
| All spell picks | Safety fallback adds 1 unit — battle starts with 1 player unit |
| Forge daily cap (10/day) | Enforced correctly with `Quests.todayStr()` date format |
| Forge with XSS prompt | Name sanitized in `unit()` (angle brackets stripped, quotes replaced) |
| Forge with long name | Name truncated to 20 chars in `unit()` |
| Canvas resize during battle | Stable at 420x800, no errors |
| Quest claim (already claimed) | Silently does nothing — no double reward |
| Quest claim (incomplete) | Silently does nothing |
| Quest claim (non-existent) | Silently does nothing |

### All Screens Render — PASS

| Screen | Function | HTML Length |
|--------|----------|-------------|
| Menu | `G.menu()` | 4667 |
| Draft | `G.quickMatch()` | — |
| Battle | `G.startBattle()` | — |
| Result | (after battle) | — |
| Forge | `G.forge()` | — |
| Deck | `G.deck()` | 11366 |
| Shop | `G.shop()` | 1357 |
| Codex | `G.codex()` | 7964 |
| Settings | `G.showSettings()` | 4138 |
| Stats | `G.stats()` | 3467 |
| Profile | `G.profile()` | 4451 |
| Tier List | `G.tierList()` | 10529 |
| Replays | `G.replaysScreen()` | 297 |
| Achievements | `G.achievementsScreen()` | 17299 |
| Quests | `G.showQuests()` | 1930 (modal overlay) |

### Battle UI Elements — PASS

| Element | Status |
|---------|--------|
| Unit inspector | Shows on click (display:block, unit name + stats) |
| Kill feed | Populates on kills, fades over 6 seconds, hides when empty |
| Battle stats | Hidden during battle, shows after match |
| Round history bar | Empty in round 1, populates in later rounds |
| Speed button | Cycles through 1x/2x/4x, updates `Battle.speed` |
| Spell bar | Renders with cooldown overlays |

## Console Errors

**0 errors, 0 warnings** across all tests (excluding expected WebGPU fallback warning).

## Test Environment Notes

- Viewport: 420x800 (mobile portrait)
- Headless Chromium
- WebGPU not available — forge uses template fallback (expected)
- `requestAnimationFrame` throttled in headless — battles take longer but complete
- Module-scoped functions (`saveData`, `showConfirm`, `migrateSave`) not accessible via `page.evaluate()` — must interact via UI or `G.*` methods
