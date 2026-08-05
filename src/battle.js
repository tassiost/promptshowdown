// Phase 2 + Phase 3: dedicated Battle object — owns combat state + simulation.
// G orchestrates menus/save/AI/network and delegates battle to this.
// Phase 3 adds: projectiles (ranged), collision separation, crits,
// status effects (poison/slow/stun), and abilities (splash/heal/dodge/poison).
const RANGED_THRESHOLD=80;
// Phase 23: Spell system — one-shot battlefield effects.
const SPELL_ENUM={
  trigger:["battle_start","on_first_contact","delayed_3s","when_ally_hurt","periodic_5s"],
  target:["enemy_cluster","enemy_frontline","enemy_backline","enemy_carry","lowest_hp_enemy","highest_hp_enemy","random_enemy","center","ally_cluster","lowest_ally"],
  effect:["damage","damage_over_time","slow","stun","silence","stealth","heal_allies","heal_over_time","shield_allies","summon","knockback","buff_dmg","buff_speed"],
  shape:["point","circle_aoe","line","cone","persistent_zone"],
  fxType:["explosion","frost","lightning","poison_cloud","heal_glow","shockwave","fire_wall"],
};
// Phase 23: spell target resolution — returns {x,y} anchor point.
// PERF-R13: optimized to avoid O(n²) nested filter+dist in cluster targeting.
const SPELL_TARGET={
  enemy_cluster(team,b){
    // PERF-R13: grid-based cluster counting (O(n)) instead of O(n²) filter+dist.
    const cellSize=80,grid=new Map();
    let count=0;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      count++;
      const k=Math.floor(u.x/cellSize)+","+Math.floor(u.y/cellSize);
      grid.set(k,(grid.get(k)||0)+1);
    }
    if(!count)return null;
    let best=null,bestCount=0;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      const cx=Math.floor(u.x/cellSize),cy=Math.floor(u.y/cellSize);
      let c=0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const v=grid.get((cx+dx)+","+(cy+dy));
        if(v)c+=v;
      }
      if(c>bestCount){bestCount=c;best=u;}
    }
    return best||b.units.find(u=>u.h>0&&u.team!==team);
  },
  enemy_frontline(team,b){
    // PERF-R13: single-pass loop (avoid filter + reduce).
    let best=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      if(!best)best=u;
      else if(team==="player"?u.y<best.y:u.y>best.y)best=u;
    }
    return best;
  },
  enemy_backline(team,b){
    // PERF-R13: single-pass loop (avoid filter + reduce).
    let best=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      if(!best)best=u;
      else if(team==="player"?u.y>best.y:u.y<best.y)best=u;
    }
    return best;
  },
  enemy_carry(team,b){
    // PERF-R13: single-pass loop (avoid 2 filter calls).
    let carry=null,first=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      if(!first)first=u;
      if(u.role==="carry"){carry=u;break;}
    }
    return carry||first||null;
  },
  lowest_hp_enemy(team,b){
    // PERF-R13: single-pass loop (avoid filter + reduce).
    let best=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      if(!best||u.h<best.h)best=u;
    }
    return best;
  },
  highest_hp_enemy(team,b){
    // PERF-R13: single-pass loop (avoid filter + reduce).
    let best=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team===team)continue;
      if(!best||u.h>best.h)best=u;
    }
    return best;
  },
  random_enemy(team,b){
    // PERF-R13: count loop (avoid filter allocation).
    let count=0;
    for(let i=0;i<b.units.length;i++){const u=b.units[i];if(u.h>0&&u.team!==team)count++;}
    if(!count)return null;
    let pick=randInt(0,count);
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h>0&&u.team!==team){if(pick===0)return u;pick--;}
    }
    return null;
  },
  center(team,b){return{x:200,y:275};},
  ally_cluster(team,b){
    // PERF-R13: grid-based cluster counting (O(n)) instead of O(n²) filter+dist.
    const cellSize=80,grid=new Map();
    let count=0;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team!==team)continue;
      count++;
      const k=Math.floor(u.x/cellSize)+","+Math.floor(u.y/cellSize);
      grid.set(k,(grid.get(k)||0)+1);
    }
    if(!count)return null;
    let best=null,bestCount=0;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team!==team)continue;
      const cx=Math.floor(u.x/cellSize),cy=Math.floor(u.y/cellSize);
      let c=0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const v=grid.get((cx+dx)+","+(cy+dy));
        if(v)c+=v;
      }
      if(c>bestCount){bestCount=c;best=u;}
    }
    return best||b.units.find(u=>u.h>0&&u.team===team);
  },
  lowest_ally(team,b){
    // PERF-R13: single-pass loop (avoid filter + reduce).
    let best=null;
    for(let i=0;i<b.units.length;i++){
      const u=b.units[i];
      if(u.h<=0||u.team!==team)continue;
      if(!best||u.h<best.h)best=u;
    }
    return best;
  },
};
// Phase 23: spell shape — returns list of affected units given anchor + spec.
const SPELL_SHAPE={
  point(anchor){return anchor&&anchor.h>0?[anchor]:[];},
  circle_aoe(anchor,spec,b){
    if(!anchor)return[];
    const ax=anchor.x??0,ay=anchor.y??0;
    // DET: DMath.hypot for cross-browser determinism.
    return b.units.filter(u=>u.h>0&&DMath.hypot(u.x-ax,u.y-ay)<(spec.radius||60));
  },
  line(anchor,spec,b,team){
    if(!anchor)return[];
    const ax=anchor.x??0,ay=anchor.y??0;
    // Line from caster side to target.
    const sx=team==="player"?40:360;
    const sy=ay;
    return b.units.filter(u=>{
      if(u.h<=0)return false;
      // Distance from point to line segment.
      const dx=ax-sx,dy=ay-sy;
      // DET: DMath.hypot for cross-browser determinism.
      const len=DMath.hypot(dx,dy)||1;
      const t=Math.max(0,Math.min(1,((u.x-sx)*dx+(u.y-sy)*dy)/(len*len)));
      const px=sx+t*dx,py=sy+t*dy;
      return DMath.hypot(u.x-px,u.y-py)<(spec.radius||40);
    });
  },
  cone(anchor,spec,b,team){
    if(!anchor)return[];
    const ax=anchor.x??0,ay=anchor.y??0;
    const sx=team==="player"?40:360;
    const sy=ay;
    const dirX=ax-sx,dirY=ay-sy;
    // DET: DMath.hypot for cross-browser determinism.
    const dirLen=DMath.hypot(dirX,dirY)||1;
    const ux=dirX/dirLen,uy=dirY/dirLen;
    return b.units.filter(u=>{
      if(u.h<=0)return false;
      const dx=u.x-sx,dy=u.y-sy;
      const d=DMath.hypot(dx,dy);
      if(d>(spec.radius||80))return false;
      const dot=(dx*ux+dy*uy)/(d||1);
      return dot>0.5; // ~60-degree cone
    });
  },
  persistent_zone(anchor,spec,b,team){
    // Register a zone — returns [] (effect applied via zone ticking).
    if(!anchor)return[];
    b.zones.push({
      x:anchor.x??0,y:anchor.y??0,
      radius:spec.radius||60,duration:spec.duration||3,
      maxDuration:spec.duration||3,spec,team,fired:0
    });
    return [];
  },
};
// Phase 23: spell effect — applies the effect to affected units.
// PERF-R13: pooled synth for lastAttacker (avoid per-hit object allocation).
const _spellSynth={team:"",n:"Spell",id:"",h:1,mh:1,d:0,baseD:0,r:0,x:0,y:0,role:"",crit:0,ability:"none",dmgDealt:0};
// UNIFY: shared spell minion spawn (used by SPELL_EFFECT.summon and tickZones).
function _spawnSpellMinion(battle,team,x,y,attackerRef){
  if(battle.units.length>=100)return; // Cap total units to prevent memory issues
  const minion=unit({n:"Spell Minion",h:30,d:8,r:25,s:60,a:1,c:"#fa4",
    targeting:"closest",movement:"chase",attackCondition:"always",
    abilityTrigger:"never",moveSpeedMod:100,ability:"none",role:"frontline"});
  minion.team=team;
  minion.x=x+randRange(-20,20);
  minion.y=y+randRange(-20,20);
  minion.ttl=8;
  minion.lastAttacker=attackerRef;
  battle.units.push(battle.initRuntime(minion));
  BattleFX.onSpawn(minion);
}
const SPELL_EFFECT={
  damage(units,spec,team){_spellSynth.team=team;_spellSynth.id=team+"_spell";units.forEach(u=>{const dmg=spec.magnitude||30;u.h-=dmg;u.lastAttacker=_spellSynth;if(Battle.running)Battle.spawnDmgNum(u.x,u.y-u.z-8,Math.round(dmg),u.team,false,"spell");});},
  damage_over_time(units,spec,team){_spellSynth.team=team;_spellSynth.id=team+"_spell";units.forEach(u=>{u.poison=Math.max(u.poison,spec.duration||3);u.poisonDmg=Math.max(u.poisonDmg||0,spec.magnitude||10);u.poisonTick=0;u.lastAttacker=_spellSynth;u.poisonAttacker=_spellSynth;});},
  slow(units,spec){units.forEach(u=>{u.slow=Math.max(u.slow,spec.duration||2);});},
  stun(units,spec){units.forEach(u=>{u.stun=Math.max(u.stun,spec.duration||1);});},
  heal_allies(units,spec){units.forEach(u=>{const heal=spec.magnitude||30;u.h=Math.min(u.mh,u.h+heal);if(Battle.running)Battle.spawnDmgNum(u.x,u.y-u.z-8,"+"+Math.round(heal),u.team,false);});},
  heal_over_time(units,spec){units.forEach(u=>{u.regen=Math.max(u.regen||0,spec.duration||3);u.regenAmt=Math.max(u.regenAmt||0,spec.magnitude||10);u.regenTick=0;});},
  shield_allies(units,spec){units.forEach(u=>{u.shieldActive=Math.max(u.shieldActive,spec.duration||2);});},
  summon(units,spec,team,b){
    _spellSynth.team=team;_spellSynth.id=team+"_spell";
    const count=Math.min(spec.magnitude>40?3:spec.magnitude>20?2:1,3);
    const anchor=units[0]||{x:team==="player"?100:300,y:300};
    for(let i=0;i<count;i++)_spawnSpellMinion(b,team,anchor.x,anchor.y,_spellSynth);
  },
  knockback(units,spec,team,b){
    const anchor=units[0];
    if(!anchor)return;
    const ax=anchor.x,ay=anchor.y;
    units.forEach(u=>{
      const dx=u.x-ax,dy=u.y-ay;
      // DET: DMath.hypot for cross-browser determinism.
      const d=DMath.hypot(dx,dy)||1;
      const force=spec.magnitude||30;
      u.x+=dx/d*force;u.y+=dy/d*force;
    });
  },
  buff_dmg(units,spec){units.forEach(u=>{u._buffDmgApplied=Math.max(u._buffDmgApplied||1,1+(spec.magnitude||20)/100);const buffed=Math.round((u.baseD||u.d)*u._buffDmgApplied);u.d=Math.max(u.d,buffed);});},
  buff_speed(units,spec){units.forEach(u=>{u._buffSpeedApplied=Math.max(u._buffSpeedApplied||0,spec.magnitude||20);u.moveSpeedMod=Math.max(u.moveSpeedMod||100,100+u._buffSpeedApplied);});},
  // C1: silence — prevent target units from using abilities for a duration.
  silence(units,spec){const dur=spec.duration||3;units.forEach(u=>{u.silence=Math.max(u.silence||0,dur);if(Battle.running)Battle.spawnDmgNum(u.x,u.y-u.z-8,"🔇",u.team,false);});},
  // C2: stealth — make allied units untargetable by single-target attacks for a duration.
  stealth(units,spec){const dur=spec.duration||3;units.forEach(u=>{u.stealth=Math.max(u.stealth||0,dur);if(Battle.running)Battle.spawnDmgNum(u.x,u.y-u.z-8,"👁️",u.team,false);});},
};
// Phase 23: Spell object — resolves a spell spec into an effect at battle time.
const Spell={
  fire(spec,team,battle){
    if(!spec||!spec.effect||!spec.target)return;
    // Validate spell shape/effect/target exist in their enums.
    if(!SPELL_EFFECT[spec.effect]){console.warn("Unknown spell effect:",spec.effect);return;}
    if(!SPELL_TARGET[spec.target]){console.warn("Unknown spell target:",spec.target);return;}
    if(spec.shape&&!SPELL_SHAPE[spec.shape]){console.warn("Unknown spell shape:",spec.shape);return;}
    const anchor=SPELL_TARGET[spec.target]?.(team,battle);
    if(!anchor&&spec.shape!=="persistent_zone")return;
    let affected=[];
    if(spec.shape==="line"||spec.shape==="cone"){
      affected=SPELL_SHAPE[spec.shape](anchor,spec,battle,team);
    }else if(spec.shape==="persistent_zone"){
      affected=SPELL_SHAPE.persistent_zone(anchor||{x:200,y:275},spec,battle,team);
    }else{
      affected=SPELL_SHAPE[spec.shape]?.(anchor,spec,battle)||[];
    }
    // For ally-targeting effects, filter to allies only.
    if(spec.target.startsWith("ally")||spec.target==="lowest_ally"){
      affected=affected.filter(u=>u.team===team);
    }else{
      // All other targets (enemy_*, center, etc.) default to enemies only.
      affected=affected.filter(u=>u.team!==team);
    }
    if(spec.shape!=="persistent_zone"){
      SPELL_EFFECT[spec.effect]?.(affected,spec,team,battle);
    }
    BattleFX.onSpell(spec,anchor,affected,team);
    GameAudio.sfx("spell_"+(spec.fxType==="explosion"?"fire":spec.fxType==="frost"?"frost":spec.fxType==="lightning"?"lightning":"fire"));
    Quests.track("spell_use");
    // Bug #7: In P2P, the host runs the simulation. When a spell fires for
    // the guest's team ("enemy" from host's perspective), notify the guest
    // so they can track spell_use quests too.
    if(connected&&role==="host"&&team==="enemy"){
      transmit("spell_used",{name:spec.name});
    }
  },
  // Phase 23: check trigger conditions each frame.
  checkTriggers(battle,dt){
    if(!battle.spells)return;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let si=0;si<battle.spells.length;si++){
      const entry=battle.spells[si];
      if(entry.fired&&entry.spec.trigger!=="periodic_5s")continue;
      const team=entry.team;
      // PERF-R12: build allies/enemies arrays once per spell check (avoid 2× filter).
      // Most triggers only need a boolean check, so we can short-circuit.
      let fire=false;
      switch(entry.spec.trigger){
        case "battle_start":fire=battle.time<0.1;break;
        case "on_first_contact":{
          // PERF-R12: single-pass contact check (avoid building allies/enemies arrays).
          fire=false;
          outer:for(let ui=0;ui<battle.units.length;ui++){
            const a=battle.units[ui];
            if(a.h<=0||a.team!==team)continue;
            for(let ei=0;ei<battle.units.length;ei++){
              const e=battle.units[ei];
              if(e.h<=0||e.team===team)continue;
              if((a.x-e.x)*(a.x-e.x)+(a.y-e.y)*(a.y-e.y)<6400){fire=true;break outer;}
            }
          }
          break;
        }
        case "delayed_3s":fire=battle.time>=3;break;
        case "when_ally_hurt":{
          // PERF-R12: single-pass check (avoid filter + some).
          fire=false;
          for(let ui=0;ui<battle.units.length;ui++){
            const a=battle.units[ui];
            if(a.h>0&&a.team===team&&a.h<a.mh*0.5){fire=true;break;}
          }
          break;
        }
        case "periodic_5s":
          if(battle.time-(entry.lastFire||0)>=5){fire=true;entry.lastFire=battle.time;}
          break;
      }
      if(fire){
        this.fire(entry.spec,team,battle);
        entry.fired=true;
        if(entry.spec.trigger==="periodic_5s"){entry.fired=false;}
      }
    }
  },
  // Phase 23: tick persistent zones each frame.
  tickZones(battle,dt){
    if(!battle.zones)return;
    // PERF-R13: pooled synth for lastAttacker (avoid per-hit object allocation).
    if(!this._zoneSynth)this._zoneSynth={team:"",n:"Spell",id:"",h:1,mh:1,d:0,baseD:0,r:0,x:0,y:0,role:"",crit:0,ability:"none",dmgDealt:0};
    const synth=this._zoneSynth;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let zi=0;zi<battle.zones.length;zi++){
      const z=battle.zones[zi];
      z.duration-=dt;
      z.fired=(z.fired||0)+dt;
      // Apply effect once per second.
      if(z.fired>=1){
        z.fired=0;
        // PERF-R12: single-pass filter by team (avoid 2× filter + Math.hypot).
        const zr2=z.radius*z.radius;
        const tgt=z.spec.target||"enemy";
        const allyZone=tgt.startsWith("ally");
        // PERF-R12: reuse array (avoid per-tick allocation).
        if(!this._zoneAffected)this._zoneAffected=[];
        const aff=this._zoneAffected;
        aff.length=0;
        for(let ui=0;ui<battle.units.length;ui++){
          const u=battle.units[ui];
          if(u.h<=0)continue;
          const dx=u.x-z.x,dy=u.y-z.y;
          if(dx*dx+dy*dy>=zr2)continue;
          if(allyZone?u.team===z.team:u.team!==z.team)aff.push(u);
        }
        // Update pooled synth for this zone (reused across all affected units).
        synth.team=z.team;synth.id=z.team+"_spell";
        if(z.spec.effect==="damage"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];const dmg=z.spec.magnitude||10;u.h-=dmg;u.lastAttacker=synth;if(Battle.running)Battle.spawnDmgNum(u.x,u.y-u.z-8,Math.round(dmg),u.team,false,"spell");}
        }else if(z.spec.effect==="damage_over_time"){
          // Apply poison status (DoT) — uses Math.max to avoid overwriting higher poison.
          // BUG-R15: set poisonAttacker so poison kills attribute to the spell, not last melee hitter.
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.poison=Math.max(u.poison||0,z.spec.duration||3);u.poisonDmg=Math.max(u.poisonDmg||0,z.spec.magnitude||10);u.poisonTick=0;u.lastAttacker=synth;u.poisonAttacker=synth;}
        }else if(z.spec.effect==="slow"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.slow=Math.max(u.slow,z.spec.duration||2);}
        }else if(z.spec.effect==="heal_allies"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.h=Math.min(u.mh||u.h,u.h+(z.spec.magnitude||10));}
        }else if(z.spec.effect==="heal_over_time"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.regen=Math.max(u.regen||0,z.spec.duration||3);u.regenAmt=Math.max(u.regenAmt||0,z.spec.magnitude||10);u.regenTick=0;}
        }else if(z.spec.effect==="shield_allies"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.shieldActive=Math.max(u.shieldActive,z.spec.duration||2);}
        }else if(z.spec.effect==="stun"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.stun=Math.max(u.stun,z.spec.duration||1);}
        }else if(z.spec.effect==="silence"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.silence=Math.max(u.silence||0,z.spec.duration||3);}
        }else if(z.spec.effect==="stealth"){
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.stealth=Math.max(u.stealth||0,z.spec.duration||3);}
        }else if(z.spec.effect==="buff_dmg"){
          // Use Math.max to prevent stacking: only apply if unit hasn't been buffed yet.
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u._buffDmgApplied=Math.max(u._buffDmgApplied||1,1+(z.spec.magnitude||20)/100);const buffed=Math.round((u.baseD||u.d)*u._buffDmgApplied);u.d=Math.max(u.d,buffed);}
        }else if(z.spec.effect==="buff_speed"){
          // Use Math.max to prevent stacking: only apply the highest buff.
          for(let ai=0;ai<aff.length;ai++){const u=aff[ai];u.moveSpeedMod=Math.max(u.moveSpeedMod||100,100+(z.spec.magnitude||20));}
        }else if(z.spec.effect==="summon"){
          // Summon minions in the zone (once per tick, capped at 3 per tick).
          const count=Math.min(z.spec.magnitude>40?3:z.spec.magnitude>20?2:1,3);
          for(let i=0;i<count;i++)_spawnSpellMinion(battle,z.team,z.x,z.y,synth);
        }else if(z.spec.effect==="knockback"){
          // Push units away from zone center.
          for(let ai=0;ai<aff.length;ai++){
            const u=aff[ai];
            const dx=u.x-z.x,dy=u.y-z.y;
            // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
            // DET: DMath.sqrt for cross-browser determinism (zone knockback moves units).
            const d=DMath.sqrt(dx*dx+dy*dy)||1;
            const force=z.spec.magnitude||30;
            u.x+=dx/d*force;u.y+=dy/d*force;
          }
        }
        // FX particles for zone.
        BattleFX.spellZone(z);
      }
      if(z.duration<=0)z._remove=true;
    }
    // PERF-R12: in-place compaction (avoids filter array allocation).
    let zw=0;
    for(let i=0;i<battle.zones.length;i++){
      const z=battle.zones[i];
      if(!z._remove){
        if(zw!==i)battle.zones[zw]=z;
        zw++;
      }
    }
    battle.zones.length=zw;
  },
};

// R17: hoisted spell bar constants (were allocated every 0.5s in _renderSpellBar).
const SPELL_FX_ICONS={explosion:"💥",frost:"❄️",lightning:"⚡",poison_cloud:"☠️",heal_glow:"💚",shockwave:"🌊",fire_wall:"🔥"};
const SPELL_EFFECT_LABELS={damage:"Damage",damage_over_time:"DoT",slow:"Slow",stun:"Stun",silence:"Silence",stealth:"Stealth",heal_allies:"Heal",heal_over_time:"HoT",shield_allies:"Shield",summon:"Summon",knockback:"Knockback",buff_dmg:"Buff DMG",buff_speed:"Buff Speed"};

const Battle={
  units:[],          // Phase 10: single array (was units + enemies)
  projectiles:[],
  particles:[],      // Phase 17: particle system (capped at MAX_PARTICLES)
  shakeAmount:0,     // Phase 17: screen shake amount (decays)
  roundFlash:null,   // Phase 17: round-end flash {t,dur,c}
  time:0,
  running:false,
  winner:null,
  ctx:null,
  frame:0,
  last:0,
  canvasH:550,       // Phase 10: for hold_midpoint movement (CSS pixels)
  canvasW:400,       // CSS pixel width for clamping (not raw canvas.width which includes DPR)
  // Game coordinate space — units are positioned in this virtual space.
  // The canvas fills the full viewport; this transform maps game space to screen.
  GAME_W:400,
  GAME_H:550,
  // TOUCH: zoom/pan state for pinch-to-zoom and drag-to-pan.
  _zoom:1,           // zoom multiplier (1 = fit, 2 = 2× zoom)
  _panX:0,           // pan offset in game-space pixels
  _panY:0,
  _maxZoom:3,        // max zoom level
  // Compute the "contain" transform: fit game space within viewport, center.
  // The background fills the full screen; game content is letterboxed/pillarboxed.
  // Returns {scale, offsetX, offsetY} in CSS pixels.
  _gameTransform(){
    // PERF-R12: cache the transform — it only changes when canvas size changes.
    const vw=this.canvasW||innerWidth, vh=this.canvasH||innerHeight;
    // TOUCH: include zoom/pan in cache key so transform recalculates on zoom.
    if(this._gtCache&&this._gtCacheVW===vw&&this._gtCacheVH===vh&&
       this._gtCacheZ===this._zoom&&this._gtCachePX===this._panX&&this._gtCachePY===this._panY)
      return this._gtCache;
    const sx=vw/this.GAME_W, sy=vh/this.GAME_H;
    const baseScale=Math.min(sx,sy); // contain: fit within viewport
    // TOUCH: apply zoom multiplier + pan offset.
    const scale=baseScale*this._zoom;
    const baseOffsetX=(vw-this.GAME_W*baseScale)/2;
    const baseOffsetY=(vh-this.GAME_H*baseScale)/2;
    // Pan offsets are in game-space, convert to screen-space (use full scale with zoom).
    const offsetX=baseOffsetX+this._panX*scale;
    const offsetY=baseOffsetY+this._panY*scale;
    this._gtCache={scale,offsetX,offsetY};
    this._gtCacheVW=vw;this._gtCacheVH=vh;
    this._gtCacheZ=this._zoom;this._gtCachePX=this._panX;this._gtCachePY=this._panY;
    return this._gtCache;
  },
  // Convert screen (CSS pixel) coordinates to game-space coordinates (for click detection).
  screenToGame(sx,sy){
    const t=this._gameTransform();
    return {x:(sx-t.offsetX)/t.scale, y:(sy-t.offsetY)/t.scale};
  },
  // TOUCH: reset zoom/pan to default (double-tap or battle start).
  _resetZoomPan(){
    this._zoom=1;this._panX=0;this._panY=0;
    this._gtCache=null; // invalidate cache
  },
  // TOUCH: clamp pan so the game area doesn't go completely off-screen.
  _clampPan(){
    const vw=this.canvasW||innerWidth, vh=this.canvasH||innerHeight;
    const sx=vw/this.GAME_W, sy=vh/this.GAME_H;
    const baseScale=Math.min(sx,sy);
    // Max pan = half the zoomed overflow in each direction.
    const maxX=(this.GAME_W*(this._zoom-1))/2;
    const maxY=(this.GAME_H*(this._zoom-1))/2;
    this._panX=Math.max(-maxX,Math.min(maxX,this._panX));
    this._panY=Math.max(-maxY,Math.min(maxY,this._panY));
  },
  onEnd:null,        // (winner:"player"|"enemy"|"draw")=>void
  autoTimer:null,
  speed:1,           // battle speed multiplier (1, 2, 4)
  paused:false,      // battle paused flag
  damageNums:[],     // floating damage numbers {x,y,val,life,team,crit}
  spells:[],         // Phase 23: active spell entries {spec,team,fired,lastFire}
  zones:[],          // Phase 23: persistent spell zones
  playerSpells:[],   // manually-castable player spells {spec, cooldown, maxCD}
  debug:false,       // toggle battle debug logging
  _debugT:0,         // debug log accumulator
  bgTheme:"forest",  // arena background theme
  bgImage:null,      // optional loaded background Image (future sprite backgrounds)
  _bgParticles:[],   // ambient background particles (embers, snow, spores, etc.)

  // Attach runtime-only combat fields to a unit (not persisted).
  initRuntime(u){
    u.cool=0;          // attack cooldown
    u.abCool=0;        // ability cooldown
    u.poison=0;        // poison remaining seconds
    u.poisonTick=0;    // poison damage accumulator
    u.regen=0;         // regen remaining seconds (spell HoT)
    u.regenTick=0;     // regen heal accumulator
    u.slow=0;          // slow remaining seconds
    u.stun=0;          // stun remaining seconds
    u.mh=u.mh||u.h;    // max hp
    u.baseD=u.baseD||u.d; // Phase 20: base damage for ramp cap
    u._baseH=u._baseH||u.h; // PERF-R13: base HP for composition bonus (prevents compounding across rounds)
    u._baseSpd=u._baseSpd||u.s; // PERF-R13: base speed for composition bonus (prevents compounding)
    u._baseSpeedMod=u.moveSpeedMod||100; // base speed for buff_speed (prevents stacking)
    u.fxType=u.fxType||deriveFxType(u); // Phase 24e: cached aura type
    u.patrolT=0;       // Phase 10: patrol movement timer
    u.firstHitUsed=false; // Phase 10: on_first_hit flag
    u.hasBeenHit=false;   // Phase 10: has the unit been attacked?
    u.shieldActive=0;  // Phase 10: shield immunity timer
    u.silence=0;       // C1: silence timer (can't use abilities)
    u.stealth=0;       // C2: stealth timer (untargetable by single-target)
    u.deathT=undefined;// Phase 10: death animation timer
    u.ttl=u.ttl||0;    // Phase 10: minion time-to-live
    // Phase 11: animation runtime fields.
    u.animState="idle";   // idle|move|attack|death
    u.animT=0;            // normalized 0-1 time within current animation
    u.attackT=-1;         // attack animation trigger (set to 0 on attack, counts to 1)
    u.movedThisFrame=false;
    u.attackedThisFrame=false;
    u.prevX=u.x;          // for move detection
    u.prevY=u.y;
    // Phase 17: FX runtime fields.
    u.prevH=u.h;          // for hit flash detection
    u.spawnT=0;           // spawn pop-in animation (0->1 over 150ms)
    u.hitFlash=0;         // hit flash timer (counts down from 80ms)
    u.lungeT=0;           // attack lunge timer (counts down from 60ms)
    u.lungeDir={x:0,y:0}; // lunge direction
    u.abFlash=0;          // ability activation flash timer
    u.abFlashColor="#fff"; // ability flash color
    u.dmgDealt=0;         // total damage dealt (for MVP tracking)
    u.kills=0;            // kill count (for MVP tracking)
    return u;
  },

  // Team composition bonuses: rewards role diversity with stat bonuses.
  // PERF-R13: apply to base stats (stored in initRuntime) to prevent compounding
  // across rounds. Without this, a 20% HP bonus would compound to 488% over 5 rounds.
  applyCompositionBonuses(){
    const bonuses=this.calcCompositionBonuses(this.units.filter(u=>u.team==="player"));
    const enemyBonuses=this.calcCompositionBonuses(this.units.filter(u=>u.team==="enemy"));
    for(const u of this.units){
      const b=u.team==="player"?bonuses:enemyBonuses;
      const baseH=u._baseH||u.h;
      const baseD=u.baseD||u.d;
      const baseS=u._baseSpd||u.s;
      if(b.hpPct){u.h=Math.round(baseH*(1+b.hpPct));u.mh=u.h;}
      if(b.dmgPct)u.d=Math.round(baseD*(1+b.dmgPct));
      if(b.speedPct)u.s=Math.round(baseS*(1+b.speedPct));
    }
    this.playerBonuses=bonuses;
    this.enemyBonuses=enemyBonuses;
  },
  // C6: buff_aura — apply +20% damage and +10% speed to allies within 80px.
  // Called per-frame per-team. Uses squared distance (no sqrt). Refreshes each frame.
  _applyBuffAuras(team,dt){
    let hasAura=false;
    for(let i=0;i<team.length;i++){if(team[i].ability==="buff_aura"){hasAura=true;break;}}
    if(!hasAura)return;
    const AURA_R2=80*80;
    for(let i=0;i<team.length;i++){
      const u=team[i];
      if(u.ability!=="buff_aura")continue;
      for(let j=0;j<team.length;j++){
        const a=team[j];
        if(a===u)continue;
        const dx=a.x-u.x,dy=a.y-u.y;
        if(dx*dx+dy*dy<=AURA_R2){
          a._auraDmg=Math.round((a.baseD||a.d)*1.2);
          a._auraSpeed=Math.round((a._baseSpeedMod||a.moveSpeedMod||100)*1.1);
          if(a.d<a._auraDmg)a.d=a._auraDmg;
          if((a.moveSpeedMod||100)<a._auraSpeed)a.moveSpeedMod=a._auraSpeed;
        }
      }
    }
  },
  calcCompositionBonuses(army){
    const roles=new Set();
    const abilities=new Set();
    for(const u of army){
      if(u.role)roles.add(u.role);
      if(u.ability&&u.ability!=="none")abilities.add(u.ability);
    }
    const bonuses={hpPct:0,dmgPct:0,speedPct:0,labels:[]};
    // Role diversity bonus: +3% HP per unique role (max 5 roles = 15% HP).
    const roleCount=roles.size;
    if(roleCount>=3){bonuses.hpPct+=0.03*(roleCount-2);bonuses.labels.push(`+${3*(roleCount-2)}% HP (role diversity)`);}
    // Frontline + Carry combo: +5% damage to carries.
    if(roles.has("frontline")&&roles.has("carry")){bonuses.dmgPct+=0.05;bonuses.labels.push("+5% DMG (frontline+carry)");}
    // Support present: +5% HP to all.
    if(roles.has("support")){bonuses.hpPct+=0.05;bonuses.labels.push("+5% HP (support)");}
    // Counter present: +5% speed to all.
    if(roles.has("counter")){bonuses.speedPct+=0.05;bonuses.labels.push("+5% SPD (counter)");}
    // Ability diversity: +2% damage per unique ability (max 4 = 8%).
    const abCount=abilities.size;
    if(abCount>=2){const abBonus=Math.min(0.08,0.02*(abCount-1));bonuses.dmgPct+=abBonus;bonuses.labels.push(`+${Math.round(abBonus*100)}% DMG (ability diversity)`);}
    // Healing synergy: heal + heal_burst = +5% HP.
    if(abilities.has("heal")&&abilities.has("heal_burst")){bonuses.hpPct+=0.05;bonuses.labels.push("+5% HP (double heal)");}
    // Tank + support: taunt + heal/shield = +10% HP.
    if(abilities.has("taunt")&&(abilities.has("heal")||abilities.has("shield"))){bonuses.hpPct+=0.10;bonuses.labels.push("+10% HP (tank+support)");}
    return bonuses;
  },

  // UNIFY: Single canvas context initialization used by all code paths.
  // Eliminates 3x duplication (start, renderOnly, renderDraftBattlefield).
  // Sizes the canvas to fill its container, creates an optimized 2D context,
  // and scales by DPR. Returns the context (or null on failure).
  // opts.skipClick: skip onclick handler (draft/guest paths don't need it).
  // opts.container: CSS selector for dimension source (default: #battle).
  _initCanvasContext(opts){
    opts=opts||{};
    const cv=$("cv");
    if(!cv)return null;
    const dpr=window.devicePixelRatio||1;
    const container=opts.container
      ?document.querySelector(opts.container)
      :document.getElementById("battle");
    const dispW=container?container.clientWidth:Math.min(420,innerWidth);
    const dispH=container?container.clientHeight:innerHeight;
    cv.style.width=dispW+"px";
    cv.style.height=dispH+"px";
    cv.width=Math.round(dispW*dpr);
    cv.height=Math.round(dispH*dpr);
    this.canvasH=dispH;
    this.canvasW=dispW;
    // PERF: alpha:false = opaque canvas (faster compositing, no alpha channel).
    // desynchronized:true = bypass DOM compositor queue (lower latency, Chrome).
    const ctx=cv.getContext("2d",{alpha:false,desynchronized:true});
    if(!ctx)return null;
    ctx.scale(dpr,dpr);
    this.ctx=ctx;
    // TOUCH: unified pointer handler — tap-to-inspect, pinch-to-zoom, drag-to-pan.
    if(!opts.skipClick){
      // Pointer state for multi-touch tracking.
      const pointers=new Map(); // pointerId → {x,y}
      let pinchDist=0,pinchZoom=1;
      let dragStartX=0,dragStartY=0,dragStartPanX=0,dragStartPanY=0;
      let tapStart=0,tapX=0,tapY=0,tapMoved=false;
      let lastTapTime=0; // for double-tap detection
      const TAP_THRESHOLD=10; // max movement to count as tap (px)
      const DOUBLE_TAP_MS=300; // max time between taps for double-tap
      const _findUnitAt=(sx,sy)=>{
        const gt=this._gameTransform();
        const x=(sx-gt.offsetX)/gt.scale;
        const y=(sy-gt.offsetY)/gt.scale;
        let closest=null,closestDist=Infinity;
        for(let i=0;i<this.units.length;i++){
          const u=this.units[i];
          if(u.h<=0)continue;
          const dx=u.x-x,dy=u.y-y;
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<closestDist&&d<u.z+10){closest=u;closestDist=d;}
        }
        return closest;
      };
      cv.onpointerdown=(e)=>{
        if(!this.running)return;
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===1){
          tapStart=Date.now();tapX=e.clientX;tapY=e.clientY;tapMoved=false;
          dragStartX=e.clientX;dragStartY=e.clientY;
          dragStartPanX=this._panX;dragStartPanY=this._panY;
        }else if(pointers.size===2){
          // Start pinch — record initial distance and zoom.
          const pts=[...pointers.values()];
          pinchDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
          pinchZoom=this._zoom;
          tapMoved=true; // cancel tap
        }
      };
      cv.onpointermove=(e)=>{
        if(!this.running||!pointers.has(e.pointerId))return;
        e.preventDefault();
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(pointers.size===1){
          const dx=e.clientX-dragStartX,dy=e.clientY-dragStartY;
          // Check if this is a tap (minimal movement) or a drag.
          if(!tapMoved&&Math.hypot(e.clientX-tapX,e.clientY-tapY)>TAP_THRESHOLD)tapMoved=true;
          if(tapMoved&&this._zoom>1){
            // Drag-to-pan (only when zoomed in).
            const gt=this._gameTransform();
            const baseScale=Math.min(this.canvasW/this.GAME_W,this.canvasH/this.GAME_H);
            this._panX=dragStartPanX+dx/baseScale;
            this._panY=dragStartPanY+dy/baseScale;
            this._clampPan();
            this._gtCache=null; // invalidate transform cache
          }
        }else if(pointers.size===2){
          // Pinch-to-zoom.
          const pts=[...pointers.values()];
          const newDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
          if(pinchDist>0){
            const ratio=newDist/pinchDist;
            this._zoom=Math.max(1,Math.min(this._maxZoom,pinchZoom*ratio));
            this._clampPan();
            this._gtCache=null; // invalidate transform cache
          }
        }
      };
      cv.onpointerup=(e)=>{
        if(!this.running)return;
        pointers.delete(e.pointerId);
        if(pointers.size<2)pinchDist=0;
        if(pointers.size===0){
          // Check if this was a tap (quick, minimal movement).
          const elapsed=Date.now()-tapStart;
          if(!tapMoved&&elapsed<500){
            const rect=cv.getBoundingClientRect();
            const sx=e.clientX-rect.left;
            const sy=e.clientY-rect.top;
            // Double-tap detection → reset zoom.
            if(Date.now()-lastTapTime<DOUBLE_TAP_MS){
              this._resetZoomPan();
              lastTapTime=0;
            }else{
              lastTapTime=Date.now();
              // Single tap → inspect unit.
              const closest=_findUnitAt(sx,sy);
              if(closest)this._showUnitInspector(closest);
              else this._hideUnitInspector();
            }
          }
        }
      };
      cv.onpointercancel=(e)=>{pointers.delete(e.pointerId);if(pointers.size<2)pinchDist=0;};
      cv.onwheel=(e)=>{
        if(!this.running)return;
        e.preventDefault();
        // Mouse wheel zoom (desktop).
        const delta=e.deltaY>0?0.9:1.1;
        this._zoom=Math.max(1,Math.min(this._maxZoom,this._zoom*delta));
        this._clampPan();
        this._gtCache=null;
      };
    }
    return ctx;
  },

  // Phase 10: single units array; team set on each unit.
  // Phase 23: accept spells arg {player:[],enemy:[]}.
  start(units,enemies,onEnd,spells){
    // PERF-R12: clear sprite cache on new battle (frees memory, handles new unit types).
    _clearSpriteCache();
    // DET: seed PRNG deterministically per round (seed + round offset).
    // Both peers share Match.seed; round offset keeps each round independent.
    seedBattle((Match.seed||0)+(Match.round||0));
    // Set team strings before initRuntime so hold_midpoint etc. work.
    this.units=[
      ...units.map(u=>({...u,team:"player"})),
      ...enemies.map(u=>({...u,team:"enemy"}))
    ].map(u=>this.initRuntime(u));
    // Track all units for cumulative draft (dead units are removed from this.units
    // after death animation, but we need them for revival between rounds).
    this._allUnits=this.units.map(u=>({...u}));
    // Apply team composition bonuses based on role diversity.
    this.applyCompositionBonuses();
    // Show composition bonuses on battle screen.
    this._renderCompBonus();
    // Initialize battle stats tracking.
    this._battleStats={playerDmg:0,enemyDmg:0,playerKills:0,enemyKills:0,peakDPS:0,dmgWindow:[]};
    this._killFeed=[]; // kill feed entries
    this._manualSpeed=false; // reset dramatic slowdown flag
    this._highlights={biggestHit:0,biggestHitBy:null,biggestHitTarget:null,biggestHitCrit:false};
    this._firstBlood=false; // first blood sound cue flag
    // Phase 17: trigger spawn FX for all units.
    for(const u of this.units)BattleFX.onSpawn(u);
    this.projectiles=[];
    // PERF-R12: clear projectile pool on battle start (avoid stale projectiles).
    if(this._projPool)this._projPool.length=0;
    this.particles=[];     // Phase 17: clear particles
    // PERF-R12: clear particle pool on battle start (avoid stale particles).
    _particlePool.length=0;
    this.shakeAmount=0;    // Phase 17: reset shake
    this.roundFlash=null;  // Phase 17: reset round flash
    this.recentCrits=[];   // Phase 17: clear crit tracking
    this._prevSnapshot=null; // Phase 17: clear snapshot diff state
    this._processedCrits=null; // Phase 17: clear processed crit tracking
    this.deathLog=[];      // Phase 16: clear death order log
    this.damageNums=[];    // clear floating damage numbers
    // PERF-R12: clear damage number pool on battle start (avoid stale objects).
    if(this._dmgPool)this._dmgPool.length=0;
    this.paused=false;     // reset pause flag
    // DET: fixed-timestep + lockstep state. _tick is the deterministic sim tick
    // counter (used to schedule commands). _accumulator buffers real frame time.
    this._accumulator=0;
    this._effectiveSpeed=1;
    this._tick=0;
    this._cmdBuffer=new Map();      // tick → array of commands
    this._peerConfirmedTick=null;   // latest tick the peer has acknowledged
    this._lockstepActive=false;     // set true when both peers run the sim
    this._desyncFallback=false;     // set true on hash mismatch → snapshot fallback
    _desyncState="synced";_desyncTick=null; // VOIDSTRIKE: reset desync state
    _clearCommandHistory(); // VOIDSTRIKE: clear command history for new battle
    this._useRelay=false;           // RELAY: host runs sim, guest renders from snapshots
    this._stallStart=null;          // DET: lockstep stall watchdog timestamp
    // DET: the local player's team in the sim. Host/solo → "player". Guest in
    // lockstep → "enemy" (the sim keeps the host's labeling on both peers so the
    // initial unit array + team tags are byte-identical → deterministic).
    this._localTeam=this._localTeam||"player";
    // Phase 23: init spells + zones.
    this.spells=[];
    this.zones=[];
    // Manually-castable player spells (each gets a cooldown).
    // DET: the manual cast list is the LOCAL player's spells (spells[_localTeam]),
    // so the guest in lockstep casts its own spells (team "enemy" in sim labeling).
    this.playerSpells=[];
    // DET: store both teams' manual spells for lockstep execution. When the host
    // casts a spell, the guest must fire the HOST's spell (team "player"), not its
    // own (team "enemy"). Without this, spellIdx maps to different spells on each
    // peer → wrong spell fires + wrong cooldown set → desync.
    this._allPlayerSpells={player:[],enemy:[]};
    if(spells){
      const localTeam=this._localTeam;
      for(const s of (spells[localTeam]||[])){
        // Auto-trigger spells go into the auto-fire list.
        this.spells.push({spec:s,team:localTeam,fired:false,lastFire:0});
        // Also add to manual cast list (player can cast anytime, subject to cooldown).
        const entry={spec:s,cooldown:0,maxCD:this._spellCooldown(s)};
        this.playerSpells.push(entry);
        this._allPlayerSpells[localTeam].push(entry);
      }
      // Auto-fire list also includes the opponent's spells (non-manual).
      for(const s of (spells.player||[]))if(localTeam!=="player")this.spells.push({spec:s,team:"player",fired:false,lastFire:0});
      for(const s of (spells.enemy||[]))if(localTeam!=="enemy")this.spells.push({spec:s,team:"enemy",fired:false,lastFire:0});
      // DET: build the remote team's manual spell list (for lockstep execution).
      const remoteTeam=localTeam==="player"?"enemy":"player";
      for(const s of (spells[remoteTeam]||[])){
        this._allPlayerSpells[remoteTeam].push({spec:s,cooldown:0,maxCD:this._spellCooldown(s)});
      }
    }
    this._renderSpellBar();
    this.time=0;
    this.running=true;
    this.winner=null;
    this.onEnd=onEnd||null;
    // Set background theme from current arena.
    const arena=G.arenas?.[G.save?.arena||0];
    this.bgTheme=arena?.bgTheme||"forest";
    this._bgParticles=[]; // clear ambient particles from previous battle
    this._weatherParticles=[]; // R2: clear weather particles from previous battle
    this._appliedSpeedBoost=false; // reset arena speed boost for new battle
    this._mechanicT=0; // reset arena mechanic timer for new battle
    // Apply speed_boost arena mechanic immediately at battle start (not delayed by 1s throttle).
    if(arena&&arena.mechanic==="speed_boost"){
      for(const u of this.units){
        if(!u._baseS)u._baseS=u.s; // store original speed to prevent compounding across rounds
        u.s=Math.round(u._baseS*1.2);
      }
      this._appliedSpeedBoost=true;
    }
    // UNIFY: use shared canvas init (eliminates duplicated sizing + getContext code).
    const ctx=this._initCanvasContext();
    if(!ctx){this.stop();return;}
    this.last=performance.now();
    cancelAnimationFrame(this.frame);
    if(!this._loopBound)this._loopBound=this.loop.bind(this);
    this.frame=requestAnimationFrame(this._loopBound);
  },

  // Phase 7: adaptive frame budget — 60fps desktop, ~30fps mobile (battery).
  targetFrameTime(){return isMobile?1/30:1/60;},
  _fpsFrames:0,_fpsAccum:0,

  // Arena mechanics: unique environmental effects per arena.
  _applyArenaMechanics(dt){
    if(!this.running)return;
    const arena=G.arenas?.[G.save?.arena||0];
    if(!arena||!arena.mechanic||arena.mechanic==="none")return;
    this._mechanicT=(this._mechanicT||0)+dt;
    // Apply effects every 1 second to avoid per-frame overhead.
    if(this._mechanicT<1)return;
    this._mechanicT=0;
    // PERF-R13: pooled environment synth (avoid per-death object allocation).
    if(!this._envSynth)this._envSynth={team:"environment",n:"Arena",id:"arena_hazard",h:1,mh:1,d:0,baseD:0,r:0,x:0,y:0,role:"",crit:0,ability:"none",dmgDealt:0};
    const envSynth=this._envSynth;
    if(arena.mechanic==="poison_aura"){
      // District Z: all units take 2 damage per second (poison environment).
      for(let ui=0;ui<this.units.length;ui++){
        const u=this.units[ui];
        if(u.h>0){
          u.h-=2;
          if(u.h<=0){u.h=0;u.lastAttacker=envSynth;this.onUnitDeath(u);}
        }
      }
    }else if(arena.mechanic==="speed_boost"){
      // Golden Goal: all units get +20% speed (faster-paced battles).
      // Applied once at battle start via _appliedSpeedBoost flag.
      if(!this._appliedSpeedBoost){
        for(let ui=0;ui<this.units.length;ui++){
          const u=this.units[ui];
          if(!u._baseS)u._baseS=u.s;
          u.s=Math.round(u._baseS*1.2);
        }
        this._appliedSpeedBoost=true;
      }
    }else if(arena.mechanic==="damage_aura"){
      // Void Rift: all units take 3 damage per second (brutal environment).
      for(let ui=0;ui<this.units.length;ui++){
        const u=this.units[ui];
        if(u.h>0){
          u.h-=3;
          if(u.h<=0){u.h=0;u.lastAttacker=envSynth;this.onUnitDeath(u);}
        }
      }
    }
  },

  // DET: deterministic state hash for desync detection.
  // Both peers compute this at round end; mismatch → fall back to snapshot sync.
  // Quantizes positions to 0.001 units and HP to integers so float noise
  // below the DMath rounding threshold (1e-6) doesn't cause false positives.
  // PERF-R13: exclude animState (render-only, can differ between peers at the
  // same tick due to render timing → false desync positives).
  stateHash(){
    // _finalUnits is snapshotted before stop() clears this.units; use it as the
    // authoritative source at round end so the hash is computable post-stop.
    const arr=(this.units&&this.units.length)?this.units:(this._finalUnits||[]);
    const snap=new Array(arr.length);
    for(let i=0;i<arr.length;i++){
      const u=arr[i];
      snap[i]={i:u.id,x:Math.round(u.x*1000),y:Math.round(u.y*1000),h:Math.round(u.h)};
    }
    return fnv1aHash(snap);
  },
  // VOIDSTRIKE: Merkle tree desync detection — O(log n) identification of
  // WHICH units diverged, not just that they diverged.
  // Tree: root → teams (player/enemy) → individual unit hashes.
  merkleTree(){
    const arr=(this.units&&this.units.length)?this.units:(this._finalUnits||[]);
    const playerNodes=[],enemyNodes=[];
    for(let i=0;i<arr.length;i++){
      const u=arr[i];
      // Per-unit hash: id + position + HP + cooldown + ability state.
      const unitHash=fnv1aHash({i:u.id,x:Math.round(u.x*1000),y:Math.round(u.y*1000),h:Math.round(u.h),cd:Math.round((u.cool||0)*100),ab:Math.round((u.abCool||0)*100)});
      const node={hash:unitHash,id:u.id,n:u.n,team:u.team,x:Math.round(u.x),y:Math.round(u.y),h:Math.round(u.h)};
      if(u.team==="player")playerNodes.push(node);
      else enemyNodes.push(node);
    }
    // Sort by ID for deterministic ordering.
    playerNodes.sort((a,b)=>a.id-b.id);
    enemyNodes.sort((a,b)=>a.id-b.id);
    const playerHash=fnv1aHash(playerNodes.map(n=>n.hash));
    const enemyHash=fnv1aHash(enemyNodes.map(n=>n.hash));
    const rootHash=fnv1aHash([playerHash,enemyHash]);
    return {root:rootHash,player:playerHash,enemy:enemyHash,playerNodes,enemyNodes};
  },
  // VOIDSTRIKE: find which units diverged between local and remote Merkle trees.
  findDivergence(localTree,remoteTree){
    const diverged=[];
    if(localTree.player!==remoteTree.player){
      const remoteMap=new Map();
      for(const n of remoteTree.playerNodes||[])remoteMap.set(n.id,n);
      for(const n of localTree.playerNodes||[]){
        const r=remoteMap.get(n.id);
        if(!r)diverged.push({id:n.id,team:"player",n:n.n,issue:"missing remotely",local:{x:n.x,y:n.y,h:n.h}});
        else if(n.hash!==r.hash)diverged.push({id:n.id,team:"player",n:n.n,issue:"state mismatch",local:{x:n.x,y:n.y,h:n.h},remote:{x:r.x,y:r.y,h:r.h}});
      }
    }
    if(localTree.enemy!==remoteTree.enemy){
      const remoteMap=new Map();
      for(const n of remoteTree.enemyNodes||[])remoteMap.set(n.id,n);
      for(const n of localTree.enemyNodes||[]){
        const r=remoteMap.get(n.id);
        if(!r)diverged.push({id:n.id,team:"enemy",n:n.n,issue:"missing remotely",local:{x:n.x,y:n.y,h:n.h}});
        else if(n.hash!==r.hash)diverged.push({id:n.id,team:"enemy",n:n.n,issue:"state mismatch",local:{x:n.x,y:n.y,h:n.h},remote:{x:r.x,y:r.y,h:r.h}});
      }
    }
    return diverged;
  },

  // DET: lockstep command buffer. Commands are scheduled for a future tick and
  // executed at the start of that tick's update(), so both peers apply them
  // identically. Keyed by tick number; freed after execution.
  queueCommand(cmd,tick){
    if(!this._cmdBuffer)this._cmdBuffer=new Map();
    let arr=this._cmdBuffer.get(tick);
    if(!arr){arr=[];this._cmdBuffer.set(tick,arr);}
    arr.push(cmd);
  },
  executeCommands(tick){
    if(!this._cmdBuffer)return;
    const cmds=this._cmdBuffer.get(tick);
    if(!cmds)return;
    for(let i=0;i<cmds.length;i++){
      const c=cmds[i];
      if(c.type==="spell_cast")this._executeSpellCast(c.team||"player",c.spellIdx,c.targetX,c.targetY);
      else if(c.type==="speed"){this.speed=c.speed;this._manualSpeed=true;}
      else if(c.type==="pause")this.paused=true;
      else if(c.type==="resume")this.paused=false;
    }
    this._cmdBuffer.delete(tick);
  },

  // DET: fixed timestep for deterministic simulation. The sim advances in
  // 1/60s increments regardless of real frame rate, so both peers tick identically.
  // The accumulator buffers real frame time and feeds it to the sim in fixed steps.
  // Max 4 steps per frame prevents the spiral-of-death when the tab stalls.
  loop(time){
    if(!this.running)return;
    // PERF-R12: cache bound loop function (avoids .bind() allocation every frame).
    if(!this._loopBound)this._loopBound=this.loop.bind(this);
    this.frame=requestAnimationFrame(this._loopBound);
    if(document.hidden){this.last=time;return;}
    let frameTime=(time-this.last)/1000;
    // PERF: use a tolerance (3.5ms) to avoid skipping frames on 60Hz displays
    // where rAF intervals vary (14.8-18.7ms due to vsync jitter). Without this,
    // the limiter blocks frames with interval < 16.667ms, dropping FPS to ~40-59.
    // 3.5ms tolerance ensures all rAF intervals pass on 60Hz displays while still
    // limiting render rate on 120/240Hz displays (where intervals are 4.2-8.3ms).
    if(frameTime<this.targetFrameTime()-0.0035)return;
    this.last=time;
    frameTime=Math.min(frameTime,0.1);
    // Pause: still render the current frame, but don't advance the sim.
    if(this.paused){this.render();return;}
    // Dramatic slowdown: when 3 or fewer total units remain alive, slow down
    // to 60% speed for dramatic effect (only if speed is >= 1).
    let effectiveSpeed=this.speed||1;
    if(effectiveSpeed>=1&&!this._manualSpeed){
      // PERF-R12: use pre-built alive arrays (avoids filter() allocation every frame).
      const aliveCount=(this._alivePlayers?this._alivePlayers.length:0)+(this._aliveEnemies?this._aliveEnemies.length:0);
      if(aliveCount<=3&&aliveCount>0&&this.time>5){
        effectiveSpeed=effectiveSpeed*0.6;
      }
    }
    this._effectiveSpeed=effectiveSpeed;
    // DET: feed real frame time (×speed) into the accumulator, drain in fixed steps.
    const FIXED_DT=1/60;
    this._accumulator=(this._accumulator||0)+frameTime*effectiveSpeed;
    // RELAY: guest in relay fallback mode does NOT run the sim — it only renders
    // state received from the host via snapshots. Skip the update loop entirely.
    // The host runs the sim normally (no lockstep constraints in relay mode).
    if(this._useRelay&&connected&&role==="guest"){
      // Guest: just render. State arrives via snap messages (applyRemoteSnapshot).
      // Interpolation is handled by _interpTo in the render path.
      this._lastDt=frameTime;
      try{
        this.render();
      }catch(e){
        showError("Render error: "+(e&&e.message||e));
        this.stop();
        return;
      }
      // Update spell bar cooldown display (throttled).
      this._spellBarT=(this._spellBarT||0)+frameTime;
      if(this._spellBarT>=0.5){
        this._spellBarT=0;
        this._renderSpellBar();
        this._renderBattleStats();
        this._renderKillFeed();
      }
      // Guest doesn't call checkEnd — host sends round_result/match_end messages.
      // rAF already scheduled at top of loop() — don't schedule again (double rAF bug).
      return;
    }
    // DET: lockstep pacing — don't simulate too far ahead of the confirmed peer.
    // When not in lockstep (single-player or snapshot mode), _peerConfirmedTick is
    // undefined and maxTick is Infinity, so pacing is a no-op.
    const maxTick=(this._lockstepActive&&this._peerConfirmedTick!=null)
      ?this._peerConfirmedTick+10:Infinity;
    let steps=0;
    while(this._accumulator>=FIXED_DT&&steps<4&&(this._tick||0)<maxTick){
      try{
        this.update(FIXED_DT);
      }catch(e){
        showError("Update error: "+(e&&e.message||e));
        this.stop();
        return;
      }
      this._accumulator-=FIXED_DT;
      steps++;
    }
    // DET: lockstep stall watchdog — if we're in lockstep but haven't been able to
    // simulate any steps for 5 seconds (peer stopped sending tick_ack), fall back to
    // snapshot sync. This prevents the sim from freezing forever when the peer
    // disconnects or lags severely.
    if(this._lockstepActive&&this._peerConfirmedTick!=null&&steps===0&&this._accumulator>=FIXED_DT){
      if(!this._stallStart)this._stallStart=Date.now();
      if(Date.now()-this._stallStart>5000){
        console.warn("[DET] Lockstep stall detected (no peer ack for 5s) — falling back to snapshot sync.");
        this._desyncFallback=true;
        this._lockstepActive=false;
        this._peerConfirmedTick=null;
        this._stallStart=null;
        this._accumulator=0; // reset to avoid catch-up burst
      }
    }else{
      this._stallStart=null;
    }
    // _lastDt drives HP-bar interpolation in render; use real frame time so it
    // stays smooth even on frames where no sim step runs (accumulator < FIXED_DT).
    this._lastDt=frameTime;
    // FPS monitoring: compute rolling average every 30 frames, set quality tier.
    this._fpsFrames++;this._fpsAccum+=frameTime;
    if(this._fpsFrames>=30){
      const avgFps=this._fpsFrames/this._fpsAccum;
      this._fpsTier=avgFps>50?"high":avgFps>30?"medium":"low";
      this._fpsFrames=0;this._fpsAccum=0;
    }
    try{
      this.render();
    }catch(e){
      showError("Render error: "+(e&&e.message||e));
      this.stop();
      return;
    }
    // Update spell bar cooldown display (throttled to ~4fps to avoid DOM thrash).
    this._spellBarT=(this._spellBarT||0)+frameTime;
    if(this._spellBarT>=0.5){
      this._spellBarT=0;
      this._renderSpellBar();
      this._renderBattleStats();
      this._renderKillFeed();
    }
    this.checkEnd();
  },

  // Phase 10: single units array, split by team each frame.
  update(dt){
    // DET: deterministic tick counter — increments once per fixed sim step.
    // Commands are scheduled by tick number and executed here, before sim logic,
    // so both peers apply the same command at the same tick.
    this._tick=(this._tick||0)+1;
    this.executeCommands(this._tick);
    // DET: periodically tell the peer how far we've simulated so they can pace.
    // Every 10 ticks (~167ms) when in lockstep mode.
    if(this._lockstepActive&&connected&&(this._tick%10)===0){
      transmit("tick_ack",{tick:this._tick});
    }
    this.time+=dt;
    // Phase 23: spell trigger checks + zone ticking.
    Spell.checkTriggers(this,dt);
    Spell.tickZones(this,dt);
    // Arena mechanics: apply arena-specific effects to all units.
    // (Moved from loop() so mechanics work in tick/auto/skip modes too.)
    this._applyArenaMechanics(dt);
    // Tick player spell cooldowns.
    if(this.playerSpells){
      // PERF-R12: index loop (avoid for...of iterator allocation).
      for(let psi=0;psi<this.playerSpells.length;psi++){
        const ps=this.playerSpells[psi];
        if(ps.cooldown>0)ps.cooldown=Math.max(0,ps.cooldown-dt);
      }
    }
    // B4: bot spell casting — bot casts enemy spells when off cooldown.
    // Only in single-player (not P2P). Bot targets player cluster center.
    if(!connected&&this._allPlayerSpells&&this._allPlayerSpells.enemy){
      const botSpells=this._allPlayerSpells.enemy;
      for(let bi=0;bi<botSpells.length;bi++){
        const ps=botSpells[bi];
        if(ps.cooldown>0)continue;
        // B4: cast spell at a strategic moment — when battle has been running
        // for at least 2s and there are player units to target.
        if(this.time<2)continue;
        const playerUnits=this.units.filter(u=>u.team==="player"&&u.h>0);
        if(!playerUnits.length)continue;
        // Target the center of the player's cluster.
        let cx=0,cy=0;
        for(let pi=0;pi<playerUnits.length;pi++){cx+=playerUnits[pi].x;cy+=playerUnits[pi].y;}
        cx/=playerUnits.length;cy/=playerUnits.length;
        this.fireSpell(ps.spec,"enemy");
        ps.cooldown=ps.maxCD;
      }
    }
    // Update floating damage numbers.
    this.updateDmgNums(dt);
    // 1. status ticks + death animation + minion TTL
    // PERF-R12: hoist quality/reducedMotion checks outside loop (avoids 100× per frame).
    const _qTier=G.qualityTier?.()||"high";
    const _reducedMotion=G.save?.settings?.reducedMotion;
    const _auraEnabled=_qTier!=="low"&&_qTier!=="minimal"&&!_reducedMotion;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(u.h<=0){
        if(u.deathT!==undefined)u.deathT+=dt;
        u.animState="death"; // Phase 11: death animation state
        continue;
      }
      if(u.poison>0){
        u.poison-=dt;
        u.poisonTick-=dt;
        if(u.poisonTick<=0&&u.h>0){
          u.h-=u.poisonDmg||3;if(u.h<0)u.h=0;u.poisonTick=0.5;
          // BUG-R15: attribute poison kill to the poisoner, not the last melee hitter.
          if(u.h<=0&&u.poisonAttacker)u.lastAttacker=u.poisonAttacker;
          if(this.running)this.spawnDmgNum(u.x,u.y-u.z-8,Math.round(u.poisonDmg||3),u.team,false,"poison");
        }
        if(u.h<=0){u.poison=0;}
      }
      if(u.regen>0){
        u.regen-=dt;
        u.regenTick-=dt;
        if(u.regenTick<=0&&u.h>0&&u.h<u.mh){const amt=Math.min(u.regenAmt||10,u.mh-u.h);u.h+=amt;u.regenTick=0.5;if(this.running)this.spawnDmgNum(u.x,u.y-u.z-8,"+"+Math.round(amt),u.team,false);}
      }
      if(u.slow>0)u.slow=Math.max(0,u.slow-dt);
      if(u.stun>0)u.stun=Math.max(0,u.stun-dt);
      if(u.cool>0)u.cool=Math.max(0,u.cool-dt);
      if(u.abCool>0)u.abCool=Math.max(0,u.abCool-dt);
      if(u.shieldActive>0)u.shieldActive=Math.max(0,u.shieldActive-dt);
      if(u.silence>0)u.silence=Math.max(0,u.silence-dt);
      if(u.stealth>0)u.stealth=Math.max(0,u.stealth-dt);
      if(u.frenzyT>0)u.frenzyT=Math.max(0,u.frenzyT-dt);
      if(u.ttl>0){u.ttl-=dt;if(u.ttl<=0){u.h=0;u.lastAttacker=null;}} // minion expires (no kill attribution)
      // regen: heal 2% of max HP per second
      if(u.ability==="regen"&&u.h>0&&u.h<u.mh)u.h=Math.min(u.mh,u.h+u.mh*0.02*dt);
      // Phase 11: advance attack animation timer — speed scales with attack speed (frenzy doubles).
      const effA=u.frenzyT>0?u.a*2:u.a;
      if(u.attackT>=0){u.attackT+=dt*effA;if(u.attackT>=1)u.attackT=-1;}
      // Phase 11: update animation state for rendering.
      if(u.h<=0)u.animState="death";
      else if(u.attackT>=0)u.animState="attack";
      else if(u.movedThisFrame)u.animState="move";
      else u.animState="idle";
      // Phase 17: advance FX timers.
      if(u.hitFlash>0)u.hitFlash-=dt;
      if(u.lungeT>0)u.lungeT-=dt;
      if(u.abFlash>0)u.abFlash-=dt;
      if(u.spawnT>0)u.spawnT+=dt/0.15; // 150ms spawn anim
      // Phase 24e: persistent unit aura.
      if(_auraEnabled)this.fxAura(u,dt);
    }
    // 2. detect newly dead units → onUnitDeath
    // 3. build alive arrays (split by team) + reset animation flags.
    // PERF-R12: merge 3 loops into 1 (death detect + alive arrays + flag reset).
    // PERF-R12: store alive arrays as instance props for checkEnd() reuse.
    const players=this._alivePlayers||(this._alivePlayers=[]), enemies=this._aliveEnemies||(this._aliveEnemies=[]);
    players.length=0; enemies.length=0;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(u.h<=0){
        if(u.deathT===undefined)this.onUnitDeath(u);
        continue;
      }
      u.movedThisFrame=false;
      u.attackedThisFrame=false;
      if(u.team==="player")players.push(u);else enemies.push(u);
    }
    // PERF-R12: clear per-frame targeting cache (team-level targets).
    // Create new object (cheaper than delete which deoptimizes hidden class).
    _targetCache={};
    // PERF-R12: increment closestEnemy temporal coherence frame counter.
    // PERF-R12: cache taunters per frame (avoids O(n) find per unit).
    const playerTaunter=players.find(e=>e.ability==="taunt");
    const enemyTaunter=enemies.find(e=>e.ability==="taunt");
    // C6: buff_aura — units with buff_aura give nearby allies +20% dmg +10% speed.
    // Applied per-frame (refreshes). Uses squared distance (no sqrt).
    this._applyBuffAuras(players,dt);
    this._applyBuffAuras(enemies,dt);
    // PERF-R12: build spatial grid for avoidance (avoids O(n²) ally scan).
    // Grid is rebuilt per team — each team's units only avoid their own allies.
    // PERF-R12: iterate over alive arrays (players/enemies) instead of this.units.
    _buildAvoidGrid(players);
    for(let i=0;i<players.length;i++){
      const u=players[i];
      this.act(u,enemies,players,dt,enemyTaunter);
      if(Math.abs(u.x-u.prevX)>0.5||Math.abs(u.y-u.prevY)>0.5)u.movedThisFrame=true;
      u.prevX=u.x;u.prevY=u.y;
    }
    _buildAvoidGrid(enemies);
    for(let i=0;i<enemies.length;i++){
      const u=enemies[i];
      this.act(u,players,enemies,dt,playerTaunter);
      if(Math.abs(u.x-u.prevX)>0.5||Math.abs(u.y-u.prevY)>0.5)u.movedThisFrame=true;
      u.prevX=u.x;u.prevY=u.y;
    }
    // 4. projectiles
    this.updateProjectiles(dt);
    // 5. collision separation
    this.separate(this.units);
    // Phase 17: update FX (particles, shake, round flash).
    BattleFX.update(dt);
    // 6. clamp positions to canvas bounds (prevent flee/kite from flying off).
    // NETFIX: unified single loop over all units (SP + MP share this path).
    // Was 2 separate loops for players/enemies — same logic, now one pass.
    // DET: use GAME_W/GAME_H (fixed 400×550) not canvasW/canvasH (viewport-dependent)
    // for lockstep determinism. Units live in game coordinate space, not screen space.
    const cw=this.GAME_W, ch=this.GAME_H;
    for(let i=0;i<this.units.length;i++){
      const u=this.units[i];
      if(u.h<=0)continue; // skip dead units (no position update needed)
      const spriteH=(u.z||10)/10*1.8*26;
      u.x=clamp(u.x,u.z,cw-u.z);
      u.y=clamp(u.y,spriteH+12,ch-u.z);
    }
    // 6. death cleanup: remove units with deathT >= 0.5 from active units.
    // Keep them in _allUnits for cumulative draft revival.
    // PERF-R11: in-place filter to avoid allocating 2 arrays per frame.
    // PERF: build ID→index Map for O(1) lookup (avoids O(n) findIndex per dead unit).
    let hasDead=false;
    if(!this._allUnitsIdMap)this._allUnitsIdMap=new Map();
    const idMap=this._allUnitsIdMap;
    idMap.clear();
    for(let ai=0;ai<this._allUnits.length;ai++)idMap.set(this._allUnits[ai].id,ai);
    for(let di=0;di<this.units.length;di++){
      const u=this.units[di];
      if(u.deathT!==undefined&&u.deathT>=0.5){
        hasDead=true;
        // PERF: direct assignment instead of spread {...u} — avoids per-death object
        // allocation. The unit is being removed from this.units below, so there's no
        // aliasing risk. _allUnits entry becomes the sole reference holder.
        const idx=idMap.get(u.id);
        if(idx>=0)this._allUnits[idx]=u;
      }
    }
    // PERF-R12: in-place compaction for death cleanup (avoids filter array allocation).
    if(hasDead){
      let w=0;
      for(let i=0;i<this.units.length;i++){
        const u=this.units[i];
        if(u.deathT===undefined||u.deathT<0.5){
          if(w!==i)this.units[w]=u;
          w++;
        }
      }
      this.units.length=w;
    }
    // HUD — PERF-R11: throttle to ~10fps to avoid DOM thrash every frame.
    this._hudT=(this._hudT||0)+dt;
    if(this._hudT>=0.1){
      this._hudT=0;
      setText("battleHP",players.length);
      setText("battleEnemy",enemies.length);
      setText("turn","T"+Math.floor(this.time));
      // Battle countdown timer: shows remaining time, turns red in last 15s.
      const timerEl=$("battleTimer");
      if(timerEl){
        const remaining=Math.max(0,90-this.time);
        if(remaining<=15){timerEl.style.color="#f84";timerEl.textContent="⏱ "+Math.ceil(remaining)+"s";}
        else if(remaining<90){timerEl.style.color="var(--muted)";timerEl.textContent="⏱ "+Math.ceil(remaining)+"s";}
        else{timerEl.textContent="";}
      }
    }
    // Debug logging: log all battle stats every ~1s when Battle.debug is on.
    // Includes positions, HP, all combat stats, status effects, abilities,
    // target info, movement/attack detection, and projectile tracking.
    if(this.debug){
      this._debugT+=dt;
      if(this._debugT>=1){
        this._debugT=0;
        const pHP=players.reduce((s,u)=>s+Math.max(0,u.h),0);
        const eHP=enemies.reduce((s,u)=>s+Math.max(0,u.h),0);
        console.group("Battle t="+this.time.toFixed(1)+" P"+players.length+"("+pHP.toFixed(0)+"hp)/E"+enemies.length+"("+eHP.toFixed(0)+"hp) proj="+this.projectiles.length);
        for(const u of this.units){
          if(u.h<=0)continue;
          const tgt=u.target;
          const td=tgt?dist(u,tgt).toFixed(0):"-";
          const inRange=tgt?dist(u,tgt)<=u.r:"–";
          const tgtHp=tgt?tgt.h.toFixed(0)+"/"+tgt.mh.toFixed(0):"-";
          const sts=[];
          if(u.poison>0)sts.push("poison:"+u.poison.toFixed(1)+"s");
          if(u.slow>0)sts.push("slow:"+u.slow.toFixed(1)+"s");
          if(u.stun>0)sts.push("stun:"+u.stun.toFixed(1)+"s");
          if(u.shieldActive>0)sts.push("shield:"+u.shieldActive.toFixed(1)+"s");
          if(u.cool>0)sts.push("cool:"+u.cool.toFixed(2));
          if(u.abCool>0)sts.push("abCool:"+u.abCool.toFixed(2));
          console.log(
            u.n+"["+u.team+"] pos=("+u.x.toFixed(0)+","+u.y.toFixed(0)+")"+
            " hp="+u.h.toFixed(0)+"/"+u.mh.toFixed(0)+
            " dmg="+u.d+" range="+u.r+" speed="+u.s+" atkSpd="+u.a.toFixed(2)+
            " z="+u.z+" crit="+u.crit+
            " mov="+u.movement+"("+u.moveSpeedMod+"%) tgt="+u.targeting+
            " atkCond="+u.attackCondition+
            " ab="+u.ability+"/"+u.abilityTrigger+
            " tgtDist="+td+"/"+u.r+(inRange===true?" [IN RANGE]":"")+
            " tgtHp="+tgtHp+
            " moved="+u.movedThisFrame+" atk="+u.attackedThisFrame+
            (sts.length?" status=["+sts.join(",")+"]":"")
          );
        }
        if(this.projectiles.length){
          console.log("Projectiles ("+this.projectiles.length+"):");
          for(const p of this.projectiles){
            if(p.dead)continue;
            const tgt=this.units.find(u=>u.id===p.targetId);
            const tgtName=tgt?tgt.n:"?";
            console.log("  proj["+p.team+"] pos=("+p.x.toFixed(0)+","+p.y.toFixed(0)+")→("+p.tx.toFixed(0)+","+p.ty.toFixed(0)+")"+
              " d="+p.d+" life="+p.life.toFixed(2)+
              " owner="+p.n+" target="+tgtName+
              " ab="+p.ability);
          }
        }
        console.groupEnd();
      }
    }
  },

  // Phase 10: 4-line composition via lookup tables.
  act(u,enemies,allies,dt,cachedTaunter){
    if(u.h<=0||u.stun>0)return;
    // taunt: if enemy team has a taunt unit, force target it
    // PERF-R11: use cached taunter from update() instead of find() per unit.
    // PERF-R12: avoid enemies.filter() allocation — use single-element array.
    // PERF-R12: check if cached taunter is still alive (may have died this frame).
    let targetEnemies=enemies;
    const taunter=cachedTaunter!==undefined&&cachedTaunter&&cachedTaunter.h>0?cachedTaunter:enemies.find(e=>e.h>0&&e.ability==="taunt");
    if(taunter){
      // Reuse a single-element array instead of filtering (avoids allocation).
      if(!this._tauntArr)this._tauntArr=[taunter];
      else this._tauntArr[0]=taunter;
      targetEnemies=this._tauntArr;
    }
    const targetFn=TARGETING[u.targeting];
    // PERF-R12: use per-frame cache for team-level targets (don't depend on u).
    let target;
    if(targetFn&&_TEAM_LEVEL_TARGETS.has(u.targeting)){
      target=_getCachedTarget(u.team,u.targeting,targetEnemies,allies);
    }else{
      target=targetFn?targetFn(u,targetEnemies,allies):null;
    }
    u.target=target; // Phase 24f: store target for eye tracking
    const moveFn=MOVEMENT[u.movement];
    if(moveFn)moveFn(u,target,dt);
    // D5: soft avoidance — push away from nearby allies to prevent clumping.
    const av=avoidanceOffset(u,allies);
    u.x+=av.x; u.y+=av.y;
    // PERF-R12: use squared distance for attack range check (avoid Math.sqrt).
    const atkCondFn=ATTACK_CONDITIONS[u.attackCondition];
    const r2=u.r*u.r;
    if(target&&target.h>0&&atkCondFn&&atkCondFn(u,target)&&u.cool<=0){
      const tdx=u.x-target.x, tdy=u.y-target.y;
      if(tdx*tdx+tdy*tdy<=r2){
        if(this.debug){const tDist=Math.sqrt(tdx*tdx+tdy*tdy);console.log("[ATK] t="+this.time.toFixed(2)+" "+u.n+"["+u.team+"] → "+target.n+"["+target.team+"] d="+u.d+" dist="+tDist.toFixed(0)+"/"+u.r+(u.r>RANGED_THRESHOLD?" RANGED":" MELEE"));}
        this.attack(u,target,enemies);
        u.cool=(1/u.a)*(u.frenzyT>0?0.5:1); // cooldown = 1 / attacks_per_second (frenzy halves)
        u.attackedThisFrame=true; // Phase 11: trigger attack animation
        u.attackT=0;              // Phase 11: start attack anim timer
      }
    }
    const triggerFn=ABILITY_TRIGGERS[u.abilityTrigger];
    if(triggerFn&&triggerFn(u,allies,enemies)){
      this.triggerAbility(u,allies,enemies);
      if(u.abilityTrigger==="on_spawn")u.spawnTriggered=true;
    }
  },

  // Ranged units fire projectiles; melee deal damage instantly.
  attack(attacker,target,enemies){
    BattleFX.onAttack(attacker,target); // Phase 17: attack lunge FX
    BattleFX.fireRecipeFx(attacker,target); // Phase 17: weapon-based recipe FX
    GameAudio.sfx(attacker.r>RANGED_THRESHOLD?"attack_ranged":"attack_melee",{pitch:fxTypeFreq(attacker.fxType),weaponType:attacker.weaponType}); // Phase 30 + I3
    if(attacker.r>RANGED_THRESHOLD){
      // D5: spawn projectiles from the weapon hand (gripOffset), with a small
      // nudge toward the target, instead of the unit center.
      // GripOffset is in unscaled sprite space; apply the sprite scale factor
      // so the spawn point matches the rendered weapon position.
      let wx=attacker.x,wy=attacker.y;
      // PERF-R12: cache weapon shape on unit (avoid find() per attack).
      if(!attacker._weaponShape){
        attacker._weaponShape=attacker.recipe?.shapes?.find(s=>s.parentJoint)||null;
      }
      const weaponShape=attacker._weaponShape;
      const spriteScale=(attacker.z||10)/10*1.8;
      if(weaponShape?.gripOffset){
        const side=attacker.team==="player"?1:-1;
        wx=attacker.x+side*weaponShape.gripOffset.x*spriteScale;
        wy=attacker.y+weaponShape.gripOffset.y*spriteScale;
      }
      const forward=4*spriteScale;
      const dx=target.x-attacker.x,dy=target.y-attacker.y;
      // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
      // DET: DMath.sqrt for cross-browser determinism.
      const d=DMath.sqrt(dx*dx+dy*dy)||1;
      const sx=wx+(dx/d)*forward;
      const sy=wy+(dy/d)*forward;
      // PERF-R12: pool projectiles (avoid per-attack object allocation + GC).
      const p=this._projPool&&this._projPool.length?this._projPool.pop():{trail:[0,0,0,0,0,0,0,0],_trailLen:0,dead:false};
      p.x=sx;p.y=sy;
      p.tx=target.x;p.ty=target.y;
      p.targetId=target.id;
      p.d=attacker.d;p.team=attacker.team;p.owner=attacker.id;
      p.n=attacker.n;p.baseD=attacker.baseD;
      p.c=attacker.c;p.ability=attacker.ability;p.crit=attacker.crit;
      p.role=attacker.role;p.moveSpeedMod=100;
      p.life=2;p.dead=false;p._trailLen=0;
      p.weaponType=attacker.weaponType||"none";
      p.fxType=attacker.fxType||deriveFxType(attacker);
      p.accent=attacker.recipe?.accentHex||WEAPON_COLOR[attacker.weaponType]||attacker.c;
      this.projectiles.push(p);
    }
    else{
      this.takeDamage(attacker,target,enemies);
    }
  },

  // Phase 10: unified damage resolution with all passive abilities.
  // dmgOverride: optional 4th param for abilities that deal modified damage (blink_strike, chain_lightning).
  takeDamage(attacker,target,enemies,dmgOverride){
    if(target.h<=0)return;
    // dodge: 50% chance to completely avoid (was 20% in v4)
    if(target.ability==="dodge"&&rand()<0.5){this.log(target.n+" dodges!");if(this.debug)console.log("[DODGE] t="+this.time.toFixed(2)+" "+target.n+" dodged "+attacker.n);return;}
    // shield: immune if active
    if(target.shieldActive>0){this.log(target.n+" shielded!");if(this.debug)console.log("[SHIELD] t="+this.time.toFixed(2)+" "+target.n+" shielded vs "+attacker.n);return;}
    let dmg=dmgOverride!=null?dmgOverride:attacker.d;
    // rage: damage scales linearly with missing HP (up to +100% at 0 HP)
    if(attacker.ability==="rage"&&attacker.mh>0)dmg*=1+Math.max(0,1-attacker.h/attacker.mh);
    // executioner: 3× damage to enemies below 25% HP
    if(attacker.ability==="executioner"&&target.mh>0&&target.h<target.mh*0.25)dmg*=3;
    // U1: armor — flat damage reduction per hit (min 1 damage)
    if(target.armor>0)dmg=Math.max(1,dmg-target.armor);
    // crit
    // DET: rand() for deterministic crit/dodge rolls.
    const crit=rand()<(attacker.crit||0);
    if(crit){dmg*=2;vibrate(25);}
    const hpBefore=target.h;
    target.h-=dmg;
    if(target.h<0)target.h=0;
    // Track damage dealt by attacker for MVP calculation.
    if(attacker.dmgDealt!==undefined)attacker.dmgDealt+=dmg;
    // Track battle stats for real-time overlay.
    if(this._battleStats){
      if(attacker.team==="player"){this._battleStats.playerDmg+=dmg;
        // PERF-R12: use flat array for dmgWindow (avoid per-hit object allocation).
        if(!this._dmgWinPool)this._dmgWinPool=[];
        const dw=this._dmgWinPool.length?this._dmgWinPool.pop():[0,0];
        dw[0]=this.time;dw[1]=dmg;
        this._battleStats.dmgWindow.push(dw);
      }
      else{this._battleStats.enemyDmg+=dmg;}
      // Track biggest hit for battle highlights.
      if(!this._highlights)this._highlights={biggestHit:0,biggestHitBy:null,biggestHitTarget:null};
      if(dmg>this._highlights.biggestHit){
        this._highlights.biggestHit=dmg;
        this._highlights.biggestHitBy=attacker.n;
        this._highlights.biggestHitTarget=target.n;
        this._highlights.biggestHitCrit=crit;
      }
    }
    // Spawn floating damage number.
    this.spawnDmgNum(target.x,target.y-target.z-8,Math.round(dmg),target.team,crit);
    // Debug: log melee damage (ranged hits are logged in updateProjectiles)
    if(this.debug&&attacker.r<=RANGED_THRESHOLD){
      console.log("[DMG] t="+this.time.toFixed(2)+" "+attacker.n+"→"+target.n+"["+target.team+"] d="+dmg.toFixed(1)+(crit?" CRIT":"")+" hp:"+hpBefore.toFixed(0)+"→"+target.h.toFixed(0));
    }
    target.hasBeenHit=true; // Phase 10: for on_first_hit trigger
    // D4: hit reaction — recoil away from attacker.
    const dx=target.x-attacker.x,dy=target.y-attacker.y;
    // DET: DMath.sqrt for cross-browser determinism.
    const dd=DMath.sqrt(dx*dx+dy*dy)||1;
    target.hitReact=0.15;
    // PERF-R12: reuse existing hitReactDir object (avoid per-hit allocation).
    if(!target.hitReactDir)target.hitReactDir={x:0,y:0};
    target.hitReactDir.x=dx/dd;target.hitReactDir.y=dy/dd;
    // Phase 17: FX on hit.
    if(crit){
      BattleFX.onCrit(target);
      GameAudio.sfx("crit"); // Phase 30
      // Phase 17: track crits for P2P snapshot sync.
      if(!this.recentCrits)this.recentCrits=[];
      this.recentCrits.push({id:target.id,t:this.time});
      // PERF-R12: in-place compaction instead of filter (avoids array allocation).
      let wc=0;
      for(let rcI=0;rcI<this.recentCrits.length;rcI++){
        if(this.time-this.recentCrits[rcI].t<2){
          if(wc!==rcI)this.recentCrits[wc]=this.recentCrits[rcI];
          wc++;
        }
      }
      this.recentCrits.length=wc;
    }
    else {BattleFX.onHit(target);GameAudio.sfx("hit");} // Phase 30
    // Only log crits to kill feed (regular hits are too noisy).
    if(crit)this.log(`<span style="color:${attacker.c}">${attacker.n}</span> CRIT <span style="color:${target.c}">${target.n}</span> ${F(dmg)}`);
    // lifesteal: heal attacker for 50% of damage dealt
    if(attacker.ability==="lifesteal")attacker.h=Math.min(attacker.mh,attacker.h+dmg*0.5);
    // slow: debuff target for 1s (refreshes, doesn't stack)
    if(attacker.ability==="slow")target.slow=Math.max(target.slow,1.0);
    // splash: AoE damage to enemies near target (50% damage)
    if(attacker.ability==="splash"){
      // PERF-R13: squared distance check (avoid DMath.sqrt per enemy).
      const splashR2=40*40;
      for(let ei=0;ei<enemies.length;ei++){
        const e=enemies[ei];
        if(e!==target&&e.h>0){const dx=target.x-e.x,dy=target.y-e.y;if(dx*dx+dy*dy<splashR2){const splashDmg=dmg*0.5;e.h-=splashDmg;if(e.h<0)e.h=0;e.lastAttacker=attacker;if(attacker.dmgDealt!==undefined)attacker.dmgDealt+=splashDmg;}}
      }
    }
    // poison: apply DoT (refreshes duration, doesn't stack damage)
    // BUG-R15: track poisonAttacker separately — lastAttacker gets overwritten by
    // subsequent melee hits, so poison kills would be attributed to the wrong unit.
    if(attacker.ability==="poison"){target.poison=Math.max(target.poison,3.0);target.poisonDmg=Math.max(target.poisonDmg||3,attacker.d*0.3);target.poisonTick=0;target.poisonAttacker=attacker;}
    // thorns: reflect 30% of damage back to attacker
    if(target.ability==="thorns"&&attacker.h>0){const reflectDmg=dmg*0.3;attacker.h-=reflectDmg;if(attacker.h<0)attacker.h=0;attacker.lastAttacker=target;if(target.dmgDealt!==undefined)target.dmgDealt+=reflectDmg;this.log(target.n+" thorns "+attacker.n);}
    // Phase 20: track last attacker for ramp-on-kill and kill feed.
    target.lastAttacker=attacker;
    if(attacker.ability==="ramp")target.lastAttacker=attacker;
  },

  // Phase 10: triggered abilities (heal, spawn, explode, heal_burst, shield).
  // PERF-R12: hoist abColors map (avoid per-trigger object allocation).
  _abColors:{heal:"#34d399",spawn:"#fbbf24",explode:"#fb7185",heal_burst:"#34d399",shield:"#60a5fa",
    blink_strike:"#a78bfa",frenzy:"#fb923c",cleanse:"#34d399",chain_lightning:"#4af",counter:"#a78bfa",
    taunt:"#fb7185",regen:"#34d399",executioner:"#fb7185"},
  triggerAbility(u,allies,enemies){
    // C1: silence — unit cannot use abilities while silenced.
    if(u.silence>0)return;
    // Ability activation flash: colored ring around the unit.
    const abColors=this._abColors;
    u.abFlash=0.4;
    u.abFlashColor=abColors[u.ability]||"#fff";
    // Log ability activation to kill feed (skip "none" ability).
    if(u.ability&&u.ability!=="none"){
      this.log(`<span style="color:${abColors[u.ability]||"#fff"}">✨ ${u.n}</span> ${u.ability.replace(/_/g," ")}`);
    }
    switch(u.ability){
      case "heal":{
        // PERF-R12: lowestBy already skips dead units — just exclude self via Infinity.
        const ally=lowestBy(allies,a=>a===u?Infinity:a.h);
        if(ally){ally.h=Math.min(ally.mh,ally.h+u.d*2);u.abCool=3.0;this.log(u.n+" heals "+ally.n);GameAudio.sfx("heal");}
        break;
      }
      case "spawn":{
        if(this.units.length<100){ // Cap total units to prevent memory issues
        const minion=unit({n:"Minion",h:20,d:5,r:20,s:50,a:1,c:u.c,
          targeting:"closest",movement:"chase",attackCondition:"always",
          abilityTrigger:"never",moveSpeedMod:100,ability:"none",role:"frontline"});
        minion.team=u.team;
        minion.x=u.x+randRange(-20,20);
        minion.y=u.y+randRange(-20,20);
        minion.ttl=5;
        this.units.push(this.initRuntime(minion));
        BattleFX.onSpawn(minion); // Phase 17: spawn pop-in FX
        }
        u.abCool=2.0;
        this.log(u.n+" spawns a minion");
        break;
      }
      case "explode":{
        // PERF-R13: squared distance check (avoid DMath.sqrt per enemy).
        const explodeR2=60*60;
        for(let ei=0;ei<enemies.length;ei++){
          const e=enemies[ei];
          if(e.h>0){const dx=u.x-e.x,dy=u.y-e.y;if(dx*dx+dy*dy<explodeR2)this.takeDamage(u,e,enemies);}
        }
        u.abCool=5.0;
        this.log(u.n+" explodes!");
        GameAudio.sfx("explode"); // Phase 30
        break;
      }
      case "heal_burst":{
        // PERF-R13: squared distance check (avoid DMath.sqrt per ally).
        const healR2=60*60;
        for(let ai=0;ai<allies.length;ai++){
          const a=allies[ai];
          if(a.h>0){const dx=u.x-a.x,dy=u.y-a.y;if(dx*dx+dy*dy<healR2)a.h=Math.min(a.mh,a.h+u.d*2);}
        }
        u.abCool=4.0;
        this.log(u.n+" heal burst!");
        GameAudio.sfx("heal"); // Phase 30
        break;
      }
      case "shield":{
        u.shieldActive=Math.max(u.shieldActive||0,2.0);
        u.abCool=8.0;
        if(u.abilityTrigger==="on_first_hit")u.firstHitUsed=true;
        this.log(u.n+" raises shield");
        GameAudio.sfx("shield"); // Phase 30
        break;
      }
      case "blink_strike":{
        // PERF-R12: lowestBy already skips dead units — no filter needed.
        const target=lowestBy(enemies,e=>e.h);
        if(target){
          u.x=target.x+randRange(-15,15);u.y=target.y+randRange(-15,15);
          this.takeDamage(u,target,enemies,u.d*2);
          u.abCool=5.0;
          this.log(u.n+" blinks to "+target.n+"!");
          BattleFX.onAttack(u,target);
          GameAudio.sfx("attack_melee",{pitch:400});
        }
        break;
      }
      case "frenzy":{
        u.frenzyT=3.0;
        u.abCool=6.0;
        this.log(u.n+" enters a frenzy!");
        break;
      }
      case "cleanse":{
        // PERF-R13: squared distance check (avoid DMath.sqrt per ally).
        const cleanseR2=80*80;
        for(let ai=0;ai<allies.length;ai++){
          const a=allies[ai];
          if(a.h>0){const dx=u.x-a.x,dy=u.y-a.y;if(dx*dx+dy*dy<cleanseR2){a.slow=0;a.stun=0;a.poison=0;a.poisonDmg=0;a.poisonAttacker=null;}}
        }
        u.abCool=5.0;
        this.log(u.n+" cleanses allies!");
        GameAudio.sfx("heal");
        break;
      }
      case "chain_lightning":{
        // PERF-R13: find 3 closest enemies without filter+sort+slice (3 allocations).
        // Single-pass selection: track top-3 by squared distance.
        let t1=null,t2=null,t3=null,d1=Infinity,d2=Infinity,d3=Infinity;
        for(let ei=0;ei<enemies.length;ei++){
          const e=enemies[ei];
          if(e.h<=0)continue;
          const dx=u.x-e.x,dy=u.y-e.y,d=dx*dx+dy*dy;
          if(d<d1){t3=t2;d3=d2;t2=t1;d2=d1;t1=e;d1=d;}
          else if(d<d2){t3=t2;d3=d2;t2=e;d2=d;}
          else if(d<d3){t3=e;d3=d;}
        }
        let last=u;
        if(t1){this.takeDamage(u,t1,enemies,u.d*0.8);BattleFX.burst(t1.x,t1.y,"#4af",4,30);last=t1;}
        if(t2){this.takeDamage(u,t2,enemies,u.d*0.8);BattleFX.burst(t2.x,t2.y,"#4af",4,30);last=t2;}
        if(t3){this.takeDamage(u,t3,enemies,u.d*0.8);BattleFX.burst(t3.x,t3.y,"#4af",4,30);last=t3;}
        u.abCool=4.0;
        this.log(u.n+" chains lightning!");
        GameAudio.sfx("attack_ranged",{pitch:400});
        break;
      }
      // "none" and passive abilities: no-op here
    }
    // Phase 10: mark on_first_hit as used for any triggered ability (not just shield).
    if(u.abilityTrigger==="on_first_hit")u.firstHitUsed=true;
  },

  // Phase 10: death hook — fires on_death abilities before removal.
  onUnitDeath(u){
    // Guard: prevent double-processing (arena mechanics + sim can both call this).
    if(u.deathT!==undefined)return;
    if(u.abilityTrigger==="on_death"){
      // PERF: reuse pooled arrays instead of filter() allocation (2 arrays per death).
      if(!this._deathAllies)this._deathAllies=[];
      if(!this._deathEnemies)this._deathEnemies=[];
      const allies=this._deathAllies, enemies=this._deathEnemies;
      allies.length=0; enemies.length=0;
      for(let di=0;di<this.units.length;di++){
        const x=this.units[di];
        if(x.h<=0)continue;
        if(x.team===u.team)allies.push(x);else enemies.push(x);
      }
      this.triggerAbility(u,allies,enemies);
    }
    // Phase 20: ramp — attacker gains +15% dmg on kill (cap 3× base).
    let killer=u.lastAttacker;
    // If killer is a projectile synth (not in this.units), resolve real owner.
    // PERF: check by id instead of O(n) includes() — killer from projectile has
    // an id but isn't the same object reference as the unit in this.units.
    if(killer&&killer.id){
      let killerInUnits=false;
      for(let ki=0;ki<this.units.length;ki++){if(this.units[ki]===killer){killerInUnits=true;break;}}
      if(!killerInUnits){
        for(let ki=0;ki<this.units.length;ki++){if(this.units[ki].id===killer.id&&this.units[ki].h>0){killer=this.units[ki];break;}}
      }
    }
    if(killer&&killer.ability==="ramp"&&killer.h>0&&killer.baseD){
      const cap=killer.baseD*3;
      if(killer.d<cap){
        killer.d=Math.min(cap,Math.round(killer.d*1.15));
        BattleFX.onKill(killer);
        this.log(killer.n+" ramps up! DMG → "+killer.d);
      }
    }
    // on_kill trigger: fire killer's ability if they have on_kill trigger
    if(killer&&killer.h>0&&killer.abilityTrigger==="on_kill"){
      // PERF: reuse pooled arrays instead of filter() allocation (2 arrays per death).
      if(!this._deathAllies)this._deathAllies=[];
      if(!this._deathEnemies)this._deathEnemies=[];
      const kAllies=this._deathAllies, kEnemies=this._deathEnemies;
      kAllies.length=0; kEnemies.length=0;
      for(let ki=0;ki<this.units.length;ki++){
        const x=this.units[ki];
        if(x.h<=0)continue;
        if(x.team===killer.team)kAllies.push(x);else kEnemies.push(x);
      }
      this.triggerAbility(killer,kAllies,kEnemies);
    }
    // Track kill count for MVP.
    if(killer&&killer.kills!==undefined)killer.kills++;
    // Track battle stats for real-time overlay.
    if(this._battleStats&&killer){
      if(killer.team==="player")this._battleStats.playerKills++;
      else this._battleStats.enemyKills++;
    }
    // Kill feed: track recent kills for overlay.
    if(!this._killFeed)this._killFeed=[];
    const kfKiller=killer?killer.n:"environment";
    const kfTeam=killer?killer.team:"neutral";
    this._killFeed.unshift({killer:kfKiller,victim:u.n,killerTeam:kfTeam,victimTeam:u.team,t:this.time});
    if(this._killFeed.length>5)this._killFeed.pop();
    // First blood sound cue: play on the first kill of the battle.
    if(!this._firstBlood){
      this._firstBlood=true;
      GameAudio.sfx("first_blood");
    }
    u.deathT=0;
    // D5: body-plan-specific death FX.
    const bp=u.recipe?.bodyPlan||u.bodyPlan;
    const dBudget=MAX_PARTICLES-(Battle.particles?.length||0);
    if(dBudget>0){
      if(bp==="golem"||bp==="construct"){
        // Shatter: spawn colored rect particles.
        for(let i=0;i<Math.min(8,dBudget);i++){
          _spawnParticle(u.x+(Math.random()-0.5)*20,u.y+(Math.random()-0.5)*20,(Math.random()-0.5)*80,-30-Math.random()*40,0.5,0.6,u.c,3+Math.random()*3);
        }
      }else if(bp==="ghost"||bp==="wraith"||bp==="undead"){
        // Dissolve: fade + rise particles.
        for(let i=0;i<Math.min(6,dBudget);i++){
          _spawnParticle(u.x+(Math.random()-0.5)*15,u.y+(Math.random()-0.5)*15,0,-20-Math.random()*15,0.6,0.7,u.c,2+Math.random()*2);
        }
      }else if(bp==="blob"||bp==="slime"||bp==="monopod"){
        // Flatten: quick scale Y to 0 is handled by death animation; spawn puddle particles.
        for(let i=0;i<Math.min(5,dBudget);i++){
          _spawnParticle(u.x+(Math.random()-0.5)*18,u.y+5,(Math.random()-0.5)*20,0,0.4,0.5,u.c,4+Math.random()*2);
        }
      }
    }
    BattleFX.onDeath(u); // Phase 17: death burst FX
    GameAudio.sfx("death"); // Phase 30
    // Kill feed: log who killed whom with colored names.
    const killerName=killer&&killer.n?killer.n:"unknown";
    const killerColor=killer&&killer.c?killer.c:"#fff";
    this.log(`<span style="color:${killerColor}">${killerName}</span> 💀 <span style="color:${u.c}">${u.n}</span>`);
    // Phase 16: track death order for post-match hint.
    if(!this.deathLog)this.deathLog=[];
    this.deathLog.push({n:u.n,role:u.role,team:u.team,t:this.time,killer:killerName});
  },

  // Phase 24e: per-unit aura wrapper (calls BattleFX.unitAura).
  fxAura(u,dt){
    BattleFX.unitAura(u,dt);
  },

  updateProjectiles(dt){
    if(!this.projectiles.length)return;
    // PERF-R12: build unit lookup Map once per frame (avoids O(n) find per projectile).
    if(!this._unitIdMap)this._unitIdMap=new Map();
    if(!this._projPool)this._projPool=[];
    if(!this._projTrailPool)this._projTrailPool=[];
    const idMap=this._unitIdMap;
    idMap.clear();
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let ui=0;ui<this.units.length;ui++)idMap.set(this.units[ui].id,this.units[ui]);
    // PERF-R12: lazily build foes arrays per team only when a projectile hits.
    // Need separate arrays per team for splash damage (which iterates enemies array).
    let playerFoes=null,enemyFoes=null;
    function getFoes(team){
      if(team==="player"){
        if(!playerFoes){
          playerFoes=this._projPlayerFoes||(this._projPlayerFoes=[]);
          playerFoes.length=0;
          for(let ui=0;ui<this.units.length;ui++){const u=this.units[ui];if(u.h>0&&u.team==="enemy")playerFoes.push(u);}
        }
        return playerFoes;
      }else{
        if(!enemyFoes){
          enemyFoes=this._projEnemyFoes||(this._projEnemyFoes=[]);
          enemyFoes.length=0;
          for(let ui=0;ui<this.units.length;ui++){const u=this.units[ui];if(u.h>0&&u.team==="player")enemyFoes.push(u);}
        }
        return enemyFoes;
      }
    }
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let pi=0;pi<this.projectiles.length;pi++){
      const p=this.projectiles[pi];
      if(p.dead)continue;
      // PERF-R12: record trail position (reuse array, avoid per-frame object alloc).
      // Array holds 4 points × 2 coords = 8 slots. Shift before writing when full.
      if(!p.trail)p.trail=[0,0,0,0,0,0,0,0];
      if(!p._trailLen)p._trailLen=0;
      // PERF-R12: shift first if full (avoids out-of-bounds write at index 8).
      if(p._trailLen>=4){
        p.trail[0]=p.trail[2];p.trail[1]=p.trail[3];
        p.trail[2]=p.trail[4];p.trail[3]=p.trail[5];
        p.trail[4]=p.trail[6];p.trail[5]=p.trail[7];
        p._trailLen=3; // will be incremented to 4 below
      }
      const ti=p._trailLen*2;
      p.trail[ti]=p.x;p.trail[ti+1]=p.y;
      p._trailLen++;
      // Homing: track target unit if still alive, update target position.
      if(p.targetId!=null){
        const tgt=idMap.get(p.targetId);
        if(tgt&&tgt.h>0){p.tx=tgt.x;p.ty=tgt.y;}
      }
      const dx=p.tx-p.x, dy=p.ty-p.y, dd=DMath.sqrt(dx*dx+dy*dy);
      const sp=320*dt;
      if(dd<=sp){
        // PERF-R12: build foes array lazily per team (only when a projectile hits).
        const foes=getFoes.call(this,p.team);
        let hit=false;
        // PERF-R12: index loop (avoid for...of iterator allocation).
        for(let fi=0;fi<foes.length;fi++){
          const f=foes[fi];
          const fdx=f.x-p.tx, fdy=f.y-p.ty;
          if(fdx*fdx+fdy*fdy<=(22+f.z)*(22+f.z)){
            // PERF-R12: reuse synth object (avoid per-hit allocation).
            // Synth is used synchronously by takeDamage — not stored anywhere.
            const synth=this._projSynth||(this._projSynth={});
            synth.n=p.n;synth.d=p.d;synth.ability=p.ability;synth.crit=p.crit;synth.team=p.team;
            synth.id=p.owner;synth.c=p.c;synth.r=0;synth.x=p.tx;synth.y=p.ty;
            synth.role=p.role;synth.baseD=p.baseD;synth.dmgDealt=0;
            // For lifesteal on ranged units, heal the real owner instead of synth.
            const owner=idMap.get(p.owner);
            if(owner&&owner.h>0){synth.h=owner.h;synth.mh=owner.mh;synth.d=owner.d;synth.baseD=owner.baseD;}
            else{synth.h=1;synth.mh=1;}
            this.takeDamage(synth,f,foes);
            if(owner){
              if(synth.h>owner.h)owner.h=synth.h; // lifesteal
              if(synth.d>owner.d)owner.d=synth.d; // ramp
              if(owner.dmgDealt!==undefined)owner.dmgDealt+=synth.dmgDealt||0; // MVP tracking
            }
            hit=true;
            if(this.debug)console.log("[HIT] t="+this.time.toFixed(2)+" "+p.n+" proj→"+f.n+"["+f.team+"] d="+p.d);
            break;
          }
        }
        p.dead=true;
      }
      else{
        p.x+=(dx/dd)*sp;
        p.y+=(dy/dd)*sp;
      }
      p.life-=dt;
      if(p.life<=0)p.dead=true;
    }
    // PERF-R12: in-place compaction instead of filter (avoids array allocation + GC).
    // PERF-R12: return dead projectiles to pool (reuse objects, avoid GC).
    if(!this._projPool)this._projPool=[];
    const pool=this._projPool;
    let w=0;
    for(let i=0;i<this.projectiles.length;i++){
      const p=this.projectiles[i];
      if(!p.dead){
        if(w!==i)this.projectiles[w]=p;
        w++;
      }else{
        pool.push(p);
      }
    }
    this.projectiles.length=w;
  },

  // Push overlapping units apart so they don't stack on one pixel.
  // J2: Spatial partitioning via uniform grid hash — O(n) instead of O(n²).
  // PERF-R11: reuse grid Map, use numeric keys, avoid string split/concat, skip pair Set.
  // PERF-R12: hoist offsets array outside function (avoid per-frame allocation).
  // PERF-R12: flattened offsets (avoid nested array indexing).
  _sepOffsetsFlat:[0,0, 1,0, 0,1, 1,1, 1,-1],
  // PERF-R12: flat array grid for separate (avoids Map overhead).
  // Game space is 400×550, cellSize=60 → 7×10 cells. Pad by 1 for negative coords.
  _sepGridW:9,_sepGridH:12,
  _sepFlatGen:null,_sepFlatUnits:null,_sepFlatGenCounter:0,
  // PERF-R12: track non-empty cell keys to avoid Map iterator array allocation.
  _sepKeys:[],
  separate(all){
    const cellSize=60;
    // PERF-R12: flat array grid (avoids Map.get/hash overhead).
    // Lazily init flat arrays on first call.
    if(!this._sepFlatGen){
      const n=this._sepGridW*this._sepGridH;
      this._sepFlatGen=new Int32Array(n);
      this._sepFlatUnits=new Array(n);
      for(let i=0;i<n;i++)this._sepFlatUnits[i]=[];
    }
    const gw=this._sepGridW,gh=this._sepGridH;
    const gen=++this._sepFlatGenCounter;
    const flatGen=this._sepFlatGen;
    const flatUnits=this._sepFlatUnits;
    const keys=this._sepKeys;
    keys.length=0;
    // Bin units into cells with flat array indexing.
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let ui=0;ui<all.length;ui++){
      const u=all[ui];
      if(u.h<=0)continue;
      const cx=Math.floor(u.x/cellSize)+1; // +1 offset for negative coords
      const cy=Math.floor(u.y/cellSize)+1;
      if(cx<0||cx>=gw||cy<0||cy>=gh)continue;
      const idx=cy*gw+cx;
      if(flatGen[idx]!==gen){
        flatGen[idx]=gen;
        flatUnits[idx].length=0;
        flatUnits[idx].push(u);
        keys.push(idx);
      }else{
        flatUnits[idx].push(u);
      }
    }
    // Check collisions within same + adjacent cells.
    const offsets=this._sepOffsetsFlat;
    // PERF-R12: iterate keys array (only non-empty cells).
    for(let ki=0;ki<keys.length;ki++){
      const idx=keys[ki];
      const cell=flatUnits[idx];
      const cx=idx%gw, cy=(idx/gw)|0;
      // Check this cell + 4 adjacent (right, down, down-right, up-right) to avoid double-checks.
      for(let oi=0;oi<10;oi+=2){
        const ncx=cx+offsets[oi],ncy=cy+offsets[oi+1];
        if(ncx<0||ncx>=gw||ncy<0||ncy>=gh)continue;
        const nidx=ncy*gw+ncx;
        if(flatGen[nidx]!==gen)continue;
        const ncell=flatUnits[nidx];
        const sameCell=(offsets[oi]===0&&offsets[oi+1]===0);
        for(let ai=0;ai<cell.length;ai++){
          const a=cell[ai];
          const aSep=a.z*1.8;
          const aSep2=aSep*aSep;
          const bStart=sameCell?ai+1:0;
          for(let bi=bStart;bi<ncell.length;bi++){
            const b=ncell[bi];
            const ddx=b.x-a.x, ddy=b.y-a.y;
            const d2=ddx*ddx+ddy*ddy;
            // D5: keep units at least 1.8× their radius apart so they don't visually overlap.
            const bSep=b.z*1.8;
            const minD2=aSep>bSep?aSep2:bSep*bSep;
            if(d2<minD2){
              // DET: DMath.sqrt for cross-browser determinism.
              const d=DMath.sqrt(d2);
              let nx,ny;
              if(d>0.001){nx=ddx/d;ny=ddy/d;}
              else{const a2=rand()*Math.PI*2;nx=DMath.cos(a2);ny=DMath.sin(a2);}
              const minD=aSep>bSep?aSep:bSep;
              const push=(minD-(d>0.001?d:0.001))/2;
              a.x-=nx*push;a.y-=ny*push;
              b.x+=nx*push;b.y+=ny*push;
            }
          }
        }
      }
    }
  },

  // Background theme palettes — each arena gets a distinct atmosphere.
  // Colors: [topGradient, midGradient, bottomGradient, groundColor, groundAccent, ambientParticleColor]
  _bgThemes:{
    forest: {top:"#0a1a0a",mid:"#0d2410",bot:"#040a05",ground:"#1a2a14",accent:"#2a4a20",ambient:"#5a8a3a",ambientType:"leaf",weather:"rain"},
    plague: {top:"#1a1208",mid:"#241808",bot:"#0a0804",ground:"#2a1e10",accent:"#3a2818",ambient:"#8a6a3a",ambientType:"spore",weather:"fog"},
    desert: {top:"#1a0e04",mid:"#2a1808",bot:"#0a0602",ground:"#3a2410",accent:"#4a3218",ambient:"#fa8a3a",ambientType:"sand",weather:"sandstorm"},
    void:   {top:"#0a0418",mid:"#120828",bot:"#04020a",ground:"#1a0e2a",accent:"#2a1840",ambient:"#a48aff",ambientType:"ember",weather:"voidstorm"},
  },

  // Lazily generate a reusable noise texture on an offscreen canvas.
  // Returns a small tile (128x128) that is tiled across the background.
  _getNoiseCanvas(){
    if(this._noiseCanvas)return this._noiseCanvas;
    const nc=document.createElement("canvas");
    nc.width=128;nc.height=128;
    const nctx=nc.getContext("2d");
    const img=nctx.createImageData(128,128);
    for(let i=0;i<img.data.length;i+=4){
      const v=Math.random()*255;
      img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;
      img.data[i+3]=12; // very faint
    }
    nctx.putImageData(img,0,0);
    this._noiseCanvas=nc;
    return nc;
  },

  drawBackground(c){
    // Use CSS pixel dimensions (not c.canvas.width/height which include DPR scaling).
    const w=this.canvasW||400,h=this.canvasH||550;
    const theme=this._bgThemes[this.bgTheme]||this._bgThemes.forest;
    // PERF-R12: cache entire static background to offscreen canvas.
    // Only dynamic parts (parallax midground + ambient particles) are drawn per frame.
    const bgKey=w+"x"+h+"_"+this.bgTheme+"_"+(G.save?.arena||0);
    if(!this._bgStaticCanvas||this._bgStaticKey!==bgKey){
      this._bgStaticKey=bgKey;
      // Invalidate gradient caches (they're tied to context — will be rebuilt in _renderStaticBackground).
      this._bgGradCache=null;
      this._bgArenaGrad=null;
      this._laneBandCache=null;
      this._bgNoisePat=null;
      const oc=document.createElement("canvas");
      oc.width=w;oc.height=h;
      const bc=oc.getContext("2d");
      this._renderStaticBackground(bc,w,h,theme);
      this._bgStaticCanvas=oc;
    }
    // Draw cached static background.
    if(this._bgStaticCanvas&&this._bgStaticCanvas.width>0&&this._bgStaticCanvas.height>0)
      c.drawImage(this._bgStaticCanvas,0,0);
    // Dynamic parts: parallax midground + ambient particles.
    const grads=this._bgGradCache;
    // Parallax midground — silhouette ridge that drifts with screen shake.
    const shakeX=this.shakeAmount||0;
    const mgY=grads.groundY-30;
    // PERF-R12: cache ridge path points (only recompute when shake changes significantly).
    // Ridge shape is deterministic from mx — only the shakeX offset changes per frame.
    if(!this._ridgePts||this._ridgeW!==w){
      this._ridgeW=w;
      const pts=[];
      for(let mx=0;mx<=w+20;mx+=20){
        pts.push(mx,Math.sin(mx*0.03)*8+Math.sin(mx*0.07)*4);
      }
      this._ridgePts=pts;
    }
    const pts=this._ridgePts;
    const shakeOff=shakeX*0.1;
    c.fillStyle=theme.accent+"18";
    c.beginPath();
    c.moveTo(0,mgY+20);
    for(let i=0;i<pts.length;i+=2){
      // PERF-R12: shake only affects the sin phase, not the ridge shape.
      // Approximate by shifting x in the sin (precomputed without shake).
      c.lineTo(pts[i],mgY+pts[i+1]+Math.sin(pts[i]*0.03+shakeOff)*8-Math.sin(pts[i]*0.03)*8);
    }
    c.lineTo(w,mgY+20);
    c.lineTo(w,h);
    c.lineTo(0,h);
    c.closePath();
    c.fill();
    // Ambient background particles — themed per arena.
    this._updateBgParticles(c,theme);
  },

  // PERF-R12: render static background layers to offscreen canvas (cached).
  _renderStaticBackground(c,w,h,theme){
    const cacheKey=w+"x"+h+"_"+this.bgTheme;
    if(!this._bgGradCache||this._bgGradCacheKey!==cacheKey){
      this._bgGradCacheKey=cacheKey;
      const bgGrad=c.createLinearGradient(0,0,0,h);
      bgGrad.addColorStop(0,theme.top);
      bgGrad.addColorStop(0.5,theme.mid);
      bgGrad.addColorStop(1,theme.bot);
      const fogGrad=c.createLinearGradient(0,0,0,h*0.5);
      fogGrad.addColorStop(0,"rgba(0,0,0,0.35)");
      fogGrad.addColorStop(1,"rgba(0,0,0,0)");
      const groundY=h*0.72;
      const groundGrad=c.createLinearGradient(0,groundY-20,0,groundY+30);
      groundGrad.addColorStop(0,"rgba(0,0,0,0)");
      groundGrad.addColorStop(0.5,theme.ground+"40");
      groundGrad.addColorStop(1,theme.ground+"20");
      this._bgGradCache={bg:bgGrad,fog:fogGrad,ground:groundGrad,groundY};
    }
    const grads=this._bgGradCache;
    // If a sprite background image is loaded, draw it.
    if(this.bgImage&&this.bgImage.complete){
      c.drawImage(this.bgImage,0,0,w,h);
      const grad=c.createLinearGradient(0,h*0.6,0,h);
      grad.addColorStop(0,"rgba(0,0,0,0)");
      grad.addColorStop(1,"rgba(0,0,0,0.5)");
      c.fillStyle=grad;
      c.fillRect(0,0,w,h);
    }else{
      // Procedural gradient background.
      c.fillStyle=grads.bg;
      c.fillRect(0,0,w,h);
      // Noise texture overlay.
      const noise=this._getNoiseCanvas();
      if(noise){
        if(!this._bgNoisePat||this._bgNoiseSrc!==noise){
          this._bgNoisePat=c.createPattern(noise,"repeat");
          this._bgNoiseSrc=noise;
        }
        if(this._bgNoisePat){
          const prevA=c.globalAlpha;
          c.globalAlpha=0.5;
          c.fillStyle=this._bgNoisePat;
          c.fillRect(0,0,w,h);
          c.globalAlpha=prevA;
        }
      }
      // Arena-colored radial glow at center.
      const arena=G.arenas?.[G.save?.arena||0];
      if(arena){
        const rgCacheKey=w+"x"+h+"_"+(arena.c||"");
        if(!this._bgArenaGrad||this._bgArenaGradKey!==rgCacheKey){
          this._bgArenaGradKey=rgCacheKey;
          const rg=c.createRadialGradient(w/2,h*0.45,0,w/2,h*0.45,w*0.6);
          const ac=sanitizeHex(arena.c);
          rg.addColorStop(0,ac+"10");
          rg.addColorStop(1,"rgba(0,0,0,0)");
          this._bgArenaGrad=rg;
        }
        c.fillStyle=this._bgArenaGrad;
        c.fillRect(0,0,w,h);
      }
      // Ground line.
      c.fillStyle=grads.ground;
      c.fillRect(0,grads.groundY-20,w,50);
      c.strokeStyle=theme.accent+"30";
      c.lineWidth=1;
      c.beginPath();
      c.moveTo(0,grads.groundY);
      c.lineTo(w,grads.groundY);
      c.stroke();
      // Decorative ground dots.
      c.fillStyle=theme.accent+"20";
      c.beginPath();
      for(let i=0;i<12;i++){
        const gx=(i*37+13)%w;
        const gy=grads.groundY+((i*23+7)%30)-5;
        c.moveTo(gx+1.5,gy);
        c.arc(gx,gy,1.5,0,Math.PI*2);
      }
      c.fill();
      // Depth fog.
      c.fillStyle=grads.fog;
      c.fillRect(0,0,w,h*0.5);
      // Lane formation bands.
      const canvasH=this.canvasH||h;
      const lbKey=canvasH;
      if(!this._laneBandCache||this._laneBandCacheKey!==lbKey){
        this._laneBandCacheKey=lbKey;
        const laneBands=[
          {yMin:30,yMax:80,color:"#ff4444"},
          {yMin:80,yMax:200,color:"#ff8844"},
          {yMin:350,yMax:540,color:"#4488ff"},
        ];
        const cached=[];
        for(const lane of laneBands){
          const ly=(lane.yMin+lane.yMax)/2*(canvasH/600);
          const lh=(lane.yMax-lane.yMin)*(canvasH/600);
          const lg=c.createLinearGradient(0,ly-lh/2,0,ly+lh/2);
          lg.addColorStop(0,lane.color+"08");
          lg.addColorStop(0.5,lane.color+"0d");
          lg.addColorStop(1,lane.color+"08");
          cached.push({ly,lh,grad:lg,color:lane.color});
        }
        this._laneBandCache=cached;
      }
      for(const lane of this._laneBandCache){
        const ly=lane.ly, lh=lane.lh;
        c.fillStyle=lane.grad;
        c.fillRect(0,ly-lh/2,w,lh);
        c.strokeStyle=lane.color+"15";
        c.lineWidth=1;
        c.setLineDash([6,4]);
        c.beginPath();
        c.moveTo(0,ly-lh/2);
        c.lineTo(w,ly-lh/2);
        c.moveTo(0,ly+lh/2);
        c.lineTo(w,ly+lh/2);
        c.stroke();
        c.setLineDash([]);
      }
      // Center divider.
      const midY=canvasH*0.5;
      c.strokeStyle="rgba(255,255,255,.06)";
      c.lineWidth=1;
      c.setLineDash([8,8]);
      c.beginPath();
      c.moveTo(0,midY);
      c.lineTo(w,midY);
      c.stroke();
      c.setLineDash([]);
    }
  },

  _updateBgParticles(c,theme){
    const w=this.canvasW||400,h=this.canvasH||550;
    // Spawn ambient particles (budget: 15 max).
    if(this._bgParticles.length<15&&Math.random()<0.3){
      const type=theme.ambientType;
      const p={x:Math.random()*w,y:h+10,c:theme.ambient,life:1,type};
      switch(type){
        case "leaf":
          p.vx=(Math.random()-0.5)*15;p.vy=-8-Math.random()*12;p.r=2+Math.random()*1.5;p.life=4+Math.random()*2;break;
        case "spore":
          p.vx=(Math.random()-0.5)*8;p.vy=-3-Math.random()*5;p.r=1.5+Math.random();p.life=5+Math.random()*3;break;
        case "sand":
          p.vx=10+Math.random()*20;p.vy=(Math.random()-0.5)*5;p.r=1+Math.random();p.life=3+Math.random()*2;break;
        case "ember":
          p.vx=(Math.random()-0.5)*10;p.vy=-15-Math.random()*20;p.r=1.5+Math.random();p.life=2+Math.random()*1.5;break;
      }
      p.maxLife=p.life;
      this._bgParticles.push(p);
    }
    // Update + draw.
    const dt=0.016;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let i=0;i<this._bgParticles.length;i++){
      const p=this._bgParticles[i];
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.life-=dt;
      if(p.type==="leaf")p.x+=Math.sin(p.life*2)*0.5; // sway
      if(p.type==="ember")p.vy-=5*dt; // accelerate upward
    }
    // PERF-R12: in-place compaction (avoids filter array allocation).
    let bpW=0;
    for(let i=0;i<this._bgParticles.length;i++){
      const p=this._bgParticles[i];
      if(p.life>0&&p.y>-20&&p.y<h+20&&p.x>-20&&p.x<w+20){
        if(bpW!==i)this._bgParticles[bpW]=p;
        bpW++;
      }
    }
    this._bgParticles.length=bpW;
    // Draw behind units (already on canvas, before unit draw).
    // PERF-R12: set fillStyle once (all particles use same color = theme.ambient).
    c.fillStyle=theme.ambient;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let i=0;i<this._bgParticles.length;i++){
      const p=this._bgParticles[i];
      const a=Math.min(1,p.life/p.maxLife)*0.6;
      c.globalAlpha=a;
      c.beginPath();
      c.arc(p.x,p.y,p.r,0,Math.PI*2);
      c.fill();
    }
    c.globalAlpha=1;
  },

  // Load a sprite background image from a URL (for future sprite-based backgrounds).
  // When loaded, drawBackground() will use it instead of the procedural gradient.
  loadBgImage(url){
    if(!url){this.bgImage=null;return;}
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{this.bgImage=img;};
    img.onerror=()=>{this.bgImage=null;};
    img.src=url;
  },

  // R2: Weather/environment FX — overlay particles for rain, snow, fog, sandstorm, voidstorm.
  // Drawn AFTER units (foreground overlay) for rain/snow; fog is a gradient overlay.
  _weatherConfig:{
    rain:      {count:60,vy:300,vx:-30,color:"rgba(150,180,220,0.4)",len:8,w:1,type:"streak"},
    fog:       {count:0,vy:0,vx:0,color:"rgba(180,180,200,0.08)",type:"gradient"},
    sandstorm: {count:50,vy:20,vx:120,color:"rgba(200,160,80,0.3)",len:4,w:1.5,type:"streak"},
    voidstorm: {count:40,vy:-50,vx:0,color:"rgba(164,138,255,0.5)",len:3,w:2,type:"spark"},
  },
  _updateWeather(c){
    const theme=this._bgThemes[this.bgTheme]||this._bgThemes.forest;
    const weather=theme.weather;
    if(!weather)return;
    const cfg=this._weatherConfig[weather];
    if(!cfg)return;
    const w=this.canvasW||400,h=this.canvasH||550;
    const dt=0.016;
    const _qTier=G.qualityTier?.()||"high";
    const _reducedMotion=G.save?.settings?.reducedMotion;
    if(_qTier==="low"||_qTier==="minimal"||_reducedMotion)return; // R2: skip on low quality

    // Fog: gradient overlay (no particles).
    if(weather==="fog"){
      const fogGrad=c.createLinearGradient(0,h*0.3,0,h);
      fogGrad.addColorStop(0,"rgba(180,180,200,0)");
      fogGrad.addColorStop(0.5,cfg.color);
      fogGrad.addColorStop(1,"rgba(180,180,200,0)");
      c.fillStyle=fogGrad;
      c.fillRect(0,0,w,h);
      // R2: drifting fog patches.
      if(this._weatherParticles.length<5){
        this._weatherParticles.push({x:Math.random()*w,y:h*0.4+Math.random()*h*0.4,r:80+Math.random()*60,vx:5+Math.random()*10,life:10});
      }
      c.globalCompositeOperation="screen";
      for(let i=0;i<this._weatherParticles.length;i++){
        const p=this._weatherParticles[i];
        p.x+=p.vx*dt;p.life-=dt;
        c.globalAlpha=Math.min(0.15,p.life/10*0.15);
        c.fillStyle=cfg.color;
        c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);c.fill();
      }
      c.globalAlpha=1;c.globalCompositeOperation="source-over";
      // compact
      let wW=0;
      for(let i=0;i<this._weatherParticles.length;i++){
        const p=this._weatherParticles[i];
        if(p.life>0&&p.x<w+100){if(wW!==i)this._weatherParticles[wW]=p;wW++;}
      }
      this._weatherParticles.length=wW;
      return;
    }

    // Particle-based weather: rain, sandstorm, voidstorm.
    if(cfg.count>0){
      // Spawn particles up to budget.
      while(this._weatherParticles.length<cfg.count){
        const p={x:Math.random()*w,y:Math.random()*h,vx:cfg.vx+(Math.random()-0.5)*20,vy:cfg.vy+(Math.random()-0.5)*30,life:Infinity};
        if(weather==="voidstorm"){p.r=1+Math.random()*2;p.flicker=Math.random()*Math.PI*2;}
        this._weatherParticles.push(p);
      }
      // Update + draw.
      c.globalCompositeOperation="lighter";
      c.strokeStyle=cfg.color;
      c.fillStyle=cfg.color;
      for(let i=0;i<this._weatherParticles.length;i++){
        const p=this._weatherParticles[i];
        p.x+=p.vx*dt;
        p.y+=p.vy*dt;
        // Wrap around screen.
        if(p.y>h+20){p.y=-20;p.x=Math.random()*w;}
        if(p.y<-20){p.y=h+20;p.x=Math.random()*w;}
        if(p.x>w+20)p.x=-20;
        if(p.x<-20)p.x=w+20;
        if(cfg.type==="streak"){
          // Rain/sandstorm: streak line in direction of motion.
          const dx=p.vx*0.02,dy=p.vy*0.02;
          c.lineWidth=cfg.w;
          c.globalAlpha=0.6;
          c.beginPath();
          c.moveTo(p.x,p.y);
          c.lineTo(p.x-dx*(cfg.len||5),p.y-dy*(cfg.len||5));
          c.stroke();
        }else if(cfg.type==="spark"){
          // Voidstorm: flickering sparks.
          p.flicker+=dt*10;
          c.globalAlpha=0.4+0.3*Math.sin(p.flicker);
          c.beginPath();
          c.arc(p.x,p.y,p.r,0,Math.PI*2);
          c.fill();
        }
      }
      c.globalAlpha=1;c.globalCompositeOperation="source-over";
    }
  },

  render(){
    let c=this.ctx;
    if(!c)return;
    // PERF-R12: cache per-frame values used by SpriteRenderer (avoid per-unit property access).
    SpriteRenderer._frameRM=G.save?.settings?.reducedMotion||false;
    SpriteRenderer._frameUnitCount=this.units.length;
    // Clear the full canvas (in raw pixel space) to prevent artifacts from
    // previous frames, especially during screen transitions or resize.
    c.save();
    c.setTransform(1,0,0,1,0,0);
    c.clearRect(0,0,c.canvas.width,c.canvas.height);
    c.restore();
    // canvasH/canvasW are set in CSS pixels at init/resize time. Do NOT sync from
    // c.canvas.height (which is raw pixels including DPR) — that would overwrite
    // the CSS value and break clamping.
    // Themed background (gradient + ground line + ambient particles) — fills viewport.
    this.drawBackground(c);
    // Apply game-space transform: map 400x550 game coords to fill the viewport (cover).
    const gt=this._gameTransform();
    c.save();
    c.translate(gt.offsetX,gt.offsetY);
    c.scale(gt.scale,gt.scale);
    // Phase 17: apply screen shake transform (in game space).
    const shake=this.shakeAmount||0;
    if(shake>0){
      c.save();
      c.translate((Math.random()-0.5)*shake*2,(Math.random()-0.5)*shake*2);
    }
    try{
    // PERF-R12: two-pass render for color batching.
    // Pass 1: shadows + sprites + hit flashes (per unit, depth-ordered with lunge).
    // Pass 2: status rings + HP bars + names (batched by color, original position).
    // PERF-R12: cache this.time (accessed 12+ times in render, avoid repeated property access).
    const time=this.time;
    const manyUnits=Battle.units.length>30;
    const manyUnitsR=manyUnits;
    const ringPulse=manyUnitsR?1:1+0.04*Math.sin(time*6);
    // Collect Pass 2 data during Pass 1 (avoid second iteration over units).
    // PERF-R12: reuse arrays to avoid per-frame allocation.
    if(!this._renderPass2)this._renderPass2=[];
    const pass2=this._renderPass2;
    let pass2Len=0;
    // units
    // PERF-R12: merged shadow + sprite pass (avoid calling getLungeOffset/getSpawnScale twice per unit).
    // Shadows are drawn first with fillStyle="#000", then sprites on top.
    // PERF-R12: index loop (avoid for...of iterator allocation).
    // Pass 0: team-colored glow auras (batched by team — 2 fillStyle changes instead of 100).
    // Drawn before shadows so it appears behind everything.
    c.globalAlpha=0.12;
    c.fillStyle=TEAM_COLORS.player;
    c.beginPath();
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(!u||u.x===undefined)continue;
      if(u.h<=0&&u.deathT===undefined)continue;
      if(u.team!=="player")continue;
      const lunge=BattleFX.getLungeOffset(u);
      const sx=u.x+lunge.x, sy=u.y+lunge.y;
      c.moveTo(sx+(u.z||10)*1.4,sy);
      c.ellipse(sx,sy,(u.z||10)*1.4,(u.z||10)*1.6,0,0,Math.PI*2);
    }
    c.fill();
    c.fillStyle=TEAM_COLORS.enemy;
    c.beginPath();
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(!u||u.x===undefined)continue;
      if(u.h<=0&&u.deathT===undefined)continue;
      if(u.team!=="enemy")continue;
      const lunge=BattleFX.getLungeOffset(u);
      const sx=u.x+lunge.x, sy=u.y+lunge.y;
      c.moveTo(sx+(u.z||10)*1.4,sy);
      c.ellipse(sx,sy,(u.z||10)*1.4,(u.z||10)*1.6,0,0,Math.PI*2);
    }
    c.fill();
    c.globalAlpha=1;
    // Pass 1a: shadows (batched fillStyle="#000").
    // PERF-R12: batch alive-unit shadows into single path (constant alpha=0.35).
    // Dying units have per-unit alpha → drawn separately after.
    c.fillStyle="#000";
    c.globalAlpha=0.35;c.beginPath();
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(!u||u.x===undefined)continue;
      if(u.h<=0&&u.deathT===undefined)continue;
      const lunge=BattleFX.getLungeOffset(u);
      const spawnScale=BattleFX.getSpawnScale(u);
      // PERF-R12: cache lunge/spawnScale on unit for sprite pass (avoid double compute).
      u._renderLungeX=lunge.x;u._renderLungeY=lunge.y;u._renderSpawnScale=spawnScale;
      const sx=u.x+lunge.x, sy=u.y+lunge.y, sz=u.z*spawnScale;
      if(u.deathT===undefined){
        // Alive unit — add to batched shadow path.
        c.moveTo(sx+sz*0.9,sy+sz*0.9);
        c.ellipse(sx,sy+sz*0.9,sz*0.9,sz*0.35,0,0,Math.PI*2);
      }else{
        // Dying unit — store for per-unit alpha pass.
        const shadowAlpha=Math.max(0,1-u.deathT/0.5)*0.35;
        if(shadowAlpha>0.02){
          u._shadowAlpha=shadowAlpha;u._shadowSx=sx;u._shadowSy=sy+sz*0.9;u._shadowSz=sz;
        }else u._shadowAlpha=0;
      }
    }
    c.fill();
    // Dying unit shadows (per-unit alpha — can't batch).
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(u._shadowAlpha&&u._shadowAlpha>0.02){
        c.globalAlpha=u._shadowAlpha;
        c.beginPath();
        c.ellipse(u._shadowSx,u._shadowSy,u._shadowSz*0.9,u._shadowSz*0.35,0,0,Math.PI*2);
        c.fill();
      }
    }
    c.globalAlpha=1;
    // Pass 1b: sprites + hit flashes (per unit, depth-ordered with lunge).
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      if(!u||u.x===undefined)continue;
      if(u.h<=0&&u.deathT===undefined)continue;
      // Phase 17: apply lunge offset + spawn scale (use cached values from shadow pass).
      const lungeX=u._renderLungeX||0,lungeY=u._renderLungeY||0,spawnScale=u._renderSpawnScale||1;
      const origX=u.x,origY=u.y,origZ=u.z;
      u.x=origX+lungeX;
      u.y=origY+lungeY;
      u.z=origZ*spawnScale;
      // Phase 11: use SpriteRenderer for units with recipes, fallback otherwise.
      const hasRecipe=!!u.recipe;
      if(hasRecipe){
        SpriteRenderer.draw(c,u);
      }else{
        const alpha=u.deathT!==undefined?Math.max(0,1-u.deathT/0.5):1;
        c.globalAlpha=alpha;
        c.fillStyle=u.c;
        SpriteRenderer._drawRoleShape(c,u);
        c.fill();
        c.strokeStyle=TEAM_COLORS[u.team]||"#888";
        c.stroke();
        c.globalAlpha=1;
      }
      // Phase 17: hit flash overlay (white tint on top of sprite).
      if(u.hitFlash>0){
        c.globalAlpha=Math.min(0.6,u.hitFlash/0.08*0.6);
        c.fillStyle="#fff";
        SpriteRenderer._drawRoleShape(c,u);
        c.fill();
        c.globalAlpha=1;
      }
      // Restore original position (lunge is visual only).
      u.x=origX;u.y=origY;u.z=origZ;
      // Collect Pass 2 data (status rings + HP bar + name).
      // PERF-R12: update HP bar smoothing here (needs dt, not in pass 2).
      if(u.dispH===undefined)u.dispH=u.h;
      u.dispH+=(u.h-u.dispH)*Math.min(1,(this._lastDt||0.05)*8);
      if(u.ghostH===undefined)u.ghostH=u.h;
      u.ghostH+=(u.h-u.ghostH)*Math.min(1,(this._lastDt||0.05)*3);
      const spriteTop=origY-(origZ||10)/10*1.8*26;
      const entry=pass2[pass2Len]||(pass2[pass2Len]={});
      entry.u=u;
      entry.x=origX;
      entry.y=origY;
      entry.z=origZ;
      entry.spriteTop=spriteTop;
      entry.hpRatio=Math.max(0,u.dispH/u.mh);
      entry.ghostRatio=Math.max(0,u.ghostH/u.mh);
      pass2Len++;
    }
    // Pass 2: status rings + ability flash + name + low-HP warning + HP bar.
    // PERF-R12: batch HP bar by color — group all same-color fillRects together.
    // This reduces fillStyle changes from ~500 to ~7 per frame (100 units × 5 colors → 7 groups).
    // Status rings + ability flash.
    // PERF-R12: when manyUnitsR, batch by status type (constant alpha per type).
    // Reduces ~400 state changes (100 units × 4 statuses) to ~12 (4 types × 3 states).
    if(manyUnitsR){
      // PERF-R12: batch all same-type rings into a single path (one stroke call per type).
      // Research: drawing N arcs in 1 path + 1 stroke() is ~2x faster than N × (beginPath+arc+stroke).
      // Shield rings (strokeStyle="#fff", lineWidth=2, alpha=0.8).
      c.strokeStyle="#fff";c.lineWidth=2;c.globalAlpha=0.8;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.shieldActive>0){c.moveTo(pass2[i].x+(pass2[i].z+3)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+3)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      // Stun rings (strokeStyle="#ff0", lineWidth=2, alpha=0.7).
      c.strokeStyle="#ff0";c.globalAlpha=0.7;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.stun>0){c.moveTo(pass2[i].x+(pass2[i].z+3)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+3)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      // Poison rings (strokeStyle="#3f3", alpha=0.6).
      c.strokeStyle="#3f3";c.lineWidth=1;c.globalAlpha=0.6;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.poison>0){c.moveTo(pass2[i].x+(pass2[i].z+6)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+6)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      // Slow rings (strokeStyle="#39f", alpha=0.6).
      c.strokeStyle="#39f";c.globalAlpha=0.6;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.slow>0){c.moveTo(pass2[i].x+(pass2[i].z+9)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+9)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      // C1: Silence rings (strokeStyle="#c4f", alpha=0.6, dashed).
      c.strokeStyle="#c4f";c.globalAlpha=0.6;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.silence>0){c.moveTo(pass2[i].x+(pass2[i].z+3)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+3)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      // C2: Stealth rings (strokeStyle="#888", alpha=0.4, dashed).
      c.strokeStyle="#888";c.globalAlpha=0.4;c.beginPath();
      for(let i=0;i<pass2Len;i++){const u=pass2[i].u;if(u.stealth>0){c.moveTo(pass2[i].x+(pass2[i].z+6)*ringPulse,pass2[i].y);c.arc(pass2[i].x,pass2[i].y,(pass2[i].z+6)*ringPulse,0,Math.PI*2);}}
      c.stroke();
      c.globalAlpha=1;c.lineWidth=1;
      // Ability flash (per-unit — alpha varies, can't batch).
      for(let i=0;i<pass2Len;i++){
        const u=pass2[i].u;
        if(u.abFlash>0){
          const t=1-u.abFlash/0.4;
          c.globalAlpha=Math.max(0,1-t);
          c.strokeStyle=u.abFlashColor||"#fff";
          c.lineWidth=3;
          c.beginPath();
          c.arc(pass2[i].x,pass2[i].y,pass2[i].z+4+t*15,0,Math.PI*2);
          c.stroke();
          c.lineWidth=1;
          c.globalAlpha=1;
        }
      }
    }else{
      // Low unit count: per-unit rings with pulsing alpha (visual quality).
      for(let i=0;i<pass2Len;i++){
        const e=pass2[i];
        const u=e.u;
        if(u.shieldActive>0){c.strokeStyle="#fff";c.lineWidth=2;c.globalAlpha=0.7+0.3*Math.sin(time*5);c.beginPath();c.arc(e.x,e.y,(e.z+3)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.stun>0){c.strokeStyle="#ff0";c.lineWidth=2;c.globalAlpha=0.6+0.4*Math.sin(time*8);c.beginPath();c.arc(e.x,e.y,(e.z+3)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.poison>0){c.strokeStyle="#3f3";c.globalAlpha=0.5+0.3*Math.sin(time*3);c.beginPath();c.arc(e.x,e.y,(e.z+6)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.slow>0){c.strokeStyle="#39f";c.globalAlpha=0.5+0.3*Math.sin(time*3);c.beginPath();c.arc(e.x,e.y,(e.z+9)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.silence>0){c.strokeStyle="#c4f";c.globalAlpha=0.5+0.3*Math.sin(time*4);c.beginPath();c.arc(e.x,e.y,(e.z+3)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.stealth>0){c.strokeStyle="#888";c.globalAlpha=0.3+0.2*Math.sin(time*2);c.beginPath();c.arc(e.x,e.y,(e.z+6)*ringPulse,0,Math.PI*2);c.stroke();c.globalAlpha=1;c.lineWidth=1;}
        if(u.abFlash>0){
          const t=1-u.abFlash/0.4;
          c.globalAlpha=Math.max(0,1-t);
          c.strokeStyle=u.abFlashColor||"#fff";
          c.lineWidth=3;
          c.beginPath();
          c.arc(e.x,e.y,e.z+4+t*15,0,Math.PI*2);
          c.stroke();
          c.lineWidth=1;
          c.globalAlpha=1;
        }
      }
    }
    // Name text (only when <=30 units — text rendering is expensive).
    if(!manyUnits){
      c.textAlign="center";
      c.strokeStyle="rgba(0,0,0,0.7)";c.lineWidth=2.5;
      for(let i=0;i<pass2Len;i++){
        const e=pass2[i];
        const u=e.u;
        c.fillStyle=TEAM_COLORS[u.team]||"#fff";c.font="9px sans-serif";
        c.strokeText(u.n,e.x,e.spriteTop-2);
        c.fillText(u.n,e.x,e.spriteTop-2);
      }
      c.lineWidth=1;
      // Role indicator dots.
      for(let i=0;i<pass2Len;i++){
        const e=pass2[i];
        const u=e.u;
        if(u.role){
          c.fillStyle=ROLE_COLORS[u.role]||"#fff";
          c.beginPath();c.arc(e.x-20,e.spriteTop,2,0,Math.PI*2);c.fill();
        }
      }
      // Low-HP warning: pulsing red glow when HP < 25%.
      const pulse=Math.sin(time*8)*0.5+0.5;
      for(let i=0;i<pass2Len;i++){
        const e=pass2[i];
        const u=e.u;
        if(u.h>0&&u.h<u.mh*0.25){
          c.globalAlpha=0.3+pulse*0.3;
          c.strokeStyle=TEAM_COLORS[u.team]||"#fb7185";
          c.lineWidth=2;
          c.beginPath();
          c.arc(e.x,e.y,e.z+5+pulse*3,0,Math.PI*2);
          c.stroke();
          c.lineWidth=1;
          c.globalAlpha=1;
        }
      }
    }
    // HP bars — batched by color (groups: bg, tint, border, ghost, green, yellow, red, highlight).
    // Group 1: All backgrounds (#1a1a2e) — 1 fillStyle, 1 pass.
    c.fillStyle="#1a1a2e";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      c.fillRect(e.x-18,e.spriteTop+8,36,5);
    }
    // Group 1b: Team-colored background tint (subtle — helps identify team at a glance).
    // 2 fillStyle changes total (player, enemy), 2 passes.
    c.globalAlpha=0.15;
    c.fillStyle=TEAM_COLORS.player;
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.u.team==="player")c.fillRect(e.x-18,e.spriteTop+8,36,5);
    }
    c.fillStyle=TEAM_COLORS.enemy;
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.u.team==="enemy")c.fillRect(e.x-18,e.spriteTop+8,36,5);
    }
    c.globalAlpha=1;
    // Group 2: Borders by team (batched — 2 strokeStyle sets instead of N).
    // Thicker border (2px) for clear team identification.
    c.lineWidth=2;
    c.strokeStyle=TEAM_COLORS.player;
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.u.team==="player")c.strokeRect(e.x-18,e.spriteTop+8,36,5);
    }
    c.strokeStyle=TEAM_COLORS.enemy;
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.u.team==="enemy")c.strokeRect(e.x-18,e.spriteTop+8,36,5);
    }
    // Group 3: Ghost bars (rgba(255,255,255,0.25)) — only units with ghost > hp.
    c.fillStyle="rgba(255,255,255,0.25)";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.ghostRatio>e.hpRatio+0.01){
        c.fillRect(e.x-18,e.spriteTop+8,36*e.ghostRatio,5);
      }
    }
    // Group 4: HP fills by color (green > 50%, yellow > 25%, red).
    c.fillStyle="#34d399";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.hpRatio>0.5)c.fillRect(e.x-18,e.spriteTop+8,36*e.hpRatio,5);
    }
    c.fillStyle="#fbbf24";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.hpRatio>0.25&&e.hpRatio<=0.5)c.fillRect(e.x-18,e.spriteTop+8,36*e.hpRatio,5);
    }
    c.fillStyle="#fb7185";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.hpRatio>0&&e.hpRatio<=0.25)c.fillRect(e.x-18,e.spriteTop+8,36*e.hpRatio,5);
    }
    // Group 5: Top highlights (rgba(255,255,255,0.35)) — only units with hp > 0.
    c.fillStyle="rgba(255,255,255,0.35)";
    for(let i=0;i<pass2Len;i++){
      const e=pass2[i];
      if(e.hpRatio>0)c.fillRect(e.x-18,e.spriteTop+8,36*e.hpRatio,1);
    }
    // projectiles — weapon-specific shapes with glowing trail.
    const projPrev=c.globalCompositeOperation;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let pi=0;pi<this.projectiles.length;pi++){
      const p=this.projectiles[pi];
      const wt=p.weaponType||"none";
      const accent=p.accent||p.c;
      const dx=p.tx-p.x,dy=p.ty-p.y;
      const angle=Math.atan2(dy,dx);
      // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
      const dist=Math.sqrt(dx*dx+dy*dy)||1;
      // Trail — R5: weapon-specific trail styles (variety per weapon type).
      c.globalCompositeOperation="lighter";
      c.strokeStyle=accent;
      if(p.trail&&p._trailLen>1){
        const tl=p._trailLen;
        // R5: trail style depends on weapon type.
        if(wt==="staff"||wt==="wand"||wt==="orb"){
          // R5: Magic trail — dotted glowing orbs with pulsing alpha.
          for(let i=0;i<tl;i++){
            const a=(i+1)/tl*0.6;
            const r=2+a*3;
            c.globalAlpha=a*(0.7+0.3*Math.sin(time*10+i));
            c.fillStyle=accent;
            c.beginPath();
            c.arc(p.trail[i*2],p.trail[i*2+1],r,0,Math.PI*2);
            c.fill();
          }
        }else if(wt==="bow"||wt==="crossbow"){
          // R5: Arrow trail — thin double-line (motion blur effect).
          for(let i=0;i<tl-1;i++){
            const a=(i+1)/tl*0.35;
            c.globalAlpha=a;
            c.lineWidth=1;
            c.beginPath();
            c.moveTo(p.trail[i*2],p.trail[i*2+1]-1);
            c.lineTo(p.trail[(i+1)*2],p.trail[(i+1)*2+1]-1);
            c.stroke();
            c.beginPath();
            c.moveTo(p.trail[i*2],p.trail[i*2+1]+1);
            c.lineTo(p.trail[(i+1)*2],p.trail[(i+1)*2+1]+1);
            c.stroke();
          }
        }else if(wt==="rifle"){
          // R5: Bullet trail — smoke puffs (expanding fading circles).
          for(let i=0;i<tl;i++){
            const a=(i+1)/tl*0.3;
            const r=3+(tl-i)*1.5;
            c.globalAlpha=a;
            c.fillStyle=accent;
            c.beginPath();
            c.arc(p.trail[i*2],p.trail[i*2+1],r,0,Math.PI*2);
            c.fill();
          }
        }else if(wt==="breath"){
          // R5: Breath trail — flickering flame particles (orange/yellow gradient).
          for(let i=0;i<tl;i++){
            const a=(i+1)/tl*0.5;
            const flick=0.7+0.3*Math.sin(time*20+i*2);
            c.globalAlpha=a*flick;
            c.fillStyle=i%2?"#fc4":"#f80";
            c.beginPath();
            c.arc(p.trail[i*2],p.trail[i*2+1],3+a*2,0,Math.PI*2);
            c.fill();
          }
        }else if(wt==="trident"||wt==="spear"){
          // R5: Spear trail — sharp wedge (tapered line, wider at base).
          for(let i=0;i<tl-1;i++){
            const a=(i+1)/tl*0.4;
            c.globalAlpha=a;
            c.lineWidth=0.5+a*3;
            c.beginPath();
            c.moveTo(p.trail[i*2],p.trail[i*2+1]);
            c.lineTo(p.trail[(i+1)*2],p.trail[(i+1)*2+1]);
            c.stroke();
          }
        }else{
          // R5: Default trail — fading line segments (original style).
          for(let i=0;i<tl-1;i++){
            const a=(i+1)/tl*0.5;
            c.globalAlpha=a;
            c.lineWidth=2+a*2;
            c.beginPath();
            c.moveTo(p.trail[i*2],p.trail[i*2+1]);
            c.lineTo(p.trail[(i+1)*2],p.trail[(i+1)*2+1]);
            c.stroke();
          }
        }
      }
      // PERF-R12: reset globalAlpha after trail (trail loop leaves it at last segment value).
      c.globalAlpha=1;
      // Weapon-specific projectile shape.
      c.save();
      c.translate(p.x,p.y);
      c.rotate(angle);
      if(wt==="bow"||wt==="crossbow"){
        // Arrow: elongated shaft + arrowhead triangle + fletching.
        c.globalCompositeOperation="source-over";
        c.globalAlpha=1;
        c.strokeStyle=accent;
        c.lineWidth=1.5;
        c.beginPath();c.moveTo(-8,0);c.lineTo(5,0);c.stroke(); // shaft
        c.fillStyle=accent;
        c.beginPath();c.moveTo(5,0);c.lineTo(0,-2.5);c.lineTo(0,2.5);c.closePath();c.fill(); // head
        c.strokeStyle=p.c;c.lineWidth=1;
        c.beginPath();c.moveTo(-8,0);c.lineTo(-10,-2);c.moveTo(-8,0);c.lineTo(-10,2);c.stroke(); // fletching
        // Glow tip (additive).
        c.globalCompositeOperation="lighter";
        c.globalAlpha=0.5;c.fillStyle=accent;
        c.beginPath();c.arc(5,0,3,0,Math.PI*2);c.fill();
      }else if(wt==="staff"||wt==="wand"||wt==="orb"){
        // Magic bolt: pulsating orb + energy aura.
        const pulse=1+0.2*Math.sin(time*15);
        c.globalCompositeOperation="lighter";
        c.globalAlpha=0.3;c.fillStyle=accent;
        c.beginPath();c.arc(0,0,8*pulse,0,Math.PI*2);c.fill(); // outer aura
        c.globalAlpha=0.6;c.fillStyle=p.c;
        c.beginPath();c.arc(0,0,5*pulse,0,Math.PI*2);c.fill(); // mid glow
        c.globalAlpha=1;c.fillStyle="#fff";
        c.beginPath();c.arc(0,0,2.5,0,Math.PI*2);c.fill(); // bright core
        // Sparkle particles around bolt.
        c.globalAlpha=0.4;c.strokeStyle=accent;c.lineWidth=1;
        for(let s=0;s<3;s++){
          const sa=time*8+s*Math.PI*2/3;
          c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(sa)*6,Math.sin(sa)*6);c.stroke();
        }
      }else if(wt==="rifle"){
        // Bullet: small bright tracer + muzzle glow.
        c.globalCompositeOperation="lighter";
        c.globalAlpha=0.5;c.fillStyle=accent;
        c.beginPath();c.arc(0,0,5,0,Math.PI*2);c.fill();
        c.globalAlpha=1;c.fillStyle="#fff";
        c.beginPath();c.ellipse(0,0,4,1.5,0,0,Math.PI*2);c.fill(); // elongated tracer
      }else if(wt==="breath"){
        // Dragon breath: fireball with flickering flame particles.
        c.globalCompositeOperation="lighter";
        const flick=0.8+0.2*Math.sin(time*20+p.x*0.1);
        c.globalAlpha=0.4;c.fillStyle="#f80";
        c.beginPath();c.arc(0,0,7*flick,0,Math.PI*2);c.fill();
        c.globalAlpha=0.6;c.fillStyle="#fc4";
        c.beginPath();c.arc(0,0,4*flick,0,Math.PI*2);c.fill();
        c.globalAlpha=1;c.fillStyle="#ff0";
        c.beginPath();c.arc(0,0,2,0,Math.PI*2);c.fill();
      }else if(wt==="trident"||wt==="spear"){
        // Spear/trident: long shaft + pointed tip.
        c.globalCompositeOperation="source-over";
        c.globalAlpha=1;
        c.strokeStyle=accent;c.lineWidth=2;
        c.beginPath();c.moveTo(-10,0);c.lineTo(6,0);c.stroke(); // shaft
        c.fillStyle=accent;
        c.beginPath();c.moveTo(6,0);c.lineTo(0,-3);c.lineTo(0,3);c.closePath();c.fill(); // tip
        if(wt==="trident"){
          c.beginPath();c.moveTo(3,-3);c.lineTo(6,-4);c.lineTo(6,-1);c.fill();
          c.beginPath();c.moveTo(3,3);c.lineTo(6,4);c.lineTo(6,1);c.fill();
        }
        c.globalCompositeOperation="lighter";
        c.globalAlpha=0.4;c.fillStyle=accent;
        c.beginPath();c.arc(6,0,3,0,Math.PI*2);c.fill();
      }else{
        // Default: glowing orb (for any other ranged weapon).
        c.globalCompositeOperation="lighter";
        c.globalAlpha=0.4;c.fillStyle=accent;
        c.beginPath();c.arc(0,0,7,0,Math.PI*2);c.fill();
        c.globalAlpha=1;c.fillStyle="#fff";
        c.beginPath();c.arc(0,0,2.5,0,Math.PI*2);c.fill();
      }
      c.restore();
    }
    c.globalAlpha=1;
    c.globalCompositeOperation=projPrev;
    // Phase 23: draw persistent spell zones.
    for(let zi=0;zi<this.zones.length;zi++){
      const z=this.zones[zi];
      const pulse=0.2+0.1*Math.sin(time*4);
      // PERF-R12: use hoisted ZONE_FX_COLORS constant (avoid per-zone object allocation).
      const color=ZONE_FX_COLORS[z.spec.fxType]||"#fa4";
      c.save();
      // Additive fill for energy glow.
      c.globalCompositeOperation="lighter";
      c.globalAlpha=pulse*0.6;
      c.fillStyle=color;
      c.beginPath();
      c.arc(z.x,z.y,z.radius,0,Math.PI*2);
      c.fill();
      // Inner swirling rings — animated texture inside the zone.
      c.globalAlpha=pulse*0.4;
      c.strokeStyle=color;
      c.lineWidth=1.5;
      for(let ring=0;ring<3;ring++){
        const rr=z.radius*(0.3+ring*0.25)*(1+0.08*Math.sin(time*3+ring*1.2));
        c.beginPath();
        c.arc(z.x,z.y,rr,0,Math.PI*2);
        c.stroke();
      }
      // Crisp edge ring (normal blending).
      c.globalCompositeOperation="source-over";
      c.globalAlpha=0.6;
      c.strokeStyle=color;
      c.lineWidth=2;
      c.beginPath();
      c.arc(z.x,z.y,z.radius,0,Math.PI*2);
      c.stroke();
      c.restore();
    }
    // Phase 17: draw particles on top.
    BattleFX.drawParticles(c);
    // Draw floating damage numbers on top of everything.
    this.drawDmgNums(c);
    // R2: weather/environment FX overlay (rain, fog, sandstorm, voidstorm).
    this._updateWeather(c);
    // Phase 17: restore shake transform.
    }finally{if(shake>0)c.restore();}
    // Restore game-space transform.
    c.restore();
    // Phase 17: draw round-end flash (in screen space, full canvas).
    BattleFX.drawRoundFlash(c);
    // Vignette — radial darkening at screen edges for cinematic framing.
    // PERF-R12: cache the vignette gradient — it only depends on canvas size.
    const vw=this.canvasW||400,vh=this.canvasH||550;
    if(!this._vignetteCache||this._vignetteVW!==vw||this._vignetteVH!==vh){
      this._vignetteVW=vw;this._vignetteVH=vh;
      this._vignetteCache=c.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*0.35,vw/2,vh/2,Math.max(vw,vh)*0.75);
      this._vignetteCache.addColorStop(0,"rgba(0,0,0,0)");
      this._vignetteCache.addColorStop(1,"rgba(0,0,0,0.45)");
    }
    c.fillStyle=this._vignetteCache;
    c.fillRect(0,0,vw,vh);
    // Post-processing: bloom via downscale-upscale (no ctx.filter, GPU-accelerated).
    // Draws the scene to a 1/4 res offscreen canvas (natural blur from downscaling),
    // then composites back with additive blend for a soft glow on bright areas.
    // Skipped on low/minimal quality or reduced motion (perf + accessibility).
    this._applyBloom(c);
  },

  // PERF-R13: bloom post-processing via downscale-upscale.
  // No ctx.filter (removed in PERF-R11 for being 10-50x slower). Instead uses
  // browser's image smoothing on downscale → natural blur → additive composite.
  // Cost: 2 drawImage calls (GPU-accelerated). ~0.3ms at 1080p.
  _bloomCanvas:null,
  _applyBloom(c){
    const qTier=G.qualityTier?.()||"high";
    if(qTier==="low"||qTier==="minimal")return;
    if(G.save?.settings?.reducedMotion)return;
    const cv=c.canvas;
    const bw=Math.max(1,(cv.width/4)|0);
    const bh=Math.max(1,(cv.height/4)|0);
    if(!this._bloomCanvas||this._bloomCanvas.width!==bw||this._bloomCanvas.height!==bh){
      this._bloomCanvas=document.createElement("canvas");
      this._bloomCanvas.width=bw;
      this._bloomCanvas.height=bh;
    }
    const bc=this._bloomCanvas;
    const bctx=bc.getContext("2d");
    bctx.imageSmoothingEnabled=true;
    bctx.imageSmoothingQuality="high";
    bctx.globalCompositeOperation="source-over";
    bctx.globalAlpha=1;
    bctx.clearRect(0,0,bw,bh);
    if(cv.width>0&&cv.height>0)bctx.drawImage(cv,0,0,bw,bh);
    // Composite back at full size with additive blend (bright areas glow, dark areas unaffected).
    c.save();
    c.setTransform(1,0,0,1,0,0);
    c.globalCompositeOperation="lighter";
    c.globalAlpha=0.14;
    c.imageSmoothingEnabled=true;
    c.imageSmoothingQuality="high";
    if(bc.width>0&&bc.height>0&&cv.width>0&&cv.height>0)c.drawImage(bc,0,0,cv.width,cv.height);
    c.globalAlpha=1;
    c.globalCompositeOperation="source-over";
    c.restore();
  },

  log(t){
    let el=$("battleLog");
    if(!el)return;
    // PERF-R13: use DOM appendChild instead of innerHTML+= (avoids full reparse+reflow).
    // Was: el.innerHTML+="<div>"+t+"</div>"; — reparsed ALL children every call.
    const div=document.createElement("div");
    div.innerHTML=t;
    // Move the parsed child(ren) into the log (t may contain HTML spans).
    while(div.firstChild)el.appendChild(div.firstChild);
    while(el.children.length>8){el.firstChild.remove();}
    // Auto-scroll to bottom.
    el.scrollTop=el.scrollHeight;
  },

  // Spawn a floating damage number.
  spawnDmgNum(x,y,val,team,crit,type){
    if(typeof x!=="number"||typeof y!=="number"||isNaN(x)||isNaN(y))return;
    if(!this.damageNums)this.damageNums=[];
    if(!this._dmgPool)this._dmgPool=[];
    // PERF-R12: precompute display text + isHeal flag at spawn (avoids per-draw checks).
    const t=type||"normal";
    const isHeal=typeof val==="string"&&val.charAt(0)==="+";
    const txt=t==="ability"?"*"+val:t==="spell"?"~"+val:t==="poison"?"p"+val:""+val;
    // PERF-R12: pool damage numbers (avoid per-hit object allocation + GC).
    const d=this._dmgPool.length?this._dmgPool.pop():{};
    d.x=x+Q(-6,6);d.y=y;d.life=0.8;d.val=val;d.txt=txt;d.team=team;d.crit=!!crit;d.type=t;d.vy=-40;d.isHeal=isHeal;
    this.damageNums.push(d);
    if(this.damageNums.length>40){
      // PERF-R12: recycle shifted-out damage number instead of discarding.
      this._dmgPool.push(this.damageNums.shift());
    }
  },

  // Update + render floating damage numbers.
  updateDmgNums(dt){
    if(!this.damageNums||!this.damageNums.length)return;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let i=0;i<this.damageNums.length;i++){
      const d=this.damageNums[i];
      d.life-=dt;
      d.y+=d.vy*dt;
      d.vy+=60*dt; // slight deceleration
    }
    // PERF-R12: in-place compaction instead of filter (avoids array allocation + GC).
    // PERF-R12: recycle expired damage numbers to pool (reuse objects, avoid GC).
    if(!this._dmgPool)this._dmgPool=[];
    let w=0;
    for(let i=0;i<this.damageNums.length;i++){
      const d=this.damageNums[i];
      if(d.life>0){
        if(w!==i)this.damageNums[w]=d;
        w++;
      }else{
        this._dmgPool.push(d);
      }
    }
    this.damageNums.length=w;
  },
  // Sync _allUnits with current state of this.units (call at battle end).
  // Units that died but weren't removed (deathT < 0.5) still have h=0 in this.units.
  _syncAllUnits(){
    if(!this._allUnits)return;
    // PERF-R12: use Map for O(n) instead of O(n²) findIndex.
    if(!this._syncMap)this._syncMap=new Map();
    const m=this._syncMap;
    m.clear();
    for(let si=0;si<this.units.length;si++)m.set(this.units[si].id,this.units[si]);
    for(let i=0;i<this._allUnits.length;i++){
      const synced=m.get(this._allUnits[i].id);
      if(synced){
        // Copy properties in place instead of creating new object via spread.
        Object.assign(this._allUnits[i],synced);
      }
    }
  },
  drawDmgNums(c){
    if(!this.damageNums||!this.damageNums.length)return;
    // PERF-R12: batch by font size (crit=14px, normal=10px) AND by color.
    // Group: [font][color] → fillStyle set once per group instead of per item.
    // PERF-R12: precomputed txt field avoids ternary chain per draw call.
    // PERF-R12: skip strokeText (expensive) when many dmg nums — outline is visual nicety.
    const n=this.damageNums.length;
    const doStroke=n<=15;
    c.textAlign="center";
    if(doStroke){c.strokeStyle="rgba(0,0,0,0.8)";c.lineWidth=3;}
    // Pass 1: non-crit (10px font) — batch by color (player, enemy, heal).
    c.font="bold 10px sans-serif";
    // Group A: player damage (blue).
    c.fillStyle=TEAM_COLORS.player;
    // PERF-R12: index loop (avoid for...of iterator allocation).
    for(let i=0;i<n;i++){
      const d=this.damageNums[i];
      if(d.crit||d.isHeal||d.team!=="player")continue;
      const alpha=d.life<0.3?d.life/0.3:1;
      if(alpha<0.05)continue;
      c.globalAlpha=alpha;
      if(doStroke)c.strokeText(d.txt,d.x,d.y);
      c.fillText(d.txt,d.x,d.y);
    }
    // Group B: enemy damage (red).
    c.fillStyle=TEAM_COLORS.enemy;
    for(let i=0;i<n;i++){
      const d=this.damageNums[i];
      if(d.crit||d.isHeal||d.team==="player")continue;
      const alpha=d.life<0.3?d.life/0.3:1;
      if(alpha<0.05)continue;
      c.globalAlpha=alpha;
      if(doStroke)c.strokeText(d.txt,d.x,d.y);
      c.fillText(d.txt,d.x,d.y);
    }
    // Group C: heals (green).
    c.fillStyle="#34d399";
    for(let i=0;i<n;i++){
      const d=this.damageNums[i];
      if(d.crit||!d.isHeal)continue;
      const alpha=d.life<0.3?d.life/0.3:1;
      if(alpha<0.05)continue;
      c.globalAlpha=alpha;
      if(doStroke)c.strokeText(d.txt,d.x,d.y);
      c.fillText(d.txt,d.x,d.y);
    }
    // Pass 2: crit (14px font, gold color)
    c.font="bold 14px sans-serif";
    c.fillStyle="#fbbf24";
    for(let i=0;i<n;i++){
      const d=this.damageNums[i];
      if(!d.crit||d.isHeal)continue;
      const alpha=d.life<0.3?d.life/0.3:1;
      if(alpha<0.05)continue;
      c.globalAlpha=alpha;
      if(doStroke)c.strokeText(d.txt,d.x,d.y);
      c.fillText(d.txt,d.x,d.y);
    }
    c.globalAlpha=1;
    c.textAlign="left";
    c.lineWidth=1;
  },

  checkEnd(){
    // PERF-R12: use pre-built alive arrays (avoids 2× this.units.some() per frame).
    // Guard: alive arrays are built in update(); skip if not yet initialized.
    const players=this._alivePlayers, enemies=this._aliveEnemies;
    if(!players||!enemies)return;
    const playerAlive=players.length>0;
    const enemyAlive=enemies.length>0;
    if(playerAlive&&enemyAlive){
      // Battle timeout: if battle runs > 90s, end as draw (prevents kite stalemates).
      if(this.time>90){
        let playerHP=0,enemyHP=0;
        for(let i=0;i<players.length;i++)playerHP+=Math.max(0,players[i].h);
        for(let i=0;i<enemies.length;i++)enemyHP+=Math.max(0,enemies[i].h);
        this.winner=playerHP>enemyHP?"player":(enemyHP>playerHP?"enemy":"draw");
        if(this.debug){
          console.warn("[TIMEOUT] t="+this.time.toFixed(1)+" battle ended after 90s! winner="+this.winner+" P_HP="+playerHP.toFixed(0)+" E_HP="+enemyHP.toFixed(0));
          console.log("[TIMEOUT] Final unit states:");
          for(const u of this.units){
            if(u.h<=0)continue;
            console.log("  "+u.n+"["+u.team+"] pos=("+u.x.toFixed(0)+","+u.y.toFixed(0)+") hp="+u.h.toFixed(0)+"/"+u.mh.toFixed(0)+" mov="+u.movement+" range="+u.r+" tgt="+u.targeting+" tgtDist="+(u.target?dist(u,u.target).toFixed(0):"-"));
          }
        }
        this._endBattle();
      }
      return;
    }
    this.winner=playerAlive?"player":(enemyAlive?"enemy":"draw");
    // Clutch sound: player wins with a unit at very low HP.
    // PERF-R13: use pre-built alive array instead of filter() allocation.
    if(this.winner==="player"&&players){
      for(let i=0;i<players.length;i++){
        if(players[i].h<players[i].mh*0.15){GameAudio.sfx("clutch");break;}
      }
    }
    this._endBattle();
  },

  // End the battle: snapshot state, stop sim, keep rendering for 1s so players
  // can see the final state, then call onEnd to transition to the result screen.
  _endBattle(){
    if(this._ending)return; // guard against double-call (timeout + normal)
    this._ending=true;
    // Phase 17: round-end flash + screen shake.
    BattleFX.roundEnd(this.winner==="player"?"#0f0":this.winner==="enemy"?"#f00":"#888");
    BattleFX.shake(4);
    this._finalUnits=this.units.map(u=>({...u})); // snapshot before stop() clears units
    this._syncAllUnits(); // update _allUnits with final state for cumulative draft
    this._finalSpells=(this.spells||[]).map(s=>({...s})); // snapshot spells for stats
    // Stop the sim but keep rendering the final frame for 1 second.
    this.running=false;
    if(this.autoTimer){clearInterval(this.autoTimer);this.autoTimer=null;}
    if(this.snapTimer){clearInterval(this.snapTimer);this.snapTimer=null;}
    // Render one final frame so the flash/shake is visible.
    try{this.render();}catch(e){/* ignore */}
    // After 1s, fully stop and transition to result screen.
    setTimeout(()=>{
      this._ending=false;
      this.stop();
      if(this.onEnd)try{this.onEnd(this.winner);}catch(e){console.error("[Battle._endBattle] onEnd failed:",e);showError("Battle end handler failed: "+(e&&e.message||e));}
    },1000);
  },

  stop(){
    this.running=false;
    cancelAnimationFrame(this.frame);
    if(this._interpRAF){cancelAnimationFrame(this._interpRAF);this._interpRAF=null;}
    if(this.autoTimer){clearInterval(this.autoTimer);this.autoTimer=null;}
    // DET: clear snapshot timer if active (prevents leak on error/timeout stop).
    if(this.snapTimer){clearInterval(this.snapTimer);this.snapTimer=null;}
    // Stop battle music in all code paths (error, timeout, disconnect).
    GameAudio.stopMusic();
    // Clean up canvas pointer handlers to prevent memory leak.
    const cv=$("cv");
    if(cv){cv.onclick=null;cv.onpointerdown=null;cv.onpointermove=null;cv.onpointerup=null;cv.onpointercancel=null;cv.onwheel=null;}
    // TOUCH: reset zoom/pan on battle end.
    this._resetZoomPan();
    // Reset auto-play button state when battle ends.
    const autoBtn=$("autoBtn");if(autoBtn)autoBtn.classList.remove("primary");
    // Clean up all battle state.
    this.units=[];
    this.projectiles=[];
    this.particles=[];
    this.damageNums=[];
    this.shakeAmount=0;
    this.roundFlash=null;
    this.spells=[];
    this.zones=[];
    this.playerSpells=[];
    this._allPlayerSpells=null; // DET: clear lockstep spell map
    this.time=0;
    this._ending=false; // clear end-delay flag
    // NOTE: do NOT reset this.winner here — checkEnd() calls stop() before
    // invoking onEnd(this.winner), so resetting would pass null to the callback.
    // winner is reset in start() instead.
    // Hide spell bar.
    const bar=$("spellBar");
    if(bar)bar.style.display="none";
    // Hide battle stats overlay.
    const stats=$("battleStats");
    if(stats)stats.style.display="none";
    // Hide kill feed.
    const kf=$("killFeed");
    if(kf)kf.style.display="none";
    // Hide unit inspector.
    const inspector=$("unitInspector");
    if(inspector)inspector.style.display="none";
  },

  // Spell cooldown based on effect power.
  _spellCooldown(s){
    const mag=s.magnitude||30;
    if(s.effect==="damage")return Math.max(3,mag/15);
    if(s.effect==="heal_allies"||s.effect==="heal_over_time"||s.effect==="shield_allies")return Math.max(4,mag/10);
    if(s.effect==="stun")return 8;
    if(s.effect==="summon")return 10;
    if(s.effect==="buff_dmg"||s.effect==="buff_speed")return 8;
    return 6;
  },

  // Render composition bonus indicator.
  _renderCompBonus(){
    const el=$("compBonus");
    if(!el)return;
    const b=this.playerBonuses;
    if(!b||!b.labels||b.labels.length===0){el.style.display="none";return;}
    el.style.display="block";
    el.innerHTML="<b style='color:var(--accent)'>⚡ Bonuses</b><br>"+b.labels.map(l=>`<div style='color:var(--accent2);font-size:.55rem;margin:1px 0;'>${l}</div>`).join("");
  },

  // Render real-time battle stats overlay.
  _renderBattleStats(){
    const el=$("battleStats");
    if(!el||!this._battleStats)return;
    const s=this._battleStats;
    // Calculate current DPS (damage in last 3 seconds).
    const now=this.time;
    // PERF-R12: in-place compaction of flat dmgWindow (avoid filter array allocation).
    // PERF-R12: recycle expired entries to pool (reuse arrays, avoid GC).
    if(!this._dmgWinPool)this._dmgWinPool=[];
    const dw=s.dmgWindow;
    let dwW=0;
    for(let i=0;i<dw.length;i++){
      if(now-dw[i][0]<3){
        if(dwW!==i)dw[dwW]=dw[i];
        dwW++;
      }else{
        this._dmgWinPool.push(dw[i]);
      }
    }
    dw.length=dwW;
    let recentDmg=0;
    for(let i=0;i<dw.length;i++)recentDmg+=dw[i][1];
    const dps=Math.round(recentDmg/3);
    if(dps>s.peakDPS)s.peakDPS=dps;
    // PERF-R12: use pre-built alive arrays (avoid 2× filter per overlay update).
    const playerAlive=this._alivePlayers?this._alivePlayers.length:0;
    const enemyAlive=this._aliveEnemies?this._aliveEnemies.length:0;
    el.style.display="block";
    el.innerHTML=
      `<div style="font-weight:700;color:var(--accent);margin-bottom:3px;">📊 Battle Stats</div>`+
      `<div style="color:var(--accent2);">DMG: <b>${Math.round(s.playerDmg)}</b> vs <b style="color:var(--warn)">${Math.round(s.enemyDmg)}</b></div>`+
      `<div style="color:var(--accent2);">Kills: <b>${s.playerKills}</b> vs <b style="color:var(--warn)">${s.enemyKills}</b></div>`+
      `<div style="color:var(--accent2);">DPS: <b>${dps}</b> (peak: ${s.peakDPS})</div>`+
      `<div style="color:var(--accent2);">Units: <b>${playerAlive}</b> vs <b style="color:var(--warn)">${enemyAlive}</b></div>`;
  },

  // Render kill feed overlay.
  _renderKillFeed(){
    const el=$("killFeed");
    if(!el)return;
    if(!this._killFeed||this._killFeed.length===0){el.style.display="none";return;}
    // PERF-R13: in-place compaction instead of filter() (avoid array allocation).
    const now=this.time;
    let w=0;
    for(let i=0;i<this._killFeed.length;i++){
      if(now-this._killFeed[i].t<6){if(w!==i)this._killFeed[w]=this._killFeed[i];w++;}
    }
    this._killFeed.length=w;
    if(w===0){el.style.display="none";return;}
    el.style.display="block";
    let html="";
    for(let ki=0;ki<w;ki++){
      const k=this._killFeed[ki];
      const age=now-k.t;
      const opacity=Math.max(0.3,1-age/6);
      const killerColor=k.killerTeam==="player"?"var(--ok)":k.killerTeam==="enemy"?"var(--warn)":"var(--muted)";
      const victimColor=k.victimTeam==="player"?"var(--ok)":"var(--warn)";
      html+=`<div style="opacity:${opacity};margin:2px 0;padding:2px 4px;background:rgba(0,0,0,.3);border-radius:3px;">`+
        `<span style="color:${killerColor};font-weight:700;">${k.killer}</span>`+
        `<span style="color:var(--muted);"> ⚔ </span>`+
        `<span style="color:${victimColor};">${k.victim}</span></div>`;
    }
    el.innerHTML=html;
  },

  // Show unit inspector panel with detailed stats.
  _showUnitInspector(u){
    const el=$("unitInspector");
    if(!el||!u||u.h===undefined)return;
    const teamColor=u.team==="player"?"var(--accent2)":"var(--warn)";
    const teamLabel=u.team==="player"?"ALLY":"ENEMY";
    const hpPct=Math.round(u.h/u.mh*100);
    const hpColor=hpPct>50?"var(--ok)":hpPct>25?"var(--warn)":"#fb7185";
    const abilityDesc={
      none:"No special ability",
      splash:"Deals AoE damage to nearby enemies",
      heal:"Heals lowest-HP ally periodically",
      dodge:"Chance to dodge incoming attacks",
      poison:"Applies damage over time to enemies",
      spawn:"Spawns additional units",
      lifesteal:"Heals self based on damage dealt",
      explode:"Explodes on death, damaging nearby enemies",
      heal_burst:"Burst heals all allies",
      shield:"Shields allies from damage",
      rage:"Gains damage when allies die",
      slow:"Slows enemy movement",
      ramp:"Gains damage over time",
      thorns:"Reflects damage to attackers",
      blink_strike:"Teleports to target and strikes",
      frenzy:"Attacks faster when low HP",
      regen:"Regenerates HP over time",
      cleanse:"Removes negative status effects",
      taunt:"Forces enemies to target this unit",
      executioner:"Deals bonus damage to low-HP enemies",
      chain_lightning:"Lightning chains between enemies"
    };
    const abText=u.ability&&u.ability!=="none"?`<span style="color:#0ff;font-weight:700;">${u.ability}</span>`:"none";
    const abDesc=abilityDesc[u.ability]||"Unknown ability";
    el.style.display="block";
    el.innerHTML=
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">`+
      `<span style="color:${u.c};font-weight:700;font-size:.85rem;">${u.n}</span>`+
      `<span style="color:${teamColor};font-size:.6rem;font-weight:700;background:rgba(0,0,0,0.3);padding:1px 6px;border-radius:8px;">${teamLabel}</span></div>`+
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">`+
      `<div>❤️ HP: <b style="color:${hpColor};">${Math.round(u.h)}/${u.mh}</b></div>`+
      `<div>⚔️ DMG: <b>${u.d}</b></div>`+
      `<div>📏 Range: <b>${u.r}</b></div>`+
      `<div>🏃 Speed: <b>${u.s}</b></div>`+
      `<div>🎯 Role: <b>${u.role||"-"}</b></div>`+
      `<div>💀 Kills: <b>${u.kills||0}</b></div>`+
      `<div>💥 Dmg Dealt: <b>${Math.round(u.dmgDealt||0)}</b></div>`+
      `<div>🔮 Ability: ${abText}</div></div>`+
      `<div style="font-size:.65rem;color:var(--muted);border-top:1px solid var(--border);padding-top:4px;">${abDesc}</div>`+
      (u.shieldActive>0?`<div style="color:#fff;font-size:.65rem;margin-top:2px;">🛡️ Shield active</div>`:"")+
      (u.stun>0?`<div style="color:#ff0;font-size:.65rem;margin-top:2px;">⚡ Stunned</div>`:"")+
      (u.poison>0?`<div style="color:#3f3;font-size:.65rem;margin-top:2px;">☠️ Poisoned</div>`:"")+
      (u.slow>0?`<div style="color:#39f;font-size:.65rem;margin-top:2px;">🐌 Slowed</div>`:"")+
      (u.silence>0?`<div style="color:#c4f;font-size:.65rem;margin-top:2px;">🔇 Silenced</div>`:"")+
      (u.stealth>0?`<div style="color:#888;font-size:.65rem;margin-top:2px;">👁️ Stealthed</div>`:"");
  },
  _hideUnitInspector(){
    const el=$("unitInspector");
    if(el)el.style.display="none";
  },

  // Render the spell bar with clickable spell buttons.
  _renderSpellBar(){    const bar=$("spellBar");
    if(!bar)return;
    if(!this.playerSpells||!this.playerSpells.length){bar.style.display="none";return;}
    bar.style.display="flex";
    bar.innerHTML="";
    for(let i=0;i<this.playerSpells.length;i++){
      const ps=this.playerSpells[i];
      const s=ps.spec;
      const icon=SPELL_FX_ICONS[s.fxType]||"✨";
      const effectLabel=SPELL_EFFECT_LABELS[s.effect]||s.effect||"";
      const maxCD=ps.maxCD||this._spellCooldown(s);
      const cdPct=ps.cooldown>0?Math.min(100,ps.cooldown/maxCD*100):0;
      const btn=document.createElement("button");
      btn.className="spellBtn";
      btn.disabled=ps.cooldown>0||!this.running;
      btn.style.position="relative";
      btn.innerHTML=`<span class="spellIcon">${icon}</span>${s.name||"Spell"}`+
        (ps.cooldown>0?`<span class="spellCD">${Math.ceil(ps.cooldown)}</span>`:"");
      // Visual cooldown overlay: dark bar covering the button from bottom up.
      if(cdPct>0){
        const overlay=document.createElement("div");
        overlay.style.cssText=`position:absolute;bottom:0;left:0;right:0;height:${cdPct}%;background:rgba(0,0,0,0.6);border-radius:0 0 var(--radius-sm) var(--radius-sm);pointer-events:none;transition:height .1s linear;`;
        btn.appendChild(overlay);
      }
      // Ready glow when off cooldown.
      if(ps.cooldown<=0&&this.running){
        btn.style.boxShadow="0 0 8px rgba(124,58,237,0.5)";
      }
      // Tooltip on hover.
      btn.title=`${s.name||"Spell"}\n${effectLabel} · ${(s.shape||"point").replace(/_/g," ")}\nMagnitude: ${s.magnitude||30}\nCooldown: ${maxCD}s`;
      btn.onclick=()=>this._castPlayerSpell(i);
      bar.appendChild(btn);
    }
  },

  // Cast a player spell manually.
  // DET: in lockstep mode, the cast is queued for a future tick and sent to the
  // peer so both sims execute it identically. In single-player / snapshot mode,
  // the spell fires immediately (legacy behavior).
  _castPlayerSpell(idx,targetX,targetY){
    if(!this.running||!this.playerSpells||!this.playerSpells[idx])return;
    const ps=this.playerSpells[idx];
    if(ps.cooldown>0||ps._pendingCast)return;
    // RELAY: guest sends command to host, host executes and state reflects in next snapshot.
    if(this._useRelay&&connected&&role==="guest"){
      transmit("command",{type:"spell_cast",spellIdx:idx,targetX:targetX||0,targetY:targetY||0});
      ps._pendingCast=true; // UI-only: prevent spam until snapshot reflects the cast
      BattleFX.onSpell(ps.spec,{x:targetX||200,y:targetY||275},[],this._localTeam);
      return;
    }
    if(this._lockstepActive){
      // DET: schedule execution LOCKSTEP_DELAY ticks in the future so the peer's
      // command arrives in time. Both peers execute the command at the same tick.
      // NETHARDEN: adaptive delay based on smoothed RTT — clamp 2-8 ticks.
      // At 60Hz, 1 tick = 16.67ms. delay = ceil(RTT/2 / 16.67) ensures the
      // command reaches the peer before the target tick.
      const LOCKSTEP_DELAY=_currentRTT>0
        ?Math.max(2,Math.min(8,Math.ceil(_currentRTT/2/16.67)))
        :3;
      const targetTick=(this._tick||0)+LOCKSTEP_DELAY;
      // DET: include the casting team so the peer fires the correct spell.
      // Without this, spellIdx maps to different spells on host vs guest
      // (playerSpells is per-team) → wrong spell fires → desync.
      const cmd={type:"spell_cast",team:this._localTeam,spellIdx:idx,targetX:targetX||0,targetY:targetY||0,tick:targetTick};
      this.queueCommand(cmd,targetTick);
      if(connected)_transmitSignedCmd(cmd);
      // _pendingCast is UI-only (prevents spam during the lockstep window); it is
      // NOT sim state and is cleared when the command executes.
      ps._pendingCast=true;
      // Visual-only casting indicator (does not affect the sim).
      BattleFX.onSpell(ps.spec,{x:targetX||200,y:targetY||275},[],this._localTeam);
      return;
    }
    // Fire the spell for the local player's team.
    this.fireSpell(ps.spec,this._localTeam);
    ps.cooldown=ps.maxCD;
    this._renderSpellBar();
  },

  // DET: execute a queued spell cast at the scheduled tick. Called by
  // executeCommands on both peers at the same tick → identical cooldown state.
  // DET: the team field tells us which team's spell to fire (the caster's team).
  // Both peers look up the spell from _allPlayerSpells[team][idx] → same spell.
  _executeSpellCast(team,idx,targetX,targetY){
    if(!this.running||!this._allPlayerSpells)return;
    const teamSpells=this._allPlayerSpells[team];
    if(!teamSpells||!teamSpells[idx])return;
    const ps=teamSpells[idx];
    // Fire the spell for the caster's team. Spell.fire auto-targets from
    // sim state, which is identical across peers at the same tick → deterministic.
    this.fireSpell(ps.spec,team);
    ps.cooldown=ps.maxCD;
    ps._pendingCast=false;
    this._renderSpellBar();
  },

  // Fire a spell (wrapper around Spell.fire with logging).
  fireSpell(spec,team){
    Spell.fire(spec,team,this);
  },

  tick(){
    if(!this.running)return;
    this.update(0.05);
    this.render();
    this.checkEnd();
  },

  auto(){
    if(this.autoTimer){clearInterval(this.autoTimer);this.autoTimer=null;}
    const interval=50/(this.speed||1);
    this.autoTimer=setInterval(()=>{
      if(!this.running){clearInterval(this.autoTimer);this.autoTimer=null;return;}
      this.tick();
    },interval);
  },

  // Skip to end: fast-simulate the rest of the battle without rendering.
  skip(){
    if(!this.running)return;
    let safety=2000; // max iterations to prevent infinite loop
    while(this.running&&safety-->0){
      this.update(0.05*(this.speed||1));
      this.checkEnd();
    }
    if(safety<=0){this.winner="draw";this._endBattle();}
  },

  // Toggle pause.
  togglePause(){
    this.paused=!this.paused;
    const btn=$("pauseBtn");
    if(btn)btn.textContent=this.paused?"▶":"⏸";
    if(this.paused&&this.autoTimer){clearInterval(this.autoTimer);this.autoTimer=null;}
    if(!this.paused&&this.autoTimer===null){
      // Resume auto-play if it was running before pause.
      // Check if auto button is in "playing" state.
      const autoBtn=$("autoBtn");
      if(autoBtn&&autoBtn.classList.contains("primary"))this.auto();
    }
  },

  // Phase 10: snapshot uses single units array.
  // Phase 17: includes recentCrits for P2P crit FX sync.
  snapshot(){
    return{
      time:this.time,
      units:this.units,
      projectiles:this.projectiles,
      winner:this.winner,
      recentCrits:this.recentCrits||[]
    };
  },
  // J3: Compressed snapshot for P2P — only essential fields per unit.
  // NETFIX: reuse pooled arrays to avoid N+M allocations per snapshot (20Hz).
  compressedSnapshot(){
    if(!this._snapPool)this._snapPool=[];
    if(!this._snapProjPool)this._snapProjPool=[];
    const cu=this._snapPool;
    const unitsLen=this.units.length;
    // Grow pool if needed (no shrink — avoids GC pressure).
    for(let i=cu.length;i<unitsLen;i++)cu.push({});
    cu.length=unitsLen;
    for(let i=0;i<unitsLen;i++){
      const u=this.units[i];
      const o=cu[i];
      o.i=u.id;o.n=u.n;o.x=Math.round(u.x);o.y=Math.round(u.y);
      o.h=Math.round(u.h);o.mh=Math.round(u.mh);o.t=u.team;
      o.s=u.animState;o.c=u.c;o.z=u.z;o.r=u.r;
    }
    const cp=this._snapProjPool;
    const projLen=this.projectiles.length;
    for(let i=cp.length;i<projLen;i++)cp.push({});
    cp.length=projLen;
    for(let i=0;i<projLen;i++){
      const p=this.projectiles[i];
      const o=cp[i];
      o.x=Math.round(p.x);o.y=Math.round(p.y);o.tx=Math.round(p.tx);o.ty=Math.round(p.ty);
      o.c=p.c;o.d=Math.round(p.d);o.t=p.team;
    }
    return{
      time:Math.round(this.time*100)/100,
      units:cu,projectiles:cp,
      winner:this.winner,
      rc:(this.recentCrits||[]).slice(-5),
      // RELAY: include sim metadata so guest can sync spell cooldowns, pause, speed.
      paused:this.paused,
      speed:this.speed,
      spellCDs:this._spellCDsForSnapshot()
    };
  },
  // RELAY: extract spell cooldowns for snapshot (both teams).
  _spellCDsForSnapshot(){
    const out={};
    if(this._allPlayerSpells){
      for(const team of ["player","enemy"]){
        const arr=this._allPlayerSpells[team];
        if(arr){
          out[team]=arr.map(ps=>({cd:Math.round((ps.cooldown||0)*100)/100,pc:!!ps._pendingCast}));
        }
      }
    }
    return out;
  },

  // Phase 17: applySnapshot diffs against previous snapshot to fire FX
  // on the guest side (state-derived, no extra network traffic for FX).
  _prevSnapshot:null,
  applySnapshot(s){
    if(!s||!s.units)return;
    const prev=this._prevSnapshot;
    // NETFIX: reuse unit objects to avoid N allocations per snapshot (20Hz).
    // Match by ID — update existing units in place, create new ones only for
    // new IDs, remove stale ones. With 100 units at 20Hz, this saves 2000 obj/sec.
    if(!this._snapUnitMap)this._snapUnitMap=new Map();
    const snapMap=this._snapUnitMap;
    snapMap.clear();
    // Build map of new snapshot units by ID.
    for(let i=0;i<s.units.length;i++){
      const u=s.units[i];
      if(u&&u.x!==undefined)snapMap.set(u.id,u);
    }
    // Reuse existing unit array — update in place, collect stale for removal.
    if(!this._snapReuseArr)this._snapReuseArr=[];
    const reuse=this._snapReuseArr;
    reuse.length=0;
    let reuseLen=0;
    // Update existing units + collect new ones.
    if(!this._snapExistingMap)this._snapExistingMap=new Map();
    const existing=this._snapExistingMap;
    existing.clear();
    for(let ui=0;ui<this.units.length;ui++){
      const u=this.units[ui];
      const snap_u=snapMap.get(u.id);
      if(snap_u){
        // Update in place — avoid allocating a new object.
        u.x=snap_u.x;u.y=snap_u.y;u.h=snap_u.h;
        u.mh=snap_u.mh||snap_u.h;
        u.prevH=u.prevH??snap_u.h;
        if(snap_u.n!==undefined)u.n=snap_u.n;
        if(snap_u.team!==undefined)u.team=snap_u.team;
        if(snap_u.animState!==undefined)u.animState=snap_u.animState;
        if(snap_u.s!==undefined)u.animState=snap_u.s;
        if(snap_u.c!==undefined)u.c=snap_u.c;
        if(snap_u.z!==undefined)u.z=snap_u.z;
        if(snap_u.r!==undefined)u.r=snap_u.r;
        if(snap_u.t!==undefined)u.team=snap_u.t;
        existing.set(u.id,true);
        reuse[reuseLen++]=u;
      }
    }
    // Add new units (not in existing array).
    for(let i=0;i<s.units.length;i++){
      const su=s.units[i];
      if(su&&su.x!==undefined&&!existing.has(su.id)){
        const u={...su,mh:su.mh||su.h,prevH:su.prevH??su.h};
        if(su.t!==undefined)u.team=su.t;
        if(su.s!==undefined)u.animState=su.s;
        reuse[reuseLen++]=u;
      }
    }
    // Copy reuse array into this.units (no new array allocation).
    this.units.length=reuseLen;
    for(let i=0;i<reuseLen;i++)this.units[i]=reuse[i];
    if(s.projectiles)this.projectiles=s.projectiles;
    // Phase 17: state-derived FX from snapshot deltas.
    if(prev&&prev.units){
      // PERF-R12: reuse Map + Set (avoid allocation per snapshot).
      if(!this._prevSnapMap)this._prevSnapMap=new Map();
      const prevMap=this._prevSnapMap;
      prevMap.clear();
      // PERF-R12: index loop (avoid for...of iterator allocation).
      for(let pui=0;pui<prev.units.length;pui++)prevMap.set(prev.units[pui].id,prev.units[pui]);
      // NETFIX: reuse curSnapIds Set + curUnitMap for crit lookup (BUG 6 fix).
      if(!this._curSnapIds)this._curSnapIds=new Set();
      this._curSnapIds.clear();
      for(let ui=0;ui<this.units.length;ui++){
        const u=this.units[ui];
        this._curSnapIds.add(u.id);
        const pu=prevMap.get(u.id);
        if(!pu){
          // New unit → spawn FX.
          BattleFX.onSpawn(u);
        }else if(u.h<pu.h){
          // HP decreased → hit flash.
          BattleFX.onHit(u);
        }
      }
      // Units that disappeared → death FX.
      for(let pui=0;pui<prev.units.length;pui++){
        const pu=prev.units[pui];
        if(!this._curSnapIds.has(pu.id)&&pu.h>0){
          BattleFX.onDeath(pu);
        }
      }
    }
    // Phase 17: crit FX from recentCrits in snapshot.
    // NETFIX: use _curSnapIds for O(1) crit unit lookup (was O(n) find per crit).
    if(s.recentCrits){
      if(!this._processedCrits)this._processedCrits=new Set();
      // PERF-R13: index loop (avoid for...of iterator allocation at 20Hz).
      for(let rci=0;rci<s.recentCrits.length;rci++){
        const rc=s.recentCrits[rci];
        const key=rc.id+":"+rc.t;
        if(this._processedCrits.has(key))continue;
        this._processedCrits.add(key);
        if(this._curSnapIds&&this._curSnapIds.has(rc.id)){
          const u=this.units.find(x=>x.id===rc.id);
          if(u)BattleFX.onCrit(u);
        }
      }
      // Prune old processed crits (keep last 100 entries).
      if(this._processedCrits.size>100){
        const arr=[...this._processedCrits];
        this._processedCrits=new Set(arr.slice(-50));
      }
    }
    // Phase 17: round-end flash from winner transition.
    if(s.winner&&!prev?.winner){
      BattleFX.roundEnd(s.winner==="player"?"#0f0":s.winner==="enemy"?"#f00":"#888");
      BattleFX.shake(4);
    }
    this._prevSnapshot=s;
  },

  // J3: Snapshot interpolation state for smooth P2P guest rendering.
  _interpFrom:null,_interpTo:null,_interpStart:0,_interpDur:0.1,_interpRAF:null,
  _startInterpLoop(){
    if(this._interpRAF)return;
    const tick=(t)=>{
      if(!Battle.running){Battle._interpRAF=null;return;}
      Battle._interpRAF=requestAnimationFrame(tick);
      Battle._interpRender();
    };
    this._interpRAF=requestAnimationFrame(tick);
  },
  _interpRender(){
    if(!this._interpFrom||!this._interpTo||!this.ctx)return;
    if(!this._interpTo.units||!this._interpFrom.units)return;
    const now=performance.now();
    const elapsed=(now-this._interpStart)/1000;
    const alpha=Math.min(1,elapsed/this._interpDur);
    // PERF-R12: cache from/to Maps (only rebuild when snapshot changes, not every frame).
    if(this._interpFromUnits!==this._interpFrom.units){
      this._interpFromUnits=this._interpFrom.units;
      if(!this._interpFromMap)this._interpFromMap=new Map();
      this._interpFromMap.clear();
      // PERF-R12: index loop (avoid for...of iterator allocation).
      for(let i=0;i<this._interpFrom.units.length;i++){const u=this._interpFrom.units[i];if(u&&u.id)this._interpFromMap.set(u.id,u);}
    }
    const fromMap=this._interpFromMap;
    // PERF-R12: reuse the same units array (avoid filter+map allocation every frame).
    const toUnits=this._interpTo.units;
    if(!this._interpUnits||(this._interpUnitsBase!==toUnits)){
      this._interpUnitsBase=toUnits;
      this._interpUnits=toUnits.filter(u=>u&&u.id);
      // Store original "to" positions for interpolation (avoid losing them when mutating).
      // PERF-R12: index loop (avoid for...of iterator allocation).
      for(let i=0;i<this._interpUnits.length;i++){const u=this._interpUnits[i];u._origTx=u.x;u._origTy=u.y;u._origTh=u.h;}
    }
    // PERF-R12: mutate unit objects in place (avoids N object allocations per frame).
    for(let i=0;i<this._interpUnits.length;i++){
      const tu=this._interpUnits[i];
      const fu=fromMap.get(tu.id);
      if(fu&&tu._origTx!==undefined&&fu.x!==undefined){
        tu.x=fu.x+(tu._origTx-fu.x)*alpha;
        tu.y=fu.y+(tu._origTy-fu.y)*alpha;
        tu.h=fu.h+(tu._origTh-fu.h)*alpha;
      }
    }
    this.units=this._interpUnits;
    this.time=(this._interpFrom.time||0)+((this._interpTo.time||0)-(this._interpFrom.time||0))*alpha;
    this.render();
  },

  renderOnly(){
    // UNIFY: use shared canvas init (guest path — no click handler needed).
    if(!this.ctx)this._initCanvasContext({skipClick:true});
    this.render();
  }
};

