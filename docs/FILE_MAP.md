# File Map — index.html

The entire game is a single `index.html` file (~13,200 lines). This map shows where
every major section lives so you can jump directly to the right line range.

## Top-level Structure

| Lines | Section | Purpose |
|-------|---------|---------|
| 1-10 | `<head>` | Meta tags, PWA links, title |
| 11-139 | `<style>` | All CSS (CSS variables, screens, components, animations) |
| 141-580 | `<body>` HTML | All screen DOM elements (menu, settings, draft, battle, forge, etc.) |
| 581-13206 | `<script>` | All JavaScript (game logic, rendering, networking) |

## CSS (lines 11-139)

| Lines | Section | Purpose |
|-------|---------|---------|
| 13-25 | `:root` | CSS variables (purple/gold palette, spacing, radii) |
| 27-50 | Base styles | Body, scrollbars, fullscreen class |
| 51-139 | Component CSS | `.btn`, `.card`, `.pill`, `.screen`, `.spellBtn`, animations |

## HTML Screens (lines 141-580)

| Lines | Screen ID | Purpose |
|-------|-----------|---------|
| 144 | `#splash` | Loading splash (hidden after init) |
| 146-185 | `#menu` | Main menu (stats, buttons, daily quest badge) |
| 187-241 | `#settings` | Settings (language, difficulty, audio, graphics, colorblind, reduced motion) |
| 243-253 | `#matchmaking` | P2P matchmaking spinner + timer |
| 255-265 | `#lobby` | P2P lobby (host/join, room ID) |
| 267-309 | `#p2ptest` | P2P connection test panel |
| 311-343 | `#draft` | Draft screen (fullscreen canvas, HUD, card area, timer) |
| 345-355 | `#scout` | Scout screen (opponent picks preview) |
| 357-403 | `#battle` | Battle screen (fullscreen canvas, HUD, spell bar, kill feed, inspector) |
| 405-428 | `#result` | Match result (MVP, damage chart, survivors, rounds, highlights, share) |
| 430-457 | `#forge` | AI forge (prompt input, model progress, preview, actions) |
| 459-496 | `#deck` | Deck manager (loadout, presets, synergy, collection) |
| 498-504 | `#upgrade` | Unit upgrade screen |
| 506-516 | `#shop` | Shop (daily offers) |
| 518-529 | `#codex` | Codex (all units encyclopedia) |
| 531-535 | `#stats` | Stats screen |
| 537-541 | `#profile` | Profile screen |
| 543-548 | `#achievements` | Achievements screen |
| 550-554 | `#replays` | Replays screen |
| 556-565 | `#tierlist` | Tier list screen |
| 567-570 | `#errorPanel` | Error display panel |
| 571-580 | Modals + overlays | Confirm dialog, coachmarks, battle log |

## JavaScript — Module Loading (lines 581-620)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 582 | `W` | web-llm module (lazy loaded) |
| 583 | `joinRoom` | trystero P2P (lazy loaded) |
| 584 | `LZString` | lz-string compression (lazy loaded) |
| 585 | `moduleLoadErrors` | Track module load failures |
| 587-620 | `loadModules()` | Dynamic import of web-llm, trystero, lz-string |

## JavaScript — Utilities (lines 625-1200)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 625-636 | `showError`/`clearError` | Error panel display |
| 639-647 | `toast` | Toast notification |
| 649-667 | `showConfirm` | Confirm dialog modal |
| 669-690 | `vibrate`/`toggleFullscreen` | Mobile helpers + error handlers |
| 692-695 | `R`/`F`/`Q` | Random helpers (Math.random, Math.floor, random int) |
| 695-700 | `SAVE_KEY`/`SAVE_BACKUP_KEY`/`CURRENT_VERSION` | Save constants (version=12) |
| 702-730 | `saveData`/`saveDataDebounced`/`saveDataNow` | Save system (localStorage + IDB fallback) |
| 732-738 | `deepClone`/`esc` | Clone + escape helpers |
| 740-781 | `idb`/`idbPut`/`idbGet`/`localStorageQuotaOK` | IndexedDB fallback |
| 783-934 | `STRINGS`/`t()` | i18n (en/es/pt/de/fr/ja) |
| 936-966 | `AdSDK` | Ad SDK abstraction (stub fallback) |
| 968-993 | `Analytics` | Telemetry (anonymous, opt-out) |
| 995-1025 | `loadData`/`loadDataAsync` | Load save (sync localStorage + async IDB) |
| 1027-1121 | `migrateSave` | Save migration (v0→v12) |
| 1123-1132 | `clamp` | Math clamp |
| 1133-1197 | `unit()` | Unit factory (sanitizes name, validates fields, sets defaults) |
| 1196 | `cloneUnit` | Deep clone a unit |
| 1199-1201 | `$`/`setText`/`setStyle` | DOM helpers |

## JavaScript — LLM Forge (lines 1203-3016)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 1203-1210 | LLM state | `llm`, `llmReady`, `llmLoading`, `llmCancelled`, `llmWorker` |
| 1210 | `MODEL` | Qwen2.5-1.5B-Instruct-q4f16_1-MLC |
| 1213-1215 | `aiCache` | LLM generation cache |
| 1217-1226 | Progress tracking | `llmStartTime`, `forgeGenProgress` |
| 1228-1242 | `FIELD_LABELS` | Human-readable labels for forge fields |
| 1244-1265 | `updateAIFromProgress` | Model download progress bar |
| 1266-1364 | `cancelLLM`/`resetCancelSignal`/`loadLLM`/`preloadLLM` | LLM lifecycle |
| 1366-1392 | `validateUnit` | Validate LLM-generated unit fields |
| 1394-1406 | `COLOR_MAP`/`WEAPON_COLOR`/`WEAPON_FX`/`SIZE_SCALE`/`BODY_SIZE` | Visual constants |
| 1408-1439 | `UNIT_SCHEMA` | Unit field schema for LLM |
| 1441-1452 | `sanitizeHex` | Hex color sanitization (prevents CSS injection) |
| 1454 | `escapeHtml` | HTML escaping for XSS prevention |
| 1456-1467 | `sanitizeSpell` | Spell sanitization for untrusted data |
| 1469-1493 | `lighten`/`darken` | Color manipulation |
| 1495-1503 | `deriveAtkSpd`/`deriveCrit` | Derive attack speed + crit from ability |
| 1505-1577 | `CONSISTENCY_RULES`/`semanticValidate`/`autoFixFields` | Semantic validation |
| 1579-2116 | `BODY_PLANS` | 28 body plan shape definitions (humanoid, dragon, serpent, etc.) |
| 2118-2160 | `WEAPONS` | 14 weapon shape definitions (sword, bow, staff, etc.) |
| 2162-2184 | `scaleShape` | Scale weapon/body shapes |
| 2186-2261 | Visual modifiers | `HEAD_FEATURES`, `BACK_FEATURES`, `TAIL_FEATURES`, `AURA_MAP_VISUAL`, `EYE_STYLES`, `PATTERN_MODIFIERS`, `WEAPON_STYLE_MODIFIERS` |
| 2263-2415 | `RecipeAssembler` | Assemble sprite recipe from unit fields + body plan + weapon |
| 2417-2478 | `TEMPLATES`/`templateFallback` | Template units when LLM unavailable |
| 2480-2570 | Recipe minify/expand | Compress recipes for P2P/URL sharing |
| 2526-2570 | `attrsToUnit` | Convert raw attrs to unit object |
| 2572-2615 | IndexedDB LLM cache | `openDB`, cache get/put for LLM generations |
| 2617-2673 | `openDB`/`openDBWithGuard` | IDB with error guard |
| 2675-2695 | `ENUM_FIELDS` | Enum field definitions for LLM prompts |
| 2696-2718 | `INT_FIELDS`/`parseStat`/`parseEnum`/`FIELD_PARSERS` | Parse LLM responses |
| 2719-2721 | `shuffle`/`opts` | Array shuffle for enum options |
| 2722-2790 | `FIELD_PROMPTS` | LLM prompt templates for each unit field |
| 2792-2910 | `FIELD_ORDER`/`FIELD_BATCHES` | Field ordering + batch generation |
| 2911-2958 | Spell forge | `SPELL_FIELD_ORDER`, `SPELL_FIELD_PROMPTS`, `SPELL_FIELD_PARSERS`, `SPELL_TEMPLATES`, `templateSpellFallback` |
| 2960-3015 | `semanticValidateSpell` | Spell semantic validation |
| 3017-3037 | `showAdStub` | Ad display |

## JavaScript — P2P Networking (lines 3039-3425)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 3039-3058 | P2P state | `room`, `sendNet`, `connected`, `role`, rate limiting |
| 3060-3125 | `setupNetwork`/`disconnect`/`transmit` | P2P connection management |
| 3127-3165 | `showDisconnectPrompt` | Disconnect UI |
| 3167-3425 | `networkReceive` | Main P2P message handler (all message types) |

## JavaScript — Battle Math + AI (lines 3428-3870)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 3428-3442 | `dist`/`moveToward`/`moveAway`/`effSpeed` | Movement math |
| 3444-3530 | Avoidance grid | `_avoidGrid`, `_buildAvoidGrid`, `avoidanceOffset` (soft avoidance) |
| 3531-3555 | Targeting helpers | `closestEnemy`, `lowestBy`, `highestBy` |
| 3557-3568 | Enum constants | `TARGETING_OPTS`, `MOVEMENT_OPTS`, `ATTACK_CONDITION_OPTS`, `ABILITY_TRIGGER_OPTS`, `ABILITY_OPTS`, `ROLE_OPTS` |
| 3570-3571 | Color constants | `TEAM_COLORS`, `PASSIVE_ABILITIES`, `TRIGGERED_ABILITIES` |
| 3574-3652 | Description maps | `ABILITY_DESCRIPTIONS`, `MOVEMENT_DESCRIPTIONS`, `TARGETING_DESCRIPTIONS`, `TRIGGER_DESCRIPTIONS`, `WEAPON_DESCRIPTIONS` |
| 3654-3720 | `TARGETING` | Targeting functions (closest, lowest_hp, highest_hp, enemy_carry, etc.) |
| 3721-3786 | Targeting cache | `_targetCache`, `_getCachedTarget` (per-frame per-team cache) |
| 3788-3847 | `MOVEMENT` | Movement functions (chase, flee, hold, hold_midpoint, kite, patrol, blink, strafe) |
| 3849-3855 | `ATTACK_CONDITIONS` | Attack condition functions |
| 3857-3870 | `ABILITY_TRIGGERS` | Ability trigger condition functions |

## JavaScript — Match System (lines 3872-3962)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 3872 | `DEFAULT_LIVES` | 3 lives per player |
| 3873-3962 | `Match` | Match state (round, history, lives), startRound, onRoundEnd, onMatchEnd |

## JavaScript — Sprite Rendering (lines 3964-4818)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 3964-3978 | `JOINT_ANGLES`/`JOINT_CONFIG` | Skeletal joint definitions |
| 3980-3991 | `ANIM_DURATIONS`/`SPRITE_CACHE_FRAMES` | Animation constants |
| 3993-4015 | `_getRecipeId` | Unique recipe ID for cache key |
| 4016-4025 | `_getSpriteCacheKey` | Cache key: (recipe, state, frameIdx, team) |
| 4027-4098 | `_renderSpriteToCache` | Render sprite to offscreen canvas (cache miss path) |
| 4100-4113 | `_getCachedSprite`/`_clearSpriteCache` | Cache get + clear |
| 4115-4818 | `SpriteRenderer` | Main renderer: `draw`, `drawShapeRaw`, `drawFace`, `renderPreview`, `renderDraftBattlefield` |

## JavaScript — Audio (lines 4820-5009)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 4820-5000 | `GameAudio` | Procedural SFX + generative music (Web Audio API) |
| 5002-5009 | `fxTypeFreq` | Map fx type to audio frequency |

## JavaScript — Visual FX (lines 5011-5316)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 5011 | `MAX_PARTICLES` | 60 particle cap |
| 5015-5021 | `_spawnParticle`/`_recycleParticle` | Particle pool |
| 5023-5042 | `AURA_MAP`/`deriveFxType` | Aura color mapping |
| 5044-5316 | `BattleFX` | All visual FX: particles, shake, crit, death, spell, burst, auras, rings |

## JavaScript — Spell System (lines 5318-5650)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 5318 | `RANGED_THRESHOLD` | 80px (above = ranged) |
| 5320-5326 | `SPELL_ENUM` | Spell enums (trigger, target, effect, shape, fxType) |
| 5328-5381 | `SPELL_TARGET` | Target resolution functions (enemy_cluster, enemy_frontline, etc.) |
| 5383-5433 | `SPELL_SHAPE` | Shape functions (line, cone, circle, persistent_zone) |
| 5435-5473 | `SPELL_EFFECT` | Effect functions (damage, heal, shield, buff, summon, knockback, etc.) |
| 5475-5650 | `Spell` | Spell system: `fire`, `checkTriggers`, `tickZones` |

## JavaScript — Battle Engine (lines 5652-8178)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 5652-8178 | `Battle` | Main battle engine (~2500 lines) |
| 5652-5700 | Init | `start`, `initRuntime`, `stop`, `loop` |
| 5700-6200 | `update` | Per-frame update: status ticks, abilities, movement, attacks, projectiles, separation, death cleanup, HUD, debug |
| 6200-6400 | `act` | Per-unit AI: target selection, movement, attack, ability trigger |
| 6400-6600 | `attack`/`takeDamage` | Attack + damage handling (crit, dodge, shield, lifesteal, thorns, ramp) |
| 6600-6700 | `triggerAbility` | Ability execution (all 21 abilities) |
| 6700-6900 | `separate` | Hard collision separation (spatial grid) |
| 6900-7100 | `updateProjectiles` | Projectile physics + hit detection |
| 7100-7700 | `render` | Two-pass render: sprites + shadows (pass 1), HP bars + rings + names (pass 2) |
| 7700-7900 | `drawBackground`/`drawDmgNums` | Background cache + damage number batching |
| 7900-8100 | `checkEnd`/`onUnitDeath` | Battle end detection + death handling |
| 8100-8178 | Snapshot/interpolation | `applySnapshot`, `applyRemoteSnapshot`, `_interpRender` (MP guest) |

## JavaScript — Quests + Bot (lines 8180-8353)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 8180-8188 | `QUEST_POOL` | Daily quest definitions |
| 8190 | `STREAK_REWARDS` | Login streak rewards |
| 8191-8271 | `Quests` | Quest system: track, generateDaily, claim, checkStreak |
| 8273-8290 | `BotStrategy` | Bot draft strategy (role-fill) |
| 8292-8353 | `Bot` | Bot AI: buildBotArmy, botPicks |

## JavaScript — Base Units (lines 8355-8599)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 8355-8599 | `SPRITE_RECIPES` | Pre-built sprite recipes for base units |

## JavaScript — Game Controller (lines 8601-12984)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 8601-12984 | `G` | Main game controller (~4400 lines) |
| 8601-8700 | Init | `init`, `_initRest`, `hideSplash` |
| 8700-8900 | Match flow | `fight`, `startMatch`, `startRound`, `onBattleEnd`, `onMatchEnd` |
| 8900-9100 | Screens | `menu`, `settings`, `matchmaking`, `lobby` |
| 9100-9300 | Draft | `draft`, `pickDraft`, `reroll`, `scout` |
| 9300-9500 | Battle UI | `battle`, `tick`, `auto`, `skip`, `cycleSpeed`, `togglePause` |
| 9500-9700 | Result | `result`, `_renderMatchAnalysis`, `_renderMatchMVP`, `_renderMatchHighlights` |
| 9700-9900 | Forge | `forge`, `setForgeMode`, `_doForge`, `generateUnit`, `generateSpell` |
| 9900-10100 | Deck | `deck`, `loadout`, `presets`, `fusion`, `sortCollection` |
| 10100-10300 | Shop/upgrade | `shop`, `upgrade`, `buyShopUnit`, `upgradeUnit` |
| 10300-10500 | Collection | `codex`, `tierlist`, `stats`, `profile`, `achievements` |
| 10500-10700 | Replays | `replays`, `saveReplay`, `shareMatchResult` |
| 10700-10900 | Save/Import | `importSave`, `exportSave`, `reset` |
| 10900-11100 | URL import | `importFromURL`, `exportToURL` |
| 11100-11300 | P2P flow | `applyRemoteSnapshot`, P2P message handlers |
| 11300-11500 | Onboarding | `showOnboarding`, `_onboardAdvance` |
| 11500-12984 | Misc | `screen` (reparent canvas), `resizeCanvas`, UI helpers, event handlers |

## JavaScript — PWA + Bootstrap (lines 12986-13206)

| Lines | Symbol | Purpose |
|-------|--------|---------|
| 12986-12993 | `hideSplash` | Hide splash screen |
| 12995-13160 | `setupPWA` | PWA manifest + service worker (data URLs) |
| 13162-13206 | `resizeCanvas` + bootstrap | Canvas resize + `loadData` + `G.init()` + `loadModules()` |

## External Files

| File | Purpose |
|------|---------|
| `vendor/core.mjs` | Trystero P2P core (vendored from esm.sh) |
| `vendor/torrent.mjs` | Trystero torrent signaling (vendored from esm.sh) |
| `vendor/lz-string.mjs` | LZ-string compression for P2P (vendored from esm.sh) |
| `render.yaml` | Render.com deployment blueprint |
| `Play.command` | macOS double-click launcher (starts HTTP server + opens browser) |
| `e2e_test.py` | E2E test suite (184 tests, Playwright) |
| `perf.py` | Performance profiler (5 scenarios, Playwright) |
