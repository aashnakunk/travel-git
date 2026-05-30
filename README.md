# TravelGit ✈️

**Your itinerary, version-controlled.**

Plan a trip like a Git repo: the itinerary is the `main` branch, collaborators
propose changes through **merge requests**, you review the diff and merge what
you love, and every change becomes a commit you can revert to.

- 🧠 **AI planning** — generate a day-by-day itinerary from a destination, a
  vibe questionnaire, or a free-text prompt (OpenAI + Tavily web search + live
  weather).
- 🔀 **Merge-request workflow** — every change (manual line edits, AI edits,
  trip-style reworks, bookings you add) opens an MR with a visual diff.
- 🧭 **AI travel desk** — suggests flights & hotels with links to book yourself,
  then a "Booked" box lets you paste what you booked and the AI works it into
  the plan.
- 🎛️ **Trip-style controls** — pace / budget / adventure dials that re-plan the
  itinerary with AI.
- 📅 **Export** — download the plan as `.ics` (drops into any calendar) or text.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend | Express (agent API for OpenAI + Tavily + Open-Meteo) |
| Database | Supabase (Postgres) |
| Icons | lucide-react |

## Local development

```bash
npm install
cp .env.example .env          # backend keys (OpenAI, Tavily)
cp .env.example .env.local    # frontend keys (VITE_SUPABASE_*)
# fill in real values in both files

npm run dev:all               # Vite (5173) + agent API (8787) together
```

Open http://localhost:5173. In dev, Vite serves the app and proxies `/api/*`
to the Express server on `8787`.

Run the database migrations in `supabase/migrations/` against your Supabase
project (SQL editor or CLI).

## Environment variables

See `.env.example`. Backend (secret): `OPENAI_API_KEY`, `TAVILY_API_KEY`,
optional `OPENAI_MODEL`, `PORT`. Frontend (baked in at build time):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

> The Supabase anon key is safe to expose; data access is governed by
> Row-Level Security. **Never commit `.env` / `.env.local`** — they're
> git-ignored.

## Production build (single service)

```bash
npm run build   # type-checks, builds the SPA into dist/
npm start       # Express serves dist/ AND the /api routes on one port
```

In production the Express server serves the built frontend, so the whole app
runs as **one service** and the frontend's relative `/api` calls just work.

## Deploy to Railway

1. Push this repo to GitHub.
2. New Railway project → **Deploy from GitHub repo**.
3. Set service variables: `OPENAI_API_KEY`, `TAVILY_API_KEY`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally
   `OPENAI_MODEL`). Railway injects `PORT` automatically.
4. Build command: `npm run build` · Start command: `npm start`
   (Nixpacks auto-detects these from `package.json`).

Because the `VITE_*` vars are inlined at build time, make sure they're set
**before** the build runs.

## Security note (hackathon / POC)

Identity is app-managed (simple email login, no password) and Supabase RLS is
currently permissive for the `anon` role — fine for a demo, **not** production
security. The production path is Supabase Auth + `auth.uid()`-based RLS. See
`supabase/migrations/0001_init.sql` for details.
