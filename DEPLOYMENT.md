# WriteHabit Deployment

Recommended stack:

- Web: Vercel
- API: Render
- Database: Neon Postgres

## 1. Neon Postgres

1. Create a Neon project.
2. Create or use the default production branch.
3. Copy the pooled or direct PostgreSQL connection string.
4. Use it as the backend `DATABASE_URL`.

Recommended format:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require"
```

## Pre-Deploy Check

Before connecting external services, run the local release check:

```bash
npm run predeploy
```

This verifies deployment config files, production env examples, the Node version, frontend build, Prisma client generation, and backend smoke tests.

## 2. Render API

Create a Render web service from this repository.

Settings:

- Root directory: `server`
- Runtime: `Node`
- Build command: `npm install && npm run prisma:generate`
- Start command: `npm start`
- Health check path: `/api/ready`

Environment variables:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://<your-vercel-domain>
```

After the first deploy, run migrations against the production database:

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run prisma:deploy
```

Confirm:

```bash
curl https://<your-render-api-domain>/api/ready
curl https://<your-render-api-domain>/api/keywords/today
```

## 3. Vercel Web

Create a Vercel project from this repository.

Settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Environment variable:

```bash
VITE_API_URL=https://<your-render-api-domain>/api
```

After Vercel gives you a domain, update Render:

```bash
CORS_ORIGIN=https://<your-vercel-domain>
```

## 4. Smoke Test

Backend:

```bash
curl https://<your-render-api-domain>/api/ready
curl https://<your-render-api-domain>/api/keywords/today
```

Browser:

- Signup
- Login
- Nickname availability check
- Today keyword rendering
- Draft save and reload
- Publish a post
- Keyword-filtered feed
- Like, comment, follow
- Notification click-through
- Admin keyword schedule

## Notes

- Do not run `db:seed` against production unless you intentionally want demo accounts.
- Do not use local development credentials in production.
- Change `JWT_SECRET` before every real production launch.
- If frontend requests fail with CORS errors, verify Render `CORS_ORIGIN` exactly matches the Vercel domain, including `https://`.
