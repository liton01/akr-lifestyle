# Architecture and business rules

## Folder structure

```
prisma/
  schema.prisma            Data model (PostgreSQL)
  migrations/              SQL migrations (incl. CHECK constraints: stock ≥ 0, prices ≥ 0 …)
  seed.ts, seed-art.ts     Repeatable development seed + generated placeholder artwork
scripts/create-admin.ts    First-administrator bootstrap
src/
  proxy.ts                 Optimistic auth redirect for /admin, /account, /print (Next 16 "proxy")
  app/
    (store)/               Storefront: home, shop, category, brand(s), search, offers, product,
                           cart, checkout, order receipt, track-order, account/*, auth pages,
                           about, contact, faq, policies, not-found, error
    admin/                 Admin panel (dashboard, reports, orders, returns, customers, messages,
                           products, inventory, categories, brands, attributes, promotions,
                           coupons, banners, delivery zones, settings, staff, notification log, audit log)
    print/orders/[id]/     Printable invoice and packing slip
    api/                   auth, payments/sslcommerz/*, admin/uploads, cron/maintenance, health
    media/[...key]         Serves locally stored uploads
  components/
    ui/                    Design system (buttons, form fields, badges, alerts, pagination, price, rich text)
    store/ account/ auth/  Storefront components
    admin/                 Admin components (forms, tables, charts, image upload)
  lib/                     Pure, shared code: money, pricing engine, permissions, order state
                           machine, constants, zod schemas, settings schema/defaults
  server/
    services/              Business logic (framework-independent, unit/integration tested)
    actions/               Server Actions — thin wrappers: authorise → validate → service → revalidate
    auth/                  Better Auth configuration and session helpers
    notifications/         Email/SMS providers, templates, logged delivery
    payments/              SSLCommerz client and callback handlers
    storage/               Local / S3 storage and image processing
    cache.ts               Tagged caches for settings / categories / brands
    rate-limit.ts          PostgreSQL-backed rate limiter
    audit.ts               Audit log writer
tests/unit | integration | e2e
```

Services never read cookies or headers; they receive an explicit `Actor` (id + role) or cart owner,
which is what makes them directly testable against a real database.

## Money

- Stored as `DECIMAL(12,2)` (BDT). All arithmetic happens in **integer poisha** (`src/lib/money.ts`),
  converted through fixed-point strings — never through floating point.
- Percentages are stored as `DECIMAL` (e.g. `12.50`) and used as basis points (`1250`); rounding is
  half-up with BigInt (`mulDivRound`).
- Coupon discounts are allocated to order lines with the largest-remainder method so the parts sum
  exactly to the discount.
- Displayed as `৳` with Bangladeshi (lakh) digit grouping.

## Pricing and discount stacking (one consistent rule)

Implemented once in `src/lib/pricing/engine.ts` and used by product pages, cart, checkout and order creation.

1. **Regular price** = the variant's own price if set, otherwise the product's selling price.
   (A variant with its own price also uses its own sale price; the sale *window* is always the product's.)
2. **Item level — best single price wins, nothing stacks.** Candidates: the regular price; the scheduled
   sale price (inside its window); the regular price minus each live automatic promotion (store-wide,
   product, category including parent categories, or brand; optional cap per item). The lowest wins.
3. **Order level — at most one coupon.** It applies to the eligible lines' item-level price.
   Coupons may be limited to products/categories, require a minimum merchandise total, cap the
   discount, be first-order-only, have total and per-customer limits (counted by account and phone),
   and may exclude items that already have a sale/promotion price.
4. **Delivery** is added last; free delivery is decided on the merchandise total after all discounts.
5. Totals can never be negative — every discount is clamped to the amount it applies to.

The browser never submits prices. Checkout sends only the customer details, the payment method,
an optional coupon code, an idempotency key and the total it *displayed*; the server re-prices
everything and rejects the order (asking the customer to review) if its total differs.

Each order item stores a snapshot: product name, slug, SKU, variant name and options, image,
**original unit price, discount per unit (+ label), final unit price**, quantity, line subtotal,
allocated coupon discount, line total and cost price. Later catalogue or promotion changes never
alter past orders.

## Inventory policy

- Stock lives in `Inventory` (one row per variant). A database `CHECK (quantity >= 0)` makes negative
  stock impossible regardless of code path.
- **Deducted when the order is placed**, inside the same transaction as the order insert, with
  `UPDATE … SET quantity = quantity - n WHERE quantity >= n`. Under concurrency the second buyer either
  waits for the row lock and then fails the condition, or sees zero stock while repricing. Variants are
  locked in a consistent order to avoid deadlocks; deadlock/serialisation failures are retried.
- For online payments, the deduction acts as a **reservation**: unpaid orders are cancelled automatically
  after the payment window (Settings → Checkout, default 45 minutes) by the maintenance job, and their
  stock is returned.
- **Restored exactly once** on cancellation or "returned to sender" (guarded by `Order.stockRestoredAt`,
  claimed with a conditional update inside a row-locked transaction), and per return request when the
  goods are received (guarded by `ReturnRequest.restockedAt`; staff choose which items are resellable).
- Every change writes an `InventoryMovement` (type, change, before/after, reason, order/return reference,
  actor). Order and return movements carry a unique `dedupeKey`, so a retried operation cannot apply twice.
- Manual adjustments (add/remove or set exact count) require `inventory:adjust` and a reason.
- Low stock = quantity ≤ threshold (variant override or product threshold). Crossing the threshold
  triggers a staff email (when email is configured) and appears on the dashboard and inventory screens.

## Order placement (idempotent)

`placeOrder` in `src/server/services/orders.ts`:

1. Validate input (zod), check the payment method is enabled (and SSLCommerz is configured).
2. Within a transaction: take a PostgreSQL advisory lock on the idempotency key and return the existing
   order if it already exists; lock the cart row; re-price the cart; lock and validate the coupon;
   compute delivery; compare totals; insert the order + items + status history; deduct stock; record
   movements; increment sold counts; consume the coupon atomically (`usedCount < usageLimit`); save the
   address if requested; clear the cart.
3. Any failure rolls everything back. A unique index on `Order.idempotencyKey` is the final guard.

Order numbers look like `AKR261016-7K3QX` (date in the store time zone + random code). Guests get a
signed receipt link (`/order/{number}?token=…`, an HMAC of the order id) and can also track by
order number + phone number.

## Order lifecycle

```
PENDING → CONFIRMED → PROCESSING → PACKED → SHIPPED → DELIVERED → (RETURNED via returns)
   └──────────┴────────────┴──────────┴──▶ CANCELLED        SHIPPED → RETURNED (refused / undelivered)
```

- Customers may cancel their own order while **Pending** or **Confirmed**. Staff may cancel until **Packed**.
- Online-payment orders cannot be marked **Shipped** until paid. A verified online payment auto-confirms a
  pending order (unless the gateway flags it as risky).
- COD: staff record "cash collected" once the order is shipped or delivered.
- Every change is written to `OrderStatusHistory` (who, when, note) and the audit log; customers can be
  notified by email/SMS.

Payment statuses: Pending, Paid, Failed, Partially refunded, Refunded. Refunds are recorded with an
idempotency key and can never exceed the amount paid.

## Returns

Customers request returns from their account within the return window (Settings → Checkout, default
7 days after delivery); staff can open one on a customer's behalf. Flow: Requested → Approved →
Received (restocks chosen items once, updates returned quantities, marks the order Returned when every
unit is back) → Closed; or Rejected. Refunds are recorded separately and may be linked to the return.

## Dashboard metric definitions

All periods use the store time zone (default Asia/Dhaka).

| Metric | Definition |
|---|---|
| Gross sales | Σ total of orders **placed** in the period, excluding cancelled orders |
| Completed sales | Σ total of orders **delivered** in the period (by delivery date) |
| Refunds | Σ completed refunds recorded in the period |
| Net sales | Completed sales − refunds |
| Cancelled | Orders cancelled in the period and their value |
| Average order value | Gross sales ÷ non-cancelled orders placed |
| Pending / in progress / delivered / cancelled orders | Current counts across all orders |
| In stock / low / out of stock | Active variants (SKUs) of non-archived products |

## Security summary

- Authentication by Better Auth (scrypt hashes, httpOnly `SameSite=Lax` session cookies, revocation on
  password reset/role change/deactivation). Deactivated users cannot create sessions.
- Authorisation on the server for every privileged action (`assertPermission`); roles cannot be set
  through any auth endpoint. IDOR protection: customer queries are scoped by user id; carts by owner;
  guest receipts by HMAC token; tracking requires order number **and** phone.
- Mass-assignment protection: zod schemas whitelist fields; cost price is ignored unless the actor may see it.
- CSRF: Server Actions verify the `Origin` header (Next.js); Better Auth checks trusted origins; the
  upload route checks same-origin; payment callbacks are verified with the provider instead of cookies.
- Rate limiting (PostgreSQL-backed, multi-instance safe): sign-in, sign-up, password reset, checkout,
  coupon checks, cart writes, order tracking, contact form, uploads, return requests.
- Uploads are decoded and re-encoded to WebP by sharp (strips metadata, rejects SVG/polyglots, size and
  pixel limits); storage keys are random; local files are served with `nosniff`.
- Security headers: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS in production. React escapes output; admin-managed long text is rendered with a safe formatter
  (no raw HTML). CSV exports neutralise spreadsheet formulas.
- Errors: domain errors carry user-safe messages; anything else is logged server-side and replaced with
  a generic message. Secrets are only read on the server (`src/server/env.ts`).
- Audit log for product, category, brand, inventory, promotion, coupon, banner, delivery, settings,
  order, refund, return and staff/customer operations.
