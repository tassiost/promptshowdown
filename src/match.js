// Phase 8: Match object — owns the match arc (lives, rounds, history).
// Sibling of Battle; G delegates the round flow to this.
const DEFAULT_LIVES=3;
const Match={
  livesPlayer:DEFAULT_LIVES,
  livesEnemy:DEFAULT_LIVES,
  round:0,
  history:[],         // [{round,winner}] per completed round
  onMatchEnd:null,    // (winner:"player"|"enemy"|"draw")=>void
  active:false,

  start(lives,onMatchEnd){
    this.livesPlayer=lives||DEFAULT_LIVES;
    this.livesEnemy=lives||DEFAULT_LIVES;
    this.round=0;
    this.history=[];
    this.onMatchEnd=onMatchEnd||null;
    this.active=true;
    this._graceActive=false; // NETFIX: clear grace flag for new match.
    this.deathLog=[];  // Phase 16: accumulate deaths across rounds for hint.
    // DET: generate deterministic seed. Host creates it, guest receives via P2P.
    // Single-player (no connection) also seeds for reproducible bug reports.
    this.seed=(role==="host"||!connected)
      ?(Math.random()*0xFFFFFFFF)>>>0
      :(this._receivedSeed||0);
    if(connected&&role==="host")transmit("seed",{seed:this.seed});
    this.startRound();
  },

  // Start the next round's draft (called by G.start via Match).
  startRound(){
    this.round++;
    // Phase 18: send round_start to guest with draw index + opponent picks.
    if(connected&&role==="host"){
      // Guest gets comeback if host won last round (guest lost).
      const guestComeback=this.history.length>0&&this.history[this.history.length-1].winner==="player";
      const guestDrawCount=guestComeback?4:3;
      // Send host's actual picks from previous round (or empty for round 1).
      const hostPicks=this.round>1&&G.prevPlayerPicks?G.prevPlayerPicks:[];
      const opponentPicks=serializeUnitsForPeer(hostPicks);
      transmit("round_start",{drawIndex:guestDrawCount,opponentPicks,round:this.round});
    }
    // G.start handles the draft UI; Match just tracks state.
    G.startRoundDraft();
  },

  // Called by G.onBattleEnd after a round's battle finishes.
  onRoundEnd(winner){
    // DET: desync detection — exchange state hashes with the peer at round end.
    // Both peers compute the hash from their (independent) sims; a mismatch means
    // the determinism contract broke and the next round falls back to snapshots.
    // PERF-R13: only send in lockstep mode (snapshot mode is already fallback).
    if(connected&&_peerDetCapable&&Battle._lockstepActive){
      const myHash=Battle.stateHash();
      const myMerkle=Battle.merkleTree();
      const payload={round:this.round,winner,hash:myHash,merkle:{root:myMerkle.root,player:myMerkle.player,enemy:myMerkle.enemy,playerNodes:myMerkle.playerNodes,enemyNodes:myMerkle.enemyNodes}};
      transmit("round_hash",payload);
    }
    this.history.push({round:this.round,winner});
    if(winner==="player")this.livesEnemy=Math.max(0,this.livesEnemy-1);
    else if(winner==="enemy")this.livesPlayer=Math.max(0,this.livesPlayer-1);
    else if(winner==="draw"){this.livesEnemy=Math.max(0,this.livesEnemy-1);this.livesPlayer=Math.max(0,this.livesPlayer-1);}
    // Check match end
    if(this.livesPlayer<=0||this.livesEnemy<=0){
      const matchWinner=this.livesPlayer<=0&&this.livesEnemy<=0?"draw":
        this.livesPlayer<=0?"enemy":"player";
      this.active=false;
      // Phase 18: send match_end to guest.
      if(connected&&role==="host")transmit("match_end",{winner:matchWinner});
      if(this.onMatchEnd)try{this.onMatchEnd(matchWinner);}catch(e){showError("Match end handler failed: "+(e&&e.message||e));}
      return;
    }
    // Phase 18: send round_end to guest.
    if(connected&&role==="host"){
      transmit("round_end",{winner,livesPlayer:this.livesPlayer,livesEnemy:this.livesEnemy,round:this.round});
    }
    // Match continues — show round result, then next round on button.
    G.roundResult(winner,this.livesPlayer,this.livesEnemy);
  },

  // Does the loser of the last round get a comeback (4th draw)?
  comebackEligible(){
    if(this.history.length===0)return false;
    const last=this.history[this.history.length-1];
    // The player gets comeback if they lost the last round.
    return last.winner==="enemy";
  },

  // Phase 18: forfeit the current match (used on disconnect).
  forfeit(){
    this.active=false;
    // Stop the battle simulation — without this, the battle loop keeps running
    // in the background after forfeit, consuming CPU and causing state issues.
    if(Battle.running)Battle.stop();
    if(connected&&role==="host")transmit("match_end",{winner:"enemy"});
    if(this.onMatchEnd)try{this.onMatchEnd("enemy");}catch(e){showError("Match forfeit handler failed: "+(e&&e.message||e));}
  },
  // Phase 34: graceful disconnect with reconnect grace period.
  gracefulDisconnect(){
    if(!this.active)return;
    this._graceActive=true; // NETFIX: mark grace as active to prevent re-trigger.
    // Use stop() instead of just setting running=false to properly clean up
    // all timers (frame, interpRAF, autoTimer, music).
    if(Battle.running)Battle.stop();
    G.stopSnapshots();
    // Show 30s reconnect grace period, then offer "Continue vs Bot" or "Forfeit".
    G.showReconnect(30,()=>showDisconnectPrompt(this.opponentPicks||[]));
  },
};

