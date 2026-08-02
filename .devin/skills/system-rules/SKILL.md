---
name: system-rules
description: System rules — P2P sync, save/import, security, forge, init, PWA, audio, quests
triggers:
  - model
allowed-tools:
  - read
  - grep
  - glob
---

Detailed engineering rules for system-level code in Prompt Showdown: P2P multiplayer,
save system, security, forge, initialization, PWA, audio, and quests. Invoke this skill
when working on networking, save/load, security, forge, onboarding, PWA, audio, or quest logic.

The entire game is in `index.html` (~13K lines). Search by function/constant name.

## P2P Synchronization Rules

### Guest State Must Mirror Host State
Host is authoritative for all match state. Guest tracks same state via messages:
- `Match.round`: Guest increments on every `round_start` message. Do NOT call `Match.start`
  from `match_start` — it prematurely increments round via `startRound`.
- `Match.history`: Guest pushes entries on `round_end` and `match_end` (final round only).
- `Match.livesPlayer`/`Match.livesEnemy`: Guest swaps lives (host's player = guest's enemy).
- Winner translation: Host's `"player"` = guest's `"enemy"` and vice versa.

### Guest Should Not Run Authoritative Logic
Guest must NOT call `Match.onRoundEnd` or `Match.onMatchEnd` directly. These are triggered
by host messages. Guest's `onBattleEnd` returns early for P2P.

### Scout Picks
Host should not send `opponent_picks` with bot picks — guest already has host's real
previous-round picks from `round_start`. Bot picks are local placeholders for host's scout screen.

## P2P Security Rules

### Message Validation
`networkReceive` enforces:
- Rate limiting: Max 60 msgs/sec per peer via `_p2pRateCheck()`. Floods dropped.
- Size limits: Max 256KB per message via `P2P_MAX_MSG_SIZE`. Checked in `transmit()`.
- Type checking: Reject non-objects, non-string `t` fields, unknown message types.
- Payload validation: Each handler validates `data.d` structure.

### Snapshot Validation
`applyRemoteSnapshot` validates:
- `snap` must be object with array `units` field
- Unit count capped at 400 (200 per side)
- Each unit must have numeric `x`, `y`, `h`
- Coordinates clamped to [-1000, 1000]
- `projectiles` and `recentCrits` must be arrays if present

### Forge/Deck Message Validation
- Forge units must pass through `unit()` factory (sanitizes all fields)
- Forge spells must have string `name` (max 40 chars) and `effect` field
- Deck `selected` must be array with max 20 entries
- Match/round data must be objects with validated enum values (winner: player/enemy/draw)

### Room Authentication
Room IDs incorporate optional password: `setupNetwork(id, password)` creates room
`id:pw:password`. Host generates cryptographically random room IDs via `crypto.getRandomValues`.

### P2P Quest Tracking
Only host runs battle simulation. When guest-team spell fires, host sends `spell_used`
message so guest can call `Quests.track("spell_use")`.

### P2P Version Compatibility
Role messages include game version: `transmit("role", {role:"host", v:CURRENT_VERSION, det:true})`.
Receiver checks version mismatch and disconnects with descriptive error. The `det:true`
flag advertises determinism (lockstep) support.

## Determinism / Lockstep Rules (DET)

### Architecture
When both peers support determinism (`_peerDetCapable`), P2P battles use lockstep
instead of host-authoritative snapshots. Both peers run the sim independently from
the same seed + armies, syncing only commands. This eliminates snapshot bandwidth
and ensures both peers see the same battle.

### Seeded PRNG
`seedBattle(seed)` initializes a deterministic LCG PRNG (`_battleSeed`/`_rngState`).
`rand()` and `randRange(a,b)` draw from it. The seed is generated per-round by the
host and shared via the `lockstep_start` message (included in the payload).

### DMath Library
`DMath.sqrt/sin/cos/hypot` use lookup tables (1024-entry for sin/cos, Newton-Raphson
for sqrt). These replace `Math.*` in all sim-state-affecting code paths. `Math.*` is
still fine for UI/render-only code (canvas transforms, particle FX, toast positions).

### Fixed Timestep
`Battle.loop()` uses an accumulator pattern: real frame time (×speed) is added to
`_accumulator`, then drained in fixed `1/60` steps via `Battle.update(FIXED_DT)`.
Max 4 steps per frame prevents spiral-of-death. `_lastDt` (real frame time) drives
HP-bar interpolation in render.

### Lockstep Command Protocol
- Commands (spell casts, speed changes, pauses) are scheduled by tick number.
- `queueCommand(cmd, targetTick)` stores in `_cmdBuffer` (Map<tick, cmd[]>).
- `executeCommands(tick)` runs all commands for the current tick at the top of
  `update()`, before sim logic.
- `LOCKSTEP_DELAY=3` ticks gives time for the peer's command to arrive.
- Commands transmit via `cmd_lock` message; peer acks via `tick_ack` every 10 ticks.
- Pacing: sim won't advance past `_peerConfirmedTick + 10` to avoid running ahead.

### Sim Labeling
The host's team labels are used on BOTH peers (host=player, guest=enemy). Both call
`Battle.start(playerArmy, enemyArmy)` in the same order → identical unit array.
`Battle._localTeam` tracks which team is the local player's ("player" for host/solo,
"enemy" for guest in lockstep). Manual spell casts fire for `_localTeam`.

### Army Serialization
`serializeArmyForPeer`/`deserializeArmyForPeer` preserve x/y/mh positions (unlike
`deserializeUnitsFromPeer` which rebuilds via `unit()` and drops them). Both peers
must start from byte-identical initial positions for determinism.

### Desync Detection
At battle end, both peers compute `Battle.stateHash()` (FNV-1a over unit positions,
HP, and animState) and send it via `round_hash`. Mismatch sets `_desyncFallback=true`
→ next round falls back to host-authoritative snapshot sync (legacy behavior).

### Fallback
If `_peerDetCapable` is false (peer doesn't support determinism) or `_desyncFallback`
is true, the system falls back to host-authoritative snapshot sync (legacy behavior).

## Save System Rules

### Import Must Run Migration
`importSave()` must call `migrateSave(data)` before assigning to `this.save`. Imported saves
from older versions will be missing fields. Without migration, undefined behavior and errors.

### IndexedDB Fallback
When localStorage quota exceeded, `saveData()` falls back to `idbPut()`. Load path:
- `loadData()` — synchronous, localStorage only (fast path)
- `loadDataAsync(cb)` — async, localStorage first, then IndexedDB
- `G.init()` uses sync path if `save.version` exists, async path if not
- Splash screen stays visible during async IDB lookup. `hideSplash()` in `_initRest()`.

### Debounced Saves
High-frequency save calls (quest tracking, settings, difficulty) use `saveDataDebounced()`
(batch within 500ms). Critical saves (match end, forge, import) use synchronous `saveData()`.

## Security Rules

### Unit Name Sanitization
Unit names are user-generated (LLM forge, save import, P2P). Sanitized at creation in `unit()`:
- Angle brackets (`<` `>`) stripped
- Double quotes (`"`) replaced with single quotes (`'`)
- Truncated to 20 characters
Never bypass this. Use `textContent` instead of `innerHTML` for raw names.

### sanitizeSpell() for Untrusted Spell Data
All spells from untrusted sources (P2P, URL import, save import) must pass `sanitizeSpell()`:
- Sanitizes name (strips `<>`, replaces `"` with `'`, truncates to 40 chars)
- Validates enum fields (trigger, effect, shape, fxType, target) against `SPELL_ENUM`
- Clamps numeric fields (magnitude, radius, duration) to safe ranges
- Returns `null` for invalid input

### escapeHtml() for User-Generated Strings
When embedding user-generated strings in `innerHTML`, use `escapeHtml()`. Unit names already
sanitized by `unit()`. Spell names from LLM forge sanitized by `sanitizeSpell()`. Strings from
URL parameters or raw save data must be escaped before rendering.

## Forge System Rules

### Daily Forge Cap
`_doForge()` enforces daily cap of 10 using `save.forgeDate` and `save.forgeCount`:
- If `forgeDate !== today`, reset `forgeCount` to 0, update `forgeDate`
- If `forgeCount >= 10`, show toast, return early
- Increment `forgeCount` after cap check passes

### Forge Generation Progress
`forgeGenProgress` global set by `_doForge` before calling `generateUnit`/`generateSpell`.
Receives `(current, total, fieldName)` for each LLM field. Must be set to `null` in all exit
paths (success, error, finally). `FIELD_LABELS` map provides human-readable labels.

## Initialization Guard Rules

### Splash Screen Lifecycle
Splash only hidden via `_initRest()`, never from startup code. `_initialized` flag set at
end of `_initRest()`.

- **Sync path**: `G.init()` → `migrateSave()` → `_initRest()` → `hideSplash()`
- **Async path**: `G.init()` → `loadDataAsync(cb)` → cb → `migrateSave()` → `_initRest()` → `hideSplash()`
- **Timeout fallback**: If IDB doesn't respond in 5s, force-init with defaults

Never call `hideSplash()` from `.then()` handler in startup — races with async path.

## PWA Rules

### Data URLs Instead of Blob URLs
PWA manifest and service worker must use data URLs, not blob URLs. Blob URLs are ephemeral
(lost on reload). Data URLs persist:
```js
// CORRECT
const url="data:application/manifest+json,"+encodeURIComponent(JSON.stringify(data));
```

### Cache Versioning
Service worker cache name includes version: `PWA_CACHE_VERSION="promptshowdown-v2"`.
`activate` handler deletes all old caches.

### SW Registration Fallback
Data URL SW registration may fail in Chrome. Fall back to blob URL for current session.
App still works as installable PWA via manifest without SW caching.

## Audio Rules

### SFX Rate Limiting
`GameAudio.sfx()` enforces max 30 SFX/sec via `_sfxRate` counter. Prevents audio clipping
when many units attack simultaneously. Counter resets every 1s. Excess calls silently dropped.

### Audio Cleanup on Unload
`beforeunload` handler calls `GameAudio.stopMusic()` and `GameAudio.ctx.close()` to release
audio resources. Prevents orphaned audio nodes.

### Audio Node Lifecycle
All audio nodes (oscillators, gain nodes) must be disconnected after playback. SFX nodes
disconnect on `onended`. Music interval gain nodes disconnect after envelope completes.

## Reduced Motion Support

All `BattleFX` particle/shake functions check `G.save?.reducedMotion` before creating
particles or shake. When enabled: hit flash still applied, particles/shake skipped, audio
still plays.

## Quests Null Safety

`Quests.track()` must guard against `G.save.quests` being undefined. `Quests.checkStreak()`
must validate `q.streak` structure. `Quests.generateDaily()` must validate `QUEST_POOL`.
`Quests.claim()` must validate reward structure.

## Draft Timer Race Condition

Draft timer's auto-pick must check `!this._draftPicking` before calling `pickDraft()`.
Without this guard, manual pick at timer expiry can race, causing double-pick.
