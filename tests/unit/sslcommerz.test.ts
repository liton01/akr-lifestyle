import { describe, expect, it } from "vitest";
import { md5Hex } from "@/server/crypto";
import { sanitizeGatewayPayload, verifyIpnSignature } from "@/server/payments/sslcommerz";

const STORE_PASSWORD = "test-store-password";

function sign(payload: Record<string, string>, keys: string[]) {
  const data: Record<string, string> = {};
  for (const key of keys) data[key] = payload[key] ?? "";
  data.store_passwd = md5Hex(STORE_PASSWORD);
  const hash = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("&");
  return { ...payload, verify_key: keys.join(","), verify_sign: md5Hex(hash) };
}

describe("SSLCommerz IPN signature", () => {
  const base = { status: "VALID", tran_id: "AKR261016-ABCDE-WXYZ", val_id: "VAL123", amount: "3260.00", currency: "BDT" };

  it("accepts a correctly signed payload", () => {
    expect(verifyIpnSignature(sign(base, ["amount", "currency", "status", "tran_id", "val_id"]), STORE_PASSWORD)).toBe(true);
  });

  it("rejects tampered values, a wrong store password, or a missing signature", () => {
    const signed = sign(base, ["amount", "currency", "status", "tran_id", "val_id"]);
    expect(verifyIpnSignature({ ...signed, amount: "1.00" }, STORE_PASSWORD)).toBe(false);
    expect(verifyIpnSignature(signed, "other-password")).toBe(false);
    expect(verifyIpnSignature(base, STORE_PASSWORD)).toBe(false);
  });

  it("keeps only safe fields from provider payloads", () => {
    const clean = sanitizeGatewayPayload({ status: "VALID", store_passwd: "secret", card_no: "4111111111111111", amount: "10.00" });
    expect(clean).toEqual({ status: "VALID", amount: "10.00" });
  });
});
