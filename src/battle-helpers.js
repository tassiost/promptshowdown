// VOIDSTRIKE: process a verified lockstep command (extracted for async signing).
function _processLockstepCommand(c){
  // P2P security: rate-limit lockstep commands (prevents spam).
  if(!_cmdLockRate)_cmdLockRate={count:0,resetAt:0};
  const now=Date.now();
  if(now>_cmdLockRate.resetAt){_cmdLockRate.count=0;_cmdLockRate.resetAt=now+1000;}
  _cmdLockRate.count++;
  if(_cmdLockRate.count>20)return;
  // Validate command payload.
  if(c.type==="spell_cast"&&(typeof c.spellIdx!=="number"||(c.team!=="player"&&c.team!=="enemy")))return;
  // DET: detect late commands — if the target tick already passed, the
  // command can't be executed deterministically (one peer already ran it,
  // the other missed it). Fall back to snapshot sync for the next round.
  const currentTick=Battle._tick||0;
  if(Battle._lockstepActive&&c.tick<=currentTick){
    console.warn("[DET] Late command for tick "+c.tick+" (current="+currentTick+") — desync fallback.");
    _setDesyncState("desynced",c.tick);
    // Still queue it (harmless — the tick buffer was already deleted).
  }else{
    Battle.queueCommand(c,c.tick);
  }
  // The peer has confirmed up to this tick (they're scheduling past it).
  Battle._peerConfirmedTick=Math.max(Battle._peerConfirmedTick||0,c.tick);
  // VOIDSTRIKE: track command in history for replay/debug.
  _trackCommandHistory(c);
}
    // DET: peer acknowledges having simulated up to this tick (lockstep pacing).
    if(data.t==="tick_ack"){
      if(data.d&&typeof data.d.tick==="number"){
        Battle._peerConfirmedTick=Math.max(Battle._peerConfirmedTick||0,data.d.tick);
      }
    }
    // DET: peer's round-end state hash for desync detection.
    if(data.t==="round_hash"){
      const peer=data.d;
      if(peer&&typeof peer==="object"&&typeof peer.hash==="string"){
        // VOIDSTRIKE: desync state — checking while comparing hashes.
        _setDesyncState("checking",peer.round);
        const myHash=Battle.stateHash();
        if(peer.hash!==myHash){
          console.error("[DET] DESYNC at round",peer.round,"my:",myHash,"peer:",peer.hash);
          // VOIDSTRIKE: Merkle tree analysis — find WHICH units diverged.
          if(peer.merkle){
            const localTree=Battle.merkleTree();
            const diverged=Battle.findDivergence(localTree,peer.merkle);
            if(diverged.length>0){
              console.error("[DET] Divergent units:",diverged.map(d=>
                `${d.n}(${d.team}) ${d.issue} local:${JSON.stringify(d.local)}${d.remote?" remote:"+JSON.stringify(d.remote):""}`
              ).join(", "));
            }
          }
          // VOIDSTRIKE: set desync state → snapshot fallback for next round.
          _setDesyncState("desynced",peer.round);
          // VOIDSTRIKE: dump command history around desync tick for debugging.
          const endTick=Battle._tick||0;
          const startTick=Math.max(0,endTick-100);
          const history=_dumpCommandHistory(startTick,endTick);
          if(history.length>0){
            console.error("[DET] Command history (ticks "+startTick+"-"+endTick+"):",history);
          }
        }else{
          // VOIDSTRIKE: hashes match — synced state.
          _setDesyncState("synced");
          if(G._pendingRoundHash&&G._pendingRoundHash.round===peer.round){
            // Hashes match — clear the pending hash and proceed normally.
            G._pendingRoundHash=null;
          }
        }
      }
    }
    if(data.t==="cmd"){
      // Host applies a guest command to its local simulation.
      if(role==="host"){
        // P2P security: validate cmd message.
        const c=data.d&&typeof data.d==="object"&&data.d.cmd;
        if(typeof c!=="string")return;
        // Rate limit commands to 10/sec (prevents spam).
        if(!_cmdRate)_cmdRate={count:0,resetAt:0};
        const now=Date.now();
        if(now>_cmdRate.resetAt){_cmdRate.count=0;_cmdRate.resetAt=now+1000;}
        _cmdRate.count++;
        if(_cmdRate.count>10)return;
        if(c==="tick")Battle.tick();
        else if(c==="auto")Battle.auto();
        else if(c==="auto_stop"){if(Battle.autoTimer){clearInterval(Battle.autoTimer);Battle.autoTimer=null;}}
        else if(c==="skip")Battle.skip();
        else if(c==="speed")G.cycleSpeed();
        else if(c==="pause")G.togglePause();
      }
    }
    // RELAY: host receives a relay-mode command from the guest (spell cast).
    // The host validates and executes it; the effect appears in the next state snapshot.
    if(data.t==="command"){
      if(role==="host"&&Battle._useRelay){
        const c=data.d;
        if(!c||typeof c!=="object"||typeof c.type!=="string")return;
        // Rate limit relay commands (prevents spam).
        if(!_cmdRate)_cmdRate={count:0,resetAt:0};
        const now=Date.now();
        if(now>_cmdRate.resetAt){_cmdRate.count=0;_cmdRate.resetAt=now+1000;}
        _cmdRate.count++;
        if(_cmdRate.count>10)return;
        if(c.type==="spell_cast"){
          // Validate spell index.
          if(typeof c.spellIdx!=="number")return;
          // Guest's team is "enemy" in the host's sim labeling.
          const team="enemy";
          const teamSpells=Battle._allPlayerSpells&&Battle._allPlayerSpells[team];
          if(!teamSpells||!teamSpells[c.spellIdx])return;
          // NETHARDEN: validate spell is off cooldown (anti-cheat).
          const ps=teamSpells[c.spellIdx];
          if(ps.cooldown>0||ps._pendingCast)return;
          // Execute the spell cast on the host's sim.
          Battle._executeSpellCast(team,c.spellIdx,c.targetX||0,c.targetY||0);
        }
      }
    }
    if(data.t==="forge"){
      // P2P security: validate forge payload before adding to save.
      const d=data.d;
      if(!d||typeof d!=="object")return;
      if(d._isSpell){
        // Security: sanitize spell name + enum values.
        const spell=sanitizeSpell(d);
        if(!spell)return;
        if(!G.save.spellbook)G.save.spellbook=[];
        if(!G.save.spellbook.some(s=>s.name===spell.name)){G.save.spellbook.push(spell);if(G.save.spellbook.length>20)G.save.spellbook=G.save.spellbook.slice(-20);saveData(G.save);G.wins();}
      }else{
        // Validate unit: pass through unit() factory which sanitizes all fields.
        if(typeof d.n!=="string")return;
        let u=unit(d); // unit() clamps/sanitizes all fields including color
        if(!G.save.collection)G.save.collection=[];
        if(!G.save.collection.some(x=>x.n===u.n)){
          G.save.collection.push(u);
          // Cap collection at 50 — but never remove units in the current loadout.
          while(G.save.collection.length>50){
            const loadout=new Set(G.save.loadout||[]);
            const idx=G.save.collection.findIndex(c=>!loadout.has(c.n));
            if(idx<0)break;
            G.save.collection.splice(idx,1);
          }
        }
        if(!G.save.ai)G.save.ai=[];
        if(!G.save.ai.some(x=>x.n===u.n)){G.save.ai.push(u);if(G.save.ai.length>50)G.save.ai.shift();}
        saveData(G.save);G.wins();
      }
    }
    // Phase 18: extended protocol for match/round management.
    if(data.t==="match_start"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        // Initialize match state without calling startRound — the host's
        // round_start message will handle round increment + draft UI.
        Match.livesPlayer=clamp(Number(d.lives)||3,1,10);
        Match.livesEnemy=clamp(Number(d.lives)||3,1,10);
        Match.round=0;
        Match.history=[];
        Match.onMatchEnd=winner=>G.onMatchEnd(winner);
        Match.active=true;
        connState="IN_MATCH";
        Match.deathLog=[];
        G.save.arena=clamp(Number(d.arena)||0,0,10);
      }
    }
    if(data.t==="round_start"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        // NETHARDEN: validate round number matches expected (prevents replay attacks).
        if(typeof d.round==="number"&&d.round!==Match.round+1){
          console.warn("[P2P] round_start for wrong round:",d.round,"expected:",Match.round+1);
          return;
        }
        // Increment round to match host (host increments in Match.startRound).
        Match.round++;
        // Store host-sent draw count before startRoundDraft overwrites roundDraftState.
        G._hostDrawCount=clamp(Number(d.drawIndex)||3,1,10);
        // Store opponent picks (serialized) for scout screen.
        if(d.opponentPicks)G.opponentPicks=deserializeUnitsFromPeer(d.opponentPicks);
        G.startRoundDraft();
      }
    }
    if(data.t==="opponent_picks"){
      if(role==="guest"){
        G.opponentPicks=deserializeUnitsFromPeer(data.d.picks);
        G.showScout();
      }
    }
    if(data.t==="round_end"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        if(d.winner!=="player"&&d.winner!=="enemy"&&d.winner!=="draw")return;
        // NETHARDEN: validate round number matches current (prevents replay attacks).
        if(typeof d.round==="number"&&d.round!==Match.round){
          console.warn("[P2P] round_end for wrong round:",d.round,"expected:",Match.round);
          return;
        }
        // Translate winner to guest perspective and record in history.
        const w=d.winner==="player"?"enemy":d.winner==="enemy"?"player":"draw";
        Match.history.push({round:Match.round,winner:w});
        // Swap lives: host's player lives = guest's enemy lives.
        Match.livesPlayer=clamp(Number(d.livesEnemy)||0,0,10);
        Match.livesEnemy=clamp(Number(d.livesPlayer)||0,0,10);
        G.roundResult(w,d.livesEnemy,d.livesPlayer);
      }
    }
    if(data.t==="match_end"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        if(d.winner!=="player"&&d.winner!=="enemy"&&d.winner!=="draw")return;
        Match.active=false;
        // Translate host perspective to guest perspective.
        const w=d.winner==="player"?"enemy":d.winner==="enemy"?"player":"draw";
        // Push final round to history (host sends match_end instead of round_end
        // for the final round, so guest would otherwise be missing this entry).
        if(Match.round>0&&!Match.history.some(h=>h.round===Match.round)){
          Match.history.push({round:Match.round,winner:w});
        }
        G.onMatchEnd(w);
      }
    }
    if(data.t==="round_deck"){
      // Guest sends their drafted picks to the host.
      if(role==="host"){
        G.guestPicks=deserializeUnitsFromPeer(data.d.picks);
        // NETHARDEN: send acknowledgment so guest knows we received the deck.
        transmit("deck_ack",{});
      }
      // NETHARDEN: guest receives deck acknowledgment — clears retransmit timer.
      if(role==="guest"&&G._deckRetransmitTimer){
        clearTimeout(G._deckRetransmitTimer);
        G._deckRetransmitTimer=null;
      }
    }
    // NETHARDEN: host reports battle start failure — guest returns to menu.
    if(data.t==="battle_error"){
      if(role==="guest"){
        console.error("[P2P] Host reported battle error:",data.d?.msg);
        showError("Host error: "+(data.d?.msg||"battle failed"));
        Battle.stop();
        G.stopSnapshots();
        Match.active=false;
        G.screen("menu");
      }
    }
    // Bug #7: Host notifies guest when a guest-team spell fired, so guest
    // can track spell_use quests (guest doesn't run the simulation).
    if(data.t==="spell_used"){
      if(role==="guest"){
        Quests.track("spell_use");
      }
    }
    // Unknown message type — log for debugging (future version compat).
    if(!["role","role_tiebreak","request_deck","deck","snap","cmd","forge",
         "match_start","round_start","opponent_picks","round_end",
         "match_end","round_deck","spell_used","seed","cmd_lock","tick_ack",
         "round_hash","lockstep_start","relay_start","command"].includes(data.t)){
      console.warn("Unknown network message type:",data.t);
    }
  }catch(e){
    console.error("[networkReceive] Error processing",data?.t+":",e);
    showError("Network receive error: "+(e&&e.message||e));
  }
}

// Phase 10: Behaviour Composition API — helper functions + lookup tables.
// These replace the inline distance/movement code in v4's Battle.act().
// PERF-R11: Math.sqrt is faster than Math.hypot for 2 args.
// DET: DMath.sqrt for cross-browser determinism (rounds to 1e-6).
function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return DMath.sqrt(dx*dx+dy*dy);}
function moveToward(u,t,d){
  // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
  // DET: DMath.sqrt for cross-browser determinism.
  const dx=t.x-u.x, dy=t.y-u.y, dd=DMath.sqrt(dx*dx+dy*dy);
  if(dd>0){u.x+=(dx/dd)*d;u.y+=(dy/dd)*d;}
}
function moveAway(u,t,d){
  // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
  // DET: DMath.sqrt for cross-browser determinism.
  const dx=u.x-t.x, dy=u.y-t.y, dd=DMath.sqrt(dx*dx+dy*dy);
  if(dd>0){u.x+=(dx/dd)*d;u.y+=(dy/dd)*d;}
}
// Phase 10: effective speed — base * moveSpeedMod, halved if slowed.
function effSpeed(u){
  const base=u.s*(u.moveSpeedMod/100);
  return u.slow>0?base*0.5:base;
}
// D5: soft avoidance — gently push u away from nearby allies so units don't clump.
// Returns a {x,y} offset (in pixels) to add to u's position. Only considers allies
// within `radius` (default 28px). Falloff is linear: full push at distance 0, none at radius.
// PERF-R12: write to reusable buffer to avoid {x,y} allocation per call (100× per frame).
const _avoidBuf={x:0,y:0};
const _zeroDir={x:0,y:0};
// PERF-R12: flat array grid for avoidance (avoids Map overhead).
// Field 400×550, cellSize=30 → grid 14×19, +1 margin each side → 16×21=336 cells.
const _avoidGridW=16,_avoidGridH=21;
const _avoidFlatGen=new Int32Array(_avoidGridW*_avoidGridH);
const _avoidFlatUnits=new Array(_avoidGridW*_avoidGridH);
for(let _i=0;_i<_avoidGridW*_avoidGridH;_i++)_avoidFlatUnits[_i]=[];
let _avoidGen=0;
// PERF-R12: flattened offsets (avoid nested array indexing [oi][0]/[oi][1]).
const _avoidOffsetsFlat=[0,0, 1,0, -1,0, 0,1, 0,-1, 1,1, 1,-1, -1,1, -1,-1];
function _buildAvoidGrid(units){
  // PERF-R12: increment generation by 2 (one per team).
  _avoidGen+=2;
  const gen=_avoidGen;
  for(let i=0;i<units.length;i++){
    const u=units[i];
    if(u.h<=0)continue;
    const cx=Math.floor(u.x/30)+1; // +1 offset for negative coords
    const cy=Math.floor(u.y/30)+1;
    if(cx<0||cx>=_avoidGridW||cy<0||cy>=_avoidGridH)continue;
    const idx=cy*_avoidGridW+cx;
    if(_avoidFlatGen[idx]!==gen){
      _avoidFlatGen[idx]=gen;
      _avoidFlatUnits[idx].length=0;
      _avoidFlatUnits[idx].push(u);
    }else{
      _avoidFlatUnits[idx].push(u);
    }
  }
}
function avoidanceOffset(u,allies,radius){
  radius=radius||28;
  const r2=radius*radius;
  let ax=0,ay=0;
  // PERF-R12: use flat array grid (avoids Map.get hash lookup).
  const gen=_avoidGen;
  if(gen>0){
    const cx=Math.floor(u.x/30)+1;
    const cy=Math.floor(u.y/30)+1;
    for(let oi=0;oi<18;oi+=2){
      const ncx=cx+_avoidOffsetsFlat[oi],ncy=cy+_avoidOffsetsFlat[oi+1];
      if(ncx<0||ncx>=_avoidGridW||ncy<0||ncy>=_avoidGridH)continue;
      const idx=ncy*_avoidGridW+ncx;
      if(_avoidFlatGen[idx]!==gen)continue;
      const cell=_avoidFlatUnits[idx];
      for(let i=0;i<cell.length;i++){
        const a=cell[i];
        if(a===u)continue;
        const dx=u.x-a.x, dy=u.y-a.y;
        const d2=dx*dx+dy*dy;
        if(d2<r2){
          const d=DMath.sqrt(d2);
          const strength=(radius-d)/radius;
          if(d>0.001){ax+=(dx/d)*strength; ay+=(dy/d)*strength;}
          else{const ang=rand()*Math.PI*2; ax+=DMath.cos(ang)*strength; ay+=DMath.sin(ang)*strength;}
        }
      }
    }
  }else{
    // Fallback: scan all allies (no grid built).
    // PERF: index loop (avoid for...of iterator allocation).
    for(let ai=0;ai<allies.length;ai++){
      const a=allies[ai];
      if(a===u||a.h<=0)continue;
      const dx=u.x-a.x, dy=u.y-a.y;
      const d2=dx*dx+dy*dy;
      if(d2<r2){
        const d=DMath.sqrt(d2);
        const strength=(radius-d)/radius;
        if(d>0.001){ax+=(dx/d)*strength; ay+=(dy/d)*strength;}
        else{const ang=rand()*Math.PI*2; ax+=DMath.cos(ang)*strength; ay+=DMath.sin(ang)*strength;}
      }
    }
  }
  // Scale the accumulated push by u's effective speed so fast units separate faster.
  // PERF-R12: Math.sqrt is faster than Math.hypot for 2 args.
  // DET: DMath.sqrt for cross-browser determinism.
  const mag=DMath.sqrt(ax*ax+ay*ay);
  if(mag<0.001){_avoidBuf.x=0;_avoidBuf.y=0;return _avoidBuf;}
  // Cap the push to a fraction of unit speed per tick (avoids jitter when stationary).
  const maxPush=effSpeed(u)*0.4;
  const scale=Math.min(mag,maxPush)/mag;
  _avoidBuf.x=ax*scale; _avoidBuf.y=ay*scale;
  return _avoidBuf;
}
// C2: stealth — stealthed units are untargetable by single-target attacks.
function isTargetable(e){return e.h>0&&(e.stealth||0)<=0;}
function closestEnemy(u,enemies){
  let best=null,bd=Infinity;
  const ux=u.x,uy=u.y;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(!isTargetable(e))continue;
    const dx=ux-e.x, dy=uy-e.y;
    const d=dx*dx+dy*dy;
    if(d<bd){bd=d;best=e;}
  }
  return best;
}
function lowestBy(arr,fn){
  let best=null,bv=Infinity;
  // PERF-R12: index loop (avoid for...of iterator allocation).
  for(let i=0;i<arr.length;i++){const x=arr[i];if(!isTargetable(x))continue;const v=fn(x);if(v<bv){bv=v;best=x;}}
  return best;
}
function highestBy(arr,fn){
  let best=null,bv=-Infinity;
  // PERF-R12: index loop (avoid for...of iterator allocation).
  for(let i=0;i<arr.length;i++){const x=arr[i];if(!isTargetable(x))continue;const v=fn(x);if(v>bv){bv=v;best=x;}}
  return best;
}

// Phase 10: enum value lists (used by unit() defaults + validateUnit).
const TARGETING_OPTS=["closest","lowest_hp","highest_hp","enemy_carry","enemy_support","enemy_backline","enemy_frontline","enemy_cluster","lowest_ally","highest_hp_ally","random_ally","random","self"];
const MOVEMENT_OPTS=["chase","flee","hold","hold_midpoint","kite","patrol","blink","strafe"];
const ATTACK_CONDITION_OPTS=["always","only_if_healthy","only_if_target_low","only_if_target_high_hp","never"];
const ABILITY_TRIGGER_OPTS=["on_cooldown","when_ally_hurt","when_surrounded","on_low_hp","on_death","on_first_hit","on_spawn","on_kill","periodic_3s","never"];
const ABILITY_OPTS=["none","splash","heal","dodge","poison","spawn","lifesteal","explode","heal_burst","shield","rage","slow","ramp","thorns","blink_strike","frenzy","regen","cleanse","taunt","executioner","chain_lightning","buff_aura"];
const ROLE_OPTS=["frontline","carry","support","counter","utility","assassin","bruiser"];
// Reusable role color map for canvas rendering (avoids per-frame allocation).
const ROLE_COLORS={frontline:"#888",carry:"#4f4",support:"#ff4",counter:"#f4f",utility:"#4ff",assassin:"#f4f",bruiser:"#888"};
// PERF-R12: hoist spell FX color maps (avoid per-frame object allocation).
const SPELL_FX_COLORS={explosion:"#f84",frost:"#6cf",lightning:"#ff4",poison_cloud:"#6f4",heal_glow:"#fd8",shockwave:"#fff",fire_wall:"#f84"};
const ZONE_FX_COLORS={fire_wall:"#f84",poison_cloud:"#6f4",frost:"#6cf",lightning:"#ff4"};
// Team colors — used consistently for HP bar borders, name text, damage numbers,
// ground decals, and selection indicators so friend/foe is instantly readable.
const TEAM_COLORS={player:"#4af",enemy:"#f44"};
const PASSIVE_ABILITIES=new Set(["none","splash","dodge","poison","lifesteal","rage","slow","ramp","thorns","regen","taunt","executioner","buff_aura"]);
const TRIGGERED_ABILITIES=new Set(["heal","spawn","explode","heal_burst","shield","blink_strike","frenzy","cleanse","chain_lightning"]);
// F1: Ability descriptions for tooltips.
const ABILITY_DESCRIPTIONS={
  none:"No special ability.",
  splash:"Deals 50% splash damage to adjacent enemies on hit.",
  heal:"Periodically heals the lowest-HP ally.",
  dodge:"50% chance to completely avoid incoming attacks.",
  poison:"Applies poison damage over time to targets.",
  spawn:"Spawns a temporary minion to fight alongside allies.",
  lifesteal:"Heals for 50% of damage dealt.",
  explode:"Explodes on death, damaging nearby enemies.",
  heal_burst:"Burst-heals all nearby allies periodically.",
  shield:"Becomes immune to all damage for 2 seconds.",
  rage:"Damage scales with missing HP (up to +100%).",
  slow:"Slows enemy movement on hit.",
  ramp:"Gains +15% damage on each kill (cap 3× base).",
  thorns:"Reflects 30% of incoming damage back to the attacker.",
  blink_strike:"Teleports to the lowest-HP enemy and strikes for bonus damage.",
  frenzy:"Attack speed doubles for 3 seconds after getting a kill.",
  regen:"Regenerates 2% of max HP per second while alive.",
  cleanse:"Removes all negative status effects from nearby allies periodically.",
  taunt:"Forces all enemies to target this unit instead of others.",
  executioner:"Deals 3× damage to enemies below 25% HP.",
  chain_lightning:"Lightning arcs between 3 nearby enemies, dealing damage to each.",
  buff_aura:"Nearby allies gain +20% damage and +10% speed (80px radius).",
};

// Explanations for movement, targeting, triggers, and weapons — shown in unit detail.
const MOVEMENT_DESCRIPTIONS={
  chase:"Moves directly toward its target.",
  flee:"Moves away from the nearest enemy.",
  hold:"Stays in place — relies on formation positioning.",
  hold_midpoint:"Holds position at the battlefield midpoint, advancing only if out of range.",
  kite:"Keeps distance — moves away if too close, approaches if too far.",
  patrol:"Moves side-to-side, never closing distance. Defensive.",
  blink:"Teleports toward the target every 2 seconds. Unpredictable.",
  strafe:"Weaves side-to-side while approaching. Harder to hit.",
};
const TARGETING_DESCRIPTIONS={
  closest:"Targets the nearest enemy.",
  lowest_hp:"Targets the enemy with the lowest HP (finisher).",
  highest_hp:"Targets the enemy with the highest HP (tank buster).",
  enemy_carry:"Prioritizes enemy carries (high-damage units).",
  enemy_support:"Prioritizes enemy supports (healers).",
  enemy_backline:"Targets enemies in the back row.",
  enemy_frontline:"Targets enemies in the front row.",
  enemy_cluster:"Targets the center of the largest enemy group (AoE setup).",
  lowest_ally:"Targets the lowest-HP ally (for healing).",
  highest_hp_ally:"Targets the highest-HP ally (for buffing).",
  random_ally:"Targets a random ally.",
  random:"Targets a random enemy.",
  self:"Targets itself (self-buff abilities).",
};
const TRIGGER_DESCRIPTIONS={
  on_cooldown:"Fires as soon as the ability cooldown expires.",
  when_ally_hurt:"Fires when an ally drops below 50% HP.",
  when_surrounded:"Fires when 2+ enemies are within 60px.",
  on_low_hp:"Fires when this unit drops below 30% HP.",
  on_death:"Fires when this unit dies.",
  on_first_hit:"Fires the first time this unit takes a hit.",
  on_spawn:"Fires once when the unit enters battle.",
  on_kill:"Fires when this unit kills an enemy.",
  periodic_3s:"Fires every 3 seconds.",
  never:"Ability is passive or never triggers.",
};
const WEAPON_DESCRIPTIONS={
  none:"Unarmed — short range, no weapon FX.",
  sword:"Balanced melee weapon. Short range, moderate damage.",
  bow:"Long-range projectile weapon. Fires arrows.",
  staff:"Ranged magic weapon. Fires spells with flash FX.",
  dagger:"Fast short-range melee. Low range, high attack speed.",
  shield:"Defensive melee. Can block with flash FX.",
  hammer:"Heavy melee. Burst FX on hit.",
  claws:"Fast melee. Short range, rapid attacks.",
  breath:"Ranged elemental breath. Medium range, burst FX.",
  scythe:"Melee weapon with a wide arc. Short range.",
  whip:"Medium-range melee. Can hit from a distance.",
  spear:"Melee weapon with slightly longer reach.",
  rifle:"Very long-range projectile weapon. High damage.",
  wand:"Ranged magic weapon. Fires spells with flash FX.",
};

// Phase 10: lookup tables — each enum maps to a pure function.
const TARGETING={
  closest:(u,enemies,allies)=>closestEnemy(u,enemies),
  lowest_hp:(u,enemies,allies)=>lowestBy(enemies,e=>e.h),
  highest_hp:(u,enemies,allies)=>highestBy(enemies,e=>e.h),
  enemy_carry:(u,enemies,allies)=>enemies.find(e=>isTargetable(e)&&e.role==="carry")||closestEnemy(u,enemies),
  enemy_support:(u,enemies,allies)=>enemies.find(e=>isTargetable(e)&&e.role==="support")||closestEnemy(u,enemies),
  enemy_backline:(u,enemies,allies)=>{
    const alive=enemies.filter(e=>isTargetable(e));
    if(!alive.length)return null;
    const backY=alive[0].team==="player"?Math.max(...alive.map(e=>e.y)):Math.min(...alive.map(e=>e.y));
    return alive.reduce((b,e)=>Math.abs(e.y-backY)<Math.abs(b.y-backY)?e:b,alive[0]);
  },
  enemy_frontline:(u,enemies,allies)=>{
    const alive=enemies.filter(e=>isTargetable(e));
    if(!alive.length)return null;
    const frontY=alive[0].team==="player"?Math.min(...alive.map(e=>e.y)):Math.max(...alive.map(e=>e.y));
    return alive.reduce((b,e)=>Math.abs(e.y-frontY)<Math.abs(b.y-frontY)?e:b,alive[0]);
  },
  enemy_cluster:(u,enemies,allies)=>{
    const alive=enemies.filter(e=>isTargetable(e));
    if(!alive.length)return null;
    // PERF-R11: O(n) grid-based cluster counting instead of O(n²).
    const cellSize=80,grid=new Map();
    for(const e of alive){
      const k=Math.floor(e.x/cellSize)+","+Math.floor(e.y/cellSize);
      if(!grid.has(k))grid.set(k,0);
      grid.set(k,grid.get(k)+1);
    }
    let best=alive[0],bestCount=0;
    for(const e of alive){
      const cx=Math.floor(e.x/cellSize),cy=Math.floor(e.y/cellSize);
      let count=0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
        const c=grid.get((cx+dx)+","+(cy+dy));
        if(c)count+=c;
      }
      if(count>bestCount){bestCount=count;best=e;}
    }
    return best;
  },
  lowest_ally:(u,enemies,allies)=>lowestBy(allies,a=>a===u?Infinity:a.h),
  highest_hp_ally:(u,enemies,allies)=>highestBy(allies,a=>a===u?-Infinity:a.h),
  // PERF-R12: inline alive counting (avoid filter allocation per unit per frame).
  random_ally:(u,enemies,allies)=>{
    let count=0;
    for(let i=0;i<allies.length;i++){const a=allies[i];if(a!==u&&a.h>0)count++;}
    if(!count)return null;
    // DET: use rand() (seeded PRNG) not R() (Math.random) for P2P lockstep determinism.
    let pick=randInt(0,count);
    for(let i=0;i<allies.length;i++){const a=allies[i];if(a!==u&&a.h>0){if(pick===0)return a;pick--;}}
    return null;
  },
  random:(u,enemies,allies)=>{
    let count=0;
    for(let i=0;i<enemies.length;i++){if(enemies[i].h>0)count++;}
    if(!count)return null;
    // DET: use rand() (seeded PRNG) not R() (Math.random) for P2P lockstep determinism.
    let pick=randInt(0,count);
    for(let i=0;i<enemies.length;i++){if(enemies[i].h>0){if(pick===0)return enemies[i];pick--;}}
    return null;
  },
  self:(u,enemies,allies)=>u,
};

// PERF-R12: Per-frame targeting cache for team-level targets.
// Many targeting functions (lowest_hp, highest_hp, enemy_frontline, enemy_backline,
// enemy_cluster, enemy_carry, enemy_support) don't depend on u — they return the same
// result for all units on the same team. Cache them per (team, targetingType) per frame.
// This eliminates 49 redundant computations per team per frame (50 units → 1 computation).
let _targetCache={};
function _getCachedTarget(team,targetingKey,enemies,allies){
  const k=team+"|"+targetingKey;
  if(k in _targetCache)return _targetCache[k];
  let result=null;
  switch(targetingKey){
    case "lowest_hp":result=lowestBy(enemies,e=>e.h);break;
    case "highest_hp":result=highestBy(enemies,e=>e.h);break;
    case "enemy_carry":result=enemies.find(e=>e.h>0&&e.role==="carry")||closestEnemy({x:0,y:0},enemies);break;
    case "enemy_support":result=enemies.find(e=>e.h>0&&e.role==="support")||closestEnemy({x:0,y:0},enemies);break;
    case "enemy_backline":{
      // PERF-R12: single-pass loop (avoid filter + map + spread + reduce).
      let best=null,backY=0;
      for(let ei=0;ei<enemies.length;ei++){
        const e=enemies[ei];
        if(e.h<=0)continue;
        if(!best){best=e;backY=e.y;}
        else if(e.team==="player"?e.y>backY:e.y<backY){backY=e.y;best=e;}
      }
      result=best;
      break;
    }
    case "enemy_frontline":{
      // PERF-R12: single-pass loop (avoid filter + map + spread + reduce).
      let best=null,frontY=0;
      for(let ei=0;ei<enemies.length;ei++){
        const e=enemies[ei];
        if(e.h<=0)continue;
        if(!best){best=e;frontY=e.y;}
        else if(e.team==="player"?e.y<frontY:e.y>frontY){frontY=e.y;best=e;}
      }
      result=best;
      break;
    }
    case "enemy_cluster":{
      const alive=enemies.filter(e=>e.h>0);
      if(!alive.length)break;
      // PERF-R12: flat array grid (avoid Map + string concat overhead).
      const cellSize=80;
      const gw=8,gh=8;
      const counts=new Int32Array(gw*gh);
      for(let ei=0;ei<alive.length;ei++){
        const e=alive[ei];
        const cx=Math.floor(e.x/cellSize),cy=Math.floor(e.y/cellSize);
        if(cx>=0&&cx<gw&&cy>=0&&cy<gh)counts[cy*gw+cx]++;
      }
      let best=alive[0],bestCount=0;
      for(let ei=0;ei<alive.length;ei++){
        const e=alive[ei];
        const cx=Math.floor(e.x/cellSize),cy=Math.floor(e.y/cellSize);
        let count=0;
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
          const ncx=cx+dx,ncy=cy+dy;
          if(ncx>=0&&ncx<gw&&ncy>=0&&ncy<gh)count+=counts[ncy*gw+ncx];
        }
        if(count>bestCount){bestCount=count;best=e;}
      }
      result=best;
      break;
    }
  }
  _targetCache[k]=result;
  return result;
}
// Cache keys for team-level targeting (result doesn't depend on u).
const _TEAM_LEVEL_TARGETS=new Set(["lowest_hp","highest_hp","enemy_carry","enemy_support","enemy_backline","enemy_frontline","enemy_cluster"]);

const MOVEMENT={
  chase:(u,target,dt)=>{if(target&&target.h>0)moveToward(u,target,effSpeed(u)*dt);},
  flee:(u,target,dt)=>{if(target&&target.h>0)moveAway(u,target,effSpeed(u)*dt);},
  hold:(u,target,dt)=>{/* no movement */},
  hold_midpoint:(u,target,dt)=>{
    // DET: use GAME_H (fixed 550) not canvasH (viewport-dependent) for lockstep determinism.
    const mid=u.team==="player"?Battle.GAME_H*0.6:Battle.GAME_H*0.4;
    const sp=effSpeed(u)*dt;
    if(target&&target.h>0){
      // PERF-R12: squared distance check (avoid Math.sqrt).
      const dx=target.x-u.x, dy=target.y-u.y;
      const r2=u.r*u.r;
      if(dx*dx+dy*dy>r2){
        moveToward(u,target,sp);
      }else{
        if(Math.abs(u.y-mid)>10)u.y+=Math.sign(mid-u.y)*sp*0.5;
      }
    }else{
      if(Math.abs(u.y-mid)>10)u.y+=Math.sign(mid-u.y)*sp;
    }
  },
  kite:(u,target,dt)=>{
    if(!target||target.h<=0)return;
    // PERF-R12: squared distance check (avoid Math.sqrt).
    const dx=target.x-u.x, dy=target.y-u.y;
    const d2=dx*dx+dy*dy;
    const sp=effSpeed(u)*dt;
    const r2=u.r*u.r, halfR2=r2*0.25;
    if(d2<halfR2)moveAway(u,target,sp);
    else if(d2>r2)moveToward(u,target,sp);
  },
  patrol:(u,target,dt)=>{
    u.patrolT=(u.patrolT||0)+dt;
    u.x+=DMath.sin(u.patrolT*2)*effSpeed(u)*dt*0.5;
  },
  blink:(u,target,dt)=>{
    // blink: teleport toward target every 2s, otherwise hold
    if(!target||target.h<=0)return;
    u.blinkT=(u.blinkT||0)+dt;
    if(u.blinkT>=2){
      // PERF-R12: squared distance check (avoid Math.sqrt).
      const dx=target.x-u.x, dy=target.y-u.y;
      if(dx*dx+dy*dy>u.r*u.r){
        u.x=target.x+randRange(-20,20);u.y=target.y+randRange(-20,20);
        u.blinkT=0;
        BattleFX.burst(u.x,u.y,u.c,4,20);
      }
    }
  },
  strafe:(u,target,dt)=>{
    // strafe: move side-to-side while approaching
    if(!target||target.h<=0)return;
    // PERF-R12: squared distance check (avoid Math.sqrt).
    const dx=target.x-u.x, dy=target.y-u.y;
    const d2=dx*dx+dy*dy;
    const sp=effSpeed(u)*dt;
    if(d2>u.r*u.r)moveToward(u,target,sp*0.7);
    u.strafeT=(u.strafeT||0)+dt;
    u.y+=DMath.sin(u.strafeT*3)*sp*0.5;
  },
};

const ATTACK_CONDITIONS={
  always:(u,target)=>true,
  only_if_healthy:(u,target)=>u.h>u.mh*0.5,
  only_if_target_low:(u,target)=>target&&target.h<target.mh*0.3,
  only_if_target_high_hp:(u,target)=>target&&target.h>target.mh*0.6,
  never:(u,target)=>false,
};

const ABILITY_TRIGGERS={
  on_cooldown:(u,allies,enemies)=>u.abCool<=0,
  when_ally_hurt:(u,allies,enemies)=>{if(u.abCool>0)return false;for(let i=0;i<allies.length;i++){const a=allies[i];if(a!==u&&a.h>0&&a.h<a.mh*0.5)return true;}return false;},
  when_surrounded:(u,allies,enemies)=>{if(u.abCool>0)return false;let count=0;for(let i=0;i<enemies.length;i++){const e=enemies[i];if(e.h<=0)continue;const dx=u.x-e.x,dy=u.y-e.y;if(dx*dx+dy*dy<3600){count++;if(count>=2)return true;}}return false;},
  on_low_hp:(u,allies,enemies)=>u.h<u.mh*0.3&&u.abCool<=0,
  on_death:(u,allies,enemies)=>false,  // handled in onUnitDeath()
  on_first_hit:(u,allies,enemies)=>u.hasBeenHit&&!u.firstHitUsed,
  on_spawn:(u,allies,enemies)=>!u.spawnTriggered,
  on_kill:(u,allies,enemies)=>false, // handled in onUnitDeath for killer
  periodic_3s:(u,allies,enemies)=>{if(u._periodicLastT===undefined)u._periodicLastT=Battle.time;const dt=Battle.time-u._periodicLastT;if(dt>=3){u._periodicLastT=Battle.time;return u.abCool<=0;}return false;},
  never:(u,allies,enemies)=>false,
};

