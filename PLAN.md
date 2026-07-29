# Prompt Showdown v5 — Draft Showdown Integration Plan

Goal: reshape Prompt Showdown to mirror **Draft Showdown** (QuestLab) — a hybrid-casual PVP card-draft auto-battler — while keeping the existing single-file architecture, AI forge, and P2P multiplayer.

This doc lists every mechanic to add/change, mapped to the current code in `index.html`. Phased so each phase ships a playable build.

---

## Reference: What Draft Showdown Actually Does

- **Match = best-of-N rounds.** First player to lose all **lives** loses the match.
- **Each round = 3 draws × 3 picks.** Per round you draft 3 cards, picking 1-of-3 each time, building a 3-unit army for that round.
- **4th-draw comeback.** The player who *lost* the previous round gets an extra (4th) draw next round.
- **Persistent 4-card loadout.** Between matches you keep a 4-card deck; in-round drafts pull from this pool (with rerolls).
- **Auto-combat.** Once the horn sounds, units fight automatically; you're hands-off until the round ends.
- **Role-tagged units** — frontline tank / backline carry / support / counter / utility. Synergy > raw stats.
- **Scout the opponent** — tap opponent portrait to see their units/spells before committing.
- **Arenas** — themed ladders (District Z, Golden Goal). Progression gates.
- **No forced ads; optional reward ads.** (We have no ads — keep it that way.)
- **Match length: minutes, not hours.** Hybrid-casual pacing.

---

## Current State of `index.html` (v4)

| Area | Today | Draft Showdown parity |
|---|---|---|
| Match structure | 1 draft → 1 battle → result → forge/restart | Needs rounds + lives |
| Draft | 3 rows × 3 cards, 3 rerolls, pick 1 per row | Close — needs per-round cadence + 4th-draw |
| Deck | All owned units pooled | Needs fixed 4-card loadout |
| Units | 6 base + 4 enemies | Needs ~20+ with role tags |
| Roles | Implicit (range/abilities) | Needs explicit `role` field |
| Opponent scout | None | Needs pre-battle reveal |
| Arenas | None | Needs arena ladder |
| Comeback | None | Needs 4th-draw on round loss |
| Lives | None | Needs lives counter per match |
| AI forge | Yes (procedural + web-llm fallback, web-llm never loads) | **Remove** — fixed curated roster only |
| P2P | Host-authoritative 20Hz snapshots | Keep — extend protocol for rounds/lives |
| Progression | XP/coins/upgrades/fusion/achievements | Keep — extend with arena unlocks |

---

## Phase 8 — Match & Lives System

**Why first:** everything else (rounds, comeback, scout) depends on a match arc.

### Changes
- New `Match` object (sibling of `Battle`) owning: `livesPlayer`, `livesEnemy`, `round`, `history[]`, `onMatchEnd`.
- Default lives = **3** per side (configurable per arena).
- `G.start()` now starts a **Match**, not a single battle. Match drives rounds.
- `onBattleEnd(winner)` → Match records round result, decrements loser's life, then either starts next round or fires `onMatchEnd`.
- Result screen branches: **round result** (mid-match) vs **match result** (final).
- Match result awards XP/coins (currently awarded per round — move to per-match to match Draft Showdown's pacing).

### Code touchpoints
- New `Match` object near `Battle` (line ~488).
- `G.start()` (line ~878) → `Match.start()`.
- `G.onBattleEnd` (line ~1047) → delegates to `Match.onRoundEnd`.
- `G.roundEnd` (line ~1067) → split into `roundResult` / `matchResult`.
- New HUD: lives hearts (♡/♥) for both sides on battle + draft screens.

### Save migration
- Bump `CURRENT_VERSION` (v5 → v6). `migrateSave()` adds `matchWins`, `arena` fields.

---

## Phase 9 — Round-Based Draft Cadence

**Draft Showdown's signature:** 3 draws × 3 picks *per round*, plus 4th-draw comeback.

### Changes
- `G.start()` (per round) calls `startRoundDraft()` instead of the current single-shot draft.
- Each round: **3 sequential draws**. Each draw shows 3 cards, you pick 1. After 3 draws → army locked → battle.
- Track `roundDraftState = { drawIndex: 0, picks: [] }`.
- **4th-draw comeback:** if the player lost the previous round, `drawIndex` starts at -1 conceptually — they get 4 draws instead of 3. Same for the AI/opponent.
- Rerolls: keep at 3 per *match* (not per round) — adds cross-round resource management.
- Visual: progress dots "● ● ●" showing which draw you're on; 4th draw highlighted gold when active.

### Code touchpoints
- `G.start()` (line ~878) and `G.makeDraft()` (line ~899) — refactor into `drawOne()` callable 3-4× per round.
- `G.draftCard` onclick (line ~937) → advances to next draw instead of locking all 3 rows at once.
- `G.battle()` (line ~976) → triggered after final pick of the round.
- New `roundDraftState` field on `G` and on the multiplayer snapshot.

### Multiplayer
- Protocol extension: `round_start`, `round_end` messages. Host drives round cadence; guest gets `draw_index` in snapshots so its UI stays in sync.

---

## Phase 10 — Persistent 4-Card Loadout & Forge Removal

**Today:** `deckUnits()` returns *all* owned units (base + forged). Draft Showdown uses a fixed 4-card loadout per match from a curated roster.

**Decision: remove the AI/LLM forge entirely.** The web-llm package never loads (confirmed: `@mlc.ai/web-llm` is not on npm), and a Draft Showdown-style meta requires a *fixed, known* roster so synergy, counters, and role balance are learnable. AI-generated units with random stats break the counter system (Phase 11). The curated 12-unit roster from Phase 11 becomes the sole unit source.

### Changes
- New `save.loadout` = array of exactly 4 unit names (or fewer until filled).
- Draft pool per match = `save.loadout` resolved to unit objects (with upgrades applied).
- **Remove** `G.forge()`, `preloadAI()`, `initLLM()`, `validateAIUnit()`, `warmAICache()`, `aiCache`, the web-llm dynamic import, and the "FORGE" button/screen.
- **Remove** `save.ai` field (migrate: discard existing forged units — they're unbalanced relative to the new curated roster).
- The full curated roster (Phase 11) is always available as the "collection" — no forging, no unlocking individual units. Progression is via **upgrades + arena unlocks** instead.
- Default loadout on migrate: first 4 base units (Knight, Archer, Slash, Priest).
- Deck screen redesign: 4 slot row at top (the loadout) + scrollable roster below; tap roster card to swap into a slot.
- Validation: loadout can have duplicate names (Draft Showdown allows stacking — e.g. 4× Merlin).

### Code touchpoints
- `G.deckUnits()` (line ~874) → returns `save.loadout` resolved, not the whole pool.
- `G.deck()` screen — rewrite to loadout + roster layout.
- **Delete** `G.forge()` (line ~1134) and the forge screen markup.
- **Delete** `preloadAI()` / `initLLM()` / `validateAIUnit()` / `aiCache` (lines ~380-400 region and `preloadAI` definition).
- **Delete** the web-llm dynamic import block.
- Fusion (line ~1260 region) — keep, but operates on roster units (fuse duplicates of the same curated unit to level it up).
- `migrateSave()`: drop `save.ai`; build default `save.loadout` from `save.deck` (first 4).

### Balance implication
- With only 4 cards in the pool, drafts become about *which of your 4* to pick each round, not *which of 20*. Closer to Draft Showdown's feel. Rerolls re-roll the offering within the 4-card pool (with rarity weighting preserved).

---

## Phase 11 — Role Tags & Expanded Roster

**Today:** 6 base units, 4 enemies, implicit roles. Draft Showdown ships ~25 units with explicit roles.

### Changes
- Add `role` field to every unit: `"frontline" | "carry" | "support" | "counter" | "utility"`.
- Expand `G.base` to **12 units** covering all roles (mirroring Draft Showdown archetypes, renamed to avoid trademark issues):

| Role | Units to add (working names) |
|---|---|
| Frontline | Knight (keep), **Bulwark** (Spartheus analog), **Thornwall** (Bloodvine analog) |
| Carry | Archer (keep), **Merlin** (Merlinor analog), **Overcore** (Overmind analog) |
| Support | Priest (keep), **Engineer** (spawns temporary machines), **Totem** (heal/buff aura) |
| Counter | Assassin (keep), **Sniper** (long-range backline diver), **Waster** (stun, anti-Shellbro) |
| Utility | Slash (keep), **Goose** (early tempo, falls off), **TNT** (explosive AoE) |

- Expand `G.enemy` to **8 types** so solo play stays varied.
- ~~AI forge prompt updated to emit `role` field~~ — **forge removed in Phase 10**. All roster units are hand-authored with `role` set.
- Draft cards show a role icon/tag (🛡️ / 🎯 / ✨ / ⚔️ / 🛠️) so synergy is readable.

### Code touchpoints
- `G.base` (line ~809) and `G.enemy` (line ~817) — expand.
- `unit()` factory — accept/normalize `role`.
- `validateAIUnit()` (line ~386) — add role check.
- `G.draftCard()` (line ~928) — render role tag.
- CSS: add `.role-frontline` etc. color accents.

### New ability: `spawn` (for Engineer)
- Engineer's signature: periodically spawns a disposable machine unit with low HP that blocks and deals minor damage. Machines despawn after N seconds (mirrors Draft Showdown's Engineer nerf).
- Add to `Battle.update()` — owner unit with `ab:"spawn"` ticks a spawner cooldown.

---

## Phase 12 — Opponent Scout

**Draft Showdown's "Know Your Enemy" update:** tap opponent portrait to see their units.

### Changes
- Pre-battle (after draft, before horn): show opponent portrait card. Tap reveals their 3 picked units for the round with stats.
- In solo: opponent = AI's drafted picks (generate via `rollOne` from a synthetic AI loadout).
- In P2P: host already knows guest's deck; broadcast `opponent_picks` to guest at round start (after both locked in).
- Adds a strategic layer: if you see enemy Assassin, you know to protect your carry.

### Code touchpoints
- New "scout" sub-screen between draft and battle (or a tappable badge on the battle screen).
- `G.battle()` (line ~976) — generate/receive opponent picks, store on `Match`, render scout UI.
- Multiplayer: new `opponent_picks` message in `networkReceive` (line ~450).

---

## Phase 13 — Arena Ladder

**Today:** no progression gate. Draft Showdown has arenas (District Z, Golden Goal).

### Changes
- `save.arena` = index into an arenas array. Each arena: name, theme color, enemy pool, lives config, unlock threshold (matchWins).
- Arenas (working names, trademark-safe):
  1. **Training Yard** (default, 3 lives, easy enemies)
  2. **District Z** (undead theme, 3 lives, poison-heavy enemies)
  3. **Golden Goal Arena** (3 lives, balanced hard enemies — the "ultimate showdown")
  4. **Void Rift** (post-game, 4 lives, all roles represented)
- Menu shows current arena + "Next arena: X wins to unlock".
- Winning a match in the top arena awards a bonus coin cache (forge is gone — no unit-creation reward).
- Losing a match in a non-default arena can drop you down (optional — start non-punitive).

### Code touchpoints
- New `arenas` array near `G.base`.
- `G.battle()` (line ~976) — pull enemy pool from current arena instead of flat `this.enemy`.
- `G.menu()` — render arena badge + unlock progress.
- `migrateSave()` — default `save.arena=0`.

---

## Phase 14 — Synergy Hints & Pre-Match Strategy

Quality-of-life to teach the meta (Draft Showdown's guides emphasize this is the real skill).

### Changes
- On the loadout screen, show a **synergy meter**: counts roles in your 4-card loadout and warns if unbalanced (e.g. "⚠ No frontline — backline will be exposed").
- During draft, highlight picks that fill a missing role in your current round army.
- Post-match: show a one-line "why you lost" hint (e.g. "Your carry died before frontline — consider Bulwark").

### Code touchpoints
- `G.deck()` — add synergy meter widget.
- `G.draftCard()` (line ~928) — role-fill highlight.
- `Match.onRoundEnd` — generate hint from unit death order (track in `Battle`).

---

## Phase 15 — Multiplayer Protocol Extension

Pulls together phases 8-12 for P2P.

### New message types (added to `networkReceive`, line ~450)
- `match_start` — host → guest: arena, lives, who goes first.
- `round_start` — host → guest: draw_index (3 or 4 if comeback), your loadout snapshot.
- `opponent_picks` — host → guest: host's locked picks for the round (after both locked).
- `round_end` — host → guest: round winner, updated lives, next draw_index.
- `match_end` — host → guest: final winner, rewards.

### Snapshot extension
- Existing `snap` (line ~1033) already sends full battle state — keep. Add `round`, `livesPlayer`, `livesEnemy`, `drawIndex` to the snapshot envelope so guest HUD stays in sync.

### Guest flow
- Guest drafts locally (3-4 draws), sends `deck` per round (rename to `round_deck`), waits for `opponent_picks` + `snap` stream. After round end, guest shows round result, then either drafts again (next round) or sees match result.

---

## Phase 16 — Polish & Balance

- **Match pacing:** target 90-120s per match (3-5 rounds). Tune unit HP/DMG if rounds drag.
- **4th-draw feel:** the extra draw should be visibly exciting — gold glow, "COMEBACK" banner.
- **Arena transitions:** short toast + theme color shift on arena change.
- **Role color coding** consistent across draft / battle / scout / deck.
- **Achievements extension:** add "Comeback King" (win a match after losing round 1), "Arena Master" (unlock all arenas), "Role Master" (win with each role as the last unit standing). Remove "AI Smith" (forge5) since the forge is gone.
- **Mobile:** verify lives HUD, 4th-draw banner, and scout screen fit on small viewports (canvas is already responsive).

---

## Implementation Order & Dependencies

```
Phase 8  (Match & Lives)        ──┐
Phase 9  (Round draft cadence)  ──┼─→ Phase 12 (Scout) ──→ Phase 15 (MP protocol)
Phase 10 (4-card loadout)       ──┘
Phase 11 (Roles + roster)       ──→ Phase 14 (Synergy hints)
Phase 13 (Arenas)               ──→ Phase 16 (Polish)
```

- Phases 8, 9, 10, 11 can be developed in parallel after the save-migration skeleton lands.
- Phase 12 depends on 8 + 9 (need rounds + opponent picks to scout).
- Phase 15 depends on 8, 9, 12 (protocol wraps the new flow).
- Phase 13 can land any time after 8 (arenas are just a themed wrapper around Match).
- Phase 14 depends on 11 (needs role tags).
- Phase 16 is the final polish pass.

Recommended ship order: **8 → 10 → 9 → 11 → 13 → 12 → 14 → 15 → 16**.

---

## Save Migration (v5 → v6)

`migrateSave()` additions:
```js
// v6: match/arena/loadout; forge removed
if (!save.version || save.version < 6) {
  delete save.ai;                            // forged units discarded (unbalanced vs new roster)
  save.loadout = (save.deck || baseNames).slice(0, 4);
  while (save.loadout.length < 4) save.loadout.push(baseNames[save.loadout.length % baseNames.length]);
  save.arena = 0;
  save.matchWins = 0;
  // achievements: drop forge5 since forge is gone
  if (save.achievements) delete save.achievements.forge5;
  save.version = 6;
}
```

---

## What Stays From v4

- Single-file `index.html` architecture.
- `Battle` object + combat simulation (projectiles, crits, status effects, abilities).
- ~~AI forge (procedural + optional web-llm)~~ — **removed in Phase 10**.
- Host-authoritative P2P over trystero.
- XP / coins / upgrades / fusion / achievements.
- Mobile polish (adaptive FPS, pause-on-hidden, vibration, fullscreen, PWA manifest).
- Error panel + crash-wrapped init.

---

## Open Questions (resolve before Phase 8)

1. **Lives count:** 3 (Draft Showdown default) or configurable per arena? → Plan assumes 3, arena-configurable in Phase 13.
2. **Loadout duplicates:** allow 4× same unit (Draft Showdown does)? → Plan assumes yes.
3. **Loss drop-down in arenas:** punitive ladder or just unlock-gated? → Plan starts non-punitive; revisit in Phase 16.
4. **AI opponent loadout:** synthetic 4-card pool per arena, or pull from player's collection? → Plan: synthetic per-arena pool, themed by arena.
5. **Match rewards:** per-match only, or small per-round consolation XP? → Plan: per-match, with a tiny (5 XP) round-loss consolation to soften comebacks.
