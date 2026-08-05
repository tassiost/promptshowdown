// Phase 3/10: extended unit schema with Behaviour Composition API fields.
//   crit   0..1   critical-hit chance (default 0.1)
//   ab     string ability key (Phase 10: 12 values, was 5)
//   rar    string rarity: "common" | "rare" | "legendary"
//   cost   number draft cost
// Phase 10 behaviour fields (5 composable enums + role):
//   targeting, movement, attackCondition, abilityTrigger, moveSpeedMod, role
// Runtime-only fields (poison/slow/stun/dead/deathT) are added by Battle, not persisted.
function unit(x={}){
  const bodyPlan=x.bodyPlan||"humanoid";
  const weaponType=["none","sword","bow","staff","dagger","shield","hammer","claws","breath","scythe","whip","spear","rifle","wand","axe","trident","crossbow","orb","dual_blades"].includes(x.weaponType)?x.weaponType:"none";
  // D5: rebuild stale/missing recipes so visual changes (weapon attachment, facing)
  // apply to saved/base units too. New recipes carry recipeVersion:1.
  // BUT: if the unit already has a recipe with shapes, keep it — rebuilding with
  // default params (missing bodyPlan/sizeMod on base units) produces a different
  // sprite than what the deck screen shows, causing visual mismatch in draft/battle.
  let recipe=x.recipe;
  if((!recipe||!recipe.shapes||recipe.shapes.length===0)&&typeof RecipeAssembler!=="undefined"){
    try{
      recipe=RecipeAssembler.build({
        primaryColor:x.primaryColor||"gray",
        accentColor:x.accentColor||"gray",
        primaryHex:x.c||"#888",
        accentHex:x.c?lighten(x.c,0.3):"#aaa",
        headHex:x.c?lighten(x.c,0.2):"#999",
        weaponHex:WEAPON_COLOR[weaponType],
        bodyPlan,
        weaponType,
        sizeMod:x.sizeMod||"medium",
        pattern:x.pattern||"none",
        headFeature:x.headFeature||"none",
        backFeature:x.backFeature||"none",
        tailFeature:x.tailFeature||"none",
        aura:x.aura||"none",
        eyeStyle:x.eyeStyle||"normal",
        weaponStyle:x.weaponStyle||"standard"
      });
    }catch(e){recipe=x.recipe||null;}
  }
  // Normalize recipe shapes to standard height so all units are the same visual size.
  if(recipe&&recipe.shapes&&recipe.shapes.length&&!recipe._normalized){
    recipe=_normalizeRecipeHeight(recipe);
  }
  return {
    id:x.id||Date.now()+F(R()*99999),
    n:String(x.n||"Unit").slice(0,20).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'"),
    h:clamp(Number(x.h)||50,1,1000),
    d:clamp(Number(x.d)||10,1,200),
    r:clamp(Number(x.r)||50,10,300),
    s:clamp(Number(x.s)||60,10,300),
    a:clamp(Number(x.a)||1,0.1,10),
    c:sanitizeHex(x.c||"#0ff"),
    z:10, // All units same render scale. Recipe shapes are normalized to standard height.
    crit:clamp(Number(x.crit)||0.1,0,1),
    armor:clamp(Number(x.armor)||0,0,20), // U1: flat damage reduction per hit
    ability:ABILITY_OPTS.includes(x.ability||x.ab)?(x.ability||x.ab):"none",
    rar:["common","rare","legendary"].includes(x.rar)?x.rar:"common",
    cost:clamp(Number(x.cost)||1,1,20),
    // Phase 10: Behaviour Composition API fields.
    targeting:TARGETING_OPTS.includes(x.targeting)?x.targeting:"closest",
    movement:MOVEMENT_OPTS.includes(x.movement)?x.movement:"chase",
    attackCondition:ATTACK_CONDITION_OPTS.includes(x.attackCondition)?x.attackCondition:"always",
    abilityTrigger:ABILITY_TRIGGER_OPTS.includes(x.abilityTrigger)?x.abilityTrigger:"never",
    moveSpeedMod:clamp(Number(x.moveSpeedMod)||100,50,150),
    role:ROLE_OPTS.includes(x.role)?x.role:"frontline",
    weaponType,
    // Phase 25: visual modifier fields (preserved for P2P + share + clone).
    bodyPlan,
    headFeature:x.headFeature||"none",
    backFeature:x.backFeature||"none",
    tailFeature:x.tailFeature||"none",
    aura:x.aura||"none",
    eyeStyle:x.eyeStyle||"normal",
    pattern:x.pattern||"none",
    weaponStyle:x.weaponStyle||"standard",
    sizeMod:x.sizeMod||"medium",
    recipe, // Phase 11: visual recipe (null = role-coded fallback)
    // PERF: pre-declare runtime fields that initRuntime sets via || patterns.
    // Without this, fresh units (from unit()) and surviving units (from previous
    // rounds, which retain these fields) have DIFFERENT hidden class transition
    // paths → polymorphic inline caches in the hot loop → slower property access.
    // Setting them here ensures all units share the same hidden class.
    mh:0,           // max hp (set by initRuntime: u.mh=u.mh||u.h)
    baseD:0,        // base damage (set by initRuntime: u.baseD=u.baseD||u.d)
    fxType:null,    // cached aura type (set by initRuntime: u.fxType=u.fxType||deriveFxType(u))
    ttl:0           // minion TTL (set by initRuntime: u.ttl=u.ttl||0)
  };
}
function cloneUnit(u){return unit(deepClone(u));}

// Phase 1: small DOM helper with null guard.
function $(id){return document.getElementById(id);}
function setText(id,val){const el=$(id);if(el)el.innerText=val;}
function setStyle(id,prop,val){const el=$(id);if(el)el.style[prop]=val;}

let llm=null;
let llmReady=false;
let llmLoading=false;
let llmCancelled=false;       // user tapped Cancel during download
let llmWorker=null;           // ref to the worker so we can terminate on cancel
let llmLoadPromise=null;      // shared in-flight load promise (awaited by forge + preload)
let llmCancelResolve=null;    // resolver for the cancel signal (unblocks awaiters)
// Mobile: use SmolLM2-360M (~580MB VRAM) — fits iOS jetsam limit (~800MB).
// Desktop: use Qwen2.5-1.5B (~1630MB VRAM) — better quality, more VRAM available.
// Qwen2.5-0.5B (~945MB) is still too large for iOS Safari's ~800MB tab limit.
const MODEL=isMobile
  ?"SmolLM2-360M-Instruct-q4f16_1-MLC"
  :"Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
// Phase 4: cache of validated AI-generated units so re-forge is instant
// and we don't re-query the LLM every round.
let aiCache=[];

function debugForge(...args){console.log("[Forge]",...args);}

let llmStartTime=0;
let llmLastSample={p:0,t:0};

// Phase 4: update the forge model-download progress UI.
// (The legacy aiText/aiFill elements don't exist in the DOM, so we drive
// the forgeModelProgress bar directly plus a global for pollers.)
let aiProgress={text:"",pct:0};
// Generation progress callback — set by _doForge to update UI as each
// LLM field question is answered. Signature: (current, total, fieldName).
let forgeGenProgress=null;
// F1: live preview callback — called with partial attrs after each field
// is determined, so the UI can render a progressively-building sprite.
let forgeLivePreview=null;
// Human-readable labels for forge fields (shown in progress text).
const FIELD_LABELS={
  name:"name",role:"role",bodyPlan:"body type",weaponType:"weapon",primaryColor:"primary color",
  accentColor:"accent color",sizeMod:"size",targeting:"targeting",movement:"movement style",
  ability:"ability",abilityTrigger:"ability trigger",attackCondition:"attack condition",
  hp:"health",dmg:"damage",range:"range",speed:"speed",moveSpeedMod:"speed modifier",armor:"armor",
  headFeature:"head feature",backFeature:"back feature",tailFeature:"tail feature",
  aura:"aura",eyeStyle:"eye style",pattern:"pattern",weaponStyle:"weapon style",
  trigger:"trigger",target:"target",effect:"effect",shape:"shape",fxType:"visual effect",
  magnitude:"power",radius:"radius",duration:"duration"
};
async function updateAI(text,percent){
  aiProgress={text:text||"",pct:percent||0};
  setText("forgeModelText",text);
  setStyle("forgeModelFill","width",(percent||0)+"%");
}

function updateAIFromProgress(p){
  if(llmCancelled)return;
  if(!llmStartTime)llmStartTime=Date.now();
  const now=Date.now();
  const elapsed=(now-llmStartTime)/1000;
  const pct=Math.floor(p.progress*100);
  let speed=0;
  if(elapsed>0)speed=(p.progress*100)/elapsed;
  let eta="";
  if(speed>0.1&&pct<100)eta=`~${Math.ceil((100-pct)/speed)}s left`;
  let text=`Downloading AI ${pct}%`;
  if(pct<100&&speed>0)text+=` · ${speed.toFixed(1)}%/s · ${eta}`;
  if(pct>=100)text="AI ready";
  updateAI(text,pct);
  const stats=$("forgeModelStats");
  if(stats)stats.innerText=`${pct}% downloaded · ${speed.toFixed(1)}% per second · ${eta}`;
  // Also update the aiStatus badge so it's visible even if the progress
  // panel isn't shown (e.g. on another screen).
  const aiStatus=$("aiStatus");
  if(aiStatus)aiStatus.innerText=`AI: ${pct}% downloaded`;
  llmLastSample={p:p.progress,t:now};
}

// A promise that resolves when the user cancels the in-flight download.
// generateUnit races llmLoadPromise against this so a cancel always unblocks
// the forge even if the underlying web-llm engine promise never settles.
let llmCancelPromise=null;
function resetCancelSignal(){
  llmCancelPromise=new Promise(res=>{llmCancelResolve=res;});
}

// User-initiated cancel of an in-flight model download.
// Terminates the worker (stops the download) and resets state so the forge
// falls back to procedural templates. Safe to call when not loading.
function cancelLLM(){
  if(!llmLoading)return;
  llmCancelled=true;
  llmLoading=false;
  llmReady=false;
  if(llmWorker){try{llmWorker.terminate();}catch(e){}llmWorker=null;}
  llm=null;
  if(llmCancelResolve){try{llmCancelResolve();}catch(e){}}
  updateAI("AI cancelled (templates)",0);
  const aiStatus=$("aiStatus");
  if(aiStatus)aiStatus.innerText="AI: Cancelled (templates)";
  const stats=$("forgeModelStats");
  if(stats)stats.innerText="";
  llmStartTime=0;
  console.warn("AI load cancelled by user — using procedural forge.");
}

async function initLLM(){
  if(llmReady||llmLoading)return llmLoadPromise;
  // Phase 1: if web-llm never loaded, fail fast and visibly.
  if(!W||!(W.CreateMLCEngine||W.CreateWebWorkerMLCEngine)){
    await updateAI("AI unavailable",0);
    return null;
  }
  // Phase 4: skip preload entirely if no WebGPU — go straight to procedural.
  if(!navigator.gpu){
    await updateAI("AI unavailable (no WebGPU)",0);
    return null;
  }
  // Mobile guard: check WebGPU max buffer size. iOS Safari limits to ~715MB
  // and jetsam-kills tabs at ~800MB RAM. If the adapter reports a small
  // maxBufferSize, skip LLM and use template fallback to avoid a crash.
  if(isMobile&&navigator.gpu){
    try{
      const adapter=await navigator.gpu.requestAdapter();
      if(adapter){
        const maxBuf=adapter.limits.maxBufferSize||0;
        // SmolLM2-360M-q4f16 needs ~580MB VRAM. If maxBufferSize < 512MB,
        // even the small model won't fit — fall back to templates.
        if(maxBuf<512*1024*1024){
          console.warn("WebGPU maxBufferSize too small for LLM: "+(maxBuf/1024/1024).toFixed(0)+"MB — using templates.");
          await updateAI("AI unavailable (WebGPU memory too low)",0);
          return null;
        }
      }
    }catch(e){/* ignore — proceed with normal init */}
  }
  llmLoading=true;
  llmCancelled=false;
  llmStartTime=0;
  llmLastSample={p:0,t:0};
  resetCancelSignal();
  const stats=$("forgeModelStats");
  if(stats)stats.innerText="";
  await updateAI("AI loading...",0);
  // IndexedDB cache backend: stores each model file individually after
  // download completes, so a page reload mid-download only re-fetches the
  // files that hadn't finished (unlike Cache API which is all-or-nothing).
  // Main-thread engine (no Web Worker) — the built single-file inlines
  // workers into blob:/data: URLs with opaque origins that break fetch.
  const appConfig=W.prebuiltAppConfig
    ? {...W.prebuiltAppConfig,cacheBackend:"indexeddb"}
    : {cacheBackend:"indexeddb"};
  llmLoadPromise=(async()=>{
    try{
      llm=await W.CreateMLCEngine(MODEL,{appConfig,initProgressCallback:updateAIFromProgress});
      if(llmCancelled){llm=null;return null;}
      llmReady=true;
      await updateAI("AI READY",100);
      const aiStatus=$("aiStatus");
      if(aiStatus)aiStatus.innerText="AI: Ready";
      return llm;
    }
    catch(e){
      // Cancelled, network error, or no WebGPU.
      console.warn("AI init failed, using procedural forge: "+(e&&e.message||e));
      if(!llmCancelled)await updateAI("AI fallback",0);
      llm=null;
      return null;
    }
    finally{
      llmLoading=false;
      llmWorker=null;
    }
  })();
  return llmLoadPromise;
}

// Phase 12: silently preload the LLM in the background after startup.
// No UX prompt — just a silent background download if WebGPU is present.
// By the time the user first taps "Forge," the model may already be cached.
async function preloadAI(){
  if(!navigator.gpu)return;       // no point trying without WebGPU
  if(!W||!W.CreateMLCEngine)return;// web-llm module not loaded
  // Start a global status poller so the aiStatus badge stays updated
  // even when the user is not on the forge screen.
  if(!window._aiStatusPoll){
    window._aiStatusPoll=setInterval(()=>{
      const aiStatus=$("aiStatus");
      if(!aiStatus)return;
      if(llmReady){aiStatus.innerText="AI: Ready";clearInterval(window._aiStatusPoll);window._aiStatusPoll=null;}
      else if(llmLoading){
        const pct=aiProgress.pct||0;
        aiStatus.innerText=`AI: Downloading ${pct}%`;
      }else if(llmCancelled){
        aiStatus.innerText="AI: Cancelled (templates)";
        clearInterval(window._aiStatusPoll);window._aiStatusPoll=null;
      }
    },500);
  }
  try{await initLLM();}catch(e){console.warn("AI preload skipped:",e.message);}
}

// Phase 10: unified unit validation. Replaces v4's validateAIUnit.
// Validates the 5 behaviour fields (each must be in its enum) + role + clamped params.
// One function used by starter units, bot units, and LLM units.
// arenaIndex optional (defaults to 0 = Training Yard clamps). Phase 15 makes
// the clamps arena-dependent.
function validateUnit(raw,arenaIndex){
  try{
    const u=unit(raw); // unit() already clamps + validates enums.
    // Phase 15: arena-dependent param clamps (gates power progression).
    // Clamp instead of reject — ensures forge always produces a unit.
    const ai=arenaIndex||(G.save?.arena||0);
    const arena=G.arenas?.[ai];
    const maxHp=arena?.maxHp||100;
    const maxDmg=arena?.maxDmg||30;
    u.h=Math.min(u.h,maxHp);
    u.d=Math.min(u.d,maxDmg);
    if(u.h<10)u.h=10;
    if(u.d<3)u.d=3;
    if(u.r>250&&u.d>40)u.d=40; // sniper + heavy hitter = unfun
    // Semantic validation: passive abilities require abilityTrigger: never.
    if(PASSIVE_ABILITIES.has(u.ability)&&u.abilityTrigger!=="never")u.abilityTrigger="never";
    // Triggered abilities require a non-never trigger.
    if(TRIGGERED_ABILITIES.has(u.ability)&&u.abilityTrigger==="never")u.abilityTrigger="on_cooldown";
    // heal_burst pairs with on_death, on_cooldown, or when_ally_hurt.
    // shield pairs with on_low_hp or on_first_hit.
    // explode pairs with on_death or on_cooldown.
    // (These are soft constraints — we just fix the trigger, not reject.)
    return u;
  }catch(e){return null;}
}

// Phase 12: LLM Integration — JSON schema, color maps, derived fields,
// consistency rules, recipe assembler, template fallback, generateUnit.
const COLOR_MAP={
  green:"#4a7",blue:"#48f",red:"#f44",purple:"#a4f",
  yellow:"#fd4",orange:"#f84",black:"#222",white:"#eee",
  brown:"#a72",gray:"#888",pink:"#f6c",cyan:"#0ff",
  teal:"#07a",magenta:"#e4f",lime:"#bf4",indigo:"#6495ed",
  coral:"#f80",lavender:"#e6e6fa",gold:"#ffd700",silver:"#c0c0c0"
};
const WEAPON_COLOR={sword:"#ccc",bow:"#a72",staff:"#fb0",dagger:"#ccc",shield:"#ccc",hammer:"#888",claws:"#ccc",breath:"#f80",scythe:"#9f9",whip:"#a72",spear:"#aaa",rifle:"#666",wand:"#fd0",none:"#888",axe:"#999",trident:"#7bb",crossbow:"#864",orb:"#f0f",dual_blades:"#ddd"};
const WEAPON_FX={bow:"projectile",staff:"flash",hammer:"burst",sword:"none",dagger:"none",shield:"flash",claws:"none",breath:"burst",scythe:"none",whip:"none",spear:"none",rifle:"projectile",wand:"flash",none:"none",axe:"burst",trident:"none",crossbow:"projectile",orb:"flash",dual_blades:"none"};
const SIZE_SCALE={tiny:0.5,small:0.7,medium:1.0,large:1.3,huge:1.6,colossal:2.0};
// Per-body-plan base size multiplier — makes dragons bigger than humanoids, etc.
const BODY_SIZE={humanoid:1.0,quadruped:1.1,dragon:1.25,serpent:0.9,bird:0.85,insect:0.8,crab:0.9,golem:1.2,ghost:0.95,fish:0.85,blob:0.9,flying:0.85,mechanical:1.05,structure:1.15,plant:1.05,undead:1.0,demon:1.05,"beast-man":1.1,aquatic:0.95,monopod:0.85,centaur:1.15,hydra:1.2,elemental:0.95,aberration:1.0,ooze:0.9,crystal:0.95,construct:1.0,angel:1.0,spider:0.9,wyvern:1.15,treant:1.2,kraken:1.15,gargoyle:1.0,wraith:0.95};

// Phase 12: JSON schema for grammar-constrained generation (17 fields).
const UNIT_SCHEMA={
  type:"object",
  properties:{
    name:{type:"string",maxLength:20},
    role:{type:"string",enum:["frontline","carry","support","counter","utility","assassin","bruiser"]},
    targeting:{type:"string",enum:["closest","lowest_hp","highest_hp","enemy_carry","enemy_support","enemy_backline","enemy_frontline","enemy_cluster","lowest_ally","highest_hp_ally","random_ally","random","self"]},
    movement:{type:"string",enum:["chase","flee","hold","hold_midpoint","kite","patrol","blink","strafe"]},
    attackCondition:{type:"string",enum:["always","only_if_healthy","only_if_target_low","only_if_target_high_hp","never"]},
    abilityTrigger:{type:"string",enum:["on_cooldown","when_ally_hurt","when_surrounded","on_low_hp","on_death","on_first_hit","on_spawn","on_kill","periodic_3s","never"]},
    moveSpeedMod:{type:"integer",minimum:50,maximum:150},
    hp:{type:"integer",minimum:10,maximum:200},
    dmg:{type:"integer",minimum:5,maximum:50},
    range:{type:"integer",minimum:30,maximum:250},
    speed:{type:"integer",minimum:30,maximum:120},
    armor:{type:"integer",minimum:0,maximum:20},
    ability:{type:"string",enum:["none","splash","heal","dodge","poison","spawn","lifesteal","explode","heal_burst","shield","rage","slow","ramp","thorns","blink_strike","frenzy","regen","cleanse","taunt","executioner","chain_lightning","buff_aura"]},
    bodyPlan:{type:"string",enum:["humanoid","quadruped","dragon","serpent","bird","insect","crab","golem","ghost","fish","blob","flying","mechanical","structure","plant","undead","demon","beast-man","aquatic","monopod","centaur","hydra","elemental","aberration","ooze","crystal","construct","angel","spider","wyvern","treant","kraken","gargoyle","wraith"]},
    weaponType:{type:"string",enum:["none","sword","bow","staff","dagger","shield","hammer","claws","breath","scythe","whip","spear","rifle","wand","axe","trident","crossbow","orb","dual_blades"]},
    primaryColor:{type:"string",enum:Object.keys(COLOR_MAP)},
    accentColor:{type:"string",enum:Object.keys(COLOR_MAP)},
    sizeMod:{type:"string",enum:["tiny","small","medium","large","huge","colossal"]},
    // Phase 25: visual modifier fields.
    headFeature:{type:"string",enum:["none","horns","antlers","crest","halo","crown","horns_curved","ears_pointed","mask","eyepatch","tiara","antenna","frill","beak","hood","mohawk","goggles","third_eye","flower_crown","headphones"]},
    backFeature:{type:"string",enum:["none","wings_bat","wings_feathered","wings_dragon","cape","shell","spikes","aura_vent","wings_insect","wings_angel","jetpack","tentacles","fins","crystal_growth","wings_bone","wings_moth","sail","quills","banner","scarab_shell"]},
    tailFeature:{type:"string",enum:["none","tail_long","tail_spade","tail_flame","tail_fin","tail_prehensile","tail_stinger","tail_fluffy","tail_barbed","tail_split","tail_mace","tail_feather","tail_hook","tail_ribbon"]},
    aura:{type:"string",enum:["none","fire","frost","poison","lightning","holy","shadow","arcane","void","nature","blood","tech"]},
    eyeStyle:{type:"string",enum:["normal","glowing","slit","empty","visorglow","compound","closed","star","cross","spiral","visor","visor_red"]},
    pattern:{type:"string",enum:["none","stripes","spots","scales","runes","cracks","gradient_two_tone","circuit","tribal","stars","hexagons","marble"]},
    weaponStyle:{type:"string",enum:["standard","ornate","glowing","cracked","pristine","battered","rusted","crystal","bone","molten"]}
  },
  required:["name","role","targeting","movement","attackCondition","abilityTrigger","moveSpeedMod","hp","dmg","range","speed","ability","bodyPlan","weaponType","primaryColor","accentColor","sizeMod","headFeature","backFeature","tailFeature","aura","eyeStyle","pattern","weaponStyle"]
};

// Phase 12: derived fields (not from LLM — deterministic functions).
function sanitizeHex(hex){
  if(!hex||typeof hex!=="string")return"#888";
  if(hex[0]!=="#")hex="#"+hex;
  let h=hex.slice(1);
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if(h.length!==6||!/^[0-9a-fA-F]{6}$/.test(h))return"#888";
  return"#"+h;
}
// PERF-R11: cache lighten/darken results — these are called per shape per frame
// and do expensive string manipulation + parseInt + toString.
const _lightenCache={};
const _darkenCache={};
// Security: escape HTML entities in user-generated strings for safe innerHTML embedding.
// escapeHtml is defined in utils.js as esc() — use that instead.
// Security: sanitize a spell spec from untrusted source (P2P, URL import, save import).
function sanitizeSpell(d){
  if(!d||typeof d!=="object")return null;
  d.name=String(d.name||"Spell").slice(0,40).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");
  if(!SPELL_ENUM.trigger.includes(d.trigger))d.trigger="battle_start";
  if(!SPELL_ENUM.effect.includes(d.effect))d.effect="damage";
  if(!SPELL_ENUM.shape.includes(d.shape))d.shape="circle_aoe";
  if(!SPELL_ENUM.fxType.includes(d.fxType))d.fxType="explosion";
  if(!SPELL_ENUM.target.includes(d.target))d.target="enemy_cluster";
  d.magnitude=clamp(Number(d.magnitude)||30,1,200);
  d.radius=clamp(Number(d.radius)||60,10,200);
  d.duration=clamp(Number(d.duration)||0,0,10);
  return d;
}
function lighten(hex,amt){
  if(!hex||typeof hex!=="string"||hex[0]!=="#")hex="#888";
  const key=hex+"_"+amt;
  if(_lightenCache[key])return _lightenCache[key];
  let h=hex.slice(1);
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  const r=Math.min(255,Math.round(((n>>16)&255)+amt*255));
  const g=Math.min(255,Math.round(((n>>8)&255)+amt*255));
  const b=Math.min(255,Math.round((n&255)+amt*255));
  const result="#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  _lightenCache[key]=result;
  return result;
}
function darken(hex,amt){
  if(!hex||typeof hex!=="string"||hex[0]!=="#")hex="#888";
  const key=hex+"_"+amt;
  if(_darkenCache[key])return _darkenCache[key];
  let h=hex.slice(1);
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  const r=Math.max(0,Math.round(((n>>16)&255)-amt*255));
  const g=Math.max(0,Math.round(((n>>8)&255)-amt*255));
  const b=Math.max(0,Math.round((n&255)-amt*255));
  const result="#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  _darkenCache[key]=result;
  return result;
}
function deriveAtkSpd(a){
  const base=a.role==="carry"?1.2:a.role==="frontline"?0.8:1.0;
  return clamp(base+(a.speed-60)*0.005,0.5,2.5);
}
function deriveCrit(a){
  const base=a.role==="carry"?0.15:a.role==="counter"?0.20:0.05;
  return clamp(base+(a.movement==="chase"&&a.moveSpeedMod>=150?0.05:0),0,0.4);
}

// Phase 12: cross-field semantic validation rules.
const CONSISTENCY_RULES=[
  {if:a=>a.role==="carry"&&a.hp>150,flag:"hp"},
  {if:a=>a.role==="frontline"&&a.hp<80,flag:"hp"},
  {if:a=>a.role==="support"&&a.hp>100,flag:"hp"},
  {if:a=>a.movement==="chase"&&a.moveSpeedMod>=150&&a.speed<80,flag:"speed"},
  {if:a=>a.movement==="hold"&&a.speed>60,flag:"speed"},
  {if:a=>a.targeting==="lowest_ally"&&a.attackCondition!=="never",flag:"attackCondition"},
  {if:a=>a.ability==="none"&&a.abilityTrigger!=="never",flag:"abilityTrigger"},
  {if:a=>a.ability==="heal"&&!["when_ally_hurt","on_cooldown"].includes(a.abilityTrigger),flag:"abilityTrigger"},
  {if:a=>a.ability==="spawn"&&a.abilityTrigger!=="on_cooldown",flag:"abilityTrigger"},
  {if:a=>["lifesteal","rage","slow","splash","dodge","poison","ramp"].includes(a.ability)&&a.abilityTrigger!=="never",flag:"abilityTrigger"},
  {if:a=>["heal","spawn","explode","heal_burst","shield"].includes(a.ability)&&a.abilityTrigger==="never",flag:"abilityTrigger"},
  {if:a=>a.ability==="explode"&&!["on_death","on_cooldown"].includes(a.abilityTrigger),flag:"abilityTrigger"},
  {if:a=>a.ability==="heal_burst"&&!["on_death","on_cooldown","when_ally_hurt"].includes(a.abilityTrigger),flag:"abilityTrigger"},
  {if:a=>a.ability==="shield"&&!["on_low_hp","on_first_hit"].includes(a.abilityTrigger),flag:"abilityTrigger"},
  {if:a=>a.movement==="kite"&&a.range<100,flag:"range"},
  {if:a=>a.movement==="chase"&&a.range>80,flag:"range"},
  // Role ↔ Targeting: supports target allies, carries target enemies.
  {if:a=>a.role==="support"&&!["lowest_ally","closest"].includes(a.targeting),flag:"targeting"},
  {if:a=>a.role==="carry"&&a.targeting==="lowest_ally",flag:"targeting"},
  // Structure body plan should be immobile.
  {if:a=>a.bodyPlan==="structure"&&a.movement!=="hold",flag:"movement"},
];
// Phase 12: all fields the LLM must provide. Used to detect missing/invalid
// fields so reaskFields can fill them with targeted per-field LLM calls.
const ALL_FIELDS=["name","role","targeting","movement","attackCondition","abilityTrigger","moveSpeedMod","hp","dmg","range","speed","ability","bodyPlan","weaponType","primaryColor","accentColor","sizeMod"];
function semanticValidate(a){
  const flagged=CONSISTENCY_RULES.filter(r=>r.if(a)).map(r=>r.flag);
  // Also flag any missing or invalid (out-of-enum / out-of-range) fields.
  for(const f of ALL_FIELDS){
    const v=a[f];
    if(v===undefined||v===null||v===""){flagged.push(f);continue;}
    if(ENUM_FIELDS[f]&&!ENUM_FIELDS[f].includes(v)){flagged.push(f);continue;}
    if(INT_FIELDS[f]){const[min,max]=INT_FIELDS[f];if(typeof v!=="number"||v<min||v>max){flagged.push(f);continue;}}
  }
  return [...new Set(flagged)]; // dedupe
}
// Auto-fix flagged fields (cheaper than re-asking the LLM).
function autoFixFields(a,flagged){
  for(const f of flagged){
    if(f==="hp"){
      if(a.role==="carry")a.hp=80;
      else if(a.role==="frontline")a.hp=110;
      else a.hp=70;
    }
    if(f==="speed"){
      if(a.movement==="chase")a.speed=90;
      else if(a.movement==="hold")a.speed=45;
    }
    if(f==="attackCondition"&&a.targeting==="lowest_ally")a.attackCondition="never";
    if(f==="abilityTrigger"){
      if(a.ability==="none")a.abilityTrigger="never";
      else if(["lifesteal","rage","slow","splash","dodge","poison"].includes(a.ability))a.abilityTrigger="never";
      else if(a.ability==="heal"||a.ability==="spawn")a.abilityTrigger="on_cooldown";
      else if(a.ability==="explode")a.abilityTrigger="on_death";
      else if(a.ability==="heal_burst")a.abilityTrigger="when_ally_hurt";
      else if(a.ability==="shield")a.abilityTrigger="on_low_hp";
      else if(a.abilityTrigger==="never")a.abilityTrigger="on_cooldown";
    }
    if(f==="range"){
      if(a.movement==="kite")a.range=150;
      else if(a.movement==="chase")a.range=50;
    }
    if(f==="targeting"){
      if(a.role==="support")a.targeting="lowest_ally";
      else if(a.role==="carry")a.targeting="closest";
    }
    if(f==="movement"&&a.bodyPlan==="structure")a.movement="hold";
  }
  return a;
}

// Phase 12/24a: RecipeAssembler — builds visual recipe from LLM attributes.
// Phase 24a: expanded from 6 to 20 body plans with richer shapes.
const BODY_PLANS={
  humanoid:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-18,r:6,c:c.head,fill:"gradient",c2:c.primary},
      {t:"rect",x:-5,y:-12,w:10,h:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-9,y:-10,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:5,y:-10,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:-5,y:2,w:4,h:10,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:c.primary,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,breathe:0},{t:0.25,bob:0.5,breathe:0.5,ease:"easeInOut"},{t:0.5,bob:1,breathe:0},{t:0.75,bob:0.5,breathe:-0.5,ease:"easeInOut"},{t:1,bob:0,breathe:0}],
      move:[{t:0,leg_swing:0,bob:0,arm_raise:0.1},{t:0.25,leg_swing:0.7,bob:0.5,arm_raise:0.3,ease:"easeInOut"},{t:0.5,leg_swing:1,bob:1,arm_raise:0.1},{t:0.75,leg_swing:0.3,bob:0.5,arm_raise:-0.1,ease:"easeInOut"},{t:1,leg_swing:0,bob:0,arm_raise:0.1}],
      death:[{t:0,alpha:1,rot:0},{t:0.5,alpha:0.7,rot:45,ease:"easeIn"},{t:1,alpha:0,rot:90}]
    }
  }),
  quadruped:c=>({
    shapes:[
      {t:"rect",x:-10,y:-8,w:20,h:10,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:10,cy:-10,r:5,c:c.head,outline:1,oc:c.accent},
      {t:"rect",x:-8,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:-2,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:4,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:8,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"line",x1:-10,y1:-6,x2:-16,y2:-2,c:c.accent,w:2,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:1,tail_wag:1},{t:1,bob:0,tail_wag:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  dragon:c=>({
    shapes:[
      {t:"rect",x:-8,y:-8,w:18,h:10,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[10,-10],[16,-14],[14,-6]],c:c.head,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-6,-6],[-14,-12],[-12,-2]],c:c.accent,joint:"arm_raise"},
      {t:"polygon",pts:[[6,-6],[14,-12],[12,-2]],c:c.accent,joint:"arm_raise"},
      {t:"rect",x:-6,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:2,y:2,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"line",x1:-8,y1:-4,x2:-14,y2:2,c:c.accent,w:3,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0,arm_raise:0,breathe:0},{t:0.25,bob:0.5,tail_wag:0.3,arm_raise:0.1,breathe:0.5,ease:"easeInOut"},{t:0.5,bob:1,tail_wag:0.5,arm_raise:0.2,breathe:0},{t:0.75,bob:0.5,tail_wag:0.7,arm_raise:0.1,breathe:-0.5,ease:"easeInOut"},{t:1,bob:0,tail_wag:0,arm_raise:0,breathe:0}],
      move:[{t:0,leg_swing:0,bob:0,arm_raise:0.3,wing_flap:0},{t:0.25,leg_swing:0.5,bob:0.5,arm_raise:0.6,wing_flap:0.5,ease:"easeOut"},{t:0.5,leg_swing:1,bob:1,arm_raise:0.8,wing_flap:1},{t:0.75,leg_swing:0.5,bob:0.5,arm_raise:0.6,wing_flap:0.5,ease:"easeIn"},{t:1,leg_swing:0,bob:0,arm_raise:0.3,wing_flap:0}],
      death:[{t:0,alpha:1,rot:0},{t:0.5,alpha:0.6,rot:45,ease:"easeIn"},{t:1,alpha:0,rot:90}],
      // Body-specific attack: dragon rears back then lunges forward.
      attack:[{t:0,lunge:0,recoil:0,tail_wag:0},{t:0.3,lunge:-0.3,recoil:-0.5,tail_wag:0.3,ease:"easeIn"},{t:0.5,lunge:1,recoil:0.5,tail_wag:0.8,ease:"easeOut"},{t:1,lunge:0,recoil:0,tail_wag:0}]
    }
  }),
  serpent:c=>({
    shapes:[
      {t:"circle",cx:12,cy:-4,r:6,c:c.head,outline:1,oc:c.accent},
      {t:"arc",cx:4,cy:0,r:8,start:0,end:Math.PI,c:c.primary,w:8},
      {t:"arc",cx:-8,cy:0,r:8,start:0,end:Math.PI,c:c.primary,w:8},
      {t:"arc",cx:-18,cy:0,r:6,start:0,end:Math.PI,c:c.accent,w:6,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0,wobble:0},{t:0.25,bob:0.3,tail_wag:0.5,wobble:0.3,ease:"easeInOut"},{t:0.5,bob:0.5,tail_wag:1,wobble:0},{t:0.75,bob:0.3,tail_wag:0.5,wobble:-0.3,ease:"easeInOut"},{t:1,bob:0,tail_wag:0,wobble:0}],
      move:[{t:0,bob:0,tail_wag:0,wobble:0},{t:0.25,bob:0.5,tail_wag:0.7,wobble:0.5,ease:"easeOut"},{t:0.5,bob:1,tail_wag:1,wobble:0},{t:0.75,bob:0.5,tail_wag:0.7,wobble:-0.5,ease:"easeIn"},{t:1,bob:0,tail_wag:0,wobble:0}],
      death:[{t:0,alpha:1,rot:0},{t:0.5,alpha:0.5,rot:30,ease:"easeIn"},{t:1,alpha:0,rot:90}]
    }
  }),
  bird:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-6,rx:7,ry:6,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:0,cy:-14,r:4,c:c.head,outline:1,oc:c.accent},
      {t:"polygon",pts:[[2,-15],[6,-13],[2,-12]],c:c.accent},
      {t:"polygon",pts:[[-4,-8],[-12,-12],[-10,-4]],c:c.accent,joint:"arm_raise"},
      {t:"polygon",pts:[[4,-8],[12,-12],[10,-4]],c:c.accent,joint:"arm_raise"}
    ],
    animations:{
      idle:[{t:0,bob:0,arm_raise:0},{t:0.25,bob:0.5,arm_raise:0.3,ease:"easeOut"},{t:0.5,bob:1,arm_raise:0.5},{t:0.75,bob:0.5,arm_raise:0.3,ease:"easeIn"},{t:1,bob:0,arm_raise:0}],
      move:[{t:0,arm_raise:0,bob:0},{t:0.15,arm_raise:0.8,bob:0.5,ease:"easeOut"},{t:0.3,arm_raise:1,bob:1},{t:0.5,arm_raise:0.2,bob:0.5,ease:"easeInOut"},{t:0.7,arm_raise:1,bob:1},{t:0.85,arm_raise:0.8,bob:0.5,ease:"easeIn"},{t:1,arm_raise:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:0.5,alpha:0.5,rot:-30,ease:"easeIn"},{t:1,alpha:0,rot:-90}],
      // Body-specific attack: bird dives forward with wings tucked.
      attack:[{t:0,lunge:0,arm_raise:0,recoil:0},{t:0.2,lunge:0.3,arm_raise:0.5,recoil:0.2,ease:"easeIn"},{t:0.5,lunge:1,arm_raise:0.2,recoil:0.5,ease:"easeOut"},{t:1,lunge:0,arm_raise:0,recoil:0}]
    }
  }),
  insect:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-6,rx:6,ry:5,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"ellipse",cx:0,cy:4,rx:7,ry:6,c:c.accent,outline:1,oc:c.primary},
      {t:"line",x1:-6,y1:0,x2:-12,y2:4,c:c.accent,w:1,joint:"leg_swing"},
      {t:"line",x1:-6,y1:2,x2:-12,y2:8,c:c.accent,w:1,joint:"leg_swing"},
      {t:"line",x1:6,y1:0,x2:12,y2:4,c:c.accent,w:1,joint:"leg_swing"},
      {t:"line",x1:6,y1:2,x2:12,y2:8,c:c.accent,w:1,joint:"leg_swing"},
      {t:"line",x1:-4,y1:-8,x2:-8,y2:-14,c:c.accent,w:1,joint:"arm_raise"},
      {t:"line",x1:4,y1:-8,x2:8,y2:-14,c:c.accent,w:1,joint:"arm_raise"}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.5,leg_swing:0.5},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  crab:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-4,rx:10,ry:7,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:-4,cy:-8,r:2,c:"#000"},
      {t:"circle",cx:4,cy:-8,r:2,c:"#000"},
      {t:"polygon",pts:[[-10,-6],[-16,-10],[-14,-2]],c:c.accent,joint:"arm_raise"},
      {t:"polygon",pts:[[10,-6],[16,-10],[14,-2]],c:c.accent,joint:"arm_raise"},
      {t:"line",x1:-6,y1:3,x2:-10,y2:8,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:6,y1:3,x2:10,y2:8,c:c.accent,w:2,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  golem:c=>({
    shapes:[
      {t:"rect",x:-9,y:-14,w:18,h:18,c:c.primary,fill:"gradient",c2:c.accent,outline:2,oc:c.accent},
      {t:"rect",x:-5,y:-20,w:10,h:6,c:c.head,outline:1,oc:c.accent},
      {t:"rect",x:-14,y:-12,w:5,h:14,c:c.accent,joint:"arm_raise"},
      {t:"rect",x:9,y:-12,w:5,h:14,c:c.accent,joint:"arm_raise"},
      {t:"circle",cx:0,cy:-5,r:3,c:c.accent,glow:6}
    ],
    animations:{
      idle:[{t:0,bob:0,breathe:0},{t:0.5,bob:0.2,breathe:0.3,ease:"easeInOut"},{t:1,bob:0,breathe:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.3,leg_swing:0.5,bob:0.3,ease:"easeOut"},{t:0.5,leg_swing:1,bob:0.5},{t:0.7,leg_swing:0.5,bob:0.3,ease:"easeIn"},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:0.3,alpha:0.8,rot:20,ease:"easeIn"},{t:1,alpha:0,rot:90}],
      // Body-specific attack: golem winds up then slams down heavily.
      attack:[{t:0,lunge:0,recoil:0},{t:0.3,lunge:-0.2,recoil:-0.3,ease:"easeIn"},{t:0.5,lunge:0.8,recoil:0.8,ease:"easeOut"},{t:0.7,lunge:0.3,recoil:0.2},{t:1,lunge:0,recoil:0}]
    }
  }),
  ghost:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-10,r:8,c:c.primary,fill:"gradient",c2:c.accent,alpha:0.7},
      {t:"polygon",pts:[[-8,-4],[8,-4],[6,8],[3,4],[0,8],[-3,4],[-6,8]],c:c.primary,alpha:0.7},
      {t:"circle",cx:-3,cy:-12,r:2,c:"#000"},
      {t:"circle",cx:3,cy:-12,r:2,c:"#000"}
    ],
    animations:{
      idle:[{t:0,bob:0,wobble:0},{t:0.25,bob:0.5,wobble:0.5,ease:"easeInOut"},{t:0.5,bob:1,wobble:0},{t:0.75,bob:0.5,wobble:-0.5,ease:"easeInOut"},{t:1,bob:0,wobble:0}],
      move:[{t:0,bob:0,wobble:0},{t:0.25,bob:0.5,wobble:0.3,ease:"easeOut"},{t:0.5,bob:1,wobble:0},{t:0.75,bob:0.5,wobble:-0.3,ease:"easeIn"},{t:1,bob:0,wobble:0}],
      death:[{t:0,alpha:0.7,rot:0},{t:0.5,alpha:0.3,rot:0,ease:"easeIn"},{t:1,alpha:0,rot:0}]
    }
  }),
  fish:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-4,rx:10,ry:6,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-10,-4],[-16,-8],[-16,0]],c:c.accent,joint:"tail_wag"},
      {t:"polygon",pts:[[-2,-10],[2,-10],[0,-6]],c:c.accent},
      {t:"circle",cx:6,cy:-6,r:2,c:"#000"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:0.5,tail_wag:1},{t:1,bob:0,tail_wag:0}],
      move:[{t:0,tail_wag:0,bob:0},{t:0.5,tail_wag:1,bob:0.5},{t:1,tail_wag:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  blob:c=>({
    shapes:[
      {t:"circle",cx:0,cy:0,r:12,c:c.primary,fill:"gradient",c2:c.accent},
      {t:"circle",cx:-4,cy:-2,r:2,c:"#000"},
      {t:"circle",cx:4,cy:-2,r:2,c:"#000"}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  flying:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-8,r:6,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:0,cy:-14,r:4,c:c.head},
      {t:"arc",cx:-10,cy:-8,r:8,start:0,end:2,c:c.accent,w:2,joint:"arm_raise"},
      {t:"arc",cx:10,cy:-8,r:8,start:Math.PI,end:3,c:c.accent,w:2,joint:"arm_raise"}
    ],
    animations:{
      idle:[{t:0,bob:0,arm_raise:0},{t:0.5,bob:1,arm_raise:0.3},{t:1,bob:0,arm_raise:0}],
      move:[{t:0,arm_raise:0,bob:0},{t:0.5,arm_raise:1,bob:1},{t:1,arm_raise:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  mechanical:c=>({
    shapes:[
      {t:"rect",x:-8,y:-12,w:16,h:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-4,y:-18,w:8,h:6,c:c.head,outline:1,oc:c.accent},
      {t:"circle",cx:-8,cy:4,r:4,c:"#333"},
      {t:"circle",cx:8,cy:4,r:4,c:"#333"},
      {t:"rect",x:8,y:-10,w:4,h:10,c:c.accent,joint:"arm_raise"},
      {t:"line",x1:0,y1:-18,x2:0,y2:-22,c:c.accent,w:1},
      {t:"circle",cx:0,cy:-23,r:1.5,c:c.accent,glow:4}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  structure:c=>({
    shapes:[
      {t:"rect",x:-10,y:-10,w:20,h:20,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:0,cy:-12,r:4,c:c.accent,glow:6}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.3},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  plant:c=>({
    shapes:[
      {t:"rect",x:-3,y:-4,w:6,h:12,c:"#6a4",outline:1,oc:"#482"},
      {t:"circle",cx:0,cy:-12,r:8,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"line",x1:-6,y1:8,x2:-10,y2:12,c:"#6a4",w:3,joint:"leg_swing"},
      {t:"line",x1:6,y1:8,x2:10,y2:12,c:"#6a4",w:3,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:0.5,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  undead:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-18,r:6,c:"#ddd"},
      {t:"rect",x:-4,y:-12,w:8,h:14,c:"#ddd",outline:1,oc:"#888"},
      {t:"line",x1:-3,y1:-8,x2:3,y2:-8,c:"#888",w:1},
      {t:"line",x1:-3,y1:-4,x2:3,y2:-4,c:"#888",w:1},
      {t:"rect",x:-8,y:-10,w:3,h:8,c:"#ddd",joint:"arm_raise"},
      {t:"rect",x:5,y:-10,w:3,h:8,c:"#ddd",joint:"arm_raise"},
      {t:"rect",x:-4,y:2,w:3,h:8,c:"#ddd",joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:3,h:8,c:"#ddd",joint:"leg_swing"},
      {t:"circle",cx:-2,cy:-19,r:1.5,c:c.accent,glow:4},
      {t:"circle",cx:2,cy:-19,r:1.5,c:c.accent,glow:4}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  demon:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-18,r:6,c:c.head,fill:"gradient",c2:c.accent},
      {t:"polygon",pts:[[-4,-22],[-2,-26],[0,-22]],c:c.accent},
      {t:"polygon",pts:[[4,-22],[2,-26],[0,-22]],c:c.accent},
      {t:"rect",x:-5,y:-12,w:10,h:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-9,y:-10,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:5,y:-10,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:-5,y:2,w:4,h:10,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:4,h:10,c:c.primary,joint:"leg_swing"},
      {t:"line",x1:0,y1:4,x2:-4,y2:10,c:c.accent,w:2,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:1,tail_wag:1},{t:1,bob:0,tail_wag:0}],
      move:[{t:0,leg_swing:0,bob:0,tail_wag:0},{t:0.5,leg_swing:1,bob:1,tail_wag:1},{t:1,leg_swing:0,bob:0,tail_wag:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  "beast-man":c=>({
    shapes:[
      {t:"circle",cx:0,cy:-18,r:7,c:c.head,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-6,-20],[-9,-24],[-5,-22]],c:c.accent},
      {t:"polygon",pts:[[6,-20],[9,-24],[5,-22]],c:c.accent},
      {t:"rect",x:-6,y:-11,w:12,h:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-10,y:-9,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:6,y:-9,w:4,h:10,c:c.primary,joint:"arm_raise"},
      {t:"rect",x:-5,y:3,w:4,h:9,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:1,y:3,w:4,h:9,c:c.primary,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  aquatic:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-6,rx:8,ry:7,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:5,cy:-8,r:2,c:"#000"},
      {t:"line",x1:-6,y1:0,x2:-12,y2:6,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:-4,y1:2,x2:-10,y2:10,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:0,y1:4,x2:-4,y2:12,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:4,y1:4,x2:8,y2:12,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:6,y1:2,x2:12,y2:10,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:8,y1:0,x2:14,y2:6,c:c.accent,w:2,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.5,leg_swing:0.5},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  monopod:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-6,r:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:-5,cy:-8,r:2,c:"#000"},
      {t:"circle",cx:5,cy:-8,r:2,c:"#000"},
      {t:"rect",x:-4,y:6,w:3,h:6,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:1,y:6,w:3,h:6,c:c.accent,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:1},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  centaur:c=>({
    shapes:[
      // Human torso
      {t:"circle",cx:0,cy:-14,r:6,c:c.primary,fill:"gradient",c2:c.head,outline:1,oc:c.accent},
      {t:"circle",cx:-2,cy:-15,r:1,c:"#000"},
      {t:"circle",cx:2,cy:-15,r:1,c:"#000"},
      {t:"rect",x:-4,y:-8,w:8,h:8,c:c.primary,fill:"gradient",c2:c.accent},
      // Horse body
      {t:"ellipse",cx:0,cy:4,rx:14,ry:7,c:c.accent,fill:"gradient",c2:c.primary,outline:1,oc:c.primary},
      // Four legs
      {t:"rect",x:-10,y:8,w:3,h:8,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:-4,y:8,w:3,h:8,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:1,y:8,w:3,h:8,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:7,y:8,w:3,h:8,c:c.accent,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.5,leg_swing:0.5},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  hydra:c=>({
    shapes:[
      {t:"circle",cx:0,cy:0,r:12,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      // Three heads
      {t:"line",x1:-6,y1:-8,x2:-10,y2:-18,c:c.accent,w:3,joint:"tail_wag"},
      {t:"circle",cx:-10,cy:-18,r:4,c:c.head,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"line",x1:0,y1:-10,x2:0,y2:-20,c:c.accent,w:3,joint:"tail_wag"},
      {t:"circle",cx:0,cy:-20,r:4,c:c.head,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"line",x1:6,y1:-8,x2:10,y2:-18,c:c.accent,w:3,joint:"tail_wag"},
      {t:"circle",cx:10,cy:-18,r:4,c:c.head,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-6,y:10,w:3,h:6,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:3,y:10,w:3,h:6,c:c.accent,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0,leg_swing:0},{t:0.5,bob:0.5,tail_wag:1,leg_swing:0.5},{t:1,bob:0,tail_wag:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0,tail_wag:0},{t:0.5,leg_swing:1,bob:0.5,tail_wag:1},{t:1,leg_swing:0,bob:0,tail_wag:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  elemental:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-4,r:14,c:c.primary,fill:"gradient",c2:c.accent,glow:6,outline:1,oc:c.accent},
      {t:"circle",cx:-4,cy:-6,r:2,c:c.accent,glow:4},
      {t:"circle",cx:4,cy:-6,r:2,c:c.accent,glow:4},
      // Floating shards
      {t:"polygon",pts:[[-12,0],[-8,-4],[-10,4]],c:c.accent,glow:4,joint:"wing_flap"},
      {t:"polygon",pts:[[12,0],[8,-4],[10,4]],c:c.accent,glow:4,joint:"wing_flap"}
    ],
    animations:{
      idle:[{t:0,bob:0,wing_flap:0},{t:0.5,bob:1,wing_flap:1},{t:1,bob:0,wing_flap:0}],
      move:[{t:0,bob:0,wing_flap:0},{t:0.5,bob:1,wing_flap:1},{t:1,bob:0,wing_flap:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  aberration:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-2,r:12,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      // Multiple eyes
      {t:"circle",cx:-5,cy:-4,r:2,c:"#f00"},
      {t:"circle",cx:5,cy:-4,r:2,c:"#f00"},
      {t:"circle",cx:0,cy:-8,r:1.5,c:"#f00"},
      {t:"circle",cx:-3,cy:2,r:1.5,c:"#f00"},
      {t:"circle",cx:3,cy:2,r:1.5,c:"#f00"},
      // Tentacles
      {t:"line",x1:-8,y1:6,x2:-12,y2:14,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:0,y1:8,x2:0,y2:16,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:8,y1:6,x2:12,y2:14,c:c.accent,w:3,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:0.5,tail_wag:1},{t:1,bob:0,tail_wag:0}],
      move:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:1,tail_wag:1},{t:1,bob:0,tail_wag:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  ooze:c=>({
    shapes:[
      {t:"circle",cx:0,cy:0,r:14,c:c.primary,fill:"gradient",c2:c.accent,alpha:0.8,outline:1,oc:c.accent},
      {t:"circle",cx:-4,cy:-2,r:2,c:"#000"},
      {t:"circle",cx:4,cy:-2,r:2,c:"#000"},
      {t:"circle",cx:0,cy:4,r:3,c:c.accent,alpha:0.5}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:1},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:0}]
    }
  }),
  crystal:c=>({
    shapes:[
      {t:"polygon",pts:[[0,-16],[-10,-4],[-6,8],[6,8],[10,-4]],c:c.primary,fill:"gradient",c2:c.accent,glow:4,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-4,-8],[0,-12],[4,-8]],c:c.accent,glow:4},
      {t:"circle",cx:-3,cy:-6,r:1.5,c:"#fff",glow:3},
      {t:"circle",cx:3,cy:-6,r:1.5,c:"#fff",glow:3}
    ],
    animations:{
      idle:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      move:[{t:0,bob:0},{t:0.5,bob:0.5},{t:1,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  construct:c=>({
    shapes:[
      {t:"rect",x:-8,y:-16,w:16,h:14,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"rect",x:-5,y:-12,w:3,h:3,c:"#0ff",glow:4},
      {t:"rect",x:2,y:-12,w:3,h:3,c:"#0ff",glow:4},
      {t:"rect",x:-10,y:-2,w:20,h:10,c:c.accent,fill:"gradient",c2:c.primary,outline:1,oc:c.primary},
      {t:"rect",x:-8,y:8,w:4,h:8,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:4,y:8,w:4,h:8,c:c.accent,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.3,leg_swing:0},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.3},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  angel:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-14,r:6,c:c.primary,fill:"gradient",c2:"#fff",outline:1,oc:c.accent},
      {t:"circle",cx:-2,cy:-15,r:1,c:"#000"},
      {t:"circle",cx:2,cy:-15,r:1,c:"#000"},
      {t:"rect",x:-4,y:-8,w:8,h:10,c:c.primary,fill:"gradient",c2:c.accent},
      {t:"rect",x:-4,y:2,w:3,h:8,c:c.accent,joint:"leg_swing"},
      {t:"rect",x:1,y:2,w:3,h:8,c:c.accent,joint:"leg_swing"},
      // Halo
      {t:"arc",cx:0,cy:-22,r:7,start:0,end:Math.PI*2,c:"#ffd",glow:6,w:1,alpha:0.6}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.5,leg_swing:0.5},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  spider:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-4,rx:10,ry:7,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:0,cy:-10,r:5,c:c.head,fill:"gradient",c2:c.primary},
      {t:"line",x1:-8,y1:-6,x2:-16,y2:0,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:-8,y1:-2,x2:-16,y2:4,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:8,y1:-6,x2:16,y2:0,c:c.accent,w:2,joint:"leg_swing"},
      {t:"line",x1:8,y1:-2,x2:16,y2:4,c:c.accent,w:2,joint:"leg_swing"},
      {t:"circle",cx:-2,cy:-12,r:1.5,c:"#f00",glow:2},
      {t:"circle",cx:2,cy:-12,r:1.5,c:"#f00",glow:2}
    ],
    animations:{
      idle:[{t:0,bob:0,leg_swing:0},{t:0.5,bob:0.3,leg_swing:0.2},{t:1,bob:0,leg_swing:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:1,bob:0.5},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:180}]
    }
  }),
  wyvern:c=>({
    shapes:[
      {t:"rect",x:-8,y:-6,w:16,h:10,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[8,-8],[16,-14],[14,-2]],c:c.head,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-4,-4],[-12,-14],[-10,-2]],c:c.accent,joint:"wing_flap"},
      {t:"polygon",pts:[[4,-4],[12,-14],[10,-2]],c:c.accent,joint:"wing_flap"},
      {t:"rect",x:-4,y:4,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:2,y:4,w:4,h:8,c:c.primary,joint:"leg_swing"},
      {t:"polygon",pts:[[-8,-2],[-16,-6],[-14,2]],c:c.accent,joint:"tail_wag"},
      {t:"polygon",pts:[[-14,2],[-18,0],[-16,4]],c:c.accent,joint:"tail_wag"}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0,wing_flap:0},{t:0.5,bob:1,tail_wag:0.5,wing_flap:0.3},{t:1,bob:0,tail_wag:0,wing_flap:0}],
      move:[{t:0,leg_swing:0,bob:0,wing_flap:0.5},{t:0.5,leg_swing:1,bob:1,wing_flap:1},{t:1,leg_swing:0,bob:0,wing_flap:0.5}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  treant:c=>({
    shapes:[
      {t:"rect",x:-6,y:-8,w:12,h:16,c:c.primary,fill:"gradient",c2:c.accent,outline:2,oc:"#5a3"},
      {t:"rect",x:-8,y:-12,w:6,h:8,c:c.accent,joint:"arm_raise"},
      {t:"rect",x:2,y:-12,w:6,h:8,c:c.accent,joint:"arm_raise"},
      {t:"rect",x:-4,y:8,w:3,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:1,y:8,w:3,h:8,c:c.primary,joint:"leg_swing"},
      {t:"circle",cx:-5,cy:-14,r:3,c:"#4a6",glow:2},
      {t:"circle",cx:5,cy:-14,r:3,c:"#4a6",glow:2},
      {t:"circle",cx:0,cy:-16,r:2,c:"#6b8",glow:3}
    ],
    animations:{
      idle:[{t:0,bob:0,arm_raise:0},{t:0.5,bob:0.3,arm_raise:0.1},{t:1,bob:0,arm_raise:0}],
      move:[{t:0,leg_swing:0,bob:0},{t:0.5,leg_swing:0.5,bob:0.3},{t:1,leg_swing:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  kraken:c=>({
    shapes:[
      {t:"ellipse",cx:0,cy:-6,rx:9,ry:7,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"circle",cx:0,cy:-12,r:5,c:c.head,fill:"gradient",c2:c.primary},
      {t:"line",x1:-6,y1:0,x2:-12,y2:10,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:-3,y1:0,x2:-6,y2:12,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:0,y1:0,x2:0,y2:14,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:3,y1:0,x2:6,y2:12,c:c.accent,w:3,joint:"tail_wag"},
      {t:"line",x1:6,y1:0,x2:12,y2:10,c:c.accent,w:3,joint:"tail_wag"},
      {t:"circle",cx:-2,cy:-13,r:1.5,c:"#f44",glow:2},
      {t:"circle",cx:2,cy:-13,r:1.5,c:"#f44",glow:2}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0},{t:0.5,bob:0.5,tail_wag:0.5},{t:1,bob:0,tail_wag:0}],
      move:[{t:0,tail_wag:0,bob:0},{t:0.5,tail_wag:1,bob:0.5},{t:1,tail_wag:0,bob:0}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  gargoyle:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-14,r:6,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-3,-18],[-5,-22],[-1,-20]],c:c.accent},
      {t:"polygon",pts:[[3,-18],[5,-22],[1,-20]],c:c.accent},
      {t:"rect",x:-5,y:-8,w:10,h:12,c:c.primary,fill:"gradient",c2:c.accent,outline:1,oc:c.accent},
      {t:"polygon",pts:[[-4,-6],[-12,-12],[-10,-2]],c:c.accent,joint:"wing_flap"},
      {t:"polygon",pts:[[4,-6],[12,-12],[10,-2]],c:c.accent,joint:"wing_flap"},
      {t:"rect",x:-4,y:4,w:3,h:8,c:c.primary,joint:"leg_swing"},
      {t:"rect",x:1,y:4,w:3,h:8,c:c.primary,joint:"leg_swing"}
    ],
    animations:{
      idle:[{t:0,bob:0,wing_flap:0},{t:0.5,bob:0.2,wing_flap:0.1},{t:1,bob:0,wing_flap:0}],
      move:[{t:0,leg_swing:0,bob:0,wing_flap:0.5},{t:0.5,leg_swing:1,bob:0.5,wing_flap:1},{t:1,leg_swing:0,bob:0,wing_flap:0.5}],
      death:[{t:0,alpha:1,rot:0},{t:1,alpha:0,rot:90}]
    }
  }),
  wraith:c=>({
    shapes:[
      {t:"circle",cx:0,cy:-14,r:6,c:c.primary,fill:"gradient",c2:c.accent,alpha:0.8},
      {t:"polygon",pts:[[-6,-8],[-8,8],[-4,10],[0,8],[4,10],[8,8],[6,-8]],c:c.primary,fill:"gradient",c2:c.accent,alpha:0.7,joint:"tail_wag"},
      {t:"line",x1:-4,y1:-6,x2:-8,y2:2,c:c.accent,w:2,alpha:0.6,joint:"arm_raise"},
      {t:"line",x1:4,y1:-6,x2:8,y2:2,c:c.accent,w:2,alpha:0.6,joint:"arm_raise"},
      {t:"circle",cx:-2,cy:-15,r:1.5,c:"#a4f",glow:4},
      {t:"circle",cx:2,cy:-15,r:1.5,c:"#a4f",glow:4}
    ],
    animations:{
      idle:[{t:0,bob:0,tail_wag:0,arm_raise:0},{t:0.5,bob:1,tail_wag:0.5,arm_raise:0.2},{t:1,bob:0,tail_wag:0,arm_raise:0}],
      move:[{t:0,bob:0,tail_wag:0,arm_raise:0.3},{t:0.5,bob:1,tail_wag:1,arm_raise:0.8},{t:1,bob:0,tail_wag:0,arm_raise:0.3}],
      death:[{t:0,alpha:0.8,rot:0},{t:1,alpha:0,rot:0}]
    }
  })
};
const WEAPONS={
  // D5: weapon shapes are now defined relative to the grip (hand position).
  // RecipeAssembler shifts them to grip-origin and attaches them to the arm.
  sword:{shape:{t:"line",x1:0,y1:0,x2:7,y2:-8,c:"#ccc",w:2},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  bow:{shapes:[
    {t:"arc",cx:0,cy:0,r:8,start:-1,end:1,c:"#a72",w:2},
    {t:"line",x1:0,y1:-6.7,x2:0,y2:6.7,c:"#ddd",w:1,joint:"bow_draw",jointAxis:"x",jointRange:-5,grip:{x:0,y:0}}
  ],attack:[{t:0,bow_draw:0,arm_raise:0},{t:0.5,bow_draw:1,arm_raise:0.5},{t:1,bow_draw:0,arm_raise:0}]},
  staff:{shape:{t:"line",x1:0,y1:0,x2:0,y2:-12,c:"#a72",w:2},
    attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}]},
  dagger:{shape:{t:"line",x1:0,y1:0,x2:4,y2:-4,c:"#ccc",w:1},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  shield:{shape:{t:"rect",x:-6,y:-5,w:6,h:10,c:"#ccc",grip:{x:0,y:0}},
    attack:[{t:0,arm_raise:0},{t:1,arm_raise:0}]},
  hammer:{shape:{t:"rect",x:0,y:-6,w:6,h:6,c:"#888"},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  claws:{shape:{t:"line",x1:0,y1:0,x2:3,y2:4,c:"#ccc",w:1},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  breath:{shape:{t:"circle",cx:0,cy:0,r:4,c:"#f80",glow:6},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  scythe:{shape:{t:"arc",cx:0,cy:-8,r:8,start:-0.5,end:1.2,c:"#9f9",w:2},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  whip:{shape:{t:"line",x1:0,y1:0,x2:10,y2:4,c:"#a72",w:1},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:0.6,arm_raise:0.5},{t:1,arm_raise:0}]},
  spear:{shape:{t:"line",x1:0,y1:0,x2:8,y2:-10,c:"#aaa",w:2},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  rifle:{shape:{t:"rect",x:0,y:0,w:10,h:4,c:"#666"},
    attack:[{t:0,arm_raise:0},{t:0.2,arm_raise:0.5},{t:1,arm_raise:0}]},
  wand:{shape:{t:"line",x1:0,y1:0,x2:2,y2:-10,c:"#a72",w:1},
    attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}]},
  axe:{shape:{t:"polygon",pts:[[0,0],[6,-4],[6,4],[0,0]],c:"#999"},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  trident:{shape:{t:"line",x1:0,y1:0,x2:6,y2:-12,c:"#7bb",w:2},
    attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]},
  crossbow:{shape:{t:"rect",x:0,y:0,w:8,h:3,c:"#864"},
    attack:[{t:0,arm_raise:0},{t:0.2,arm_raise:0.5},{t:1,arm_raise:0}]},
  orb:{shape:{t:"circle",cx:0,cy:0,r:5,c:"#f0f",glow:8},
    attack:[{t:0,arm_raise:0},{t:0.5,arm_raise:1},{t:1,arm_raise:0}]},
  dual_blades:{shape:{t:"line",x1:0,y1:0,x2:5,y2:-6,c:"#ddd",w:1},
    attack:[{t:0,arm_raise:0},{t:0.2,arm_raise:1},{t:0.5,arm_raise:0.3},{t:0.8,arm_raise:1},{t:1,arm_raise:0}]},
  none:{shape:null,attack:[{t:0,arm_raise:0},{t:0.3,arm_raise:1},{t:1,arm_raise:0}]}
};

// Normalize recipe shapes so all units have the same visual height on screen.
// Standard height = 36px (matches base starter units like Knight/Archer).
// Computes the bounding box of all shapes, then scales them to fit the standard.
// This handles ALL units: base starters, generated units, and future custom units.
const RECIPE_STD_HEIGHT=36;
function _normalizeRecipeHeight(recipe){
  if(!recipe||!recipe.shapes||!recipe.shapes.length)return recipe;
  let minY=Infinity,maxY=-Infinity;
  for(const s of recipe.shapes){
    if(s.cy!==undefined){minY=Math.min(minY,s.cy-(s.r||0));maxY=Math.max(maxY,s.cy+(s.r||0));}
    if(s.y!==undefined){minY=Math.min(minY,s.y);maxY=Math.max(maxY,s.y+(s.h||0));}
    if(s.y1!==undefined)minY=Math.min(minY,s.y1);
    if(s.y2!==undefined)maxY=Math.max(maxY,s.y2);
    if(s.pts)for(const p of s.pts){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
  }
  const h=maxY-minY;
  if(h<=0||Math.abs(h-RECIPE_STD_HEIGHT)<1)return recipe; // already close enough
  const norm=RECIPE_STD_HEIGHT/h;
  // Don't upscale tiny sprites more than 3x (looks pixelated), don't downscale more than 0.5x
  const scale=Math.max(0.5,Math.min(3,norm));
  return {
    ...recipe,
    shapes:recipe.shapes.map(s=>scaleShape(s,scale)),
    _normalized:1
  };
}

function scaleShape(s,scale){
  if(!scale||scale===1)return s;
  const out={...s};
  if(out.cx!==undefined)out.cx*=scale;
  if(out.cy!==undefined)out.cy*=scale;
  if(out.r!==undefined)out.r*=scale;
  if(out.x!==undefined)out.x*=scale;
  if(out.y!==undefined)out.y*=scale;
  if(out.w!==undefined)out.w*=scale;
  if(out.h!==undefined)out.h*=scale;
  if(out.x1!==undefined)out.x1*=scale;
  if(out.y1!==undefined)out.y1*=scale;
  if(out.x2!==undefined)out.x2*=scale;
  if(out.y2!==undefined)out.y2*=scale;
  if(out.rx!==undefined)out.rx*=scale;
  if(out.ry!==undefined)out.ry*=scale;
  if(out.pts)out.pts=out.pts.map(p=>[p[0]*scale,p[1]*scale]);
  if(out.parentPivot){out.parentPivot={x:out.parentPivot.x*scale,y:out.parentPivot.y*scale};}
  if(out.gripOffset){out.gripOffset={x:out.gripOffset.x*scale,y:out.gripOffset.y*scale};}
  if(out.grip){out.grip={x:out.grip.x*scale,y:out.grip.y*scale};}
  if(out.jointRange!==undefined)out.jointRange*=scale;
  return out;
}
// Phase 25: Visual modifier lookup tables — each enum value maps to shapes.
const HEAD_FEATURES={
  none:()=>[],
  horns:c=>[{t:"polygon",pts:[[-3,-22],[-1,-28],[1,-28],[3,-22]],c:c.accent}],
  antlers:c=>[{t:"line",x1:-2,y1:-22,x2:-6,y2:-28,c:c.accent,w:2},{t:"line",x1:-6,y1:-28,x2:-9,y2:-26,c:c.accent,w:1},{t:"line",x1:2,y1:-22,x2:6,y2:-28,c:c.accent,w:2},{t:"line",x1:6,y1:-28,x2:9,y2:-26,c:c.accent,w:1}],
  crest:c=>[{t:"polygon",pts:[[-4,-22],[-2,-26],[0,-24],[2,-26],[4,-22]],c:c.accent}],
  halo:c=>[{t:"circle",cx:0,cy:-24,r:6,c:"#ffd",glow:6,alpha:0.6}],
  crown:c=>[{t:"polygon",pts:[[-5,-22],[-5,-26],[-3,-24],[-1,-27],[1,-27],[3,-24],[5,-26],[5,-22]],c:"#fd4"}],
  horns_curved:c=>[{t:"arc",cx:-4,cy:-22,r:5,start:Math.PI,end:0,c:c.accent,w:2},{t:"arc",cx:4,cy:-22,r:5,start:Math.PI,end:0,c:c.accent,w:2}],
  ears_pointed:c=>[{t:"polygon",pts:[[-5,-20],[-7,-24],[-3,-22]],c:c.accent},{t:"polygon",pts:[[5,-20],[7,-24],[3,-22]],c:c.accent}],
  mask:c=>[{t:"rect",x:-6,y:-22,w:12,h:8,c:c.accent,alpha:0.8}],
  eyepatch:c=>[{t:"rect",x:-5,y:-20,w:5,h:4,c:"#111",alpha:0.9}],
  tiara:c=>[{t:"arc",cx:0,cy:-22,r:5,start:Math.PI,end:0,c:"#fd4",w:2},{t:"circle",cx:0,cy:-25,r:2,c:"#fff",glow:4}],
  antenna:c=>[{t:"line",x1:-3,y1:-22,x2:-5,y2:-28,c:c.accent,w:1},{t:"circle",cx:-5,cy:-28,r:2,c:c.accent,glow:3},{t:"line",x1:3,y1:-22,x2:5,y2:-28,c:c.accent,w:1},{t:"circle",cx:5,cy:-28,r:2,c:c.accent,glow:3}],
  frill:c=>[{t:"polygon",pts:[[-8,-20],[-4,-24],[0,-22],[4,-24],[8,-20]],c:c.accent,alpha:0.7}],
  beak:c=>[{t:"polygon",pts:[[-3,-20],[0,-26],[3,-20]],c:"#fa0"}],
  hood:c=>[{t:"polygon",pts:[[-7,-18],[-8,-24],[0,-26],[8,-24],[7,-18]],c:c.accent,alpha:0.8}],
  mohawk:c=>[{t:"polygon",pts:[[-1,-22],[-2,-28],[0,-30],[2,-28],[1,-22]],c:c.accent}],
  goggles:c=>[{t:"rect",x:-7,y:-20,w:6,h:4,c:"#333",alpha:0.9},{t:"rect",x:1,y:-20,w:6,h:4,c:"#333",alpha:0.9},{t:"circle",cx:-4,cy:-18,r:1.5,c:"#0ff",glow:3},{t:"circle",cx:4,cy:-18,r:1.5,c:"#0ff",glow:3}],
  third_eye:c=>[{t:"circle",cx:0,cy:-24,r:2.5,c:"#f0f",glow:6},{t:"circle",cx:0,cy:-24,r:1,c:"#fff"}],
  flower_crown:c=>[{t:"circle",cx:-5,cy:-22,r:2.5,c:"#f6c"},{t:"circle",cx:0,cy:-23,r:2.5,c:"#fd4"},{t:"circle",cx:5,cy:-22,r:2.5,c:"#a4f"}],
  headphones:c=>[{t:"arc",cx:0,cy:-20,r:7,start:0,end:Math.PI,c:"#222",w:3},{t:"rect",x:-8,y:-20,w:4,h:5,c:"#222"},{t:"rect",x:4,y:-20,w:4,h:5,c:"#222"}],
};
const BACK_FEATURES={
  none:()=>[],
  wings_bat:c=>[{t:"polygon",pts:[[-6,-10],[-14,-16],[-12,-4],[-6,-6]],c:c.accent,joint:"wing_flap"},{t:"polygon",pts:[[6,-10],[14,-16],[12,-4],[6,-6]],c:c.accent,joint:"wing_flap"}],
  wings_feathered:c=>[{t:"polygon",pts:[[-6,-10],[-16,-14],[-14,-4],[-6,-6]],c:"#fff",joint:"wing_flap"},{t:"polygon",pts:[[6,-10],[16,-14],[14,-4],[6,-6]],c:"#fff",joint:"wing_flap"}],
  wings_dragon:c=>[{t:"polygon",pts:[[-6,-10],[-18,-20],[-16,-2],[-6,-6]],c:c.accent,joint:"wing_flap"},{t:"polygon",pts:[[6,-10],[18,-20],[16,-2],[6,-6]],c:c.accent,joint:"wing_flap"}],
  cape:c=>[{t:"rect",x:-7,y:-10,w:14,h:14,c:c.accent,joint:"recoil"}],
  shell:c=>[{t:"arc",cx:0,cy:-8,r:10,start:Math.PI,end:0,c:c.accent,w:2,fill:"gradient",c2:c.primary}],
  spikes:c=>[{t:"polygon",pts:[[-4,-12],[-2,-16],[0,-12]],c:c.accent},{t:"polygon",pts:[[0,-12],[2,-16],[4,-12]],c:c.accent}],
  aura_vent:c=>[{t:"circle",cx:0,cy:-14,r:3,c:c.accent,glow:4,alpha:0.5}],
  wings_insect:c=>[{t:"polygon",pts:[[-4,-8],[-12,-14],[-10,-6],[-4,-4]],c:"#aff",alpha:0.6,joint:"wing_flap"},{t:"polygon",pts:[[4,-8],[12,-14],[10,-6],[4,-4]],c:"#aff",alpha:0.6,joint:"wing_flap"}],
  wings_angel:c=>[{t:"polygon",pts:[[-5,-10],[-18,-18],[-16,-2],[-5,-6]],c:"#ffe",glow:4,joint:"wing_flap"},{t:"polygon",pts:[[5,-10],[18,-18],[16,-2],[5,-6]],c:"#ffe",glow:4,joint:"wing_flap"}],
  jetpack:c=>[{t:"rect",x:-8,y:-8,w:6,h:10,c:"#888"},{t:"rect",x:2,y:-8,w:6,h:10,c:"#888"},{t:"circle",cx:-5,cy:4,r:3,c:"#f84",glow:6},{t:"circle",cx:5,cy:4,r:3,c:"#f84",glow:6}],
  tentacles:c=>[{t:"line",x1:-6,y1:-6,x2:-10,y2:6,c:c.accent,w:3,joint:"tail_wag"},{t:"line",x1:6,y1:-6,x2:10,y2:6,c:c.accent,w:3,joint:"tail_wag"},{t:"line",x1:0,y1:-8,x2:0,y2:8,c:c.accent,w:3,joint:"tail_wag"}],
  fins:c=>[{t:"polygon",pts:[[-6,-8],[-10,-12],[-6,-4]],c:c.accent},{t:"polygon",pts:[[6,-8],[10,-12],[6,-4]],c:c.accent}],
  crystal_growth:c=>[{t:"polygon",pts:[[-4,-10],[-2,-18],[0,-12]],c:c.accent,glow:4},{t:"polygon",pts:[[0,-12],[2,-18],[4,-10]],c:c.accent,glow:4}],
  wings_bone:c=>[{t:"polygon",pts:[[-5,-10],[-14,-16],[-12,-4],[-5,-6]],c:"#e8e8e8",alpha:0.7,joint:"wing_flap"},{t:"polygon",pts:[[5,-10],[14,-16],[12,-4],[5,-6]],c:"#e8e8e8",alpha:0.7,joint:"wing_flap"},{t:"line",x1:-10,y1:-12,x2:-6,y2:-8,c:"#aaa",w:1},{t:"line",x1:10,y1:-12,x2:6,y2:-8,c:"#aaa",w:1}],
  wings_moth:c=>[{t:"ellipse",cx:-8,cy:-10,rx:8,ry:5,c:"#d8a8e8",alpha:0.7,joint:"wing_flap"},{t:"ellipse",cx:8,cy:-10,rx:8,ry:5,c:"#d8a8e8",alpha:0.7,joint:"wing_flap"},{t:"circle",cx:-8,cy:-10,r:2,c:"#4a0",alpha:0.5},{t:"circle",cx:8,cy:-10,r:2,c:"#4a0",alpha:0.5}],
  sail:c=>[{t:"polygon",pts:[[-3,-8],[-8,-16],[0,-14],[8,-16],[3,-8]],c:c.accent,alpha:0.8}],
  quills:c=>[{t:"line",x1:-4,y1:-8,x2:-6,y2:-16,c:c.accent,w:2},{t:"line",x1:-1,y1:-10,x2:-2,y2:-18,c:c.accent,w:2},{t:"line",x1:2,y1:-10,x2:2,y2:-18,c:c.accent,w:2},{t:"line",x1:5,y1:-8,x2:6,y2:-16,c:c.accent,w:2}],
  banner:c=>[{t:"line",x1:0,y1:-12,x2:0,y2:-20,c:"#888",w:1},{t:"rect",x:-4,y:-20,w:8,h:10,c:c.accent,joint:"recoil"}],
  scarab_shell:c=>[{t:"ellipse",cx:0,cy:-6,rx:8,ry:6,c:c.accent,fill:"gradient",c2:c.primary,alpha:0.85},{t:"line",x1:0,y1:-12,x2:0,y2:0,c:c.primary,w:1}],
};
const TAIL_FEATURES={
  none:()=>[],
  tail_long:c=>[{t:"line",x1:0,y1:8,x2:0,y2:18,c:c.accent,w:3,joint:"tail_wag"}],
  tail_spade:c=>[{t:"line",x1:0,y1:8,x2:0,y2:16,c:c.accent,w:3,joint:"tail_wag"},{t:"polygon",pts:[[-3,16],[0,20],[3,16]],c:c.accent,joint:"tail_wag"}],
  tail_flame:c=>[{t:"polygon",pts:[[-2,8],[0,18],[2,8]],c:"#f84",glow:6,joint:"tail_wag"}],
  tail_fin:c=>[{t:"polygon",pts:[[-4,8],[0,16],[4,8]],c:c.accent,joint:"tail_wag"}],
  tail_prehensile:c=>[{t:"line",x1:0,y1:8,x2:-4,y2:14,c:c.accent,w:2,joint:"tail_wag"},{t:"line",x1:-4,y1:14,x2:2,y2:18,c:c.accent,w:2,joint:"tail_wag"}],
  tail_stinger:c=>[{t:"line",x1:0,y1:8,x2:0,y2:16,c:c.accent,w:2,joint:"tail_wag"},{t:"polygon",pts:[[-2,16],[0,22],[2,16]],c:c.accent,joint:"tail_wag"}],
  tail_fluffy:c=>[{t:"circle",cx:0,cy:14,r:5,c:c.accent,alpha:0.8,joint:"tail_wag"}],
  tail_barbed:c=>[{t:"line",x1:0,y1:8,x2:0,y2:16,c:c.accent,w:2,joint:"tail_wag"},{t:"line",x1:0,y1:12,x2:-3,y2:10,c:c.accent,w:1},{t:"line",x1:0,y1:12,x2:3,y2:10,c:c.accent,w:1}],
  tail_split:c=>[{t:"line",x1:0,y1:8,x2:-4,y2:16,c:c.accent,w:2,joint:"tail_wag"},{t:"line",x1:0,y1:8,x2:4,y2:16,c:c.accent,w:2,joint:"tail_wag"}],
  tail_mace:c=>[{t:"line",x1:0,y1:8,x2:0,y2:14,c:c.accent,w:3,joint:"tail_wag"},{t:"circle",cx:0,cy:16,r:4,c:c.accent,joint:"tail_wag"},{t:"line",x1:-2,y1:14,x2:-4,y2:12,c:c.accent,w:1,joint:"tail_wag"},{t:"line",x1:2,y1:14,x2:4,y2:12,c:c.accent,w:1,joint:"tail_wag"}],
  tail_feather:c=>[{t:"polygon",pts:[[-2,8],[0,18],[2,8]],c:c.accent,joint:"tail_wag"},{t:"line",x1:0,y1:8,x2:0,y2:18,c:c.primary,w:1,joint:"tail_wag"}],
  tail_hook:c=>[{t:"line",x1:0,y1:8,x2:0,y2:14,c:c.accent,w:3,joint:"tail_wag"},{t:"arc",cx:0,cy:14,r:4,start:0,end:Math.PI,c:c.accent,w:3,joint:"tail_wag"}],
  tail_ribbon:c=>[{t:"line",x1:0,y1:8,x2:0,y2:20,c:c.accent,w:2,joint:"tail_wag",alpha:0.7},{t:"polygon",pts:[[-3,16],[0,22],[3,16]],c:c.accent,joint:"tail_wag",alpha:0.7}],
};
const AURA_MAP_VISUAL={
  none:null, fire:"#f64", frost:"#6cf", poison:"#6f4", lightning:"#ff4",
  holy:"#fd8", shadow:"#a4f", arcane:"#a4f", void:"#a0f", nature:"#4f8", blood:"#f44", tech:"#0ff",
};
const EYE_STYLES={
  normal:null, glowing:"#ff4", slit:"#0f0", empty:"#000", visorglow:"#0ff", compound:"#f44", closed:null,
  star:"#ffd", cross:"#fff", spiral:"#a4f", visor:"#0f0", visor_red:"#f44",
};
const PATTERN_MODIFIERS={
  none:null, stripes:"stripes", spots:"spots", scales:"scales", runes:"runes", cracks:"cracks", gradient_two_tone:"gradient",
  circuit:"circuit", tribal:"tribal", stars:"stars", hexagons:"hexagons", marble:"marble",
};
const WEAPON_STYLE_MODIFIERS={
  standard:{}, ornate:{glow:2}, glowing:{glow:6}, cracked:{alpha:0.7}, pristine:{}, battered:{alpha:0.6},
  rusted:{alpha:0.5}, crystal:{glow:8}, bone:{alpha:0.8}, molten:{glow:6},
};

const RecipeAssembler={
  // D5: find a body-plan arm for weapon attachment.
  _findArm(body,side="right"){
    const arms=(body.shapes||[]).filter(s=>s.joint==="arm_raise");
    if(!arms.length) return null;
    const centerX=s=>{
      if(s.cx!==undefined) return s.cx;
      if(s.x!==undefined) return s.x+(s.w||0)/2;
      if(s.x1!==undefined) return (s.x1+(s.x2||s.x1))/2;
      if(s.pts) return s.pts.reduce((a,p)=>a+p[0],0)/s.pts.length;
      return 0;
    };
    const pick=side==="right"
      ? arms.reduce((a,b)=>centerX(a)>centerX(b)?a:b)
      : arms.reduce((a,b)=>centerX(a)<centerX(b)?a:b);
    return RecipeAssembler._armShoulderHand(pick);
  },
  _armShoulderHand(s){
    if(s.t==="rect") return {shoulder:{x:s.x+s.w/2,y:s.y},hand:{x:s.x+s.w/2,y:s.y+s.h}};
    if(s.t==="line") return {shoulder:{x:s.x1,y:s.y1},hand:{x:s.x2,y:s.y2}};
    if(s.t==="circle"||s.t==="arc") return {shoulder:{x:s.cx,y:s.cy-s.r},hand:{x:s.cx,y:s.cy+s.r}};
    if(s.t==="polygon"&&s.pts&&s.pts.length) return {shoulder:s.pts[0],hand:s.pts[1]||s.pts[0]};
    return {shoulder:{x:0,y:0},hand:{x:0,y:0}};
  },
  _inferGrip(s){
    if(s.grip) return s.grip;
    if(s.t==="line") return {x:s.x1,y:s.y1};
    if(s.t==="rect") return {x:s.x,y:s.y+s.h};
    if(s.t==="circle"||s.t==="arc") return {x:s.cx,y:s.cy};
    if(s.t==="polygon"&&s.pts&&s.pts.length) return {x:s.pts[0][0],y:s.pts[0][1]};
    return {x:0,y:0};
  },
  _shiftToGrip(s,g){
    const out={...s};
    const tx=-g.x,ty=-g.y;
    if(out.cx!==undefined){out.cx+=tx;out.cy+=ty;}
    if(out.x!==undefined){out.x+=tx;out.y+=ty;}
    if(out.x1!==undefined){out.x1+=tx;out.y1+=ty;out.x2+=tx;out.y2+=ty;}
    if(out.pts) out.pts=out.pts.map(p=>[p[0]+tx,p[1]+ty]);
    if(out.parentPivot){out.parentPivot={x:out.parentPivot.x+tx,y:out.parentPivot.y+ty};}
    if(out.gripOffset){out.gripOffset={x:out.gripOffset.x+tx,y:out.gripOffset.y+ty};}
    return out;
  },
  build(attrs){
    const primary=attrs.primaryHex||COLOR_MAP[attrs.primaryColor]||"#888";
    const accent=attrs.accentHex||COLOR_MAP[attrs.accentColor]||"#aaa";
    const head=attrs.headHex||lighten(primary,0.2);
    const weapon=attrs.weaponHex||WEAPON_COLOR[attrs.weaponType]||primary;
    const colors={primary,accent,head,weapon};
    const scale=SIZE_SCALE[attrs.sizeMod]||1.0;
    const bodyBase=BODY_SIZE[attrs.bodyPlan]||1.0;
    const totalScale=scale*bodyBase;
    const bodyFn=BODY_PLANS[attrs.bodyPlan]||BODY_PLANS.humanoid;
    const body=bodyFn(colors);
    const weaponTpl=WEAPONS[attrs.weaponType]||WEAPONS.none;
    // Phase 25: recipe metadata (defined early so shapes can reference pattern).
    const patternKey=PATTERN_MODIFIERS[attrs.pattern||"none"];
    const shapes=body.shapes.map(s=>{
      const scaled=scaleShape(s,totalScale);
      // Phase 25: apply pattern to body shapes.
      if(patternKey&&scaled.t!=="line"&&scaled.c){
        scaled.pattern=patternKey;
        scaled.c2=lighten(scaled.c||primary,0.15);
      }
      return scaled;
    });
    // D5: attach weapon(s) to the unit's right arm (or left for shields).
    if(weaponTpl.shape||weaponTpl.shapes){
      const wlist=[];
      if(weaponTpl.shapes) wlist.push(...weaponTpl.shapes);
      else if(weaponTpl.shape) wlist.push(weaponTpl.shape);
      const side=attrs.weaponType==="shield"?"left":"right";
      let arm=RecipeAssembler._findArm(body,side);
      // D5 fallback for body plans without arm_raise joints: attach at a default
      // shoulder/hand so the weapon is still visible.
      if(!arm) arm={shoulder:{x:0,y:-10},hand:{x:side==="left"?-7:7,y:0}};
      const shoulder={x:arm.shoulder.x*totalScale,y:arm.shoulder.y*totalScale};
      const hand={x:arm.hand.x*totalScale,y:arm.hand.y*totalScale};
      for(const ws of wlist){
        const wsMod=WEAPON_STYLE_MODIFIERS[attrs.weaponStyle||"standard"]||{};
        let s=scaleShape(ws,totalScale);
        // Shift shape so its grip is at (0,0).
        const grip=RecipeAssembler._inferGrip(s);
        s=RecipeAssembler._shiftToGrip(s,grip);
        // Attach to arm; the merged attack keyframes still drive arm_raise.
        s.parentJoint="arm_raise";
        s.parentPivot=shoulder;
        s.gripOffset=hand;
        // Remove the old own-joint arm_raise; keep special joints like bow_draw.
        if(s.joint==="arm_raise") delete s.joint;
        shapes.push({...s,...wsMod});
      }
    }
    // Phase 25: merge visual modifiers.
    const headFeat=HEAD_FEATURES[attrs.headFeature||"none"]||HEAD_FEATURES.none;
    const backFeat=BACK_FEATURES[attrs.backFeature||"none"]||BACK_FEATURES.none;
    const tailFeat=TAIL_FEATURES[attrs.tailFeature||"none"]||TAIL_FEATURES.none;
    for(const s of headFeat(colors))shapes.push(scaleShape(s,totalScale));
    for(const s of backFeat(colors))shapes.push(scaleShape(s,totalScale));
    for(const s of tailFeat(colors))shapes.push(scaleShape(s,totalScale));
    // Phase 25: cap at 20 shapes (drop lowest-priority: tail, then back, then head).
    while(shapes.length>20)shapes.splice(shapes.length-1,1);
    // Phase 25: merge body-specific attack channels with weapon attack animation.
    // Body attack keyframes provide body motion (lunge, lean, recoil) while
    // weapon attack keyframes provide arm/weapon motion. We merge by unioning
    // channels at matching keyframe times.
    const bodyAttack=body.animations?.attack||[];
    const weaponAttack=weaponTpl.attack||[];
    let mergedAttack;
    if(bodyAttack.length&&weaponAttack.length){
      // Use weapon keyframe times as the base; interpolate body channels at those times.
      const bodyInterp=(t)=>{
        const out={};
        for(const ch of ["lunge","lean","recoil","tail_wag","wing_flap","arm_raise"]){
          let prev=bodyAttack[0],next=bodyAttack[bodyAttack.length-1];
          for(let i=0;i<bodyAttack.length-1;i++){
            if(t>=bodyAttack[i].t&&t<=bodyAttack[i+1].t){prev=bodyAttack[i];next=bodyAttack[i+1];break;}
          }
          const span=next.t-prev.t||1;
          const f=(t-prev.t)/span;
          if(prev[ch]!==undefined||next[ch]!==undefined){
            out[ch]=(prev[ch]||0)+((next[ch]||0)-(prev[ch]||0))*f;
          }
        }
        return out;
      };
      mergedAttack=weaponAttack.map(kf=>({...kf,...bodyInterp(kf.t)}));
    }else{
      mergedAttack=weaponAttack;
    }
    return{
      shapes,
      animations:{
        ...body.animations,
        attack:mergedAttack
      },
      // D5: recipe version so old cached/saved recipes can be rebuilt.
      recipeVersion:1,
      // Phase 25: visual modifier metadata for rendering.
      aura:attrs.aura||"none",
      auraColor:AURA_MAP_VISUAL[attrs.aura||"none"]||null,
      eyeStyle:attrs.eyeStyle||"normal",
      eyeColor:EYE_STYLES[attrs.eyeStyle||"normal"],
      pattern:patternKey,
      face:attrs.eyeStyle!=="closed",
    };
  }
};

// Phase 12: template fallback — minimal archetype templates for when LLM is unavailable.
// These cover basic gameplay archetypes only (archer, tank, mage, etc.).
// Creative concepts (dragon, pumpkin, ice mage, etc.) are intentionally NOT templated —
// the LLM is the source of creativity. Unrecognized prompts get a random template,
// which keeps the fallback surprising rather than prescriptive.
const TEMPLATES=[
  // New weapon-specific templates (must be before generic warrior/guard/mage templates).
  {kw:["axe","axeman","executioner","berserker axe","barbarian axe"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:120,hp:95,dmg:20,range:35,speed:80,ability:"ramp",bodyPlan:"humanoid",weaponType:"axe",primaryColor:"orange",accentColor:"red",sizeMod:"large",headFeature:"horns",aura:"fire",eyeStyle:"glowing"}},
  {kw:["trident","spearman","poseidon","merfolk warrior","trident guard"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:100,hp:85,dmg:16,range:50,speed:70,ability:"thorns",bodyPlan:"aquatic",weaponType:"trident",primaryColor:"blue",accentColor:"cyan",sizeMod:"medium",aura:"frost",pattern:"scales"}},
  {kw:["crossbow","sniper","marksman","arbalest"],a:{role:"carry",targeting:"enemy_backline",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:90,hp:50,dmg:20,range:180,speed:55,ability:"none",bodyPlan:"humanoid",weaponType:"crossbow",primaryColor:"brown",accentColor:"gray",sizeMod:"small"}},
  {kw:["orb","crystal mage","gem caster","orb mage"],a:{role:"carry",targeting:"enemy_cluster",movement:"hold",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:60,hp:70,dmg:22,range:150,speed:40,ability:"chain_lightning",bodyPlan:"elemental",weaponType:"orb",primaryColor:"magenta",accentColor:"cyan",sizeMod:"medium",aura:"arcane",eyeStyle:"spiral",pattern:"hexagons",weaponStyle:"crystal"}},
  {kw:["dual blade","blademaster","swordsman","duelist","dual blade master"],a:{role:"assassin",targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"on_first_hit",moveSpeedMod:140,hp:60,dmg:18,range:30,speed:100,ability:"frenzy",bodyPlan:"humanoid",weaponType:"dual_blades",primaryColor:"cyan",accentColor:"white",sizeMod:"small",eyeStyle:"slit",weaponStyle:"ornate"}},
  // New body plan templates.
  {kw:["spider","arachnid","widow","tarantula"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:130,hp:50,dmg:14,range:30,speed:110,ability:"poison",bodyPlan:"spider",weaponType:"claws",primaryColor:"black",accentColor:"red",sizeMod:"small",aura:"poison",eyeStyle:"compound",pattern:"stripes"}},
  {kw:["wyvern","drake","wyrm"],a:{role:"carry",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:110,hp:80,dmg:18,range:80,speed:80,ability:"ramp",bodyPlan:"wyvern",weaponType:"breath",primaryColor:"orange",accentColor:"red",sizeMod:"large",headFeature:"horns_curved",backFeature:"wings_dragon",tailFeature:"tail_spade",aura:"fire",eyeStyle:"slit",pattern:"scales",weaponStyle:"glowing"}},
  {kw:["kraken","leviathan","cephalopod"],a:{role:"frontline",targeting:"enemy_cluster",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:70,hp:130,dmg:14,range:60,speed:50,ability:"slow",bodyPlan:"kraken",weaponType:"claws",primaryColor:"purple",accentColor:"blue",sizeMod:"huge",aura:"frost",eyeStyle:"glowing",pattern:"scales"}},
  {kw:["gargoyle","statue","guardian stone"],a:{role:"frontline",targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:60,hp:140,dmg:14,range:35,speed:40,ability:"shield",bodyPlan:"gargoyle",weaponType:"claws",primaryColor:"gray",accentColor:"cyan",sizeMod:"large",backFeature:"wings_bat",aura:"shadow",eyeStyle:"visorglow",pattern:"cracks"}},
  {kw:["wraith","phantom","banshee","revenant"],a:{role:"counter",targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:110,hp:55,dmg:16,range:50,speed:90,ability:"dodge",bodyPlan:"wraith",weaponType:"scythe",primaryColor:"purple",accentColor:"cyan",sizeMod:"medium",aura:"void",eyeStyle:"glowing",pattern:"runes",weaponStyle:"glowing"}},
  // Original templates.
  {kw:["archer","bow","hunter","ranger"],a:{role:"carry",targeting:"closest",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,hp:55,dmg:18,range:170,speed:65,ability:"none",bodyPlan:"humanoid",weaponType:"bow",primaryColor:"green",accentColor:"green",sizeMod:"medium"}},
  {kw:["tank","knight","warrior","guard","defender"],a:{role:"frontline",targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:80,hp:110,dmg:12,range:40,speed:50,ability:"shield",bodyPlan:"humanoid",weaponType:"shield",primaryColor:"blue",accentColor:"white",sizeMod:"large"}},
  {kw:["mage","wizard","sorcerer","warlock"],a:{role:"carry",targeting:"enemy_cluster",movement:"hold",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:50,hp:80,dmg:20,range:140,speed:40,ability:"splash",bodyPlan:"humanoid",weaponType:"staff",primaryColor:"purple",accentColor:"cyan",sizeMod:"medium",headFeature:"none",backFeature:"cape",tailFeature:"none",aura:"arcane",eyeStyle:"glowing",pattern:"runes",weaponStyle:"glowing"}},
  {kw:["assassin","rogue","ninja","shadow","samurai","shinobi"],a:{role:"counter",targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:150,hp:45,dmg:22,range:30,speed:110,ability:"dodge",bodyPlan:"humanoid",weaponType:"dagger",primaryColor:"black",accentColor:"red",sizeMod:"small"}},
  {kw:["healer","priest","cleric","monk"],a:{role:"support",targeting:"lowest_ally",movement:"flee",attackCondition:"never",abilityTrigger:"when_ally_hurt",moveSpeedMod:100,hp:65,dmg:10,range:100,speed:50,ability:"heal",bodyPlan:"humanoid",weaponType:"staff",primaryColor:"yellow",accentColor:"white",sizeMod:"medium"}},
  {kw:["engineer","builder","mech","tinker"],a:{role:"utility",targeting:"closest",movement:"flee",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:80,hp:60,dmg:8,range:90,speed:45,ability:"spawn",bodyPlan:"mechanical",weaponType:"hammer",primaryColor:"orange",accentColor:"gray",sizeMod:"medium"}},
  {kw:["vampire","dracula","leech","blood"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:120,hp:70,dmg:16,range:35,speed:80,ability:"lifesteal",bodyPlan:"humanoid",weaponType:"dagger",primaryColor:"red",accentColor:"black",sizeMod:"medium"}},
  {kw:["berserker","barbarian","raging"],a:{role:"frontline",targeting:"highest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:140,hp:90,dmg:18,range:35,speed:90,ability:"rage",bodyPlan:"humanoid",weaponType:"hammer",primaryColor:"orange",accentColor:"red",sizeMod:"large"}},
  {kw:["bomber","grenadier","suicide","explosive"],a:{role:"counter",targeting:"enemy_cluster",movement:"chase",attackCondition:"never",abilityTrigger:"on_death",moveSpeedMod:130,hp:50,dmg:30,range:40,speed:100,ability:"explode",bodyPlan:"mechanical",weaponType:"none",primaryColor:"gray",accentColor:"orange",sizeMod:"small"}},
  {kw:["turtle","shell","crab","tortoise"],a:{role:"frontline",targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:50,hp:150,dmg:8,range:30,speed:30,ability:"shield",bodyPlan:"quadruped",weaponType:"claws",primaryColor:"green",accentColor:"brown",sizeMod:"large"}},
  {kw:["elephant","mammoth","rhino","hippo","pachyderm"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:70,hp:180,dmg:22,range:40,speed:40,ability:"rage",bodyPlan:"quadruped",weaponType:"none",primaryColor:"gray",accentColor:"brown",sizeMod:"colossal",tailFeature:"tail_long",pattern:"wrinkles"}},
  {kw:["car","truck","vehicle","motorcycle","bus"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:140,hp:100,dmg:20,range:50,speed:100,ability:"rage",bodyPlan:"mechanical",weaponType:"none",primaryColor:"red",accentColor:"black",sizeMod:"large",aura:"tech",eyeStyle:"visor"}},
  {kw:["robot","android","cyborg","droid"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:80,hp:120,dmg:16,range:60,speed:60,ability:"shield",bodyPlan:"mechanical",weaponType:"rifle",primaryColor:"gray",accentColor:"cyan",sizeMod:"large",aura:"tech",eyeStyle:"visor_red"}},
  {kw:["wolf","dog","hound","fox","canine"],a:{role:"carry",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:130,hp:60,dmg:16,range:35,speed:100,ability:"rage",bodyPlan:"quadruped",weaponType:"claws",primaryColor:"gray",accentColor:"brown",sizeMod:"medium"}},
  {kw:["cat","feline","lion","tiger","panther"],a:{role:"carry",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:130,hp:55,dmg:18,range:35,speed:110,ability:"dodge",bodyPlan:"quadruped",weaponType:"claws",primaryColor:"orange",accentColor:"black",sizeMod:"medium"}},
  {kw:["bear","gorilla","ogre","troll"],a:{role:"bruiser",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:90,hp:130,dmg:22,range:35,speed:60,ability:"rage",bodyPlan:"beast-man",weaponType:"hammer",primaryColor:"brown",accentColor:"gray",sizeMod:"large"}},
  {kw:["shark","whale","dolphin","orca"],a:{role:"carry",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:120,hp:90,dmg:20,range:50,speed:90,ability:"rage",bodyPlan:"aquatic",weaponType:"claws",primaryColor:"blue",accentColor:"gray",sizeMod:"large"}},
  {kw:["wall","tower","turret","crystal","fortress"],a:{role:"frontline",targeting:"closest",movement:"hold",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:50,hp:200,dmg:15,range:120,speed:30,ability:"slow",bodyPlan:"structure",weaponType:"none",primaryColor:"gray",accentColor:"cyan",sizeMod:"large"}},
  {kw:["dragon","elder dragon"],a:{role:"carry",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:100,hp:90,dmg:20,range:60,speed:70,ability:"ramp",bodyPlan:"dragon",weaponType:"breath",primaryColor:"red",accentColor:"orange",sizeMod:"large",headFeature:"horns_curved",backFeature:"wings_dragon",tailFeature:"tail_spade",aura:"fire",eyeStyle:"glowing",pattern:"scales",weaponStyle:"glowing"}},
  {kw:["snake","serpent","naga","eel"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:110,hp:60,dmg:16,range:40,speed:80,ability:"poison",bodyPlan:"serpent",weaponType:"claws",primaryColor:"green",accentColor:"yellow",sizeMod:"medium"}},
  {kw:["phoenix","eagle","harpy","bird"],a:{role:"carry",targeting:"closest",movement:"kite",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:130,hp:55,dmg:16,range:120,speed:90,ability:"dodge",bodyPlan:"bird",weaponType:"claws",primaryColor:"orange",accentColor:"yellow",sizeMod:"small"}},
  {kw:["mantis","centipede","caterpillar","beetle"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:120,hp:50,dmg:14,range:30,speed:100,ability:"poison",bodyPlan:"insect",weaponType:"claws",primaryColor:"black",accentColor:"red",sizeMod:"small"}},
  {kw:["ant ","antman","formic"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:120,hp:50,dmg:14,range:30,speed:100,ability:"poison",bodyPlan:"insect",weaponType:"claws",primaryColor:"black",accentColor:"red",sizeMod:"small"}},
  {kw:["golem","construct","elemental"],a:{role:"frontline",targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:60,hp:160,dmg:16,range:40,speed:35,ability:"shield",bodyPlan:"golem",weaponType:"hammer",primaryColor:"gray",accentColor:"cyan",sizeMod:"large"}},
  {kw:["ghost","specter","spirit"],a:{role:"counter",targeting:"lowest_hp",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:90,hp:50,dmg:14,range:50,speed:70,ability:"dodge",bodyPlan:"ghost",weaponType:"none",primaryColor:"cyan",accentColor:"white",sizeMod:"medium"}},
  {kw:["fish","mermaid","octopus","squid","siren"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_cooldown",moveSpeedMod:80,hp:70,dmg:14,range:60,speed:60,ability:"slow",bodyPlan:"aquatic",weaponType:"claws",primaryColor:"blue",accentColor:"purple",sizeMod:"medium"}},
  {kw:["skeleton","zombie","lich","undead"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_death",moveSpeedMod:70,hp:60,dmg:12,range:35,speed:50,ability:"spawn",bodyPlan:"undead",weaponType:"sword",primaryColor:"gray",accentColor:"green",sizeMod:"medium"}},
  {kw:["demon","devil","imp"],a:{role:"counter",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"on_low_hp",moveSpeedMod:120,hp:65,dmg:18,range:35,speed:90,ability:"rage",bodyPlan:"demon",weaponType:"claws",primaryColor:"red",accentColor:"black",sizeMod:"medium"}},
  {kw:["minotaur","centaur","werewolf","beast-man"],a:{role:"frontline",targeting:"closest",movement:"chase",attackCondition:"always",abilityTrigger:"never",moveSpeedMod:130,hp:100,dmg:18,range:35,speed:85,ability:"rage",bodyPlan:"beast-man",weaponType:"hammer",primaryColor:"brown",accentColor:"red",sizeMod:"large"}},
  {kw:["treant","flower","mushroom","plant"],a:{role:"frontline",targeting:"closest",movement:"hold_midpoint",attackCondition:"always",abilityTrigger:"when_ally_hurt",moveSpeedMod:50,hp:120,dmg:10,range:80,speed:35,ability:"heal_burst",bodyPlan:"plant",weaponType:"none",primaryColor:"green",accentColor:"yellow",sizeMod:"large"}},
];
function templateFallback(prompt){
  debugForge("templateFallback start",prompt);
  const p=(prompt||"").toLowerCase();
  let match=TEMPLATES.find(t=>t.kw.some(k=>p.includes(k)));
  let attrs;
  if(match){
    attrs={...match.a};
    attrs.name=String(prompt).slice(0,20).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");
  }else{
    // Random template with the prompt as name.
    attrs={...TEMPLATES[F(R()*TEMPLATES.length)].a};
    attrs.name=String(prompt||"Unknown").slice(0,20).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");
  }
  // ±20% param variation.
  const v=()=>0.8+R()*0.4;
  attrs.hp=Math.round(attrs.hp*v());
  attrs.dmg=Math.round(attrs.dmg*v());
  attrs.range=Math.round(attrs.range*v());
  attrs.speed=Math.round(attrs.speed*v());
  debugForge("templateFallback result",{match:match?match.a.name||null:null,attrs});
  return attrs;
}

// Phase 18: Recipe serialization for P2P bandwidth.
// Minify field names, deduplicate starter units, compress with lz-string.
const RECIPE_MINIFY={
  shapes:"s",animations:"a",attack:"at",idle:"i",move:"m",death:"d",
  circle:"c",rect:"r",line:"l",polygon:"p",arc:"ar",
  t:"t",cx:"cx",cy:"cy",r:"r",x:"x",y:"y",w:"w",h:"h",
  x1:"x1",y1:"y1",x2:"x2",y2:"y2",c:"c",joint:"j",pts:"p",
  start:"s0",end:"e0",alpha:"al",rot:"ro",bob:"bo",leg_swing:"ls",
  arm_raise:"am",bow_draw:"bd",tail_wag:"tw"
};
const RECIPE_EXPAND=Object.fromEntries(
  Object.entries(RECIPE_MINIFY).map(([k,v])=>[v,k])
);
// Minify a recipe for network transmission (~40% smaller).
function minifyRecipe(recipe){
  if(!recipe)return null;
  const minShapes=recipe.shapes?.map(s=>{
    const out={};
    for(const[k,v]of Object.entries(s)){
      out[RECIPE_MINIFY[k]||k]=v;
    }
    return out;
  });
  const minAnim={};
  if(recipe.animations)for(const[k,v]of Object.entries(recipe.animations)){
    const key=RECIPE_MINIFY[k]||k;
    minAnim[key]=v;
  }
  return{s:minShapes,a:minAnim};
}
// Expand a minified recipe back to full form.
function expandRecipe(min){
  if(!min)return null;
  const shapes=(min.s||[]).map(s=>{
    const out={};
    for(const[k,v]of Object.entries(s)){
      out[RECIPE_EXPAND[k]||k]=v;
    }
    return out;
  });
  const anim={};
  if(min.a)for(const[k,v]of Object.entries(min.a)){
    anim[RECIPE_EXPAND[k]||k]=v;
  }
  return{shapes,animations:anim};
}
// Serialize units for P2P: dedupe starter units (send name only),
// minify recipes for custom (LLM-forged) units, compress with lz-string.
function serializeUnitsForPeer(units){
  const data=units.map(u=>{
    // Starter unit: send name only, receiver resolves from G.base.
    // A unit is a starter if its name + core stats match a base unit.
    const starter=G.base.find(b=>b.n===u.n);
    if(starter&&starter.h===u.h&&starter.d===u.d&&starter.r===u.r&&starter.s===u.s&&starter.a===u.a&&starter.weaponType===u.weaponType&&starter.ability===u.ability)return u.n;
    // Custom unit (LLM-forged or modified): send full data with minified recipe.
    const recipe=minifyRecipe(u.recipe);
    return{...u,recipe};
  });
  // Compress the full payload with lz-string if available.
  if(LZString){
    try{return LZString.compressToUTF16(JSON.stringify(data));}catch(e){/* fall through */}
  }
  return data;
}
// Deserialize units from P2P: decompress, resolve starter names, expand recipes.
function deserializeUnitsFromPeer(data){
  let arr=data;
  // Decompress if lz-string is available and data is a string (compressed).
  if(LZString&&typeof data==="string"){
    try{arr=JSON.parse(LZString.decompressFromUTF16(data));}catch(e){arr=[];}
  }
  if(!Array.isArray(arr))return[];
  // P2P security: cap array length to prevent memory exhaustion.
  if(arr.length>100)return[];
  return arr.map(d=>{
    try{
      if(typeof d==="string"){
        // Starter unit name → resolve from G.base.
        const starter=G.base.find(b=>b.n===d);
        return starter?unit(starter):null;
      }
      if(!d||typeof d!=="object")return null;
      // Custom unit: expand recipe.
      if(d.recipe)d.recipe=expandRecipe(d.recipe);
      if(d._isSpell){
        // Security: sanitize spell from P2P (name + enum validation).
        return sanitizeSpell(d);
      }
      return unit(d);
    }catch(e){return null;}
  }).filter(Boolean);
}

// DET: army serialization for lockstep. Unlike deserializeUnitsFromPeer (which
// rebuilds via unit() and drops position fields), this preserves x/y/mh so both
// peers start the sim from byte-identical initial positions. Still runs unit()
// for sanitization, then restores the position/HP fields from the raw payload.
function serializeArmyForPeer(army){
  const data=army.map(u=>{
    const starter=G.base.find(b=>b.n===u.n);
    if(starter&&starter.h===u.h&&starter.d===u.d&&starter.r===u.r&&starter.s===u.s&&starter.a===u.a&&starter.weaponType===u.weaponType&&starter.ability===u.ability){
      // Starter — but army units carry positions, so send full data anyway.
    }
    const recipe=minifyRecipe(u.recipe);
    return{...u,recipe};
  });
  if(LZString){
    try{return LZString.compressToUTF16(JSON.stringify(data));}catch(e){/* fall through */}
  }
  return data;
}
function deserializeArmyForPeer(data){
  let arr=data;
  if(LZString&&typeof data==="string"){
    try{arr=JSON.parse(LZString.decompressFromUTF16(data));}catch(e){arr=[];}
  }
  if(!Array.isArray(arr))return[];
  if(arr.length>200)return[]; // P2P security: cap army size.
  const out=[];
  for(let i=0;i<arr.length;i++){
    const d=arr[i];
    try{
      if(!d||typeof d!=="object")continue;
      if(d.recipe)d.recipe=expandRecipe(d.recipe);
      const u=unit(d); // sanitize + clamp fields
      // Restore position + max-HP fields that unit() drops (needed for sim).
      u.x=clamp(Number(d.x)||0,-1000,1000);
      u.y=clamp(Number(d.y)||0,-1000,1000);
      u.mh=clamp(Number(d.mh)||u.h,1,1000);
      u.h=clamp(Number(d.h)||u.mh,1,u.mh);
      // PERF-R13: restore base stats that unit() drops (needed for lockstep determinism).
      // Without this, survivors' _baseH/_baseSpd/baseD would be reset to current stats
      // (which include composition bonus / ramp), causing desync between host and guest.
      if(d._baseH)u._baseH=clamp(Number(d._baseH),1,1000);
      if(d._baseSpd)u._baseSpd=clamp(Number(d._baseSpd),10,300);
      if(d.baseD)u.baseD=clamp(Number(d.baseD),1,200);
      out.push(u);
    }catch(e){/* skip bad unit */}
  }
  return out;
}

// Phase 12: build a unit object from LLM/template attributes.
function attrsToUnit(attrs,arenaIndex){
  debugForge("attrsToUnit input",{attrs,arenaIndex});
  const primaryHex=COLOR_MAP[attrs.primaryColor]||"#4a7";
  const accentHex=COLOR_MAP[attrs.accentColor]||"#0ff";
  const headHex=lighten(primaryHex,0.2);
  const weaponHex=WEAPON_COLOR[attrs.weaponType]||"#888";
  const recipe=RecipeAssembler.build({
    ...attrs,
    primaryHex,accentHex,headHex,weaponHex
  });
  const atkSpd=deriveAtkSpd(attrs);
  const crit=deriveCrit(attrs);
  // Derive z (collision/visual size) from sizeMod + bodyPlan so it matches the recipe scale.
  const sizeScale=SIZE_SCALE[attrs.sizeMod||"medium"]||1.0;
  const bodySize=BODY_SIZE[attrs.bodyPlan||"humanoid"]||1.0;
  const z=Math.round(10*sizeScale*bodySize);
  return validateUnit({
    n:attrs.name,
    role:attrs.role,
    targeting:attrs.targeting,movement:attrs.movement,
    attackCondition:attrs.attackCondition,abilityTrigger:attrs.abilityTrigger,
    moveSpeedMod:attrs.moveSpeedMod,
    h:attrs.hp,d:attrs.dmg,r:attrs.range,s:attrs.speed,
    a:atkSpd,crit:crit,armor:attrs.armor||0,
    ability:attrs.ability,
    c:primaryHex,
    z,
    weaponType:attrs.weaponType,
    bodyPlan:attrs.bodyPlan,
    sizeMod:attrs.sizeMod||"medium",
    // Phase 25: visual modifier fields (stored for P2P + re-render).
    headFeature:attrs.headFeature||"none",
    backFeature:attrs.backFeature||"none",
    tailFeature:attrs.tailFeature||"none",
    aura:attrs.aura||"none",
    eyeStyle:attrs.eyeStyle||"normal",
    pattern:attrs.pattern||"none",
    weaponStyle:attrs.weaponStyle||"standard",
    recipe
  },arenaIndex);
  debugForge("attrsToUnit output",u);
  return u;
}

// Phase 12: IndexedDB cache for generated units.
const DB_NAME="promptshowdown_llm_cache_v8";
const STORE="unit_specs";
const SCHEMA_VERSION=1;
function cacheKey(prompt,modelId){return modelId+":"+prompt;}
// Phase 12: normalize prompt for cache key + fusion matching.
function normalizePrompt(s){return(s||"").trim().toLowerCase().slice(0,100)||"warrior";}
// Phase 12: once an open fails/hangs, remember so we stop retrying every forge.
let idbBroken=false;
function openDB(){
  return new Promise((res,rej)=>{
    if(!indexedDB){rej(new Error("no IndexedDB"));return;}
    const r=indexedDB.open(DB_NAME,SCHEMA_VERSION);
    r.onupgradeneeded=e=>{
      const db=r.result;
      // On schema version bump, delete + recreate store to clear stale entries.
      if(e.oldVersion>0&&e.oldVersion<SCHEMA_VERSION){
        try{db.deleteObjectStore(STORE);}catch(_){}
      }
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE,{keyPath:"key"});
      }
    };
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
    r.onblocked=()=>rej(new Error("IndexedDB blocked"));
  });
}
// Defensive: if the open never settles (e.g. file:// origin, private mode,
// blocked version change), give up after 2s so the forge never hangs forever.
function openDBWithGuard(){
  if(idbBroken)return Promise.reject(new Error("IndexedDB unavailable"));
  return Promise.race([
    openDB(),
    new Promise((_,rej)=>setTimeout(()=>{idbBroken=true;rej(new Error("IndexedDB open hung"));},2000))
  ]);
}
async function cacheGet(key){
  if(idbBroken)return null;
  try{
    const db=await openDBWithGuard();
    return await new Promise((res)=>{
      const tx=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
      tx.onsuccess=()=>res(tx.result?tx.result.unit:null);
      tx.onerror=()=>res(null);
    });
  }catch(e){return null;}
}
async function cachePut(key,prompt,modelId,unit){
  if(idbBroken)return;
  try{
    const db=await openDBWithGuard();
    const tx=db.transaction(STORE,"readwrite").objectStore(STORE);
    tx.put({key,prompt,modelId,unit,generatedAt:Date.now()});
  }catch(e){/* best-effort */}
}

// Phase 12: per-field fallback — targeted micro-prompts for semantically
// inconsistent fields. Used after JSON mode + semanticValidate flags fields.
const ENUM_FIELDS={
  role:["frontline","carry","support","counter","utility"],
  targeting:["closest","lowest_hp","highest_hp","enemy_carry","enemy_support","enemy_backline","enemy_frontline","enemy_cluster","lowest_ally","random"],
  movement:["chase","flee","hold","hold_midpoint","kite","patrol"],
  attackCondition:["always","only_if_healthy","only_if_target_low","never"],
  abilityTrigger:["on_cooldown","when_ally_hurt","when_surrounded","on_low_hp","on_death","on_first_hit","never"],
  ability:["none","splash","heal","dodge","poison","spawn","lifesteal","explode","heal_burst","shield","rage","slow","ramp","thorns","blink_strike","frenzy","regen","cleanse","taunt","executioner","chain_lightning","buff_aura"],
  bodyPlan:["humanoid","quadruped","dragon","serpent","bird","insect","crab","golem","ghost","fish","blob","flying","mechanical","structure","plant","undead","demon","beast-man","aquatic","monopod","centaur","hydra","elemental","aberration","ooze","crystal","construct","angel","spider","wyvern","treant","kraken","gargoyle","wraith"],
  weaponType:["none","sword","bow","staff","dagger","shield","hammer","claws","breath","scythe","whip","spear","rifle","wand","axe","trident","crossbow","orb","dual_blades"],
  primaryColor:Object.keys(COLOR_MAP),
  accentColor:Object.keys(COLOR_MAP),
  sizeMod:["tiny","small","medium","large","huge","colossal"],
  // Phase 25: visual modifier enums.
  headFeature:["none","horns","antlers","crest","halo","crown","horns_curved","ears_pointed","mask","eyepatch","tiara","antenna","frill","beak","hood","mohawk","goggles","third_eye","flower_crown","headphones"],
  backFeature:["none","wings_bat","wings_feathered","wings_dragon","cape","shell","spikes","aura_vent","wings_insect","wings_angel","jetpack","tentacles","fins","crystal_growth","wings_bone","wings_moth","sail","quills","banner","scarab_shell"],
  tailFeature:["none","tail_long","tail_spade","tail_flame","tail_fin","tail_prehensile","tail_stinger","tail_fluffy","tail_barbed","tail_split","tail_mace","tail_feather","tail_hook","tail_ribbon"],
  aura:["none","fire","frost","poison","lightning","holy","shadow","arcane","void","nature","blood","tech"],
  eyeStyle:["normal","glowing","slit","empty","visorglow","compound","closed","star","cross","spiral","visor","visor_red"],
  pattern:["none","stripes","spots","scales","runes","cracks","gradient_two_tone","circuit","tribal","stars","hexagons","marble"],
  weaponStyle:["standard","ornate","glowing","cracked","pristine","battered","rusted","crystal","bone","molten"]
};
const INT_FIELDS={hp:[10,200],dmg:[5,50],range:[30,250],speed:[30,120],moveSpeedMod:[50,150],armor:[0,20]};
// Phase 12: parse a stat value from the LLM's answer. The LLM is free to
// pick any number in the field's range — we extract it and clamp. Also
// handles "word (NN)" format in case the model adds a label.
function parseStat(field,answer){
  const [min,max]=INT_FIELDS[field];
  const paren=answer.match(/\((\d+)\)/);
  const n=paren?parseInt(paren[1]):parseInt(answer);
  return isNaN(n)?min:Math.max(min,Math.min(max,n));
}
function parseEnum(answer,values,defaultValue){
  const v=(answer||"").trim().toLowerCase();
  return values.includes(v)?v:defaultValue;
}
const FIELD_PARSERS={
  name:s=>s.trim().slice(0,20),
  ...Object.fromEntries(Object.entries(ENUM_FIELDS).map(([f,vals])=>
    [f,s=>{const v=s.trim().toLowerCase();return vals.includes(v)?v:vals[0];}])),
  // Int fields are parsed by parseStat in askField, not here.
  ...Object.fromEntries(Object.keys(INT_FIELDS).map(f=>[f,s=>s]))
};
// Phase 12: shuffle an array (Fisher-Yates) — used to randomise enum option
// order in prompts so the 0.5B model doesn't always pick the first option.
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// Phase 12: join enum values in random order for a prompt.
function opts(vals){return shuffle(vals).join(", ");}
const FIELD_PROMPTS={
  name:p=>`Give a short, evocative name (max 20 chars) for a fantasy battle unit based on the concept: "${p}". Be creative — use compound words, mythological references, or unique names. Answer with the name only.`,
  role:()=>`What combat role fits this unit? frontline = durable tank. carry = fragile damage dealer. support = heals/buffs allies. counter = punishes enemy weaknesses. utility = flexible specialist. assassin = burst damage, targets weak enemies. bruiser = mix of tank and damage. Answer with one word.`,
  targeting:()=>`Given this unit's identity, who should it target in battle: ${opts(ENUM_FIELDS.targeting)}? Answer with one word.`,
  movement:()=>`Given this unit's identity, how should it move: ${opts(ENUM_FIELDS.movement)}? Answer with one word.`,
  attackCondition:()=>`Given this unit's identity, when should it attack: ${opts(ENUM_FIELDS.attackCondition)}? Answer with one word.`,
  ability:()=>`Given this unit's identity, what special ability fits: ${opts(ENUM_FIELDS.ability)}? Answer with one word.`,
  abilityTrigger:()=>`Given this unit's identity and ability, when should the ability trigger: ${opts(ENUM_FIELDS.abilityTrigger)}? Answer with one word.`,
  moveSpeedMod:(n,a)=>`How aggressive is this unit's speed? ${a.movement==="chase"?"Chase units are bold: 100-150. ":""}${a.movement==="hold"?"Hold units are cautious: 50-90. ":""}${a.movement==="kite"?"Kite units are measured: 70-120. ":""}${a.movement==="flee"?"Fleeing units are skittish: 80-130. ":""}${a.movement==="patrol"?"Patrol units are steady: 60-110. ":""}${a.movement==="blink"?"Blink units are unpredictable: 80-130. ":""}${a.movement==="strafe"?"Strafe units are nimble: 90-140. ":""}Pick any number 50-150 that fits. Answer with a number only.`,
  armor:(n,a)=>`How much armor (flat damage reduction per hit) fits? ${a.role==="frontline"?"Frontlines are tanky: 5-15 armor. ":""}${a.role==="carry"?"Carries are squishy: 0-3 armor. ":""}${a.role==="support"?"Supports are fragile: 0-5 armor. ":""}${a.role==="counter"?"Counters are moderate: 2-8 armor. ":""}${a.role==="utility"?"Utility varies: 0-6 armor. ":""}${a.role==="assassin"?"Assassins are fragile: 0-3 armor. ":""}${a.role==="bruiser"?"Bruisers are sturdy: 4-10 armor. ":""}Pick any number 0-20. Answer with a number only.`,
  hp:(n,a)=>`How tough is this unit? ${a.role==="frontline"?"Frontlines are tanks: 120-200 HP. ":""}${a.role==="carry"?"Carries are squishy: 15-60 HP. ":""}${a.role==="support"?"Supports are fragile: 30-90 HP. ":""}${a.role==="counter"?"Counters are moderate: 50-110 HP. ":""}${a.role==="utility"?"Utility units are varied: 40-100 HP. ":""}${a.role==="assassin"?"Assassins are fragile: 20-70 HP. ":""}${a.role==="bruiser"?"Bruisers are sturdy: 80-150 HP. ":""}Pick any number 10-200 that fits the concept. Answer with a number only.`,
  dmg:(n,a)=>`How much damage per hit? ${a.role==="carry"?"Carries hit hard: 25-50. ":""}${a.role==="frontline"?"Frontlines hit moderately: 10-30. ":""}${a.role==="support"?"Supports hit weakly: 5-15. ":""}${a.role==="counter"?"Counters hit sharply: 15-35. ":""}${a.role==="utility"?"Utility varies: 8-25. ":""}${a.role==="assassin"?"Assassins burst: 20-45. ":""}${a.role==="bruiser"?"Bruisers hit solidly: 12-30. ":""}Pick any number 5-50 that fits the concept. Answer with a number only.`,
  range:(n,a)=>`What attack range fits? ${a.weaponType==="bow"?"Bows are long-range: 150-250. ":""}${a.weaponType==="staff"||a.weaponType==="wand"?"Staves/wands are ranged: 100-200. ":""}${a.weaponType==="rifle"?"Rifles are very long: 180-250. ":""}${(a.weaponType==="sword"||a.weaponType==="dagger"||a.weaponType==="claws"||a.weaponType==="hammer"||a.weaponType==="scythe"||a.weaponType==="spear")?"Melee weapons are short: 30-60. ":""}${a.weaponType==="whip"?"Whips are medium: 60-100. ":""}${a.weaponType==="breath"?"Breath is medium: 60-120. ":""}${a.weaponType==="shield"?"Shields are close: 30-60. ":""}${a.weaponType==="none"?"Unarmed is touch: 30-50. ":""}Pick any number 30-250 that fits. Answer with a number only.`,
  speed:(n,a)=>`How fast should it be? ${a.movement==="chase"?"Chase units are fast: 80-120. ":""}${a.movement==="hold"?"Hold units are slow: 30-60. ":""}${a.movement==="kite"?"Kite units are nimble: 70-100. ":""}${a.movement==="flee"?"Fleeing units are quick: 80-120. ":""}${a.movement==="patrol"?"Patrol units are moderate: 50-80. ":""}${a.movement==="blink"?"Blink units are moderate: 50-90. ":""}${a.movement==="strafe"?"Strafe units are fast: 70-110. ":""}${a.bodyPlan==="flying"?"Flying creatures are naturally fast. ":""}${a.bodyPlan==="structure"?"Structures are immobile. ":""}Pick any number 30-120 that fits. Answer with a number only.`,
  bodyPlan:(n)=>`What body plan fits the concept "${n}"? Think about what kind of creature or object this is. humanoid = bipedal person. quadruped = four-legged animal (horse, wolf, elephant). dragon = winged reptile. serpent = snake. bird = flying animal. insect = bug. crab = crustacean. golem = rock/stone construct. ghost = spirit. fish = aquatic. blob = amorphous. flying = winged creature. mechanical = machine/robot/vehicle (car, tank, drone). structure = building/tower. plant = treant/vine. undead = zombie/skeleton. demon = fiend. beast-man = animal-person hybrid. aquatic = sea creature. monopod = one-legged. centaur = half-horse. hydra = multi-headed. elemental = fire/water/earth/air being. aberration = alien. ooze = slime. crystal = gem being. construct = automaton. angel = divine being. spider = arachnid. wyvern = two-legged dragon. treant = tree-person. kraken = sea monster. gargoyle = stone guardian. wraith = shadow spirit. Answer with one word from: ${opts(ENUM_FIELDS.bodyPlan)}.`,
  weaponType:(n,a)=>`What weapon fits "${n}" (${a.bodyPlan||"unknown"} body)? Animals/creatures often use: claws, breath, or none. Humanoids use: sword, bow, staff, dagger, hammer, spear, axe. Machines use: rifle or none. Answer with one word from: ${opts(ENUM_FIELDS.weaponType)}.`,
  primaryColor:()=>`Given this unit's identity, what primary color fits: ${opts(ENUM_FIELDS.primaryColor)}? Answer with one word.`,
  accentColor:()=>`Given this unit's identity, what accent color fits: ${opts(ENUM_FIELDS.accentColor)}? Answer with one word.`,
  sizeMod:()=>`Given this unit's identity, what size fits: ${opts(ENUM_FIELDS.sizeMod)}? Answer with one word.`,
  // Phase 25: visual modifier prompts.
  headFeature:()=>`What head feature fits this unit: ${opts(ENUM_FIELDS.headFeature)}? Answer with one word.`,
  backFeature:()=>`What back feature fits: ${opts(ENUM_FIELDS.backFeature)}? Answer with one word.`,
  tailFeature:()=>`What tail feature fits: ${opts(ENUM_FIELDS.tailFeature)}? Answer with one word.`,
  aura:()=>`What elemental aura fits: ${opts(ENUM_FIELDS.aura)}? Answer with one word.`,
  eyeStyle:()=>`What eye style fits: ${opts(ENUM_FIELDS.eyeStyle)}? Answer with one word.`,
  pattern:()=>`What surface pattern fits: ${opts(ENUM_FIELDS.pattern)}? Answer with one word.`,
  weaponStyle:()=>`What weapon style fits: ${opts(ENUM_FIELDS.weaponStyle)}? Answer with one word.`,
};
// Phase 12: ask the LLM a single field via a targeted micro-prompt.
// The accumulating unit JSON is sent as system context so the LLM sees the
// unit's identity building up and can make coherent choices. Returns the
// parsed value or null if the call failed / answer was invalid.
async function askField(field,name,attrs,customPrompts,customParsers){
  if(!llmReady)return null;
  try{
    const prompts=customPrompts||FIELD_PROMPTS;
    const parsers=customParsers||FIELD_PARSERS;
    const order=customPrompts?Object.keys(customPrompts):FIELD_ORDER;
    // Build the context JSON from fields decided so far (skip undefined/empty).
    const ctx={};
    for(const f of order){
      if(attrs[f]!==undefined&&attrs[f]!==null&&attrs[f]!=="")
        ctx[f]=attrs[f];
    }
    const sys=customPrompts
      ?`You are designing a spell for a top-down auto-battler. So far the spell is:\n${JSON.stringify(ctx)}\nAnswer the next question with a single word or number only.`
      :`You are designing a game unit for a top-down auto-battler. So far the unit is:\n${JSON.stringify(ctx)}\nAnswer the next question with a single word or number only.`;
    const user=prompts[field](name,attrs);
    debugForge("askField prompt",{field,mode:customPrompts?"spell":"unit",user,sys});
    const reply=await llm.chat.completions.create({
      messages:[{role:"system",content:sys},{role:"user",content:user}],
      temperature:0.7,stream:false
    });
    const answer=(reply.choices[0].message.content||"").trim();
    const parsed=parsers[field](answer);
    debugForge("askField response",{field,answer,parsed});
    // Check if the parser returned the default (first enum value) because the
    // answer wasn't recognised — that counts as a miss so we can retry.
    const enumCheck=customPrompts?SPELL_ENUM:ENUM_FIELDS;
    if(enumCheck[field]&&answer.toLowerCase()!==parsed&&answer.toLowerCase()!==parsed.replace(/_/g," "))
      return null; // answer wasn't a valid enum value
    return parsed;
  }catch(e){
    debugForge("askField error",{field,error:e.message});
    return null;
  }
}

// Phase 12: order in which fields are asked. Each prompt can reference earlier
// answers (e.g. targeting depends on role). ability is asked before
// abilityTrigger to break the circular dependency in the prompt text.
const FIELD_ORDER=[
  "name","role","bodyPlan","weaponType","primaryColor","accentColor","sizeMod",
  "targeting","movement",
  "ability","abilityTrigger",
  "attackCondition","hp","dmg","range","speed","moveSpeedMod","armor",
  // Phase 25: visual modifiers (asked last, after identity is established).
  "headFeature","backFeature","tailFeature","aura","eyeStyle","pattern","weaponStyle"
];

// Re-ask flagged fields via targeted micro-prompts. Falls back to autoFix
// values if the LLM is unavailable or the call fails.
async function reaskFields(name,attrs,flagged){
  if(!llmReady)return autoFixFields(attrs,flagged);
  for(const field of flagged){
    const val=await askField(field,name,attrs);
    if(val!==null)attrs[field]=val;
  }
  return attrs;
}

// J1: Batch LLM field generation — ask for multiple fields in one JSON call.
// Groups fields into batches to reduce 24 sequential calls to 3-4.
const FIELD_BATCHES=[
  ["name","role","bodyPlan","weaponType","primaryColor","accentColor","sizeMod"],
  ["targeting","movement","ability","abilityTrigger","attackCondition","hp","dmg","range","speed","moveSpeedMod","armor"],
  ["headFeature","backFeature","tailFeature","aura","eyeStyle","pattern","weaponStyle"],
];
async function askFieldsBatch(fields,name,attrs){
  if(!llmReady)return null;
  try{
    const ctx={};
    for(const f of Object.keys(attrs)){if(attrs[f]!==undefined&&attrs[f]!==null&&attrs[f]!=="")ctx[f]=attrs[f];}
    const sys=`You are designing a game unit for a top-down auto-battler. So far the unit is:\n${JSON.stringify(ctx)}\nAnswer with a JSON object containing exactly these keys: ${fields.join(", ")}. Values must be valid for each field (enums as lowercase strings, numbers as integers).`;
    const fieldDescs=fields.map(f=>{
      if(ENUM_FIELDS[f])return `${f}: one of [${ENUM_FIELDS[f].join(", ")}]`;
      if(INT_FIELDS[f]){const[min,max]=INT_FIELDS[f];return `${f}: integer ${min}-${max}`;}
      if(f==="name")return `${f}: short name (max 20 chars)`;
      if(f==="primaryColor"||f==="accentColor")return `${f}: hex color like #abc or #aabbcc`;
      return `${f}: value`;
    }).join("\n");
    const user=`Concept: "${name}"\n${fieldDescs}\nReturn JSON only.`;
    const answer=await llm.generate(sys+"\n\n"+user,{},256);
    const parsed=JSON.parse(answer);
    for(const f of fields){
      if(parsed[f]!==undefined){
        if(ENUM_FIELDS[f]&&ENUM_FIELDS[f].includes(String(parsed[f]).toLowerCase()))attrs[f]=String(parsed[f]).toLowerCase();
        else if(INT_FIELDS[f]&&typeof parsed[f]==="number")attrs[f]=clamp(Math.round(parsed[f]),INT_FIELDS[f][0],INT_FIELDS[f][1]);
        else if(f==="name")attrs[f]=String(parsed[f]).slice(0,20);
        else if(f==="primaryColor"||f==="accentColor")attrs[f]=sanitizeHex(parsed[f]);
      }
    }
    return attrs;
  }catch(e){return null;}
}

// Phase 12: main generation orchestrator (per-field micro-prompts).
// Asks the LLM one field at a time with a focused question, building on
// earlier answers. Retries any field that came back invalid. Falls back to
// templates if the LLM is unavailable.
async function generateUnit(rawPrompt,arenaIndex){
  const prompt=normalizePrompt(rawPrompt);
  const key=cacheKey(prompt,MODEL);
  debugForge("generateUnit start",{rawPrompt,prompt,arenaIndex});
  // 1. Cache hit?
  const cached=await cacheGet(key);
  if(cached){debugForge("generateUnit cache hit",cached);return cached;}
  debugForge("generateUnit cache miss");
  // 2. If the model is still downloading, wait for it so the forge produces
  //    a creative unit instead of a template. The user can Cancel via the
  //    forge progress UI, which resolves the cancel signal and unblocks this.
  if(llmLoading&&!llmReady&&!llmCancelled&&llmLoadPromise){
    try{await Promise.race([llmLoadPromise,llmCancelPromise]);}catch(e){/* handled below */}
  }
  // 3. No LLM — template fallback.
  if(!llmReady){
    const u=attrsToUnit(templateFallback(prompt),arenaIndex);
    if(u)await cachePut(key,prompt,MODEL,u);
    return u;
  }
  // 4. Per-field generation: ask each field one at a time, building on prior
  //    answers. Retry up to 2 times on invalid answers. Enum options are
  //    shuffled per call to counter first-option bias.
  let attrs={};
  const total=FIELD_ORDER.length;
  for(let fi=0;fi<FIELD_ORDER.length;fi++){
    const field=FIELD_ORDER[fi];
    if(forgeGenProgress)forgeGenProgress(fi,total,field);
    let val=null;
    let attempt=0;
    for(;attempt<2&&val===null;attempt++){
      val=await askField(field,attrs.name||prompt,attrs);
    }
    attrs[field]=val!==null?val:FIELD_PARSERS[field](""); // parser default
    debugForge("generateUnit field",{field,val:attrs[field],attempts:attempt});
    // F1: live preview — render sprite with partial attrs after each field.
    if(forgeLivePreview)forgeLivePreview(attrs,field);
  }
  // 5. Semantic validation + per-field retry for inconsistent fields.
  const flagged=semanticValidate(attrs);
  if(flagged.length>0){
    debugForge("generateUnit flagged",{attrs,flagged});
    if(forgeGenProgress)forgeGenProgress(total,total,"validating");
    attrs=autoFixFields(attrs,flagged);
    attrs=await reaskFields(attrs.name,attrs,flagged);
  }
  // 6. Build unit from attributes.
  const u=attrsToUnit(attrs,arenaIndex);
  if(!u){
    debugForge("generateUnit attrsToUnit failed, using template",{attrs});
    attrs=templateFallback(prompt);
    const u2=attrsToUnit(attrs,arenaIndex);
    if(u2){await cachePut(key,prompt,MODEL,u2);return u2;}
    return null;
  }
  // 6. Cache.
  debugForge("generateUnit final unit",u);
  await cachePut(key,prompt,MODEL,u);
  return u;
}

// Phase 23: LLM spell forge — mirrors generateUnit but with spell schema.
const SPELL_FIELD_ORDER=["name","trigger","target","effect","shape","fxType","magnitude","radius","duration"];
const SPELL_FIELD_PROMPTS={
  name:(ctx)=>`Invent a short fantasy spell name (max 20 chars) for: "${ctx}". Reply with just the name.`,
  trigger:()=>`When should this spell fire: ${opts(SPELL_ENUM.trigger)}? Answer with one phrase.`,
  target:()=>`Where should this spell target: ${opts(SPELL_ENUM.target)}? Answer with one phrase.`,
  effect:()=>`What effect does this spell have: ${opts(SPELL_ENUM.effect)}? Answer with one phrase.`,
  shape:()=>`What AoE shape: ${opts(SPELL_ENUM.shape)}? Answer with one word.`,
  fxType:()=>`What visual effect: ${opts(SPELL_ENUM.fxType)}? Answer with one word.`,
  magnitude:()=>`How strong is the effect (10-80)? Answer with a number.`,
  radius:()=>`What area radius (30-120)? Answer with a number.`,
  duration:()=>`How long in seconds (0-6)? Answer with a number.`,
};
const SPELL_FIELD_PARSERS={
  name:(a)=>(a||"").slice(0,20).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'"),
  trigger:(a)=>parseEnum(a,SPELL_ENUM.trigger,"battle_start"),
  target:(a)=>parseEnum(a,SPELL_ENUM.target,"enemy_cluster"),
  effect:(a)=>parseEnum(a,SPELL_ENUM.effect,"damage"),
  shape:(a)=>parseEnum(a,SPELL_ENUM.shape,"circle_aoe"),
  fxType:(a)=>parseEnum(a,SPELL_ENUM.fxType,"explosion"),
  magnitude:(a)=>clamp(parseInt(a)||30,10,80),
  radius:(a)=>clamp(parseInt(a)||60,30,120),
  duration:(a)=>clamp(parseInt(a)||0,0,6),
};
// Phase 23: hand-authored spell templates for fallback.
const SPELL_TEMPLATES=[
  {kw:["tnt","bomb","explosion","blast"],a:{name:"TNT",trigger:"battle_start",target:"enemy_cluster",effect:"damage",shape:"circle_aoe",fxType:"explosion",magnitude:40,radius:60,duration:0}},
  {kw:["fire","wall","burn","waste"],a:{name:"Fire Wall",trigger:"battle_start",target:"enemy_frontline",effect:"damage_over_time",shape:"persistent_zone",fxType:"fire_wall",magnitude:10,radius:50,duration:5}},
  {kw:["heal","rain","mend","restore"],a:{name:"Heal Rain",trigger:"when_ally_hurt",target:"ally_cluster",effect:"heal_allies",shape:"circle_aoe",fxType:"heal_glow",magnitude:30,radius:60,duration:0}},
  {kw:["frost","ice","freeze","nova"],a:{name:"Frost Nova",trigger:"on_first_contact",target:"enemy_cluster",effect:"stun",shape:"circle_aoe",fxType:"frost",magnitude:20,radius:70,duration:1}},
  {kw:["lightning","bolt","zap","thunder"],a:{name:"Lightning Bolt",trigger:"delayed_3s",target:"lowest_hp_enemy",effect:"damage",shape:"point",fxType:"lightning",magnitude:50,radius:40,duration:0}},
  {kw:["poison","cloud","plague","toxic"],a:{name:"Poison Cloud",trigger:"battle_start",target:"enemy_frontline",effect:"damage_over_time",shape:"persistent_zone",fxType:"poison_cloud",magnitude:8,radius:60,duration:5}},
  {kw:["shield","protect","barrier","ward"],a:{name:"Shield Ward",trigger:"when_ally_hurt",target:"ally_cluster",effect:"shield_allies",shape:"circle_aoe",fxType:"shockwave",magnitude:20,radius:60,duration:2}},
  {kw:["slow","snare","web","root"],a:{name:"Snare",trigger:"on_first_contact",target:"enemy_frontline",effect:"slow",shape:"circle_aoe",fxType:"frost",magnitude:20,radius:70,duration:3}},
  {kw:["summon","spawn","call","reinforce"],a:{name:"Reinforce",trigger:"delayed_3s",target:"ally_cluster",effect:"summon",shape:"circle_aoe",fxType:"heal_glow",magnitude:40,radius:50,duration:0}},
  {kw:["buff","rage","frenzy","empower"],a:{name:"Rage",trigger:"battle_start",target:"ally_cluster",effect:"buff_dmg",shape:"circle_aoe",fxType:"shockwave",magnitude:30,radius:60,duration:0}},
];
function templateSpellFallback(prompt){
  debugForge("templateSpellFallback start",prompt);
  const p=(prompt||"").toLowerCase();
  let match=SPELL_TEMPLATES.find(t=>t.kw.some(k=>p.includes(k)));
  let attrs;
  if(match){attrs={...match.a};}
  else{attrs={...SPELL_TEMPLATES[0].a};}
  // Customize name from prompt if no keyword match.
  if(!match&&prompt){attrs.name=prompt.slice(0,18).replace(/</g,"").replace(/>/g,"").replace(/"/g,"'");}
  debugForge("templateSpellFallback result",{match:match?match.a.name||null:null,attrs});
  return attrs;
}
// Phase 23: semantic validation for spells.
const SPELL_ALLY_EFFECTS=["heal_allies","heal_over_time","shield_allies","buff_dmg","buff_speed"];
const SPELL_ALLY_TARGETS=["ally_cluster","lowest_ally"];
function semanticValidateSpell(a){
  const flagged=[];
  if(SPELL_ALLY_EFFECTS.includes(a.effect)&&!SPELL_ALLY_TARGETS.includes(a.target))flagged.push("target");
  if((a.effect==="damage_over_time"||a.shape==="persistent_zone")&&a.duration<=0)flagged.push("duration");
  for(const f of ["trigger","target","effect","shape","fxType"]){
    if(SPELL_ENUM[f]&&!SPELL_ENUM[f].includes(a[f]))flagged.push(f);
  }
  return flagged;
}
async function generateSpell(rawPrompt,arenaIndex){
  const prompt=normalizePrompt(rawPrompt);
  const key="spell:"+cacheKey(prompt,MODEL);
  debugForge("generateSpell start",{rawPrompt,prompt,arenaIndex});
  const cached=await cacheGet(key);
  if(cached){debugForge("generateSpell cache hit",cached);return cached;}
  debugForge("generateSpell cache miss");
  if(llmLoading&&!llmReady&&!llmCancelled&&llmLoadPromise){
    try{await Promise.race([llmLoadPromise,llmCancelPromise]);}catch(e){/* */}
  }
  if(!llmReady){
    const s={...templateSpellFallback(prompt),_isSpell:true};
    await cachePut(key,prompt,MODEL,s);
    return s;
  }
  let attrs={};
  const total=SPELL_FIELD_ORDER.length;
  for(let fi=0;fi<SPELL_FIELD_ORDER.length;fi++){
    const field=SPELL_FIELD_ORDER[fi];
    if(forgeGenProgress)forgeGenProgress(fi,total,field);
    let val=null;
    let attempt=0;
    for(;attempt<2&&val===null;attempt++){
      val=await askField(field,prompt,attrs,SPELL_FIELD_PROMPTS,SPELL_FIELD_PARSERS);
    }
    attrs[field]=val!==null?val:SPELL_FIELD_PARSERS[field]("");
    debugForge("generateSpell field",{field,val:attrs[field],attempts:attempt});
  }
  const flagged=semanticValidateSpell(attrs);
  if(flagged.length>0){
    debugForge("generateSpell flagged",{attrs,flagged});
    // Auto-fix: set ally target for ally effects, duration=3 for DoT.
    if(flagged.includes("target")&&SPELL_ALLY_EFFECTS.includes(attrs.effect))attrs.target="ally_cluster";
    if(flagged.includes("duration")&&(attrs.effect==="damage_over_time"||attrs.shape==="persistent_zone"))attrs.duration=3;
    // Auto-fix invalid enum values to defaults.
    if(flagged.includes("trigger"))attrs.trigger="battle_start";
    if(flagged.includes("effect"))attrs.effect="damage";
    if(flagged.includes("shape"))attrs.shape="circle_aoe";
    if(flagged.includes("fxType"))attrs.fxType="explosion";
  }
  const spell={...attrs,_isSpell:true};
  debugForge("generateSpell final spell",spell);
  await cachePut(key,prompt,MODEL,spell);
  return spell;
}

// X7: showAdStub moved to utils.js (before StubAdProvider) for correct load order.

