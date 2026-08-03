// Phase 7: load with crash recovery — fall back to backup if primary is corrupt.
function loadData(){
  try{
    const data=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(data&&typeof data==="object"&&!Array.isArray(data)){
      return data;
    }
    return {};
  }catch(e){
    showError("Save corrupt, restoring backup.");
    try{
      const backup=JSON.parse(localStorage.getItem(SAVE_BACKUP_KEY));
      if(backup&&typeof backup==="object"&&!Array.isArray(backup)){
        return backup;
      }
    }catch(e2){}
    return {};
  }
}
// J4: Async load — tries localStorage first, then IndexedDB fallback.
// Used by G.init() to recover saves written to IDB when localStorage was full.
function loadDataAsync(cb){
  const sync=loadData();
  if(sync&&typeof sync.version==="number"&&!isNaN(sync.version)){cb(sync);return;} // fast path: localStorage has valid data
  // No localStorage data — try IndexedDB.
  idbGet(SAVE_KEY,data=>{
    if(data){
      try{const parsed=JSON.parse(data);if(parsed&&parsed.version){cb(parsed);return;}}catch(e){}
    }
    cb(sync||{}); // fall back to whatever loadData returned (likely {})
  });
}
// Phase 7: migrate older save schemas forward.
function migrateSave(s){
  if(!s)return s;
  try{
    // Validate version is a number to prevent type coercion bugs.
    const ver=typeof s.version==="number"&&!isNaN(s.version)?s.version:0;
    // Future-version save: refuse to load to prevent data loss.
    if(ver>CURRENT_VERSION){
      console.warn("Save version "+ver+" > current "+CURRENT_VERSION+" — refusing to load to prevent data loss.");
      return null;
    }
    if(!s.version||ver<4){
      // v3 and earlier had no progression fields; re-init defaults via G.init.
      s.version=4;
    }
  if(ver<5){
    // v4 -> v5: add progression fields (achievements, upgrades, xp, coins).
    s.achievements=s.achievements||{};
    s.upgrades=s.upgrades||{};
    s.xp=s.xp||0;
    s.coins=s.coins||0;
    s.version=5;
  }
  if(ver<6){
    // v5 -> v6 (Phase 8): match/lives/loadout/collection schema.
    // All new save fields defined here so subsequent phases can use them.
    s.matchWins=s.matchWins||0;
    s.arena=s.arena||0;
    if(!Array.isArray(s.ai))s.ai=[];
    // collection = existing AI units (legacy format, no behaviour API fields).
    // Preserve existing collection if present (re-migration or newer save).
    if(!Array.isArray(s.collection)||s.collection.length===0){
      s.collection=s.ai.map(u=>({...u,legacy:true}));
    }
    // loadout = first 4 of deck (or first 4 base unit names if deck missing).
    if(s.loadout&&s.loadout.length>0){
      // already has loadout (re-migrating)
    }else if(s.deck&&s.deck.length>0){
      s.loadout=s.deck.slice(0,4).map(u=>u.n||u);
    }else{
      s.loadout=["Knight","Archer","Slash","Wizard"];
    }
    // Drop old forge5 achievement (replaced by new forge achievements in Phase 19).
    if(s.achievements)delete s.achievements.forge5;
    s.version=6;
  }
  if(ver<7){
    // v6 -> v7 (Phase 19b): daily forge cap tracking.
    s.forgeDate=s.forgeDate||"";
    s.forgeCount=s.forgeCount||0;
    s.roleWins=s.roleWins||{};
    s.version=7;
  }
  if(ver<8){
    // v7 -> v8 (Phase 23): spellbook for forged spells.
    s.spellbook=Array.isArray(s.spellbook)?s.spellbook:[];
    // Starter spells: TNT + Heal Rain.
    if(!s.spellbook.length){
      s.spellbook=[
        {name:"TNT",trigger:"battle_start",target:"enemy_cluster",effect:"damage",shape:"circle_aoe",fxType:"explosion",magnitude:40,radius:60,duration:0,_isSpell:true},
        {name:"Heal Rain",trigger:"when_ally_hurt",target:"ally_cluster",effect:"heal_allies",shape:"circle_aoe",fxType:"heal_glow",magnitude:30,radius:60,duration:0,_isSpell:true},
      ];
    }
    s.version=8;
  }
  if(ver<9){
    // v8 -> v9 (Phase 31): onboarding flag + settings.
    s.onboarded=s.onboarded||false;
    s.settings=s.settings||{audioEnabled:true,reducedMotion:false,quality:"auto"};
    s.version=9;
  }
  if(ver<10){
    // v9 -> v10 (Phase 33): daily quests + login streaks.
    s.quests=(s.quests&&typeof s.quests==="object")?s.quests:{date:"",list:[],streak:{count:0,lastLogin:""}};
    if(!Array.isArray(s.quests.list))s.quests.list=[];
    if(!s.quests.streak||typeof s.quests.streak!=="object")s.quests.streak={count:0,lastLogin:""};
    s.version=10;
  }
  if(ver<11){
    // v10 -> v11 (Phase 35): analytics opt-out + ranked.
    s.analyticsOptOut=s.analyticsOptOut||false;
    s.ranked=s.ranked||{name:"",rating:1000,wins:0,losses:0,season:0,peakRating:1000};
    s.version=11;
  }
  if(ver<12){
    // v11 -> v12 (Phase 37): replays.
    s.replays=s.replays||[];
    s.version=12;
  }
  return s;
  }catch(e){
    console.error("Migration failed:",e);
    showError("Save migration failed: "+(e.message||e)+". Your progress may be reset.");
    // Return a safe default save to prevent corruption
    return {version:CURRENT_VERSION};
  }
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

