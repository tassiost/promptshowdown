// Phase 1: dynamic imports with graceful fallback.
// Static `import` cannot be wrapped in try/catch, so we use dynamic import()
// and let the game run even if CDNs are unreachable.
let W = null;       // web-llm
let joinRoom = null; // trystero
let LZString = null; // lz-string for P2P recipe compression (Phase 18)
let moduleLoadErrors = [];

async function loadModules(){
  // web-llm: try multiple CDNs. This is a heavy WebGPU/WASM package that may
  // not be available on all CDNs; the procedural forge fallback covers failures.
  const webllmUrls=[
    "https://esm.run/@mlc-ai/web-llm",
    "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm"
  ];
  for(const url of webllmUrls){
    try{
      W = await import(/* @vite-ignore */ url);
      break;
    }catch(e){
      // Expected on many setups — don't show a scary error panel, just log.
      console.warn("web-llm import failed ("+url+"): "+(e&&e.message||e));
    }
  }
  // NEW: start the LLM download as soon as the module is available.
  if(W && navigator.gpu){
    preloadAI().catch(e=>console.warn("early preloadAI error:",e.message));
  }
  // trystero: vendored locally to avoid esm.sh connection issues.
  try{
    const tr = await import("../vendor/torrent.mjs");
    joinRoom = tr.joinRoom;
  }catch(e){
    console.warn("trystero import failed: "+(e&&e.message||e)+" — multiplayer disabled.");
  }
  // lz-string: compression for P2P recipe serialization (Phase 18).
  try{
    const lz = await import("../vendor/lz-string.mjs");
    LZString = lz.LZString || lz.default?.LZString || lz.default;
    if(typeof window!=="undefined")window.LZString=LZString;
  }catch(e){
    console.warn("lz-string import failed: "+(e&&e.message||e)+" — recipes sent uncompressed.");
  }
}

