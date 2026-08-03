# Multiplayer Hardening Plan

## Status: IN PROGRESS

## Context

Audit found 50 issues. After verification, ~15 are real (many were false positives
because WebRTC data channels are reliable+ordered, pause returns before accumulator,
and Battle.start resets all flags). This plan focuses on the real issues, prioritized
by impact.

## Verified False Positives (no action needed)

- **Stall watchdog vs pause**: Pause returns at line 6758 before accumulator feeds.
  Watchdog never fires during pause.
- **Message dedup vs reordering**: WebRTC data channels are reliable+ordered by default.
  Simple sequence dedup is correct.
- **Command buffer not cleared on mode switch**: Battle.start() resets `_cmdBuffer`.
  Mode switches happen between rounds (next Battle.start call).
- **_desyncFallback never reset**: Reset in Battle.start(). Intentionally stays true
  for the match — if desync happened once, it'll happen again (same code, same browsers).
- **_lockstepActive and _useRelay both true**: Battle.start() sets both to false.
  Caller sets one to true after. Can't both be true.

## Tier 1: Critical Correctness (fix first)

### 1.1 Relay spell cooldown validation
**Issue**: Host receives `command` message from guest and executes spell cast without
checking if the spell is off cooldown. A malicious guest could spam spells.
**Fix**: In the `command` message handler, validate `ps.cooldown<=0` before executing.
Reject if on cooldown.
**Lines**: ~3812-3832 (command handler)

### 1.2 Round number validation on round_end/round_start
**Issue**: Guest doesn't validate that received `round_end`/`round_start` matches
current `Match.round`. A replayed message could update lives/history incorrectly.
**Fix**: Add `round` field to `round_end`/`round_start` messages. Guest validates
`d.round===Match.round` before processing. Drop if mismatch.
**Lines**: 3882-3913 (round_start/round_end handlers), 4441-4449 (host send)

### 1.3 Battle.start failure notification
**Issue**: If canvas init fails in Battle.start, the peer is never notified. The peer
waits for a battle that never starts.
**Fix**: Wrap Battle.start in try/catch in startHostBattle. On failure, transmit
`error` message to peer so they can show an error and return to menu.
**Lines**: 6640-6646 (Battle.start canvas init), 11747+ (startHostBattle)

### 1.4 Transmit failure fallback
**Issue**: If sendNet fails, the error is logged but no fallback is triggered. Critical
messages like cmd_lock can be lost silently.
**Fix**: In transmit(), if sendNet throws, track consecutive failures. After 3
consecutive failures, trigger _handlePeerLeave (connection is dead).
**Lines**: 3501-3512 (transmit)

## Tier 2: Robustness (fix second)

### 2.1 Actual reconnection logic
**Issue**: `_reconnectTimeout` is defined but never used. The 30s grace period shows
UI but doesn't attempt to reconnect. If the peer comes back, `onPeerJoin` fires and
handles it, but only for relay mode. For lockstep, there's no resync.
**Fix**: For relay mode: already handled (host sends relay_start + snapshot on rejoin).
For lockstep: on rejoin, host sends a fresh `lockstep_start` with current state as a
snapshot (armies + seed + current tick). Guest fast-forwards from snapshot.
**Lines**: 3392-3426 (onPeerJoin)

### 2.2 Adaptive LOCKSTEP_DELAY
**Issue**: LOCKSTEP_DELAY is hardcoded to 3 ticks (50ms). On high-latency connections
(>100ms RTT), commands arrive too late, triggering unnecessary fallbacks.
**Fix**: Measure RTT from heartbeat pings. Set `LOCKSTEP_DELAY = clamp(round(RTT/2 / 16.67), 2, 8)`.
Update dynamically when RTT changes significantly.
**Lines**: 8968 (LOCKSTEP_DELAY), 3312-3321 (heartbeat with RTT)

### 2.3 Round deck confirmation
**Issue**: Guest sends `round_deck` without confirmation. If message is lost (connection
drop at that moment), host never receives deck → battle never starts.
**Fix**: Host sends `deck_ack` after receiving `round_deck`. Guest waits for `deck_ack`
with 5s timeout. If no ack, guest retransmits (up to 3 times).
**Lines**: 11198-11199 (guest send), 3931-3935 (host receive)

### 2.4 disconnect() clears all Battle state
**Issue**: disconnect() doesn't clear `_cmdBuffer`, `_interpFrom`, `_interpTo`,
`_snapUnitMap`, etc. Stale state persists if a new match starts without page reload.
**Fix**: Add `Battle._resetNetState()` that clears all network-related state. Call it
from disconnect() and Battle.start().
**Lines**: 3349-3366 (disconnect)

## Tier 3: Hardening (fix third)

### 3.1 sanitizeSpell validates all enum fields
**Issue**: sanitizeSpell validates `trigger` but not `fxType`, `targetType`, `effect`.
A malicious peer could send invalid values.
**Fix**: Add enum validation for fxType, targetType, effect. Reject spell if any
enum field is invalid.
**Lines**: 1614-1620 (sanitizeSpell)

### 3.2 Heartbeat timeout adaptive for mobile
**Issue**: 6s timeout is too aggressive for mobile networks. Temporary stalls >6s
are common on cellular.
**Fix**: Increase to 10s (5 missed pings). Add a "lag warning" at 6s that shows a
UI indicator without disconnecting.
**Lines**: 3289-3290 (constants)

### 3.3 Per-message-type rate limiting
**Issue**: Global rate limit (60 msgs/sec). A flood of one message type can block
others.
**Fix**: Add per-type limits: cmd_lock 20/s, snap 20/s, command 10/s, ping 1/s,
others 60/s.
**Lines**: 3299-3304 (_p2pRateCheck)

### 3.4 Tab visibility handling for lockstep
**Issue**: When a tab is backgrounded, rAF pauses, local sim stops. Peer's stall
watchdog fires after 5s → relay fallback. This works but is abrupt.
**Fix**: On visibilitychange→hidden, send `pause` command to peer (both pause).
On visible, send `resume` command (both resume). This prevents the stall watchdog
from firing during intentional tab switches.
**Lines**: 14681-14686 (visibilitychange handler)

## Tier 4: Testing (implement last)

### 4.1 Network simulation mode
**Goal**: Add `?netSim=loss:5,latency:100,jitter:20` URL parameter for testing.
**Implementation**: Wrap transmit/networkReceive with delay/loss/jitter simulation.
Use for all multiplayer tests.

### 4.2 2-peer relay mode tests
**Goal**: Test relay mode the same way we test lockstep (hash comparison, command
relay, spell CD sync, pause/speed sync).
**Tests**:
- Guest renders correctly from host snapshots
- Guest commands reach host and execute
- Spell cooldowns sync from host to guest
- Pause/speed state syncs from host to guest
- Winner determination matches between host and guest

### 4.3 Reconnection tests
**Tests**:
- Guest disconnects during relay battle, reconnects → host resyncs
- Host disconnects during relay battle, reconnects → guest resyncs
- Disconnect during draft → grace period → reconnect → battle starts
- Disconnect during round transition → grace period → reconnect → next round

### 4.4 Edge case tests
**Tests**:
- Tab switch during lockstep battle → pause/resume
- High latency (200ms) → adaptive LOCKSTEP_DELAY
- Packet loss (5%) → no desync
- Malformed messages → rejected, no crash
- Spell cast while on cooldown → rejected
- Round number mismatch → message dropped

## Implementation Order

1. Tier 1 (1.1-1.4): Critical correctness — ~30 min
2. Tier 2 (2.1-2.4): Robustness — ~60 min
3. Tier 3 (3.1-3.4): Hardening — ~45 min
4. Tier 4 (4.1-4.4): Testing — ~90 min
5. Run E2E tests + perf after each tier
