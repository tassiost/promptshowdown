// Phase 1: network state + functions hoisted ABOVE G so role/transmit
// are never accessed in a temporal-dead-zone during G construction.
let room=null;
let sendNet=null;
let connected=false;
let role="none";
let _peerId=null;
// P2P security: rate limiting + message size limits.
const P2P_MAX_MSG_SIZE=256*1024; // 256KB max per message
const P2P_RATE_WINDOW=1000; // 1s window
const P2P_RATE_MAX=60; // 60 msgs/sec per peer (snapshots run at 20Hz)
const _p2pRateBucket={count:0,resetAt:0};
let _cmdRate=null; // P2P command rate limiter (10/sec)
let _cmdLockRate=null; // DET: lockstep command rate limiter (20/sec)
let _peerDetCapable=false; // DET: peer supports determinism (lockstep)
let _peerRelayCapable=false; // RELAY: peer supports host-authoritative relay
let _useRelay=false; // RELAY: active relay mode (host runs sim, guest renders)
// NETFIX: ICE servers for NAT traversal — STUN for direct P2P, TURN for relay.
// Without these, WebRTC fails on mobile (CG NAT), corporate networks, symmetric NAT.
const ICE_SERVERS=[
  // Google STUN (unlimited free, no credentials needed)
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun1.l.google.com:19302"},
  // Open Relay Project TURN (free public credentials, port 80/443 for firewalls)
  {urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turns:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"},
];
// NETFIX: connection state machine — clear states instead of boolean flags.
// DISCONNECTED → CONNECTING → CONNECTED → IN_MATCH → RECONNECTING → DISCONNECTED
let connState="DISCONNECTED";
// NETFIX: heartbeat — detect connection loss before TCP timeout (~30s).
// Ping every 2s, if 3 consecutive pongs miss (6s), mark as disconnected.
let _heartbeatInterval=null;
let _lastPongReceived=0;
let _pingSeq=0;
let _currentRTT=0; // NETHARDEN: smoothed RTT for adaptive lockstep delay
// VOIDSTRIKE: full latency stats — jitter, packet loss, min/max RTT.
let _latencyStats={currentRTT:0,avgRTT:0,minRTT:Infinity,maxRTT:0,jitter:0,packetsLost:0,packetsSent:0};
let _pendingPings=new Map(); // pingId → timestamp (for packet loss detection)
const HEARTBEAT_INTERVAL_MS=2000;
const HEARTBEAT_TIMEOUT_MS=10000; // NETHARDEN: 5 missed pings (was 6s/3 pings — too aggressive for mobile)
// NETFIX: message sequence numbers — dedup + ordering.
let _sendSeq=0;
let _recvSeq=0;
// NETFIX: reconnection — store room info to rejoin on disconnect.
let _lastRoomId=null;
let _lastRoomPassword=null;
let _reconnectTimeout=null;
const RECONNECT_GRACE_MS=30000; // 30s grace period
// N6: attempt to rejoin the last room for mid-match reconnect.
function attemptReconnect(){
  if(connected)return; // already reconnected
  if(!_lastRoomId)return; // no room to reconnect to
  if(typeof G==="undefined"||typeof G.host!=="function")return;
  try{
    suppressP2PErrors=true;
    G.host(_lastRoomId,true,_lastRoomPassword||undefined);
    suppressP2PErrors=false;
  }catch(e){
    suppressP2PErrors=false;
    // Silent fail — will retry on next interval.
  }
}
function _p2pRateCheck(){
  const now=Date.now();
  if(now>_p2pRateBucket.resetAt){_p2pRateBucket.count=0;_p2pRateBucket.resetAt=now+P2P_RATE_WINDOW;}
  _p2pRateBucket.count++;
  return _p2pRateBucket.count<=P2P_RATE_MAX;
}
// NETHARDEN: per-message-type rate limits (prevents one message type from
// starving others). Limits are per-second.
const _p2pTypeLimits={
  snap:30,cmd_lock:30,command:10,round_deck:5,deck:5,
  role:3,role_tiebreak:5,seed:2,lockstep_start:2,relay_start:2,
  round_start:3,round_end:3,match_start:2,match_end:2,
  opponent_picks:3,spell_used:20,tick_ack:10,round_hash:3,
  battle_error:2,deck_ack:5,forge:3,request_deck:3,
};
const _p2pTypeCounts={};
function _p2pTypeRateCheck(type){
  const limit=_p2pTypeLimits[type];
  if(!limit)return true; // unlisted types: no per-type limit
  const now=Date.now();
  if(!_p2pTypeCounts[type]||now>_p2pTypeCounts[type].resetAt){
    _p2pTypeCounts[type]={count:0,resetAt:now+1000};
  }
  _p2pTypeCounts[type].count++;
  return _p2pTypeCounts[type].count<=limit;
}
// P2P security: room password (optional). Set by host, verified by guest.
let _roomPassword=null;
// NETFIX: start heartbeat — called when peer joins.
function _startHeartbeat(){
  _stopHeartbeat();
  _lastPongReceived=Date.now();
  _pingSeq=0;
  _latencyStats={currentRTT:0,avgRTT:0,minRTT:Infinity,maxRTT:0,jitter:0,packetsLost:0,packetsSent:0};
  _pendingPings=new Map();
  _heartbeatInterval=setInterval(()=>{
    if(!connected){_stopHeartbeat();return;}
    _pingSeq++;
    const ts=Date.now();
    _pendingPings.set(_pingSeq,ts);
    _latencyStats.packetsSent++;
    transmit("ping",{ts,ps:_pingSeq},true);
    // VOIDSTRIKE: count pings older than 5s as lost (no pong received).
    let lostCount=0;
    for(const [id,pingTs] of _pendingPings){
      if(ts-pingTs>5000){_pendingPings.delete(id);lostCount++;}
    }
    if(lostCount>0){_latencyStats.packetsLost+=lostCount;}
    // Check for timeout — peer unresponsive.
    if(Date.now()-_lastPongReceived>HEARTBEAT_TIMEOUT_MS){
      console.warn("[P2P] Heartbeat timeout — peer unresponsive for "+((Date.now()-_lastPongReceived)/1000).toFixed(1)+"s");
      _onHeartbeatTimeout();
    }
  },HEARTBEAT_INTERVAL_MS);
}
// NETFIX: stop heartbeat — called on disconnect / cleanup.
function _stopHeartbeat(){
  if(_heartbeatInterval){clearInterval(_heartbeatInterval);_heartbeatInterval=null;}
}
// NETFIX: heartbeat timeout — start reconnection grace period.
function _onHeartbeatTimeout(){
  if(connState!=="IN_MATCH"&&connState!=="CONNECTED")return;
  if(connState==="CONNECTED"){
    // Not in match — just disconnect.
    _handlePeerLeave();
    return;
  }
  // In match — start grace period if not already.
  if(Match.active&&role==="host"&&!Match._graceActive){
    Match._graceActive=true;
    // VOIDSTRIKE: network pause with reason.
    _setNetworkPaused(true,"Peer unresponsive — waiting for reconnection");
    Match.gracefulDisconnect();
  }else if(Match.active&&role==="guest"&&!Match._graceActive){
    Match._graceActive=true;
    // VOIDSTRIKE: network pause with reason.
    _setNetworkPaused(true,"Peer unresponsive — waiting for reconnection");
    Match.active=false;
    // NETFIX: capture opponent picks BEFORE stop() clears Battle.units.
    const opponentPicks=(Battle._finalUnits||Battle.units||[]).filter(u=>u.team==="player").map(u=>unit(u));
    Battle.stop();
    G.stopSnapshots();
    showDisconnectPrompt(opponentPicks);
  }
}
function disconnect(){if(room){try{room.leave();}catch(e){}room=null;sendNet=null;connected=false;role="none";_p2pRateBucket.count=0;
  _stopHeartbeat();
  connState="DISCONNECTED";
  // DET: clear lockstep state so the sim doesn't stall waiting for peer acks.
  _peerDetCapable=false;
  // RELAY: clear relay state.
  _peerRelayCapable=false;_useRelay=false;
  // NETHARDEN: clear all network-related Battle state to prevent stale data.
  if(typeof Battle!=="undefined"){
    Battle._lockstepActive=false;
    Battle._peerConfirmedTick=null;
    Battle._stallStart=null;
    Battle._useRelay=false;
    Battle._desyncFallback=false;
    Battle._cmdBuffer=new Map();
    Battle._interpFrom=null;
    Battle._interpTo=null;
    Battle._snapUnitMap=null;
    Battle._prevSnapshot=null;
  }
  // NETHARDEN: clear deck retransmit timer.
  if(G._deckRetransmitTimer){clearTimeout(G._deckRetransmitTimer);G._deckRetransmitTimer=null;}
  // NETHARDEN: reset RTT + transmit failure tracking.
  _currentRTT=0;
  _transmitFailCount=0;
  // VOIDSTRIKE: clear command buffer + latency stats on full disconnect.
  _commandBuffer=[];
  _latencyStats={currentRTT:0,avgRTT:0,minRTT:Infinity,maxRTT:0,jitter:0,packetsLost:0,packetsSent:0};
  _pendingPings.clear();
  // VOIDSTRIKE: clear network pause state.
  _setNetworkPaused(false,"Disconnected");
  // VOIDSTRIKE: clear signing state.
  _peerSigningPublicKey=null;
  _desyncState="synced";_desyncTick=null;
  // VOIDSTRIKE: clear command history.
  _clearCommandHistory();
  // NETFIX: reset sequence numbers + stop heartbeat on full disconnect.
  _sendSeq=0;
  _recvSeq=0;
  _stopHeartbeat();
}}

function setupNetwork(id,password){
  if(!joinRoom){
    showError("P2P unavailable (trystero not loaded).");
    return false;
  }
  try{
    // P2P security: incorporate password into room ID so only peers with
    // the same password can find each other. trystero uses the room ID as
    // a tracker key — different IDs = different rooms.
    let roomId=id;
    if(password){roomId=id+":pw:"+password;}
    _roomPassword=password||null;
    // NETFIX: store room info for reconnection.
    _lastRoomId=roomId;
    _lastRoomPassword=password||null;
    // NETFIX: pass ICE servers (STUN+TURN) for NAT traversal.
    // Without TURN, connections fail on mobile (CG NAT) and corporate networks.
    room=joinRoom({appId:"prompt-showdown-v4",rtcConfig:{iceServers:ICE_SERVERS}},roomId);
    connState="CONNECTING";
    // VOIDSTRIKE: initialize command signing on room join.
    _initCommandSigning();
    let action=room.makeAction("game");
    // trystero v0.25+ returns {send, onMessage, onReceiveProgress}
    sendNet=action.send||action[0];
    if("onMessage" in action)action.onMessage=data=>{if(data)networkReceive(data);};
    else if(typeof action[1]==="function")action[1](data=>{if(data)networkReceive(data);});
    room.onPeerJoin=()=>{
      connected=true;
      connState=Match.active?"IN_MATCH":"CONNECTED";
      setText("connection",t("status_connected"));
      const np=$("netPill");if(np)np.style.display="inline-flex";
      setText("netText","ON");
      const nb=$("networkBadge");if(nb)nb.style.display="block";
      G.cancelReconnect();
      // NETHARDEN: if the guest rejoined during a grace period, resync.
      if(Match._graceActive&&role==="host"&&Match.active){
        if(Battle._useRelay){
          // RELAY resync: restart sim + send relay_start + immediate snapshot.
          if(!Battle.running){
            Battle.running=true;
            Battle.last=performance.now();
            Battle._loopBound=Battle.loop.bind(Battle);
            Battle.frame=requestAnimationFrame(Battle._loopBound);
          }
          const spells={player:Match.playerSpells||G.playerSpells||[],enemy:Match.enemySpells||G.enemySpells||[]};
          transmit("relay_start",{playerSpells:spells.player,enemySpells:spells.enemy,round:Match.round});
          G.startSnapshots();
          const snap=Battle.compressedSnapshot();
          snap.round=Match.round;
          snap.livesPlayer=Match.livesPlayer;
          snap.livesEnemy=Match.livesEnemy;
          snap.drawIndex=G.roundDraftState?.drawIndex||0;
          transmit("snap",snap);
          Match._graceActive=false;
        }else if(Battle._lockstepActive||Battle._desyncFallback){
          // LOCKSTEP resync: send a fresh relay_start (fallback to relay for
          // the remainder of this round — can't resume lockstep mid-battle
          // because the guest's sim state is gone).
          if(!Battle.running){
            Battle.running=true;
            Battle.last=performance.now();
            Battle._loopBound=Battle.loop.bind(Battle);
            Battle.frame=requestAnimationFrame(Battle._loopBound);
          }
          Battle._lockstepActive=false;
          Battle._useRelay=true;
          const spells={player:Match.playerSpells||G.playerSpells||[],enemy:Match.enemySpells||G.enemySpells||[]};
          transmit("relay_start",{playerSpells:spells.player,enemySpells:spells.enemy,round:Match.round});
          G.startSnapshots();
          const snap=Battle.compressedSnapshot();
          snap.round=Match.round;
          snap.livesPlayer=Match.livesPlayer;
          snap.livesEnemy=Match.livesEnemy;
          transmit("snap",snap);
          Match._graceActive=false;
        }
      }
      // NETFIX: start heartbeat on peer join.
      _startHeartbeat();
      // VOIDSTRIKE: flush any buffered commands from during disconnect.
      if(_commandBuffer.length>0)_flushCommandBuffer();
      // VOIDSTRIKE: resume network pause if active.
      if(_networkPaused)_setNetworkPaused(false,"Peer reconnected");
      // VOIDSTRIKE: send our signing public key to peer.
      if(_signingPublicKeyB64)transmit("signing_key",{key:_signingPublicKeyB64});
      // Matchmaking: peer joined the queue room — show "opponent found".
      if(G.matchmakingWaitInterval){
        setText("matchmakingStatus","Opponent found! Negotiating roles...");
        const fill=$("matchmakingTimerFill");
        if(fill)fill.style.width="100%";
      }
      // P2P Test: log + update UI + stop wait timer.
      if(G.p2pTestState?.waitStart){
        G._p2pTestLog("✅ Peer joined! Connected.");
        G._p2pTestStopWaitTimer();
        G._p2pTestUpdateUI();
      }
    };
    room.onPeerLeave=()=>{
      _handlePeerLeave();
    };
    return true;
  }
  catch(e){
    if(!suppressP2PErrors)showError("P2P error: "+(e&&e.message||e));
    return false;
  }
}

// NETFIX: unified peer-leave handler — used by both onPeerLeave and heartbeat timeout.
function _handlePeerLeave(){
  connected=false;
  _stopHeartbeat();
  setText("connection",t("status_disconnected"));
  // P2P Test: log + update UI.
  if($("p2pTestLog")){
    G._p2pTestLog("❌ Peer left. Disconnected.");
    G._p2pTestUpdateUI();
  }
  // Phase 18/34: mid-match disconnect — offer reconnect grace period (host)
  // or "Continue vs Bot" prompt (guest). Both sides get the option.
  if(Match.active&&role==="host"){
    Match._graceActive=true;
    Match.gracefulDisconnect();
  }else if(Match.active&&role==="guest"){
    // RELAY: in relay mode, give the guest a grace period too (host might reconnect).
    // In lockstep/snapshot mode, the guest can't continue without the host, so show
    // the disconnect prompt immediately.
    if(Battle._useRelay){
      Match._graceActive=true;
      // Don't set Match.active=false — we want to resume if host reconnects.
      // Stop the battle but keep match state for potential resync.
      const opponentPicks=(Battle._finalUnits||Battle.units||[]).filter(u=>u.team==="player").map(u=>unit(u));
      Match.opponentPicks=opponentPicks; // save for "Continue vs Bot" fallback
      Battle.stop();
      G.showReconnect(30,()=>showDisconnectPrompt(opponentPicks));
    }else{
      Match.active=false;
      // NETFIX: capture opponent picks BEFORE stop() clears Battle.units.
      const opponentPicks=(Battle._finalUnits||Battle.units||[]).filter(u=>u.team==="player").map(u=>unit(u));
      Battle.stop();
      G.stopSnapshots();
      // P2P: offer "Continue vs Bot" to guest too (not just host).
      showDisconnectPrompt(opponentPicks);
    }
  }
  connState="DISCONNECTED";
}

// VOIDSTRIKE: connection quality — excellent/good/poor/critical based on RTT + jitter.
function _getConnectionQuality(){
  const rtt=_currentRTT,jitter=_latencyStats.jitter,loss=_latencyStats.packetsLost;
  if(rtt<50&&jitter<20&&loss<3)return"excellent";
  if(rtt<100&&jitter<50&&loss<10)return"good";
  if(rtt<250&&jitter<100&&loss<30)return"poor";
  return"critical";
}
// VOIDSTRIKE: network pause state — game paused waiting for connection recovery.
// Unlike grace period (which is silent), this shows a visible pause overlay.
let _networkPaused=false;
let _networkPauseReason=null;
let _networkPauseStartTime=null;
function _setNetworkPaused(paused,reason){
  const wasPaused=_networkPaused;
  _networkPaused=paused;
  _networkPauseReason=paused?reason:null;
  _networkPauseStartTime=paused?Date.now():null;
  if(paused&&!wasPaused){
    console.warn("[P2P] Network paused: "+reason);
    // Pause the battle sim if running.
    if(Battle.running&&!Battle._paused){Battle._paused=true;Battle._netPause=true;}
    // Show pause overlay.
    const ov=$("netPauseOverlay");
    if(ov){ov.style.display="flex";const t=$("netPauseReason");if(t)t.textContent=reason||"Waiting for peer...";}
  }else if(!paused&&wasPaused){
    console.log("[P2P] Network resumed after "+(_networkPauseStartTime?((Date.now()-_networkPauseStartTime)/1000).toFixed(1)+"s":"?"));
    if(Battle._netPause){Battle._paused=false;Battle._netPause=false;}
    const ov=$("netPauseOverlay");
    if(ov)ov.style.display="none";
  }
}
// VOIDSTRIKE: desync state — synced/checking/desynced (replaces boolean _desyncFallback).
// _desyncFallback is kept for backwards compat but _desyncState is the source of truth.
let _desyncState="synced"; // 'synced' | 'checking' | 'desynced'
let _desyncTick=null;
function _setDesyncState(state,tick){
  _desyncState=state;
  if(tick!==undefined)_desyncTick=tick;
  if(state==="desynced"){
    console.error("[DET] Desync confirmed at tick "+(tick||"?"));
    Battle._desyncFallback=true; // backwards compat
  }else if(state==="synced"){
    Battle._desyncFallback=false;
  }
  // Update UI indicator.
  const nb=$("networkBadge");
  if(nb&&state==="desynced"){nb.textContent+=" ⚠ DESYNC";}
}
// VOIDSTRIKE: command history — stores commands per-tick for replay/debug.
// Keeps up to 2000 ticks of history (≈33s at 60 TPS). Used to diagnose desyncs.
const COMMAND_HISTORY_MAX_TICKS=2000;
let _commandHistory=new Map(); // tick → array of commands
let _commandHistoryLastCleanup=0;
function _trackCommandHistory(cmd){
  if(!cmd||typeof cmd.tick!=="number")return;
  const tick=cmd.tick;
  const arr=_commandHistory.get(tick);
  if(arr)arr.push(cmd);
  else _commandHistory.set(tick,[cmd]);
  // Periodic cleanup (every 100 ticks ≈ 1.6s) to avoid per-command O(n) sweeps.
  const currentTick=Battle._tick||tick;
  if(currentTick-_commandHistoryLastCleanup>=100){
    _cleanupCommandHistory(currentTick);
    _commandHistoryLastCleanup=currentTick;
  }
}
function _cleanupCommandHistory(currentTick){
  const ticksToRemove=[];
  for(const tick of _commandHistory.keys()){
    if(currentTick-tick>COMMAND_HISTORY_MAX_TICKS)ticksToRemove.push(tick);
  }
  for(const tick of ticksToRemove)_commandHistory.delete(tick);
}
function _getCommandHistoryForTick(tick){
  return _commandHistory.get(tick)||[];
}
function _dumpCommandHistory(startTick,endTick){
  const dump=[];
  for(let t=startTick;t<=(endTick||startTick+100);t++){
    const cmds=_commandHistory.get(t);
    if(cmds)dump.push({tick:t,commands:cmds});
  }
  return dump;
}
function _clearCommandHistory(){
  _commandHistory.clear();
  _commandHistoryLastCleanup=0;
}
// Prevents command forgery/tampering in P2P. Each peer generates a key pair,
// shares the public key, and signs all cmd_lock messages.
let _signingKeyPair=null;
let _signingPublicKeyB64=null;
let _peerSigningPublicKey=null; // peer's imported CryptoKey for verification
let _signingEnabled=false;
async function _initCommandSigning(){
  try{
    _signingKeyPair=await crypto.subtle.generateKey(
      {name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]
    );
    const exported=await crypto.subtle.exportKey("spki",_signingKeyPair.publicKey);
    const bytes=new Uint8Array(exported);
    _signingPublicKeyB64=btoa(String.fromCharCode(...bytes));
    _signingEnabled=true;
    console.log("[P2P] Command signing initialized");
  }catch(e){
    console.warn("[P2P] Command signing unavailable:",e.message);
    _signingEnabled=false;
  }
}
async function _importPeerSigningKey(b64){
  try{
    const bin=atob(b64);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    _peerSigningPublicKey=await crypto.subtle.importKey(
      "spki",bytes.buffer,{name:"ECDSA",namedCurve:"P-256"},true,["verify"]
    );
    console.log("[P2P] Peer signing key imported");
  }catch(e){
    console.warn("[P2P] Failed to import peer signing key:",e.message);
  }
}
async function _signCommand(cmd){
  if(!_signingEnabled||!_signingKeyPair)return cmd;
  try{
    // Canonical: sorted keys, no signature field.
    const canon=JSON.stringify(cmd,Object.keys(cmd).sort());
    const data=new TextEncoder().encode(canon);
    const sig=await crypto.subtle.sign(
      {name:"ECDSA",hash:"SHA-256"},_signingKeyPair.privateKey,data
    );
    const sigBytes=new Uint8Array(sig);
    return{...cmd,sig:btoa(String.fromCharCode(...sigBytes))};
  }catch(e){
    console.warn("[P2P] Sign failed:",e.message);
    return cmd;
  }
}
async function _verifyCommand(cmd){
  if(!_signingEnabled||!_peerSigningPublicKey||!cmd.sig)return true; // no sig = allow (backwards compat)
  try{
    const{sig,...cmdWithoutSig}=cmd;
    const canon=JSON.stringify(cmdWithoutSig,Object.keys(cmdWithoutSig).sort());
    const data=new TextEncoder().encode(canon);
    const sigBytes=Uint8Array.from(atob(sig),c=>c.charCodeAt(0));
    return await crypto.subtle.verify(
      {name:"ECDSA",hash:"SHA-256"},_peerSigningPublicKey,sigBytes.buffer,data
    );
  }catch(e){
    console.warn("[P2P] Verify failed:",e.message);
    return false;
  }
}
// VOIDSTRIKE: sign + transmit a cmd_lock message (async wrapper).
async function _transmitSignedCmd(cmd){
  if(!_signingEnabled){transmit("cmd_lock",cmd);return;}
  const signed=await _signCommand(cmd);
  transmit("cmd_lock",signed);
}
// NETFIX: update connection status badge with latency + quality.
function _updateConnStatus(latency){
  const nb=$("networkBadge");
  if(!nb)return;
  const q=_getConnectionQuality();
  const jitter=_latencyStats.jitter;
  // VOIDSTRIKE: tooltip with full RTT stats (current/avg/min/max/jitter/loss).
  const ls=_latencyStats;
  const minR=ls.minRTT===Infinity?0:ls.minRTT;
  nb.title=`RTT: cur ${ls.currentRTT}ms | avg ${ls.avgRTT}ms | min ${minR}ms | max ${ls.maxRTT}ms | jitter ${ls.jitter}ms | lost ${ls.packetsLost}/${ls.packetsSent} | quality: ${q}`;
  if(q==="excellent"){nb.style.color="var(--ok)";nb.style.borderColor="var(--ok)";nb.style.background="rgba(52,211,153,.1)";nb.textContent="🌐 "+latency+"ms";}
  else if(q==="good"){nb.style.color="var(--ok)";nb.style.borderColor="var(--ok)";nb.style.background="rgba(52,211,153,.08)";nb.textContent="🌐 "+latency+"ms";}
  else if(q==="poor"){nb.style.color="var(--warn)";nb.style.borderColor="var(--warn)";nb.style.background="rgba(245,158,11,.1)";nb.textContent="🌐 "+latency+"ms ±"+jitter;}
  else{nb.style.color="var(--danger)";nb.style.borderColor="var(--danger)";nb.style.background="rgba(248,113,113,.1)";nb.textContent="🌐 "+latency+"ms ⚠";}
}

// NETHARDEN: track consecutive transmit failures — after 3, connection is dead.
let _transmitFailCount=0;
// VOIDSTRIKE: command buffer — stores commands during disconnect, flushed on reconnect.
let _commandBuffer=[];
const MAX_BUFFERED_COMMANDS=500;
function _bufferCommand(type,data){
  if(_commandBuffer.length>=MAX_BUFFERED_COMMANDS)_commandBuffer.shift();
  _commandBuffer.push({type,data,ts:Date.now()});
}
function _flushCommandBuffer(){
  if(_commandBuffer.length===0)return;
  console.log("[P2P] Flushing "+_commandBuffer.length+" buffered commands.");
  const buffered=_commandBuffer;
  _commandBuffer=[];
  for(const cmd of buffered){transmit(cmd.type,cmd.data);}
}
// NETFIX: transmit with sequence number. _internal=true skips seq (for heartbeat).
// N1/X1: emote wheel — send an emote to peer.
let onPeerEmote=null;
function sendEmote(emoji){
  if(!connected)return;
  if(typeof emoji!=="string"||emoji.length>20)return;
  transmit("emote",emoji);
}

function transmit(type,data,_internal){
  // VOIDSTRIKE: buffer lockstep commands during disconnect for flush on reconnect.
  if(!connected&&type==="cmd_lock"&&Match.active){_bufferCommand(type,data);return;}
  if(connected&&sendNet){
    try{
      const msg={t:type,d:data};
      // NETFIX: add sequence number for dedup (skip for internal heartbeat pings).
      if(!_internal){msg.seq=++_sendSeq;}
      // P2P security: enforce message size limit on send.
      const size=JSON.stringify(msg).length;
      if(size>P2P_MAX_MSG_SIZE){console.warn("[P2P] Dropping oversized message:",type,size);return;}
      const r=sendNet(msg);
      if(r&&r.catch){
        r.catch(e=>{
          console.error("[P2P] send error:",e.message);
          _transmitFailCount++;
          if(_transmitFailCount>=3){
            console.warn("[P2P] 3 consecutive transmit failures — connection dead.");
            _handlePeerLeave();
          }
        });
      }
      _transmitFailCount=0; // reset on success
    }catch(e){
      showError("Network send failed: "+(e&&e.message||e));
      _transmitFailCount++;
      if(_transmitFailCount>=3){
        console.warn("[P2P] 3 consecutive transmit failures — connection dead.");
        _handlePeerLeave();
      }
    }
  }
}

// Phase 18: mid-match disconnect prompt — "Continue vs Bot" or "Forfeit".
function showDisconnectPrompt(opponentPicks){
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;";
  overlay.innerHTML=`<div style="text-align:center;padding:20px;">
    <div style="font-size:1.3rem;margin-bottom:15px;">Opponent disconnected</div>
    <button id="discBot" style="margin:5px;padding:10px 20px;font-size:1rem;cursor:pointer;background:#4a7;border:none;color:#fff;border-radius:6px;">Continue vs Bot</button>
    <button id="discForfeit" style="margin:5px;padding:10px 20px;font-size:1rem;cursor:pointer;background:#f44;border:none;color:#fff;border-radius:6px;">Forfeit</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#discBot").onclick=()=>{
    overlay.remove();
    // Clean up P2P state before switching to bot mode.
    if(typeof disconnect==="function"){try{disconnect();}catch(e){}}
    role="none";
    G.stopSnapshots();
    // Swap opponent to bot using last known picks (preserves custom units).
    Match.opponentPicks=opponentPicks.length>0
      ?opponentPicks
      :Bot.draftRound(Match.history.length>0&&Match.history[Match.history.length-1].winner==="player"?4:3);
    toast(t("continue_vs_bot"));
  };
  overlay.querySelector("#discForfeit").onclick=()=>{
    overlay.remove();
    if(Match.active)Match.forfeit();
  };
}

let suppressP2PErrors=false;
// Phase 5/18: host-authoritative protocol.
//   role          : either     role assignment (host/guest)
//   request_deck  : host→guest "send me your drafted units"
//   deck          : guest→host {selected:[unit,...]}
//   snap          : host→guest full state snapshot at 20Hz
//   cmd           : guest→host {cmd:"tick"|"auto"|"skip"}
//   forge         : either→other share a forged unit
//   match_start   : host→guest {arena, lives, firstPlayer}
//   round_start   : host→guest {drawIndex, opponentPicks (serialized)}
//   opponent_picks: host→guest {picks (serialized units with recipes)}
//   round_end     : host→guest {winner, livesPlayer, livesEnemy, round}
//   match_end     : host→guest {winner, rewards}
//   round_deck    : guest→host {picks (serialized units with recipes)}
//   battle_error  : host→guest {msg} — Battle.start failed, return to menu
function networkReceive(data){
  try{
    // P2P security: reject non-objects or missing type.
    if(!data||typeof data!=="object"||typeof data.t!=="string")return;
    // NETFIX: handle heartbeat ping/pong BEFORE rate limiter — these are
    // critical for connection monitoring and must not be dropped by the
    // rate limit (which could happen during snapshot bursts at 20Hz).
    if(data.t==="ping"){
      transmit("pong",{ts:data.d?.ts},true);
      return;
    }
    if(data.t==="pong"){
      _lastPongReceived=Date.now();
      const latency=Date.now()-(data.d?.ts||0);
      const pingId=data.d?.ps;
      // VOIDSTRIKE: remove from pending pings (not lost).
      if(pingId!==undefined)_pendingPings.delete(pingId);
      // NETHARDEN: smoothed RTT (exponential moving average) for adaptive delay.
      _currentRTT=_currentRTT?Math.round(_currentRTT*0.7+latency*0.3):latency;
      // VOIDSTRIKE: full latency stats — jitter = |currentRTT - avgRTT|.
      _latencyStats.currentRTT=latency;
      _latencyStats.avgRTT=_currentRTT;
      _latencyStats.minRTT=Math.min(_latencyStats.minRTT,latency);
      _latencyStats.maxRTT=Math.max(_latencyStats.maxRTT,latency);
      _latencyStats.jitter=Math.round(Math.abs(latency-_currentRTT));
      G._p2pTestLog?.(`Pong — RTT: ${latency}ms (avg: ${_currentRTT}ms, jitter: ${_latencyStats.jitter}ms, lost: ${_latencyStats.packetsLost})`);
      _updateConnStatus(_currentRTT);
      return;
    }
    // P2P security: rate limiting — drop floods (after heartbeat exempt).
    if(!_p2pRateCheck()){console.warn("[P2P] Rate limit exceeded, dropping message:",data?.t);return;}
    // NETHARDEN: per-message-type rate limiting.
    if(!_p2pTypeRateCheck(data.t)){console.warn("[P2P] Per-type rate limit exceeded:",data.t);return;}
    // Guard: most message types require data.d; skip if missing.
    if(data.t!=="role"&&!data.d)return;
    // NETFIX: message dedup — drop messages with seq <= last seen (duplicates).
    // Heartbeat pings/pongs don't have seq (sent as _internal), so skip check.
    if(data.seq!==undefined){
      if(data.seq<=_recvSeq){
        console.debug("[P2P] Dropping duplicate/old message:",data.t,"seq:",data.seq,"<= ",_recvSeq);
        return;
      }
      _recvSeq=data.seq;
    }
    // VOIDSTRIKE: receive peer's signing public key.
    if(data.t==="signing_key"){
      if(data.d&&typeof data.d.key==="string")_importPeerSigningKey(data.d.key);
    }
    if(data.t==="role"){
      // P2P security: version compatibility check.
      if(typeof data.d==="object"&&data.d.v!==undefined){
        if(data.d.v!==CURRENT_VERSION){
          showError("Version mismatch: opponent has v"+data.d.v+", you have v"+CURRENT_VERSION+". Update to play.");
          disconnect();
          return;
        }
        if(role==="none")role=data.d.role||"guest";
        // DET: peer advertises determinism (lockstep) support.
        _peerDetCapable=!!data.d.det;
        // RELAY: peer advertises host-authoritative relay support.
        _peerRelayCapable=!!data.d.relay;
      }else if(typeof data.d==="string"){
        if(role==="host"&&data.d==="host"){
          // Both players joined the queue room — use tiebreaker to decide roles.
          // Lower peerId becomes host, higher becomes guest.
          // NETFIX: use crypto.getRandomValues for secure tiebreaker (not Math.random).
          if(!_peerId){
            const arr=new Uint8Array(8);
            crypto.getRandomValues(arr);
            _peerId=Array.from(arr).map(b=>b.toString(16).padStart(2,"0")).join("");
          }
          transmit("role_tiebreak",{id:_peerId});
        }else if(role==="none")role=data.d;
      }
      // If we're hosting and a peer connects during matchmaking,
      // cancel the wait timer and start a P2P match.
      if(role==="host"&&G.matchmakingWaitInterval){
        G.matchmakingCancelled=true;
        clearInterval(G.matchmakingWaitInterval);
        G.matchmakingWaitInterval=null;
        setText("matchmakingStatus","Opponent found! Starting match...");
        const fill=$("matchmakingTimerFill");
        if(fill)fill.style.width="100%";
        setTimeout(()=>G.start(),500);
      }
    }
    if(data.t==="role_tiebreak"){
      if(!_peerId)_peerId=Math.random().toString(36).slice(2);
      const otherId=data.d.id;
      if(_peerId===otherId){
        // Extremely unlikely collision — re-roll and re-send.
        _peerId=Math.random().toString(36).slice(2);
        transmit("role_tiebreak",{id:_peerId});
        return;
      }
      if(_peerId<otherId){
        role="host";
      }else{
        role="guest";
      }
      // Host starts the match; guest waits for round_start.
      if(role==="host"&&G.matchmakingWaitInterval){
        G.matchmakingCancelled=true;
        clearInterval(G.matchmakingWaitInterval);
        G.matchmakingWaitInterval=null;
        setText("matchmakingStatus","Opponent found! Starting match...");
        const fill=$("matchmakingTimerFill");
        if(fill)fill.style.width="100%";
        setTimeout(()=>G.start(),500);
      }
      // Guest: stop waiting, show "found opponent" message.
      if(role==="guest"&&G.matchmakingWaitInterval){
        clearInterval(G.matchmakingWaitInterval);
        G.matchmakingWaitInterval=null;
        setText("matchmakingStatus","Opponent found! Waiting for host to start...");
        const fill=$("matchmakingTimerFill");
        if(fill)fill.style.width="100%";
      }
    }
    if(data.t==="request_deck"){
      // Host asked for our deck; send our currently selected units.
      if(connected&&role==="guest"){
        const upgrades={};
        for(const p of G.selected||[]){if(!p._isSpell)upgrades[p.n]=G.unitLevel(p.n);}
        transmit("deck",{selected:G.selected,upgrades});
      }
    }
    if(data.t==="deck"){
      // Host receives the guest's deck and starts the authoritative battle.
      if(role==="host"){
        // P2P security: validate deck payload.
        const d=data.d;
        if(!d||!Array.isArray(d.selected)||d.selected.length>20)return;
        G._pendingGuestDeck={selected:d.selected,upgrades:d.upgrades||{}};
        // If host army is ready, start the battle now.
        if(G.pendingHostArmy)G.startHostBattle(G._pendingGuestDeck.selected,G._pendingGuestDeck.upgrades);
      }
    }
    if(data.t==="snap"){
      // Guest renders the host's authoritative snapshot.
      if(role==="guest")G.applyRemoteSnapshot(data.d);
    }
    // DET: host shares the deterministic battle seed with the guest.
    if(data.t==="seed"){
      if(role==="guest"&&data.d&&typeof data.d.seed==="number"){
        Match._receivedSeed=data.d.seed>>>0;
        Match.seed=data.d.seed>>>0; // DET: set Match.seed so Battle.start() uses it
      }
    }
    // RELAY: host starts a relay battle (fallback mode after desync, or peer
    // doesn't support determinism). Guest enters render-only mode — does NOT
    // run the sim, renders state from host snapshots instead.
    if(data.t==="relay_start"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        // P2P security: sanitize spells received from the host.
        const sanList=arr=>Array.isArray(arr)?arr.map(s=>sanitizeSpell(s)).filter(Boolean):[];
        const spells={player:sanList(d.playerSpells),enemy:sanList(d.enemySpells)};
        G.screen("battle");
        G.updateLivesHUD();
        // Guest's local team is "enemy" in the host's sim labeling.
        Battle._localTeam="enemy";
        Battle._useRelay=true;
        Battle._lockstepActive=false;
        // RELAY: restore match state if this is a reconnect (grace period was active).
        if(Match._graceActive){
          Match._graceActive=false;
          Match.active=true;
          G.cancelReconnect();
        }
        // Guest starts Battle with empty armies — units will arrive via snapshots.
        // We pass the spells so the spell bar renders correctly.
        Battle.start([],[],winner=>G.onBattleEnd(winner),spells);
      }
    }
    // DET: host starts a lockstep battle — guest runs the sim independently
    // from the same seed + armies. Sim labeling is the host's on both peers.
    if(data.t==="lockstep_start"){
      if(role==="guest"){
        const d=data.d;
        if(!d||typeof d!=="object")return;
        const playerArmy=deserializeArmyForPeer(d.playerArmy);
        const enemyArmy=deserializeArmyForPeer(d.enemyArmy);
        if(!playerArmy.length||!enemyArmy.length)return;
        // P2P security: sanitize spells received from the host.
        const sanList=arr=>Array.isArray(arr)?arr.map(s=>sanitizeSpell(s)).filter(Boolean):[];
        const spells={player:sanList(d.playerSpells),enemy:sanList(d.enemySpells)};
        // DET: set Match.seed from the host's seed so Battle.start() seeds the
        // PRNG identically on both peers. Without this, the guest's Match.seed
        // is undefined → Battle.start() uses 0 → complete desync from tick 1.
        if(typeof d.seed==="number"){Match._receivedSeed=d.seed>>>0;Match.seed=d.seed>>>0;}
        G.screen("battle");
        G.updateLivesHUD();
        // Guest's local team is "enemy" in the host's sim labeling. Both peers
        // call Battle.start(playerArmy, enemyArmy) in the SAME order → identical
        // initial unit array → deterministic.
        Battle._localTeam="enemy";
        Battle._lockstepActive=true;
        Battle.start(playerArmy,enemyArmy,winner=>G.onBattleEnd(winner),spells);
      }
    }
    // DET: lockstep command from peer — schedule for the target tick.
    if(data.t==="cmd_lock"){
      const c=data.d;
      if(c&&typeof c==="object"&&typeof c.type==="string"&&typeof c.tick==="number"){
        // VOIDSTRIKE: verify command signature if signing is enabled.
        if(_signingEnabled&&_peerSigningPublicKey){
          _verifyCommand(c).then(valid=>{
            if(!valid){
              console.warn("[P2P] Command signature verification FAILED — dropping");
              return;
            }
            _processLockstepCommand(c);
          });
        }else{
          _processLockstepCommand(c);
        }
      }
    }
    // N1/X1: emote — display emote from peer.
    if(data.t==="emote"){
      const e=data.d;
      if(e&&typeof e==="string"&&e.length<=20){
        if(typeof onPeerEmote==="function")onPeerEmote(e);
      }
    }
