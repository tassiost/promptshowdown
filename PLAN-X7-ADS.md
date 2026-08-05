# PLAN-X7-ADS.md — Real Ad System Integration

## Goal

Replace the current stub `AdSDK` (`src/utils.js:414`) with a real, production-grade
ad system that supports **rewarded video** and **interstitial** ads across web and
mobile (PWA) environments, while always preserving the "always give the reward"
design principle (ads are optional, never block gameplay progress).

## Current State

- `AdSDK` (`src/utils.js:414`) is a stub with `load()`, `showRewarded()`, `showInterstitial()`.
- `showAdStub()` (`src/forge.js:2037`) shows a fake countdown overlay (1s by default).
- Ad calls:
  - Forge: `showRewarded(FORGE_AD_MS, callback)` — gates LLM forge generation (`ui.js:3528,3569`).
  - Match end: `showInterstitial()` every 3 matches (`ui.js:2661`).
- `AdSDK.sdk` field exists for future real SDK injection but is never set.
- Analytics tracks `ad_loaded`, `ad_complete`, `ad_skip` events.

## Design Principles

1. **Always give the reward** — if an ad fails to load or is skipped, the player still
   gets the forged unit / spell. Ads gate *how long you wait*, not *whether you succeed*.
2. **Graceful degradation** — no real SDK → fall back to stub. SDK throws → fall back to stub.
3. **Audio + game pause** — mute audio and pause the battle loop while an ad plays.
4. **Frequency capping** — interstitials max 1 per 60s; rewarded has no cap (player-initiated).
5. **Privacy-first** — no tracking pixels, no third-party cookies. SDK loaded lazily only
   when the user taps "Forge" (not on page load).
6. **PWA-friendly** — works in standalone iOS/Android mode; falls back to stub if no SDK.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Game Code (ui.js, forge.js)                            │
│    calls AdSDK.showRewarded() / showInterstitial()      │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│  AdSDK (src/utils.js) — unified facade                  │
│    - detects environment (web / PWA / WebView)          │
│    - routes to provider if loaded, else stub            │
│    - frequency caps, audio pause/resume, analytics      │
└────────┬──────────────────┬─────────────────────────────┘
         │                  │
┌────────▼────────┐  ┌──────▼─────────────────────────────┐
│  Provider:      │  │  Provider: Stub (fallback)         │
│  H5 Ad API      │  │    showAdStub() — fake countdown   │
│  (Google AFG)   │  │    Always calls onComplete         │
│  adBreak()      │  └────────────────────────────────────┘
└─────────────────┘
```

## Provider: Google H5 Games Ad API (AdSense for Games)

The H5 Games Ads API (formerly AdSense for Games / AFG) is the standard for HTML5
game ad monetization on the web. It provides:
- `adBreak(placementConfig)` — defines an ad placement (interstitial or rewarded).
- `adConfig(config)` — configures the SDK (sound, test mode).

### Integration Steps

1. **Lazy-load the SDK script** only when the user first taps "Forge" or reaches a
   match-end interstitial point. This avoids loading ad scripts on the menu screen
   (privacy + performance).

2. **Detect availability**: check `window.adsbygoogle` or `window.adBreak` after load.
   If unavailable (ad blocker, offline, unsupported region), fall back to stub.

3. **Rewarded ad**:
   ```js
   adBreak({
     type: 'reward',           // rewarded placement
     name: 'forge_unit',
     beforeAd: () => { Audio.muteAll(); Battle.pause(); },
     afterAd: () => { Audio.unmuteAll(); Battle.resume(); },
     beforeReward: (showAdFn) => { showAdFn(); },  // always show
     adDismissed: () => { onComplete(); },  // still give reward
     adViewed: () => { onComplete(); },
     adBreakDone: (b) => { onComplete(); }, // always called
   });
   ```

4. **Interstitial ad**:
   ```js
   adBreak({
     type: 'next',             // between-level interstitial
     name: 'match_end',
     beforeAd: () => { Audio.muteAll(); },
     afterAd: () => { Audio.unmuteAll(); },
     adBreakDone: () => {},
   });
   ```

### Test Mode

During development, set `data-ad-test="on"` on the SDK script tag. **Never click
live ads in test mode** — Google will ban the account.

## Implementation Plan

### Phase 1: Enhanced AdSDK Facade (`src/utils.js`)

Rewrite `AdSDK` to support:
- **Lazy provider loading**: `loadProvider()` loads the H5 Games Ads script on demand.
- **Environment detection**: `isWebView`, `isStandalone`, `isBrowser`.
- **Frequency capping**: `_lastInterstitial` timestamp, min 60s between interstitials.
- **Audio pause/resume**: hooks into `GameAudio.mute()` / `unmute()`.
- **Battle pause**: hooks into `Battle.pause()` / `resume()` if a battle is running.
- **Provider abstraction**: `provider.showRewarded(opts)` / `provider.showInterstitial(opts)`.
  Two providers: `H5AdProvider` (real) and `StubAdProvider` (fallback).

### Phase 2: Stub Provider Enhancement (`src/forge.js`)

Improve `showAdStub()`:
- Show a realistic ad placeholder (not just a countdown) — a fake "Your ad here" card.
- Variable duration (configurable, default 5s for more realism).
- Skip button appears after 3s (simulates skippable ads).
- Always calls `onComplete()` regardless of skip.

### Phase 3: H5 Games Ads Provider (`src/utils.js`)

Implement `H5AdProvider`:
- `load()`: injects `<script>` tag with AdSense for Games SDK (test mode configurable).
- `showRewarded(opts)`: calls `adBreak()` with reward callbacks.
- `showInterstitial(opts)`: calls `adBreak()` with interstitial config.
- Error handling: any failure → reject → AdSDK falls back to stub.

### Phase 4: Settings Integration

Add to settings screen (`src/ui.js`):
- "Ad-free mode" toggle (skips all ads, no rewards gating — for paying users / accessibility).
- When enabled, `AdSDK.showRewarded()` resolves immediately, `showInterstitial()` is a no-op.

### Phase 5: Placement Polish

- **Rewarded**: forge unit, forge spell, revive after loss (future).
- **Interstitial**: every 3 matches (existing), with 60s frequency cap.
- **Banner**: NOT implementing (low eCPM, high churn per research).

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils.js` | Rewrite `AdSDK` with provider abstraction, frequency caps, audio/pause hooks |
| `src/forge.js` | Enhance `showAdStub()` with realistic placeholder + skip button |
| `src/ui.js` | Add "Ad-free mode" toggle in settings; wire up audio/pause hooks |
| `src/game.js` | Export `AdSDK` (already done) |

## What We're NOT Doing

- **Banner ads** — lowest eCPM, highest churn (per research). Skipped.
- **Real AdMob account** — needs a Google account + AdSense approval. The code is
  ready; the user just needs to add their publisher ID.
- **IAP (in-app purchases)** — separate effort, not part of X7.
- **Offerwalls** — too complex for a P2P game, skipped.
- **Third-party ad networks** (ironSource, Unity Ads) — H5 Games API is the standard
  for web games; others require native SDKs.

## Testing

1. **Stub mode** (default): verify forge still works, stub shows improved UI.
2. **Ad-free toggle**: verify ads are skipped completely.
3. **Frequency cap**: verify interstitial doesn't fire more than once per 60s.
4. **Audio pause**: verify audio mutes during ad and resumes after.
5. **Battle pause**: verify battle pauses during ad in single-player.
6. **Fallback**: if H5 SDK fails to load, verify stub is used seamlessly.

## References

- [Google Ad Placement API](https://developers.google.com/ad-placement/)
- [H5 Games Ads Guide (Boomie Studio)](https://boomiestudio.com/blog/h5-games-ads-guide)
- [AppLixir Monetization Guide](https://www.applixir.com/blog/the-ultimate-monetization-upgrade-path-for-indie-web-games/)
