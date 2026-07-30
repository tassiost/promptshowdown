# Inspiration References

Two games that are a big inspiration for Prompt Showdown's visual and gameplay direction.

---

## Game Breakers

**Link:** [https://gamebreakers.gg/](https://gamebreakers.gg/)

**Tagline:** "Create anything! Battle anyone! BREAK THE GAME!"

**What it is:** An AI-powered arena battler and a Vibe Jam 2026 entry. Players create units/entities and battle them in an automated arena. The game features:

- **AI Arena** — automated battles where created entities fight each other
- **Create anything** — the core hook is infinite creative potential in what you bring to battle
- **Inventory & loot** — chests, items dropped by bosses, progression meta-layer
- **Boss fights** — defeat bosses to earn items and fill your inventory
- **Daily top players** — competitive leaderboard
- **Performance metrics** — tracks how your creations perform
- **Discord community** — social/competitive layer

**Why it's inspiring for us:**
- Same core loop: **create → battle → progress**
- "Create anything" mirrors our LLM forge goal of infinite visual/unit variety
- The arena auto-battler format is exactly our combat model
- Loot + progression meta on top of the auto-battler is a proven engagement pattern
- Shows that an AI-generated-content arena game can work as a compelling product

**What we can learn:**
- The "create anything" promise is the marketing hook — our forge should deliver on this visually
- Boss fights + loot give players a reason to keep coming back beyond just battles
- Leaderboards add competitive stakes
- A polished, game-feel-heavy presentation makes auto-battles exciting to watch

---

## Super Voxel Heroes

**Link:** [https://supervoxelheroes.com/](https://supervoxelheroes.com/)

**What it is:** A 3D voxel hero creator built with Three.js. Players build custom voxel characters in a browser-based editor. The site loads a full Three.js 3D scene with a character builder interface.

**Key characteristics:**
- **Voxel aesthetic** — clean, blocky 3D characters that are visually distinct and readable
- **Browser-based 3D** — runs entirely in-browser using Three.js + WebGL
- **Character creator** — the focus is on the creation tool itself as the experience
- **Real-time 3D rendering** — characters are rendered in 3D with lighting, not flat sprites

**Why it's inspiring for us:**
- **Visual clarity** — voxel characters are instantly readable despite being simple shapes. This is the same problem we face: making LLM-generated shapes look good and readable
- **Constrained creativity** — voxel art proves you can have infinite variety within a strict visual framework. Our shape-based system is the 2D equivalent
- **The creator is the game** — the act of making something is itself engaging. Our forge should feel this good
- **Lighting makes cheap art look expensive** — even simple voxel blocks look great with proper lighting, shadows, and outlines. This validates our visual enhancement approach (outlines, gradients, shadows)

**What we can learn:**
- A strong, consistent visual treatment (outlines, lighting, shadows) elevates simple geometry
- The creation experience itself should be fun and tactile, not just a form to fill
- 3D lighting effects (rim light, ambient occlusion, drop shadows) make flat/simple shapes pop — we can fake these in 2D canvas
- Voxel characters have clear silhouettes — our sprites need the same silhouette readability

---

## Takeaways for Prompt Showdown

| Theme | Game Breakers | Super Voxel Heroes | Our application |
|-------|--------------|-------------------|-----------------|
| **Create anything** | Core hook | Core experience | LLM forge promise |
| **Visual polish** | Arena presentation | Voxel + lighting | Outlines, gradients, shadows |
| **Readability** | Clear unit silhouettes | Voxel clarity | Black outlines + silhouettes |
| **Progression** | Loot, bosses, leaderboard | Creator satisfaction | XP, coins, arenas, fusion |
| **Auto-battle feel** | AI arena battles | N/A | Canvas 2D auto-battler |
| **Browser-first** | Web game | Three.js web app | Single HTML file |

Both games prove that **constrained systems with strong visual treatment** can deliver infinite creative variety without needing AAA assets. Our LLM forge + shape-based renderer is the same philosophy — we just need to nail the visual treatment to make anything the LLM produces look polished.
