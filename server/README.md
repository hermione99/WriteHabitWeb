# WriteHabit API

Express + Prisma backend for WriteHabit.

## Local setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

The default API URL is `http://127.0.0.1:4000`.

## Production setup

Required environment variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/writehabit?sslmode=require"
JWT_SECRET="replace-with-a-long-random-production-secret"
CORS_ORIGIN="https://writehabit.example.com"
PORT=4000
JWT_EXPIRES_IN="7d"
```

Production startup:

```bash
npm install
npm run prisma:deploy
npm run prisma:generate
npm start
```

In `NODE_ENV=production`, the API refuses to start without `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`.

If Docker is available, start PostgreSQL first:

```bash
npm run db:up
npm run prisma:deploy
```

Seed local development data:

```bash
npm run db:seed
```

Seed accounts:

- Admin: `admin@writehabit.local` / `writehabit123`
- Demo user: `demo@writehabit.local` / `writehabit123`

## Health checks

- `GET /api/health` checks that the API process is running.
- `GET /api/ready` checks that the API can reach PostgreSQL.

## Auth API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `GET /api/auth/handles/:handle`

## Posts API

- `GET /api/posts`
- `GET /api/posts/:id`
- `POST /api/posts` with `Authorization: Bearer <token>`
- `PATCH /api/posts/:id` with `Authorization: Bearer <token>`
- `DELETE /api/posts/:id` with `Authorization: Bearer <token>`
- `GET /api/posts/drafts` with `Authorization: Bearer <token>`
- `POST /api/posts/drafts` with `Authorization: Bearer <token>`
- `PATCH /api/posts/drafts/:id` with `Authorization: Bearer <token>`
- `POST /api/posts/drafts/:id/publish` with `Authorization: Bearer <token>`
- `DELETE /api/posts/drafts/:id` with `Authorization: Bearer <token>`
- `POST /api/posts/:id/like` with `Authorization: Bearer <token>`
- `DELETE /api/posts/:id/like` with `Authorization: Bearer <token>`
- `POST /api/posts/:id/bookmark` with `Authorization: Bearer <token>`
- `DELETE /api/posts/:id/bookmark` with `Authorization: Bearer <token>`
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments` with `Authorization: Bearer <token>`
- `DELETE /api/posts/:postId/comments/:commentId` with `Authorization: Bearer <token>`

## Keywords API

- `GET /api/keywords/today`
- `GET /api/keywords/upcoming`
- `GET /api/keywords/archive`

## Users API

- `GET /api/users/me` with `Authorization: Bearer <token>`
- `PATCH /api/users/me` with `Authorization: Bearer <token>`
- `GET /api/users/:handle`

## Social API

- `GET /api/social/me` with `Authorization: Bearer <token>`
- `POST /api/users/:handle/follow` with `Authorization: Bearer <token>`
- `DELETE /api/users/:handle/follow` with `Authorization: Bearer <token>`
- `POST /api/users/:handle/block` with `Authorization: Bearer <token>`
- `DELETE /api/users/:handle/block` with `Authorization: Bearer <token>`
- `POST /api/reports` with `Authorization: Bearer <token>`

## Admin API

- `GET /api/admin/keywords/schedule` with admin `Authorization`
- `GET /api/admin/keywords/recommendations` with admin `Authorization`
- `POST /api/admin/keywords/schedule` with admin `Authorization`
- `PATCH /api/admin/keywords/schedule/:id` with admin `Authorization`
- `GET /api/admin/reports` with admin `Authorization`
- `PATCH /api/admin/reports/:id` with admin `Authorization`

## Database

Set `DATABASE_URL` to a PostgreSQL connection string, then run:

```bash
npm run prisma:deploy
```

For deployed environments, run checked-in migrations with:

```bash
npm run prisma:deploy
```
