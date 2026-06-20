# Cottage Trip Planner

**URL**: https://cottage.tenderbones.org
**Auth**: Shared password (family)
**Users**: Family — single shared login

## Production
- **Location**: `/var/www/cottage` — port 3001
- **Database**: `/var/www/cottage/prod.db`
- **Deploy**: `bash deploy.sh "message"`

## Auth
Simple shared-password auth via middleware + cookie.
- Middleware at `src/middleware.ts` checks `cottage_auth` cookie against `COTTAGE_PASSWORD` env var
- Login page at `/login` sets cookie on success — lasts 1 year
- No per-user accounts; one password for everyone

## Gotchas
- Don't use `redirect()` in the login server action — return `{ success: true }` and navigate client-side with `router.push()`
- Schema changes: SSH in and run before deploying:
  ```bash
  DATABASE_URL='file:/var/www/cottage/prod.db' npx prisma db push
  DATABASE_URL='file:/var/www/cottage/prod.db' npx prisma generate
  ```

See root `CLAUDE.md` for shared Next.js stack conventions.
