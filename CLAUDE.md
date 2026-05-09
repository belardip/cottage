@AGENTS.md

# Cottage Trip Planner

**URL**: https://cottage.tenderbones.org
**Password**: gladstone (simple shared-password auth via middleware + cookie)

## Stack
Next.js 16 (App Router), TypeScript, Prisma 7 + LibSQL/SQLite, shadcn/ui, Tailwind v4, Anthropic SDK

## Production Server
- **App location**: `/var/www/cottage`
- **Database**: `/var/www/cottage/prod.db` (SQLite)
- **PM2 process**: `cottage` on port 3001 — `pm2 restart cottage`
- **Logs**: `pm2 logs cottage`
- **Nginx config**: `/etc/nginx/sites-enabled/cottage-tenderbones`

## Deploying

```bash
bash deploy.sh "commit message"
```

Commits, pushes to git, pulls on server, **builds on server**, restarts PM2.

### ⚠️ Do NOT build locally and upload `.next/`

Next.js 16 uses Turbopack for production builds by default. Turbopack hashes module IDs using **absolute file paths**, so a build from `C:\laragon\www\cottage\` produces different hashes than `/var/www/cottage/`. The app will crash with:

```
Error: Cannot find module '@prisma/client-<hash>/runtime/client'
```

Always build on the server. Use `NODE_OPTIONS='--max-old-space-size=3000'` — the server has 1GB RAM + 2.5GB swap and handles it fine (builds in ~22s).

### After schema changes

SSH in and run manually before deploying:

```bash
DATABASE_URL='file:/var/www/cottage/prod.db' npx prisma db push
DATABASE_URL='file:/var/www/cottage/prod.db' npx prisma generate
```

Note: `dotenv/config` in `prisma.config.ts` only reads `.env`, not `.env.local`. Always pass `DATABASE_URL` explicitly for Prisma CLI commands on the server.

## Auth
- Middleware at `src/middleware.ts` checks `cottage_auth` cookie against `COTTAGE_PASSWORD` env var
- Login page at `/login` sets the cookie on success — cookie lasts 1 year
- `COTTAGE_PASSWORD` is in `.env.local` (not committed)
- **Do not use `redirect()` in the login server action** — it doesn't navigate correctly when called from `useTransition`. Return `{ success: true }` and let the client call `router.push()`.
