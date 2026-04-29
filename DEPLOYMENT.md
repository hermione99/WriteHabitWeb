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
FRONTEND_ORIGIN=https://<your-vercel-domain>
RESEND_API_KEY=<resend api key>
PASSWORD_RESET_FROM=WriteHabit <noreply@your-domain>
```

After the first deploy, run migrations against the production database:

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run prisma:deploy
```

Seed the production keyword schedule without demo users or posts:

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run seed:keywords
```

Confirm:

```bash
curl https://<your-render-api-domain>/api/ready
curl https://<your-render-api-domain>/api/keywords/today
```

## 3. Production Backup

Before inviting beta testers, confirm backup and restore options in the Neon console:

- Open the Neon project.
- Confirm whether point-in-time restore or branch restore is available on the current plan.
- Prefer the direct database connection string for manual backups. Pooled URLs work for the app, but direct URLs are safer for maintenance jobs.

Create a manual database backup before major deploys, migrations, or beta tester invites:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run backup:db
```

The command writes a timestamped custom-format dump to `backups/`. The folder is intentionally gitignored because dumps may contain user data.

Neon currently runs PostgreSQL 17. If a local backup fails with a server version mismatch, install PostgreSQL 17 client tools and use that `pg_dump`:

```bash
brew install postgresql@17
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run backup:db
```

The backup script automatically prefers `/opt/homebrew/opt/postgresql@17/bin/pg_dump` on Apple Silicon Macs. You can also pass a custom binary:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/writehabit?sslmode=require" npm run backup:db -- --pg-dump /path/to/pg_dump
```

Restore drill, only against a temporary database or Neon branch:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" backups/writehabit-YYYY-MM-DDTHH-MM-SS.dump
```

Do not run restore commands against production unless you have intentionally decided to roll back data.

Current upload storage note:

- Profile image uploads are stored on the Render service filesystem under `server/uploads`.
- Render local filesystem is not a durable user-file storage strategy.
- Before a wider beta, move uploads to external storage such as Cloudinary, S3, or Vercel Blob.

## 4. Vercel Web

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

## 5. Smoke Test

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
