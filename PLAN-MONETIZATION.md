# PLAN-MONETIZATION.md — Full Monetization Strategy

## Executive Summary

A hybrid monetization model for Prompt Showdown combining **ad revenue** (primary,
serving 95% of players) with **cosmetic microtransactions** (secondary, capturing
the 5% who pay). The strategy follows the autobattler genre standard set by
Teamfight Tactics: **cosmetic-only, never pay-to-win**.

### Revenue Stream Priority

| Priority | Stream | Target Audience | Est. Revenue Share | Phase |
|----------|--------|-----------------|-------------------|-------|
| 1 | Rewarded video ads | 95% (non-payers) | 60-70% of total | Phase 1 (now) |
| 2 | Midgame video ads | 95% (non-payers) | 20-25% of total | Phase 1 (now) |
| 3 | Cosmetic IAP | 5% (payers) | 10-15% of total | Phase 2 |
| 4 | Battle Pass | 3-5% (engaged) | 5-10% of total | Phase 3 |
| 5 | Ad-free subscription | 1-2% (whales) | 1-3% of total | Phase 3 |

**Key principle**: Ads fund the game for everyone. IAPs are purely cosmetic —
no gameplay advantage, ever. This protects retention and avoids the "pay-to-win"
death spiral.

---

## 1. Current State Audit

### 1.1 What We Already Have

| Feature | Status | File |
|---------|--------|------|
| Coins (soft currency) | ✅ Implemented | `src/save.js` — `s.coins` |
| XP & player level | ✅ Implemented | `src/ui.js` — `playerLevel()` |
| Per-unit upgrades | ✅ Implemented | `src/ui.js` — `unitLevel()`, +10% hp/d per level |
| Daily quests | ✅ Implemented | `src/ui.js` — `this.save.quests` |
| Login streaks | ✅ Implemented | `src/ui.js` — `this.save.quests.streak` |
| Ranked seasons | ✅ Implemented | `src/ui.js` — `this.save.ranked.season` |
| Arena ladder (5 tiers) | ✅ Implemented | `src/ui.js` — `this.arenas[]` |
| Emote wheel (16 emotes) | ✅ Implemented | `src/ui.js` — `this._emotes[]` |
| Ad-free toggle (settings) | ✅ Implemented | `src/utils.js` — `AdSDK.adFree` |
| AdSDK facade (3 providers) | ✅ Implemented | `src/utils.js` — Stub/H5/CrazyGames |
| Rewarded ads (forge) | ✅ Implemented | `src/ui.js` — forge flow |
| Interstitial ads | ✅ Implemented | `src/ui.js` — every 3 matches |
| Background themes | ✅ Implemented | `src/battle.js` — `_bgThemes` |
| Weather FX | ✅ Implemented | `src/battle.js` — `_weatherParticles` |
| Projectile trails | ✅ Implemented | `src/battle.js` — weapon-specific trails |

### 1.2 What We're Missing

| Feature | Priority | Effort |
|---------|----------|--------|
| Real ad network (CrazyGames) | Critical | Low (see PLAN-CRAZYGAMES.md) |
| Premium currency (gems) | High | Medium |
| Cosmetic shop UI | High | Medium |
| Unit skins (visual variants) | High | High (art assets) |
| Battle pass system | Medium | High |
| Cloud save (cross-device) | Medium | Low (CrazyGames Data module) |
| Payment provider integration | Medium | Medium (Xsolla via CrazyGames) |
| Seasonal events | Low | Medium |
| Gacha/loot system | Low | Medium |

---

## 2. Currency System

### 2.1 Dual Currency Model

Following the standard F2P autobattler pattern (TFT, Hearthstone, Marvel Snap):

| Currency | Type | Source | Sink | Storage |
|----------|------|--------|------|---------|
| **Coins** | Soft (earned) | Matches, quests, daily login, achievements | Unit upgrades, rerolls, emote unlocks | `save.coins` |
| **Gems** | Hard (purchased) | IAP only, battle pass, rare achievements | Cosmetics, battle pass, exclusive skins | `save.gems` |

**Exchange rate**: Coins cannot be converted to Gems (one-way). This prevents
grind-to-pay and protects IAP revenue.

### 2.2 Coin Economy (Already Exists)

Current coin sources:
- Match win: ~50 coins
- Match loss: ~10 coins
- Daily quest: ~100-300 coins
- Login streak: ~50-200 coins

Current coin sinks:
- Unit upgrade: 100 × level² coins (level 1→2: 100, 2→3: 400, etc.)
- Reroll in draft: 10 coins (increasing)

**Recommendation**: Keep as-is. The coin economy is balanced for gameplay
progression, not monetization.

### 2.3 Gem Economy (New)

Gem sources (IAP only):
- $0.99 → 80 gems
- $4.99 → 450 gems (+10% bonus)
- $9.99 → 1,000 gems (+25% bonus)
- $19.99 → 2,200 gems (+37% bonus)
- $49.99 → 6,000 gems (+50% bonus)

Gem sinks:
- Unit skin: 200-800 gems (by tier)
- Arena skin: 300-500 gems
- Emote pack: 100-200 gems
- Battle pass: 500 gems (~$5)
- Finisher effect: 400 gems
- Trail effect: 200 gems

**Price psychology**: Low entry ($0.99 for 80 gems), making the cheapest
cosmetic (100-gem emote pack) achievable with one purchase + some earned gems.

---

## 3. Cosmetic System Design

### 3.1 Principles (From TFT / Marvel Snap)

1. **Cosmetic-only**: Zero gameplay impact. A skinned Knight has identical stats
   to the default Knight.
2. **Visible during gameplay**: Skins show on the battle canvas, not just menus.
   This creates social proof and drives purchases.
3. **Rarity tiers**: Standard / Legendary / Mythic (mirrors TFT's 4-tier system).
4. **Limited-time items**: Seasonal skins create FOMO and urgency.
5. **No loot boxes** (initially): Direct purchase only. Gacha is Phase 4+.

### 3.2 Cosmetic Categories

#### 3.2.1 Unit Skins (Primary Revenue)

Visual variants for each unit. Each skin changes the unit's color palette and
drawing style on the battle canvas.

| Tier | Price (Gems) | Examples | Art Effort |
|------|-------------|----------|-----------|
| Standard | 200 | Recolor (e.g., "Crimson Knight", "Frost Archer") | Low (palette swap) |
| Legendary | 500 | New drawing style (e.g., "Mecha Knight", "Shadow Archer") | Medium |
| Mythic | 800 | Full redesign + particle effects (e.g., "Dragon Knight", "Phoenix Archer") | High |

**Implementation**: Our units are drawn procedurally (see R1 bespoke drawing).
Skins = alternative draw functions or palette overrides. This is code, not art
assets — much cheaper than sprite-based games.

```js
// Example: skin system in battle.js
const UNIT_SKINS = {
  Knight: {
    default: { color: "#44aaff", drawFn: drawKnight },
    crimson: { color: "#ff4444", drawFn: drawKnight },  // palette swap
    mecha:   { color: "#888888", drawFn: drawMechaKnight }, // new draw fn
  },
  // ... per unit
};

// In unit rendering:
const skin = save.skins?.[unit.name] || "default";
const skinData = UNIT_SKINS[unit.name]?.[skin] || UNIT_SKINS[unit.name]?.default;
ctx.fillStyle = skinData.color;
skinData.drawFn(ctx, x, y, r, unit);
```

**Initial catalog**: 5 units × 3 skins = 15 skins. Expand over time.

#### 3.2.2 Arena Skins (Background Themes)

We already have `_bgThemes` (forest, plague, desert, void, thunder). These are
gameplay-linked (arena progression). Cosmetic arena skins are separate —
player-chosen backgrounds that don't affect mechanics.

| Skin | Price | Effect |
|------|-------|--------|
| Sunset | 300 | Warm orange gradient + particle fireflies |
| Ocean | 300 | Blue waves + bubble particles |
| Space | 500 | Starfield + nebula + meteor particles |
| Neon | 500 | Cyberpunk grid + scanlines |
| Custom Color | 200 | Player picks any hex color |

**Implementation**: Add to `_bgThemes` as non-mechanic entries. Player selects
in settings; overrides arena default in battle.

#### 3.2.3 Emote Packs (Low-Tier Entry)

We already have 16 default emotes. Sell themed packs:

| Pack | Price | Emotes |
|------|-------|--------|
| Default | Free | 😀😎😡😭🤔👏🔥💀 |
| Pro | 100 | 🏆🎯🤝 GG GL! WP 🎮 |
| Meme | 150 | 🧂😭 RN 💀 🗿 📈 🔥 ⚡ |
| Cute | 150 | 🥰 🐱 🌸 ✨ 🌈 🎀 💝 🦄 |

**Implementation**: `save.emotePacks = ["default"]`. Add pack selection to
emote wheel setup in `src/ui.js`.

#### 3.2.4 Finisher Effects (High-Tier)

Visual effect when your unit kills an enemy:

| Effect | Price | Visual |
|--------|-------|--------|
| Default | Free | Standard death animation |
| Explosion | 400 | Expanding ring + particles |
| Lightning | 400 | Chain lightning to nearby enemies |
| Confetti | 300 | Party confetti burst |
| Void | 600 | Black hole implosion effect |

**Implementation**: Hook into `drawDeath()` in `src/battle.js`. Check
`save.finisher` and render appropriate effect.

#### 3.2.5 Projectile Trail Skins

We already have weapon-specific trails (R5). Sell alternative trail styles:

| Trail | Price | Effect |
|-------|-------|--------|
| Default | Free | Weapon-specific (current R5) |
| Rainbow | 300 | Multi-color gradient trail |
| Fire | 300 | Flame particles along trail |
| Ice | 300 | Frost crystals along trail |
| Golden | 500 | Gold sparkles + glow |

**Implementation**: Override trail rendering in `src/battle.js` based on
`save.trailSkin`.

### 3.3 What We Will NOT Sell (Pay-to-Win Protections)

| Item | Reason |
|------|--------|
| Stat boosts | Pay-to-win, kills retention |
| Extra draft picks | Unfair advantage in multiplayer |
| Reduced cooldowns | Gameplay advantage |
| Exclusive units | Content gating, frustrates F2P |
| XP/coin boosters | Borderline; skip for now |
| Extra lives/continues | Not applicable (no lives system) |

---

## 4. Battle Pass System (Phase 3)

### 4.1 Design (Based on TFT Proto Pass + Dota Underlords)

**Season length**: 10 weeks (matches TFT's set duration)

**Two tracks**:
- **Free Track** (all players): Coins, 1 emote pack, 1 standard skin, quests
- **Premium Track** (500 gems / ~$5): Everything above + gems, legendary skin,
  finisher effect, arena skin, exclusive seasonal skin

**Progression**: Season XP earned from:
- Match played: +50 XP
- Match won: +100 XP
- Daily quest completed: +200 XP
- Weekly challenge: +500 XP
- Arena promotion: +1000 XP

**30 levels**, ~20,000 XP per level = ~600,000 XP total.
Casual player (2 matches/day + dailies): ~49 days to complete.
Premium player (4 matches/day + dailies + weeklies): ~30 days.

### 4.2 Reward Distribution (30 Levels)

| Levels | Free Track | Premium Track |
|--------|-----------|---------------|
| 1 | 100 coins | 50 gems |
| 5 | 1 reroll token | 100 gems |
| 10 | Standard skin | Legendary skin |
| 15 | 200 coins | Finisher effect |
| 20 | Emote pack | Arena skin |
| 25 | 300 coins | 200 gems |
| 30 | Season banner | Exclusive Mythic skin |

**Season banner**: A cosmetic flag/banner shown on the player's profile and
in multiplayer lobbies. Proves they completed the pass.

### 4.3 Implementation

```js
// save.js additions
s.battlePass = s.battlePass || {
  season: 0,           // current season number
  level: 0,            // current level (0-30)
  xp: 0,               // current XP in level
  premium: false,      // purchased premium track?
  claimed: [],         // claimed reward levels
};
```

**UI**: New "Battle Pass" screen accessible from main menu. Shows progress
bar, reward track (horizontal scroll), and "Upgrade to Premium" button.

---

## 5. Ad Revenue Strategy (Phase 1 — Immediate)

### 5.1 Ad Format Mix

| Format | When | Frequency | eCPM (US) | Est. Revenue/1000 plays |
|--------|------|-----------|-----------|------------------------|
| Rewarded (forge) | Player opts in for LLM unit | Unlimited (player choice) | $15-28 | $3-8 |
| Rewarded (double coins) | After match win | 1x per match | $15-28 | $2-5 |
| Midgame | After match (every 3rd) | Auto-paced by SDK (3 min cap) | $8-15 | $1-3 |
| Banner | Menu/lobby screens | Persistent | $0.5-2 | $0.5-1 |

**Total est.**: $6.5-17 per 1000 plays (US). Lower in EU/Tier-3.

### 5.2 Ad Placement Rules (CrazyGames Compliant)

1. **No ads during gameplay** — only at natural breaks
2. **Game paused + muted during ad** — `_beforeAd()` handles this
3. **Rewarded ads are opt-in** — player must click "Watch Ad" button
4. **No reward on ad error** — only on `adFinished`
5. **Midgame auto-paced** — SDK handles 3-minute cooldown
6. **Ad-free mode** — existing toggle disables all ads (for IAP buyers)

### 5.3 New Rewarded Placements (Beyond Forge)

| Placement | Trigger | Reward | Cooldown |
|-----------|---------|--------|----------|
| Double coins | After match win | 2× coin reward | 1x per match |
| Free upgrade | Upgrade screen | Free unit upgrade (saves coins) | 1x per day |
| Reroll refill | Draft screen | +3 rerolls | 1x per match |
| Daily quest skip | Quest screen | Auto-complete one daily quest | 1x per day |
| Revive (PvE) | After losing in arena | Continue with full HP | 1x per match |

**CrazyGames compliance**: All are opt-in, have equal-size skip buttons, and
provide alternatives (pay with coins, or skip entirely).

---

## 6. Payment Provider Integration

### 6.1 Platform-Specific Payment Routing

| Distribution | Payment Provider | Fee | Integration |
|-------------|-----------------|-----|-------------|
| CrazyGames portal | Xsolla (via CrazyGames SDK) | ~5-10% | `SDK.user.getXsollaUserToken()` |
| Self-hosted website | Stripe / Paddle | 2.9% + $0.30 | Stripe Checkout / Paddle.js |
| Other portals (Poki, etc.) | Portal's own IAP | Varies | Per-portal SDK |

### 6.2 CrazyGames + Xsolla (Primary)

CrazyGames partners with Xsolla for IAP. Flow:
1. Player clicks "Buy 450 Gems" in shop
2. Game calls `window.CrazyGames.SDK.user.getXsollaUserToken(callback)`
3. Token used with Xsolla SDK to open Pay Station
4. Player pays (credit card, PayPal, local methods — 1000+ supported)
5. Xsolla webhook → our backend credits gems to user account
6. Game refreshes inventory

**Requirement**: IAP on CrazyGames is **invite-only**. We must apply after
launch with sufficient traffic. Until then, IAP is self-hosted only.

**Guest users**: Cannot purchase. Must be logged in to CrazyGames account.

### 6.3 Self-Hosted + Stripe (Fallback)

For our own website (not CrazyGames):
1. Player clicks "Buy 450 Gems"
2. Redirect to Stripe Checkout (or embedded Paddle overlay)
3. Player pays (Stripe: 2.9% + $0.30, Paddle: 5% + $0.50 as MoR)
4. Stripe webhook → our backend credits gems
5. Game refreshes

**Paddle advantage**: Acts as Merchant of Record (handles VAT/tax globally).
Stripe is cheaper but you handle tax compliance yourself.

**Recommendation**: Start with **Paddle** (handles tax, less ops overhead).
Switch to Stripe when volume justifies the tax compliance work.

### 6.4 Cloud Save Requirement (Critical for IAP)

> "If you sell IAPs but store player inventory in the browser's LocalStorage,
> you are making a fatal mistake. If a player clears their cache, they will
> lose their purchases, complain, and file a bank chargeback."
> — Playgama, 2026

**Before launching any IAP**, we must have cloud save:
- On CrazyGames: Use Data module (`SDK.data` — localStorage API, 1MB limit)
- Self-hosted: Need a backend (Supabase/Firebase) for user accounts + inventory

**This is why cloud save is Phase 2, not Phase 1.** No IAP without cloud save.

---

## 7. Ad-Free / Premium Subscription (Phase 3)

### 7.1 Model

A one-time purchase (not recurring subscription — simpler, fewer chargebacks):

| Tier | Price | Benefits |
|------|-------|----------|
| Ad-Free | $2.99 | Removes all ads (rewarded + midgame). Rewarded rewards still granted (free). |
| Supporter | $9.99 | Ad-Free + exclusive "Supporter" skin + 500 gems + season banner |

**Implementation**: Already have `adFree` toggle in settings. Just need to
gate it behind a purchase check instead of a free toggle.

```js
// In AdSDK
get adFree() {
  // Free toggle (current) OR purchased ad-free
  return G.save?.settings?.adFree === true || G.save?.purchases?.adFree === true;
}
```

**Rewarded ads in ad-free mode**: Still grant rewards without showing ads.
This is the standard behavior (player paid to skip the ad, not to skip the
reward). Already implemented in our `AdSDK.showRewarded()`.

### 7.2 Why One-Time, Not Subscription?

- Web games rarely succeed with subscriptions (unlike mobile MMOs)
- One-time purchase has higher conversion (no commitment anxiety)
- Simpler to implement (no recurring billing, no churn tracking)
- Chargebacks are lower (one transaction vs. ongoing)

---

## 8. Implementation Phases

### Phase 1: Ad Revenue (NOW — 1-2 weeks)
**Goal**: Get real ad revenue flowing via CrazyGames

1. ✅ AdSDK facade with 3 providers (done)
2. ✅ Rewarded ads in forge (done)
3. ✅ Interstitial ads every 3 matches (done)
4. ⬜ Integrate CrazyGames SDK (see PLAN-CRAZYGAMES.md)
5. ⬜ Add "Double Coins" rewarded placement after match win
6. ⬜ Submit to CrazyGames for Basic Launch
7. ⬜ Pass QA, move to Full Launch

**Expected revenue**: $15-50/month at 10K plays (conservative)

### Phase 2: Cloud Save + Premium Currency (1-2 months)
**Goal**: Enable IAP infrastructure

1. ⬜ Integrate CrazyGames Data module (cloud save)
2. ⬜ Add `gems` to save schema
3. ⬜ Build cosmetic shop UI (browse skins, preview, buy)
4. ⬜ Implement unit skin system (palette swaps first — cheapest)
5. ⬜ Implement emote pack system
6. ⬜ Apply for CrazyGames IAP (Xsolla) invite
7. ⬜ Set up Paddle for self-hosted IAP fallback
8. ⬜ Backend for purchase verification (Supabase)

**Expected revenue**: $50-200/month (ads + early IAP)

### Phase 3: Battle Pass + More Cosmetics (2-3 months)
**Goal**: Recurring revenue + retention loop

1. ⬜ Build battle pass system (season, XP, levels, reward track)
2. ⬜ Design Season 1 reward track (30 levels)
3. ⬜ Add arena skins (cosmetic backgrounds)
4. ⬜ Add finisher effects
5. ⬜ Add projectile trail skins
6. ⬜ Add ad-free purchase ($2.99)
7. ⬜ Add Supporter pack ($9.99)
8. ⬜ Seasonal events (limited-time skins)

**Expected revenue**: $200-1000/month (ads + IAP + battle pass)

### Phase 4: Scale + Optimize (3-6 months)
**Goal**: Maximize LTV with ML-driven segmentation

1. ⬜ A/B test ad frequency (find retention/revenue sweet spot)
2. ⬜ ML segmentation: show fewer ads to payers, more to non-payers
3. ⬜ Gacha/loot system (Treasure Realms-style, with pity system)
4. ⬜ Add AppLixir as second ad provider (when 5K DAU)
5. ⬜ Publish to additional portals (Poki, GameDistribution) via Playgama Bridge
6. ⬜ Web Monetization API (Interledger) for ad-free streaming payments
7. ⬜ Merchandise (if brand recognition grows)

**Expected revenue**: $1000-5000/month (scaled)

---

## 9. Revenue Projections

### 9.1 By Phase (Conservative)

| Phase | Monthly Plays | Ad Revenue | IAP Revenue | Total | Our Share |
|-------|--------------|------------|-------------|-------|-----------|
| Phase 1 (ads only) | 10,000 | $30-50 | $0 | $30-50 | $15-25 |
| Phase 1 (ads only) | 100,000 | $300-500 | $0 | $300-500 | $150-250 |
| Phase 2 (+ IAP) | 100,000 | $300-500 | $50-150 | $350-650 | $175-325 |
| Phase 3 (+ pass) | 500,000 | $1,500-2,500 | $500-1,500 | $2,000-4,000 | $1,000-2,000 |
| Phase 4 (scaled) | 2,000,000 | $6,000-10,000 | $3,000-8,000 | $9,000-18,000 | $4,500-9,000 |

### 9.2 Key Metrics to Track

| Metric | Target | Tool |
|--------|--------|------|
| ARPDAU | $0.08-0.15 (casual) | CrazyGames analytics |
| eCPM (rewarded) | $15-28 (US) | CrazyGames dashboard |
| eCPM (midgame) | $8-15 (US) | CrazyGames dashboard |
| Opt-in rate (rewarded) | 50-65% | Custom analytics |
| Fill rate | >90% | CrazyGames dashboard |
| IAP conversion | 2-5% | Xsolla/Stripe dashboard |
| Battle pass conversion | 3-5% of active | Custom analytics |
| D1 retention | >40% | CrazyGames analytics |
| D7 retention | >20% | CrazyGames analytics |
| Avg session length | >5 min | CrazyGames analytics |

---

## 10. Competitive Analysis

### 10.1 Autobattler Monetization Models

| Game | Model | Key Cosmetics | Battle Pass | Gacha |
|------|-------|--------------|-------------|-------|
| **TFT** | Cosmetic IAP + pass | Little Legends, Arenas, Booms | Yes (10-week seasons) | Treasure Realms |
| **Marvel Snap** | Cosmetic IAP + pass | Card variants, avatars, titles | Yes (monthly) | Spotlight caches |
| **Hearthstone BG** | Cosmetic IAP | Hero skins, boards | No (uses HS pass) | No |
| **Dota Underlords** | Cosmetic pass | Boards, win effects, banners | Proto Pass (free) | No |
| **Super Auto Pets** | Cosmetic IAP + ad-free | Pet skins | No | No |

**Our model**: Closest to **Super Auto Pets** (web-based, cosmetic-only, ad-supported)
with elements of **TFT** (battle pass, seasonal skins).

### 10.2 Why Not Copy TFT Exactly?

TFT has Riot's resources (3D art, LiveOps team, gacha infrastructure). We're a
solo/small-team web game. Key differences:
- **2D procedural art** (not 3D models) — cheaper, faster to produce
- **No gacha initially** — direct purchase is simpler and less controversial
- **Web-first** — no app store fees (30% savings vs. mobile TFT)
- **Smaller catalog** — start with 15 skins, expand over time

---

## 11. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Ad revenue too low | Can't sustain development | Medium | Multi-platform (CrazyGames + Poki + self-hosted) |
| IAP conversion < 2% | IAP not worth building | Medium | Focus on ads first; IAP is Phase 2+ |
| Cloud save data loss | Chargebacks, bad reviews | Low | Use CrazyGames Data module (battle-tested) |
| Pay-to-win accusations | Community backlash | Low | Cosmetic-only policy, clearly communicated |
| CrazyGames QA rejection | Delayed launch | Medium | Follow compliance checklist in PLAN-CRAZYGAMES.md |
| Battle pass fatigue | Players leave | Medium | 10-week seasons with breaks; free track is generous |
| Gacha regulation | Legal issues in some countries | Low (Phase 4) | Direct purchase only initially; gacha is optional later |
| Ad blocker usage | No ad revenue from those users | High | Game remains playable; ad-free purchase as alternative |
| Payment provider issues | Can't process payments | Low | Multiple providers (Xsolla + Paddle + Stripe) |

---

## 12. Legal & Compliance

### 12.1 Disclosures Required

- **Privacy Policy**: Required for IAP (collecting payment data)
- **Terms of Service**: Required for IAP (refund policy, virtual currency terms)
- **Age rating**: PEGI 12 (CrazyGames requirement) — no gambling mechanics
- **Loot box disclosure**: If we add gacha (Phase 4), disclose odds (required in
  EU, China, UK). Direct purchase (Phase 2-3) has no such requirement.

### 12.2 Refund Policy

- **Ads**: No refunds (already watched)
- **Cosmetics**: Refund within 14 days if unused (EU consumer law)
- **Battle pass**: Pro-rated refund for unused levels
- **Gems**: No refund once spent on cosmetics; refund unused gems within 14 days

### 12.3 Tax

- **Paddle**: Handles VAT/sales tax globally (Merchant of Record)
- **Stripe**: You handle tax (or use Stripe Tax add-on)
- **Xsolla**: Handles tax as MoR
- **CrazyGames ad revenue**: Paid as contractor income (you handle tax)

---

## 13. Files to Create/Modify

### Phase 1 (Ads)
| File | Changes | Status |
|------|---------|--------|
| `index.html` | Add CrazyGames SDK script tag | ⬜ |
| `src/utils.js` | Add CrazyGamesAdProvider, update reward logic | ⬜ |
| `src/ui.js` | Add double-coins rewarded placement, gameplay tracking | ⬜ |
| `src/game.js` | Add loading events, muteAudio compliance | ⬜ |

### Phase 2 (Cloud Save + IAP)
| File | Changes | Status |
|------|---------|--------|
| `src/save.js` | Add `gems`, `skins`, `emotePacks`, `purchases` to schema | ⬜ |
| `src/utils.js` | Add `Storage` abstraction (CrazyGames Data vs localStorage) | ⬜ |
| `src/ui.js` | Build shop screen, gem balance HUD, skin selection | ⬜ |
| `src/battle.js` | Add skin rendering system (palette overrides + draw fns) | ⬜ |
| `src/shop.js` | **NEW** — Shop UI component (browse, preview, buy) | ⬜ |
| `src/iap.js` | **NEW** — IAP facade (Xsolla + Paddle providers) | ⬜ |

### Phase 3 (Battle Pass)
| File | Changes | Status |
|------|---------|--------|
| `src/save.js` | Add `battlePass` to schema | ⬜ |
| `src/ui.js` | Add battle pass screen, XP bar, reward track | ⬜ |
| `src/battlepass.js` | **NEW** — Battle pass logic (seasons, XP, rewards) | ⬜ |
| `src/battle.js` | Add finisher effects, trail skins, arena skins | ⬜ |

---

## 14. Success Metrics

### Phase 1 Success (Month 1-2)
- [ ] Game live on CrazyGames (Full Launch)
- [ ] ARPDAU > $0.05
- [ ] D1 retention > 35%
- [ ] Rewarded ad opt-in rate > 40%
- [ ] No QA violations

### Phase 2 Success (Month 3-4)
- [ ] Cloud save working (cross-device)
- [ ] Shop live with 15+ cosmetics
- [ ] IAP conversion > 1%
- [ ] ARPPU > $5
- [ ] No chargebacks from data loss

### Phase 3 Success (Month 5-6)
- [ ] Battle pass Season 1 launched
- [ ] Pass conversion > 3% of active players
- [ ] D7 retention > 25%
- [ ] Monthly revenue > $500
- [ ] Community requesting more skins (demand signal)

---

## References

- [CrazyGames SDK Documentation](https://docs.crazygames.com/sdk/intro/)
- [CrazyGames Ad Requirements](https://docs.crazygames.com/requirements/ads/)
- [CrazyGames Technical Requirements](https://docs.crazygames.com/requirements/technical/)
- [CrazyGames In-Game Purchases (Xsolla)](https://docs.crazygames.com/sdk/in-game-purchases/)
- [Playgama: 10 Ways to Monetize HTML5 Games (2026)](https://playgama.com/blog/main/10-ways-to-monetize-html5-games-that-actually-work-in-2026/)
- [Genieee: Future of HTML5 Game Monetization 2025](https://genieee.com/the-future-ofhtml5-game-monetization-in-2025-and-beyond-the-hybrid-revolution/)
- [TFT Rotating Shop & Treasure Realms](https://www.leagueoflegends.com/en-us/news/game-updates/tft-s-rotating-shop-coming-soon/)
- [TFT Cosmetics Tiering Simplification](https://teamfighttactics.leagueoflegends.com/en-au/news/game-updates/simplifying-cosmetics-tiering/)
- [Dota Underlords Proto Pass](https://www.pcgamer.com/dota-underlords-adds-free-prototype-battle-pass-with-cosmetics/)
- [Paddle: Sell Outside App Store](https://www.paddle.com/solutions/web-stores)
- [Xsolla Web Shop](https://xsolla.com/mobile-web-shop)
- [Web Monetization API (Interledger)](https://interledger.org/news/announcing-interledger-foundations-web-monetization-extension-beta-release)
- [Unity Battle Pass Documentation](https://docs.unity.com/en-us/services/solutions/battle-passes)
- [IPFLY: HTML5 Games Monetization Guide 2026](https://www.ipfly.net/blog/html5-games-monetization-guide-2026/)
