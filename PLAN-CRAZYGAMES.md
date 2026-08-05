# PLAN-CRAZYGAMES.md — CrazyGames Integration Plan

## Executive Summary

Integrate the CrazyGames HTML5 SDK as the primary ad provider for Prompt Showdown.
CrazyGames offers a 50% revenue share (75% during 2-month exclusivity), no minimum
traffic requirements, 50M+ monthly players, and a simple JavaScript SDK with rewarded
+ midgame video ads. This replaces the current stub ad system with real monetization
and distribution.

---

## 1. Why CrazyGames

| Criteria | CrazyGames | AppLixir | GameDistribution | GamePix | AdSense |
|----------|-----------|----------|------------------|---------|---------|
| Revenue share | **50%** (75% exclusive) | 70% | 33% | 45% | 68% |
| Min traffic | **None** | 5,000 DAU | None | None | Approval |
| Distribution | **50M+ monthly players** | Self-hosted | 2000+ publishers | Partner network | Self-hosted |
| Integration | 1 script tag + callbacks | 1 script tag | 1 script tag | 1 script tag | AdSense code |
| Payout min | €100 | $100 | €100 | — | $100 |
| Payment terms | Net-60 (aims Net-10) | Net-30 | Net-60 | — | Net-30 |
| Rewarded ads | Yes | Yes | Yes | Yes | Yes (H5) |
| Midgame ads | Yes (auto-paced) | No | Yes | Yes | No |
| Banners | Yes | No | Yes | Yes | Yes |
| Adblock handling | SDK-managed | N/A | N/A | N/A | N/A |
| Cloud save | Yes (Data module) | No | No | No | No |
| Multiplayer SDK | Yes (invite/join) | No | No | No | No |

**Decision**: CrazyGames is the best fit because:
1. No traffic gate (unlike AppLixir's 5,000 DAU)
2. Highest revenue share among portal networks (50% vs GD's 33%, GamePix's 45%)
3. Distribution to 50M+ players (we get traffic, not just ads)
4. SDK handles ad pacing, adblock, fill rate — less code for us
5. Cloud save via Data module (cross-device progress)
6. Multiplayer invite system (complements our P2P)

---

## 2. SDK Overview

### 2.1 Loading the SDK

The CrazyGames SDK is loaded via a single script tag (CDN, ~35KB):

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

The SDK auto-initializes internally. No `init()` call needed for ad module.
For the Data module (cloud save), `await window.CrazyGames.SDK.init()` is required
during the loading screen.

### 2.2 Ad Module API

```js
// Access the ad module
const ad = window.CrazyGames.SDK.ad;

// Request a rewarded ad (player opts in for a reward)
const callbacks = {
  adStarted:  () => { /* mute audio, pause game */ },
  adFinished: () => { /* unmute audio, resume game, GRANT REWARD */ },
  adError:    (error) => { /* unmute audio, resume game, DO NOT reward */ },
};
ad.requestAd("rewarded", callbacks);

// Request a midgame ad (auto-shown at natural breaks)
const callbacks2 = {
  adStarted:  () => { /* mute audio, pause game */ },
  adFinished: () => { /* unmute audio, resume game */ },
  adError:    (error) => { /* unmute audio, resume game */ },
};
ad.requestAd("midgame", callbacks2);
```

### 2.3 Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `adsDisabledBasicLaunch` | Basic Launch phase (ads off) | Continue game, no reward |
| `unfilled` | No ad available | Continue game, no reward |
| `adblock` | Adblocker detected | Continue game, no reward |
| `adCooldown` | Requested too soon (midgame: 3 min) | Continue game |
| `other` | Unknown error | Continue game |

**Critical rule**: For rewarded ads, only grant the reward on `adFinished`.
On `adError`, do NOT reward the player. This differs from our current stub
behavior (which always rewards). The CrazyGames SDK provides fallback banners
for unfilled rewarded ads.

### 2.4 Game Module API

```js
const game = window.CrazyGames.SDK.game;

// Gameplay tracking (required for Full Launch)
game.gameplayStart();  // Call when player enters gameplay (battle starts)
game.gameplayStop();   // Call on every break (menu, pause, level end)

// Loading tracking (optional but recommended)
game.loadingStart();   // Call when game starts loading
game.loadingStop();    // Call when loading is complete

// Happy time (optional — confetti on achievements)
game.happytime();      // Call on boss kills, match wins, etc.

// Settings (required: muteAudio support)
const settings = game.settings;
// settings.muteAudio — if true, disable all game audio
// settings.disableChat — if true, disable chat (N/A for us)
game.addSettingsChangeListener((newSettings) => {
  // React to mute/unmute from CrazyGames UI
});
```

### 2.5 Data Module API (Cloud Save)

```js
// Initialize during loading screen (preloads user data)
await window.CrazyGames.SDK.init();

// Same API as localStorage
const data = window.CrazyGames.SDK.data;
data.setItem("saveKey", JSON.stringify(saveData));
const loaded = data.getItem("saveKey");
data.removeItem("saveKey");
data.clear();
```

**Limits**: 1MB max data, debounced saves (1s default, up to 30s).
Guest users: data stored in localStorage. Logged-in users: synced across devices.

### 2.6 Adblock Detection

```js
const hasAdblock = await window.CrazyGames.SDK.ad.hasAdblock();
// true = adblocker detected
// Game must still be playable — block bonus content, not core gameplay
```

---

## 3. Integration Plan

### 3.1 New Provider: `CrazyGamesAdProvider`

Add to `src/utils.js` alongside existing providers:

```js
const CrazyGamesAdProvider = {
  available: false,
  _initialized: false,

  async init() {
    if (this._initialized) return;
    this._initialized = true;
    // SDK is loaded via script tag in index.html, auto-initializes
    if (typeof window.CrazyGames !== "undefined" && window.CrazyGames.SDK) {
      this.available = true;
    }
  },

  showRewarded(opts) {
    return new Promise(resolve => {
      if (!this.available || !window.CrazyGames?.SDK?.ad) {
        resolve({ viewed: false, dismissed: true, error: "sdk_unavailable" });
        return;
      }
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        window.CrazyGames.SDK.ad.requestAd("rewarded", {
          adStarted:  () => { opts.beforeAd?.(); },
          adFinished: () => { opts.afterAd?.(); done({ viewed: true, dismissed: false }); },
          adError:    (error) => {
            console.warn("[X7] CrazyGames rewarded ad error:", error);
            opts.afterAd?.();
            done({ viewed: false, dismissed: true, error: error?.code });
          },
        });
      } catch (e) {
        console.warn("[X7] CrazyGames rewarded ad failed:", e);
        done({ viewed: false, dismissed: true, error: "exception" });
      }
    });
  },

  showInterstitial(opts) {
    return new Promise(resolve => {
      if (!this.available || !window.CrazyGames?.SDK?.ad) {
        resolve({ shown: false });
        return;
      }
      try {
        window.CrazyGames.SDK.ad.requestAd("midgame", {
          adStarted:  () => { opts.beforeAd?.(); },
          adFinished: () => { opts.afterAd?.(); resolve({ shown: true }); },
          adError:    (error) => {
            console.warn("[X7] CrazyGames midgame ad error:", error);
            opts.afterAd?.();
            resolve({ shown: false, error: error?.code });
          },
        });
      } catch (e) {
        resolve({ shown: false, error: "exception" });
      }
    });
  },
};
window.CrazyGamesAdProvider = CrazyGamesAdProvider; // prevent tree-shaking
```

### 3.2 Provider Selection Logic

Update `AdSDK._ensureProvider()` in `src/utils.js`:

```js
async _ensureProvider() {
  if (this._providerLoaded) return;
  this._providerLoaded = true;

  // Priority 1: CrazyGames SDK (if loaded — we're on CrazyGames portal)
  if (typeof window.CrazyGames !== "undefined" && window.CrazyGames.SDK) {
    CrazyGamesAdProvider.available = true;
    this.provider = CrazyGamesAdProvider;
    this.loaded = true;
    console.log("[X7] Using CrazyGames ad provider");
    return;
  }

  // Priority 2: H5 AdSense (if publisher ID configured)
  if (H5AdProvider._publisherId) {
    try {
      const ok = await H5AdProvider.load();
      this.provider = ok ? H5AdProvider : StubAdProvider;
    } catch (e) {
      this.provider = StubAdProvider;
    }
  } else {
    // Priority 3: Stub (self-hosted, no ad network)
    this.provider = StubAdProvider;
  }
  this.loaded = true;
}
```

### 3.3 Rewarded Ad Reward Logic Change

**Current behavior** (stub): Always grant reward, even on error/skip.
**CrazyGames behavior**: Only grant reward on `adFinished`. On `adError`, do NOT reward.

Update `AdSDK.showRewarded()`:

```js
showRewarded(duration, onComplete, opts = {}) {
  if (this.adFree) {
    onComplete({ rewarded: true }); // ad-free: always reward
    return;
  }
  this._ensureProvider().then(async () => {
    const provider = this.provider || StubAdProvider;
    this._beforeAd();
    try {
      const result = await provider.showRewarded({
        duration: duration || FORGE_AD_MS,
        name: opts.name || "forge",
        beforeAd: () => {},
        afterAd: () => {},
      });
      // CrazyGames: only reward on viewed=true
      // Stub: always rewards (viewed=true)
      const shouldReward = result.viewed === true || (this.provider === StubAdProvider);
      this._afterAd();
      onComplete({ rewarded: shouldReward, ...result });
    } catch (e) {
      this._afterAd();
      onComplete({ rewarded: false, error: true });
    }
  });
}
```

**Update call sites** in `src/ui.js` to check `rewarded` flag:

```js
// Before (always rewards):
const adPromise = watchAd ? new Promise(res => AdSDK.showRewarded(FORGE_AD_MS, res)) : Promise.resolve();

// After (checks reward flag):
const adPromise = watchAd ? new Promise(res => AdSDK.showRewarded(FORGE_AD_MS, (result) => res(result))) : Promise.resolve({ rewarded: true });
// ... later:
if (watchAd && adResult.rewarded === false) {
  toast("Ad not completed — using template generation instead");
  // Fall back to template (no LLM)
}
```

### 3.4 SDK Script Tag

Add to `index.html` `<head>` (before our main script):

```html
<!-- CrazyGames SDK — loaded on CrazyGames portal, no-op elsewhere -->
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

The SDK is ~35KB. It auto-detects environment:
- On CrazyGames portal: full functionality (ads, data, user, game events)
- On localhost/127.0.0.1: "local" mode (overlay text instead of ads, console output)
- On other domains: SDK present but ads may not serve (graceful fallback to stub)

### 3.5 Game Module Integration

Add gameplay tracking to `src/ui.js` `screen()`:

```js
screen(id) {
  // ... existing code ...

  // CrazyGames gameplay tracking
  if (window.CrazyGames?.SDK?.game) {
    const game = window.CrazyGames.SDK.game;
    if (id === "battle" || id === "draft") {
      game.gameplayStart();
    } else {
      game.gameplayStop();
    }
  }
}
```

Add loading tracking to `src/game.js` init:

```js
// At start of init():
if (window.CrazyGames?.SDK?.game) {
  window.CrazyGames.SDK.game.loadingStart();
}
// At end of init() (after splash removed):
if (window.CrazyGames?.SDK?.game) {
  window.CrazyGames.SDK.game.loadingStop();
}
```

Add happytime on match win:

```js
// In Match.onMatchEnd() when player wins:
if (winner === "player" && window.CrazyGames?.SDK?.game) {
  window.CrazyGames.SDK.game.happytime();
}
```

### 3.6 Audio Mute Compliance (Required)

CrazyGames requires respecting `settings.muteAudio`. Add to `src/game.js` init:

```js
// Apply CrazyGames mute setting (overrides in-game setting)
if (window.CrazyGames?.SDK?.game) {
  const applyMute = (settings) => {
    if (settings.muteAudio) {
      GameAudio.enabled = false;
      GameAudio.applyVolumes?.();
    }
  };
  applyMute(window.CrazyGames.SDK.game.settings);
  window.CrazyGames.SDK.game.addSettingsChangeListener(applyMute);
}
```

### 3.7 Cloud Save (Data Module) — Phase 2 (Optional)

The Data module mirrors localStorage API. To integrate:

1. During init, if CrazyGames SDK is present, call `await SDK.init()` (preloads data)
2. Wrap save/load functions to use `SDK.data` instead of `localStorage` when available
3. Migrate existing localStorage data to Data module on first load

```js
// In save.js — abstract storage layer
const Storage = {
  getItem(key) {
    if (window.CrazyGames?.SDK?.data) return window.CrazyGames.SDK.data.getItem(key);
    return localStorage.getItem(key);
  },
  setItem(key, value) {
    if (window.CrazyGames?.SDK?.data) return window.CrazyGames.SDK.data.setItem(key, value);
    return localStorage.setItem(key, value);
  },
};
```

**Note**: Our save data is JSON. Check it fits in 1MB limit (it should — saves are
typically <100KB). The Data module debounces writes (1s), which is fine for our
save-on-change pattern.

**Defer to Phase 2**: Cloud save is nice-to-have but not required for launch.
The game already works with localStorage. Add cloud save after initial approval.

### 3.8 Midgame Ad Placements

CrazyGames auto-paces midgame ads (max 1 per 3 minutes). We just call `requestAd("midgame")`
at natural breaks. Good placements for Prompt Showdown:

1. **After each match** (between rounds) — natural break, player just finished a battle
2. **On result screen** — after seeing match results, before returning to menu

Add to `src/ui.js` result screen:

```js
// In result screen show logic:
if (this.save.matchCount % 3 === 0) {
  // Replace AdSDK.showInterstitial() with:
  if (window.CrazyGames?.SDK?.ad) {
    window.CrazyGames.SDK.ad.requestAd("midgame", {
      adStarted: () => { GameAudio.enabled = false; Battle.paused = true; },
      adFinished: () => { GameAudio.enabled = true; Battle.paused = false; },
      adError: () => { GameAudio.enabled = true; Battle.paused = false; },
    });
  } else {
    AdSDK.showInterstitial(); // fallback for non-CrazyGames
  }
}
```

### 3.9 Rewarded Ad Placements

Current: Forge (watch ad to generate unit with LLM). Keep this.

Additional placements to consider (Phase 2):
- **Double coins** after match win (opt-in, doubles coin reward)
- **Free unit upgrade** in upgrade screen (watch ad instead of paying coins)
- **Reroll refill** in draft (watch ad for extra reroll)

**CrazyGames rules for rewarded ads**:
- Don't offer too often (use timer/cooldown on button)
- Don't chain multiple ads for one reward
- Button must be clearly optional (equal-size skip option)
- Must show video icon (clear it's an ad)
- Provide alternative (buy with coins)
- Don't offer on active gameplay screen

Our forge ad flow already complies: confirmation dialog with equal "Watch Ad" / "Skip"
buttons, video icon (📺), and skip uses template generation (alternative).

---

## 4. Requirements Compliance Checklist

### Technical Requirements
- [x] **File size ≤ 250MB** — our build is ~570KB (single HTML file)
- [x] **Initial download ≤ 50MB** — 570KB, well under limit
- [x] **Initial download ≤ 20MB** (mobile homepage) — 570KB qualifies
- [x] **File count ≤ 1500** — single file (1 file)
- [x] **Relative paths only** — Vite singlefile inlines everything
- [x] **Chrome + Edge compatibility** — already tested
- [x] **Safari support** — works (with WebGPU fallback to templates)
- [x] **Chromebook (4GB RAM)** — game runs fine on low-memory devices
- [x] **Mouse + keyboard + touch** — already supported
- [x] **Landscape on desktop** — already supported
- [ ] **`user-select: none` CSS** — add to body (mobile anti-select)
- [x] **Web-llm from CDN** — not bundled, loads at runtime (doesn't count toward size)

### Gameplay Requirements
- [x] **English localization** — already has i18n with English
- [x] **Readable on devicePixelRatio:1** — UI scales responsively
- [x] **Consistent physics across refresh rates** — fixed timestep (deterministic)
- [x] **Intuitive controls** — tap/click interface
- [x] **Smooth performance** — 60fps target, perf-optimized
- [x] **Originality** — LLM-generated units, unique concept
- [ ] **Remove custom fullscreen button** — CrazyGames provides fullscreen
- [x] **No cross-promotion** — no links to other games
- [x] **PEGI 12 compliant** — no violence beyond cartoon combat

### Advertisement Requirements
- [x] **Ads don't interrupt gameplay** — forge ad is opt-in, midgame at match end
- [x] **Game paused during ad** — `_beforeAd()` pauses battle + mutes audio
- [x] **Handle unfilled ads** — `adError` callback resumes game
- [x] **Game muted during ad** — `_beforeAd()` mutes GameAudio
- [x] **Midgame at natural breaks** — after match, not during gameplay
- [x] **Rewarded: not too often** — forge is opt-in, confirmation dialog
- [x] **Rewarded: no chaining** — one ad per forge
- [x] **Rewarded: button not misleading** — equal-size Watch/Skip buttons
- [x] **Rewarded: clear it's an ad** — 📺 icon, "Watch Ad" text
- [x] **Rewarded: alternative exists** — Skip = template generation
- [x] **Rewarded: no reward on error** — updated logic (Section 3.3)
- [ ] **Only CrazyGames SDK ads** — must remove AdSense/H5 provider when on CG

### SDK Integration (Full Launch)
- [ ] **Gameplay start/stop events** — Section 3.5
- [ ] **Loading start/stop events** — Section 3.5
- [ ] **muteAudio support** — Section 3.6
- [ ] **Data module** (if progress save) — Phase 2 (Section 3.7)
- [ ] **User module** (if account integration) — Phase 2 (optional)

---

## 5. Implementation Phases

### Phase 1: Core SDK + Ads (Required for Full Launch)
1. Add CrazyGames SDK script tag to `index.html`
2. Add `CrazyGamesAdProvider` to `src/utils.js`
3. Update `AdSDK._ensureProvider()` provider selection
4. Update `AdSDK.showRewarded()` reward logic (only reward on `adFinished`)
5. Update forge call sites in `src/ui.js` to handle `rewarded: false`
6. Add gameplay start/stop tracking in `screen()` (`src/ui.js`)
7. Add loading start/stop in `G.init()` (`src/game.js`)
8. Add `muteAudio` compliance (`src/game.js`)
9. Add `user-select: none` CSS to body (`src/style.css` or `index.html`)
10. Remove/hide custom fullscreen button when on CrazyGames
11. Build + test locally (SDK shows overlay text in local mode)
12. Upload to CrazyGames developer portal for QA

### Phase 2: Cloud Save + Multiplayer (Post-Launch)
1. Integrate Data module for cross-device save sync
2. Migrate localStorage data to Data module on first load
3. Integrate User module (CrazyGames username/avatar in game)
4. Integrate multiplayer invite system (Room data, invite link)
5. Add happytime() on match wins
6. Add additional rewarded ad placements (double coins, free upgrade)

### Phase 3: AppLixir (When 5,000 DAU)
1. Add `AppLixirAdProvider` to `src/utils.js`
2. Update provider selection: AppLixir for self-hosted, CrazyGames for portal
3. A/B test CPMs between providers

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QA rejection | Delayed launch | Follow requirements checklist exactly |
| Ad fill rate low | Low revenue | CrazyGames provides fallback banners; SDK handles pacing |
| web-llm model download > 20s | QA failure | Model loads from CDN after gameplay starts (not initial load) |
| No WebGPU on some devices | No LLM forge | Falls back to procedural template generation (already works) |
| P2P multiplayer on CrazyGames | May not work in iframe | CrazyGames has own multiplayer SDK; our P2P works via WebRTC regardless |
| Save data > 1MB | Cloud save fails | Our saves are <100KB; check before enabling Data module |
| Adblock users | No ad revenue | Game must remain playable; block bonus content only |
| SDK conflicts with our code | Runtime errors | SDK is isolated; we only call it when `window.CrazyGames` exists |

---

## 7. Revenue Projections

Based on CrazyGames data (50M+ monthly players, ad revenue share):

| Scenario | Monthly Plays | Est. Revenue/1000 plays | Monthly Revenue | Our Share (50%) |
|----------|--------------|------------------------|-----------------|-----------------|
| Low | 10,000 | $3–5 | $30–50 | $15–25 |
| Moderate | 100,000 | $3–5 | $300–500 | $150–250 |
| Good | 500,000 | $3–5 | $1,500–2,500 | $750–1,250 |
| Viral | 2,000,000 | $3–5 | $6,000–10,000 | $3,000–5,000 |

Note: Revenue per 1000 plays varies by geography, ad format mix, and engagement.
Tier 1 markets (US, UK, CA, DE, AU) earn higher CPMs. Rewarded ads earn more
than midgame ads. These are conservative estimates.

---

## 8. Submission Process

1. **Register** at https://developer.crazygames.com/games
2. **Upload** the built `dist/index.html` (zip it)
3. **Basic Launch**: 2-week limited audience test (ads disabled, metrics checked)
   - Our game has single-player + bot mode, so Basic Launch works
4. **Full Launch**: Global release after Basic Launch metrics are good
   - Ads enabled, revenue share starts
   - Must have Full SDK Integration (gameplay events, muteAudio)
5. **Payouts**: Set up payment method in developer portal (Tipalti)
   - Min €100 payout, monthly payments
   - NET-60 terms (they aim for NET-10 in practice)

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add CrazyGames SDK script tag, add `user-select:none` CSS |
| `src/utils.js` | Add `CrazyGamesAdProvider`, update `_ensureProvider()`, update `showRewarded()` reward logic |
| `src/ui.js` | Update forge call sites to handle `rewarded:false`, add gameplay start/stop in `screen()`, update interstitial to use CrazyGames midgame |
| `src/game.js` | Add loading start/stop, add `muteAudio` compliance, hide fullscreen button on CrazyGames |
| `src/style.css` | Add `user-select: none` to body (mobile requirement) |

No changes to: `src/battle.js`, `src/forge.js`, `src/network.js`, `src/save.js` (Phase 1).
