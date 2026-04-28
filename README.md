# WriteHabit

React + Vite frontend and Express + Prisma backend for WriteHabit.

## Local Services

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4000/api`
- PostgreSQL: local `writehabit` database

## Environment

Frontend env:

```bash
cp .env.example .env
```

Backend env:

```bash
cd server
cp .env.example .env
```

Current local backend `DATABASE_URL` format:

```bash
DATABASE_URL="postgresql://USER@localhost:5432/writehabit?schema=public"
```

## First-Time Setup

Install dependencies:

```bash
npm install
cd server
npm install
```

Apply database migrations and seed local data:

```bash
npm run db:deploy
npm run db:seed
```

Seed accounts:

- Admin: `admin@writehabit.local` / `writehabit123`
- Demo user: `demo@writehabit.local` / `writehabit123`

## Development

Start the API:

```bash
npm run dev:api
```

Start the frontend in another terminal:

```bash
npm run dev:web
```

Useful checks:

```bash
curl http://127.0.0.1:4000/api/ready
curl http://127.0.0.1:4000/api/keywords/today
npm run build
```

## Deployment Notes

Recommended split:

- Frontend: Vercel or Netlify
- Backend API: Render, Railway, or Fly.io
- Database: Neon, Supabase, Railway Postgres, or managed PostgreSQL

This repo includes deployment presets for the recommended stack:

- [vercel.json](/Users/leia/claude/writehabit/vercel.json)
- [render.yaml](/Users/leia/claude/writehabit/render.yaml)
- [DEPLOYMENT.md](/Users/leia/claude/writehabit/DEPLOYMENT.md)

Set these values per environment.

Frontend:

```bash
VITE_API_URL="https://api.writehabit.example.com/api"
```

Backend:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/writehabit?sslmode=require"
JWT_SECRET="replace-with-a-long-random-production-secret"
CORS_ORIGIN="https://writehabit.example.com"
PORT=4000
JWT_EXPIRES_IN="7d"
```

Do not use local development values in production:

- `127.0.0.1`
- `localhost`
- `dev-writehabit-secret-change-before-deploy`
- seed passwords such as `writehabit123`

Run checked-in migrations before starting the backend:

```bash
npm run db:deploy
```

## Suggested Deployment Order

1. Create the production PostgreSQL database.
2. Configure backend environment variables.
3. Deploy the backend.
4. Run migrations against the production database.
5. Confirm `GET /api/ready` returns `database: ok`.
6. Configure frontend `VITE_API_URL` to the backend API URL.
7. Deploy the frontend.
8. Set backend `CORS_ORIGIN` to the frontend domain.
9. Smoke test signup, login, writing, keyword pages, comments, likes, follows, and notifications.

## Production Smoke Test

After deployment, verify:

```bash
curl https://api.writehabit.example.com/api/ready
curl https://api.writehabit.example.com/api/keywords/today
```

Then test in the browser:

- Signup and login
- Nickname availability check
- Today keyword rendering
- Draft save and reload
- Publish a post
- Keyword-filtered feed
- Like, comment, follow
- Notification click-through
- Admin keyword schedule
