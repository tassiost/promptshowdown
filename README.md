# Prompt Showdown

An AI-forged auto-battler with P2P multiplayer, progression, and a procedural unit forge. Source is split into `src/` modules and bundled to a single self-contained `dist/index.html` via Vite.

## Play locally

### Dev server (with HMR)

```bash
npm run dev
# then visit http://localhost:5173
```

### Built version (single file)

```bash
npm run build
cd dist && python3 -m http.server 8765
# then visit http://localhost:8765/index.html
```

## Features

- **AI Forge** — generates custom units from text prompts via a local LLM (Qwen2.5-1.5B, runs in-browser via WebLLM/WebGPU). Per-field micro-prompts with accumulating context produce creative, coherent units. 24 fields including 21 abilities, 28 body plans, 14 weapons, 7 roles, 13 targeting options, 8 movement types, and 7 visual modifier categories. Falls back to archetype templates when WebGPU is unavailable.
- **Draft system** — rarity-weighted unit pool (70% common / 25% rare / 5% legendary), 3 rerolls per match, comeback bonus (4th draw after a loss). 30% chance to draft spells from your spellbook.
- **Auto-battle** — projectiles, crits, status effects (poison / slow / stun), 21 abilities (splash / heal / dodge / poison / explode / shield / spawn / lifesteal / rage / slow / ramp / thorns / blink_strike / frenzy / regen / cleanse / taunt / executioner / chain_lightning / heal_burst / none), collision separation, skeletal sprite animations
- **Manual spell casting** — spell bar UI below the battle canvas lets you tap to cast spells during battle. Each spell has a power-based cooldown (3-10s). Auto-fire triggers still work alongside manual casting.
- **Behaviour Composition API** — 5 composable enums (targeting, movement, attackCondition, abilityTrigger, role) create diverse unit AI without scripting
- **Progression** — XP, player levels, coins, unit upgrades (+10% HP/DMG per level), fusion (2 duplicates → +1 level), 4 arenas with increasing difficulty + endless mode
- **P2P multiplayer** — host-authoritative sync at 20Hz via Trystero (WebTorrent signalling, no server needed). Full flow: matchmaking → draft → scout → battle → results
- **Sprite system** — 28 body plans (humanoid, quadruped, dragon, serpent, bird, insect, crab, golem, ghost, fish, blob, flying, mechanical, structure, plant, undead, demon, beast-man, aquatic, monopod, centaur, hydra, elemental, aberration, ooze, crystal, construct, angel), 14 weapons, skeletal joints with animation (arm_raise, leg_swing, bow_draw, tail_wag, wing_flap), 7 visual modifier categories (head, back, tail, aura, eyes, pattern, weapon style), role-coded fallbacks
- **Unit explanations** — detailed descriptions for all abilities, movement types, targeting options, ability triggers, and weapons. Unit detail modal shows full breakdown.
- **Clean modern UI** — purple/gold Draft Showdown-style palette, radial gradient backgrounds, gradient cards with glow effects, bolder typography with text shadows, screen transitions, button tooltips (hover/long-press), fixed back button (top-left) + fullscreen (top-right)
- **Deck builder** — 4-card loadout with 3 interaction patterns: tap slot then tap unit, drag units onto slots, or tap unit for slot picker popup. Synergy meter analyzes role balance. Collection search, filter, and sort. Fusion (2 duplicates → +1 level).
- **Mobile-friendly** — 60 FPS on all devices (50v50 with combat uses only 2.45ms CPU = 15% of frame budget), tap-to-tick, vibration feedback, fullscreen, pause-on-hidden
- **Resilient** — visible error panel, save backup + crash recovery, version migrations, PWA manifest, IndexedDB fallback for localStorage quota
- **Secure** — unit names sanitized at creation to prevent XSS, forge daily cap (10/day), save import runs migration

## Quick start

1. Run `npm run dev` (or `npm run build && cd dist && python3 -m http.server 8765`)
2. Open the URL in Chrome/Edge (WebGPU needed for AI forge)
3. Click **FIGHT** to play vs bot, or open two tabs and both click **FIGHT** for P2P multiplayer
4. Click **FORGE** to generate custom units from text prompts (e.g. "ice mage", "fire dragon")

## Deploy to Render.com

This repo includes a `render.yaml` blueprint so Render auto-creates the service on connect.

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. Go to **https://dashboard.render.com** → **New** → **Blueprint**.
3. Select this repository. Render reads `render.yaml` and creates a **Static Site**.
4. Click **Apply**. Wait ~30s, then open the assigned URL.

### Option B — Manual static site

1. **https://dashboard.render.com** → **New** → **Static Site**.
2. Connect your GitHub account and select this repo.
3. Fill in: **Name**: `prompt-showdown`, **Build Command**: *(empty)*, **Publish Directory**: `.`, **Plan**: Free.
4. Click **Create Static Site**. Done.

### Notes

- **WebGPU / AI Forge**: The LLM forge only activates in browsers with WebGPU (Chrome/Edge desktop). On unsupported browsers (Safari, Firefox, mobile) the game uses template-based forge — no action needed.
- **P2P multiplayer**: Uses WebTorrent trackers via Trystero. Works from any HTTPS origin. Open the same room ID in two browser tabs/devices.
- **Free tier**: Render free static sites sleep after inactivity and wake on first request (~15s cold start).

## Project structure

```
index.html          # root HTML (Vite entry point, references src/main.js)
src/
  index.html        # HTML template (body structure)
  style.css         # all CSS
  main.js           # entry point (INCLUDE directives concat all modules)
  imports.js        # dynamic imports (web-llm, trystero, lz-string)
  forge.js          # LLM forge, recipe assembler, visual modifiers
  generated_units.js # LLM-forged units added to base roster
  battle.js         # battle object, spells, combat, sim
  rendering.js      # sprite rendering, procedural FX, audio
  ui.js             # UI screens, deck builder, forge UI, tooltips
  game.js           # G object, init, PWA, event handlers
  ...               # (utils, save, network, match, quests, bot, etc.)
vendor/
  core.mjs          # trystero P2P core (vendored from esm.sh)
  torrent.mjs       # trystero torrent signaling (vendored from esm.sh)
  lz-string.mjs     # LZ-string compression for P2P payloads (vendored from esm.sh)
vite.config.js      # Vite config with concat-modules plugin + singlefile
render.yaml         # Render.com blueprint
archive/            # removed features archived for reuse
README.md           # this file
ARCHITECTURE.md     # full system architecture documentation
CONTRIBUTING.md     # development setup and conventions
PLAN.md             # development roadmap and phase tracking
```

## Tech

- Vanilla JS (ES modules, no framework) — bundled to single file via Vite
- [Vite](https://vitejs.dev/) + `vite-plugin-singlefile` for bundling
- [web-llm](https://github.com/mlc-ai/web-llm) + Qwen2.5-1.5B for in-browser LLM unit generation
- [@trystero-p2p/torrent](https://github.com/dmotz/trystero) v0.25.3 for serverless P2P (vendored locally)
- [lz-string](https://github.com/pieroxy/lz-string) for P2P payload compression (vendored locally)
- Canvas 2D for rendering
- `localStorage` for saves (with backup + migration + IndexedDB fallback)
- IndexedDB for LLM model cache

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — full system architecture: game objects, screens, LLM generation, P2P protocol, battle system, sprite rendering, progression
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — development setup, code conventions, testing, commit style
- **[PLAN.md](PLAN.md)** — development roadmap with phase tracking (all phases complete)
- **[AGENTS.md](AGENTS.md)** — engineering notes: rules for battle system, P2P, sprites, performance, and all gotchas
- **[GAPS.md](GAPS.md)** — feature gap analysis vs. similar games (what's still missing)
- **[ISSUES.md](ISSUES.md)** — known issues & fix log
- **[FEEDBACK.md](FEEDBACK.md)** — user feedback & response log
- **[BUGS.md](BUGS.md)** — bug hunt log (180+ bugs found and fixed, 0 open)
- **[PERF-R12.md](PERF-R12.md)** — performance optimization: 90 optimizations, 60 FPS in all scenarios
- **[PERF-R13.md](PERF-R13.md)** — further performance optimizations (pooled env synth, etc.)
- **[OPTIMIZATION-R14.md](OPTIMIZATION-R14.md) through [OPTIMIZATION-R20.md](OPTIMIZATION-R20.md)** — ongoing audit, bug hunt, and optimization rounds
- **[NETRELAY.md](NETRELAY.md)** — host-authoritative relay plan (eliminate desync)
- **[RESEARCH.md](RESEARCH.md)** — autobattler research findings (reference projects)
- **[docs/FILE_MAP.md](docs/FILE_MAP.md)** — line-by-line map of source modules
