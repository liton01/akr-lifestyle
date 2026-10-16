import { handleFailedCallback, handleSuccessfulCallback, readGatewayForm, signatureValid } from "@/server/payments/callbacks";

/**
 * SSLCommerz Instant Payment Notification (server-to-server).
 * The signature is checked first, then the transaction is validated with the
 * provider's validation API before the order is marked as paid.
 */
export async function POST(request: Request) {
  const payload = await readGatewayForm(request);
  if (!payload.tran_id) return new Response("Missing transaction", { status: 400 });
  if (!signatureValid(payload)) return new Response("Invalid signature", { status: 400 });

  const status = (payload.status ?? "").toUpperCase();
  if (status === "VALID" || status === "VALIDATED") {
    const result = await handleSuccessfulCallback(payload);
    return Response.json({ received: true, outcome: result.outcome });
  }
  if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED" || status === "UNATTEMPTED") {
    await handleFailedCallback(payload, status === "CANCELLED" ? "CANCELLED" : "FAILED");
  }
  return Response.json({ received: true });
}
