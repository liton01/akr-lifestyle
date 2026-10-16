# AKR Lifestyle

> *Your Style. Your Technology. Your AKR.*

Production-oriented e-commerce application for **AKR Lifestyle** — electronics, gadgets,
watches, jewellery and lifestyle accessories in Bangladesh. Storefront, customer accounts,
cart & checkout (cash on delivery + SSLCommerz), inventory, promotions, order management,
reporting and a full admin panel, backed by PostgreSQL.

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Database | PostgreSQL 14+ (developed on 18) with Prisma ORM 6 + SQL migrations |
| Auth | Better Auth 1.7 (email + password, scrypt hashing, httpOnly sessions, email verification, password reset) |
| Validation | Zod 4 on every server boundary |
| UI | Tailwind CSS 4, custom component system, lucide icons |
| Images | sharp (decode → validate → re-encode to WebP), local or S3-compatible storage |
| Email / SMS | Provider interface: console (dev) or SMTP via nodemailer; generic HTTP SMS gateway |
| Payments | Cash on delivery; SSLCommerz hosted checkout with signature + validation-API verification |
| Tests | Vitest (unit + integration on a real PostgreSQL test DB), Playwright (end-to-end) |

Further reading:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — folder structure and the business rules (pricing, coupons, stock, order lifecycle, metrics).
- [docs/API.md](docs/API.md) — route handlers and server actions.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — SSLCommerz, email, SMS, S3 storage: what needs credentials.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — production deployment, scheduled job, backups and restore.

---

## 1. Requirements

- **Node.js 22.9 or newer** (Node 22 LTS ≥ 22.12 or Node 24 LTS recommended).
- **PostgreSQL 14+** running locally or remotely.
- npm 10+.
- Google Chrome (only for the end-to-end tests; or install Playwright's Chromium).

> Package versions are pinned to ones that run on Node 22.9 (Prisma 6.19, Vitest 4, ESLint 9).
> After upgrading Node to ≥ 22.12 you may move to Prisma 7 / Vitest 5 / ESLint 10.

## 2. First-time setup

```bash
npm install
```

Create the databases (once). With `psql` (PostgreSQL's `bin` folder must be on `PATH`, e.g. `C:\Program Files\PostgreSQL\18\bin`):

```bash
createdb -h localhost -U postgres akrlifestyle
```

```bash
createdb -h localhost -U postgres akrlifestyle_test
```

(`prisma migrate` also creates the main database automatically if it does not exist.)

Create your environment file and fill it in:

```bash
cp .env.example .env
```

At minimum set `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ random characters) and
`ADMIN_EMAIL` / `ADMIN_PASSWORD` for the first administrator. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Apply the migrations and load the development seed:

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

The seed is **repeatable** — it skips anything that already exists and never overwrites admin edits.
It creates store settings, delivery zones (Inside Dhaka / Dhaka Suburbs / Outside Dhaka), categories,
sample brands, attributes, 23 sample products with variants and stock, promotions, coupons
(`WELCOME10`, `AKR500`, `WATCH1000`, expired `SUMMER25`), banners and — if `ADMIN_EMAIL` /
`ADMIN_PASSWORD` are set — the first administrator. Sample brands and artwork are fictional and
generated locally; replace them with your real catalogue in **Admin → Products**.

Start the development server:

```bash
npm run dev
```

Open <http://localhost:3100> (storefront) and <http://localhost:3100/admin> (admin).
The dev server uses port **3100** so it does not clash with other local apps on 3000; if you change it,
update `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` to match.

## 3. Administrator bootstrap

No default password is ever shipped. The first administrator is created from environment variables:

```bash
npm run admin:create
```

- Reads `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 12 characters, at least three of lower/upper/digit/symbol) and `ADMIN_NAME`.
- Creates the account (password hashed with Better Auth's scrypt) or promotes an existing user to Administrator.
- An existing password is kept unless you pass `--reset-password`: `npm run admin:create -- --reset-password`.
- Remove `ADMIN_PASSWORD` from the environment afterwards. Further staff are managed in **Admin → Staff & roles**.

Roles: **Customer**, **Administrator**, **Store Manager**, **Inventory Manager** — see the permission
matrix in Admin → Staff & roles or `src/lib/permissions.ts`. Every privileged server action checks
its permission on the server.

## 4. Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on port 3100 |
| `npm run build` | Production build (type-checks as part of the build) |
| `npm run start` | Start the production server (`PORT` env var or 3000) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (run `npx next typegen` first on a fresh clone) |
| `npm test` | Unit + integration tests |
| `npm run test:unit` | Unit tests only (no database needed) |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL` |
| `npm run test:e2e` | Production build + Playwright end-to-end tests (port 3200, test DB) |
| `npm run check` | lint + typecheck + tests + build |
| `npm run db:migrate` | Create/apply a migration in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations (production / CI) |
| `npm run db:seed` | Repeatable development seed |
| `npm run db:studio` | Prisma Studio |
| `npm run admin:create` | Create or promote the first administrator |

## 5. Tests

```bash
npm test
```

- **Unit** (`tests/unit`) — money arithmetic, pricing/discount/coupon rules, delivery fees, permissions,
  order state machine, input validation, SSLCommerz signature verification, CSV safety.
- **Integration** (`tests/integration`) — run against the real PostgreSQL **test** database
  (`TEST_DATABASE_URL`; the runner refuses any database whose name does not contain `test` and
  truncates it between tests). Covers product create/edit/variants/archive/delete rules, category
  and brand deletion rules, cart quantity validation and merge, server-side pricing and snapshots,
  price-change detection, **concurrent checkouts never overselling**, **duplicate submissions creating
  one order**, coupon limits under concurrency, cancellation/return **restocking exactly once**,
  unpaid-order expiry, COD collection, refunds, gateway payment verification (mocked provider),
  inventory adjustments, settings validation and permissions, account deactivation, admin bootstrap
  and rate limiting.
- **End-to-end** (`tests/e2e`) — guest browse → cart → COD checkout → confirmation → order tracking;
  validation keeps typed values; registration and admin-area protection; admin creates a product that
  appears in search; admin confirms an order. `npm run test:e2e` builds, resets + seeds the test
  database and starts the app on port 3200. It uses the installed Google Chrome by default; set
  `PLAYWRIGHT_CHANNEL=` (empty) and run `npx playwright install chromium` to use bundled Chromium.

## 6. Configuration reference

All variables are documented in [.env.example](.env.example). Integrations that need credentials
(SSLCommerz, SMTP, SMS, S3) are **disabled or console-only until configured** — the app never claims
a message was delivered or a payment was taken unless the provider confirms it. Details in
[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## 7. Known limitations / next steps

- SSLCommerz refunds are recorded manually (Admin → Order → Refunds); the gateway refund API is not called.
- The generic HTTP SMS provider sends `{ to, message, sender_id }` JSON; adapt `HttpSmsProvider` in
  `src/server/notifications/providers.ts` to your gateway's exact API.
- Storefront caches (settings, categories, brands) are per server instance with a 5-minute TTL; admin
  changes invalidate them immediately on the instance that made the change. For multiple instances,
  configure a shared Next.js cache handler or accept up to 5 minutes of staleness.
- `npm audit` reports 3 "high" advisories in `deepmerge-ts`, used only by the Prisma CLI's config loader
  (migrations, trusted local config). It is not reachable from user input; upgrade Prisma when a patched
  6.x/7.x release is available.
