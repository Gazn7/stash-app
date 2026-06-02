# stash-app

Mobile-first demo app for social money challenges.

## Stack

- Frontend: single-file `index.html`
- Backend: Vercel API route compatibility layer under `/api/rest/v1/:table`
- Database: standard PostgreSQL, tested for Neon-style `POSTGRES_URL`
- Tests: Playwright mock E2E, no live DB required

## Local Static Test

```bash
npm install
npm run test:e2e:mock
npm run dev:static
```

Open `http://127.0.0.1:4173/`.

## Database Setup

Create any PostgreSQL database, for example Neon. Then set:

```bash
export POSTGRES_URL='postgres://user:password@host:5432/database?sslmode=require'
npm run db:migrate
```

The migration is in `db/schema.sql`.

## Vercel Deploy

1. Import this repo/project in Vercel.
2. Add environment variable `POSTGRES_URL`.
3. Run `npm run db:migrate` once from a shell that has `POSTGRES_URL`.
4. Deploy.

The frontend talks to the same-origin API:

```text
/api/rest/v1/users
/api/rest/v1/challenges
/api/rest/v1/groups
```

No Supabase URL or key is used by the frontend anymore.
