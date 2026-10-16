import { handleSuccessfulCallback, readGatewayForm, receiptUrlForTransaction } from "@/server/payments/callbacks";

/**
 * The customer's browser is POSTed here by SSLCommerz after paying. We validate the
 * transaction with the provider (val_id) before showing it as paid; visiting this URL
 * alone never marks an order as paid.
 */
export async function POST(request: Request) {
  const payload = await readGatewayForm(request);
  let outcome = "pending";
  try {
    const result = await handleSuccessfulCallback(payload);
    outcome = result.outcome === "PAID" || result.outcome === "ALREADY_PAID" ? "success" : result.outcome === "INVALID" ? "failed" : "pending";
  } catch (error) {
    console.error("[payments] success callback validation failed", error);
  }
  return Response.redirect(await receiptUrlForTransaction(payload.tran_id, outcome), 303);
}

export async function GET() {
  return Response.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"), 303);
}
