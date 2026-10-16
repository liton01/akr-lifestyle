# API reference

The application mostly uses **Server Actions** (called by its own forms, protected by Next.js origin
checks) plus a few **Route Handlers** for integrations. There is no public JSON API for third parties.

## Route handlers

| Method & path | Auth | Purpose |
|---|---|---|
| `GET/POST /api/auth/*` | — | Better Auth endpoints (session, sign-in/up, email verification link, password-reset callback). Rate limited. |
| `POST /api/admin/uploads?folder=products\|categories\|brands\|banners\|branding` | Staff with the folder's write permission; same-origin | Multipart field `file` (JPEG/PNG/WebP/AVIF ≤ 5 MB, ≥ 200×200). Returns `{ url, key, width, height }`. Errors: 401/403/413/422/429. |
| `POST /api/payments/sslcommerz/ipn` | SSLCommerz signature + validation API | Instant payment notification. Marks the payment and order paid only after the validation API confirms status, transaction, amount and currency. Returns `{ received, outcome }`. |
| `POST /api/payments/sslcommerz/success` | Validation API (val_id) | Browser return after payment; validates server-side, then `303` to the receipt page. |
| `POST /api/payments/sslcommerz/fail` | Signature (changes data only if valid) | Browser return after failure → `303` to the receipt page. |
| `POST /api/payments/sslcommerz/cancel` | Signature (changes data only if valid) | Browser return after cancellation → `303` to the receipt page. |
| `GET/POST /api/cron/maintenance` | `Authorization: Bearer $CRON_SECRET` | Cancels expired unpaid online orders (restocks), purges rate-limit rows, abandoned guest carts (60 days) and expired sessions. Returns counts. |
| `GET /api/health` | — | `{ status, database }`; 503 if the database is unreachable. |
| `GET /media/{key}` | — | Serves locally stored uploads (local storage only), immutable cache headers. |
| `GET /admin/reports/export/orders?range=7d\|30d\|90d\|month` or `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `reports:view` | Orders CSV. |
| `GET /admin/reports/export/inventory` | `reports:inventory` | Inventory CSV. |
| `GET /print/orders/{id}/invoice`, `/packing-slip` | `order:read` | Printable documents. |

## Server actions

All actions return `{ ok: true, message?, data? }` or `{ ok: false, message, fieldErrors? }` and never
expose internal errors. Inputs are validated with zod on the server.

### Public / customer — `src/server/actions/*`

| Action | Notes |
|---|---|
| `auth.signInAction`, `registerAction`, `signOutAction` | Rate limited; merges the guest cart into the account cart after sign-in/up |
| `auth.requestPasswordResetAction`, `resetPasswordAction` | Generic response (no account enumeration); 1-hour token |
| `auth.changePasswordAction`, `resendVerificationAction` | Signed-in only; revokes other sessions on change |
| `cart.addToCartAction`, `updateCartItemAction`, `removeCartItemAction`, `clearCartAction` | Stock and per-line limits enforced; items scoped to the caller's cart |
| `cart.applyCouponAction`, `removeCouponAction` | Coupon validated against the current cart |
| `checkout.quoteCheckoutAction` | Server-side re-quote (district, coupon, phone) |
| `checkout.placeOrderAction` | Places the order (see ARCHITECTURE.md); redirects to the receipt or the SSLCommerz gateway |
| `checkout.payOrderAction` | Retry online payment (receipt token or owner session) |
| `checkout.cancelOwnOrderAction` | Customer cancellation (Pending/Confirmed) |
| `account.updateProfileAction`, `saveAddressAction`, `deleteAddressAction`, `setDefaultAddressAction` | Own data only |
| `account.requestReturnAction` | Within the return window |
| `public.trackOrderAction` | Order number + phone; rate limited |
| `public.contactAction` | Honeypot + rate limit; stored and emailed to staff |

### Admin — `src/server/actions/admin/*`

| Module | Actions (permission) |
|---|---|
| `catalog` | `saveProductAction` (product:write), `setProductStatusAction` (product:write), `deleteProductAction` (product:delete; only without order history), category/brand save/delete/reassign (catalog:write), attribute & value save/delete (catalog:write), `adjustStockAction` (inventory:adjust) |
| `orders` | `updateOrderStatusAction`, `updateShippingAction`, `updateAdminNoteAction`, `markCodPaidAction`, return review/receive/close, `staffCreateReturnAction`, `expireUnpaidOrdersAction` (order:update); `recordRefundAction` (order:refund) |
| `store` | customer activate/deactivate & notes (customer:manage), role changes (staff:manage), contact message status (messages:read), promotions/coupons/banners (promotion:write), delivery zones (delivery:write), `saveSettingsAction` (settings:write) |
