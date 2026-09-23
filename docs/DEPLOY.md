# Deploy — Gavi411 (G411-16)

Baseline deploy setup: Vercel (client) + Render (server) + Neon (DB,
already live). This is initial config only — no staging environments, no
custom preview-deploy rules. Nothing here has actually been deployed;
none of it can be, without account access this environment doesn't have.
Everything below marked "unverified" needs Gavi to click through it.

## What's committed vs. what's manual

| Piece | Status |
|---|---|
| `render.yaml` (server build/start/env) | Committed, config only |
| Vercel client build | No config file needed — see below |
| Neon DB | Already live, already in use — nothing to do here |
| Connecting GitHub repo to Vercel | **Manual, unverified** — needs Gavi |
| Connecting GitHub repo to Render | **Manual, unverified** — needs Gavi |
| Entering real secret values in each dashboard | **Manual, unverified** — needs Gavi |

## Server → Render

`render.yaml` at repo root is a Blueprint: Render reads it once the repo
is connected and provisions a `gavi411-server` web service from it.

- Build: `npm install && npx prisma generate`
- Start: `npm start` (`node server/server.js`, per root `package.json`)
- Health check: `GET /api/health` → `{"status":"ok"}` (route already
  exists in `server/server.js`)
- Node version pinned to `22.23.1` to match what this was verified on.

**Verified locally, this session:** ran the exact build+start sequence
(`npm install`, `npx prisma generate`, `node server/server.js`) and
confirmed `curl localhost:3000/api/health` returns `{"status":"ok"}`.
That's the real command chain Render will run — not a guess.

**What Gavi needs to do:**
1. Render dashboard → New → Blueprint → connect the `Gavi411` GitHub repo.
   Render finds `render.yaml` automatically.
2. It will prompt for the three secret env vars marked `sync: false`
   (`DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) — paste
   in the same real values already in the local `.env` (see
   `.env.example` for the full list/shape). `PORT` also shows as a
   manual-entry var but should be left blank — Render injects its own
   `PORT` at runtime and `server.js` already reads `process.env.PORT`.
3. Free tier cold-starts after inactivity — expected per the PRD, pre-warm
   (hit `/api/health` once) before any live demo.
4. First deploy is what actually proves this end-to-end — cannot be done
   from here.

## Client → Vercel

No `vercel.json` committed. Vercel's zero-config Vite detection already
covers this app once one setting is made in the dashboard — adding a
config file to restate what Vercel already infers (build command, output
dir, install command) would just be duplicated config to keep in sync.

**What Gavi needs to do:**
1. Vercel dashboard → New Project → import the `Gavi411` GitHub repo.
2. **Root Directory: set it to `client`** — this is the one setting that
   isn't inferable from a committed file, since the app lives in a
   subdirectory, not repo root. Everything else (framework = Vite, build
   = `npm run build`, output = `dist`, install = `npm install`) auto-fills
   correctly once that's set — confirmed locally this session that
   `npm run build` inside `client/` succeeds and produces `dist/`.
3. Env vars: none required yet for the client build itself. Once Clerk's
   client-side publishable key needs to reach the browser bundle (G411-13
   already wires `@clerk/react` server-side; the Vite env var is a
   separate step), it goes in Vercel's dashboard as `VITE_CLERK_PUBLISHABLE_KEY`
   — Vite only exposes `VITE_`-prefixed vars to client code. Not set up
   yet; flagging so it's not forgotten.
4. First deploy is what actually proves this end-to-end — cannot be done
   from here.

## DB → Neon

Already provisioned and live — real `DATABASE_URL` already in `.env`,
already migrated this session (G411-10). Nothing new to set up; Render
just needs that same connection string as its `DATABASE_URL` env var
(step 2 above).

## Verification ceiling — be honest about this

**Verified this session (evidence-backed):**
- `render.yaml` is valid YAML, matches Render's Blueprint schema shape.
- The exact build/start command chain in `render.yaml` runs successfully
  locally: `npm install && npx prisma generate` then `npm start` →
  `/api/health` returns `{"status":"ok"}`.
- `npm run build` in `client/` succeeds and produces `dist/`.
- The three required secret env vars (`DATABASE_URL`, `CLERK_SECRET_KEY`,
  `CLERK_PUBLISHABLE_KEY`) match `.env.example` exactly.

**Not verified, cannot be from this environment:**
- No real Vercel or Render project exists. Nothing has actually deployed.
- No live URL exists for either service yet.
- The dashboard click-through steps above (repo connect, env var entry,
  Root Directory setting) are unverified until Gavi does them.

This task's evidence bar tops out at "config is correct and the commands
it references work locally" — full end-to-end verification (a real
deployed, reachable URL) needs Gavi's account access and can't be claimed
here.
