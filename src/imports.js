// Phase 1: dynamic imports with graceful fallback.
// web-llm loaded from CDN at runtime via Function() to bypass Vite's static
// import() analysis (which breaks in the built single-file because
// import.meta.url points to a blob:). This mirrors the original monolith
// which used a static `import * as W from "https://esm.run/@mlc.ai/web-llm"`.
let W = null;       // web-llm
let joinRoom = null; // trystero
let LZString = null; // lz-string for P2P recipe compression (Phase 18)
let moduleLoadErrors = [];

async function loadModules(){
  // web-llm: native dynamic import from CDN. Function() prevents Vite
  // from wrapping this in its import helper (which uses import.meta.url).
  const webllmUrls=[
    "https://esm.run/@mlc-ai/web-llm",
    "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm"
  ];
  const _dynImport=new Function("u","return import(u)");
  for(const url of webllmUrls){
    try{
      W = await _dynImport(url);
      break;
    }catch(e){
      console.warn("web-llm import failed ("+url+"): "+(e&&e.message||e));
    }
  }
  // Start the LLM download as soon as the module is available.
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

