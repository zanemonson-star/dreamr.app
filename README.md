# DREAMR

Next.js app. Same UI and features as the Artifact version — the only
change is that the frontend now calls its own backend (`/api/chat`)
instead of relying on claude.ai's Artifact sandbox to reach the
Anthropic API.

## How it's wired

```
Browser  →  fetch('/api/chat')  →  app/api/chat/route.js (server)  →  Anthropic API
```

- `components/DreamrApp.jsx` — the UI. Unchanged except `callClaude()`
  now calls `/api/chat` (same origin) instead of `api.anthropic.com`
  directly.
- `app/api/chat/route.js` — the only file that touches your Anthropic
  API key. This runs on the server; Next.js never ships route-handler
  code to the browser.

## 1. Local setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste your real key from
# https://console.anthropic.com/settings/keys
npm run dev
```

Open http://localhost:3000.

## 2. Environment variables

Only one, and it's server-side only:

| Variable | Where it's used | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `app/api/chat/route.js` | Never prefix with `NEXT_PUBLIC_` — that prefix ships a variable to the browser, which is exactly what you don't want for a secret key. |

## 3. Deploy to Vercel (recommended — zero config for Next.js)

1. Push this project to a GitHub repo.
2. Go to https://vercel.com → **Add New Project** → import the repo.
3. Vercel auto-detects Next.js; leave build settings as default
   (`npm run build`, output handled automatically).
4. Before deploying, go to **Project Settings → Environment Variables**
   and add:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your real key
   - Environment: Production (and Preview/Development if you want
     those to work too)
5. Deploy. Vercel builds and serves both the UI and the `/api/chat`
   route from the same deployment — no separate backend to stand up.

## 4. Deploy anywhere else that runs Node

This is a standard Next.js app, so any host that runs Node works
(Render, Railway, Fly.io, a plain VPS):

```bash
npm install
npm run build
npm run start   # serves on port 3000 by default
```

Set `ANTHROPIC_API_KEY` in that platform's environment variable
settings (dashboard UI, `fly secrets set`, systemd env file, etc. —
however that host manages server-side secrets). The requirement is
always the same: it must be readable by the Node process, and never
baked into anything served to the browser.

## 5. Changing the model

Edit the `MODEL` constant at the top of `app/api/chat/route.js`. Check
https://docs.claude.com for current model IDs — this file currently
uses `claude-sonnet-5`.

## 6. If a request fails

The error shown in the UI is the *real* upstream error, not a generic
message — `route.js` passes through whatever Anthropic's API actually
returned (auth error, rate limit, invalid request, etc.), and
`callClaude()` surfaces that text in the chat/quiz UI. If something
breaks after deploying, that displayed text tells you exactly what
went wrong (e.g. "Server misconfigured: ANTHROPIC_API_KEY is not set"
means the env var isn't reaching the deployed instance — recheck step
3 or 4).
