// Phase 1/18: host/join assigned after G exists; setupNetwork now null-safe.
// ── P2P Test Mode ──────────────────────────────────────────────────────
// Dedicated multiplayer testing with extended wait times, debug logging,
// and no bot fallback. Used to verify P2P actually works.
G.p2pTestState={log:[],sent:0,recv:0,waitStart:0,waitTimer:null,origOnPeerJoin:null,origOnPeerLeave:null};
G.p2pTest=function(){this.screen("p2ptest");this._p2pTestUpdateUI();};
G._p2pTestLog=function(msg){
  const ts=new Date().toLocaleTimeString();
  const line=`[${ts}] ${msg}`;
  G.p2pTestState.log.push(line);
  if(G.p2pTestState.log.length>50)G.p2pTestState.log.shift();
  const el=$("p2pTestLog");
  if(el)el.innerHTML=G.p2pTestState.log.map(l=>`<div>${l}</div>`).join("");
  const el2=$("p2pTestLog");
  if(el2)el2.scrollTop=el2.scrollHeight;
};
G._p2pTestUpdateUI=function(){
  const s=G.p2pTestState;
  setText("p2pTestRole",role||"none");
  const connEl=$("p2pTestConnected");
  if(connEl){connEl.textContent=connected?"Yes":"No";connEl.style.color=connected?"var(--ok)":"var(--danger)";}
  setText("p2pTestSent",s.sent||0);
  setText("p2pTestRecv",s.recv||0);
  setText("p2pTestPeerId",_peerId||"—");
  // Wait timer
  if(s.waitStart){
    const elapsed=Math.floor((Date.now()-s.waitStart)/1000);
    setText("p2pTestWait",elapsed+"s");
  }else{
    setText("p2pTestWait","0s");
  }
  // Start match button: enabled only when connected
  const startBtn=$("p2pTestStartBtn");
  if(startBtn)startBtn.disabled=!connected;
};
G._p2pTestStartWaitTimer=function(){
  const s=G.p2pTestState;
  s.waitStart=Date.now();
  if(s.waitTimer)clearInterval(s.waitTimer);
  s.waitTimer=setInterval(()=>G._p2pTestUpdateUI(),1000);
};
G._p2pTestStopWaitTimer=function(){
  const s=G.p2pTestState;
  if(s.waitTimer){clearInterval(s.waitTimer);s.waitTimer=null;}
  s.waitStart=0;
};
// Wrap transmit to count sent messages.
G._p2pTestOrigTransmit=transmit;
G._p2pTestWrapTransmit=function(){
  if(G._p2pTestTransmitWrapped)return;
  G._p2pTestTransmitWrapped=true;
  const orig=transmit;
  transmit=function(type,data){
    G.p2pTestState.sent++;
    G._p2pTestLog(`→ sent: ${type}`);
    G._p2pTestUpdateUI();
    orig(type,data);
  };
};
// Wrap networkReceive to count received messages.
G._p2pTestOrigNetworkReceive=networkReceive;
G._p2pTestWrapNetworkReceive=function(){
  if(G._p2pTestNetworkReceiveWrapped)return;
  G._p2pTestNetworkReceiveWrapped=true;
  const orig=networkReceive;
  networkReceive=function(data){
    G.p2pTestState.recv++;
    G._p2pTestLog(`← received: ${data.t}`);
    G._p2pTestUpdateUI();
    orig(data);
  };
};
G.p2pTestHost=function(){
  const roomName=$("p2pTestRoom")?.value||"test-room-1";
  G._p2pTestLog(`Hosting room: ${roomName}`);
  G._p2pTestWrapTransmit();
  G._p2pTestWrapNetworkReceive();
  role="host";
  if(setupNetwork(roomName)){
    G._p2pTestLog("Network setup OK, waiting for peer...");
    G._p2pTestStartWaitTimer();
    // Send role announcement after 500ms (same as normal host).
    setTimeout(()=>{transmit("role",{role:"host",v:CURRENT_VERSION,det:true,relay:true});G._p2pTestLog("Sent role: host");},500);
  }else{
    G._p2pTestLog("Network setup FAILED");
  }
  G._p2pTestUpdateUI();
};
G.p2pTestJoin=function(){
  const roomName=$("p2pTestRoom")?.value||"test-room-1";
  G._p2pTestLog(`Joining room: ${roomName}`);
  G._p2pTestWrapTransmit();
  G._p2pTestWrapNetworkReceive();
  role="guest";
  if(setupNetwork(roomName)){
    G._p2pTestLog("Network setup OK, waiting for host...");
    G._p2pTestStartWaitTimer();
    setTimeout(()=>{transmit("role",{role:"guest",v:CURRENT_VERSION,det:true,relay:true});G._p2pTestLog("Sent role: guest");},500);
  }else{
    G._p2pTestLog("Network setup FAILED");
  }
  G._p2pTestUpdateUI();
};
G.p2pTestDisconnect=function(){
  G._p2pTestLog("Disconnecting...");
  if(typeof disconnect==="function"){try{disconnect();}catch(e){}}
  role="none";
  G._p2pTestStopWaitTimer();
  G._p2pTestUpdateUI();
  G._p2pTestLog("Disconnected. Role reset to none.");
};
G.p2pTestPing=function(){
  if(!connected){G._p2pTestLog("Cannot ping — not connected");return;}
  transmit("ping",{ts:Date.now()});
  G._p2pTestLog("Sent ping");
};
G.p2pTestStartMatch=function(){
  if(!connected){G._p2pTestLog("Cannot start — not connected");return;}
  G._p2pTestLog(`Starting P2P match as ${role}...`);
  G._p2pTestStopWaitTimer();
  // Use the normal start flow — role is already set, connection is established.
  // The host calls G.start(), which triggers the full P2P match flow.
  // The guest waits for match_start message from host.
  if(role==="host"){
    G.start();
  }else{
    G._p2pTestLog("Guest: waiting for host to start the match...");
  }
};
// Handle ping messages in networkReceive (add to existing handler).
// We hook this via the wrapped networkReceive above — pings are logged there.

G.host=function(roomName,silent,password){
  role="host";
  const rid=$("roomId");
  // P2P security: generate cryptographically random room ID if none provided.
  let room=roomName;
  if(!room){
    // Generate a random 8-char room ID for unguessable rooms.
    const arr=new Uint8Array(6);
    crypto.getRandomValues(arr);
    room=Array.from(arr).map(b=>b.toString(36).padStart(2,"0")).join("");
    if(rid)rid.value=room;
  }
  const ok=setupNetwork(room,password);
  if(ok){
    setTimeout(()=>{transmit("role",{role:"host",v:CURRENT_VERSION,det:true,relay:true});},500);
    if(!silent){
      const c=$("connection");
      if(c)c.innerText="Status: hosting room "+room+(password?" (protected)":"");
    }
  }
  return ok;
};
G.join=function(password){
  role="guest";
  const rid=$("roomId");
  if(setupNetwork(rid?rid.value:"room1",password)){
    setTimeout(()=>{transmit("role",{role:"guest",v:CURRENT_VERSION,det:true,relay:true});},500);
  }
};

window.G=G;
window.Match=Match;
window.Battle=Battle;
window.Bot=Bot;
// DET: expose P2P state for testing (module-scoped let vars aren't on window by default).
window.__setP2PState=(c,r,d,rl)=>{connected=c;role=r;_peerDetCapable=d;_peerRelayCapable=!!rl;_useRelay=!!rl;};
window.Quests=Quests;
window.Analytics=Analytics;
window.AdSDK=AdSDK;
window.STRINGS=STRINGS;
window.t=t;
window.unit=unit;
window.attrsToUnit=attrsToUnit;
window.validateUnit=validateUnit;
window.saveData=saveData;
window.saveDataDebounced=saveDataDebounced;
window.migrateSave=migrateSave;
window.sanitizeSpell=sanitizeSpell;
window.cloneUnit=cloneUnit;
window.Spell=Spell;
window.SpriteRenderer=SpriteRenderer;
// DET: expose determinism primitives for testing/debugging (lockstep replay).
window.DMath=DMath;
window.seedBattle=seedBattle;
window.rand=rand;
window.randInt=randInt;
window.randRange=randRange;
window.fnv1aHash=fnv1aHash;
if(typeof LZString!=="undefined")window.LZString=LZString;
window.templateFallback=templateFallback;
window.clearError=clearError;
window.cancelLLM=cancelLLM;
window._getW=()=>W;
window._getLlm=()=>llm;
window._getLlmReady=()=>llmReady;
window._getLlmLoading=()=>llmLoading;
window._getLlmCancelled=()=>llmCancelled;
window.generateUnit=generateUnit;
window.preloadAI=preloadAI;
window.initLLM=initLLM;
window._transmit=transmit;
window._isConnected=()=>connected;
window._getRole=()=>role;

// Phase 7: remove the loading splash once init is done.
function hideSplash(){
  const sp=$("splash");
  if(sp){sp.style.display="none";if(sp.parentNode)sp.parentNode.removeChild(sp);}
}

// Phase 7: register a PWA manifest via a data URL (persists across reloads).
// H1: Inline service worker for offline play.
// Bug #142-145: Use data URLs instead of blob URLs (which don't persist),
// add cache versioning, and clean up old caches on activate.
const PWA_CACHE_VERSION="promptshowdown-v2";
function setupPWA(){
  try{
    const manifest={
      name:"Prompt Showdown",
      short_name:"Showdown",
      description:"AI-forged auto-battler with P2P multiplayer.",
      start_url:window.location.href,
      display:"standalone",
      background_color:"#080810",
      theme_color:"#080810",
      icons:[{
        src:"data:image/svg+xml,"+encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">'+
          '<rect width="512" height="512" fill="#080810"/>'+
          '<text x="256" y="300" font-size="240" text-anchor="middle" fill="#0ff">⚔</text></svg>'),
        sizes:"512x512",type:"image/svg+xml",purpose:"any maskable"
      }]
    };
    // Bug #143: Use data URL instead of blob URL — data URLs persist across
    // page reloads because the content is embedded in the URL itself.
    const manifestUrl="data:application/manifest+json,"+encodeURIComponent(JSON.stringify(manifest));
    let link=document.querySelector('link[rel="manifest"]');
    if(!link){link=document.createElement("link");link.rel="manifest";document.head.appendChild(link);}
    link.href=manifestUrl;
    // H1: Register inline service worker for offline caching.
    // Bug #142: Use data URL instead of blob URL for SW registration.
    // Note: Some browsers block data URL SW registration for security.
    // If registration fails, the app still works as an installable PWA
    // via the manifest — just without offline SW caching.
    if("serviceWorker" in navigator){
      const swCode=`
        const CACHE="${PWA_CACHE_VERSION}";
        self.addEventListener("install",e=>{
          e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./"])));
          self.skipWaiting();
        });
        // Bug #145: Clean up old caches on activate.
        self.addEventListener("activate",e=>{
          e.waitUntil(
            caches.keys().then(keys=>
              Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
            ).then(()=>self.clients.claim())
          );
        });
        self.addEventListener("fetch",e=>{
          if(e.request.method!=="GET")return;
          e.respondWith(
            caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
              const cp=resp.clone();
              caches.open(CACHE).then(c=>c.put(e.request,cp));
              return resp;
            }).catch(()=>caches.match(e.request)))
          );
        });
      `;
      // Bug #142: Try data URL first (persists across reloads).
      const swUrl="data:application/javascript,"+encodeURIComponent(swCode);
      navigator.serviceWorker.register(swUrl).then(reg=>{
        // P2P: check for SW updates every 60s.
        reg.addEventListener("updatefound",()=>{console.log("SW update found");});
        setInterval(()=>reg.update().catch(()=>{}),60000);
      }).catch(e=>{
        // Data URL SW registration may fail in some browsers (Chrome blocks it).
        // Fall back to blob URL — works for the current session but won't persist.
        console.warn("SW registration via data URL failed, trying blob:",e.message);
        try{
          const swBlob=new Blob([swCode],{type:"application/javascript"});
          const swBlobUrl=URL.createObjectURL(swBlob);
          navigator.serviceWorker.register(swBlobUrl).catch(()=>{/* SW best-effort */});
        }catch(e2){/* SW registration best-effort */}
      });
    }
  }catch(e){/* PWA setup is best-effort */}
}

// Phase 7: tap the battle canvas to advance one tick (desktop click fallback).
// TOUCH: on touch devices, canvas taps are handled by Battle's pointer handlers
// (tap-to-inspect, pinch-to-zoom). This only fires for non-touch pointer events.
document.addEventListener("pointerdown",e=>{
  // Skip if the canvas has its own pointer handler (battle mode).
  if(e.target&&e.target.id==="cv"&&e.pointerType==="touch")return;
  if(e.target&&e.target.id==="cv"){e.preventDefault();try{G.tick();}catch(err){/* ignore */}}
},{passive:false});

// Battle debug toggle: press 'D' during battle to enable/disable verbose logging.
// Keyboard shortcuts: 1/2/3 draft picks, Space battle tick, R reroll, Escape back.
document.addEventListener("keydown",e=>{
  if(e.key==="d"||e.key==="D"){
    if(Battle.running){
      Battle.debug=!Battle.debug;
      console.log("[DEBUG] Battle debug logging "+(Battle.debug?"ENABLED":"DISABLED"));
    }
    return;
  }
  // Don't intercept when typing in input fields.
  if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.isContentEditable))return;
  const active=document.querySelector(".screen.active");
  if(!active)return;
  const sid=active.id;
  if(sid==="draft"){
    if(e.key==="1"||e.key==="2"||e.key==="3"){
      const idx=parseInt(e.key)-1;
      const cards=document.querySelectorAll("#draftArea .card");
      if(cards[idx])cards[idx].click();
    }else if(e.key==="r"||e.key==="R"){
      const btn=$("rerollBtn");if(btn)btn.click();
    }
  }else if(sid==="battle"){
    if(e.key===" "){
      e.preventDefault();
      try{G.tick();}catch(err){}
    }else if(e.key==="p"||e.key==="P"){
      e.preventDefault();
      try{G.togglePause();}catch(err){}
    }else if(e.key==="1"){
      e.preventDefault();
      if(Battle.speed!==1){Battle.speed=1;Battle._manualSpeed=true;G.save.defaultSpeed=1;saveData(G.save);const b=$("speedBtn");if(b)b.textContent="1×";if(Battle.autoTimer)Battle.auto();}
    }else if(e.key==="2"){
      e.preventDefault();
      if(Battle.speed!==2){Battle.speed=2;Battle._manualSpeed=true;G.save.defaultSpeed=2;saveData(G.save);const b=$("speedBtn");if(b)b.textContent="2×";if(Battle.autoTimer)Battle.auto();}
    }else if(e.key==="3"){
      e.preventDefault();
      if(Battle.speed!==4){Battle.speed=4;Battle._manualSpeed=true;G.save.defaultSpeed=4;saveData(G.save);const b=$("speedBtn");if(b)b.textContent="4×";if(Battle.autoTimer)Battle.auto();}
    }else if(e.key==="s"||e.key==="S"){
      e.preventDefault();
      try{G.skip();}catch(err){}
    }else if(e.key==="a"||e.key==="A"){
      e.preventDefault();
      try{G.auto();}catch(err){}
    }
  }else if(e.key==="Escape"){
    // Close any open modal/overlay first, else go to menu.
    const overlay=document.querySelector('div[style*="z-index: 9999"]');
    if(overlay){overlay.remove();return;}
    if(sid==="forge"||sid==="settings"||sid==="upgrade"||sid==="deck"){
      G.menu();
    }
  }
  // '?' key: show keyboard shortcuts help overlay (any screen).
  if(e.key==="?"||(e.key==="/"&&e.shiftKey)){
    e.preventDefault();
    G.showKeyboardHelp();
  }
});

// Accessibility: Enter/Space on role="button" elements triggers click.
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target&&e.target.getAttribute&&e.target.getAttribute("role")==="button"&&typeof e.target.click==="function"){
    e.preventDefault();
    e.target.click();
  }
});

// Phase 7: reset Battle.last on visibility change so dt doesn't jump.
// Phase 30: pause/resume music on visibility change.
// NETHARDEN: in lockstep mode, send pause/resume to peer on tab switch
// to prevent the stall watchdog from firing during intentional backgrounding.
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    // NETHARDEN: send pause command to peer in lockstep mode.
    if(connected&&Battle._lockstepActive&&Battle.running&&!Battle.paused){
      const targetTick=(Battle._tick||0)+3;
      const cmd={type:"pause",tick:targetTick};
      Battle.queueCommand(cmd,targetTick);
      _transmitSignedCmd(cmd);
    }
    GameAudio.stopMusic();
  }else{
    if(Battle.running&&Battle.last){Battle.last=performance.now();if(GameAudio.enabled)GameAudio.startMusic();}
    // NETHARDEN: send resume command to peer in lockstep mode.
    if(connected&&Battle._lockstepActive&&Battle.running&&Battle.paused){
      const targetTick=(Battle._tick||0)+3;
      const cmd={type:"resume",tick:targetTick};
      Battle.queueCommand(cmd,targetTick);
      _transmitSignedCmd(cmd);
    }
  }
  // Phase 35: flush analytics on visibility change.
  if(document.hidden)Analytics.flushNow();
});
// Phase 35: flush analytics on page unload.
window.addEventListener("beforeunload",()=>{Analytics.flushNow();if(G.save)saveDataNow(G.save);try{GameAudio.stopMusic();if(GameAudio.ctx)GameAudio.ctx.close();}catch(e){}});

// Phase 30: delegated UI click sound for all buttons.
document.addEventListener("click",e=>{
  if(e.target&&e.target.classList&&e.target.classList.contains("btn"))GameAudio.sfx("ui_click");
});

// H3: Canvas responds to orientation change and resize.
function resizeCanvas(){
  const cv=$("cv");
  if(!cv)return;
  const dpr=window.devicePixelRatio||1;
  // Use the active screen container dimensions (mobile portrait).
  const screen=document.querySelector(".screen.active");
  const dispW=screen?screen.clientWidth:Math.min(420,innerWidth);
  const dispH=screen?screen.clientHeight:innerHeight;
  // Guard against 0-size canvas (during screen transitions or hidden screens).
  // A 0-size canvas causes drawImage errors and sprite cache corruption.
  if(dispW<1||dispH<1)return;
  cv.style.width=dispW+"px";
  cv.style.height=dispH+"px";
  cv.width=dispW*dpr;
  cv.height=dispH*dpr;
  Battle.canvasH=dispH;
  Battle.canvasW=dispW;
  if(Battle.ctx){
    Battle.ctx.setTransform(1,0,0,1,0,0);
    Battle.ctx.scale(dpr,dpr);
  }
  // Keep the draft canvas sized correctly on resize/orientation change.
  if(typeof G!=="undefined"&&G._sizeDraftCanvas)G._sizeDraftCanvas();
}
window.addEventListener("resize",resizeCanvas);
window.addEventListener("orientationchange",()=>setTimeout(resizeCanvas,100));

// Phase 1 + Phase 7: kick off module load + init. Errors surface in the panel.
// Phase 4: preload AI in the background once modules are available.
// Phase 7: crash recovery — wrap init so a corrupt save can't brick the game.
// Note: preloadAI() is already called inside loadModules() right after W loads,
// so the model download starts before trystero/LZString are imported.
loadModules()
  .then(()=>{
    try{
      G.init();
      setupPWA();
      // Bug #126: hideSplash is now called only from _initRest() (or the
      // safety timeout). Do NOT call it here — doing so could hide the
      // splash before the async IDB fallback completes, exposing
      // uninitialized state to the user.
    }
    catch(e){
      showError("Startup crashed (save may be corrupt): "+(e&&e.message||e)+
        " — use ↺ RESET on the menu to clear progress.");
      hideSplash();
    }
  })
  .catch(e=>{showError("Startup failed: "+(e&&e.message||e));hideSplash();});
