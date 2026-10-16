import { md5Hex, safeEqual } from "@/server/crypto";

/**
 * SSLCommerz (Bangladesh) hosted-checkout integration, API v4.
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * Flow: create session → redirect customer to GatewayPageURL → SSLCommerz POSTs to our
 * IPN and success/fail/cancel URLs → we verify the signature AND call the validation API
 * with val_id before marking anything as paid.
 */

export type SslcommerzConfig = { storeId: string; storePassword: string; sandbox: boolean };
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function sslcommerzBaseUrl(sandbox: boolean): string {
  return sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";
}

export type SessionParams = {
  tranId: string;
  amount: string; // "1250.00"
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customer: { name: string; email: string; phone: string; address: string; city: string; postcode: string | null };
  productName: string;
  productCategory: string;
  itemCount: number;
  orderId: string;
};

export async function createSession(config: SslcommerzConfig, params: SessionParams, fetchImpl: FetchLike = fetch) {
  const body = new URLSearchParams({
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: params.amount,
    currency: "BDT",
    tran_id: params.tranId,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    ipn_url: params.ipnUrl,
    cus_name: params.customer.name,
    cus_email: params.customer.email,
    cus_add1: params.customer.address,
    cus_city: params.customer.city,
    cus_postcode: params.customer.postcode ?? "1000",
    cus_country: "Bangladesh",
    cus_phone: params.customer.phone,
    shipping_method: "Courier",
    num_of_item: String(params.itemCount),
    ship_name: params.customer.name,
    ship_add1: params.customer.address,
    ship_city: params.customer.city,
    ship_postcode: params.customer.postcode ?? "1000",
    ship_country: "Bangladesh",
    product_name: params.productName.slice(0, 250),
    product_category: params.productCategory,
    product_profile: "physical-goods",
    value_a: params.orderId,
  });
  const response = await fetchImpl(`${sslcommerzBaseUrl(config.sandbox)}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`SSLCommerz session request failed with HTTP ${response.status}`);
  const json = (await response.json()) as { status?: string; failedreason?: string; GatewayPageURL?: string; sessionkey?: string };
  if (json.status !== "SUCCESS" || !json.GatewayPageURL) {
    throw new Error(`SSLCommerz rejected the session: ${json.failedreason ?? "unknown reason"}`);
  }
  const gateway = new URL(json.GatewayPageURL);
  if (gateway.protocol !== "https:" || !gateway.hostname.endsWith("sslcommerz.com")) {
    throw new Error("SSLCommerz returned an unexpected gateway URL.");
  }
  return { gatewayUrl: gateway.toString(), sessionKey: json.sessionkey ?? null };
}

/**
 * Verify the verify_sign hash SSLCommerz attaches to IPN / redirect POSTs:
 * md5 of "key=value&…" over the fields listed in verify_key plus md5(store_passwd), sorted by key.
 */
export function verifyIpnSignature(payload: Record<string, string>, storePassword: string): boolean {
  const verifySign = payload.verify_sign;
  const verifyKey = payload.verify_key;
  if (!verifySign || !verifyKey) return false;
  const keys = verifyKey.split(",").filter(Boolean);
  const data: Record<string, string> = {};
  for (const key of keys) data[key] = payload[key] ?? "";
  data.store_passwd = md5Hex(storePassword);
  const hashString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("&");
  return safeEqual(md5Hex(hashString), verifySign.toLowerCase());
}

export type ValidationResponse = {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  currency_type?: string;
  currency_amount?: string;
  bank_tran_id?: string;
  card_type?: string;
  risk_level?: string;
  risk_title?: string;
};

export async function validateTransaction(config: SslcommerzConfig, valId: string, fetchImpl: FetchLike = fetch): Promise<ValidationResponse> {
  const url = new URL(`${sslcommerzBaseUrl(config.sandbox)}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", config.storeId);
  url.searchParams.set("store_passwd", config.storePassword);
  url.searchParams.set("v", "1");
  url.searchParams.set("format", "json");
  const response = await fetchImpl(url.toString(), { method: "GET", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`SSLCommerz validation failed with HTTP ${response.status}`);
  return (await response.json()) as ValidationResponse;
}

/** Fields safe to keep from provider payloads (no credentials, no card numbers). */
export function sanitizeGatewayPayload(payload: Record<string, unknown>): Record<string, string> {
  const allowed = [
    "status",
    "tran_id",
    "val_id",
    "amount",
    "store_amount",
    "currency",
    "currency_type",
    "currency_amount",
    "bank_tran_id",
    "card_type",
    "card_brand",
    "card_issuer",
    "tran_date",
    "risk_level",
    "risk_title",
    "error",
  ];
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number") out[key] = String(value).slice(0, 200);
  }
  return out;
}
