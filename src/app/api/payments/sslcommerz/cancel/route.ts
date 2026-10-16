import { handleFailedCallback, readGatewayForm, receiptUrlForTransaction } from "@/server/payments/callbacks";

export async function POST(request: Request) {
  const payload = await readGatewayForm(request);
  await handleFailedCallback(payload, "CANCELLED").catch((error) => console.error("[payments] cancel callback", error));
  return Response.redirect(await receiptUrlForTransaction(payload.tran_id, "cancelled"), 303);
}
