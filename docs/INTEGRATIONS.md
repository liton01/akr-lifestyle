# Third-party integrations

Nothing here is required to run the store locally: without credentials, online payment is hidden at
checkout, emails are printed to the server log (`EMAIL_PROVIDER=console`), SMS is skipped, and uploads
are stored on local disk. Every notification attempt is recorded in **Admin → Notification log** with
its real outcome (`sent`, `failed` or `skipped`). Recipients are masked in the log.

## SSLCommerz (online payments)

1. Register a sandbox store at <https://developer.sslcommerz.com/registration/> to get a **Store ID** and **Store Password**.
2. Set in `.env` (server only — never exposed to the browser):
   ```env
   SSLCOMMERZ_STORE_ID="your_store_id"
   SSLCOMMERZ_STORE_PASSWORD="your_store_password"
   SSLCOMMERZ_SANDBOX="true"
   ```
3. Make sure `NEXT_PUBLIC_SITE_URL` is the public HTTPS address of the site. SSLCommerz posts back to:
   - IPN: `{site}/api/payments/sslcommerz/ipn` (configure it as the IPN URL in the merchant panel too)
   - Success / fail / cancel: `{site}/api/payments/sslcommerz/success|fail|cancel`
   For local testing expose the dev server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3100`) and use the tunnel URL.
4. Enable **Settings → Checkout → Online payment**.
5. Go live: set `SSLCOMMERZ_SANDBOX="false"` with live credentials.

How verification works (`src/server/services/payments.ts`):

- A payment attempt is created with a unique `tran_id` (`{orderNumber}-{code}`) and the order total.
- IPN posts must carry a valid `verify_sign` (MD5 over the `verify_key` fields + md5(store password)).
- Before anything is marked paid, the server calls the **validation API** with `val_id` and requires
  status `VALID`/`VALIDATED`, the same `tran_id`, currency BDT and the exact amount. Duplicate IPNs are
  idempotent. Visiting the success URL never marks an order as paid by itself.
- Gateway-flagged risky payments are recorded but the order is not auto-confirmed.
- Unpaid orders are cancelled after the payment window and their stock released (maintenance job).
- Refunds are recorded manually in the admin; the SSLCommerz refund API is not called automatically.

## Email (SMTP)

```env
EMAIL_PROVIDER="smtp"
EMAIL_FROM="AKR Lifestyle <no-reply@yourdomain.com>"
SMTP_HOST="smtp.yourprovider.com"
SMTP_PORT="587"
SMTP_SECURE="false"        # "true" for port 465
SMTP_USER="..."
SMTP_PASSWORD="..."
STORE_NOTIFICATION_EMAIL="orders@yourdomain.com"   # staff alerts: new orders, low stock, contact form, returns
```

Any SMTP service works (Amazon SES, Mailgun, Brevo, Resend SMTP, Google Workspace…). Configure SPF/DKIM for
your sending domain. Emails sent: order confirmation, status changes, cancellation, payment received/failed,
password reset, email verification, staff alerts.

To require email verification before customers can sign in, set `AUTH_REQUIRE_EMAIL_VERIFICATION="true"`
(only once real email delivery works).

## SMS

```env
SMS_PROVIDER="http"
SMS_API_URL="https://your-sms-gateway.example/api/send"
SMS_API_KEY="..."
SMS_SENDER_ID="AKR"
```

The built-in `HttpSmsProvider` sends `POST SMS_API_URL` with JSON `{ "to", "message", "sender_id" }` and
`Authorization: Bearer SMS_API_KEY`. Bangladeshi gateways (e.g. BulkSMSBD, SSL Wireless, Alpha SMS) each have
their own request format — adapt `HttpSmsProvider` in `src/server/notifications/providers.ts` to match. A
WhatsApp Business provider can be added behind the same `SmsProvider` interface (WhatsApp requires approved
message templates).

## File storage (S3-compatible)

Local storage (`STORAGE_PROVIDER=local`) writes to `LOCAL_STORAGE_DIR` and is only suitable for development
or a single server with a persistent, backed-up disk. For production use any S3-compatible bucket:

```env
STORAGE_PROVIDER="s3"
S3_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"   # omit for AWS S3
S3_REGION="auto"                                            # e.g. ap-southeast-1 for AWS
S3_BUCKET="akr-media"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_URL="https://cdn.yourdomain.com"                  # public base URL serving the bucket
S3_FORCE_PATH_STYLE="false"                                 # "true" for MinIO
```

`S3_PUBLIC_URL` must be available at **build time** too (it is added to `next/image` remote patterns).
Uploaded images are re-encoded to WebP and stored with long-lived cache headers under random keys.
