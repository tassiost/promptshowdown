# Contributing

## Development Setup

### Prerequisites

- Python 3 (for local HTTP server)
- Chrome or Edge (for WebGPU / AI forge testing)
- A modern browser for general testing

### Start local server

The game requires HTTP (not `file://`) for ES module imports, IndexedDB, and P2P:

```bash
python3 -m http.server 8765
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

### Single file

All game code lives in `index.html`. No build step, no bundler, no framework. Vanilla JS with ES modules.

### Code style

- **Compact vanilla JS** — no unnecessary verbosity, collapse duplicate branches
- **No comments unless non-obvious** — the code should be self-documenting
- **Match existing style** — look at neighboring code before writing new code
- **Use existing helpers** — `$(id)`, `setText(id, val)`, `R()` (random), `Q(min,max)` (random int), `cloneUnit(u)`, `shuffle(arr)`
- **No new dependencies** — if you need a library, vendor it in `vendor/` (download from esm.sh, fix import paths to be relative)

### CSS

- Use CSS variables defined in `:root` (lines 11-22)
- Use existing component classes (`.btn`, `.card`, `.pill`, `.detail`, `.group`)
- Avoid inline styles unless one-off positioning
- Prefer `var(--accent)` over hardcoded colors

### Adding a new screen

1. Add HTML in the screens section (lines 101-243):
```html
<div class="screen" id="myScreen">
<h2>My Screen</h2>
<div class="detail">Description</div>
<!-- content -->
<button class="btn" onclick="G.menu()">← Back</button>
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

### Adding a new unit ability

1. Add to `ENUM_FIELDS.ability` array (line 1083)
2. Add to `FIELD_PROMPTS.ability` description (line 1126)
3. Implement in `Battle.triggerAbility()` (lines 2200-2350)
4. Add FX in `BattleFX` if needed
5. Test via forge with a prompt that matches the ability

### Adding a new body plan

1. Add to `ENUM_FIELDS.bodyPlan` array (line 1088)
2. Add to `FIELD_PROMPTS.bodyPlan` description (line 1131)
3. Define shapes in the body plan templates (lines 700-800)
4. Add joints to `SpriteRenderer.JOINT_ANGLES` if new joints needed
5. Test via forge

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
- [ ] Menu renders with stats pills and buttons
- [ ] Forge screen loads (model downloads or template fallback works)
- [ ] Forge generates a unit with sprite preview
- [ ] Draft screen shows 3 cards with rarity borders
- [ ] Battle screen renders units on canvas
- [ ] Battle progresses when Tick/Auto is clicked
- [ ] Result screen shows after battle ends
- [ ] Deck screen shows loadout + collection
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
- **Keep it single-file** — all game code in `index.html`
