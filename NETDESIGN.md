# NETDESIGN.md — Multiplayer Networking Design

## How Successful Mobile Auto-Battlers Do Networking

### Clash Royale (Supercell)
- **Architecture:** Authoritative server + deterministic lockstep on clients
- **Sync model:** Both clients run identical simulations; server only relays input
  events (card plays, positions), not game state. Server validates outcomes.
- **Latency handling:** Input delay buffering (GGPO-style). Actions have a small
  cast time to absorb network latency.
- **Disconnection:** Game continues running. Disconnected players can't act but
  the sim keeps going. Reconnect resumes play.
- **Bandwidth:** Minimal — only input events transmitted, not unit state.
- **Key insight:** The server is authoritative for validation, but both clients
  run the sim independently for zero-latency gameplay. Determinism is critical.

### Super Auto Pets (Team Wood)
- **Architecture:** Server-based networked multiplayer
- **Sync model:** Server holds team data. Battles are computed and replayed.
  Versus mode fetches opponent teams from server; Arena mode is asynchronous.
- **Key insight:** Auto-battlers don't need real-time sync during battle — the
  battle is deterministic from the starting state. Only the draft/setup phase
  needs real-time exchange of team composition.

### What This Means For Prompt Showdown
Our game is an **auto-battler** — once armies are placed, the battle runs
deterministically with no player input except spell casts / speed / pause.
This means:
1. **Draft phase:** Exchange deck picks (tiny data, not real-time critical)
2. **Battle phase:** Exchange commands only (spell cast, speed, pause) — lockstep
3. **Round end:** Exchange state hash for desync detection

We don't need low-latency real-time state sync. We need **reliable message
delivery** that works on mobile networks.

---

## Current Problems

### 1. No TURN/STUN servers (CRITICAL)
- **Impact:** P2P connections fail on mobile (CG NAT), corporate networks,
  symmetric NATs. This is the #1 reason "multiplayer just doesn't work."
- **Root cause:** `joinRoom({appId:"prompt-showdown-v4"},roomId)` passes no
  `rtcConfig.iceServers`. WebRTC uses default STUN only, which can't traverse
  CG NAT or symmetric NAT.
- **Fix:** Add free public TURN servers (Open Relay Project + Google STUN).

### 2. No heartbeat / connection monitoring
- **Impact:** Can't distinguish between "peer lagged" and "peer disconnected."
- **Root cause:** No periodic ping/pong. The only disconnect detection is
  trystero's `onPeerLeave` callback, which fires after TCP timeout (~30s).
- **Fix:** Add 2-second heartbeat ping/pong. If 3 consecutive pings miss,
  show "connection lost" and start reconnect grace period.

### 3. No message ordering or deduplication
- **Impact:** Messages can arrive out of order or duplicated, causing
  inconsistent state (e.g., round_end processed before round_start).
- **Root cause:** Trystero's data channels don't guarantee ordering for
  unreliable mode, and even reliable mode can deliver duplicates on reconnect.
- **Fix:** Add monotonically increasing sequence numbers. Drop messages
  with seq <= lastSeenSeq. Buffer out-of-order messages briefly.

### 4. No reconnection logic
- **Impact:** Any disconnect is fatal. The "reconnect grace period" is just
  a countdown timer — it doesn't actually attempt to reconnect.
- **Root cause:** `showReconnect()` shows a UI countdown but never tries
  to re-establish the P2P connection.
- **Fix:** On disconnect, attempt to rejoin the room. If peer rejoins within
  30s, resync state (host sends current match state). If not, fall back to bot.

### 5. Fragile role assignment
- **Impact:** Both peers can briefly think they're host, causing duplicate
  state transitions.
- **Root cause:** Role tiebreaker uses `Math.random()` (not crypto-secure),
  and the 500ms delay before sending role message creates a race window.
- **Fix:** Use `crypto.getRandomValues()` for tiebreaker ID. Send role
  message immediately on peer join (no delay).

### 6. Silent failures everywhere
- **Impact:** When networking fails, the user sees nothing or gets stuck.
- **Root cause:** Most error handling is `console.warn()` with no user-visible
  feedback.
- **Fix:** Add a connection status indicator. Show errors as toasts.
  Add timeout for every network operation.

---

## Design: Bulletproof Networking

### Connection State Machine

```
DISCONNECTED → CONNECTING → CONNECTED → IN_MATCH
     ↑              ↓            ↓            ↓
     ←──────────────←────────────←──────────←
                    ↓            ↓
              RECONNECTING ← FAILED
                    ↓
              (retry 3x) → DISCONNECTED
```

States:
- **DISCONNECTED:** No room joined. UI shows "Play Online" button.
- **CONNECTING:** `joinRoom()` called, waiting for peer. 30s timeout → FAILED.
- **CONNECTED:** Peer joined, roles assigned. UI shows "Ready" + room code.
- **IN_MATCH:** Match.active=true. Draft/battle screens active.
- **RECONNECTING:** Peer left during match. 30s grace period, retrying.
- **FAILED:** Connection attempt failed. Show error, offer bot fallback.

### ICE Server Configuration

```javascript
const ICE_SERVERS=[
  // Google STUN (unlimited free, no credentials)
  {urls:"stun:stun.l.google.com:19302"},
  {urls:"stun:stun1.l.google.com:19302"},
  // Open Relay Project TURN (free, public credentials)
  // Runs on port 80/443 to bypass corporate firewalls
  {urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turn:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"},
  {urls:"turns:openrelay.metered.ca:443?transport=tcp",username:"openrelayproject",credential:"openrelayproject"},
];
```

STUN = direct P2P when possible (fastest).
TURN = relay through server when NAT blocks direct connection (works everywhere).

### Heartbeat Protocol

- Every 2 seconds, send `{t:"ping",d:{ts:Date.now()}}`
- On receiving ping, immediately reply `{t:"pong",d:{ts:ts}}`
- Track `lastPongReceived` timestamp
- If `Date.now() - lastPongReceived > 6000` (3 missed pings):
  - Set connection state to RECONNECTING
  - Show "Connection lost, reconnecting..." banner
  - Start 30s grace period
- If pong received during grace: return to CONNECTED/IN_MATCH
- If grace expires: fall back to bot

### Message Sequence Numbers

Every message includes a `seq` field:
```javascript
{t:"round_start",d:{...},seq:42}
```

- Each peer maintains `_sendSeq` (incrementing) and `_recvSeq` (last seen)
- On receive: if `msg.seq <= _recvSeq`, drop (duplicate/old)
- On receive: if `msg.seq > _recvSeq + 1`, it's out-of-order — process anyway
  (for this game, most messages are idempotent or last-wins)
- Update `_recvSeq = max(_recvSeq, msg.seq)`

### Reconnection Logic

On peer leave during match:
1. Set state to RECONNECTING
2. Show "Reconnecting..." overlay with 30s countdown
3. Attempt to rejoin room (trystero will re-establish connection if peer returns)
4. If peer rejoins:
   - Host sends `resync` message with full match state (round, lives, history)
   - Guest applies resync and continues
5. If 30s expires:
   - Show "Continue vs Bot" prompt
   - Clean up P2P state

### Connection Status UI

Add a small status badge visible during multiplayer:
- 🟢 Connected (latency: 45ms)
- 🟡 Reconnecting... (3/30s)
- 🔴 Disconnected

---

## Implementation Plan

1. Add ICE_SERVERS constant + pass to `joinRoom()` config
2. Add connection state machine (`connState` variable + transitions)
3. Add heartbeat (ping/pong every 2s, 3-miss disconnect)
4. Add message sequence numbers (seq field, dedup on receive)
5. Add reconnection logic (rejoin room, resync state)
6. Add connection status UI badge
7. Fix role assignment (crypto.getRandomValues, no delay)
8. Add timeouts for all network operations
9. Add user-visible error reporting (toasts, not just console.warn)

## Why Not Switch Away From Trystero?

Considered alternatives:
- **PeerJS:** Needs a signaling server (free public one is unreliable for production)
- **geckos.io:** Needs a Node.js server (violates single-file constraint)
- **Poki netlib:** Beta, not publicly available
- **Supabase/Firebase realtime:** Works but requires account setup + API keys
- **Raw WebRTC:** Too much boilerplate, reinvents trystero

Trystero's Torrent strategy works — the main issue is **missing TURN servers**,
not the signaling strategy. WebTorrent trackers use WebSocket (wss://) which
works on most networks. Adding TURN servers fixes the NAT traversal problem
that causes most connection failures.

The second issue is **no reconnection logic** — trystero handles the initial
connection fine, but any network hiccup kills the match. Adding heartbeat +
reconnection makes it resilient.

## References

- [Gaffer On Games: Deterministic Lockstep](https://gafferongames.com/post/deterministic_lockstep/)
- [Gaffer On Games: Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/)
- [Clash Royale multiplayer analysis](https://blog.gemserk.com/2016/09/05/analyzing-clash-royale-multiplayer-solution/)
- [Trystero troubleshooting: TURN servers](https://github.com/dmotz/trystero#troubleshooting-connection-issues)
- [Open Relay Project: free TURN](https://openrelayproject.org)
- [Trystero #97: mobile network issues](https://github.com/dmotz/trystero/issues/97)
- [Trystero #92: PeerConnection accumulation](https://github.com/dmotz/trystero/issues/92)
