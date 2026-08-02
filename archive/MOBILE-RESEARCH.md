# Mobile Strategy Research — One Solution for Android + iPhone

**Date:** 2026-07-31
**Goal:** Find a single solution to ship Prompt Showdown on both Android and iPhone without maintaining two codebases.

---

## TL;DR Recommendation

**Use Capacitor 7.** It wraps the existing web game in a native WebView shell, producing real `.ipa` and `.apk` files for the App Store and Google Play. Zero game code changes needed for the core game. P2P multiplayer needs a fallback strategy (see below).

**Setup time:** ~30 minutes to get a working build.
**Bundle size:** ~8-15 MB (game is ~400 KB + WebView is already on device).
**Code changes:** Minimal — mostly config files + P2P fallback.

---

## Why Capacitor (not the alternatives)

| Option | How it works | Fit for this game | Verdict |
|--------|-------------|-------------------|---------|
| **Capacitor 7** | Wraps web app in system WebView (WKWebView on iOS, Android WebView) | Perfect — game is already a vanilla HTML/JS/Canvas app. No rewrite. | **USE THIS** |
| Tauri 2 Mobile | Same WebView approach but Rust backend | Overkill — no Rust needed, game has no native backend logic. Mobile support is younger. | Skip |
| React Native + Expo | Rewrites UI in native components | Would require complete rewrite of Canvas rendering, all 10K lines of game logic. | Skip |
| Flutter | Dart + own renderer | Full rewrite in Dart. Canvas game doesn't translate. | Skip |
| PWA (install from browser) | Browser "Add to Home Screen" | Already works! But no App Store distribution, no native APIs, iOS limits PWA features. | Already have it — complement with Capacitor |
| Cordova | Predecessor to Capacitor | Deprecated. Capacitor is the modern successor. | Skip |

### Why Capacitor wins for this specific game

1. **The game is already a web app.** Everything is in `index.html` (10,560 lines) + 3 vendor files. No build step, no bundler, no framework. Capacitor just points at the folder and wraps it.

2. **Canvas 2D rendering works perfectly in WebView.** The game uses `<canvas>` with 2D context — no WebGL, no GPU shaders. This is the best-case scenario for WebView performance. Both WKWebView (iOS) and Android WebView (Chromium) handle Canvas 2D at 60fps.

3. **Procedural Web Audio works in WebView.** The game generates all audio via Web Audio API oscillators (no audio files). This works in both WebViews. The only caveat: audio must be initialized on user gesture (the game already does this at line 6661).

4. **The game already has mobile support.** It has:
   - `<meta viewport>` with `user-scalable=no` (line 5)
   - `touch-action:none` on canvas (line 109)
   - `navigator.vibrate()` for haptics (line 658)
   - Mobile detection via `ontouchstart` + `matchMedia` (line 657)
   - Pointer events (works for both touch and mouse)
   - PWA manifest + service worker (lines 10390-10436)
   - `apple-mobile-web-app-capable` meta tags (line 7)

5. **Tiny bundle size.** The game is ~400 KB (index.html + vendor). Capacitor adds ~6-8 MB of native shell. Total app: ~8-15 MB. Compare to React Native (15+ MB) or Flutter (17+ MB).

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Native App Shell              │
│  (Capacitor — Swift/Kotlin boilerplate) │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     System WebView                │  │
│  │  (WKWebView on iOS                │  │
│  │   Chromium WebView on Android)    │  │
│  │                                   │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   index.html (your game)    │  │  │
│  │  │   • Canvas 2D rendering     │  │  │
│  │  │   • Web Audio API           │  │  │
│  │  │   • localStorage/IndexedDB  │  │  │
│  │  │   • Trystero P2P (WebRTC)   │  │  │
│  │  │   • Web-LLM (forge)         │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Capacitor Plugin Bridge (JS ↔ Native)  │
│  • @capacitor/app (lifecycle/back btn)  │
│  • @capacitor/haptics (vibration)       │
│  • @capacitor/status-bar (safe areas)   │
│  • @capacitor/splash-screen             │
└─────────────────────────────────────────┘
```

The game code runs **unchanged** inside the WebView. Capacitor provides the native shell + optional plugins for native APIs.

---

## Step-by-Step Setup

### Prerequisites

- **Node.js** (for Capacitor CLI)
- **Xcode** (for iOS builds — macOS only)
- **Android Studio** (for Android builds — any OS)

### 1. Install Capacitor

```bash
cd /Users/tassio/Downloads/promptshowdown

# Initialize npm project (if not already)
npm init -y

# Install Capacitor
npm install @capacitor/core @capacitor/app @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
npm install -D @capacitor/cli

# Initialize Capacitor
npx cap init "Prompt Showdown" "com.promptshowdown.app" --web-dir=.
```

This creates `capacitor.config.ts`:
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.promptshowdown.app',
  appName: 'Prompt Showdown',
  webDir: '.',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  backgroundColor: '#080810',
  android: {
    backgroundColor: '#080810',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#080810',
    contentInset: 'always',
  },
};

export default config;
```

### 2. Add native platforms

```bash
npx cap add ios
npx cap add android
npx cap copy
```

### 3. Configure native projects

**iOS (Xcode):**
- Open `ios/App/App.xcworkspace` in Xcode
- Set signing team + bundle ID
- Add `NSLocalNetworkUsageDescription` to Info.plist (for WebRTC/P2P)
- Set orientation to portrait (or landscape — game is portrait-friendly)
- Set launch screen color to `#080810`

**Android (Android Studio):**
- Open `android/` in Android Studio
- Set min SDK to 24 (Android 7.0+)
- Add `<uses-permission android:name="android.permission.INTERNET" />` to AndroidManifest.xml
- Set theme to fullscreen/no-action-bar

### 4. Build and run

```bash
# Build web assets (no build step — just copy)
npx cap copy

# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android

# Or build from CLI
cd ios && pod install && cd ..
npx cap sync
```

### 5. Install lifecycle plugins (recommended)

```javascript
// Add to index.html (before closing </body>)
import { App as CapApp } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';
import { StatusBar } from '@capacitor/status-bar';

// Handle Android back button
CapApp.addListener('backButton', ({ canGoBack }) => {
  if (!canGoBack) {
    CapApp.exitApp();
  } else {
    window.history.back();
  }
});

// Pause game when app goes to background
CapApp.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) {
    // Pause battle loop
    if (Battle.running) Battle.paused = true;
    // Suspend audio
    GameAudio.suspend();
  } else {
    GameAudio.resume();
  }
});

// Style status bar
StatusBar.setStyle({ style: 'DARK' });
StatusBar.setBackgroundColor({ color: '#080810' });
```

---

## Known Issues + Mitigations

### Issue 1: WebRTC / P2P Multiplayer (MODERATE)

**Problem:** The game uses Trystero (WebRTC P2P) for multiplayer. WebRTC in WKWebView (iOS) has known issues:
- TURN relay can fail on cellular networks (stuck at "checking" state)
- Audio session conflicts (not relevant here — game uses Web Audio, not WebRTC audio streams)
- `capacitor://` scheme can cause `getUserMedia` permission issues (not relevant — game doesn't use camera/mic)

**Impact on this game:** The game uses Trystero for **data-only** P2P (unit serialization, match state sync). No audio/video streams. This is the simplest WebRTC case and is more likely to work. However, iOS WKWebView's WebRTC support is still less reliable than Safari.

**Mitigation strategy:**
1. **Primary:** Keep WebRTC P2P for when it works (WiFi, Android, browser).
2. **Fallback:** Add a WebSocket relay fallback for when WebRTC fails. Trystero already supports this — switch from `@trystero-p2p/torrent` to `@trystero-p2p/ws-relay` with a self-hosted relay server. This works everywhere WebRTC doesn't.
3. **Mobile default:** On mobile, default to bot matches (already the primary mode). P2P is a bonus feature, not core gameplay.

**Code change needed:**
```javascript
// Detect if running in Capacitor
const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform;

// Use WebSocket relay on native, torrent on web
const trysteroStrategy = isNative
  ? () => import('@trystero-p2p/ws-relay')  // More reliable in WebView
  : () => import('@trystero-p2p/torrent');   // Serverless on web
```

### Issue 2: Web-LLM CDN dependency (LOW)

**Problem:** The game loads `@mlc-ai/web-llm` from CDN (esm.run / jsdelivr) for the forge feature. In a native app, CDN access requires internet. If offline, forge won't work.

**Impact:** Low — forge is a secondary feature. The template fallback already handles LLM unavailability.

**Mitigation:**
1. **Bundle the LLM model** as a local asset (increases app size by ~50-200 MB depending on model).
2. **Or:** Keep CDN load + template fallback (current behavior). Show "Forge requires internet" message when offline.
3. **Or:** Use a smaller model that fits in the app bundle.

### Issue 3: Service Worker in WebView (LOW)

**Problem:** The game registers an inline service worker (line 10415) for offline caching. Service workers work in Android WebView but have quirks in WKWebView:
- Blob URL service workers may not register in WKWebView
- The `capacitor://` scheme doesn't support service workers

**Impact:** Low — the game already has IndexedDB fallback for save data. The service worker is only for caching the page itself for offline use.

**Mitigation:**
1. **In Capacitor, the game is already local** — it loads from the device filesystem, not a URL. Offline caching is unnecessary.
2. **Disable service worker registration on native:**
```javascript
if (!window.Capacitor?.isNativePlatform) {
  // Only register service worker in browser
  navigator.serviceWorker.register(swUrl);
}
```

### Issue 4: `backdrop-filter` on older Android (LOW)

**Problem:** `backdrop-filter:blur(8px)` (line 125) is used on the error panel. Not supported on Android WebView < Chrome 76.

**Impact:** Negligible — only affects the error panel styling. Modern Android devices (Android 10+) all support it.

**Mitigation:** Add a solid background fallback:
```css
#errorPanel {
  background: rgba(8, 8, 16, 0.95); /* Fallback */
  backdrop-filter: blur(8px);
}
```

### Issue 5: Clipboard API in WebView (LOW)

**Problem:** `navigator.clipboard.writeText()` (line 6920) may not work in WKWebView due to the custom URL scheme.

**Impact:** Low — only affects the "Share Unit" feature.

**Mitigation:** Use `@capacitor/clipboard` plugin:
```javascript
import { Clipboard } from '@capacitor/clipboard';

async function copyToClipboard(text) {
  if (window.Capacitor?.isNativePlatform) {
    await Clipboard.write({ string: text });
  } else {
    await navigator.clipboard.writeText(text);
  }
}
```

### Issue 6: Fullscreen API in WebView (LOW)

**Problem:** `requestFullscreen()` (line 663) doesn't work in WebView — the app is already fullscreen.

**Impact:** None — the fullscreen button is unnecessary in a native app.

**Mitigation:** Hide the fullscreen button on native:
```javascript
if (window.Capacitor?.isNativePlatform) {
  document.getElementById('fsBtn').style.display = 'none';
}
```

---

## What Works Without Changes

| Feature | WebView Support | Notes |
|---------|----------------|-------|
| Canvas 2D rendering | Full | 60fps on modern devices |
| Web Audio API (procedural) | Full | Must init on user gesture (already done) |
| localStorage | Full | Same as browser |
| IndexedDB | Full | Same as browser |
| requestAnimationFrame | Full | Same as browser |
| Pointer events (touch) | Full | Same as browser |
| `onclick` handlers | Full | Same as browser |
| CSS flexbox/grid/variables | Full | Same as browser |
| CSS animations | Full | Same as browser |
| `navigator.vibrate()` | Full (Android) | iOS: use `@capacitor/haptics` |
| Crypto API | Full | Same as browser |
| Visibility API | Full | Same as browser |
| LZ-string compression | Full | Same as browser |
| Template fallback (forge) | Full | Same as browser |
| Bot matches | Full | Same as browser |
| Quest/achievement system | Full | Same as browser |
| Save/load system | Full | Same as browser |
| All 21 abilities | Full | Same as browser |
| All 8 movement types | Full | Same as browser |
| All 13 targeting modes | Full | Same as browser |
| Spell system | Full | Same as browser |
| Arena mechanics | Full | Same as browser |

---

## App Store / Google Play Considerations

### Apple App Store

1. **WebView apps are allowed** but Apple rejects "thin wrappers" — the app must provide meaningful native functionality beyond just displaying a website. This game qualifies because:
   - It has offline play (all logic is client-side)
   - It has native haptics, status bar integration
   - It's a full game, not a website wrapper

2. **Required Info.plist entries:**
   - `NSLocalNetworkUsageDescription` — for P2P multiplayer
   - App Transport Security settings for CDN access

3. **No IAP needed initially** — the game's economy is all virtual coins.

### Google Play

1. **WebView apps are fully accepted.** No restrictions on wrapper apps.

2. **Required AndroidManifest entries:**
   - `INTERNET` permission (for P2P + CDN)
   - `VIBRATE` permission (for haptics)

3. **Target API level:** Must meet Google Play's current minimum (API 34+ as of 2026).

---

## Build Pipeline

```
Development:
  index.html (edit) → npx cap copy → npx cap open ios/android → test on device

Release:
  1. Bump version in capacitor.config.ts
  2. npx cap sync
  3. iOS:   npx cap open ios → Xcode → Product → Archive → Upload to App Store
  4. Android: npx cap open android → Build → Generate Signed APK/AAB → Upload to Play Console
```

No build step for the web code — `index.html` is the production build.

---

## Code Changes Summary

| Change | Lines | Priority | Effort |
|--------|-------|----------|--------|
| Add Capacitor config + plugins | ~50 new | Required | 30 min |
| Disable service worker on native | ~3 lines | Recommended | 2 min |
| P2P fallback (WebSocket relay) | ~20 lines | Recommended | 1 hour |
| Hide fullscreen button on native | ~3 lines | Cosmetic | 1 min |
| Clipboard plugin fallback | ~10 lines | Nice-to-have | 5 min |
| Haptics plugin for iOS | ~10 lines | Nice-to-have | 5 min |
| App lifecycle (pause/resume) | ~15 lines | Recommended | 10 min |
| **Total** | ~110 lines | | ~1.5 hours |

---

## Alternative: PWA-Only (No App Store)

The game is **already a PWA** (has manifest + service worker). Users can "Add to Home Screen" on both platforms.

**Pros:** Zero additional work, no App Store review, instant updates.
**Cons:**
- No App Store discoverability (the #1 way users find apps)
- iOS PWA limitations: no push notifications, 7-day cache eviction, no background audio
- No native API access (haptics, status bar)
- Feels less "real" to users

**Recommendation:** Ship as Capacitor app for App Store/Play Store distribution. Keep PWA as a fallback for web users. Same codebase, two distribution channels.

---

## Why Not React Native / Flutter / KMP?

These frameworks require **rewriting the entire game** in a different language (Dart, Kotlin, TypeScript-with-native-components). The game is 10,560 lines of vanilla JS with Canvas 2D rendering — it cannot be ported to these frameworks without a complete rewrite.

Capacitor is the only option that lets the existing code run **as-is** on both platforms.

---

## Final Recommendation

1. **Use Capacitor 7** to wrap the existing game for iOS + Android.
2. **Add WebSocket relay fallback** for P2P (Trystero supports this natively).
3. **Disable service worker** on native (unnecessary — app is already local).
4. **Add lifecycle handlers** (pause battle when app goes to background).
5. **Keep PWA** as the web distribution channel.
6. **Total effort:** ~1.5 hours of code changes + App Store/Play Store setup.
