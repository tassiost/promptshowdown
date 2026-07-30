# Prompt Showdown — Tier 5: Polish, Feel & Live-Ops

**Status: PLANNED (not yet implemented)**

Tier 1 (Draft Showdown clone), Tier 2 (LLM unit forge), Tier 3 (ramp carry + bot strategy + formation + spells, see `PLAN-TIER3.md`), and Tier 4 (visuals & animation overhaul, see `PLAN-TIER4.md`) are planned. This doc plans the final layer: everything a shippable hybrid-casual game needs beyond gameplay and visuals — **audio, onboarding, retention loop, multiplayer robustness, analytics, accessibility, competitive play, and content sharing.**

All line numbers reference `index.html` as of commit `ee3914d` + the uncommitted LLM-cancel WIP. Single-file architecture preserved. No new build dependencies (audio uses the Web Audio API built into every browser; analytics is a tiny fetch-beacon shim).

> **⚠️ Tooling rule (very important):** Never use the `chrome-devtools` MCP server for smoke tests or any browser automation. **Always use the `playwright` MCP server instead.** This applies to every phase in this plan and to all future work on this project. chrome-devtools is explicitly forbidden.

> **⚠️ LLM usage rule (very important):** LLM inference is **free** (runs locally via WebLLM, no API costs). **Never limit tokens, never cap daily forges, never throttle generation.** Take full advantage of the model:
> - Do **not** set `max_tokens` on any `chat.completions.create` call — let the model use its full output budget. (The current code already omits it; keep it that way. The `max_tokens:300` / `max_tokens:32` values in `PLAN.md` are obsolete — do not reintroduce them.)
> - Remove the **daily forge cap of 5** (`save.forgeCount`, line 3314-3327, 3446-3447). Forging is gated by watching an ad, not by an artificial count. If ad fatigue is a concern, surface it via analytics (Phase 35) and address it with UX, not a hard cap.
> - Prefer **richer prompts and multi-call generation** over cramped single calls. If a feature needs 3 LLM calls to produce great output, do 3 calls — the ad hides the latency and there's no cost penalty.
> - Do **not** add timeouts to LLM calls. The user-driven Cancel button (already implemented) is the only escape hatch.

---

## Tier Structure

| Phase | What it delivers | Impact | Risk |
|---|---|---|---|
| **30** | Audio system — SFX, UI, music, spatial cues | Transforms feel; every player notices | Low (Web Audio API, no deps) |
| **31** | First-time onboarding — interactive tutorial | Gates D1 retention | Low (gated flow) |
| **32** | Settings & accessibility — volume, quality, reduced-motion, colorblind | Baseline shippable UX | Low (toggles) |
| **33** | Daily quests + login streaks | Gates D7+ retention (hybrid-casual lifeblood) | Low (save schema) |
| **34** | Multiplayer reconnect + AFK handling | Multiplayer credibility | Medium (P2P state sync) |
| **35** | Analytics / telemetry — event logging + balance dashboard feed | Unblocks all future balancing | Low (fetch beacon) |
| **36** | Ranked leaderboard + seasons | Competitive retention | Medium (needs a server) |
| **37** | Replays + share (forged units, match highlights) | Viral acquisition loop | Medium (serialization) |
| **38** | Real ad SDK integration | Monetization goes live | Medium (SDK quality varies) |
| **39** | i18n — multi-language support | International reach | Low (string tables) |

**Recommended order:** 30 → 31 → 32 → 33 → 35 → 34 → 36 → 37 → 38 → 39.

Audio first (biggest feel win, lowest risk). Onboarding + settings next (shippable UX baseline). Dailies before reconnect (retention > robustness for a soft launch). Analytics before leaderboard/replays (need data to tune them). Real ad SDK late (only after the forge UX is proven with the stub). i18n last (mechanical, no design risk).

---

## Phase 30 — Audio System ✅ DONE

**Why:** The single biggest "feel" gap. The entire 3700-line `index.html` has **zero** audio — no `AudioContext`, no `sound`, no `music` reference anywhere. A game with Tier 4's rich visuals + spring physics + auras but dead silence feels broken. Every player notices in the first 5 seconds.

### Design: procedural Web Audio (no asset files)

Single-file architecture means no `.wav`/`.mp3` files. All SFX are synthesized at runtime via the Web Audio API — oscillators, noise buffers, filters. This keeps `index.html` self-contained and gives infinite SFX variety for free (tie into the LLM: a forged unit's `fxType` can drive its attack sound).

### Changes

1. **New `Audio` object** (sibling of `BattleFX`, ~line 1700). Lazily creates `AudioContext` on first user gesture (mobile autoplay policy). Master gain → SFX bus + music bus.
   ```
   const Audio={
     ctx:null, master:null, sfxGain:null, musicGain:null,
     enabled:true, sfxVol:0.7, musicVol:0.4,
     init(){
       if(this.ctx)return;
       this.ctx=new (window.AudioContext||window.webkitAudioContext)();
       this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
       this.sfxGain=this.ctx.createGain();this.sfxGain.connect(this.master);
       this.musicGain=this.ctx.createGain();this.musicGain.connect(this.master);
       this.applyVolumes();
     },
     applyVolumes(){this.sfxGain.gain.value=this.enabled?this.sfxVol:0;this.musicGain.gain.value=this.enabled?this.musicVol:0;},
     // Resume on first gesture (mobile).
     resume(){if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();}
   };
   ```
2. **SFX synthesizer** — `Audio.sfx(name, opts)` plays a named sound via oscillators/noise:
   | SFX | Synthesis |
   |---|---|
   | `attack_melee` | Short square wave 200→80Hz, 80ms, lowpass |
   | `attack_ranged` | Triangle 600→1200Hz, 60ms, bandpass (bow twang) |
   | `hit` | Noise burst 50ms, lowpass 800Hz |
   | `crit` | Hit + square 400Hz ping, 120ms |
   | `death` | Sawtooth 150→40Hz, 200ms, fade |
   | `spawn` | Sine 200→600Hz, 100ms, rising |
   | `heal` | Sine 400→800Hz, 200ms, gentle |
   | `explode` | Noise 300ms, lowpass sweep 2000→100Hz |
   | `shield` | Square 300Hz, 150ms, tremolo |
   | `spell_fire` | Noise + sawtooth 80Hz, 400ms, lowpass |
   | `spell_frost` | Sine 1200Hz, 300ms, highpass + shimmer |
   | `spell_lightning` | Square 2000Hz, 40ms, sharp |
   | `ui_click` | Sine 800Hz, 30ms |
   | `ui_hover` | Sine 600Hz, 20ms, quiet |
   | `round_start` | Horn — sawtood 110Hz + 220Hz, 600ms |
   | `round_win` | Major triad arpeggio 440→554→659Hz |
   | `round_lose` | Minor descent 440→392→330Hz |
   | `match_win` | Fanfare — triad + octave, 1.2s |
   | `match_lose` | Descending minor 7th, 1.2s |
   | `forge_whoosh` | Noise sweep 1000→200Hz, 500ms, bandpass |
   | `forge_reveal` | Sine 200→1200Hz, 400ms, rising + shimmer |
   | `ramp_up` | Per Wizard ramp kill — sine 400→800Hz, 80ms, rising (gets higher each kill — audible snowball) |
3. **fxType-driven attack sounds.** A forged unit's `fxType` (already a derived field) selects its attack SFX: `fire` → `spell_fire`-short, `frost` → `spell_frost`-short, `lightning` → `spell_lightning`, etc. So a fire elemental's attacks sound fiery, not like a generic melee hit. This is the LLM-cost-free variety tie-in.
4. **Hook into existing events:**
   - `Battle.attack` (line 2009) → `Audio.sfx(attacker.r>RANGED_THRESHOLD?"attack_ranged":"attack_melee",{freq:fxTypeFreq(attacker.fxType)})`
   - `Battle.takeDamage` (line 2028) → `Audio.sfx(crit?"crit":"hit")`
   - `Battle.onUnitDeath` (line 2113) → `Audio.sfx("death")`
   - `Battle.triggerAbility` (line 2068) → per-ability SFX (`spawn`, `heal`, `explode`, `shield`)
   - `BattleFX.onSpawn` (line 1722) → `Audio.sfx("spawn")`
   - Phase 20 ramp-on-kill → `Audio.sfx("ramp_up",{pitch:killCount})`
   - Phase 23 spell fire → `Audio.sfx("spell_"+spec.fxType)`
   - `G.startRoundDraft` (line 2749) → `Audio.sfx("round_start")`
   - `Match.onRoundEnd` (line 1519) → `Audio.sfx(winner==="player"?"round_win":"round_lose")`
   - `G.onMatchEnd` → `Audio.sfx(winner==="player"?"match_win":"match_lose")`
   - `G.forge` / forge reveal → `Audio.sfx("forge_whoosh")` then `forge_reveal`
   - All `.btn` onclicks → `Audio.sfx("ui_click")` (via a single delegated listener)
5. **Procedural music** — a simple generative loop: a bass drone (sine at the arena's root note) + slow arpeggio (sine, tempo scales with battle intensity — more units alive = faster). Per-arena root note (Training Yard = C, District Z = E, Golden Goal = G, Void Rift = A). Music gain is low (0.15) so it's ambient, not intrusive. Ties to `Battle.running` — starts on battle, stops on match end.
6. **Spatial cue (mobile/accessibility)** — optional stereo pan SFX by unit x-position (`StereoPannerNode`). Helps locate off-screen action. Gated behind settings (Phase 32).
7. **Mute on hidden** — pause music when `document.hidden` (matches the existing `Battle.loop` pause, line 1936).

### Code touchpoints
- New `Audio` object (~1700, before `BattleFX`)
- New `fxTypeFreq` helper (maps fxType → base frequency for attack SFX)
- `Battle.attack` (2009), `Battle.takeDamage` (2028), `Battle.onUnitDeath` (2113), `Battle.triggerAbility` (2068)
- `BattleFX.onSpawn` (1722)
- `G.startRoundDraft` (2749), `Match.onRoundEnd` (1519), `G.onMatchEnd`
- `G.forge` / `_doForge` (3360) / `showForgePreview` (3384)
- `Battle.loop` (1933) — music start/stop
- `document.hidden` handler (1936) — pause music
- Global: delegated `.btn` click listener for `ui_click`
- `G.init` (2565) — register `Audio.resume()` on first gesture
- Save schema: `save.audio = {sfxVol, musicVol, enabled, spatial}` (Phase 32 settings reads/writes this)

### Smoke test (Playwright)
1. Start a match → verify `round_start` horn plays. Attack a unit → verify melee/ranged SFX. Crit → verify crit ping. Death → verify death sound.
2. Forge a unit → verify `forge_whoosh` then `forge_reveal`. Forge a fire elemental → verify its attacks sound fiery (fxType-driven).
3. Win a round → `round_win` arpeggio. Lose a match → `match_lose` descent. Win a match → `match_win` fanfare.
4. Tab away → music pauses. Tab back → music resumes.
5. Mobile (Playwright iPhone emulation) → audio inits on first tap, not before.
6. Verify no audio errors in console; verify `AudioContext` is suspended until first gesture.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mobile autoplay policy blocks audio | High (expected) | Low (handled) | `Audio.init()` on first user gesture (tap), not on load. `resume()` on every gesture while suspended. |
| Procedural SFX sound cheap/annoying | Medium | High (worse than silence) | Tune each SFX with envelopes (attack/decay/sustain/release), lowpass filters, and low gains. Reference chiptune aesthetics — fits the procedural visual style. Playtest each sound. |
| Too many simultaneous SFX = clipping | Medium | Medium (muddy) | Cap concurrent SFX at 8; drop lowest-priority (ui_click first, then hit, keep crit/death). Master compressor node. |
| Music loop gets repetitive | High | Low (ambient, low gain) | Generative arpeggio with random variation; tempo tied to battle intensity keeps it dynamic. Music gain 0.15 — background, not foreground. |
| AudioContext adds CPU on mobile | Low | Low | SFX are 30-400ms, cheap. Music is 2-3 oscillators. Negligible vs. canvas rendering. |

---

## Phase 31 — First-Time Onboarding ✅ PLANNED

**Why:** A new player lands in the menu with no guidance — no "draft 3 cards," no "this is your loadout," no "scout reveals the enemy." Only post-match strategy hints exist (Phase 16). Hybrid-casual games live or die on the first 60 seconds; D1 retention is the metric that decides soft-launch success.

### Changes

1. **`save.onboarded` flag** (default `false`). Migration adds it. First launch → `G.showOnboarding()` instead of `G.menu()`.
2. **Interactive tutorial flow** — 6 steps, each with a highlighted element + 1-line caption + "Next" button:
   1. "Welcome! Your 4-card loadout is your army. Tap DECK to see it." → highlight DECK button.
   2. "Tap PLAY to start a match. You'll draft 3 units per round." → highlight PLAY.
   3. "Pick 1 card from each draw. Reroll if you don't like them." → on draft screen, highlight a card + reroll.
   4. "Scout! Tap to reveal what your opponent picked." → on scout screen, highlight scout area.
   5. "FIGHT! Units auto-battle. Watch and adapt for round 2." → on battle screen.
   6. "Win 3 rounds to take the match. Good luck!" → on result screen → set `save.onboarded=true` → `G.menu()`.
3. **Coachmarks** — a reusable `Coachmark(targetEl, text, onNext)` helper: positions a translucent overlay with a cutout around `targetEl` + a tooltip. Dismissed on tap-anywhere or "Next."
4. **Skip button** on every step → sets `onboarded=true`, goes to menu. Respects player agency.
5. **Re-playable** — a "How to Play" button in the menu (small, bottom corner) resets `save.onboarded=false` and replays the tutorial.
6. **No LLM dependency** — onboarding runs against the starter roster + bot. The forge is not mentioned in the tutorial (it's a Tier 2 reward feature, gated behind Training Yard completion per the existing design).

### Code touchpoints
- New `Coachmark` helper (~line 1140, near `showAdStub`)
- New `G.showOnboarding()` + `G.onboardStep(n)` (~line 2700, near `G.menu`)
- `G.init` (2565) — branch to `showOnboarding` if `!save.onboarded`
- `migrateSave` (336) — add `s.onboarded=false`
- Menu HTML (line ~70) — add "How to Play" button
- Highlight targets: DECK button, PLAY button, draft card, reroll, scout area, battle canvas

### Smoke test (Playwright)
1. Fresh save (clear localStorage) → verify onboarding starts, step 1 highlights DECK.
2. Click through all 6 steps → verify each highlights the right element + advances.
3. Skip on step 3 → verify goes to menu, `onboarded=true`.
4. Re-launch → verify menu (no onboarding). Tap "How to Play" → verify tutorial replays.
5. Complete tutorial → play a real match → verify no tutorial interference.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tutorial feels hand-holdy to experienced players | Medium | Low (skip button) | Skip on every step. 6 steps total < 60s. |
| Coachmark positioning breaks on mobile / resize | Medium | Medium (confusing) | Recompute position on resize/orientationchange. Fallback to centered modal if target not found. |
| Tutorial state desyncs if player navigates away | Low | Low | Each step checks current screen; if wrong screen, re-navigate. |

---

## Phase 32 — Settings & Accessibility ✅ PLANNED

**Why:** Baseline shippable UX. No volume control, no quality toggle (FPS degradation is automatic but not user-controllable), no reduced-motion, no colorblind mode. Accessibility is also a store-listing requirement (App Store/Play Store reject games without basic accessibility toggles).

### Changes

1. **New `#settings` screen** (HTML, near line 116) + gear icon in menu header. Sections:
   - **Audio:** master mute toggle, SFX volume slider, music volume slider, spatial audio toggle. Reads/writes `save.audio` (from Phase 30).
   - **Graphics:** quality preset (`Auto` / `High` / `Low` / `Minimal`). `Auto` = current FPS-based degradation. `Low` = drop auras + secondaries. `Minimal` = drop faces + gradients + glow too. Writes `save.quality`.
   - **Accessibility:** reduced-motion toggle (disables spring physics, screen shake, squash/stretch — keeps gameplay clear), colorblind mode (`Off` / `Deuteranopia` / `Protanopia` / `Tritanopia` — shifts palette via a `COLOR_BLIND_FILTERS` map applied in `SpriteRenderer._drawShapeRaw`), high-contrast outlines toggle (thicker shape outlines).
   - **Language:** dropdown (Phase 39 i18n hook — disabled until 39 ships).
2. **`save.settings`** schema: `{audio:{enabled,sfxVol,musicVol,spatial}, quality:"auto", reducedMotion:false, colorblind:"off", highContrast:false}`. Migration adds defaults.
3. **Reduced-motion** — `SpriteRenderer` checks `G.save.settings.reducedMotion`: skip `updateSecondaries`, set `shakeAmount=0`, skip squash/stretch channels. `BattleFX` skips particle bursts (keeps gameplay-critical FX like hit flash).
4. **Colorblind filters** — `COLOR_BLIND_FILTERS` maps each mode to a color transform (e.g. deuteranopia: red→orange, green→yellow). Applied as a post-process on the canvas (`ctx.filter = "url(#cb-filter)"` via an SVG filter, or simpler: remap `shape.c` in `_drawShapeRaw` via a lookup). Unit colors + aura colors + FX colors all shift. Verified against a colorblind simulator.
5. **Quality preset** — `G.applyQuality()` sets the degradation tier explicitly instead of waiting for FPS drop. `Battle.loop` FPS guard (line 1938) still runs as a backstop under `Auto`.
6. **Persists immediately** — every toggle writes `saveData(G.save)`.

### Code touchpoints
- New `#settings` screen HTML (~116)
- New `G.showSettings()` / `G.applyQuality()` / `G.applyColorblind()` (~2700)
- `SpriteRenderer.draw` (1637) + `_drawShapeRaw` (1612) — reduced-motion + colorblind + high-contrast
- `SpriteRenderer.updateSecondaries` (Phase 24d) — skip if reduced-motion
- `BattleFX` (1705) — skip particles if reduced-motion; shakeAmount=0
- `Audio.applyVolumes` (Phase 30) — read from `save.settings.audio`
- `migrateSave` (336) — `s.settings` defaults
- Menu header — gear icon

### Smoke test (Playwright)
1. Open settings → mute audio → verify no SFX. Unmute → SFX return. Slider at 50% → SFX quieter.
2. Quality: Minimal → verify no auras, no gradients, no glow, no secondaries. High → all return.
3. Reduced motion → verify no capes/hair lag, no screen shake, no squash. Hit flash still shows.
4. Colorblind: Deuteranopia → verify red units shift to orange, green to yellow (screenshot diff vs. off).
5. High-contrast → verify thicker outlines.
6. Reload → verify all settings persisted.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SVG colorblind filter is slow/unsupported | Medium | Medium | Fallback to per-shape color remap (lookup table in `_drawShapeRaw`). Simpler, universally supported. |
| Reduced-motion makes gameplay harder to read | Low | Low | Keep hit flash + death fade; only drop decorative motion. Playtest. |
| Quality preset conflicts with FPS guard | Low | Low | FPS guard only active under `Auto`. Explicit presets override. |

---

## Phase 33 — Daily Quests + Login Streaks ✅ PLANNED

**Why:** Gates D7+ retention — the hybrid-casual lifeblood. Without a reason to come back tomorrow, the game bleeds players after the first session. Daily quests + login streaks are the proven pattern (Clash Royale, Marvel Snap, every Voodoo game).

### Changes

1. **`save.quests` schema:** `{date:"YYYY-MM-DD", quest1:{id,type,progress,claimed}, quest2:{...}, quest3:{...}, streak:{count,lastLogin:"YYYY-MM-DD"}}`. Migration adds defaults.
2. **3 daily quests** generated on first launch each day (date check). Quest pool:
   - "Win 3 matches" / "Win 5 matches"
   - "Forge 2 units" / "Forge 1 unit with the word 'fire'"
   - "Win with a frontline-only loadout" / "Win without using a carry"
   - "Reach Round 5 in a match" / "Win a round with all units surviving"
   - "Scout 3 times" / "Use a spell (Phase 23)"
   - "Fuse 2 units"
   - Each quest: progress tracked by hooks in `G.onMatchEnd`, `G.forge`, `Match.onRoundEnd`, etc. Reward: coins + XP.
3. **Login streak** — increments if `lastLogin === yesterday`; resets to 1 if gap > 1 day. Milestone rewards: 3-day = 50 coins, 7-day = 1 free forge (no ad), 14-day = cosmetic (TBD), 30-day = legendary unit. Shown on first launch each day as a modal.
4. **Quests UI** — a "Quests" button in the menu → modal listing 3 quests with progress bars + claim buttons. Claimed quests disappear. All 3 claimed → bonus reward.
5. **No LLM dependency** — quests are deterministic. (Future: LLM-generated personalized quests — "forge a unit that beats your last opponent" — but not in this phase.)

### Code touchpoints
- New `Quests` object (~line 2400, near `Bot`) — `generateDaily()`, `track(event, data)`, `claim(id)`, `checkStreak()`
- `G.init` (2565) — `Quests.checkStreak()` + `Quests.generateDaily()` on launch
- `G.onMatchEnd` — `Quests.track("match_win"/"match_loss", {...})`
- `G.forge` — `Quests.track("forge", {prompt})`
- `Match.onRoundEnd` (1519) — `Quests.track("round_win"/"round_loss", {survivors})`
- `migrateSave` (336) — `s.quests` defaults
- Menu HTML — "Quests" button + modal

### Smoke test (Playwright)
1. Fresh launch → verify 3 quests generated, streak=1, login modal shows.
2. Win a match → verify "Win 3 matches" progress increments. Claim at 3/3 → coins awarded.
3. Forge a unit → verify "Forge 2 units" increments.
4. Fast-forward save date by 1 day (mock) → relaunch → streak=2, new quests generated, old claimed quests gone.
5. Fast-forward by 2 days → relaunch → streak resets to 1.
6. Claim all 3 → verify bonus reward.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Quest tracking misses edge cases (forfeit, disconnect) | Medium | Low (wrong progress) | Track on every match-end path including forfeit. Defensive: progress only increments, never decrements. |
| Date check breaks across timezones | Low | Low | Use `new Date().toISOString().slice(0,10)` (UTC). Consistent globally. |
| Quests too grindy → churn | Medium | Medium | 3 quests, completable in 15-20 min of play. Daily cap on time investment, not on fun. |

---

## Phase 34 — Multiplayer Reconnect + AFK ✅ PLANNED

**Why:** P2P disconnect mid-match = instant forfeit (`Match.forfeit()`, line 1549). No grace period, no rejoin, no AFK detection. Real players on mobile networks will rage-quit over this — losing a winning match because the subway dropped signal for 5 seconds is unacceptable.

### Changes

1. **Reconnect grace period** — on P2P disconnect, show "Reconnecting... (30s)" overlay instead of immediately forfeiting. Pause battle. If the peer reconnects within 30s (Trystero re-establishes), resume from the last snapshot. If not, forfeit.
2. **Snapshot-based rejoin** — host keeps the last `Battle.snapshot()` (line ~2317). On reconnect, host re-sends the full snapshot + match state (`livesPlayer`, `livesEnemy`, `round`, `history`). Guest restores via `Battle.fromSnapshot()` (line ~2330) and `Match` state. Resume battle.
3. **AFK detection** — if a player doesn't interact for 30s during draft (no pick, no reroll), show "Are you there?" prompt. 30s more with no response → auto-forfeit (graceful, not abrupt). In battle, AFK is fine (auto-combat is hands-off) — only draft/scout AFK matters.
4. **Heartbeat** — peers exchange a `ping` every 2s. 3 missed pings (6s) = assumed disconnected → start reconnect grace. Distinguishes "lag" from "quit."
5. **Voluntary leave** — a "Forfeit Match" button in battle (small, corner) for players who want to quit. Confirms first. Counts as a loss.
6. **No LLM dependency.**

### Code touchpoints
- `networkReceive` (line ~1280) — handle `ping`/`pong`/`reconnect`/`resume` message types
- `Match.forfeit` (1549) — replace immediate forfeit with grace period
- New `G.showReconnect(secondsLeft, onTimeout)` (~1140, near `showAdStub`)
- `Battle.snapshot` (2317) / `Battle.fromSnapshot` (2330) — already exist; reuse for rejoin
- `G.startRoundDraft` (2749) — AFK timer starts here
- `Match` state serialization — add `Match.serialize()` / `Match.restore(state)` for rejoin
- Battle HTML — "Forfeit Match" button

### Smoke test (Playwright)
1. Two browser tabs (host + guest) in a match → simulate guest disconnect (close tab) → host shows "Reconnecting... 30s". Reopen tab within 30s → verify battle resumes from same state.
2. Let reconnect timeout → verify graceful forfeit, no error.
3. Guest AFK in draft (no interaction 30s) → "Are you there?" → no response 30s → auto-forfeit.
4. Heartbeat: throttle guest network (Playwright network throttle) → 3 missed pings → reconnect overlay.
5. "Forfeit Match" button → confirm → loss recorded.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Snapshot rejoin desyncs (state mismatch) | Medium | High (broken battle) | Host is authoritative — on rejoin, host's snapshot overwrites guest state entirely. Guest never writes state during reconnect. |
| Trystero doesn't re-establish on reconnect | Medium | Medium (grace period wasted) | Trystero uses WebTorrent trackers which auto-retry. If it fails, grace period expires → forfeit. Acceptable. |
| AFK false-positives (player reading scout) | Medium | Low (annoying) | 30s is generous for draft. "Are you there?" prompt resets timer on any interaction. |

---

## Phase 35 — Analytics / Telemetry ✅ PLANNED

**Why:** Unblocks all future balancing. Today there's zero event logging — can't see which units win too often, where players churn, what they forge, whether bots are too easy. The bot-strategy (Tier 3 Phase 21) + spell-balance (Phase 23) + ramp-carry tuning (Phase 20) are all flying blind. Analytics is the prerequisite for data-driven iteration.

### Design: privacy-respecting, self-hostable, no third-party

No PostHog/Amplitude/Firebase (single-file, no deps, no third-party data sharing). A tiny `Analytics` object that batches events and `navigator.sendBeacon`s them to a configurable endpoint (default: a Render static endpoint or self-hosted Tinybird/Postgres). Events are anonymous (no user IDs — a random `installId` generated once and stored in localStorage).

### Changes

1. **New `Analytics` object** (~line 256, near `saveData`):
   ```
   const Analytics={
     endpoint:null,       // set via render.yaml env or a config.js; null = no-op (local dev)
     installId:null,      // random, generated once
     queue:[],
     init(){this.installId=localStorage.getItem("ps_install")||crypto.randomUUID();localStorage.setItem("ps_install",this.installId);},
     track(event,props={}){this.queue.push({event,props,t:Date.now(),install:this.installId,ver:CURRENT_VERSION});this._flush();},
     _flush(){if(!this.endpoint||this.queue.length<10)return;navigator.sendBeacon(this.endpoint,JSON.stringify(this.queue));this.queue=[];},
     flushNow(){if(this.endpoint&&this.queue.length)navigator.sendBeacon(this.endpoint,JSON.stringify(this.queue));this.queue=[];}
   };
   ```
2. **Key events:**
   | Event | Props | Purpose |
   |---|---|---|
   | `game_start` | {arena, loadout} | D1 retention funnel |
   | `match_start` | {arena, isBot, loadout} | match frequency |
   | `match_end` | {winner, rounds, duration} | win rate, match length |
   | `round_end` | {winner, comebackUsed} | comeback mechanic tuning |
   | `forge` | {prompt, ability, fxType, usedLLM, duration} | forge usage, LLM quality |
   | `unit_win` | {unitName, role, ability} | balance — per-unit win rate |
   | `spell_win` | {spellName, effect} | spell balance (Phase 23) |
   | `quest_complete` | {questId} | quest difficulty tuning |
   | `churn` | {sessionLength, lastScreen} | where players quit |
   | `settings_change` | {setting, value} | accessibility usage |
   | `error` | {message, stack} | stability monitoring |
   | `ad_complete` / `ad_skip` | {duration} | ad monetization |
3. **Hooks** — `Analytics.track(...)` calls at: `G.init`, `Match.start`, `Match.onRoundEnd`, `G.onMatchEnd`, `G.forge` (with LLM timing), `Battle.onUnitDeath` (batched per-match for `unit_win`), `Quests.claim`, settings changes, `window.onerror` (line 284).
4. **Balance dashboard feed** — the endpoint stores events; a separate small static HTML (`/dashboard.html`, not in this plan) queries and shows win rates per unit/ability/spell. Out of scope here, but the event schema is designed to support it.
5. **Privacy** — `installId` is random, not tied to identity. No PII. Endpoint URL is configurable; if `null` (local dev), all `track` calls are no-ops. A privacy notice in settings (Phase 32) explains anonymous telemetry + opt-out toggle.
6. **No LLM dependency.**

### Code touchpoints
- New `Analytics` object (~256)
- `G.init` (2565) — `Analytics.init()`
- `Match.start` (1453), `Match.onRoundEnd` (1519), `G.onMatchEnd` — match/round events
- `G.forge` / `_doForge` (3360) — forge events with LLM timing
- `Battle.onUnitDeath` (2113) — batch unit-death tracking
- `window.onerror` (284) — error events
- `migrateSave` (336) — `s.analyticsOptOut` default false
- Settings (Phase 32) — opt-out toggle
- `render.yaml` — endpoint env var

### Smoke test (Playwright)
1. Set `Analytics.endpoint` to a test URL (mock) → play a match → verify `match_start` + `round_end` × N + `match_end` events beaconed.
2. Forge a unit → verify `forge` event with `{prompt, ability, usedLLM, duration}`.
3. Verify `installId` persists across reloads.
4. Opt out in settings → verify no beacons sent.
5. `endpoint=null` (default dev) → verify no network calls, no errors.
6. Verify no PII in any event payload.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Endpoint down → events lost | Medium | Low | Queue persists in memory; flush on `beforeunload`. If endpoint is down, queue caps at 100 and drops oldest. Best-effort — analytics is non-critical. |
| Too many events → battery/bandwidth on mobile | Low | Low | Batch (flush at 10 events or 30s). `sendBeacon` is async, non-blocking. Cap queue. |
| Privacy concern (tracking without consent) | Medium | High (store rejection) | Opt-out in settings (Phase 32). Anonymous `installId`, no PII. Privacy notice on first launch. GDPR-friendly. |

---

## Phase 36 — Ranked Leaderboard + Seasons ✅ PLANNED

**Why:** Competitive retention. The arena ladder (Phase 15) is unlock-gated PvE — no competitive ranking, no season reset, no "climb to legend." Ranked play gives the hardcore tail a reason to keep grinding after they've unlocked all arenas.

### Design: simple serverless leaderboard

A static endpoint (Render) stores `{installId, name, rating, wins, losses, season}` entries. On match end, the winner's client POSTs their updated rating (Elo: +25 win / -15 loss vs. bot, +32/-20 vs. human). The endpoint returns the top 100 + the player's rank. Seasons reset quarterly (hardcoded season start dates; rating halves on reset).

### Changes

1. **`save.ranked` schema:** `{name, rating:1000, wins, losses, season, peakRating}`. Migration adds defaults. Player picks a display name on first ranked match.
2. **Ranked Play button** in menu (alongside casual Play) → matchmaking with a ranked flag. Bot opponents scale in difficulty with the player's rating (bot uses `BotStrategy` + higher-tier arena pools at high rating).
3. **Elo calculation** — `computeElo(playerRating, opponentRating, result, isBot)`. Win vs human +32, loss -20. Win vs bot +25, loss -15. Floor at 500 (can't drop below). Displayed as tiers: Bronze (500-999), Silver (1000-1499), Gold (1500-1999), Platinum (2000-2499), Diamond (2500-2999), Legend (3000+).
4. **Leaderboard UI** — a "Leaderboard" button → fetches top 100 + player's rank. Shows tier badges. Player's row highlighted.
5. **Seasons** — `SEASON_START` dates (quarterly). On season rollover, `rating = 500 + (rating - 500) * 0.5` (soft reset). Season rewards: top 100 get a cosmetic badge; Legend tier gets a free forge.
6. **No LLM dependency.** Server endpoint is a tiny static-store (Render static site + a simple key-value backend, or Cloudflare Workers KV).

### Code touchpoints
- New `Ranked` object (~2400) — `computeElo`, `submitResult`, `fetchLeaderboard`
- `G.onMatchEnd` — if ranked, `Ranked.submitResult`
- `migrateSave` (336) — `s.ranked` defaults
- Menu HTML — "Ranked Play" + "Leaderboard" buttons
- New `#leaderboard` screen
- `render.yaml` — leaderboard endpoint

### Smoke test (Playwright)
1. First ranked match → prompt for display name → play → win → rating +25.
2. Lose a ranked match vs bot → rating -15, floor at 500.
3. Leaderboard → verify player appears, rank correct, tier badge matches rating.
4. Mock season rollover → verify soft reset (rating halves above 500).
5. Verify casual play doesn't affect rating.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Leaderboard endpoint down | Medium | Medium (no ranked) | Cache last fetch; show stale leaderboard with "offline" badge. Ranked play still works (rating local), syncs when endpoint returns. |
| Elo cheating (fake win POSTs) | High | High (unfair) | Server validates: bot matches require a replay hash (deterministic from seed + inputs); human matches require both peers to submit matching results. Mismatch = both flagged. |
| Bot difficulty at high rating is unfair | Medium | Medium | Cap bot strategy complexity; at Legend tier, prefer human matchmaking (longer timeout). Bots never use perfect counter-picking. |

---

## Phase 37 — Replays + Share ✅ PLANNED

**Why:** Viral acquisition loop. Can't watch a past match back, can't share a cool forged unit to social. The LLM forge produces shareable content (unique units with names + visuals) but there's no share button. Replays also let players learn from losses.

### Changes

1. **Replay recording** — `Battle` already snapshots every frame for P2P (line 2317). Extend: on match start, begin recording a compact replay = array of `{t, snapshot}` every 100ms (10Hz, not 20Hz — half bandwidth). Cap at 60s per round (rounds are short). Store in `save.replays` (cap 5 most recent). Each replay: `{matchId, date, winner, rounds:[{snapshots}]}`.
2. **Replay player** — a "Replays" button → list of saved replays → tap to play back. Reuses `Battle.render` with a recorded snapshot stream instead of live `update`. Scrub bar + play/pause.
3. **Share forged unit** — in the forge preview (line 3384) + collection, a "Share" button. Generates a shareable URL with the unit's prompt + attributes lz-compressed (reuse Phase 18 compression) as a query param: `?unit=...`. Opening the URL decompresses + shows the unit preview + "Add to your collection" (if not already owned). Works cross-device (no P2P needed — it's a URL).
4. **Share match highlight** — after a match win, a "Share" button generates a GIF (via `canvas.captureStream` + MediaRecorder, or a static snapshot of the final frame with the winner's army). Falls back to a shareable URL with the replay if GIF is unsupported.
5. **Web Share API** — use `navigator.share({url})` on mobile (native share sheet); fallback to `navigator.clipboard.writeText` + "Copied!" toast on desktop.
6. **No LLM dependency** (shares existing LLM-generated content).

### Code touchpoints
- `Battle` (1853) — `this.recording=[]`, record in `loop`/`update`
- `Match.start` (1453) — begin recording
- `G.onMatchEnd` — save replay to `save.replays` (cap 5)
- New `ReplayPlayer` object (~1700) — playback recorded snapshots
- New `#replays` screen + list
- `G.showForgePreview` (3384) + collection — "Share" button
- New `G.shareUnit(unit)` / `G.shareMatch(replay)` (~2700)
- `migrateSave` (336) — `s.replays=[]`
- Web Share API / clipboard fallback

### Smoke test (Playwright)
1. Play a match → verify replay saved (5 most recent). Open Replays → play back → verify scrub + play/pause.
2. Forge a unit → Share → verify URL copied to clipboard. Open URL in new tab → verify unit preview renders + "Add to collection" works.
3. Win a match → Share → verify shareable URL/GIF generated.
4. Mobile emulation → verify `navigator.share` invoked (native sheet).
5. Verify replay cap (6th match → oldest dropped).

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Replay storage bloats localStorage | Medium | Medium (quota) | Cap 5 replays; each round ~60s × 10Hz × snapshot size. Compress with lz-string. If quota exceeded, drop oldest. |
| GIF capture unsupported on mobile | High | Low (fallback) | Fallback to shareable URL with replay. GIF is a nice-to-have, not required. |
| Shared unit URL is too long | Low | Low (URL limits) | lz-string compression keeps it <2KB. Base64url encode. Fits in URL + clipboard. |

---

## Phase 38 — Real Ad SDK Integration ✅ PLANNED

**Why:** Monetization goes live. The entire Tier 2 premise (LLM forge gated behind rewarded ads) is unvalidated — still the 15s `showAdStub` (line 1180). Real ad revenue funds the game.

### Changes

1. **Ad SDK selection** — integrate a rewarded-ad SDK. Candidates (web-friendly, no native build):
   - **AdMob for Web** (Google) — rewarded video, highest fill rate, requires AdSense account.
   - **Unity Ads Web** — playable ads, good for games.
   - **ironSource Web** — rewarded + interstitial.
   - **Prebid.js** (open-source) — self-serve, lower fill rate.
   - **Recommendation: AdMob for Web** (highest fill rate, easiest integration, Google account likely already exists).
2. **Replace `showAdStub`** (line 1180) with real SDK call. SDK loaded async (CDN script tag, lazy — only when forge is tapped, not on page load). Ad fails to load → fall back to stub (always give the unit, per the design principle).
3. **Ad events** — `ad_loaded`, `ad_impression`, `ad_complete`, `ad_skip` → `Analytics.track` (Phase 35). Track fill rate, completion rate, revenue.
4. **Interstitial ads** — between matches (not mid-match), one every 3 matches (configurable). Skip if player just watched a rewarded ad (don't double-ads).
5. **No LLM dependency.** LLM generation runs in parallel during the ad (existing design, line 3360).

### Code touchpoints
- `showAdStub` (1180) → `showAd(duration, onComplete)` with real SDK
- `G._doForge` (3360) — pass real ad promise
- New `AdSDK` object (~256) — `load()`, `showRewarded()`, `showInterstitial()`
- `G.onMatchEnd` — interstitial every 3 matches
- `Analytics.track` — ad events
- HTML — SDK script tag (lazy-loaded)
- `render.yaml` — ad SDK env vars (publisher ID)

### Smoke test (Playwright)
1. Tap Forge → verify real ad loads (test ad creative from SDK). Ad completes → unit generated.
2. Ad fails to load (block SDK CDN) → verify stub fallback → unit still generated.
3. Ad skipped (if skippable) → verify unit still given (per design).
4. Play 3 matches → verify interstitial after 3rd. Play 1 more → no interstitial (just saw one).
5. Verify ad events beaconed to analytics.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ad SDK CDN blocked (ad blockers) | High (mobile gamers use blockers) | Medium (no revenue) | Detect blocked SDK → stub fallback → unit still given. Track block rate via analytics. Consider in-game unskippable rewarded unit as ad-free alternative. |
| Ad fill rate low | Medium | High (no revenue) | AdMob has highest fill rate. Fallback to stub means no revenue but no UX break. Mediate (ironSource) if fill <50%. |
| Ad SDK quality poor (crashes, slow) | Medium | High (forge broken) | Lazy-load SDK only on forge tap. Isolate in try/catch. Stub fallback on any error. Never block the unit reward on ad success. |
| Store rejection (App Store/Play Store ad policy) | Low | High (can't ship) | Use approved SDK (AdMob is approved). Follow rewarded-ad guidelines (always reward, no forced interstitials mid-game). |

---

## Phase 39 — i18n (Internationalization) ✅ PLANNED

**Why:** International reach. English-only limits the audience. Hybrid-casual games derive most revenue from non-English markets (LATAM, SEA, Europe).

### Changes

1. **String table** — extract all UI strings into a `STRINGS` object keyed by `en`, `es`, `pt`, `de`, `fr`, `ja`, `ko`, `zh`. Each string: `STRINGS.en.play_button = "PLAY"`, `STRINGS.es.play_button = "JUGAR"`, etc.
2. **`t(key)` helper** — `t("play_button")` returns `STRINGS[save.settings.lang][key]` with fallback to `en`.
3. **Replace all hardcoded strings** in HTML + JS with `t(...)` calls. This is mechanical but touches every screen.
4. **Language picker** in settings (Phase 32) — dropdown of available languages. Persists to `save.settings.lang`.
5. **LLM prompt localization** — the forge prompt is user-typed, so it's already in the player's language. The LLM system prompt (line 1103) stays English (model performs better with English instructions) but the unit `name` field can be in any language (the LLM follows the user's prompt language).
6. **Date/number formatting** — `toLocaleDateString` / `toLocaleString` with the saved locale.
7. **No LLM dependency** (LLM prompts are already language-agnostic on the user side).

### Code touchpoints
- New `STRINGS` object (~line 260) — all UI strings, all languages
- New `t(key)` helper
- Every HTML string + every `setText`/`innerHTML` call — replace with `t(...)`
- `migrateSave` (336) — `s.settings.lang="en"` default
- Settings (Phase 32) — language dropdown
- `G.forge` prompt — no change (user-typed)
- Date formatting in quests (Phase 33) / leaderboard (Phase 36)

### Smoke test (Playwright)
1. Switch language to Spanish → verify all UI strings in Spanish (menu, draft, scout, battle, result, forge, settings).
2. Switch to Japanese → verify all strings + no layout breakage (CJK width).
3. Forge a unit with a Spanish prompt ("mago de fuego") → verify LLM returns a Spanish-named unit.
4. Reload → verify language persisted.
5. Missing translation key → verify English fallback (no blank strings).

### Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Translation quality (machine-translated) | High | Medium (unprofessional) | Use a translation service (DeepL/Google Translate) for initial strings; community contributions for refinement. Mark machine-translated languages as "beta." |
| Layout breakage (long German words, CJK) | Medium | Low (CSS) | Use flexbox + `overflow:hidden` + `text-overflow:ellipsis`. Test each language in Playwright. |
| String extraction misses dynamic strings | Medium | Low (English fallback) | Grep for all `innerText=` / `innerHTML=` / `setText` calls. Smoke test each language. |

---

## Verification Strategy (per phase)

| Phase | Smoke test (Playwright, never chrome-devtools) |
|---|---|
| 30 (Audio) | SFX on attack/hit/crit/death/spawn/forge. fxType-driven attack sounds. Music starts on battle, pauses on hidden. Mobile inits on first tap. |
| 31 (Onboarding) | Fresh save → 6-step tutorial → skip → menu. Replay via "How to Play." No interference after completion. |
| 32 (Settings) | Mute/volume, quality presets, reduced-motion, colorblind filter (screenshot diff), high-contrast. All persist. |
| 33 (Quests) | 3 daily quests generate, track, claim. Login streak increments/resets. All-claimed bonus. |
| 34 (Reconnect) | Disconnect → 30s grace → rejoin resumes. Timeout → forfeit. AFK in draft → prompt → auto-forfeit. Heartbeat. |
| 35 (Analytics) | Match/forge/quest/error events beaconed. installId persists. Opt-out works. No PII. |
| 36 (Leaderboard) | Elo +/- on win/loss. Tier badges. Leaderboard fetch + rank. Season soft-reset. |
| 37 (Replays/Share) | Replay saved + played back. Shared unit URL opens + adds to collection. Match share. Mobile native sheet. |
| 38 (Ad SDK) | Real ad loads + completes → unit. Ad fail → stub fallback. Interstitial every 3 matches. Ad events tracked. |
| 39 (i18n) | All strings localized (ES/JA). Forge in non-English. Language persists. English fallback for missing keys. |

---

## Implementation Order & Dependencies

```
30 (Audio) ──→ 32 (Settings — needs audio volume controls)
31 (Onboarding) ──────────────────────────────┐
33 (Quests) ──────────────────────────────────>├─→ 35 (Analytics — track all the above)
34 (Reconnect) ───────────────────────────────>┤
                                               ├─→ 36 (Leaderboard — needs analytics for cheat detection)
                                               ├─→ 37 (Replays/Share — needs analytics for share tracking)
                                               └─→ 38 (Ad SDK — needs analytics for ad revenue tracking)
                                                          └─→ 39 (i18n — last, mechanical)
```

- **30 first** — biggest feel win, lowest risk, no dependency.
- **31 + 32 next** — shippable UX baseline. 32 depends on 30 (volume controls).
- **33 + 34** — retention + robustness, independent of each other.
- **35 before 36/37/38** — analytics is the prerequisite for tuning leaderboard, replays, and ad revenue.
- **38 before 39** — ad SDK is higher revenue priority than i18n for soft launch.
- **39 last** — mechanical string extraction, no design risk.
- Each phase = 1 commit + 1 Playwright smoke test (never chrome-devtools). Push to `origin/main` after each.

---

## What This Tier Does NOT Do (out of scope)

- **Cloud save / cross-device sync** — saves stay in localStorage (with backup + migration). Cloud sync needs a backend + auth, separate effort.
- **Push notifications** — "your daily quest is ready" push. Needs a service worker + push service, separate effort.
- **Cosmetics / skins shop** — beyond the season rewards in Phase 36. A full cosmetics shop is a future monetization tier.
- **Guilds / social** — friends, guild wars. Needs a social backend, separate effort.
- **Live ops tooling** — server-side quest/event configuration. The quests in Phase 33 are client-generated; a live-ops backend is a post-launch investment.
- **A/B testing infrastructure** — analytics (Phase 35) captures data, but A/B test assignment is a separate system.
