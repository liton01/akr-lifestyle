import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/server/env";

export type DeliveryOutcome = { status: "SENT" | "SKIPPED"; detail?: string };

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type SmsMessage = { to: string; message: string };

export interface EmailProvider {
  readonly name: string;
  /** True only when real delivery is configured. */
  readonly delivers: boolean;
  send(message: EmailMessage): Promise<DeliveryOutcome>;
}

export interface SmsProvider {
  readonly name: string;
  readonly delivers: boolean;
  send(message: SmsMessage): Promise<DeliveryOutcome>;
}

/** Development provider: prints the message to the server log. Nothing is delivered. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly delivers = false;
  async send(message: EmailMessage): Promise<DeliveryOutcome> {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[email:console] "${message.subject}" was not delivered — configure EMAIL_PROVIDER=smtp.`);
    } else {
      console.info(`\n[email:console] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    }
    return { status: "SKIPPED", detail: "Console provider — message written to the server log, not delivered." };
  }
}

class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  readonly delivers = true;
  private transporter: Transporter;
  constructor(
    config: { host: string; port: number; secure: boolean; user?: string; password?: string },
    private readonly from: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
  }
  async send(message: EmailMessage): Promise<DeliveryOutcome> {
    await this.transporter.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    return { status: "SENT" };
  }
}

class DisabledSmsProvider implements SmsProvider {
  readonly name = "none";
  readonly delivers = false;
  async send(): Promise<DeliveryOutcome> {
    return { status: "SKIPPED", detail: "SMS provider not configured." };
  }
}

/**
 * Generic JSON HTTP SMS gateway.
 * Sends: POST SMS_API_URL with JSON { to, message, sender_id } and header
 * "Authorization: Bearer SMS_API_KEY". Adapt this class to your provider's API
 * (most Bangladeshi gateways accept a similar request).
 */
class HttpSmsProvider implements SmsProvider {
  readonly name = "http";
  readonly delivers = true;
  constructor(private readonly config: { url: string; apiKey: string; senderId?: string }) {}
  async send(message: SmsMessage): Promise<DeliveryOutcome> {
    const response = await fetch(this.config.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({ to: message.to, message: message.message, sender_id: this.config.senderId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`SMS gateway responded with HTTP ${response.status}`);
    return { status: "SENT" };
  }
}

let emailProvider: EmailProvider | null = null;
let smsProvider: SmsProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (emailProvider) return emailProvider;
  const e = env();
  if (e.EMAIL_PROVIDER === "smtp") {
    if (!e.SMTP_HOST) throw new Error("EMAIL_PROVIDER=smtp requires SMTP_HOST.");
    emailProvider = new SmtpEmailProvider(
      { host: e.SMTP_HOST, port: e.SMTP_PORT, secure: e.SMTP_SECURE, user: e.SMTP_USER, password: e.SMTP_PASSWORD },
      e.EMAIL_FROM,
    );
  } else {
    emailProvider = new ConsoleEmailProvider();
  }
  return emailProvider;
}

export function getSmsProvider(): SmsProvider {
  if (smsProvider) return smsProvider;
  const e = env();
  smsProvider =
    e.SMS_PROVIDER === "http" && e.SMS_API_URL && e.SMS_API_KEY
      ? new HttpSmsProvider({ url: e.SMS_API_URL, apiKey: e.SMS_API_KEY, senderId: e.SMS_SENDER_ID })
      : new DisabledSmsProvider();
  return smsProvider;
}

/** Replace providers (used by tests). */
export function setNotificationProviders(providers: { email?: EmailProvider; sms?: SmsProvider }) {
  if (providers.email) emailProvider = providers.email;
  if (providers.sms) smsProvider = providers.sms;
}

export function notificationStatus() {
  const email = getEmailProvider();
  const sms = getSmsProvider();
  return {
    email: { provider: email.name, delivers: email.delivers },
    sms: { provider: sms.name, delivers: sms.delivers },
  };
}
