# Prompt Showdown v4

An AI-forged auto-battler with P2P multiplayer, progression, and a procedural unit forge. Single self-contained `index.html` — no build step, no dependencies to install.

## Play locally

Just open `index.html` in a modern browser. For full functionality (ES module imports + P2P torrent signalling) serve it over HTTP:

```bash
python3 -m http.server 8765
# then visit http://localhost:8765/index.html
```

## Features

- **Draft system** — rarity-weighted unit pool (common / rare / legendary), rerolls, no duplicates
- **Auto-battle** — projectiles, crits, status effects (poison / slow / stun), abilities (splash / heal / dodge / poison), collision separation
- **AI Forge** — generates new units via WebLLM (Llama-3.2-1B) when WebGPU is available; falls back to procedural generation otherwise. Includes validation + caching.
- **Progression** — XP, player levels, coins, unit upgrades (+10% HP/DMG per level), fusion (combine 2 duplicates → +1 level), achievements
- **P2P multiplayer** — host-authoritative sync at 20Hz via Trystero (WebTorrent signalling, no server needed)
- **Mobile-friendly** — adaptive FPS (60 desktop / 30 mobile), tap-to-tick, vibration feedback, fullscreen, pause-on-hidden
- **Resilient** — visible error panel, save backup + crash recovery, version migrations, PWA manifest

## Deploy to Render.com

This repo includes a `render.yaml` blueprint so Render auto-creates the service on connect.

### Option A — Blueprint (recommended, fastest)

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to **https://dashboard.render.com** → **New** → **Blueprint**.
3. Select this repository. Render reads `render.yaml` and creates a **Static Site** named `prompt-showdown` automatically.
4. Click **Apply**. Render deploys `index.html` from the repo root.
5. Wait ~30s for the build to finish, then open the assigned `https://prompt-showdown-xxxx.onrender.com` URL.

### Option B — Manual static site

If you'd rather configure by hand:

1. **https://dashboard.render.com** → **New** → **Static Site**.
2. Connect your GitHub account and select this repo.
3. Fill in:
   - **Name**: `prompt-showdown`
   - **Build Command**: *(leave empty, or `echo "no build needed"`)*
   - **Publish Directory**: `.` (the repo root — that's where `index.html` lives)
   - **Plan**: Free
4. Click **Create Static Site**. Done.

### After deploy

- **Custom domain**: Static Site → Settings → Custom Domains → add your domain. Render provides the CNAME to point at.
- **Auto-deploy**: On by default — every `git push` to `main` triggers a redeploy.
- **Cache headers**: Already set in `render.yaml` (`index.html` = no-cache, other HTML = 5min).
- **Headers/CORS**: The game loads `web-llm` and `@trystero-p2p/torrent` from CDNs at runtime. No server-side CORS config is needed — those CDNs send permissive CORS headers.

### Notes

- **WebGPU / AI Forge**: The LLM-backed forge only activates in browsers with WebGPU (Chrome/Edge desktop). On unsupported browsers (Safari, Firefox, mobile) the game automatically uses the procedural forge — no action needed.
- **P2P multiplayer**: Uses WebTorrent trackers via Trystero. Works from any HTTPS origin (Render serves HTTPS by default). Open the same room ID in two browser tabs/devices.
- **Free tier**: Render free static sites sleep after inactivity and wake on first request (~15s cold start). For always-on, upgrade to a paid plan.

## Project structure

```
index.html      # the entire game (HTML + CSS + JS in one file)
render.yaml     # Render blueprint
README.md       # this file
```

## Tech

- Vanilla JS (ES modules, no framework, no bundler)
- [web-llm](https://github.com/mlc-ai/web-llm) for in-browser LLM unit generation
- [@trystero-p2p/torrent](https://github.com/dmotz/trystero) for serverless P2P
- Canvas 2D for rendering
- `localStorage` for saves (with backup + migration)
