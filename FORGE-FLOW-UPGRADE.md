# Forge Flow UX Upgrade

**Status:** design ready  
**Goal:** get the LLM ready before the player reaches the forge, surface download progress with speed + ETA, and make the ad-gated generation fast and debuggable (including the template skip path).

---

## 1. Start LLM download as soon as the app opens

### Current behavior

- `loadModules()` (around `index.html:586`) fetches `@mlc-ai/web-llm` and assigns it to `W`.
- `G.init()` then runs, and only *after* it `preloadAI()` is called (`index.html:11149`).
- That means the model download starts after UI init, not at app open.

### Proposed change

Kick off `initLLM()` immediately after `W` is set, without waiting for `G.init()`.

In `loadModules()`:

```js
async function loadModules(){
  const webllmUrls=[...];
  for(const url of webllmUrls){
    try{W=await import(url);break;}
    catch(e){console.warn("web-llm import failed ("+url+"): "+e.message);}
  }
  // NEW: start LLM download in the background as soon as the module is here.
  if(W && navigator.gpu){
    preloadAI().catch(e=>console.warn("early preloadAI error:",e.message));
  }
  // ...trystero + lz-string imports...
}
```

Leave `preloadAI()` itself unchanged — it already guards on `navigator.gpu` and `W`. The only change is *when* it is invoked.

### Optional splash-screen hint

If the user reaches the main menu while the model is still loading, the existing `aiStatus` badge already shows `AI: Loading...`. This is sufficient; no extra splash work is required.

---

## 2. Forge progress bar with download speed + ETA

### Current behavior

- `initLLM()` already has a progress callback (`index.html:1220` and `:1227`) that receives `p.progress` (0–1).
- `updateAI()` writes only a percentage to `#forgeModelText` and fills `#forgeModelFill`.
- There is no speed or time estimate.

### Proposed change

Track progress samples in the callback and derive `%/s` + ETA. Add small text nodes under the existing progress bar in the forge DOM.

```html
<!-- index.html around the existing #forgeModelProgress block -->
<div id="forgeModelProgress" ...>
  <div class="detail" id="forgeModelText">Loading AI model...</div>
  <div style="...progress bar...">
    <div id="forgeModelFill"></div>
  </div>
  <!-- NEW -->
  <div class="detail" id="forgeModelStats" style="margin-top:6px;font-size:.7rem;color:var(--muted);"></div>
</div>
```

In `initLLM()`, capture start time and the last sample:

```js
let llmStartTime=Date.now();
let llmLastSample={t:0,p:0};

function updateAIFromProgress(p){
  const now=Date.now();
  const elapsed=(now-llmStartTime)/1000;
  const pct=Math.floor(p.progress*100);

  // speed in % per second
  let speed=0;
  if(elapsed>0) speed=(p.progress*100)/elapsed;

  // simple ETA: (remaining %)/(%/s)
  let eta="";
  if(speed>0.1){
    const s=Math.ceil((100-pct)/speed);
    eta=`~${s}s left`;
  }

  let text=`Downloading AI ${pct}%`;
  if(pct<100 && speed>0){
    text+=` · ${speed.toFixed(1)}%/s · ${eta}`;
  }
  if(pct>=100) text="AI ready";

  updateAI(text,pct);
  const stats=$("forgeModelStats");
  if(stats) stats.innerText=`${pct}% downloaded · ${speed.toFixed(1)}% per second · ${eta}`;
}
```

Then call `updateAIFromProgress(p)` from both `CreateWebWorkerMLCEngine` and `CreateMLCEngine` `initProgressCallback`s (replace the current inline `updateAI` call).

Reset `llmStartTime` and clear `#forgeModelStats` in `cancelLLM()`.

---

## 3. "Watch Ad to Generate" should be 1 second

### Current behavior

- `_doForge()` calls `AdSDK.showRewarded(15000,res)` for both unit and spell forges (`index.html:9478`, `index.html:9507`).
- `showAdStub()` (`index.html:2785`) counts down with a 1-second interval.

### Proposed change

Introduce one constant for the forge ad duration and use it in both call sites.

Near the `AdSDK` definition (`index.html:930`):

```js
const FORGE_AD_MS = 1000; // was 15000
```

Update `_doForge()`:

```js
const adPromise=watchAd?new Promise(res=>AdSDK.showRewarded(FORGE_AD_MS,res)):Promise.resolve();
```

In `showAdStub()`, add debug start/end logging:

```js
function showAdStub(duration,onComplete){
  console.log("[Ad] stub start",duration+"ms");
  // ...existing overlay code...
  // on completion:
  console.log("[Ad] stub complete");
  onComplete();
}
```

With `duration=1000` the `remaining` counter starts at `1` and closes after the first `setInterval` tick, so the player sees a brief "Ad: 1s..." and can continue.

---

## 4. Verbose debug logging for prompts + JSON

### Where to log

Add a `debugForge()` helper near the LLM state (`index.html:1143`):

```js
function debugForge(...args){
  console.log("[Forge]",...args);
}
```

### 4.1 Top-level flow

In `G._doForge()` (`index.html:9457`):

```js
debugForge("_doForge start",{prompt,watchAd,forgeMode:this.forgeMode,canUseLLM});
```

and at the end:

```js
debugForge("_doForge result",{unit,spell:this.pendingForgeSpell});
```

### 4.2 LLM generation path

In `generateUnit()` (`index.html:2641`):

```js
debugForge("generateUnit start",{rawPrompt,prompt,arenaIndex});
const cached=await cacheGet(key);
if(cached){debugForge("generateUnit cache hit",cached);return cached;}
debugForge("generateUnit cache miss");
```

When `llmReady`, log each field:

```js
for(const field of FIELD_ORDER){
  // ...existing retry loop...
  debugForge("askField",{field,prompt,attempt,val});
}
debugForge("generateUnit attrs",attrs);
debugForge("generateUnit final unit",u);
```

Do the same in `generateSpell()` (`index.html:2739...`) with `SPELL_FIELD_ORDER` and the spell object.

### 4.3 LLM per-field prompt/response

In `askField()` (`index.html:2546`), log the prompt, the system context, and the parsed result:

```js
debugForge("askField prompt",{field,user,sys});
debugForge("askField response",{field,answer,parsed});
```

### 4.4 Template fallback path

In `templateFallback()` and `templateSpellFallback()` (`index.html` around Phase 12/23 templates), log the chosen fallback:

```js
debugForge("templateFallback",{prompt,match:match?.a.name||null,attrs});
```

Also log in `attrsToUnit()` if a template fallback is being converted.

### 4.5 Skip-ad / template path

The "Skip Ad" button says it uses a template. Make `_doForge(prompt,false)` actually use the template path and log it:

```js
if(!watchAd || !canUseLLM){
  debugForge("using template fallback",{watchAd,canUseLLM});
  genPromise=Promise.resolve(
    this.forgeMode==="spell"
      ? {...templateSpellFallback(prompt),_isSpell:true}
      : attrsToUnit(templateFallback(prompt),arenaIdx)
  );
}
```

This ensures the skip button behavior matches its label and the debug logs clearly show the generated JSON.

---

## 5. Files and functions to touch

- `index.html:578-616` — `loadModules()`: start `preloadAI()` as soon as `W` is available.
- `index.html:1190-1263` — `initLLM()`: add speed/ETA computation; hook `initProgressCallback`.
- `index.html:930-949` — `AdSDK` + new `FORGE_AD_MS` constant.
- `index.html:9394-9605` — `G` forge methods (`forge`, `_doForge`, `_showModelProgress`, `_hideModelProgress`): log flow, use `FORGE_AD_MS`, fix skip-ad to template.
- `index.html:2546-2577` — `askField()`: log prompt/response/parsed value.
- `index.html:2637-2687` — `generateUnit()`: log cache hit/miss, per-field values, final JSON.
- `index.html:2689-2783` — `generateSpell()`: same as above for spells.
- `index.html` template fallbacks — log chosen template and final attributes.
- `index.html:2785-2801` — `showAdStub()`: 1s duration, log start/end.

---

## 6. Acceptance checklist

- [ ] `preloadAI()` is invoked inside `loadModules()` so the model begins downloading before `G.init()` completes.
- [ ] Forge progress panel shows `%`, `%/s` download speed, and `~Xs left` ETA.
- [ ] Ad duration is `FORGE_AD_MS = 1000` in both unit and spell `_doForge` paths.
- [ ] `showAdStub` logs `[Ad] stub start` / `[Ad] stub complete`.
- [ ] `G._doForge` logs prompt, watchAd, mode, canUseLLM, and final result.
- [ ] `generateUnit`/`generateSpell` log start, cache hit/miss, per-field prompt/response, final JSON.
- [ ] `askField` logs the `user` prompt, `system` context, `answer`, and `parsed` value.
- [ ] Template fallback path logs the matched keyword and the generated attribute object.
- [ ] The "Skip Ad" button uses a template directly (not the LLM path) and logs the result.
- [ ] No changes to the daily forge cap unless a separate preflight task decides to remove it.

---

## 7. Out of scope

- Removing the daily `forgeCount` cap. The current code enforces a 10/day limit (`index.html:9459-9464`). The `OVERNIGHT.md` preflight mentions removing this cap, but this doc does not change it.
- Replacing the ad SDK. `AdSDK` remains a stub; only the stub duration and logging are updated.
