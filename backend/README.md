# Ethio Express API (Backend)

This backend was moved under `backend/` to avoid conflicts with the public website root files during merges.

## Run

```bash
cd backend
npm install
npm run dev
```

## Environment

- `DATABASE_URL` (PostgreSQL connection string)
- `PORT` (optional, default `3000`)
- `CORS_ORIGIN` (optional)

## Schema

Apply `backend/db-schema.sql` to your Postgres database.
