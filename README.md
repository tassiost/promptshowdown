# Prompt Showdown

An AI-forged auto-battler with P2P multiplayer, progression, and a procedural unit forge. Single self-contained `index.html` — no build step, no dependencies to install.

## Play locally

Open `index.html` in a modern browser. For full functionality (ES module imports + P2P) serve it over HTTP:

```bash
python3 -m http.server 8765
# then visit http://localhost:8765/index.html
```

## Features

- **AI Forge** — generates custom units from text prompts via a local LLM (Qwen2.5-1.5B, runs in-browser via WebLLM/WebGPU). Per-field micro-prompts with accumulating context produce creative, coherent units. 24 fields including 21 abilities, 28 body plans, 14 weapons, 7 roles, 13 targeting options, 8 movement types, and 7 visual modifier categories. Falls back to archetype templates when WebGPU is unavailable.
- **Draft system** — rarity-weighted unit pool (70% common / 25% rare / 5% legendary), 3 rerolls per match, comeback bonus (4th draw after a loss). 30% chance to draft spells from your spellbook.
- **Auto-battle** — projectiles, crits, status effects (poison / slow / stun), 21 abilities (splash / heal / dodge / poison / explode / shield / spawn / lifesteal / rage / slow / ramp / thorns / blink_strike / frenzy / regen / cleanse / taunt / executioner / chain_lightning / heal_burst / none), collision separation, skeletal sprite animations
- **Manual spell casting** — spell bar UI below the battle canvas lets you tap to cast spells during battle. Each spell has a power-based cooldown (3-10s). Auto-fire triggers still work alongside manual casting.
- **Behaviour Composition API** — 5 composable enums (targeting, movement, attackCondition, abilityTrigger, role) create diverse unit AI without scripting
- **Progression** — XP, player levels, coins, unit upgrades (+10% HP/DMG per level), fusion (2 duplicates → +1 level), 6 arenas with increasing difficulty
- **P2P multiplayer** — host-authoritative sync at 20Hz via Trystero (WebTorrent signalling, no server needed). Full flow: matchmaking → draft → scout → battle → results
- **Sprite system** — 28 body plans (humanoid, quadruped, dragon, serpent, bird, insect, crab, golem, ghost, fish, blob, flying, mechanical, structure, plant, undead, demon, beast-man, aquatic, monopod, centaur, hydra, elemental, aberration, ooze, crystal, construct, angel), 14 weapons, skeletal joints with animation (arm_raise, leg_swing, bow_draw, tail_wag, wing_flap), 7 visual modifier categories (head, back, tail, aura, eyes, pattern, weapon style), role-coded fallbacks
- **Unit explanations** — detailed descriptions for all abilities, movement types, targeting options, ability triggers, and weapons. Unit detail modal shows full breakdown.
- **Clean modern UI** — purple/gold Draft Showdown-style palette, radial gradient backgrounds, gradient cards with glow effects, bolder typography with text shadows, screen transitions
- **Mobile-friendly** — 60 FPS on all devices (50v50 with combat uses only 2.45ms CPU = 15% of frame budget), tap-to-tick, vibration feedback, fullscreen, pause-on-hidden
- **Resilient** — visible error panel, save backup + crash recovery, version migrations, PWA manifest, IndexedDB fallback for localStorage quota
- **Secure** — unit names sanitized at creation to prevent XSS, forge daily cap (10/day), save import runs migration

## Quick start

1. Start a local server: `python3 -m http.server 8765`
2. Open `http://localhost:8765/index.html` in Chrome/Edge (WebGPU needed for AI forge)
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
index.html          # the entire game (HTML + CSS + JS in one file, ~9900 lines)
vendor/
  core.mjs          # trystero P2P core (vendored from esm.sh)
  torrent.mjs       # trystero torrent signaling (vendored from esm.sh)
  lz-string.mjs     # LZ-string compression for P2P payloads (vendored from esm.sh)
render.yaml         # Render.com blueprint
README.md           # this file
ARCHITECTURE.md     # full system architecture documentation
CONTRIBUTING.md     # development setup and conventions
PLAN.md             # development roadmap and phase tracking
```

## Tech

- Vanilla JS (ES modules, no framework, no bundler)
- [web-llm](https://github.com/mlc-ai/web-llm) + Qwen2.5-1.5B for in-browser LLM unit generation
- [@trystero-p2p/torrent](https://github.com/dmotz/trystero) v0.25.3 for serverless P2P (vendored locally)
- [lz-string](https://github.com/pieroxy/lz-string) for P2P payload compression (vendored locally)
- Canvas 2D for rendering
- `localStorage` for saves (with backup + migration + IndexedDB fallback)
- IndexedDB for LLM generation cache

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — full system architecture: game objects, screens, LLM generation, P2P protocol, battle system, sprite rendering, progression
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — development setup, code conventions, testing, commit style
- **[PLAN.md](PLAN.md)** — development roadmap with phase tracking
- **[AGENTS.md](AGENTS.md)** — engineering notes: rules for battle system, P2P, sprites, performance, and all gotchas
- **[PERF-R12.md](PERF-R12.md)** — performance optimization: 90 optimizations, 60 FPS in all scenarios, CPU/GPU/memory stats
