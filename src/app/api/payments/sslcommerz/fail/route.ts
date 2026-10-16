import { handleFailedCallback, readGatewayForm, receiptUrlForTransaction } from "@/server/payments/callbacks";

export async function POST(request: Request) {
  const payload = await readGatewayForm(request);
  await handleFailedCallback(payload, "FAILED").catch((error) => console.error("[payments] fail callback", error));
  return Response.redirect(await receiptUrlForTransaction(payload.tran_id, "failed"), 303);
}
