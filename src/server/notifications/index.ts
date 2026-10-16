import type { NotificationChannel, OrderStatus } from "@prisma/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { toMinor } from "@/lib/money";
import { maskEmail, maskPhone } from "@/lib/utils";
import type { Db } from "@/server/db";
import { env, siteUrl } from "@/server/env";
import { getEmailProvider, getSmsProvider, type DeliveryOutcome } from "@/server/notifications/providers";
import { smsTemplates, templates, type EmailContent, type OrderSummaryForEmail } from "@/server/notifications/templates";
import { orderReceiptUrl } from "@/server/services/order-access";
import { loadStoreSettings } from "@/server/services/settings";

type LogInput = {
  channel: NotificationChannel;
  template: string;
  recipient: string;
  orderId?: string | null;
};

/** Send through a provider and record the outcome. Never throws — notifications must not break business flows. */
async function deliverAndLog(db: Db, input: LogInput, providerName: string, send: () => Promise<DeliveryOutcome>) {
  const recipientMasked = input.channel === "EMAIL" ? maskEmail(input.recipient) : maskPhone(input.recipient);
  try {
    const outcome = await send();
    await db.notificationLog.create({
      data: {
        channel: input.channel,
        template: input.template,
        recipientMasked,
        provider: providerName,
        status: outcome.status,
        errorMessage: outcome.detail?.slice(0, 300),
        orderId: input.orderId ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[notifications] ${input.template} via ${providerName} failed: ${message}`);
    await db.notificationLog
      .create({
        data: {
          channel: input.channel,
          template: input.template,
          recipientMasked,
          provider: providerName,
          status: "FAILED",
          errorMessage: message.slice(0, 300),
          orderId: input.orderId ?? null,
        },
      })
      .catch(() => undefined);
  }
}

export async function sendEmail(db: Db, template: string, to: string, content: EmailContent, orderId?: string | null) {
  const provider = getEmailProvider();
  await deliverAndLog(db, { channel: "EMAIL", template, recipient: to, orderId }, provider.name, () =>
    provider.send({ to, ...content }),
  );
}

export async function sendSms(db: Db, template: string, to: string, message: string, orderId?: string | null) {
  const provider = getSmsProvider();
  await deliverAndLog(db, { channel: "SMS", template, recipient: to, orderId }, provider.name, () => provider.send({ to, message }));
}

async function storeName(db: Db) {
  return (await loadStoreSettings(db)).general.storeName;
}

async function loadOrderSummary(db: Db, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { productName: true, variantName: true, quantity: true, lineTotal: true } } },
  });
  if (!order) return null;
  const address = order.shippingAddress as { addressLine?: string; area?: string; district?: string };
  const summary: OrderSummaryForEmail = {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    total: toMinor(order.total),
    deliveryFee: toMinor(order.deliveryFee),
    paymentMethodLabel: PAYMENT_METHOD_LABELS[order.paymentMethod],
    items: order.items.map((item) => ({
      name: item.productName,
      variant: item.variantName && item.variantName !== "Default" ? item.variantName : null,
      quantity: item.quantity,
      lineTotal: toMinor(item.lineTotal),
    })),
    shippingAddress: [address.addressLine, address.area, address.district].filter(Boolean).join(", "),
  };
  return { order, summary };
}

export async function notifyOrderPlaced(db: Db, orderId: string) {
  const loaded = await loadOrderSummary(db, orderId);
  if (!loaded) return;
  const { order, summary } = loaded;
  const name = await storeName(db);
  const viewUrl = orderReceiptUrl(order.orderNumber, order.id);
  const jobs: Promise<void>[] = [];
  if (order.customerEmail) {
    jobs.push(sendEmail(db, "ORDER_CONFIRMATION", order.customerEmail, templates.orderConfirmation(name, summary, viewUrl), order.id));
  }
  jobs.push(sendSms(db, "ORDER_CONFIRMATION", order.customerPhone, smsTemplates.orderConfirmation(name, order.orderNumber, summary.total), order.id));
  const staffEmail = env().STORE_NOTIFICATION_EMAIL;
  if (staffEmail) {
    jobs.push(sendEmail(db, "STAFF_NEW_ORDER", staffEmail, templates.staffNewOrder(name, summary, siteUrl(`/admin/orders/${order.id}`)), order.id));
  }
  await Promise.all(jobs);
}

export async function notifyOrderStatus(db: Db, orderId: string, status: OrderStatus, note?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  const name = await storeName(db);
  const viewUrl = orderReceiptUrl(order.orderNumber, order.id);
  const template = status === "CANCELLED" ? "ORDER_CANCELLED" : "ORDER_STATUS_CHANGED";
  const jobs: Promise<void>[] = [];
  if (order.customerEmail) {
    jobs.push(
      sendEmail(db, template, order.customerEmail, templates.orderStatusChanged(name, order.orderNumber, order.customerName, status, viewUrl, note), order.id),
    );
  }
  jobs.push(sendSms(db, template, order.customerPhone, smsTemplates.orderStatusChanged(name, order.orderNumber, status), order.id));
  await Promise.all(jobs);
}

export async function notifyPaymentStatus(db: Db, orderId: string, paid: boolean) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order?.customerEmail) return;
  const name = await storeName(db);
  await sendEmail(
    db,
    paid ? "PAYMENT_RECEIVED" : "PAYMENT_FAILED",
    order.customerEmail,
    templates.paymentStatusChanged(name, order.orderNumber, order.customerName, paid, orderReceiptUrl(order.orderNumber, order.id)),
    order.id,
  );
}

export async function notifyLowStock(db: Db, items: { sku: string; name: string; quantity: number; threshold: number }[]) {
  const staffEmail = env().STORE_NOTIFICATION_EMAIL;
  if (!staffEmail || items.length === 0) return;
  const name = await storeName(db);
  await sendEmail(db, "LOW_STOCK_ALERT", staffEmail, templates.lowStockAlert(name, items, siteUrl("/admin/inventory?stock=low")));
}

export async function sendPasswordResetEmail(db: Db, user: { email: string; name: string }, url: string) {
  const name = await storeName(db);
  await sendEmail(db, "PASSWORD_RESET", user.email, templates.passwordReset(name, user.name, url));
}

export async function sendVerificationEmail(db: Db, user: { email: string; name: string }, url: string) {
  const name = await storeName(db);
  await sendEmail(db, "EMAIL_VERIFICATION", user.email, templates.emailVerification(name, user.name, url));
}

export async function notifyContactMessage(db: Db, message: { name: string; email: string; phone?: string | null; subject: string; message: string }) {
  const staffEmail = env().STORE_NOTIFICATION_EMAIL;
  if (!staffEmail) return;
  const name = await storeName(db);
  await sendEmail(db, "CONTACT_MESSAGE", staffEmail, templates.contactMessage(name, message, siteUrl("/admin/messages")));
}
