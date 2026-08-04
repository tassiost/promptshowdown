// Phase 1: visible error panel helpers (defined before anything that can throw).
function showError(msg){
  const panel=document.getElementById("errorPanel");
  const body=document.getElementById("errorBody");
  if(!panel||!body)return;
  body.innerText=String(msg);
  panel.style.display="block";
  console.error(msg);
}
function clearError(){
  const panel=document.getElementById("errorPanel");
  if(panel)panel.style.display="none";
}
// Phase 6: transient toast for achievements / events.
let toastTimer=null;
function toast(msg){
  const el=$("toast");
  if(!el)return;
  el.innerText=msg;
  el.style.display="block";
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{el.style.display="none";},2500);
}

// Custom confirm modal — replaces native confirm() for consistent UX.
function showConfirm(message,onYes,onNo){
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;";
  const modal=document.createElement("div");
  modal.style.cssText="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;text-align:center;";
  modal.innerHTML=`<div style="margin-bottom:16px;font-size:.9rem;">${message}</div>`;
  const btns=document.createElement("div");
  btns.style.cssText="display:flex;gap:8px;justify-content:center;";
  const yes=document.createElement("button");
  yes.className="btn primary";yes.textContent="Yes";yes.style.cssText="padding:8px 20px;";
  yes.onclick=()=>{overlay.remove();if(onYes)onYes();};
  const no=document.createElement("button");
  no.className="btn";no.textContent="No";no.style.cssText="padding:8px 20px;";
  no.onclick=()=>{overlay.remove();if(onNo)onNo();};
  btns.appendChild(yes);btns.appendChild(no);
  modal.appendChild(btns);overlay.appendChild(modal);document.body.appendChild(overlay);
}

// Phase 7: mobile detection + haptics + fullscreen.
const isMobile=(('ontouchstart'in window)||navigator.maxTouchPoints>0)&&window.matchMedia("(max-width: 820px)").matches;
// iOS standalone PWA detection (Add to Home Screen).
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
// iOS detection (iPhone — Fullscreen API not supported for arbitrary elements).
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.MSStream;
const isIPhone=/iPhone/.test(navigator.userAgent)&&!window.MSStream;
function vibrate(ms){
  if(navigator.vibrate){try{navigator.vibrate(ms);}catch(e){}}
}
// iOS standalone "lying viewport" fix: screen.height is taller than innerHeight
// by ~59px (WebKit bug #254868). env(safe-area-inset-bottom) returns 0 in
// standalone mode, so we measure the gap and set it as a CSS variable.
function measureStandaloneGap(){
  if(isStandalone&&isIOS){
    const gap=screen.height-window.innerHeight;
    if(gap>0){
      document.documentElement.style.setProperty("--standalone-gap",gap+"px");
      return;
    }
  }
  // Non-iOS or non-standalone: clear the gap (env() handles it).
  document.documentElement.style.setProperty("--standalone-gap","0px");
}
measureStandaloneGap();
window.addEventListener("resize",measureStandaloneGap);
window.addEventListener("orientationchange",()=>setTimeout(measureStandaloneGap,100));
// Pseudo-fullscreen: hides the fsBtn and uses CSS to fill the screen.
// On iPhone, the Fullscreen API doesn't work for arbitrary elements (only <video>).
// We use a CSS-based approach: set body to position:fixed, inset:0, and hide UI chrome.
let _pseudoFs=false;
function toggleFullscreen(){
  // Try native Fullscreen API first (works on desktop, iPad, Android).
  if(!isIPhone){
    try{
      if(!document.fullscreenElement&&!document.webkitFullscreenElement){
        const el=document.documentElement;
        const fn=el.requestFullscreen||el.webkitRequestFullscreen;
        if(fn){fn.call(el);return;}
      }else{
        const fn=document.exitFullscreen||document.webkitExitFullscreen;
        if(fn){fn.call(document);return;}
      }
    }catch(e){/* fall through to pseudo-fullscreen */}
  }
  // Pseudo-fullscreen (iPhone / fallback): toggle a CSS class that fills the screen.
  _pseudoFs=!_pseudoFs;
  if(_pseudoFs){
    document.body.classList.add("pseudo-fullscreen");
    const btn=document.getElementById("fsBtn");
    if(btn)btn.textContent="⬜";
  }else{
    document.body.classList.remove("pseudo-fullscreen");
    const btn=document.getElementById("fsBtn");
    if(btn)btn.textContent="⛶";
  }
}
window.toggleFullscreen=toggleFullscreen;

// Route uncaught errors to the panel instead of silent console-only.
window.addEventListener("error",e=>{
  if(e&&e.error)showError(e.message||String(e.error));
});
window.addEventListener("unhandledrejection",e=>{
  const r=e&&e.reason;
  showError("Unhandled promise: "+(r&&(r.message||r)||r));
});

// ─── Deterministic Math ──────────────────────────────────────────────────────
// DET: IEEE 754 basic arithmetic is already cross-browser deterministic.
// Only transcendental functions need deterministic replacements for lockstep.
// Rounding to 6 decimals kills browser differences (they live in 15th+ decimal)
// while keeping sub-pixel precision (0.000001 game units << 1 pixel).
// Use DMath.* for state-affecting math (movement, dist, spells, projectiles).
// Keep Math.* for visual-only code (rendering, particles, FX).
const DMath={
  _sinTable:null,
  _init(){
    // 1024-entry sin lookup table (0.35° resolution — plenty for movement).
    this._sinTable=new Float64Array(1024);
    for(let i=0;i<1024;i++)
      this._sinTable[i]=Math.round(Math.sin(i/1024*2*Math.PI)*1e6)/1e6;
  },
  sqrt(x){return Math.round(Math.sqrt(x)*1e6)/1e6;},
  sin(x){
    if(!this._sinTable)this._init();
    // Normalize angle to [0,2π) via integer index, then lookup.
    const idx=((x/(2*Math.PI))*1024)|0;
    return this._sinTable[((idx%1024)+1024)%1024];
  },
  cos(x){return this.sin(x+Math.PI/2);},
  atan(x){return Math.round(Math.atan(x)*1e6)/1e6;},
  atan2(y,x){
    if(x===0)return y>0?Math.PI/2:y<0?-Math.PI/2:0;
    return this.atan(y/x)+(x<0?y>=0?Math.PI:-Math.PI:0);
  },
  hypot(x,y){return this.sqrt(x*x+y*y);},
};

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
// DET: deterministic RNG for battle sim. Seeded per round from Match.seed.
// Use rand()/randInt()/randRange() in state-affecting code (battle sim).
// Keep R()/Q() for non-battle code (draft, shop, forge, bot AI, UI, BattleFX).
let _battleSeed=0,_rngState=0;
function seedBattle(s){_battleSeed=s>>>0;_rngState=s>>>0;}
function rand(){
  _rngState=(_rngState+0x6D2B79F5)|0;
  let t=Math.imul(_rngState^(_rngState>>>15),1|_rngState);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
}
function randInt(a,b){return a+Math.floor(rand()*(b-a));}
function randRange(a,b){return a+rand()*(b-a);}

// ─── FNV-1a state hash (desync detection) ────────────────────────────────────
// DET: hashes a JS value into a 32-bit hex string. Used by Battle.stateHash()
// to compare peer sims at round end. Identical sim states → identical hash.
function fnv1aHash(obj){
  const s=JSON.stringify(obj);
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,0x01000193);
  }
  return (h>>>0).toString(16);
}

const R=Math.random;
const F=Math.floor;
const Q=(a,b)=>a+R()*(b-a);
const SAVE_KEY="promptShowdownV4";

const SAVE_BACKUP_KEY="promptShowdownV4_backup";
const CURRENT_VERSION=13; // v13: default loadout includes generated units.
// Phase 7: backup-before-overwrite so a bad write can't wipe progress.
// E1: Debounced saveData — batches writes within 500ms.
let _saveTimer=null;
function saveData(data){
  if(!data||typeof data!=="object")return;
  try{
    const prev=localStorage.getItem(SAVE_KEY);
    if(prev)localStorage.setItem(SAVE_BACKUP_KEY,prev);
    const json=JSON.stringify(data);
    // J4: If localStorage is near quota, fall back to IndexedDB.
    if(!localStorageQuotaOK()){
      idbPut(SAVE_KEY,json);
      return;
    }
    localStorage.setItem(SAVE_KEY,json);
    // Show brief save indicator.
    const si=$("saveIndicator");
    if(si){si.style.opacity="1";setTimeout(()=>{si.style.opacity="0";},800);}
  }catch(e){
    // J4: Quota exceeded — try IndexedDB fallback.
    try{idbPut(SAVE_KEY,JSON.stringify(data));}catch(e2){}
    showError("Save failed: "+(e&&e.message||e)+" — using IndexedDB fallback");
  }
}
function saveDataDebounced(data){
  if(_saveTimer)clearTimeout(_saveTimer);
  _saveTimer=setTimeout(()=>{saveData(data);_saveTimer=null;},500);
}
function saveDataNow(data){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  saveData(data);
}
// E2: structuredClone with fallback.
function deepClone(x){
  return typeof structuredClone!=="undefined"?structuredClone(x):JSON.parse(JSON.stringify(x));
}
// Escape HTML to prevent XSS from user-generated unit names in innerHTML.
function esc(s){
  return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// J4: IndexedDB fallback for when localStorage is near quota.
let _idbDB=null;
function idb(){
  if(_idbDB&&_idbDB.readyState!=="pending")return _idbDB;
  try{
    _idbDB=indexedDB.open("promptshowdown",1);
    _idbDB.onupgradeneeded=e=>{e.target.result.createObjectStore("kv");};
    _idbDB.onerror=()=>{_idbDB=null;};
    return _idbDB;
  }catch(e){return null;}
}
function idbPut(key,val){
  const db=idb();if(!db)return;
  db.onsuccess=()=>{
    try{
      const tx=db.result.transaction("kv","readwrite");
      tx.objectStore("kv").put(val,key);
      tx.onerror=(e)=>console.warn("IDB put failed:",e.target.error);
    }catch(e){console.warn("IDB put exception:",e.message);}
  };
  db.onerror=(e)=>console.warn("IDB open failed:",e.target.error);
}
function idbGet(key,cb){
  const db=idb();if(!db){cb(null);return;}
  db.onsuccess=()=>{
    try{
      const tx=db.result.transaction("kv","readonly");
      const req=tx.objectStore("kv").get(key);
      req.onsuccess=()=>cb(req.result||null);
      req.onerror=()=>cb(null);
      tx.onerror=()=>cb(null);
    }catch(e){cb(null);}
  };
  db.onerror=()=>cb(null);
}
function localStorageQuotaOK(){
  const test="_quota_test";
  try{
    localStorage.setItem(test,"x".repeat(102400)); // 100KB test
    return true;
  }catch(e){return false;}
  finally{try{localStorage.removeItem(test);}catch(e){}}
}
// Phase 39: i18n — string table + t() helper.
const STRINGS={
  en:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ FIGHT",forge:"🔮 FORGE",deck:"📋 DECK",upgrade:"⬆ UPGRADE",
    reset:"↺ RESET",howto:"❓ How to Play",settings:"⚙️ Settings",quests:"📋 Quests",ranked:"🏆 Ranked",
    welcome:"Welcome! Your 4-card loadout is your army. Tap DECK to see it.",
    fight_tut:"Tap FIGHT to start a match. You'll draft 3 units per round.",
    draft_tut:"Pick 1 card from each draw. Reroll if you don't like them.",
    scout_tut:"Scout! Tap to reveal what your opponent picked.",
    battle_tut:"FIGHT! Units auto-battle. Watch and adapt for round 2.",
    result_tut:"Win 3 rounds to take the match. Good luck!",
    round_won:"ROUND WON",round_lost:"ROUND LOST",next_round:"NEXT ROUND",
    win:"VICTORY",lose:"DEFEAT",menu:"← Back",
    // G2: In-game text strings.
    match_won:"MATCH WON!🏆",match_lost:"MATCH LOST",match_draw:"DRAW",
    settings_saved:"Settings saved",share_copied:"📋 Share link copied!",share_failed:"Share failed",
    invalid_link:"Invalid share link",spell_added_share:"✓ Spell added from share link!",
    unit_added_share:"✓ Unit added from share link!",spell_added_book:"Spell added to spellbook!",
    unit_added_collection:"✓ Unit added to collection",enter_concept:"Enter a unit concept first",
    max_level:"Already at max level",need_fuse:"Need 2 of the same unit to fuse",
    not_enough_coins:"Not enough coins",quests_done:"🎁 All quests done! +50 bonus coins",
    host_disconnected:"Host disconnected.",continue_vs_bot:"Continuing vs bot",
    searching_opponent:"Searching for a human opponent...",opponent_found:"Opponent found! Starting match...",
    status_connected:"Status: connected",status_disconnected:"Status: disconnected",
    custom_unit:"Custom Unit",spell:"Spell",reveal_all:"👁 Reveal All",tap_to_reveal:"Tap to reveal",
    forged_to:"🔮 Fused ",upgraded_to:" upgraded to Lv",
  },
  es:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ LUCHAR",forge:"🔮 FORJAR",deck:"📋 MAZO",upgrade:"⬆ MEJORAR",
    reset:"↺ REINICIAR",howto:"❓ Cómo Jugar",settings:"⚙️ Ajustes",quests:"📋 Misiones",ranked:"🏆 Ranking",
    welcome:"¡Bienvenido! Tu mazo de 4 cartas es tu ejército. Toca MAZO para verlo.",
    fight_tut:"Toca LUCHAR para iniciar una partida. Draftearás 3 unidades por ronda.",
    draft_tut:"Elige 1 carta de cada tirada. Re-lanza si no te gustan.",
    scout_tut:"¡Explora! Toca para revelar lo que eligió tu oponente.",
    battle_tut:"¡PELEA! Las unidades luchan solas. Observa y adapta para la ronda 2.",
    result_tut:"Gana 3 rondas para llevar el partido. ¡Buena suerte!",
    round_won:"RONDA GANADA",round_lost:"RONDA PERDIDA",next_round:"SIGUIENTE RONDA",
    win:"VICTORIA",lose:"DERROTA",menu:"← Volver",
    match_won:"¡PARTIDA GANADA!🏆",match_lost:"PARTIDA PERDIDA",match_draw:"EMPATE",
    settings_saved:"Ajustes guardados",share_copied:"📋 ¡Enlace copiado!",share_failed:"Error al compartir",
    invalid_link:"Enlace inválido",spell_added_share:"✓ ¡Hechizo añadido!",
    unit_added_share:"✓ ¡Unidad añadida!",spell_added_book:"¡Hechizo añadido al grimorio!",
    unit_added_collection:"✓ Unidad añadida a la colección",enter_concept:"Escribe un concepto primero",
    max_level:"Nivel máximo alcanzado",need_fuse:"Necesitas 2 unidades iguales para fusionar",
    not_enough_coins:"Monedas insuficientes",quests_done:"🎁 ¡Misiones completadas! +50 monedas bonus",
    host_disconnected:"Anfitrión desconectado.",continue_vs_bot:"Continuando contra bot",
    searching_opponent:"Buscando oponente humano...",opponent_found:"¡Oponente encontrado! Iniciando partida...",
    status_connected:"Estado: conectado",status_disconnected:"Estado: desconectado",
    custom_unit:"Unidad Personalizada",spell:"Hechizo",reveal_all:"👁 Revelar Todo",tap_to_reveal:"Toca para revelar",
    forged_to:"🔮 Fusionado ",upgraded_to:" mejorado a Nv",
  },
  pt:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ LUTAR",forge:"🔮 FORJAR",deck:"📋 BARALHO",upgrade:"⬆ MELHORAR",
    reset:"↺ REINICIAR",howto:"❓ Como Jogar",settings:"⚙️ Ajustes",quests:"📋 Missões",ranked:"🏆 Ranking",
    welcome:"Bem-vindo! Seu baralho de 4 cartas é seu exército. Toque BARALHO para vê-lo.",
    fight_tut:"Toque LUTAR para iniciar uma partida. Você draftará 3 unidades por rodada.",
    draft_tut:"Escolha 1 carta de cada sorteio. Re-role se não gostar.",
    scout_tut:"Reconheça! Toque para revelar o que seu oponente escolheu.",
    battle_tut:"LUTE! As unidades lutam sozinhas. Observe e adapte para a rodada 2.",
    result_tut:"Vença 3 rodadas para vencer a partida. Boa sorte!",
    round_won:"RODADA VENCIDA",round_lost:"RODADA PERDIDA",next_round:"PRÓXIMA RODADA",
    win:"VITÓRIA",lose:"DERROTA",menu:"← Voltar",
    match_won:"PARTIDA VENCIDA!🏆",match_lost:"PARTIDA PERDIDA",match_draw:"EMPATE",
    settings_saved:"Ajustes salvos",share_copied:"📋 Link copiado!",share_failed:"Falha ao compartilhar",
    invalid_link:"Link inválido",spell_added_share:"✓ Feitiço adicionado!",
    unit_added_share:"✓ Unidade adicionada!",spell_added_book:"Feitiço adicionado ao grimório!",
    unit_added_collection:"✓ Unidade adicionada à coleção",enter_concept:"Digite um conceito primeiro",
    max_level:"Nível máximo atingido",need_fuse:"Precisa de 2 unidades iguais para fundir",
    not_enough_coins:"Moedas insuficientes",quests_done:"🎁 Todas as missões completas! +50 moedas bônus",
    host_disconnected:"Anfitrião desconectado.",continue_vs_bot:"Continuando contra bot",
    searching_opponent:"Procurando oponente humano...",opponent_found:"Oponente encontrado! Iniciando partida...",
    status_connected:"Status: conectado",status_disconnected:"Status: desconectado",
    custom_unit:"Unidade Personalizada",spell:"Feitiço",reveal_all:"👁 Revelar Tudo",tap_to_reveal:"Toque para revelar",
    forged_to:"🔮 Fundido ",upgraded_to:" melhorado para Nv",
  },
  de:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ KÄMPFEN",forge:"🔮 SCHMIEDEN",deck:"📋 DECK",upgrade:"⬆ UPGRADE",
    reset:"↺ ZURÜCKSETZEN",howto:"❓ So spielt man",settings:"⚙️ Einstellungen",quests:"📋 Quests",ranked:"🏆 Rangliste",
    welcome:"Willkommen! Dein 4-Karten-Deck ist deine Armee. Tippe DECK um es zu sehen.",
    fight_tut:"Tippe KÄMPFEN um ein Match zu starten. Du draftest 3 Einheiten pro Runde.",
    draft_tut:"Wähle 1 Karte pro Zug. Neu würfeln wenn sie dir nicht gefällt.",
    scout_tut:"Aufklären! Tippe um zu sehen was dein Gegner gewählt hat.",
    battle_tut:"KÄMPFE! Einheiten kämpfen automatisch. Beobachte und passe an.",
    result_tut:"Gewinne 3 Runden um das Match zu gewinnen. Viel Glück!",
    round_won:"RUNDE GEWONNEN",round_lost:"RUNDE VERLOREN",next_round:"NÄCHSTE RUNDE",
    win:"SIEG",lose:"NIEDERLAGE",menu:"← Zurück",
    match_won:"MATCH GEWONNEN!🏆",match_lost:"MATCH VERLOREN",match_draw:"UNENTSCHIEDEN",
    settings_saved:"Einstellungen gespeichert",share_copied:"📋 Link kopiert!",share_failed:"Teilen fehlgeschlagen",
    invalid_link:"Ungültiger Link",spell_added_share:"✓ Zauber hinzugefügt!",
    unit_added_share:"✓ Einheit hinzugefügt!",spell_added_book:"Zauber zum Zauberbuch hinzugefügt!",
    unit_added_collection:"✓ Einheit zur Sammlung hinzugefügt",enter_concept:"Gib zuerst ein Konzept ein",
    max_level:"Maximales Level erreicht",need_fuse:"Brauche 2 gleiche Einheiten zum Verschmelzen",
    not_enough_coins:"Nicht genug Münzen",quests_done:"🎁 Alle Quests fertig! +50 Bonus-Münzen",
    host_disconnected:"Host getrennt.",continue_vs_bot:"Weiter gegen Bot",
    searching_opponent:"Suche menschlichen Gegner...",opponent_found:"Gegner gefunden! Starte Match...",
    status_connected:"Status: verbunden",status_disconnected:"Status: getrennt",
    custom_unit:"Benutzerdefinierte Einheit",spell:"Zauber",reveal_all:"👁 Alle aufdecken",tap_to_reveal:"Tippen zum Aufdecken",
    forged_to:"🔮 Verschmolzen ",upgraded_to:" verbessert auf Lv",
  },
  fr:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ COMBATTRE",forge:"🔮 FORGER",deck:"📋 DECK",upgrade:"⬆ AMÉLIORER",
    reset:"↺ RÉINITIALISER",howto:"❓ Comment jouer",settings:"⚙️ Réglages",quests:"📋 Quêtes",ranked:"🏆 Classement",
    welcome:"Bienvenue ! Votre deck de 4 cartes est votre armée. Touchez DECK pour le voir.",
    fight_tut:"Touchez COMBATTRE pour commencer. Vous drafterez 3 unités par tour.",
    draft_tut:"Choisissez 1 carte par tirage. Relancez si ça ne vous plaît pas.",
    scout_tut:"Reconnaissance ! Touchez pour révéler les choix de l'adversaire.",
    battle_tut:"COMBATTEZ ! Les unités se battent automatiquement. Observez et adaptez.",
    result_tut:"Gagnez 3 tours pour remporter le match. Bonne chance !",
    round_won:"TOUR GAGNÉ",round_lost:"TOUR PERDU",next_round:"TOUR SUIVANT",
    win:"VICTOIRE",lose:"DÉFAITE",menu:"← Retour",
    match_won:"MATCH GAGNÉ !🏆",match_lost:"MATCH PERDU",match_draw:"ÉGALITÉ",
    settings_saved:"Réglages enregistrés",share_copied:"📋 Lien copié !",share_failed:"Échec du partage",
    invalid_link:"Lien invalide",spell_added_share:"✓ Sort ajouté !",
    unit_added_share:"✓ Unité ajoutée !",spell_added_book:"Sort ajouté au grimoire !",
    unit_added_collection:"✓ Unité ajoutée à la collection",enter_concept:"Entrez d'abord un concept",
    max_level:"Niveau maximum atteint",need_fuse:"Besoin de 2 unités identiques pour fusionner",
    not_enough_coins:"Pas assez de pièces",quests_done:"🎁 Toutes les quêtes terminées ! +50 pièces bonus",
    host_disconnected:"Hôte déconnecté.",continue_vs_bot:"Continuer contre le bot",
    searching_opponent:"Recherche d'un adversaire humain...",opponent_found:"Adversaire trouvé ! Début du match...",
    status_connected:"Statut : connecté",status_disconnected:"Statut : déconnecté",
    custom_unit:"Unité Personnalisée",spell:"Sort",reveal_all:"👁 Tout révéler",tap_to_reveal:"Touchez pour révéler",
    forged_to:"🔮 Fondu ",upgraded_to:" amélioré au Nv",
  },
  ja:{
    title:"PROMPT SHOWDOWN",fight:"⚔️ 戦う",forge:"🔮 鍛造",deck:"📋 デッキ",upgrade:"⬆ 強化",
    reset:"↺ リセット",howto:"❓ 遊び方",settings:"⚙️ 設定",quests:"📋 クエスト",ranked:"🏆 ランク",
    welcome:"ようこそ！4枚のカードがあなたの軍隊です。デッキをタップして確認。",
    fight_tut:"戦うをタップして試合開始。各ラウンドで3ユニットをドラフト。",
    draft_tut:"各ドローから1枚選択。気に入らなければ再ロール。",
    scout_tut:"偵察！タップして相手の選択を公開。",
    battle_tut:"戦え！ユニットは自動で戦う。観察して次ラウンドに活かす。",
    result_tut:"3ラウンド勝利で試合勝利。幸運を！",
    round_won:"ラウンド勝利",round_lost:"ラウンド敗北",next_round:"次ラウンド",
    win:"勝利",lose:"敗北",menu:"← 戻る",
    match_won:"試合勝利！🏆",match_lost:"試合敗北",match_draw:"引き分け",
    settings_saved:"設定を保存しました",share_copied:"📋 リンクをコピーしました！",share_failed:"共有に失敗",
    invalid_link:"無効なリンク",spell_added_share:"✓ スペルを追加しました！",
    unit_added_share:"✓ ユニットを追加しました！",spell_added_book:"スペルを魔導書に追加しました！",
    unit_added_collection:"✓ ユニットをコレクションに追加しました",enter_concept:"まずコンセプトを入力してください",
    max_level:"最大レベルに達しました",need_fuse:"融合には同じユニットが2体必要です",
    not_enough_coins:"コインが足りません",quests_done:"🎁 全クエスト完了！+50ボーナスコイン",
    host_disconnected:"ホストが切断しました。",continue_vs_bot:"ボット対戦に移行",
    searching_opponent:"人間の対戦相手を検索中...",opponent_found:"対戦相手が見つかりました！試合開始...",
    status_connected:"ステータス: 接続済み",status_disconnected:"ステータス: 切断済み",
    custom_unit:"カスタムユニット",spell:"スペル",reveal_all:"👁 全て公開",tap_to_reveal:"タップして公開",
    forged_to:"🔮 融合 ",upgraded_to:" がLvに強化されました",
  },
};
function t(key){
  const lang=G.save?.settings?.lang||"en";
  return(STRINGS[lang]&&STRINGS[lang][key])||STRINGS.en[key]||key;
}

// Phase 38: Ad SDK abstraction — falls back to stub when no real SDK is loaded.
const FORGE_AD_MS=1000;

const AdSDK={
  loaded:false,
  sdk:null,
  async load(){
    // Real SDK would be loaded here (AdMob, ironSource, etc).
    // For now, stub is always used.
    this.loaded=true;
  },
  showRewarded(duration,onComplete){
    Analytics.track("ad_loaded",{type:"rewarded"});
    // Try real SDK if available (future: window.googleAdMob?.showRewarded).
    if(this.sdk&&this.sdk.showRewarded){
      this.sdk.showRewarded().then(()=>{
        Analytics.track("ad_complete",{type:"rewarded"});
        onComplete();
      }).catch(()=>{Analytics.track("ad_skip",{type:"rewarded"});showAdStub(duration,onComplete);});
    }else{
      showAdStub(duration,onComplete);
    }
  },
  showInterstitial(){
    Analytics.track("ad_loaded",{type:"interstitial"});
    if(this.sdk&&this.sdk.showInterstitial){
      this.sdk.showInterstitial().catch(()=>{});
    }
    // No stub for interstitial — just skip silently.
  },
};

// Phase 35: Analytics — anonymous, opt-out, local-first. No endpoint by default.
const Analytics={
  endpoint:null,
  installId:null,
  queue:[],
  init(){
    try{
      this.installId=localStorage.getItem("ps_install")||(crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random());
      localStorage.setItem("ps_install",this.installId);
    }catch(e){this.installId="anon";}
  },
  track(event,props={}){
    if(G.save?.analyticsOptOut)return;
    if(!this.endpoint)return; // no endpoint configured — don't queue
    this.queue.push({event,props,t:Date.now(),install:this.installId,ver:CURRENT_VERSION});
    this._flush();
  },
  _flush(){
    if(!this.endpoint||this.queue.length<10)return;
    try{if(navigator.sendBeacon(this.endpoint,JSON.stringify(this.queue)))this.queue=[];}catch(e){}
  },
  flushNow(){
    if(this.endpoint&&this.queue.length){
      try{if(navigator.sendBeacon(this.endpoint,JSON.stringify(this.queue)))this.queue=[];}catch(e){}
    }
  },
};
