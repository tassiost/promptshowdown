# Removed UI Features (archived for potential reuse)

## Tip of the Day
Removed from main menu. Was a daily-rotating tip shown in `#tipOfDay` div.

### HTML (was in index.html menu screen):
```html
<div id="tipOfDay" style="margin:6px 0;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:.75rem;color:var(--muted);text-align:center;max-width:280px;"></div>
```

### JS (was in ui.js menu()):
```js
const tipEl=$("tipOfDay");
if(tipEl){
  const tips=[
    "💡 Frontline units absorb damage — always bring one!",
    "💡 Carries deal high damage but need protection.",
    "💡 Support units heal — they keep your army alive.",
    "💡 Counter units dive enemy backlines to disrupt carries.",
    "💡 Reroll draft cards if you don't like the options (3 per match).",
    "💡 Win 3 rounds to take the match. Adapt between rounds!",
    "💡 In the Deck screen: tap a slot, then tap a unit to fill it.",
    "💡 Drag collection units onto loadout slots to swap them in.",
    "💡 Fuse duplicate units to level them up (+10% HP/DMG per level).",
    "💡 Upgrade units with coins to boost their stats permanently.",
    "💡 Check the Codex to learn about abilities and roles.",
    "💡 Win streaks give bonus coins — don't break the streak!",
    "💡 Spells can turn the tide — tap the spell bar to cast.",
    "💡 Hard mode gives tougher enemies but the same rewards.",
    "💡 Endless mode starts after clearing all arenas.",
    "💡 Press P to pause, 1/2/3 for speed, S to skip in battle.",
    "💡 A balanced loadout has frontline + carry + support.",
    "💡 Lifesteal units heal themselves — great for carries.",
    "💡 Taunt forces enemies to attack your tank instead of carries.",
    "💡 Executioner deals 3× damage to low-HP enemies.",
    "💡 Ramp units get stronger with each kill.",
    "💡 Chain lightning hits 3 enemies — great vs clusters.",
    "💡 Survivors carry over between rounds — keep them alive!",
    "💡 The Forge lets you create custom units with AI. Try it!",
  ];
  const dayIdx=new Date().getDate();
  tipEl.innerHTML=tips[dayIdx%tips.length];
}
```

## Unit Spotlight
Removed from main menu. Was a daily-rotating featured unit shown in `#unitSpotlight` div.

### HTML (was in index.html menu screen):
```html
<div id="unitSpotlight" style="display:none;margin:6px 0;padding:8px 12px;background:var(--card);border:1px solid var(--accent);border-radius:var(--radius-sm);font-size:.72rem;text-align:center;max-width:280px;"></div>
```

### JS (was in ui.js menu()):
```js
const spotEl=$("unitSpotlight");
if(spotEl){
  const coll=this.collectionUnits();
  if(coll.length>0){
    const dayIdx=new Date().getDate();
    const featured=coll[dayIdx%coll.length];
    const mastery=this.save.unitMastery?.[featured.n];
    const masteryText=mastery&&mastery.kills>0?` · ${mastery.kills} kills`:"";
    const abIcons={none:"",splash:"💥",heal:"💚",dodge:"💨",poison:"☠️",spawn:"✨",lifesteal:"🩸",explode:"💣",heal_burst:"💖",shield:"🛡️",rage:"😤",slow:"🐌",ramp:"📈",thorns:"🌵",blink_strike:"⚡",frenzy:"🔥",regen:"🌿",cleanse:"🧹",taunt:"📣",executioner:"🗡️",chain_lightning:"🌩️"};
    const abIcon=abIcons[featured.ability]||"";
    const abText=featured.ability&&featured.ability!=="none"?`${abIcon} ${featured.ability}`:"No ability";
    spotEl.style.display="block";
    spotEl.innerHTML=`<span style="color:var(--accent);font-weight:700;">⭐ Unit Spotlight:</span> `+
      `<span style="color:${featured.c};font-weight:700;">${featured.n}</span> `+
      `<span style="color:var(--muted);">(${featured.role||"unknown"}) · ${featured.h} HP · ${featured.d} DMG · ${abText}${masteryText}</span>`;
  }else{
    spotEl.style.display="none";
  }
}
```

## Tier List
Removed from main menu button + screen. Was a power-score-based tier ranking (S/A/B/C).

### HTML (was in index.html):
```html
<!-- Menu button -->
<button class="btn" onclick="G.tierList()" aria-label="View the tier list">📊 TIER LIST</button>

<!-- Screen -->
<div class="screen" id="tierlist">
<h2>📊 Unit Tier List</h2>
<div style="display:flex;gap:4px;justify-content:center;margin:8px 0;flex-wrap:wrap;">
<button class="btn primary" onclick="G.tierListTab('all')" id="tierTabAll" style="font-size:.75rem;padding:4px 10px;">All</button>
<button class="btn" onclick="G.tierListTab('collection')" id="tierTabCollection" style="font-size:.75rem;padding:4px 10px;">Owned</button>
</div>
<div id="tierContent" style="max-width:380px;margin:0 auto;"></div>
<button class="btn" onclick="G.menu()" style="margin-top:12px;">← Back</button>
</div>
```

### JS (was in ui.js):
```js
_tierTab:"all",
tierList(){
  this.screen("tierlist");
  this.tierListTab(this._tierTab);
},
tierListTab(tab){
  this._tierTab=tab;
  for(const t of ["all","collection"]){
    const btn=$("tierTab"+t.charAt(0).toUpperCase()+t.slice(1));
    if(btn)btn.className="btn"+(t===tab?" primary":"");
  }
  const el=$("tierContent");
  if(!el)return;
  let units;
  if(tab==="collection"){
    units=this.collectionUnits();
  }else{
    units=[...this.base.map(u=>({...u})),...(this.save.collection||[]).map(u=>({...u}))];
    const seen=new Set();units=units.filter(u=>{if(seen.has(u.n))return false;seen.add(u.n);return true;});
  }
  const scored=units.map(u=>{
    const lvl=this.unitLevel(u.n);
    const hp=u.h*(1+0.1*lvl);
    const dmg=u.d*(1+0.1*lvl);
    let score=hp*0.5+dmg*2+u.r*0.3+u.s*0.2+u.a*5+(u.crit||0)*20;
    const abBonus={none:0,splash:15,heal:20,dodge:25,poison:15,spawn:20,lifesteal:20,explode:15,heal_burst:20,shield:25,rage:20,slow:10,ramp:25,thorns:15,blink_strike:25,frenzy:20,regen:15,cleanse:15,taunt:20,executioner:25,chain_lightning:25};
    score+=abBonus[u.ability]||0;
    score+=u.rar==="legendary"?30:u.rar==="rare"?15:0;
    return {u,score:Math.round(score),lvl};
  }).sort((a,b)=>b.score-a.score);
  const n=scored.length;
  const sTier=n>0?Math.max(1,Math.ceil(n*0.15)):0;
  const aTier=n>0?Math.max(1,Math.ceil(n*0.40)):0;
  const bTier=n>0?Math.max(1,Math.ceil(n*0.70)):0;
  const tiers=[
    {label:"S",color:"#fbbf24",desc:"Top tier — exceptional stats and abilities"},
    {label:"A",color:"#34d399",desc:"Strong picks — great value"},
    {label:"B",color:"#60a5fa",desc:"Solid picks — viable in most comps"},
    {label:"C",color:"#94a3b8",desc:"Situational — needs the right comp"},
  ];
  let html="";
  for(let t=0;t<tiers.length;t++){
    const start=t===0?0:t===1?sTier:t===2?aTier:bTier;
    const end=t===0?sTier:t===1?aTier:t===2?bTier:n;
    const tierUnits=scored.slice(start,end);
    if(tierUnits.length===0)continue;
    html+=`<div style="margin:10px 0;">`+
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">`+
      `<span style="background:${tiers[t].color};color:#000;font-weight:900;font-size:1rem;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;">${tiers[t].label}</span>`+
      `<span style="font-size:.7rem;color:var(--muted);">${tiers[t].desc}</span></div>`;
    for(let i=0;i<tierUnits.length;i++){
      const {u,score,lvl}=tierUnits[i];
      const abLabel=u.ability&&u.ability!=="none"?`<span style="color:var(--accent2);font-size:.65rem;">${u.ability}</span>`:"";
      const lvlBadge=lvl>0?`<span class="lvlBadge">Lv${lvl}</span>`:"";
      html+=`<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;margin:3px 0;cursor:pointer;" onclick="G.showUnitDetail(this._unitData)" id="tierUnit_${start+i}">`+
        `<span style="color:${u.c};font-weight:700;font-size:.8rem;flex:1;">${u.n}${lvlBadge}</span>`+
        `${abLabel}`+
        `<span style="font-size:.65rem;color:var(--muted);">${u.h}HP ${u.d}DMG</span>`+
        `<span style="font-size:.7rem;font-weight:700;color:${tiers[t].color};">${score}</span></div>`;
    }
    html+="</div>";
  }
  el.innerHTML=html;
  for(let i=0;i<scored.length;i++){
    const el2=document.getElementById("tierUnit_"+i);
    if(el2)el2._unitData=scored[i].u;
  }
},
```
