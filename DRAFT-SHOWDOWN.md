# DRAFT-SHOWDOWN.md — Inspiration Research & Our Twist

## What is Draft Showdown?

Draft Showdown (by Quest Lab / Voodoo) is a mobile hybrid-casual auto-battler centered on
rapid-fire card drafting and real-time auto-combat. It's the primary inspiration for
Prompt Showdown — same core loop, but our twist is **LLM-forged custom units**.

## Core Game Loop

1. **Draft**: Each round, both players get 3 draws (4 if losing — comeback mechanic).
   Each draw offers 3 unit cards to pick from. Pick one, it joins your loadout.
2. **Scout**: See what your opponent drafted (tap their portrait to reveal units + spells).
3. **Battle**: Units fight automatically in real-time. No player control during combat.
4. **Result**: Loser loses a life. First to lose all lives = eliminated.
5. **Repeat**: Next round, draft again. Survivors carry over. Comeback bonus if losing.

## Key Mechanics

### Draft System
- **3 draws per round** (4 if losing the previous round — comeback mechanic)
- **3 cards per draw** — pick one, reroll for new options
- **4-card loadout** — your army is 4 unit types
- **Rarity tiers**: Common, Rare, Epic, Legendary
- **Unit upgrades**: Level up units by picking duplicates (2 copies → level 2, etc.)
- **Spells**: Also draftable alongside units (separate spell pool with energy costs)

### Match Structure
- **Lives system**: Both players start with N lives (arena-dependent). Lose a life per round loss.
- **Round-based**: Draft → Scout → Battle → Result, repeat until someone hits 0 lives.
- **Draw condition**: Both lose a life on a draw.
- **Short matches**: "Minutes, not hours" — hybrid-casual session length.

### Combat
- **Auto-battler**: Units spawn and fight automatically. No mid-battle unit control.
- **Real-time**: Units move, attack, use abilities in real-time on a 2D battlefield.
- **Roles matter**: Frontline tanks protect backline damage dealers. Balance is key.
- **Positioning**: Units spawn in role-based formation (frontline in front, carry in back).
- **Counterplay**: Assassin dives snipers, frontline blocks assassins, snipers pick off carries.

### Spells
- **Energy/elixir system**: Spells cost energy. Energy accumulates during battle.
- **Manual casting**: Player taps spell buttons during battle to cast at strategic moments.
- **Spell variety**: Acid Burst, Arrow Storm, Meteor Shower, Grave Return, Minefield, etc.
- **Strategic timing**: When to cast matters as much as what to cast.

### Progression
- **Arena ladder**: Bronze → Diamond (5 tiers). Each arena has increasing difficulty.
- **Unit levels**: Upgrade units with coins/duplicates. Higher level = more stats.
- **Collection**: Build a persistent collection of units across matches.
- **Loadout**: Pick 4 units from your collection for each match.

### Units (examples from Draft Showdown)
| Unit | Role | Notes |
|------|------|-------|
| Knight | Frontline tank | Spawns in numbers, absorbs damage |
| Spartheus | Frontline tank | Shield wall, protects backline |
| Merlinor | Backline carry | Strongest carry, scales hard |
| Sniper | Ranged DPS | Long-range, counters backline |
| Assassin | Diver | Dives weak backlines, counters snipers |
| Engineer | Summoner | Spawns machines that block/distract |
| Goose | Early tempo | Quick pressure, falls off late |
| TNT | Explosive | AoE damage, aggressive openings |
| Snail | Artillery | Slow but devastating if protected |
| Shellbro | Roller | Rolls through grouped enemies |
| Overmind | Late-game carry | Overwhelming scaling if protected |
| Matriarch | Summoner | Spawns additional units |

### What Makes It Fun
- **Fast drafts**: 3 picks per round, quick decisions, no analysis paralysis
- **Comeback mechanic**: 4th draw when losing keeps matches tense
- **Scout phase**: Knowing opponent's army lets you counter-draft
- **Role balance**: Frontline + carry + support + counter = winning formula
- **Counter matchups**: Assassin beats Sniper, Sniper beats Snail, frontline beats Assassin
- **Short sessions**: Perfect for mobile, 3-5 minute matches

## Our Twist: LLM-Forged Custom Units

Draft Showdown has a **fixed roster** of ~25 units. Players can't create new units —
they just pick from the existing pool and level them up.

**Prompt Showdown's differentiator**: Players forge custom units from text prompts
via an in-browser LLM (Qwen2.5-1.5B). Type "ice mage" → get a unit with frost abilities,
a staff weapon, and a robed sprite. Type "fire dragon" → get a flying unit with breath
attacks and scales.

This means:
- **Infinite unit variety** — not limited to a fixed roster
- **Player creativity** — forge units that match your strategy
- **Surprising synergies** — LLM produces unexpected but coherent combinations
- **Visual variety** — 28 body plans, 14 weapons, 7 visual modifier categories
- **Template fallback** — when WebGPU unavailable, procedural templates fill in

### What We Keep From Draft Showdown
- ✅ 3 draws per round (4 if losing — comeback)
- ✅ 4-card loadout
- ✅ Scout phase before battle
- ✅ Lives system, round-based matches
- ✅ Auto-battle with no mid-combat unit control
- ✅ Arena ladder (Bronze → Legend)
- ✅ Unit upgrades (level up via duplicates/coins)
- ✅ Manual spell casting with cooldowns (our equivalent of energy system)
- ✅ Role-based formation positioning
- ✅ Bot fallback when no P2P opponent found
- ✅ P2P multiplayer (Draft Showdown is mostly bots; we have real P2P)

### What We Add Beyond Draft Showdown
- **LLM forge** — create custom units from text (the core differentiator)
- **P2P multiplayer** — real WebRTC peer-to-peer, not just bots
- **Procedural sprites** — 28 body plans with skeletal animation, not fixed art
- **Spell forge** — create custom spells too, not just units
- **URL sharing** — share forged units/spells via URL
- **Daily quests + login streaks** — meta progression beyond arena climbing
- **Endless mode** — scaling difficulty beyond the arena ladder

### What We Don't Need (Draft Showdown has, we skip)
- ❌ Fixed unit roster — LLM forge replaces this
- ❌ Energy/elixir spell system — we use cooldown-based spell casting instead
- ❌ Premium currency / hard monetization — we're P2P with no server
- ❌ Cloud save — we use localStorage + IndexedDB (no server needed)

## Design Principles (from Draft Showdown, applied to us)

1. **Draft speed > draft complexity** — 3 picks, quick decisions, no analysis paralysis
2. **Comeback is sacred** — 4th draw when losing keeps every match winnable
3. **Scout enables counterplay** — seeing opponent's army before battle is core
4. **Roles are fundamental** — frontline + carry + support + counter = balanced
5. **Counter matchups create depth** — Assassin↔Sniper↔Snail rock-paper-scissors
6. **Short sessions** — 3-5 minute matches, not 30-minute TFT marathons
7. **Bots are invisible** — player never knows if opponent is human or bot
8. **Unit identity matters** — each unit has a clear role and personality

## References
- [Draft Showdown on Google Play](https://play.google.com/store/apps/details?id=com.QuestLab.DraftWar)
- [Draft Showdown on App Store](https://apps.apple.com/us/app/draft-showdown/id6743368869)
- [Beginner Guide Wiki](https://www.treyexgaming.com/draft-showdown-beginner-guide/)
- [Tier List](https://www.treyexgaming.com/draft-showdown-tier-list/)
- [Unit List (Japanese)](https://gamerch.com/draftshowdown/997724)
- [Spell List (Japanese)](https://gamerch.com/draftshowdown/999213)
