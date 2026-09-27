# Deploying PathfolioApp on Vercel

The repository is wired for a single Vercel project:

- **Static frontend**: `frontend/` builds with Vite and is served from `frontend/dist`.
- **API**: `api/index.js` wraps the existing Express app as a serverless function; all `/api/*` requests are routed to it.

## One-time setup

```bash
npm i -g vercel
vercel link
```

## Environment variables (Production + Preview)

Set these in the Vercel dashboard (Project → Settings → Environment Variables) or with `vercel env add`:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL`-style DB config (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) | Yes for real data | Use a managed MySQL (e.g. PlanetScale, Neon MySQL-compatible, Railway). Without it the API runs in volatile in-memory mode (dev only). |
| `USE_DATABASE` | `true` | Forces DB mode outside `NODE_ENV=production`. |
| `CLIENT_ORIGIN` | Yes | Your Vercel URL(s), comma-separated, e.g. `https://pathfolio.vercel.app`. |
| `SESSION_SECRET` | Recommended | See note below. |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_NAME` / `BOOTSTRAP_ADMIN_USERNAME` | Recommended | Creates the first admin on cold start. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Optional | Enables logo/avatar uploads. |

**Serverless session note:** sessions are stored in the database, so cookie auth works on
serverless. Without a database, each cold start gets a fresh in-memory store and users
would be signed out — use a real database for any non-trivial deployment.

## Deploy

```bash
vercel            # preview
vercel --prod     # production
```

The included `vercel.json` sets the install/build commands, output directory, the
`/api/* → api/index` rewrite, SPA fallback for client-side routes, and cache headers.
