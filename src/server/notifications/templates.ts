import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatBDT } from "@/lib/money";

export type EmailContent = { subject: string; text: string; html: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(storeName: string, heading: string, bodyHtml: string, action?: { label: string; url: string }): string {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="background:#171717;color:#F6F1E7;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F6F1E7;font-family:Arial,Helvetica,sans-serif;color:#171717">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#171717;padding:20px 28px;color:#C6A66B;font-size:20px;letter-spacing:2px;font-weight:700">${escapeHtml(storeName.toUpperCase())}</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(heading)}</h1>
${bodyHtml}
${button}
</td></tr>
<tr><td style="padding:16px 28px;background:#faf7f0;color:#424242;font-size:12px">This is an automated message from ${escapeHtml(storeName)}.</td></tr>
</table></td></tr></table></body></html>`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 12px;line-height:1.6;color:#424242">${escapeHtml(text)}</p>`;
}

export type OrderSummaryForEmail = {
  orderNumber: string;
  customerName: string;
  total: number;
  deliveryFee: number;
  paymentMethodLabel: string;
  items: { name: string; variant: string | null; quantity: number; lineTotal: number }[];
  shippingAddress: string;
};

function itemsTable(order: OrderSummaryForEmail) {
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}${item.variant ? ` <span style="color:#777">(${escapeHtml(item.variant)})</span>` : ""} × ${item.quantity}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #eee">${escapeHtml(formatBDT(item.lineTotal))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="font-size:14px;margin:12px 0">${rows}
<tr><td style="padding:6px 0">Delivery</td><td align="right">${escapeHtml(formatBDT(order.deliveryFee))}</td></tr>
<tr><td style="padding:6px 0;font-weight:700">Total</td><td align="right" style="font-weight:700">${escapeHtml(formatBDT(order.total))}</td></tr></table>`;
}

function itemsText(order: OrderSummaryForEmail) {
  return order.items
    .map((item) => `- ${item.name}${item.variant ? ` (${item.variant})` : ""} x${item.quantity}: ${formatBDT(item.lineTotal)}`)
    .join("\n");
}

export const templates = {
  orderConfirmation(storeName: string, order: OrderSummaryForEmail, viewUrl: string): EmailContent {
    const subject = `Order ${order.orderNumber} received — ${storeName}`;
    const text = `Hi ${order.customerName},\n\nThank you for your order ${order.orderNumber}.\n\n${itemsText(order)}\nDelivery: ${formatBDT(order.deliveryFee)}\nTotal: ${formatBDT(order.total)}\nPayment: ${order.paymentMethodLabel}\n\nDelivery address: ${order.shippingAddress}\n\nView your order: ${viewUrl}`;
    const html = layout(
      storeName,
      "Thank you for your order",
      paragraph(`Hi ${order.customerName}, we have received your order ${order.orderNumber}.`) +
        itemsTable(order) +
        paragraph(`Payment: ${order.paymentMethodLabel}`) +
        paragraph(`Delivery address: ${order.shippingAddress}`),
      { label: "View your order", url: viewUrl },
    );
    return { subject, text, html };
  },

  orderStatusChanged(storeName: string, orderNumber: string, name: string, status: OrderStatus, viewUrl: string, note?: string | null): EmailContent {
    const label = ORDER_STATUS_LABELS[status];
    const subject = `Order ${orderNumber} is now ${label.toLowerCase()} — ${storeName}`;
    const text = `Hi ${name},\n\nYour order ${orderNumber} is now ${label}.${note ? `\n\n${note}` : ""}\n\nTrack your order: ${viewUrl}`;
    const html = layout(
      storeName,
      `Your order is ${label.toLowerCase()}`,
      paragraph(`Hi ${name}, your order ${orderNumber} is now ${label}.`) + (note ? paragraph(note) : ""),
      { label: "Track your order", url: viewUrl },
    );
    return { subject, text, html };
  },

  paymentStatusChanged(storeName: string, orderNumber: string, name: string, paid: boolean, viewUrl: string): EmailContent {
    const subject = paid ? `Payment received for order ${orderNumber}` : `Payment for order ${orderNumber} was not completed`;
    const message = paid
      ? `We have received your payment for order ${orderNumber}. Thank you!`
      : `Your payment for order ${orderNumber} was not completed. You can try again from your order page before it expires.`;
    return {
      subject,
      text: `Hi ${name},\n\n${message}\n\n${viewUrl}`,
      html: layout(storeName, paid ? "Payment received" : "Payment not completed", paragraph(`Hi ${name},`) + paragraph(message), {
        label: "View order",
        url: viewUrl,
      }),
    };
  },

  passwordReset(storeName: string, name: string, url: string): EmailContent {
    return {
      subject: `Reset your ${storeName} password`,
      text: `Hi ${name},\n\nWe received a request to reset your password. Use the link below within 1 hour:\n${url}\n\nIf you did not request this, you can ignore this email.`,
      html: layout(
        storeName,
        "Reset your password",
        paragraph(`Hi ${name}, we received a request to reset your password. The link is valid for 1 hour.`) +
          paragraph("If you did not request this, you can safely ignore this email."),
        { label: "Reset password", url },
      ),
    };
  },

  emailVerification(storeName: string, name: string, url: string): EmailContent {
    return {
      subject: `Verify your email for ${storeName}`,
      text: `Hi ${name},\n\nPlease verify your email address:\n${url}`,
      html: layout(storeName, "Verify your email", paragraph(`Hi ${name}, please confirm your email address to secure your account.`), {
        label: "Verify email",
        url,
      }),
    };
  },

  staffNewOrder(storeName: string, order: OrderSummaryForEmail, adminUrl: string): EmailContent {
    return {
      subject: `New order ${order.orderNumber} — ${formatBDT(order.total)}`,
      text: `New order ${order.orderNumber} from ${order.customerName}.\n\n${itemsText(order)}\nTotal: ${formatBDT(order.total)}\nPayment: ${order.paymentMethodLabel}\n\n${adminUrl}`,
      html: layout(storeName, `New order ${order.orderNumber}`, paragraph(`Customer: ${order.customerName}`) + itemsTable(order), {
        label: "Open in admin",
        url: adminUrl,
      }),
    };
  },

  lowStockAlert(storeName: string, items: { sku: string; name: string; quantity: number; threshold: number }[], adminUrl: string): EmailContent {
    const lines = items.map((i) => `${i.name} (${i.sku}): ${i.quantity} left (threshold ${i.threshold})`);
    return {
      subject: `Low stock alert: ${items.length} item${items.length === 1 ? "" : "s"}`,
      text: `The following items are low on stock:\n\n${lines.join("\n")}\n\n${adminUrl}`,
      html: layout(
        storeName,
        "Low stock alert",
        `<ul style="color:#424242;line-height:1.6">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
        { label: "Review inventory", url: adminUrl },
      ),
    };
  },

  contactMessage(storeName: string, msg: { name: string; email: string; phone?: string | null; subject: string; message: string }, adminUrl: string): EmailContent {
    return {
      subject: `Contact form: ${msg.subject}`,
      text: `From: ${msg.name} <${msg.email}>${msg.phone ? ` (${msg.phone})` : ""}\n\n${msg.message}\n\n${adminUrl}`,
      html: layout(
        storeName,
        `New message: ${msg.subject}`,
        paragraph(`From: ${msg.name} <${msg.email}>${msg.phone ? ` (${msg.phone})` : ""}`) +
          `<div style="white-space:pre-wrap;color:#424242;line-height:1.6">${escapeHtml(msg.message)}</div>`,
        { label: "Open messages", url: adminUrl },
      ),
    };
  },
};

export const smsTemplates = {
  orderConfirmation: (storeName: string, orderNumber: string, total: number) =>
    `${storeName}: Your order ${orderNumber} (${formatBDT(total)}) has been received. Thank you!`,
  orderStatusChanged: (storeName: string, orderNumber: string, status: OrderStatus) =>
    `${storeName}: Your order ${orderNumber} is now ${ORDER_STATUS_LABELS[status]}.`,
};
