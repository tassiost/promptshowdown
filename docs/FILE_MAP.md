# File Map — src/ Modules

Source is split into `src/` modules, concatenated via `// INCLUDE:` directives
in `src/main.js`, and bundled to a single `dist/index.html` via Vite. This map
shows what lives where so you can jump to the right file.

## Module Load Order (src/main.js)

```
src/main.js              entry point — INCLUDE directives inline all modules
  ├── imports.js         dynamic imports (web-llm, trystero, lz-string)
  ├── utils.js           DMath, rand, fnv1aHash, toast, mobile, i18n, ads
  ├── save.js            loadData, saveData, migrateSave, IndexedDB fallback
  ├── forge.js           unit() factory, cloneUnit, LLM forge, RecipeAssembler
  ├── network.js         P2P (trystero), heartbeat, signing, transmit, desync
  ├── battle-helpers.js  Behaviour API, avoidance, targeting, movement
  ├── match.js           Match object (lives, rounds, history, comeback)
  ├── rendering.js       SpriteRenderer, procedural FX, GameAudio
  ├── battle.js          Battle object, spells, combat, sim, lockstep
  ├── quests.js          Daily quests, login streaks
  ├── bot.js             Bot opponent + strategy
  ├── ui.js              UI screens, deck builder, forge UI, tooltips
  ├── generated_units.js LLM-forged units added to base roster
  └── game.js            G object, init, PWA, event handlers
```

## File Details

### src/forge.js (~2048 lines)
- `unit(x)` — unit factory (line 9): sanitizes names, clamps stats, builds recipes
- `cloneUnit(u)` — deep clone via `unit(deepClone(u))` (line 84)
- `$()`, `setText()`, `setStyle()` — DOM helpers (line 87+)
- LLM model init: `initLLM()`, `cancelLLM()`, model selection (mobile vs desktop)
- `FIELD_LABELS`, `FIELD_PROMPTS` — per-field micro-prompts for LLM generation
- `validateUnit()` — schema validation for LLM output (line 289)
- `COLOR_MAP`, `WEAPON_COLOR`, `WEAPON_FX`, `SIZE_SCALE`, `BODY_SIZE` — visual maps
- `UNIT_SCHEMA` — field definitions and enums (line 331)
- `RecipeAssembler.build()` — procedural sprite recipe generator
- `BODY_PLANS` — shape definitions for 28+ body plans
- `WEAPONS` — shape definitions for 14+ weapon types
- Spell forge: `sanitizeSpell()`, `SPELL_ENUM`, spell validation

### src/battle.js (~3584 lines)
- `Battle` object — main simulation
- `Battle.start()` — initialize battle with armies + seed
- `Battle.update(dt)` — fixed-timestep sim (always 1/60)
- `Battle.loop()` — accumulator-based frame loop
- `Battle.render()` — render all units, projectiles, FX, HUD
- Combat: `takeDamage()`, `attack()`, `projectile` system
- Abilities: `triggerAbility()` — all 21 abilities
- Spells: `Spell.fire()`, `Spell.checkTriggers()`, `SPELL_TARGET`, `SPELL_SHAPE`, `SPELL_EFFECT`
- Lockstep: `queueCommand()`, `stateHash()`, `LOCKSTEP_DELAY`
- Serialization: `serializeArmyForPeer()`, `deserializeArmyForPeer()`
- `BattleFX` — particles, hit flashes, screen shake, status rings

### src/rendering.js (~1382 lines)
- `SpriteRenderer` — sprite drawing, caching, preview
- `_getSpriteCacheKey()` — cache key with z-scale + recipe ID
- `_renderSpriteToCache()` — offscreen canvas pre-render
- `SpriteRenderer.draw()` — main draw path (uses cache)
- `SpriteRenderer.renderPreview()` — small canvas preview for cards
- `SpriteRenderer.JOINT_ANGLES` — skeletal joint definitions
- `GameAudio` — procedural Web Audio (no asset files)
- `BattleFX` — particle system, hit flashes, screen shake

### src/ui.js (~5015 lines)
- `G.screen(id)` — screen switching, canvas reparenting, back button visibility
- `G.menu()` — main menu rendering, arena badge, forge button, tooltip attachment
- `G.deck()` — deck builder: 3 interaction patterns (tap slot, drag, slot picker)
- `_renderLoadout()`, `_renderCollection()`, `_placeUnitInSlot()`, `_showSlotPicker()`
- `G.renderSynergyMeter()` — role balance analysis
- Draft: `startRoundDraft()`, `drawOne()`, `pickDraft()`, `rollOne()`
- `renderDraftBattlefield()` — draft canvas with unit sprites
- Forge UI: `forge()`, `forgeWithAd()`, `forgeSkipAd()`, `keepForge()`
- Screens: `shop()`, `upgrade()`, `codex()`, `stats()`, `profile()`, `achievements()`, `replaysScreen()`
- `showOnboarding()` — 6-step interactive tutorial
- `BtnTooltip` — menu button tooltips (hover + long-press)
- `CardTooltip` — unit card tooltips (hover + long-press)
- Onboarding: `_onboardNext()`, `_showCoachmark()`

### src/game.js (~455 lines)
- `G` object — main game state holder
- `G.init()` — initialization sequence
- PWA: service worker registration, manifest
- Event handlers: keyboard shortcuts, fullscreen toggle
- `toggleFullscreen()` — native + pseudo-fullscreen (iPhone)

### src/network.js (~817 lines)
- P2P via trystero (WebTorrent signalling)
- `connect()`, `host()`, `join()` — connection management
- Heartbeat, signing, transmit
- Desync detection: `stateHash()` comparison
- Lockstep command sync

### src/battle-helpers.js (~722 lines)
- Behaviour Composition API: targeting, movement, attackCondition, abilityTrigger
- `acquireTarget()` — targeting logic (closest, lowest_hp, etc.)
- `moveUnit()` — movement behaviors (chase, hold, kite, etc.)
- Avoidance: collision separation, spatial grid

### src/utils.js (~469 lines)
- `DMath` — deterministic math (sqrt, sin, cos, hypot via lookup tables)
- `rand()`, `randRange()` — seeded PRNG
- `R()`, `Q()` — non-deterministic random (UI only)
- `fnv1aHash()` — hashing
- `toast()` — notification system
- Mobile detection, i18n, ads

### src/save.js (~141 lines)
- `loadData()`, `loadDataAsync()` — localStorage + IndexedDB fallback
- `saveData()`, `saveDataDebounced()` — persistence
- `migrateSave()` — version migrations
- `importSave()`, `exportSave()` — share codes

### src/match.js (~110 lines)
- `Match` object — lives, rounds, history
- `Match.startRound()`, `Match.onRoundEnd()`, `Match.onMatchEnd()`
- `Match.comebackEligible()` — loser bonus logic

### src/quests.js (~91 lines)
- Daily quests: generate, track, claim
- Login streaks

### src/bot.js (~82 lines)
- `Bot` object — AI opponent
- `Bot.generateLoadout()` — pick bot units
- `Bot.draftRound()` — simultaneous draft picks

### src/generated_units.js (~31 lines)
- LLM-forged units added to base roster (Crystal Golem, Samurai, Phoenix, etc.)
- Each has a procedural sprite recipe (recipeVersion: 1)

### src/imports.js (~47 lines)
- Dynamic imports: web-llm (CDN), trystero (vendor), lz-string (vendor)
- Uses `new Function('u','return import(u)')` to bypass Vite static analysis

### src/main.js (~18 lines)
- Entry point with `// INCLUDE:` directives
- Vite's concat-modules plugin inlines all included files

## HTML Files

### index.html (root)
- Vite entry point — references `src/main.js`
- Contains all screen divs, error panel, toast, tooltips
- `#fsBtn` (top-right), `#backBtn` (top-left, auto-shows on non-menu screens)

## CSS

### src/style.css
- All CSS — CSS variables in `:root` (purple/gold palette)
- Component classes: `.btn`, `.card`, `.pill`, `.detail`, `.group`, `.screen`
- `#cardTooltip`, `#btnTooltip` — tooltip styles
- `#fsBtn`, `#backBtn` — fixed navigation buttons
- Fullscreen, safe-area, mobile-specific styles
