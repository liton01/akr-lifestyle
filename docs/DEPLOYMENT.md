# Deployment, operations and backups

## Production checklist

1. **PostgreSQL** 14+ (managed service or your own server) with automated backups. Create a database and a
   least-privilege user that owns it.
2. **Environment** — set every variable from `.env.example` in the host's secret store (never commit them):
   - `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` = your public `https://` address,
   - a new random `BETTER_AUTH_SECRET` (32+ chars) and `CRON_SECRET`,
   - `STORAGE_PROVIDER=s3` + S3 settings (local disk is not durable on most hosts),
   - SMTP / SMS / SSLCommerz as needed (see INTEGRATIONS.md).
3. **Install, migrate, build, start**:
   ```bash
   npm ci
   ```
   ```bash
   npx prisma migrate deploy
   ```
   ```bash
   npm run build
   ```
   ```bash
   npm run start
   ```
   `next start` listens on `PORT` (default 3000). Run it under a process manager (systemd, PM2, Docker) and
   put it behind a reverse proxy (Nginx, Caddy, Cloudflare) that terminates HTTPS and sets `X-Forwarded-For`
   (used for rate limiting and audit logs).
4. **First administrator**: run `npm run admin:create` once with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then
   remove `ADMIN_PASSWORD` from the environment. Do **not** run the development seed in production unless
   you want the sample catalogue; you can seed only settings/zones by running it and then deleting the
   sample products in the admin.
5. **Scheduled maintenance** — call every 5–15 minutes:
   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/maintenance
   ```
   (cron, systemd timer, Vercel Cron, GitHub Actions…). It cancels expired unpaid online orders (restoring
   stock) and cleans up rate-limit rows, abandoned guest carts and expired sessions.
6. **Health check**: point your load balancer / uptime monitor at `/api/health`.
7. **Review settings** in Admin → Settings (store details, policies, checkout options) and Admin → Delivery zones.

### Hosting notes

- **VPS / Docker**: works as-is. Mount nothing for uploads when using S3.
- **Vercel / serverless**: use S3 storage and a pooled PostgreSQL connection string (e.g. PgBouncer / Neon /
  Supabase pooler); schedule `/api/cron/maintenance` with Vercel Cron and the `Authorization` header.
- **Multiple instances**: rate limits, carts, sessions and stock are in PostgreSQL and safe across instances.
  The storefront caches (settings/categories/brands) are per instance with a 5-minute TTL.
- Keep Node.js on an LTS release (22.12+ or 24).

## Updating

```bash
git pull
```
```bash
npm ci
```
```bash
npx prisma migrate deploy
```
```bash
npm run build
```
Then restart the process. Migrations are forward-only; take a backup before applying them.

## Backups

Back up **the database** and **uploaded files** (the S3 bucket, or `LOCAL_STORAGE_DIR` with local storage).

Database (custom format, compressed):

```bash
pg_dump --format=custom --no-owner --file=backups/akrlifestyle-$(date +%Y%m%d-%H%M).dump "$DATABASE_URL"
```

Windows PowerShell equivalent:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --format=custom --no-owner --file="backups\akrlifestyle-$(Get-Date -Format yyyyMMdd-HHmm).dump" $env:DATABASE_URL
```

Recommendations: daily automated dumps kept for 30 days plus weekly copies kept for 6 months, stored off the
server (object storage in another region); enable point-in-time recovery on managed PostgreSQL; enable bucket
versioning on S3/R2; test a restore every quarter. `backups/` and `*.dump` are git-ignored.

## Restore

Restore into an **empty** database (create it first), then apply any newer migrations:

```bash
createdb -h <host> -U <user> akrlifestyle_restored
```
```bash
pg_restore --no-owner --dbname="postgresql://<user>:<password>@<host>:5432/akrlifestyle_restored" backups/akrlifestyle-YYYYMMDD-HHMM.dump
```
```bash
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/akrlifestyle_restored" npx prisma migrate deploy
```

Point `DATABASE_URL` at the restored database, restore the uploads bucket/folder from the same point in time,
and restart the app. Verify with `/api/health`, a test order on a staging copy, and the admin dashboard.
