// Phase 33: Daily quests + login streaks.
const QUEST_POOL=[
  {id:"win3",desc:"Win 3 matches",type:"match_win",target:3,reward:{coins:30,xp:10}},
  {id:"win5",desc:"Win 5 matches",type:"match_win",target:5,reward:{coins:50,xp:20}},
  {id:"forge1",desc:"Forge 1 unit",type:"forge",target:1,reward:{coins:20,xp:5}},
  {id:"forge2",desc:"Forge 2 units",type:"forge",target:2,reward:{coins:40,xp:15}},
  {id:"round5",desc:"Reach Round 5 in a match",type:"round_reach",target:5,reward:{coins:25,xp:10}},
  {id:"fuse1",desc:"Fuse 2 units",type:"fuse",target:1,reward:{coins:30,xp:10}},
  {id:"spell1",desc:"Use a spell in battle",type:"spell_use",target:1,reward:{coins:25,xp:10}},
  {id:"scout3",desc:"Scout 3 times",type:"scout",target:3,reward:{coins:15,xp:5}},
];
const STREAK_REWARDS={1:10,3:50,7:100,14:200,30:500};
const Quests={
  todayStr(){const d=new Date();return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");},
  yesterdayStr(){
    const d=new Date();d.setDate(d.getDate()-1);
    return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
  },
  checkStreak(){
    const q=G.save.quests;
    if(!q||typeof q!=="object")return;
    if(!q.streak||typeof q.streak!=="object")q.streak={count:0,lastLogin:""};
    const today=this.todayStr();
    if(q.streak.lastLogin===today)return; // already checked today
    if(q.streak.lastLogin===this.yesterdayStr())q.streak.count=(q.streak.count||0)+1;
    else q.streak.count=1;
    q.streak.lastLogin=today;
    saveData(G.save);
    // Streak reward.
    const reward=STREAK_REWARDS[q.streak.count||0];
    if(reward!=null){
      G.save.coins=(G.save.coins||0)+reward;
      saveDataDebounced(G.save);
      toast(`🔥 ${q.streak.count}-day streak! +${reward} coins`);
    }
  },
  generateDaily(){
    const q=G.save.quests;
    if(!q||!Array.isArray(q.list))return;
    const today=this.todayStr();
    if(q.date===today&&q.list.length>0)return; // already generated
    // Pick 3 random quests. Validate QUEST_POOL.
    if(!Array.isArray(QUEST_POOL)||QUEST_POOL.length===0)return;
    const pool=[...QUEST_POOL];
    const picked=[];
    for(let i=0;i<3&&pool.length;i++){
      const idx=Math.floor(Math.random()*pool.length);
      const qe=pool.splice(idx,1)[0];
      if(qe&&qe.id&&qe.target)picked.push({...qe,progress:0,claimed:false});
    }
    q.date=today;
    q.list=picked;
    saveDataDebounced(G.save);
  },
  track(event,data){
    const q=G.save.quests;
    if(!q||!q.list||!Array.isArray(q.list))return;
    for(const quest of q.list){
      if(!quest||typeof quest!=="object")continue;
      if(quest.claimed)continue;
      if(quest.type===event){
        const inc=data!=null?data:1;
        const target=quest.target||1;
        const progress=quest.progress||0;
        quest.progress=Math.min(target,progress+inc);
      }
    }
    saveDataDebounced(G.save);
  },
  claim(id){
    const q=G.save.quests;
    if(!q||!Array.isArray(q.list))return;
    const quest=q.list.find(x=>x.id===id);
    if(!quest||quest.claimed||quest.progress<quest.target)return;
    quest.claimed=true;
    // Validate reward structure.
    const coins=(quest.reward&&typeof quest.reward.coins==="number")?quest.reward.coins:0;
    const xp=(quest.reward&&typeof quest.reward.xp==="number")?quest.reward.xp:0;
    G.save.coins=(G.save.coins||0)+coins;
    G.save.xp=(G.save.xp||0)+xp;
    saveData(G.save);
    toast(`✅ ${quest.desc||"Quest"} complete! +${coins} coins`);
    // Bonus if all 3 claimed.
    if(q.list.length>=3&&q.list.every(x=>x.claimed)){
      G.save.coins=(G.save.coins||0)+50;
      saveData(G.save);
      toast(t("quests_done"));
    }
  },
};

