# Contributing

## Development Setup

### Prerequisites

- Node.js (for Vite dev server + build)
- Python 3 (for serving the built version)
- Chrome or Edge (for WebGPU / AI forge testing)
- A modern browser for general testing

### Dev server (with HMR)

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`.

### Built version (single file)

```bash
npm run build
cd dist && python3 -m http.server 8765
```

Visit `http://localhost:8765/index.html`.

### Testing P2P multiplayer

Open two browser tabs at `http://localhost:8765/index.html`. In both, go to the Lobby screen, use the same room ID, and click Host in one + Join in the other. WebRTC connection takes ~15-30s.

Alternatively, both tabs can click FIGHT (matchmaking) simultaneously. The 15s timeout falls back to bot match if no peer is found.

### Testing the AI forge

1. Open in Chrome/Edge (WebGPU required)
2. Click FORGE
3. First generation downloads the Qwen2.5-1.5B model (~1GB, cached in IndexedDB for future sessions)
4. Type a prompt (e.g., "ice mage", "fire dragon", "shadow assassin") and generate

To test with fresh generations (bypass cache), clear IndexedDB:
```javascript
indexedDB.deleteDatabase('promptshowdown_llm_cache_v8');
```

## Code Conventions

### Source structure

Game code is split into `src/` modules and concatenated via `// INCLUDE:` directives in `src/main.js`. Vite bundles everything into a single `dist/index.html`. Vanilla JS with ES modules, no framework.

### Code style

- **Compact vanilla JS** — no unnecessary verbosity, collapse duplicate branches
- **No comments unless non-obvious** — the code should be self-documenting
- **Match existing style** — look at neighboring code before writing new code
- **Use existing helpers** — `$(id)`, `setText(id, val)`, `R()` (random), `Q(min,max)` (random int), `cloneUnit(u)`, `shuffle(arr)`
- **No new dependencies** — if you need a library, vendor it in `vendor/` (download from esm.sh, fix import paths to be relative)

### CSS

- All CSS lives in `src/style.css` — use CSS variables defined in `:root` (purple/gold palette)
- Use existing component classes (`.btn`, `.card`, `.pill`, `.detail`, `.group`, `.spellBtn`)
- Avoid inline styles unless one-off positioning
- Prefer `var(--accent)` (purple) or `var(--gold)` over hardcoded colors

### Adding a new screen

1. Add HTML in the screens section (search for `<div class="screen"` in both `index.html` and `src/index.html`):
```html
<div class="screen" id="myScreen">
<h2>My Screen</h2>
<div class="detail">Description</div>
<!-- content -->
<!-- Note: no inline back button needed — the fixed #backBtn appears
     automatically for any screen not in the noBack list in screen() -->
</div>
```
2. Add navigation method to `G`:
```javascript
myScreen(){
  this.screen("myScreen");
  // render content
}
```
3. Add a button in the menu or relevant screen to navigate to it.
4. If the screen should NOT show the back button (e.g. fullscreen), add its id to the `noBack` array in `screen()`.

### Adding a new unit ability

1. Add to `ENUM_FIELDS.ability` array (currently 21 abilities)
2. Add to `FIELD_PROMPTS.ability` description
3. Add to `ABILITY_DESCRIPTIONS` map for UI display
4. Implement in `Battle.triggerAbility()` and/or `Battle.takeDamage()` (for passives)
5. Add FX in `BattleFX` if needed
6. Test via forge with a prompt that matches the ability

### Adding a new body plan

1. Add to `ENUM_FIELDS.bodyPlan` array (currently 28 body plans)
2. Add to `FIELD_PROMPTS.bodyPlan` description
3. Define shapes in `BODY_PLANS` (search for `const BODY_PLANS` in index.html)
4. Add joints to `SpriteRenderer.JOINT_ANGLES` if new joints needed
5. Test via forge

### Adding a new weapon

1. Add to `ENUM_FIELDS.weaponType` array (currently 14 weapons)
2. Add to `FIELD_PROMPTS.weaponType` description
3. Add to `WEAPON_DESCRIPTIONS` map
4. Define shape in `WEAPONS` map
5. Add color/FX to `WEAPON_COLOR` and `WEAPON_FX` maps
6. Test via forge

### Adding a new spell

1. Add spell spec to `SPELL_ENUM` (trigger, target, effect, shape, fxType)
2. Implement target resolution in `SPELL_TARGET`
3. Implement shape in `SPELL_SHAPE`
4. Implement effect in `SPELL_EFFECT`
5. Add to `Spell.checkTriggers` if new auto-fire trigger
6. Cooldown is auto-calculated by `Battle._spellCooldown()` based on effect power
7. Spell bar UI auto-renders from `Battle.playerSpells`

## Testing

### Browser testing

Use the Playwright MCP server (never chrome-devtools — it is forbidden on this project):

1. List tools: `mcp_list_tools` for `playwright`
2. Navigate: `browser_navigate` to `http://localhost:8765/index.html`
3. Evaluate JS: `browser_evaluate` to test game state
4. Screenshot: `browser_take_screenshot` to verify UI
5. Console: `browser_console_messages` to check for errors

### Smoke test checklist

- [ ] Page loads without console errors
- [ ] Menu renders with stats pills and buttons (tooltips on hover/long-press)
- [ ] Back button (top-left) + fullscreen (top-right) visible on non-menu screens
- [ ] Forge screen loads (model downloads or template fallback works)
- [ ] Forge generates a unit with sprite preview + ability descriptions
- [ ] Draft screen shows 3 cards with rarity borders (spells may appear 30% chance)
- [ ] Draft sprites match deck screen sprites (same recipe preserved)
- [ ] Battle screen renders units on canvas
- [ ] Spell bar shows below canvas if spells were drafted
- [ ] Spell buttons cast on tap with cooldown overlay
- [ ] Battle progresses when Tick/Auto is clicked
- [ ] Result screen shows after battle ends
- [ ] Deck screen: tap slot to select, tap unit to fill (or drag, or slot picker popup)
- [ ] Upgrade screen shows unit list with costs

### P2P test checklist

- [ ] Two tabs can connect via Lobby (Host/Join)
- [ ] Both tabs enter draft simultaneously
- [ ] Draft picks sync (each tab sees different cards)
- [ ] Scout shows opponent's actual picks
- [ ] Battle syncs at 20Hz (turn counter matches)
- [ ] Round end advances both tabs to result

## Git Conventions

### Commit format

```
Phase N: <one-line description>

<optional body explaining why, not what>

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
```

### Commit rules

- Focus on "why" not "what" in the commit message
- Check for sensitive info before committing
- Never commit if no changes exist
- Do NOT push unless explicitly asked
- Never update git config
- Never use `-i` flags (interactive mode not supported)

### Pre-commit

If pre-commit hooks modify files and the commit fails, stage the modified files and retry.

## LLM Rules

- **Never set `max_tokens`** on `chat.completions.create` — local inference is free
- **Never cap daily forges** — the forgeCount cap has been removed
- **Never add LLM timeouts** — the Cancel button is the only escape hatch
- **Prefer richer prompts and multi-call generation** over cramped single calls
- **Always clear the IndexedDB cache** when testing generation changes: `indexedDB.deleteDatabase('promptshowdown_llm_cache_v8')`

## Project Rules

- **Never use chrome-devtools MCP** — all browser testing goes through Playwright MCP
- **Never limit LLM usage** — inference is free (local WebLLM, no API costs)
- **No new npm dependencies** — vendor anything needed in `vendor/`
- **Keep it single-file output** — source is in `src/` but builds to a single `dist/index.html`
