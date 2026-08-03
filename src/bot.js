// Phase 9/15: Bot opponent — fake multiplayer. Random drafting, no strategy.
// Feels like a casual human opponent, not an AI.
// Phase 21: BotStrategy — pure functions for strategic bot drafting.
const BotStrategy={
  // Returns a sorted pick list for one draw slot, given current picks + pool.
  pickDraw(currentPicks, pool, scoutedPlayerPicks){
    const roles=currentPicks.map(p=>p.role);
    const missing=this.missingRoles(roles);
    if(missing.includes("frontline"))return this.firstOfRole(pool,"frontline");
    if(missing.includes("carry"))return this.firstOfRole(pool,"carry");
    if(scoutedPlayerPicks?.some(p=>p.ability==="ramp") &&
       !roles.includes("counter"))return this.firstOfRole(pool,"counter");
    if(missing.length)return this.firstOfRole(pool,missing[0]);
    return pool[F(R()*pool.length)];
  },
  missingRoles(roles){
    const want=["frontline","carry"];
    return want.filter(r=>!roles.includes(r));
  },
  firstOfRole(pool,role){return pool.find(u=>u.role===role)||pool[0];}
};

const Bot={
  loadout:[],         // 4 random units from the pool (generated per match)

  // Phase 15/21: generate a 4-unit loadout from the arena's bot pool.
  // Phase 21: biased to guarantee at least 1 frontline + 1 carry.
  generateLoadout(botPool){
    this.loadout=[];
    const resolve=name=>{
      const base=G.base.find(u=>u.n===name);
      if(base)return cloneUnit(base);
      const coll=(G.save.collection||[]).find(u=>u.n===name);
      if(coll)return cloneUnit(coll);
      return null;
    };
    const pool=botPool.map(resolve).filter(Boolean);
    if(!pool.length){
      // Fallback: use starter roster if bot pool is empty or unresolvable.
      this.loadout=G.base.slice(0,4).map(cloneUnit);
      return;
    }
    // Phase 21: re-roll until pool has at least 1 frontline + 1 carry.
    let attempts=0;
    let picks=[];
    while(attempts<10){
      picks=[];
      for(let i=0;i<4;i++){
        picks.push(cloneUnit(pool[F(R()*pool.length)]));
      }
      const roles=picks.map(u=>u.role);
      if(roles.includes("frontline")&&roles.includes("carry"))break;
      attempts++;
    }
    this.loadout=picks;
  },

  // Phase 21: strategic draft — role-fill + counter-pick.
  // Returns array of picked units (3-4 units) + optional spells.
  draftRound(drawCount,scoutedPlayerPicks){
    const picks=[];
    const pool=[...this.loadout];
    for(let i=0;i<drawCount;i++){
      if(!pool.length)break;
      const pick=BotStrategy.pickDraw(picks,pool,scoutedPlayerPicks);
      if(pick){
        picks.push(cloneUnit(pick));
        // Remove from pool (no duplicates within a round).
        const idx=pool.findIndex(u=>u.n===pick.n&&u.role===pick.role);
        if(idx>=0)pool.splice(idx,1);
      }
    }
    // 30% chance to add a spell from the player's spellbook (mirrors player's draft chance).
    const spellbook=G.save?.spellbook||[];
    if(spellbook.length&&R()<0.3){
      const spell=spellbook[F(R()*spellbook.length)];
      picks.push({...spell,_isSpell:true});
    }
    return picks;
  },
};

